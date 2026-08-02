import type {
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
import { ageFitMultiplier } from './casting';
import { deriveCommercialProfile } from './commercialProfile';
import { findAssignedPerson, filterAssignedPeople } from '../data/helpers';
import { getActorCareer, getDirectorCareer, getCrewCareer } from './person';
import { computeSetsAmbition, computeSetsFacet, defaultDesignPrepDays, realiseSetsQuality, NO_DESIGNER_SKILL } from './setsFacet';
import { computeVfxFacet, realiseVfxQuality, vfxSupervisorSkill } from './vfxFacet';
import { computePracticalFacet, realisePracticalQuality, NO_STUNT_TEAM_SKILL } from './practicalFacet';
import { computeCinematographyFacet } from './cinematographyFacet';
import { computeScoreFacet } from './scoreFacet';
import { computeEditFacet } from './editFacet';
import { characterForRoleSlot } from './castRequirements';
import {
  shootingBudgetQuality,
  editCoverageCeiling,
  overallSpendT,
  shootingQualityFromRatio,
  runtimeMarketabilityDelta,
  marketingBuzzContribution,
} from './productionDials';
import { briefFromChoices, briefQualityContribution, briefCriticEditScore, briefAudienceEditScore, briefBuzzContribution } from './postProductionBrief';
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
function actorFitScore(
  person: Person,
  role: 'Lead Actor' | 'Supporting Actor',
  character: ScriptCharacter | null,
  script: Script,
  ageAtCasting: number | undefined,
): number {
  const scriptFit = compatibility(person, role, script);
  const actorCareer = getActorCareer(person);
  const base = !character || !actorCareer
    ? scriptFit
    : scriptFit * (1 - CHARACTER_COMPATIBILITY_WEIGHT) + computeCharacterCompatibility(actorCareer.actingStyle, character.traits) * CHARACTER_COMPATIBILITY_WEIGHT;
  // Age is a soft qualifier: casting an actor outside the character's written
  // age band is allowed but costs fit (engine/casting.ts). The multiplier is 1
  // for an in-band actor, absent band, or an actor with no snapshotted age, so
  // this is a no-op everywhere age isn't a factor (rivals, legacy, crew-less).
  return base * ageFitMultiplier(ageAtCasting, character?.castingAgeBand);
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
    const roleFit = actorFitScore(a.person, role, characterForAssignment(a, i, role, script), script, a.ageAtCasting);
    return computeRealizedPerformance(a.person, director, roleFit);
  };

  const leadScoreAvg = average(leads.map((a, i) => performance(a, i, 'Lead Actor')));
  const supportScoreAvg = average(supports.map((a, i) => performance(a, i, 'Supporting Actor')));

  return (leadScoreAvg ?? 30) * 0.7 + (supportScoreAvg ?? 30) * 0.3;
}

/**
 * The Sets/Design contribution to the Production score. The deterministic base
 * is realised from money + prep time + Production Designer skill against the
 * script's design ambition (engine/setsFacet.ts); on top of it, `setsSignal` (the
 * net set/design event points the shoot actually rolled, from the execution
 * profile) drives the facet's execution swing — stretch-scaled and skill-tilted,
 * so an over-reaching build is a boom-or-bust bet (spec §3.3). setsSignal
 * defaults to 0, so a forecast (or a shoot with no set events) is just the base.
 */
export function computeSetsFacetQuality(choices: ProductionChoices, talent: TalentAssignment[], script: Script, setsSignal = 0): number {
  const ambition = computeSetsAmbition(script);
  const designer = findAssignedPerson(talent, 'Production Designer');
  const designerSkill = (designer && getCrewCareer(designer, 'Production Designer')?.skill) ?? NO_DESIGNER_SKILL;
  const prepDays = choices.designPrepDays ?? defaultDesignPrepDays(ambition, designerSkill);
  const facet = computeSetsFacet({ ambition, moneyAmount: choices.setQualityAmount, prepDays, designerSkill });
  return realiseSetsQuality(facet, designerSkill, setsSignal);
}

/**
 * Quality contributed by production choices. VFX/practical-effects weight is
 * scaled per genre - Action/Sci-Fi/Fantasy lean on VFX, Drama/Romance don't.
 * `shootingRatio` is daysElapsed/recommendedDays from the finished shoot
 * (PhotographyState) - shooting quality is read off how photography
 * actually went, not a pre-set pace dial (see
 * productionDials.ts:shootingQualityFromRatio).
 *
 * The Sets/Design, VFX and Practical terms are realised facets (money + time +
 * head skill vs ambition, engine/facetModel.ts) PLUS their execution swings:
 * `execution.facetSignals` (the set/vfx/practical events the shoot rolled) move
 * each delivered facet quality, stretch-scaled and skill-tilted (spec §3.3).
 * Passing no execution profile (a forecast) leaves every facet at its
 * deterministic base. Contingency and style stay as they were.
 */
// --- Coverage-unification cutover: person-driven craft quality ---------------
// Cinematography, Score and Editing now realise quality from WHO you hired
// (cinematographyFacet/scoreFacet/editFacet), fixing the audit's
// quality-from-choices-not-hires defect. Each enters as a DEVIATION from the
// unhired-fallback baseline: the facet quality with the actual head minus the
// same facet at the no-head fallback. So a film with no such head (every rival
// had an identical flat post value before; every current scoring test fixture is
// unstaffed for these roles) scores EXACTLY as before - deviation 0 - and a
// hired head lifts (or a weak one dips) the film. The effect flows only through
// the existing production/post -> quality -> legs channel (never reach/scale), so
// "acclaim doesn't buy mass-market scale" still holds. Weights are modest and
// kept so the rival box-office distribution stays put (box-office diagnostics).
const CINEMATOGRAPHY_PROD_WEIGHT = 0.3;
const SCORE_POST_WEIGHT = 0.25;
const EDIT_POST_WEIGHT = 0.25;

export function computeProductionScore(choices: ProductionChoices, genre: Genre, shootingRatio: number, talent: TalentAssignment[], script: Script, execution?: ExecutionProfile, stuntTeamSkill: number = NO_STUNT_TEAM_SKILL, personDrivenCraft = false): number {
  const profile = GENRE_PROFILES[genre];
  const contingency = shootingBudgetQuality(choices.shootingBudgetAmount);
  const style = shootingQualityFromRatio(shootingRatio);
  // Sets, VFX and Practical Effects are realised facets (money × time × head skill
  // vs ambition, engine/facetModel.ts), each PLUS its endogenous execution swing
  // from the shoot's own events for that facet (execution.facetSignals): a set
  // triumph/collapse, a VFX breakthrough/redo, a stunt landing/reshoot moves that
  // facet, stretch-scaled and skill-tilted. A forecast (no execution) is the base.
  const sets = computeSetsFacetQuality(choices, talent, script, execution?.facetSignals.sets ?? 0);
  const vfxSkill = vfxSupervisorSkill(talent);
  const vfx = realiseVfxQuality(computeVfxFacet(choices.vfxAmount, talent, genre, script), vfxSkill, execution?.facetSignals.vfx ?? 0);
  const practicalFacet = computePracticalFacet(choices.practicalEffectsAmount, genre, script, shootingRatio, stuntTeamSkill);
  const practical = realisePracticalQuality(practicalFacet, stuntTeamSkill, execution?.facetSignals.practical ?? 0);

  const effectsWeightTotal = profile.vfxImportance + profile.practicalEffectsImportance;
  const effectsScore =
    effectsWeightTotal > 0
      ? (vfx * profile.vfxImportance + practical * profile.practicalEffectsImportance) / effectsWeightTotal
      : (vfx + practical) / 2;

  // Cinematography: the DP's realised image, a person-driven deviation from an
  // unled camera department. Uses the facet's deterministic base (no camera event
  // channel yet). Player films only (personDrivenCraft) - rivals keep the flat
  // model until the funnel/scale recalibration that owns the box-office
  // distribution gate. Zero when no Cinematographer is attached, so even a player
  // film with no DP is byte-identical to before this term existed.
  let cinematography = 0;
  if (personDrivenCraft) {
    const cine = computeCinematographyFacet(talent, genre, script, shootingRatio).quality;
    const cineBaseline = computeCinematographyFacet([], genre, script, shootingRatio).quality;
    cinematography = CINEMATOGRAPHY_PROD_WEIGHT * (cine - cineBaseline);
  }

  return clamp(contingency * 0.35 + style * 0.25 + sets * 0.2 + effectsScore * 0.2 + cinematography, 0, 100);
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
export function computePostProductionScore(choices: PostProductionChoices): number {
  const base = 55;
  // The brief's current DIRECT quality contribution (engine/postProductionBrief.ts).
  // At the coverage-unification cutover this becomes the Composer's/Editor's
  // realisation of the score/edit brief rather than a flat menu delta.
  return clamp(base + briefQualityContribution(briefFromChoices(choices)), 0, 100);
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
  // The Production Design (sets) facet quality on its own, pulled out of the
  // blended productionScore so the Best Production Design award can read the
  // Production Designer's craft directly. It is a component OF productionScore
  // (contributes the sets term at line ~229), not an extra scoring channel -
  // exposing it here changes no box-office maths.
  productionDesignScore: number;
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
  // The attached Stunt Team's effective skill (engine/stuntTeams.ts) - the
  // Practical Effects facet's skill axis + swing tilt. Optional: absent (no team,
  // rivals, older callers) falls back to NO_STUNT_TEAM_SKILL inside
  // computeProductionScore, scoring exactly as before.
  stuntTeamSkill: number = NO_STUNT_TEAM_SKILL,
  // Coverage-unification cutover: when true (the player's films) Cinematography,
  // Score and Editing realise quality from the hired heads; when false (rivals,
  // the base model, and every calibration diagnostic) those three keep the flat
  // brief/fallback value, so the rival-driven box-office distribution & variance
  // gates stay byte-identical. Rivals adopt person-driven craft in the separate
  // funnel/scale recalibration. Sets/VFX/Practical are person-driven for everyone
  // regardless (unchanged by this flag).
  personDrivenCraft = false,
): QualityBreakdown {
  const execution = executionProfile ?? computeExecutionProfile({ events, shootingRatio, talent, productionChoices });

  const scriptScore = computeScriptScore(script);
  const directionScore = computeDirectionScore(talent, script);
  const actingScore = computeActingScore(talent, script);
  const productionScore = computeProductionScore(productionChoices, genre, shootingRatio, talent, script, execution, stuntTeamSkill, personDrivenCraft);
  // The sets facet quality on its own - the same value computeProductionScore
  // blends into its `sets` term (identical pure inputs), read out here so the
  // Production Design department has a craft score the award can judge. This is
  // a decomposition of productionScore, not a new term feeding qualityScore.
  const productionDesignScore = computeSetsFacetQuality(productionChoices, talent, script, execution.facetSignals.sets ?? 0);
  // Footage coverage caps the edit: an under-shot film (below the recommended
  // schedule) can't be cut into a great one no matter how good the Editor is.
  // Coverage is read from execution.coverageRatio, not raw shootingRatio, so
  // scenes/days lost to on-set events (coverage-impact) tighten the ceiling on
  // top of a short schedule (engine/productionExecution.ts). The ceiling only
  // binds below ratio 1, so a fully-covered shoot is judged on the edit's own
  // merits. Post-production interventions (the bonus, e.g. reshoots/re-edits)
  // are added after the cap - extra work that can lift a thin shoot back up.
  // Score & Edit (coverage unification): post-production quality is now
  // person-driven for player films - the Composer's and Editor's realisation of
  // the brief, each a deviation from an unmanaged post (their no-head fallback).
  // Zero when neither is attached (or for rivals/base model, personDrivenCraft
  // false), so those films keep the old brief-only value. The whole cut (brief
  // baseline + craft deviation) is still bounded by footage coverage: an
  // under-shot film caps even a great editor.
  let postCraftDeviation = 0;
  if (personDrivenCraft) {
    const scoreCraft = computeScoreFacet(talent, genre, script).quality;
    const scoreBaseline = computeScoreFacet([], genre, script).quality;
    const editCraft = computeEditFacet(talent, genre, script).quality;
    const editBaseline = computeEditFacet([], genre, script).quality;
    postCraftDeviation = SCORE_POST_WEIGHT * (scoreCraft - scoreBaseline) + EDIT_POST_WEIGHT * (editCraft - editBaseline);
  }
  const cappedEdit = Math.min(computePostProductionScore(postProductionChoices) + postCraftDeviation, editCoverageCeiling(execution.coverageRatio));
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

  const footageRatio =
    FOOTAGE_DIRECTION_WEIGHT * directionRatio + FOOTAGE_ACTING_WEIGHT * actingRatio + FOOTAGE_PRODUCTION_WEIGHT * productionRatio;
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

  return { scriptScore, directionScore, actingScore, productionScore, productionDesignScore, postProductionScore, eventsScore, qualityScore };
}

/** Critic Score: craft-driven - quality, originality, direction, edit style. */
export function computeCriticScore(
  quality: QualityBreakdown,
  script: Script,
  postProductionChoices: PostProductionChoices,
): number {
  const criticalEditScore = briefCriticEditScore(briefFromChoices(postProductionChoices));

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

  const audienceEditingScore = briefAudienceEditScore(briefFromChoices(postProductionChoices));

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
// Buzz non-purchasability (docs/DESIGN_box_office_calibration_targets.md §6).
// Money buys awareness and contributes to buzz, but phenomenon-level
// anticipation (the 75-100 bands) has to be *earned* - franchise, stars, an
// established studio - not bought. So marketing no longer adds to buzz on its
// own flat channel; it AMPLIFIES an anticipation core, gated by how much star/
// brand power there is to amplify. A studio with no-name talent and no
// recognition has little for its marketing pound to work on, so it cannot buy
// its way past the mid bands however much it spends (buzzCalibration.diagnostic
// .test.ts's non-purchasability probes).
// Baseline anticipation every release starts with, before latent-demand terms and
// gated signals. Nudged 10->11 when the finished-cut buzz (briefBuzz) moved from an
// ungated flat contributor into the gated production/post-signal term below: a
// normal cut used to add its buzz to every film ungated, so a small baseline lift
// keeps an ordinary release in its ratified §6 band once that finishing buzz is
// gated (with the gentler BRIEF_GATE_FLOOR), while unknown packages stay far below
// the top bands. Re-check the buzz-calibration diagnostic if you retune it.
const BUZZ_BASE = 11;
const FAME_BUZZ_WEIGHT = 0.5;
const BRAND_BUZZ_WEIGHT = 0.55;
const SCRIPT_BUZZ_WEIGHT = 0.15;
// Marketing's amplification of the anticipation core, and how hard it's gated by
// star/brand power. GATE_FLOOR is the fraction of marketing's effect an
// utterly-unknown package still gets (some awareness is buyable); the rest is
// unlocked by fame + brand.
const MARKETING_BUZZ_WEIGHT = 0.68;
const MARKETING_GATE_FLOOR = 0.3;
// Finishing-buzz (briefBuzz) gate floor. Higher than marketing's/on-set's 0.3: a
// genuinely bold, memorable cut or score has more ORGANIC breakout reach than a
// paid ad buy or a random on-set moment - a great trailer travels somewhat on its
// own even for a smaller package (the sleeper-hit path). So finishing buzz is
// gated by latent audience too, but retains more of itself for an unknown film -
// enough that it can't be zeroed, not enough to manufacture top-band anticipation
// (a Mystery+Heavy cut on total unknowns lands mid-band, not blockbuster). Chosen
// with BUZZ_BASE so the change is ~buzz-neutral in aggregate (buzz is a sensitive
// pacing lever near this operating point) and both the buzz §6 and box-office
// distribution diagnostics stay green.
const BRIEF_GATE_FLOOR = 0.65;
// Soft ceiling: the raw score approaches 100 asymptotically above the knee
// rather than hard-clamping, so the top three bands (blockbuster / cultural
// event / phenomenon) stay distinguishable instead of all pinning to 100.
const BUZZ_SOFT_KNEE = 85;
const BUZZ_SOFT_SCALE = 15;

function softCeilBuzz(raw: number): number {
  if (raw <= BUZZ_SOFT_KNEE) return clamp(raw, 0, 100);
  return BUZZ_SOFT_KNEE + (100 - BUZZ_SOFT_KNEE) * (1 - Math.exp(-(raw - BUZZ_SOFT_KNEE) / BUZZ_SOFT_SCALE));
}

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

  const eventsBuzz = events.reduce((sum, e) => sum + e.buzzDelta, 0);
  // The brief's current DIRECT buzz contribution (score + final-cut deltas); at
  // the cutover it becomes how buzz-worthy the realised score/cut actually is.
  const briefBuzz = briefBuzzContribution(briefFromChoices(postProductionChoices));
  const scriptBuzz = (deriveCommercialProfile(script).hookStrength - 50) * SCRIPT_BUZZ_WEIGHT;

  // Non-purchasable anticipation core: intrinsic latent demand - who's involved,
  // how established the studio is, and the concept's own hook. What audiences would
  // already want, before any public signal has to travel to reach them.
  const anticipation =
    BUZZ_BASE + (fameAvg - 50) * FAME_BUZZ_WEIGHT + (studioBrand - 50) * BRAND_BUZZ_WEIGHT + scriptBuzz;

  // Amplification gate: how much latent audience there is for a public signal to
  // reach. An unknown package (no stars, no brand) gives a signal little to carry;
  // an established one amplifies it. Floored so some organic reach always exists.
  const starPower = clamp((fameAvg + studioBrand) / 200, 0, 1);
  const amplificationGate = MARKETING_GATE_FLOOR + (1 - MARKETING_GATE_FLOOR) * starPower;
  // Finishing buzz rides a gentler floor - a great cut/trailer breaks out more on
  // its own than a raw ad buy or an on-set moment (see BRIEF_GATE_FLOOR).
  const briefGate = BRIEF_GATE_FLOOR + (1 - BRIEF_GATE_FLOOR) * starPower;

  // Marketing spend amplifies the core, gated - so spend alone can't reach the top
  // bands.
  const marketingBuzz = marketingBuzzContribution(marketingReach) * MARKETING_BUZZ_WEIGHT * amplificationGate;

  // Production & post signals are public signals whose reach scales with the latent
  // audience, rather than raw additions to the core - so neither on-set luck nor a
  // finishing choice can bypass non-purchasability and manufacture top-band
  // anticipation for a no-name film. On-set moments (a trailer-defining stunt, a
  // leak, a scandal) ride the same low-floored gate as marketing - a tentpole's
  // every beat is amplified, an unknown's lucky (or unlucky) day barely travels.
  // Finishing buzz (a marketing-oriented cut, a bold talked-about score) rides the
  // gentler briefGate. Sign is preserved on both (either can be net negative), so a
  // scandal - or a buzz-killing Minimal score - on a famous package still bites hardest.
  const productionSignalBuzz = eventsBuzz * amplificationGate + briefBuzz * briefGate;

  return softCeilBuzz(anticipation + marketingBuzz + productionSignalBuzz);
}
