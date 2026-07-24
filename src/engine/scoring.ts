import type {
  CrewRole,
  Genre,
  Person,
  PostProductionChoices,
  ProductionChoices,
  ProductionEvent,
  Script,
  ScriptCharacter,
  TalentAssignment,
} from '../types';
import { GENRE_PROFILES } from '../data/genres';
import { TONES } from '../data/tones';
import { computeCharacterCompatibility, computeTalentCompatibility } from './compatibility';
import { deriveCommercialProfile } from './commercialProfile';
import { findAssignedPerson, filterAssignedPeople } from '../data/helpers';
import { getActorCareer, getCrewCareer, getDirectorCareer } from './person';
import { characterForRoleSlot } from './castRequirements';
import {
  contingencyQuality,
  editCoverageCeiling,
  overallSpendT,
  shootingQualityFromRatio,
  setQualityScore,
  practicalEffectsScore,
  realizedVfxScore,
  runtimeMarketabilityDelta,
  marketingBuzzContribution,
} from './productionDials';
import { EDIT_STYLE_PROFILES, FINAL_CUT_FOCUS_PROFILES, MUSIC_FOCUS_PROFILES } from '../data/postProduction';
import { computeQualityWeights } from './genreWeights';
import { computeExecutionProfile, type ExecutionProfile } from './productionExecution';
import { computeRealizedPerformance } from './actingModel';
import { clamp } from './random';

function getDirector(talent: TalentAssignment[]): Person | undefined {
  return findAssignedPerson(talent, 'Director');
}

/** A script can call for more than one lead (Script.requiredLeads) - see castRequirements.ts. */
function getLeadActors(talent: TalentAssignment[]): Person[] {
  return filterAssignedPeople(talent, 'Lead Actor');
}

function getSupportingActors(talent: TalentAssignment[]): Person[] {
  return filterAssignedPeople(talent, 'Supporting Actor');
}

/** How well a hired person suits this specific script under `role` - see computeTalentCompatibility. */
function compatibility(person: Person | undefined, role: 'Director' | 'Lead Actor' | 'Supporting Actor', script: Script): number {
  if (!person) return 50; // no one hired for this role -> neutral default
  return computeTalentCompatibility(person, role, script) ?? 50;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * A crew hire's 0-100 craft skill for the role they occupy, or a neutral 50 when
 * the seat is empty - so an unstaffed production (and every existing crew-less
 * fixture and rival) reads exactly as before a given craft role was wired in.
 * This is the single seam that gives Cinematographer/Composer/Editor/VFX
 * Supervisor a voice in the department node they belong to (see
 * docs/DESIGN_REVIEW_crew_role_impact.md); before this they reached quality only
 * through the occasional skill-sensitive on-set event.
 */
function crewSkill(talent: TalentAssignment[], role: CrewRole): number {
  const person = findAssignedPerson(talent, role);
  if (!person) return 50;
  return getCrewCareer(person, role)?.skill ?? 50;
}

/**
 * Script quality independent of genre fit - pure craft (originality,
 * structure, characters, dialogue), evenly weighted. No commercial term any
 * more (docs/DESIGN.md - screenplay redesign, "split marketability"): what
 * used to be Script.marketability's 0.15 slot here conflated "is this
 * well-written" with "is this sellable," which is exactly the "asking one
 * stat to do too much" problem the redesign set out to fix - commercial
 * appeal now only enters the scoring chain via computeMarketabilityScore/
 * computeBuzzScore below, both already-separate concepts.
 */
export function computeScriptScore(script: Script): number {
  return script.originality * 0.25 + script.structure * 0.25 + script.characters * 0.25 + script.dialogue * 0.25;
}

/**
 * How closely a screenplay's actual tone profile matches its genre's
 * canonical vector - replaces the old independently-rolled Script.genreFit
 * stat (docs/DESIGN.md - screenplay redesign). A script generated with a
 * strong flavor boost (an action-comedy, a horror-tragedy) reads as a
 * looser fit for its headline genre than a "straight" one, which is exactly
 * what genre fit is supposed to capture - derived from the same tone
 * profile the player already sees, not a second independent number.
 */
function deriveGenreFit(script: Script, genre: Genre): number {
  const canonical = GENRE_PROFILES[genre].canonicalTone;
  const totalDeviation = TONES.reduce((sum, tone) => sum + Math.abs(script.toneProfile[tone] - canonical[tone]), 0);
  return clamp(100 - totalDeviation / TONES.length, 0, 100);
}

/** Director's contribution: raw skill plus how well their style suits this script. */
export function computeDirectionScore(talent: TalentAssignment[], script: Script): number {
  const director = getDirector(talent);
  const career = director && getDirectorCareer(director);
  if (!career) return 35; // no director hired is a serious quality hit
  return career.skill * 0.6 + compatibility(director, 'Director', script) * 0.4;
}

// How much a specific Character's own trait demands weigh against overall
// script-tone compatibility for a given hire (Character and Setting
// Foundations milestone) - script-tone fit stays the majority share (this
// is still fundamentally "does their style suit this film"), but a genuine,
// not-purely-decorative share now goes to "do they suit the actual role
// they're playing," per the milestone's own central design principle.
const CHARACTER_COMPATIBILITY_WEIGHT = 0.4;

/**
 * A hired actor's fit for the specific slot they're cast in - blends their
 * overall script-tone compatibility with computeCharacterCompatibility
 * against whichever Character sits at this slot (castRequirements.ts:
 * characterForRoleSlot). Falls back to script-tone compatibility alone if
 * this slot has no matching Character (shouldn't happen once generation
 * keeps requiredLeads/requiredSupporting and Script.cast in lockstep, but
 * stays honest rather than assuming it always will).
 */
function actorFitScore(person: Person, role: 'Lead Actor' | 'Supporting Actor', character: ScriptCharacter | null, script: Script): number {
  const scriptFit = compatibility(person, role, script);
  const actorCareer = getActorCareer(person);
  if (!character || !actorCareer) return scriptFit;
  const characterFit = computeCharacterCompatibility(actorCareer.actingStyle, character.traits);
  return scriptFit * (1 - CHARACTER_COMPATIBILITY_WEIGHT) + characterFit * CHARACTER_COMPATIBILITY_WEIGHT;
}

/**
 * Which Character an actor assignment is cast as: its explicit binding
 * (characterId) when present, else the positional slot it occupies within its
 * role group - the legacy mapping, kept as a fallback so pre-binding casts
 * (and any assignment built without a characterId) score exactly as before.
 * See docs/DESIGN_REVIEW_casting_slot_binding.md.
 */
function characterForAssignment(assignment: TalentAssignment, indexWithinRole: number, role: 'Lead Actor' | 'Supporting Actor', script: Script): ScriptCharacter | null {
  if (assignment.characterId) {
    return script.cast.find((c) => c.id === assignment.characterId) ?? characterForRoleSlot(script, role, indexWithinRole);
  }
  return characterForRoleSlot(script, role, indexWithinRole);
}

/**
 * Combined lead + supporting acting quality, weighted toward the leads. Each
 * performer's contribution is the performance they actually DELIVER on this film
 * (engine/actingModel.ts:computeRealizedPerformance) - their craft floor plus
 * whatever the director unlocks on top, gated by how well they fit the role.
 * Role-fit (the old style<->script<->character reading) is now one input to that
 * rather than the whole story: a great actor in the wrong role, or a
 * high-headroom actor paired with a hands-off or mismatched director, delivers
 * far less than their ceiling. Both Lead and Supporting can hold more than one
 * person (requiredLeads/requiredSupporting) and either ensemble is *averaged*,
 * not summed.
 */
export function computeActingScore(talent: TalentAssignment[], script: Script): number {
  const director = getDirector(talent);
  const leads = talent.filter((a) => a.role === 'Lead Actor');
  const supports = talent.filter((a) => a.role === 'Supporting Actor');

  const performance = (a: TalentAssignment, i: number, role: 'Lead Actor' | 'Supporting Actor'): number => {
    const roleFit = actorFitScore(a.person, role, characterForAssignment(a, i, role, script), script);
    return computeRealizedPerformance(a.person, director, roleFit);
  };

  const leadScoreAvg = average(leads.map((a, i) => performance(a, i, 'Lead Actor')));
  const supportScoreAvg = average(supports.map((a, i) => performance(a, i, 'Supporting Actor')));

  return (leadScoreAvg ?? 30) * 0.7 + (supportScoreAvg ?? 30) * 0.3;
}

/**
 * Quality contributed by production choices. VFX/practical-effects weight is
 * scaled per genre - Action/Sci-Fi/Fantasy lean on VFX, Drama/Romance don't.
 * `shootingRatio` is daysElapsed/recommendedDays from the finished shoot
 * (PhotographyState) - shooting quality is read off how photography
 * actually went, not a pre-set pace dial (see
 * productionDials.ts:shootingQualityFromRatio).
 *
 * The VFX spend's realised value is now scaled by the VFX Supervisor's craft
 * (realizedVfxScore) rather than being money alone: the same VFX budget lands
 * better under a strong supervisor, and this enters via the already
 * genre-scaled effects term, so a great VFX Supervisor matters on an Action
 * tentpole and barely at all on a chamber drama (a real genre trade-off, not a
 * flat bonus). `talent` is optional - omitted, every crew skill reads a neutral
 * 50, so this scores exactly as before for crew-less callers.
 */
export function computeProductionScore(choices: ProductionChoices, genre: Genre, shootingRatio: number, talent: TalentAssignment[] = []): number {
  const profile = GENRE_PROFILES[genre];
  const contingency = contingencyQuality(choices.contingencyAmount);
  const style = shootingQualityFromRatio(shootingRatio);
  const set = setQualityScore(choices.setQualityAmount);
  const practical = practicalEffectsScore(choices.practicalEffectsAmount);
  const vfx = realizedVfxScore(choices.vfxAmount, crewSkill(talent, 'VFX Supervisor'));

  const effectsWeightTotal = profile.vfxImportance + profile.practicalEffectsImportance;
  const effectsScore =
    effectsWeightTotal > 0
      ? (vfx * profile.vfxImportance + practical * profile.practicalEffectsImportance) / effectsWeightTotal
      : (vfx + practical) / 2;

  return contingency * 0.35 + style * 0.25 + set * 0.2 + effectsScore * 0.2;
}

/**
 * Combines a film's on-set (PhotographyState.events) and post-production
 * (FilmDraft.postProductionEvents) event histories into the one list every
 * quality/buzz reader below actually consumes - the single seam that lets
 * the two stay separate, honestly-named collections in storage (a test
 * screening happens after the shoot wraps, so it was never really a
 * "photography" event) while still reaching the same scoring pipeline as
 * a single, undivided sum. Cost is deliberately NOT combined this way
 * anywhere - a resolved post-production intervention's cost is charged
 * immediately (state/studioReducer.ts:RESOLVE_TEST_SCREENING_CHOICE), not
 * deferred like an on-set event's, so callers that sum costDelta (e.g.
 * engine/cost.ts:computeEventsCostDelta at RELEASE_FILM time) read the two
 * collections separately - see engine/releaseFilm.ts's own note.
 */
export function combineProductionEvents(photographyEvents: ProductionEvent[], postProductionEvents: ProductionEvent[]): ProductionEvent[] {
  return [...photographyEvents, ...postProductionEvents];
}

/**
 * Net quality swing from every rolled production event (positive and
 * negative), as a display-only 0-100 reading (FilmDetailModal,
 * ReleaseResults) - not what actually feeds Quality Score any more, see
 * computeQualityBreakdown's own comment for where the raw qualityDelta sum
 * actually lands (folded into Production, unamplified). Fed
 * combineProductionEvents' output by callers that want on-set and
 * post-production events both represented, same as everywhere else.
 */
export function computeEventsScore(events: ProductionEvent[]): number {
  const totalQualityDelta = events.reduce((sum, e) => sum + e.qualityDelta, 0);
  // Each event's raw delta is small (roughly -10..+10); amplify so a
  // shoot's worth of events (however many days it actually took - no
  // longer a fixed 3-5) meaningfully moves this display reading away from a
  // neutral 50. Clamped below, so an unusually long shoot with many events
  // saturates rather than blowing past the scale.
  return clamp(50 + totalQualityDelta * 2, 0, 100);
}

/**
 * Post-production craft score from editing and music choices. No longer
 * reads a testScreeningResponse term (Post-Production Redesign, Phase B -
 * docs/DESIGN_REVIEW_post_production_redesign.md section 2): a real test
 * screening now happens, and its resolved quality outcome reaches the film
 * through the same eventsQualityDelta pathway an on-set event already uses
 * (folded into PhotographyState.events, read by computeQualityBreakdown
 * below), not through a flat blind choice made before any screening
 * happened. "Release As-Is" - the new zero-quality-change baseline choice -
 * is what the old default ('Minor Changes', +8) used to paper over for
 * free; a player who genuinely does nothing now correctly sees no boost,
 * same as this function's own base score always meant "no post-production
 * choices have helped yet."
 */
// How much the Editor's and Composer's craft swing the post-production sub-score.
// Post-Production is a top-level Quality weight, so this is where a craft crew
// hire buys the most (docs/DESIGN_REVIEW_crew_role_impact.md). Both are centred
// at skill 50 (zero swing / unit music factor), so a post team left unstaffed -
// and every existing crew-less fixture and rival - reads exactly the old
// choice-only score. The Editor authors the base quality of the cut itself; the
// Composer both contributes directly and scales how much the chosen music focus
// actually delivers (a bold score from a journeyman is not a bold score from a
// master).
const EDITOR_QUALITY_SWING = 14; // +/- at ceiling/floor skill vs neutral
const COMPOSER_QUALITY_SWING = 8;

/** A crew craft contribution centred at neutral skill 50: 0 at 50, +swing at 100, -swing at 0. */
function craftSwing(skill: number, swing: number): number {
  return ((skill - 50) / 50) * swing;
}

export function computePostProductionScore(choices: PostProductionChoices, editorSkill = 50, composerSkill = 50): number {
  const base = 55;
  // A stronger composer makes the same music focus land harder (and a weaker one
  // squanders it); factor 1.0 at neutral skill 50.
  const musicSkillFactor = 0.5 + composerSkill / 100;
  const music = MUSIC_FOCUS_PROFILES[choices.musicFocus].qualityDelta * musicSkillFactor;
  const balancedBonus = choices.editStyle === 'Balanced' ? 5 : 0;
  const editorContribution = craftSwing(editorSkill, EDITOR_QUALITY_SWING);
  const composerContribution = craftSwing(composerSkill, COMPOSER_QUALITY_SWING);
  return clamp(base + music + balancedBonus + editorContribution + composerContribution, 0, 100);
}

/** How well the whole package (script, key talent, budget) suits the chosen genre. */
export function computeGenreFitScore(script: Script, talent: TalentAssignment[], genre: Genre, choices: ProductionChoices): number {
  const profile = GENRE_PROFILES[genre];
  const director = getDirector(talent);
  const leads = getLeadActors(talent);
  const leadFit = average(leads.map((l) => compatibility(l, 'Lead Actor', script))) ?? 50;
  const talentFit = (compatibility(director, 'Director', script) + leadFit) / 2;

  // A low overall spend only suits genres tagged as low-budget-friendly (e.g.
  // Horror); the penalty tapers off linearly and is gone entirely a third of
  // the way up the spend scale. Reads overallSpendT (all four spend dials
  // averaged) rather than contingencyAmount alone - a film can't dodge this
  // by pumping money into VFX while leaving contingency at zero, or vice
  // versa; what matters is how well-resourced the production is overall.
  const CHEAP_PENALTY_CUTOFF_T = 0.35;
  const t = overallSpendT(choices);
  const cheapFit = 30 + profile.lowBudgetFriendly * 60;
  const budgetFit = t >= CHEAP_PENALTY_CUTOFF_T ? 85 : cheapFit + (85 - cheapFit) * (t / CHEAP_PENALTY_CUTOFF_T);

  return deriveGenreFit(script, genre) * 0.4 + talentFit * 0.35 + budgetFit * 0.25;
}

/** How sellable the film looks, independent of how it eventually gets marketed. */
export function computeMarketabilityScore(script: Script, talent: TalentAssignment[], choices: ProductionChoices): number {
  const leads = getLeadActors(talent);
  const supports = getSupportingActors(talent);
  const leadFameAvg = average(leads.map((l) => l.reputation.fame)) ?? 30;
  const supportFameAvg = average(supports.map((s) => s.reputation.fame)) ?? 30;
  const fameAvg = (leadFameAvg + supportFameAvg) / 2;
  const runtimeDelta = runtimeMarketabilityDelta(choices.runtimeIntensity);
  return clamp(deriveCommercialProfile(script).hookStrength * 0.5 + fameAvg * 0.45 + runtimeDelta, 0, 100);
}

export interface QualityBreakdown {
  scriptScore: number;
  directionScore: number;
  actingScore: number;
  productionScore: number;
  postProductionScore: number;
  eventsScore: number;
  qualityScore: number;
}

// Per-link independence floors for the soft-ceiling dependency chain below -
// "effective = raw * (K + (1-K) * upstreamRatio)". K=1 would mean fully
// independent (today's old additive behavior); K=0 would mean a hard
// multiplicative gate. Each link gets its own K rather than one global
// constant, tuned to how forgiving that specific relationship should be:
// a great director can still mostly save an average script (K_SCRIPT_TO_DIRECTION
// is forgiving), but an editor genuinely cannot create footage that was
// never captured (K_FOOTAGE_TO_EDITING is the strictest). None of these are
// hard caps - a downstream department always retains at least K of its own
// raw score, leaving room for future director/crew traits (improvisation,
// script doctoring) to claw back some of what upstream weakness costs.
const K_SCRIPT_TO_DIRECTION = 0.65;
const K_DIRECTION_TO_ACTING = 0.4;
const K_DIRECTION_TO_PRODUCTION = 0.4;
const K_FOOTAGE_TO_EDITING = 0.25;

// How Acting's upstream ceiling blends script (the material) against
// direction (the director's ability to get performances out of it) - director
// weighted higher since "the director's ability to get performances" is the
// more direct lever than the raw material alone.
// Acting's upstream ceiling now leans on the material (script) far more than on
// direction. Direction's effect on the performances is modelled EXPLICITLY and
// per-actor in engine/actingModel.ts (the director unlocks or misfires on each
// actor's headroom), which already folds into the actingScore this chain
// receives - so keeping the old heavy direction weight here would double-count
// direction against acting. A small residual direction term remains (a director
// still sets the broad coverage/context the performances live in).
const ACTING_UPSTREAM_SCRIPT_WEIGHT = 0.8;
const ACTING_UPSTREAM_DIRECTION_WEIGHT = 0.2;

// "Captured footage" - what Post-Production actually has to work with -
// blends direction (coverage/blocking), acting (the performances on camera)
// and production (sets/effects visibly in-frame), tilted toward direction
// as the primary driver of what gets captured.
const FOOTAGE_DIRECTION_WEIGHT = 0.4;
const FOOTAGE_ACTING_WEIGHT = 0.3;
const FOOTAGE_PRODUCTION_WEIGHT = 0.3;

// The Cinematographer's home. Photography IS the captured image, so the DP scales
// the whole footage the edit inherits: a well-shot film gives Post more to work
// with, a badly-shot one less, on top of the footage the shoot actually produced.
// A multiplicative factor centred at neutral skill 50 (1.0), spanning
// [1-SPAN/2 .. 1+SPAN/2] - so an unstaffed camera department (and every crew-less
// fixture/rival) leaves the footage ratio untouched. Routed here, not into
// computeProductionScore, because Production is not a top-level Quality term and
// the footage ceiling on Post is where the DP's grip on the finished film lives
// (docs/DESIGN_REVIEW_crew_role_impact.md, Decision B).
const CINEMATOGRAPHY_FOOTAGE_SPAN = 0.3; // +/-15% on the footage ratio at skill extremes

// The VFX Supervisor's grip on the footage, alongside their effect on Production's
// own effects term (realizedVfxScore). Same footage-capture home as the DP
// (Decision B), but scaled by how much the genre actually leans on VFX
// (GENRE_PROFILES[genre].vfxImportance) - so a strong supervisor visibly lifts an
// Action tentpole's footage and does almost nothing for a chamber drama, the
// genre trade-off Principle 6 asks for. Centred at 1.0 for neutral skill 50.
const VFX_FOOTAGE_SPAN = 0.3;

// How much a skilled Editor can recover from incomplete coverage - lifting the
// edit-coverage ceiling toward 100 without ever exceeding it (you still cannot
// cut footage that was never shot). Only a better-than-neutral editor recovers,
// and only when the shoot came in under-covered; on a fully-covered shoot the
// ceiling is already 100 and this is a no-op. The "editor could not fully repair
// the third act" causal chain from SIMULATION_PHILOSOPHY.md, given its author.
const EDITOR_COVERAGE_RECOVERY = 0.4;

/**
 * Final Quality Score: no longer six independently-weighted departments -
 * Script sets the film's potential, Direction determines how much of it
 * gets captured, Acting and Production happen within what Direction
 * captures, and Post-Production/Editing is bounded by all of that combined
 * ("captured footage") rather than Script directly, since an editor can't
 * create footage that doesn't exist. Every step is a soft ceiling (see the
 * K constants above), not a hard cap - a downstream department never drops
 * to zero just because something upstream did badly.
 *
 * Production and on-set events are deliberately *not* independent top-level
 * terms any more: Production's raw score absorbs events as a direct
 * modifier (nearly every event template - schedule/morale/safety/technical/
 * budget - is fundamentally about how the shoot itself went, see
 * data/productionEvents.ts), then Production's whole (event-adjusted) value
 * only reaches the final score via the dependency chain, the same as every
 * other non-root department - "the dependency chain determines how much
 * those changes reach the final film," not a flat direct add/subtract.
 * scriptScore/directionScore/actingScore/productionScore/postProductionScore/
 * eventsScore are all still returned as raw, pre-ceiling readings - nothing
 * about what's displayed to the player (FilmDetailModal, ReleaseResults,
 * engine/reviews.ts) changes, only how they combine into qualityScore.
 */
export function computeQualityBreakdown(
  script: Script,
  talent: TalentAssignment[],
  genre: Genre,
  productionChoices: ProductionChoices,
  postProductionChoices: PostProductionChoices,
  events: ProductionEvent[],
  shootingRatio: number,
  // A flat bonus added to the post-production sub-score before it propagates
  // into qualityScore - the hook a Creative producer's boost uses
  // (docs/DESIGN_REVIEW_production_office.md). Defaults to 0, so every existing
  // caller (and every rival) is unaffected.
  postProductionScoreBonus = 0,
  // How the shoot actually went (engine/productionExecution.ts) - typed,
  // per-department modifiers derived from the recorded event history. Optional:
  // when omitted it's computed from `events`/`shootingRatio`/talent/plan right
  // here, so every caller gets execution behaviour from the events it already
  // passes. A film with no events resolves to a neutral profile (all
  // multipliers 1), scoring exactly as before - so rivals (no recorded shoot)
  // are unaffected in Phase 1.
  executionProfile?: ExecutionProfile,
): QualityBreakdown {
  const execution = executionProfile ?? computeExecutionProfile({ events, shootingRatio, talent, productionChoices });

  // Craft crew skills (neutral 50 when a seat is empty), read once and threaded
  // into the department node each role belongs to - see
  // docs/DESIGN_REVIEW_crew_role_impact.md.
  const editorSkill = crewSkill(talent, 'Editor');
  const composerSkill = crewSkill(talent, 'Composer');
  const cinematographySkill = crewSkill(talent, 'Cinematographer');
  const vfxSupervisorSkill = crewSkill(talent, 'VFX Supervisor');

  const scriptScore = computeScriptScore(script);
  const directionScore = computeDirectionScore(talent, script);
  const actingScore = computeActingScore(talent, script);
  const productionScore = computeProductionScore(productionChoices, genre, shootingRatio, talent);
  // Footage coverage caps the edit: an under-shot film (below the recommended
  // schedule) can't be cut into a great one no matter how good the Editor is.
  // Coverage is read from execution.coverageRatio, not raw shootingRatio, so
  // scenes/days lost to on-set events (coverage-impact) tighten the ceiling on
  // top of a short schedule (engine/productionExecution.ts). The ceiling only
  // binds below ratio 1, so a fully-covered shoot is judged on the edit's own
  // merits. A skilled Editor recovers some of what incomplete coverage would
  // otherwise cost (lifting the ceiling toward, never past, 100). Post-production
  // interventions (the bonus, e.g. reshoots/re-edits) are added after the cap -
  // extra work that can lift a thin shoot back up.
  const coverageCeiling = editCoverageCeiling(execution.coverageRatio);
  const editorRecovery = clamp((editorSkill - 50) / 50, 0, 1) * EDITOR_COVERAGE_RECOVERY;
  const effectiveCeiling = coverageCeiling + (100 - coverageCeiling) * editorRecovery;
  const cappedEdit = Math.min(computePostProductionScore(postProductionChoices, editorSkill, composerSkill), effectiveCeiling);
  const postProductionScore = clamp(cappedEdit + postProductionScoreBonus, 0, 100);
  const eventsScore = computeEventsScore(events);

  // Execution modifiers describe how well each department actually came out on
  // set - the performances captured, the footage cut together, the material as
  // rewritten. They scale the department's own OUTPUT at the root of the
  // dependency chain (not the post-chain effective value), so the effect
  // propagates the same way a genuinely better/worse department would: a
  // gutted performance drags down everything downstream that leans on it. Each
  // multiplier is an orthogonal "how it came out" reading, NOT a re-use of a
  // department's raw score, so nothing is double-counted against
  // Direction/Acting/Script/Post-Production (docs/DESIGN_REVIEW_production_execution.md).
  // Direction is left unmodified: it's the upstream driver execution flows from.
  const executedScript = clamp(scriptScore * execution.scriptExecution, 0, 100);
  const executedActing = clamp(actingScore * execution.performanceCapture, 0, 100);
  const executedPostProduction = clamp(postProductionScore * execution.postExecution, 0, 100);

  const scriptRatio = executedScript / 100;
  const directionRatio = (directionScore / 100) * (K_SCRIPT_TO_DIRECTION + (1 - K_SCRIPT_TO_DIRECTION) * scriptRatio);

  const actingUpstream = ACTING_UPSTREAM_SCRIPT_WEIGHT * scriptRatio + ACTING_UPSTREAM_DIRECTION_WEIGHT * directionRatio;
  const actingRatio = (executedActing / 100) * (K_DIRECTION_TO_ACTING + (1 - K_DIRECTION_TO_ACTING) * actingUpstream);

  // Production enters via the footage chain on its own dials-driven score.
  // Events no longer fold in here as one flat, near-cosmetic number (that was
  // the leverage bug - docs/DESIGN_REVIEW_production_execution.md); a shoot's
  // incidents now reach the film through the typed execution modifiers above.
  const productionRatio =
    (productionScore / 100) * (K_DIRECTION_TO_PRODUCTION + (1 - K_DIRECTION_TO_PRODUCTION) * directionRatio);

  // The camera & VFX departments scale the captured footage the edit inherits
  // (Decision B): a well-shot, well-supervised film hands Post more to work with.
  // Both centred at 1.0 for neutral skill; VFX's grip is further scaled by how
  // much the genre leans on it, so it barely registers outside VFX-driven genres.
  const cinematographyFactor = 1 + ((cinematographySkill - 50) / 100) * CINEMATOGRAPHY_FOOTAGE_SPAN;
  const vfxFactor = 1 + ((vfxSupervisorSkill - 50) / 100) * VFX_FOOTAGE_SPAN * GENRE_PROFILES[genre].vfxImportance;
  const footageRatio =
    (FOOTAGE_DIRECTION_WEIGHT * directionRatio + FOOTAGE_ACTING_WEIGHT * actingRatio + FOOTAGE_PRODUCTION_WEIGHT * productionRatio) *
    cinematographyFactor *
    vfxFactor;
  const postProductionRatio =
    (executedPostProduction / 100) * (K_FOOTAGE_TO_EDITING + (1 - K_FOOTAGE_TO_EDITING) * footageRatio);

  const effDirection = 100 * directionRatio;
  const effActing = 100 * actingRatio;
  const effPostProduction = 100 * postProductionRatio;

  const weights = computeQualityWeights(genre);
  const qualityScore = clamp(
    executedScript * weights.script +
      effDirection * weights.direction +
      effActing * weights.acting +
      effPostProduction * weights.postProduction,
    0,
    100,
  );

  return { scriptScore, directionScore, actingScore, productionScore, postProductionScore, eventsScore, qualityScore };
}

/** Critic Score: craft-driven - quality, originality, direction, edit style. */
export function computeCriticScore(
  quality: QualityBreakdown,
  script: Script,
  postProductionChoices: PostProductionChoices,
): number {
  const criticalEditScore = clamp(
    50 + EDIT_STYLE_PROFILES[postProductionChoices.editStyle].criticDelta * 5,
    0,
    100,
  );

  const score =
    quality.qualityScore * 0.78 +
    script.originality * 0.14 +
    criticalEditScore * 0.08;

  return clamp(score, 0, 100);
}

/**
 * Audience Score: entertainment-driven - genre fit, star power, pacing.
 * Deliberately has no marketing term - marketing builds awareness, not
 * affection; whether the people who actually saw the film enjoyed it isn't
 * something a bigger ad spend can buy (see computeBuzzScore for where
 * marketing actually belongs).
 */
export function computeAudienceScore(
  quality: QualityBreakdown,
  script: Script,
  talent: TalentAssignment[],
  genre: Genre,
  productionChoices: ProductionChoices,
  postProductionChoices: PostProductionChoices,
): number {
  const genreFulfilment = computeGenreFitScore(
    script,
    talent,
    genre,
    productionChoices,
  );

  const audienceEditingScore = clamp(
    50 +
      EDIT_STYLE_PROFILES[postProductionChoices.editStyle].audienceDelta * 5 +
      FINAL_CUT_FOCUS_PROFILES[
        postProductionChoices.finalCutFocus
      ].audienceDelta * 5,
    0,
    100,
  );

  const score =
    quality.qualityScore * 0.50 +
    genreFulfilment * 0.25 +
    audienceEditingScore * 0.15 +
    quality.productionScore * 0.10;

  return clamp(score, 0, 100);
}

/**
 * Buzz Score: pre-release hype, not reception - this is what drives Opening
 * Weekend (engine/boxOffice.ts), separately from whether the film is
 * actually any good. Dominated by three things a studio can genuinely
 * build: how famous the director/leads are, how commercially recognised
 * the studio itself is (Brand Recognition - engine/reputation.ts), and how
 * much is spent getting the word out. Money alone (marketing) caps out
 * well short of 100 - fame and Brand aren't for sale, they're earned by
 * who you cast and how your past films performed commercially - so a
 * wealthy but unknown studio with no-name talent still can't buy its way
 * to a phenomenon. Deliberately reads Brand, never Prestige - pre-release
 * hype is a commercial-recognition question ("have people heard of this
 * studio"), not a critical-esteem one. Events/music/final-cut/script-
 * marketability stay as smaller flavor modifiers on top, same as before.
 */
export function computeBuzzScore(
  script: Script,
  talent: TalentAssignment[],
  events: ProductionEvent[],
  postProductionChoices: PostProductionChoices,
  // The audience-weighted effective marketing reach (engine/marketing.ts), or a
  // flat marketingSpend fallback - a £-equivalent number either way. The caller
  // (engine/releaseFilm.ts) resolves it from the campaign channels.
  marketingReach: number,
  studioBrand: number,
): number {
  const director = getDirector(talent);
  const leads = getLeadActors(talent);
  const buzzworthyFame = [director?.reputation.fame, ...leads.map((l) => l.reputation.fame)].filter((f): f is number => f !== undefined);
  const fameAvg = average(buzzworthyFame) ?? 30;

  const fameBuzz = (fameAvg - 50) * 0.5;
  const brandBuzz = (studioBrand - 50) * 0.4;
  const marketingBuzz = marketingBuzzContribution(marketingReach);

  const eventsBuzz = events.reduce((sum, e) => sum + e.buzzDelta, 0);
  const musicBuzz = MUSIC_FOCUS_PROFILES[postProductionChoices.musicFocus].buzzDelta;
  const finalCutBuzz = FINAL_CUT_FOCUS_PROFILES[postProductionChoices.finalCutFocus].buzzDelta;
  const scriptBuzz = (deriveCommercialProfile(script).hookStrength - 50) * 0.2;

  return clamp(10 + fameBuzz + brandBuzz + marketingBuzz + eventsBuzz + musicBuzz + finalCutBuzz + scriptBuzz, 0, 100);
}
