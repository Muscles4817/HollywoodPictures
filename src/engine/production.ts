import type {
  ChemistryDimension,
  EventChoiceTemplate,
  EventSeverity,
  Genre,
  PendingEventChoice,
  Person,
  PersonTrait,
  PreProductionState,
  ProductionChoices,
  ProductionEvent,
  ProductionRole,
  Script,
  StaticProductionRisk,
  TalentAssignment,
  TalentPairing,
  TalentProfession,
} from '../types';
import {
  POSITIVE_EVENT_TEMPLATES,
  NEGATIVE_EVENT_TEMPLATES,
  GENRE_EVENT_TEMPLATES,
  RISK_DIMENSION_EVENT_TEMPLATES,
  TRAIT_EVENT_TEMPLATES,
  PRE_PRODUCTION_EVENT_TEMPLATES,
  type ProductionEventTemplate,
} from '../data/productionEvents';
import { deriveTraits } from './personTraits';
import { GENRE_PROFILES } from '../data/genres';
import { SETTING_ARCHETYPE_PROFILES } from '../data/settings';
import { contingencyReserveT, practicalEffectsT, vfxT, overallSpendT, FOOTAGE_LOWER_RATIO, FOOTAGE_UPPER_RATIO } from './productionDials';
import { computeCreativeTension } from './creativeTension';
import { computeEffectivePairChemistry } from './pairHistory';
import { computeTalentCompatibility } from './compatibility';
import { findCandidatesNearPrice } from './talentFilter';
import { professionForProductionRole, filterAssignedPeople, findAssignedPerson } from '../data/helpers';
import { getCareerForRole, getCrewCareer, getTypicalSalaryForRole } from './person';
import { classifyEventImpact } from './productionExecution';
import { clamp, pick, pickMany, randFloat, randInt, weightedPick, type RandomFn } from './random';

// --- Stage durations (Timeline Recalibration) ---------------------------
// Every stage below is built to reflect the *particulars of that specific
// film* - its filming complexity, cast size, planned runtime, effects
// ambition, scale and setting - so a contained two-hander and an
// effects-led epic land at genuinely different points on the calendar
// instead of clustering in the same narrow band. The constants are sized so
// a small, simple film finishes in a few in-game months while a large,
// effects-heavy tentpole runs well over a year start to finish (with post
// carrying most of that, mirroring where real VFX schedules actually go).
// See docs/DESIGN_production_timeline_audit.md for the audit these numbers
// came out of and the target timelines they encode. First-draft, tunable
// constants like every other number in this simulation.
const BASE_SHOOT_DAYS = 20;
const MAX_COMPLEXITY_DAYS = 34; // filming complexity is the single biggest shoot-length driver
const MAX_CAST_SIZE_DAYS = 18; // a large ensemble is far slower to schedule and shoot than a two-hander
const MAX_RUNTIME_DAYS = 22; // a three-hour epic photographs far more material than a lean 90-minute film
const MAX_EFFECTS_DAYS = 22; // practical rigs, stunts and effects units slow the shoot down on the day
const MAX_SETTING_DAYS = 16; // a travel-heavy, many-location shoot loses days moving; a single interior loses none
const CAST_SIZE_BASELINE = 6; // roughly the mandatory-roles floor before any multi-hire roles kick in
const SHOOT_CAST_DAYS_PER_MEMBER = 2; // extra shoot days each cast member beyond the baseline adds, before the cap

/**
 * How many days of principal photography this film calls for - shown to
 * the player before they start shooting, and the number their actual
 * shoot length (PhotographyState.daysElapsed) is judged against once
 * they're done. Driven by the same inputs already behind the risk
 * dimensions below: a complex, ensemble, effects-heavy film needs more
 * time than a small, simple one, independent of how many days the player
 * actually gives it. `settingDays` (Character and Setting Foundations
 * milestone) adds real schedule pressure for a travel-heavy or logistically
 * complex Setting Archetype (Global Multi-Location, Underwater) beyond what
 * complexity/cast/effects already capture - a Single Interior Location sits
 * near zero here, a Global Multi-Location shoot adds real time.
 */
export function computeRecommendedShootDays(talent: TalentAssignment[], script: Script, choices: ProductionChoices): number {
  const complexityDays = (script.complexity / 100) * MAX_COMPLEXITY_DAYS;
  const castDays = clamp((talent.length - CAST_SIZE_BASELINE) * SHOOT_CAST_DAYS_PER_MEMBER, 0, MAX_CAST_SIZE_DAYS);
  const runtimeDays = choices.runtimeIntensity * MAX_RUNTIME_DAYS;
  const effectsDays = (practicalEffectsT(choices.practicalEffectsAmount) + vfxT(choices.vfxAmount)) * (MAX_EFFECTS_DAYS / 2);
  const settingProfile = SETTING_ARCHETYPE_PROFILES[script.primarySetting];
  const settingDays = (settingProfile.travelDemand * 0.6 + settingProfile.locationComplexity * 0.4) * MAX_SETTING_DAYS;
  return Math.round(BASE_SHOOT_DAYS + complexityDays + castDays + runtimeDays + effectsDays + settingDays);
}

/**
 * The fewest shoot days that produce a functional film - below this there
 * isn't enough footage for a usable cut, so the shoot can't be wrapped
 * (state/studioReducer.ts:FINISH_PHOTOGRAPHY blocks it, and the ProductionRun
 * screen disables the wrap button to match). A fraction of recommendedDays.
 */
export function footageLowerBound(recommendedDays: number): number {
  return Math.round(recommendedDays * FOOTAGE_LOWER_RATIO);
}

/**
 * The most shoot days worth filming - past this the footage covers every
 * usable angle and there's nothing left to gain, so the shoot wraps itself
 * automatically (state/studioReducer.ts:ADVANCE_SHOOTING_DAY). A multiple of
 * recommendedDays, chosen to coincide with where the shoot-quality curve
 * flatlines (engine/productionDials.ts:shootingQualityFromRatio).
 */
export function footageUpperBound(recommendedDays: number): number {
  return Math.round(recommendedDays * FOOTAGE_UPPER_RATIO);
}

const BASE_PREPRODUCTION_DAYS = 21;
const MAX_SCALE_PREPRODUCTION_DAYS = 32;
const MAX_CAST_SIZE_PREPRODUCTION_DAYS = 16;
const MAX_AMBITION_PREPRODUCTION_DAYS = 28;
const MAX_SETTING_PREPRODUCTION_DAYS = 18; // scouting locations and building sets before a frame is shot
const PERIOD_SETTING_PREPRODUCTION_DAYS = 10; // recreating a real historical era adds research, costume and design lead time
const PREPRODUCTION_CAST_DAYS_PER_MEMBER = 2.5; // extra prep days each cast member beyond the baseline adds, before the cap
const SCALE_PREPRODUCTION_FRACTION: Record<Script['scale'], number> = { Intimate: 0, Medium: 0.5, Epic: 1 };

/**
 * How many days of pre-production this film calls for - locking cast/crew
 * deals, scouting/building sets, previs for anything effects-heavy, before
 * a single day of Principal Photography. This is the *length* of the
 * pre-production phase, which the reducer then burns down day-by-day
 * (state/studioReducer.ts:ADVANCE_PREPRODUCTION_DAY, off the recommendedDays
 * this returns) - it is NOT a lump sum charged at Greenlight; Greenlight
 * only books talent and cash, and the phase's real prep window can be
 * stretched further still by a Production Designer's granted prep time
 * (studioReducer.ts:GREENLIGHT_PROJECT takes max(this, designPrepDays)).
 *
 * Driven by the particulars of this specific film: bigger scale, bigger
 * cast and heavier effects ambition all mean more to lock down, and - added
 * in the Timeline Recalibration - a build-heavy or hard-to-scout setting,
 * plus a period piece's extra research/costume lead time, push prep out
 * further still. Ranges from ~3 weeks for a small contained film to roughly
 * four months for a large, effects-heavy, period tentpole - first-draft,
 * tunable constants like every other numeric constant in this simulation.
 */
export function computeRecommendedPreProductionDays(talent: TalentAssignment[], script: Script, choices: ProductionChoices): number {
  const scaleDays = SCALE_PREPRODUCTION_FRACTION[script.scale] * MAX_SCALE_PREPRODUCTION_DAYS;
  const castDays = clamp((talent.length - CAST_SIZE_BASELINE) * PREPRODUCTION_CAST_DAYS_PER_MEMBER, 0, MAX_CAST_SIZE_PREPRODUCTION_DAYS);
  const ambitionDays = ((practicalEffectsT(choices.practicalEffectsAmount) + vfxT(choices.vfxAmount)) / 2) * MAX_AMBITION_PREPRODUCTION_DAYS;
  // Building the world before the shoot: heavy set construction and hard-to-scout
  // locations both stretch prep, and a period piece adds its own research/costume
  // lead time on top. A Single Interior Location sits near zero here; a
  // Medieval Kingdom or Global Multi-Location shoot adds real weeks.
  const settingProfile = SETTING_ARCHETYPE_PROFILES[script.primarySetting];
  const settingDays =
    (settingProfile.setConstructionDemand * 0.6 + settingProfile.locationComplexity * 0.4) * MAX_SETTING_PREPRODUCTION_DAYS;
  const periodDays = settingProfile.periodSetting ? PERIOD_SETTING_PREPRODUCTION_DAYS : 0;
  return Math.round(BASE_PREPRODUCTION_DAYS + scaleDays + castDays + ambitionDays + settingDays + periodDays);
}

// Post-Production Redesign, Phase A (docs/DESIGN_REVIEW_post_production_redesign.md
// section 1) - editorial and VFX are two independent components, not
// blended into one pool, so a great Editor speeds up the edit specifically
// without also (nonsensically) speeding up VFX rendering nobody skilled is
// touching, and vice versa. Editorial reads runtime, script complexity and
// Editor skill (a denser or longer film is genuinely slower to cut, score
// and mix); VFX reads VFX ambition and VFX Supervisor skill. Cast size and
// setting stay out of post deliberately - those are shoot/prep pressures
// that runtime intensity and VFX ambition already stand in for here.
const BASE_EDITORIAL_DAYS = 30; // baseline edit/sound/color pass every film needs, even a short, effects-free one
const MAX_RUNTIME_EDITORIAL_DAYS = 45; // a Long-intensity film has far more footage to assemble, score and mix than a Short one
const MAX_COMPLEXITY_EDITORIAL_DAYS = 22; // a denser, more intricate film takes longer to cut, sound-design and finish
// VFX post scales SUPER-linearly with ambition (exponent above 1): a
// near-zero-VFX drama is barely touched, while an effects-led tentpole's
// post balloons - which is exactly what makes such a film take a year-plus
// start to finish, and what separates a Sci-Fi/Fantasy epic's timeline from
// a contained drama's more than any other single term in the model.
const VFX_POST_EXPONENT = 2;
const MAX_VFX_DAYS = 340; // a fully effects-driven film's post is dominated by compositing/rendering - by far the largest individual term here

// Skill compresses or stretches its own department's days by up to 30%
// either way (skill 100 -> 0.7x, skill 0 -> 1.3x, skill 50 -> neutral
// 1.0x) - meaningful, never extreme: even a legendary Editor can't cut a
// three-hour epic in a week, and a poor one doesn't triple the schedule
// either. Shared by both departments below, applied to each independently.
const SKILL_MULTIPLIER_FLOOR = 0.7;
const SKILL_MULTIPLIER_CEILING = 1.3;
const SKILL_MULTIPLIER_NEUTRAL = 1.0;
const SKILL_MULTIPLIER_SWING = 0.3;

function postProductionSkillMultiplier(skill: number): number {
  return clamp(
    SKILL_MULTIPLIER_NEUTRAL - ((skill - 50) / 50) * SKILL_MULTIPLIER_SWING,
    SKILL_MULTIPLIER_FLOOR,
    SKILL_MULTIPLIER_CEILING,
  );
}

// No VFX Supervisor hired (optional role, same "doesn't block Greenlight,
// materially improves an existing mechanic when present" shape as Casting
// Director - see data/talentGeneration.ts:OPTIONAL_TALENT_ROLES) - VFX work
// still happens (outside vendors, the Director filling the gap), just
// without anyone dedicated to running that pipeline efficiently. Worse than
// a neutral (skill-50) supervisor's 1.0x, better than the worst-case hired
// one's 1.3x (skill 0) - "unmanaged," not "incompetently managed."
const NO_VFX_SUPERVISOR_MULTIPLIER = 1.15;

/**
 * How many days of post-production this film calls for - computed once, at
 * FINISH_PHOTOGRAPHY, and stored as FilmDraft.postProductionEstimatedCompletionDay
 * (state/studioReducer.ts). Same "one number, computed once" shape
 * computeRecommendedShootDays/computeRecommendedPreProductionDays above
 * already use - no new day-by-day state, no second live process (Round 1 of
 * the design review's own explicit pushback against that).
 *
 * Editorial and VFX are summed as two independent components. Editorial
 * (baseline + runtime + complexity) is always present and always scaled by
 * the Editor's own skill - Editor is a mandatory role
 * (data/talentGeneration.ts:MANDATORY_TALENT_ROLES), guaranteed hired by the
 * time a film reaches FINISH_PHOTOGRAPHY, so this never needs an "unhired"
 * fallback the way VFX does; a defensive `?? 50` default is kept anyway,
 * matching how every other career-stat lookup in this codebase (e.g.
 * computeDirectionScore) stays honest under an impossible-in-practice
 * missing-hire case. VFX scales SUPER-linearly with vfxT(choices.vfxAmount)
 * (raised to VFX_POST_EXPONENT) - so a Drama with near-zero VFX spend is
 * barely touched (vfxDays is close to zero regardless of the multiplier),
 * while an effects-led tentpole's post dominates its whole schedule.
 *
 * Documented bounds: editorial alone ranges
 * [BASE_EDITORIAL_DAYS * 0.7, (BASE_EDITORIAL_DAYS + MAX_RUNTIME_EDITORIAL_DAYS + MAX_COMPLEXITY_EDITORIAL_DAYS) * 1.3]
 * = [21, ~126]; VFX alone ranges [0, MAX_VFX_DAYS * 1.3] = [0, 442] (0
 * whenever vfxAmount sits at VFX_RANGE's own minimum, and - because of the
 * exponent - still small for anything short of a genuinely effects-led
 * film). Combined, the realistic total spans roughly 25 days (a short,
 * simple, VFX-free film with a strong Editor) to well over a year for a
 * long, complex, fully effects-driven tentpole with a weak Editor and a weak
 * or absent VFX Supervisor. This is deliberately allowed to dwarf the shoot
 * for effects tentpoles - that is where a real VFX film's calendar goes -
 * while staying modest and shoot-comparable for everything else.
 */
export function computeRecommendedPostProductionDays(talent: TalentAssignment[], script: Script, choices: ProductionChoices): number {
  const editor = findAssignedPerson(talent, 'Editor');
  const editorSkill = (editor && getCrewCareer(editor, 'Editor')?.skill) ?? 50;
  const editorialDays =
    (BASE_EDITORIAL_DAYS +
      choices.runtimeIntensity * MAX_RUNTIME_EDITORIAL_DAYS +
      (script.complexity / 100) * MAX_COMPLEXITY_EDITORIAL_DAYS) *
    postProductionSkillMultiplier(editorSkill);

  const vfxSupervisor = findAssignedPerson(talent, 'VFX Supervisor');
  const vfxSupervisorSkill = vfxSupervisor ? getCrewCareer(vfxSupervisor, 'VFX Supervisor')?.skill : undefined;
  const vfxMultiplier =
    vfxSupervisorSkill !== undefined ? postProductionSkillMultiplier(vfxSupervisorSkill) : NO_VFX_SUPERVISOR_MULTIPLIER;
  const vfxDays = Math.pow(vfxT(choices.vfxAmount), VFX_POST_EXPONENT) * MAX_VFX_DAYS * vfxMultiplier;

  return Math.round(editorialDays + vfxDays);
}

// Morale-risk amplifiers, in risk POINTS at the extremes (first-draft, tunable
// like every cutoff here). Both are additive on top of the reliability/ego base
// and both are zero at neutral personalities, so an all-average cast produces
// exactly the pre-existing moraleRisk. VOLATILITY spans +/- its swing (an
// even-keeled cast is calmer than average, a hair-trigger one tenser);
// CREATIVE_TENSION is one-sided (0..swing) because tension is extra friction a
// clash creates, never a bonus a placid pairing earns.
const MORALE_VOLATILITY_SWING = 16;
const MORALE_TENSION_SWING = 24;

/**
 * The four risk dimensions knowable before a single day of filming happens
 * - see types/index.ts:StaticProductionRisk for why Schedule Pressure isn't
 * one of them any more. Three of these four survived a pass checking each
 * had a genuinely distinct input and output from the other four originally
 * proposed (Pressure, Preparedness, Creative Freedom didn't and were folded
 * in or cut) - see docs/DESIGN.md 5.9 for the full reasoning.
 */
export function computeStaticProductionRisk(
  talent: TalentAssignment[],
  script: Script,
  choices: ProductionChoices,
  genre: Genre,
): StaticProductionRisk {
  const avgReliability = talent.length ? talent.reduce((sum, a) => sum + a.person.reputation.reliability, 0) / talent.length : 70;
  const avgEgo = talent.length ? talent.reduce((sum, a) => sum + a.person.personality.ego, 0) / talent.length : 50;
  const avgTemperament = talent.length ? talent.reduce((sum, a) => sum + a.person.personality.temperament, 0) / talent.length : 50;
  const unreliabilityRisk = 100 - avgReliability;

  // Interpersonal friction - unreliable, high-ego casts are more likely to
  // clash or flake, independent of the shoot's physical/technical demands. Two
  // additive amplifiers on top of that base, each zero at neutral personalities
  // (so the baseline is unchanged) and each turning a formerly-cosmetic axis
  // into a real input:
  //   - cast VOLATILITY (low temperament): a hair-trigger cast clashes more.
  //   - CREATIVE TENSION (engine/creativeTension.ts): a specific clashing
  //     director<->lead pairing adds friction the cast-wide averages miss - the
  //     philosophy's "creative disagreement as a risk amplifier".
  // Both raise the odds/severity of morale events (which route through the
  // execution pipeline and can still break either way), never a flat penalty.
  const volatilityRisk = ((50 - avgTemperament) / 50) * MORALE_VOLATILITY_SWING;
  const tensionRisk = (computeCreativeTension(talent) / 100) * MORALE_TENSION_SWING;
  const moraleRisk = clamp(Math.round(unreliabilityRisk * 0.6 + avgEgo * 0.4 + volatilityRisk + tensionRisk), 0, 100);

  const settingProfile = SETTING_ARCHETYPE_PROFILES[script.primarySetting];

  // Physical/stunt danger: how ambitious the practical-effects spend is,
  // plus how logistically demanding the Setting Archetype itself is
  // (Underwater/Rural Wilderness carry real physical risk independent of
  // the effects budget), offset by the Contingency Reserve - the buffer set
  // aside to handle trouble is what buys the safety cover, redundancy and
  // backup plans that make ambitious work safer (docs/DESIGN_REVIEW_production_redesign.md §8).
  const practicalAmbitionT = practicalEffectsT(choices.practicalEffectsAmount);
  const contingencyMitigation = contingencyReserveT(choices.contingencyReserveAmount ?? 0);
  const safetyRisk = clamp(
    Math.round(20 + practicalAmbitionT * 50 + settingProfile.practicalLogisticsDemand * 20 - contingencyMitigation * 35),
    0,
    100,
  );

  // Technical/creative difficulty: VFX ambition and script complexity,
  // offset by the Contingency Reserve (a buffer helps absorb a technical
  // hiccup, just less than it helps with physical safety).
  const vfxAmbitionT = vfxT(choices.vfxAmount);
  const complexityT = script.complexity / 100;
  const technicalComplexity = clamp(
    Math.round(15 + vfxAmbitionT * 45 + complexityT * 30 - contingencyMitigation * 15),
    0,
    100,
  );

  // Is this production resourced for what it's actually trying to do? Not
  // "is the budget low" in isolation but low *relative to* what the
  // genre's VFX/practical importance, the script's own complexity, and the
  // chosen Setting Archetype's own production-pressure profile call for -
  // an Action film and a Drama at the same spend level don't carry the same
  // risk, and neither do a Single Interior Location and a Futuristic City
  // script at the same spend level. This is the "underfunded ambitious
  // setting" signal the milestone's own design calls for (see
  // engine/projectReadiness.ts's setting-underfunded warning) - never a
  // hard block, just a visible risk reading the player can choose to ignore.
  const genreProfile = GENRE_PROFILES[genre];
  const genreAmbition = (genreProfile.vfxImportance + genreProfile.practicalEffectsImportance) / 2;
  const settingAmbition =
    (settingProfile.environmentScale + settingProfile.setConstructionDemand + settingProfile.vfxEnvironmentDemand) / 3;
  const spendT = overallSpendT(choices);
  const budgetRisk = clamp(
    Math.round(20 + (genreAmbition - spendT) * 40 + (settingAmbition - spendT) * 25 + (complexityT - spendT) * 20),
    0,
    100,
  );

  return { moraleRisk, safetyRisk, technicalComplexity, budgetRisk };
}

/**
 * Schedule Pressure can't be known before the player decides how long to
 * shoot for, so unlike the other four dimensions it's computed live, from
 * how photography is actually going (daysElapsed / recommendedDays) -
 * falling short is steep, meeting or exceeding it is calm with a floor
 * (there's always *some* pressure). Same shape of curve as
 * shootingQualityFromRatio (productionDials.ts) since they're two readings
 * of the same underlying signal, just as risk instead of quality.
 */
export function computeSchedulePressure(daysElapsed: number, recommendedDays: number): number {
  const ratio = recommendedDays > 0 ? daysElapsed / recommendedDays : 1;
  if (ratio >= 1) return clamp(Math.round(30 - (ratio - 1) * 20), 5, 30);
  return clamp(Math.round(30 + (1 - ratio) * 90), 0, 100);
}

// The most escalation the shoot's history can add to daily risk - a bad shoot
// gets meaningfully worse, but the chain is bounded (no uncontrollable spiral).
const MAX_ESCALATION_RISK = 22;
// How much reliability + contingency contain a chain, and how sharply each
// point of accumulated `escalates` raises risk.
const ESCALATION_RESILIENCE_DAMPEN = 0.6;
const ESCALATION_RISK_PER_POINT = 10;

/**
 * Bounded failure chains: a shoot that has already suffered major setbacks is
 * more likely to suffer more. Sums the `escalates` seeds of the negative events
 * so far, dampened by the production's resilience (reliable, well-resourced
 * productions contain trouble), and returns extra daily risk to feed
 * rollDayEvent - capped at MAX_ESCALATION_RISK so a single mishap can never
 * doom a film on its own. Pure: escalation is a deterministic read of the
 * recorded event history, never a new roll.
 */
export function computeShootEscalation(events: ProductionEvent[], resilience: number): number {
  let seeds = 0;
  for (const e of events) {
    if (e.qualityDelta >= 0) continue;
    seeds += e.escalates ?? defaultEscalates(e.severity, 'negative');
  }
  const dampened = seeds * (1 - clamp(resilience, 0, 1) * ESCALATION_RESILIENCE_DAMPEN);
  return clamp(dampened * ESCALATION_RISK_PER_POINT, 0, MAX_ESCALATION_RISK);
}

// Default downstream-pressure for a negative event that doesn't set `escalates`
// explicitly: high-severity setbacks ripple, low-severity ones are contained.
// Positive events never escalate.
function defaultEscalates(severity: EventSeverity, polarity: 'positive' | 'negative'): number {
  if (polarity === 'positive') return 0;
  return severity === 'high' ? 0.6 : severity === 'medium' ? 0.25 : 0;
}

function rollSimpleEvent(template: Extract<ProductionEventTemplate, { interactive?: false }>, rng: RandomFn): ProductionEvent {
  const [costMin, costMax] = template.costRange;
  const [qMin, qMax] = template.qualityRange;
  const [bMin, bMax] = template.buzzRange;
  const [dMin, dMax] = template.delayDaysRange;
  return {
    id: template.id,
    description: template.description,
    severity: template.severity,
    costDelta: Math.round(randFloat(rng, costMin, costMax)),
    qualityDelta: randFloat(rng, qMin, qMax),
    buzzDelta: randFloat(rng, bMin, bMax),
    delayDaysDelta: Math.max(0, Math.round(randFloat(rng, dMin, dMax))),
    // The event definition owns which finished-film department it shaped and how
    // much it pressures the rest of the shoot; id inference is only a fallback.
    impact: template.impact ?? classifyEventImpact({ id: template.id }),
    escalates: template.escalates ?? defaultEscalates(template.severity, template.polarity),
    // Pre-production templates only (data/productionEvents.ts): prep quality that
    // sets the shoot's starting risk. Rounded; omitted entirely for on-set events.
    ...(template.riskDeltaRange ? { riskDelta: Math.round(randFloat(rng, template.riskDeltaRange[0], template.riskDeltaRange[1])) } : {}),
  };
}

/** Rolls one of an interactive event's choices into a concrete outcome, once the player has picked it. */
export function resolveEventChoice(pending: PendingEventChoice, choiceId: string, rng: RandomFn): ProductionEvent {
  const choice = pending.choices.find((c) => c.id === choiceId);
  if (!choice) throw new Error(`Unknown event choice "${choiceId}" for "${pending.templateId}"`);
  return rollChoiceOutcome(pending, choice, rng);
}

function rollChoiceOutcome(pending: PendingEventChoice, choice: EventChoiceTemplate, rng: RandomFn): ProductionEvent {
  const [costMin, costMax] = choice.costRange;
  const [qMin, qMax] = choice.qualityRange;
  const [bMin, bMax] = choice.buzzRange;
  const [dMin, dMax] = choice.delayDaysRange;
  const qualityDelta = randFloat(rng, qMin, qMax);
  return {
    id: pending.templateId,
    description: `${pending.situation} You chose: ${choice.label.toLowerCase()}.`,
    severity: pending.severity,
    costDelta: Math.round(randFloat(rng, costMin, costMax)),
    qualityDelta,
    buzzDelta: randFloat(rng, bMin, bMax),
    delayDaysDelta: Math.max(0, Math.round(randFloat(rng, dMin, dMax))),
    impact: pending.impact ?? classifyEventImpact({ id: pending.templateId }),
    // A choice that lands negative can still ripple (the situation's seed);
    // a choice resolved positively contains it.
    escalates: qualityDelta < 0 ? (pending.escalates ?? defaultEscalates(pending.severity, 'negative')) : 0,
    // Pre-production choices only: prep quality feeding the shoot's starting risk.
    ...(choice.riskDeltaRange ? { riskDelta: Math.round(randFloat(rng, choice.riskDeltaRange[0], choice.riskDeltaRange[1])) } : {}),
  };
}

/**
 * A single 0-100 "how good are they" reading for any hire, regardless of
 * role - their plain career skill for Director/Writer/Composer/Editor/VFX
 * Supervisor, or (since actors have no separate skill number, see
 * types/index.ts:ActorCareer) how well their ActingStyle actually suits
 * this script. Used to bias `skillSensitive` event choices toward a better
 * outcome for a stronger hire, worse for a weaker one. `role` is the
 * ProductionRole they were actually cast under, since that's what
 * determines which of their careers is even in play.
 */
export function talentSkillScore(person: Person | undefined, role: ProductionRole | undefined, script: Script | null): number {
  if (!person || !role) return 50;
  const career = getCareerForRole(person, role);
  if (career && 'skill' in career) return career.skill;
  return (script && computeTalentCompatibility(person, role, script)) ?? 50;
}

/** Picks the specific hired person an `involvesRole` event is about - a random one, for a multi-hire role. When the template `requiresTrait`, only someone in that role who actually has the trait is eligible (so the named person genuinely fits the event). */
function resolveInvolvedTalent(role: ProductionRole, talent: TalentAssignment[], rng: RandomFn, requiresTrait?: PersonTrait): Person | undefined {
  let hired = filterAssignedPeople(talent, role);
  if (requiresTrait) hired = hired.filter((p) => deriveTraits(p).includes(requiresTrait));
  return hired.length > 0 ? pick(rng, hired) : undefined;
}

function interpolateName(text: string, name: string): string {
  return text.replaceAll('{name}', name);
}

// How far a skillSensitive choice's range shifts at the extremes (skill 0 or
// 100) - half the choice's own range width, so a top talent doesn't turn a
// bad option into a guaranteed great one, just a meaningfully better one.
const SKILL_ADJUST_STRENGTH = 0.5;

function skillShift(range: [number, number], skillScore: number): number {
  return ((skillScore - 50) / 50) * (range[1] - range[0]) * SKILL_ADJUST_STRENGTH;
}

/** Higher skill shifts a quality range up - a better outcome either way, whether the choice is a risk or a fix. */
function adjustQualityForSkill(range: [number, number], skillScore: number): [number, number] {
  const shift = skillShift(range, skillScore);
  return [range[0] + shift, range[1] + shift];
}

/** Higher skill shifts a delay range down (floored at 0) - a stronger hire needs less extra time to sort the same problem out. */
function adjustDelayForSkill(range: [number, number], skillScore: number): [number, number] {
  const shift = skillShift(range, skillScore);
  return [Math.max(0, range[0] - shift), Math.max(0, range[1] - shift)];
}

/** Applies skillSensitive adjustments and {name} interpolation to an involvesRole template's choices, once, at roll time. */
export function prepareChoicesForInvolvedTalent(
  choices: EventChoiceTemplate[],
  talentName: string,
  skillScore: number,
): EventChoiceTemplate[] {
  return choices.map((c) => ({
    ...c,
    label: interpolateName(c.label, talentName),
    description: interpolateName(c.description, talentName),
    qualityRange: c.skillSensitive ? adjustQualityForSkill(c.qualityRange, skillScore) : c.qualityRange,
    delayDaysRange: c.skillSensitive ? adjustDelayForSkill(c.delayDaysRange, skillScore) : c.delayDaysRange,
  }));
}

// A recast costs the departing hire's severance plus a rush-hire premium on
// the new person's own rate - replacing someone mid-shoot is genuinely
// expensive, not just "their salary going forward" (which already updates
// on its own once they're swapped into FilmDraft.talent - see
// state/studioReducer.ts:RESOLVE_EVENT_CHOICE).
const SEVERANCE_RATE = 0.4;
const RUSH_HIRE_PREMIUM_RATE = 0.3;
// Recasting a Lead Actor means reshooting anything they're already in;
// swapping in a new Director or crew member doesn't carry that same reshoot
// cost, just ramp-up time.
const REPLACEMENT_DELAY_DAYS: Partial<Record<ProductionRole, [number, number]>> = {
  'Lead Actor': [3, 6],
  'Supporting Actor': [2, 4],
};
const DEFAULT_REPLACEMENT_DELAY: [number, number] = [2, 4];
const REPLACEMENT_CANDIDATE_COUNT = 2;

/**
 * Builds the real "recast with X" choices for an `offersReplacementFor`
 * template - candidates pulled from the studio's actual talent pool, near
 * the departing hire's own salary (engine/talentFilter.ts), each becoming
 * its own selectable choice with that specific person's name and salary and
 * a quality swing based on how their skill compares to who's leaving. Which
 * one the player picks is what determines the cost, same as any other hire.
 */
function buildReplacementChoices(
  role: ProductionRole,
  departing: Person,
  pool: Person[],
  script: Script | null,
  rng: RandomFn,
): EventChoiceTemplate[] {
  const departingSalary = getTypicalSalaryForRole(departing, role);
  const { candidates } = findCandidatesNearPrice(
    pool.filter((t) => t.id !== departing.id),
    role,
    departingSalary,
    8,
  );
  if (candidates.length === 0) return [];
  const picked = pickMany(rng, candidates, Math.min(REPLACEMENT_CANDIDATE_COUNT, candidates.length));
  const departingSkill = talentSkillScore(departing, role, script);
  const delayRange = REPLACEMENT_DELAY_DAYS[role] ?? DEFAULT_REPLACEMENT_DELAY;

  return picked.map((candidate) => {
    const candidateSalary = getTypicalSalaryForRole(candidate, role);
    const candidateSkill = talentSkillScore(candidate, role, script);
    const qualitySwing = (candidateSkill - departingSkill) / 8; // modest - a recast is a gamble, not a guaranteed upgrade
    const disruptionCost = Math.round(departingSalary * SEVERANCE_RATE + candidateSalary * RUSH_HIRE_PREMIUM_RATE);
    return {
      id: `replace-with:${candidate.id}`,
      label: `Recast with ${candidate.identity.name}`,
      description: `Severance for ${departing.identity.name}, a rush-hire premium, and the disruption of bringing someone new in mid-shoot.`,
      costRange: [disruptionCost, disruptionCost],
      qualityRange: [qualitySwing - 2, qualitySwing + 3],
      buzzRange: [0, 0],
      delayDaysRange: delayRange,
      replacementCandidateId: candidate.id,
      replacementCandidateName: candidate.identity.name,
      replacementCandidateSalary: candidateSalary,
    };
  });
}

const HIGH_RISK_THRESHOLD = 55;
const LOW_RISK_THRESHOLD = 35;

// Raised from an earlier 0.05-0.13: at that rate a real shoot could easily
// run its whole recommended length and see one event, maybe none - too
// sparse to build a felt sense of "things happen on set." Even the calmest
// (avgRisk=0) shoot now averages roughly one event every 8 days; a tense
// one averages closer to one every 4.
const MIN_DAILY_EVENT_CHANCE = 0.12;
const MAX_DAILY_EVENT_CHANCE = 0.27;

/**
 * How likely each severity tier is on a day that produces anything at all -
 * `low` dominates regardless of risk (it's routine set texture), `high`
 * stays genuinely rare even on a tense shoot. Risk shifts the mix toward
 * bigger stakes without ever making `low` uncommon: 70/25/5 at avgRisk=0,
 * 40/35/25 at avgRisk=100. This is the lever that makes "a couple of small
 * interactive events on a good shoot" the normal case rather than a fluke -
 * see docs/DESIGN.md 5.21.
 */
function severityWeights(avgRisk: number): Record<EventSeverity, number> {
  const t = clamp(avgRisk, 0, 100) / 100;
  return {
    low: 70 - 30 * t,
    medium: 25 + 10 * t,
    high: 5 + 20 * t,
  };
}

function pickSeverity(weights: Record<EventSeverity, number>, rng: RandomFn): EventSeverity {
  const total = weights.low + weights.medium + weights.high;
  const roll = rng() * total;
  if (roll < weights.low) return 'low';
  if (roll < weights.low + weights.medium) return 'medium';
  return 'high';
}

/**
 * The trait-driven templates (data/productionEvents.ts:TRAIT_EVENT_TEMPLATES)
 * this specific cast makes eligible - a Difficult star's standoff only exists on
 * a shoot that hired one. An interactive template (with `involvesRole`) is gated
 * on the person in THAT role carrying the trait; a simple one (no role) is gated
 * on anyone on the cast carrying it. Deriving traits is cheap for a ~10-person
 * cast and this runs at most once per event roll.
 */
/** Whether a template's `requiresTrait` gate is satisfied by this cast (always true when it sets no trait). For an interactive template the trait is checked on the person in `involvesRole`; for a simple one, across the whole cast. */
function traitSatisfied(t: ProductionEventTemplate, talent: TalentAssignment[]): boolean {
  if (!t.requiresTrait) return true;
  const role = 'involvesRole' in t ? t.involvesRole : undefined;
  const people = role ? filterAssignedPeople(talent, role) : talent.map((a) => a.person);
  return people.some((p) => deriveTraits(p).includes(t.requiresTrait!));
}

export function eligibleTraitTemplates(talent: TalentAssignment[]): ProductionEventTemplate[] {
  if (talent.length === 0) return [];
  return TRAIT_EVENT_TEMPLATES.filter((t) => t.requiresTrait && traitSatisfied(t, talent));
}

function buildEventPools(
  fullRisk: Record<'schedulePressure' | 'moraleRisk' | 'safetyRisk' | 'technicalComplexity' | 'budgetRisk', number>,
  genre: Genre,
  talent: TalentAssignment[],
): { positivePool: ProductionEventTemplate[]; negativePool: ProductionEventTemplate[] } {
  const genreTemplates = GENRE_EVENT_TEMPLATES[genre] ?? [];
  const traitTemplates = eligibleTraitTemplates(talent);
  const positivePool = [...POSITIVE_EVENT_TEMPLATES, ...genreTemplates.filter((t) => t.polarity === 'positive'), ...traitTemplates.filter((t) => t.polarity === 'positive')];
  const negativePool = [...NEGATIVE_EVENT_TEMPLATES, ...genreTemplates.filter((t) => t.polarity === 'negative'), ...traitTemplates.filter((t) => t.polarity === 'negative')];

  for (const dimension of Object.keys(fullRisk) as Array<keyof typeof fullRisk>) {
    const value = fullRisk[dimension];
    const bank = RISK_DIMENSION_EVENT_TEMPLATES[dimension];
    if (value >= HIGH_RISK_THRESHOLD) negativePool.push(...bank.negative);
    else if (value <= LOW_RISK_THRESHOLD) positivePool.push(...bank.positive);
  }

  return { positivePool, negativePool };
}

// At full pair chemistry a flagged chemistry beat is this many times likelier,
// relative to an ordinary event in the same pool, to be the one that fires - a
// meaningful lean, not a guarantee (SIMULATION_PHILOSOPHY.md: chemistry shapes
// the odds, it doesn't hand out a flat bonus). First-draft, tunable.
const CHEMISTRY_EVENT_WEIGHT = 3;

/**
 * Picks one template from the pool, up-weighting each positive chemistry beat
 * (data/productionEvents.ts:chemistry) in proportion to the shoot's chemistry in
 * THAT beat's dimension - cast chemistry lifts performance beats, crew chemistry
 * lifts craft beats, so a director/editor clicking never makes the cast's
 * chemistry event fire. `chemistryByDimension` is each dimension's 0..1 value. At
 * all-zero chemistry every weight is 1, so this reduces EXACTLY to the old
 * uniform `candidates[randInt(...)]` - same index, same single rng draw - leaving
 * a neutral shoot's selection (and every seeded test around it) untouched. Keyed
 * by template id, which is unique within a pool.
 */
function pickTemplateWeightedByChemistry(candidates: ProductionEventTemplate[], chemistryByDimension: Record<ChemistryDimension, number>, rng: RandomFn): ProductionEventTemplate {
  const weights: Record<string, number> = {};
  for (const t of candidates) {
    const chem = t.polarity === 'positive' && t.chemistry ? chemistryByDimension[t.chemistry] : 0;
    weights[t.id] = 1 + chem * CHEMISTRY_EVENT_WEIGHT;
  }
  const chosenId = weightedPick(rng, candidates.map((t) => t.id), weights);
  return candidates.find((t) => t.id === chosenId) ?? candidates[candidates.length - 1];
}

// On-set event generation, shared by the player's day-by-day shoot and the
// rival execution synthesizer. `usedIds` (every template already fired this
// shoot) prevents repeats within one production; an interactive template comes
// back as a `pendingChoice` (the player picks; the rival resolver auto-picks)
// rather than a resolved `event`.

/** The full risk picture on a given day: the four static dimensions plus live schedule pressure. */
export type FullProductionRisk = StaticProductionRisk & { schedulePressure: number };

/** The odds a notable event fires on one day of shooting, given the day's average risk. Shared by the player's per-day roll and the rival synthesizer's event-count estimate. */
export function dailyEventChance(avgRisk: number): number {
  return clamp(MIN_DAILY_EVENT_CHANCE + (avgRisk / 100) * (MAX_DAILY_EVENT_CHANCE - MIN_DAILY_EVENT_CHANCE), MIN_DAILY_EVENT_CHANCE, MAX_DAILY_EVENT_CHANCE);
}

/** Mean of the five risk dimensions plus any accumulated escalation, clamped 0-100 - the single "how risky is this moment" figure event selection reads. */
export function averageProductionRisk(fullRisk: FullProductionRisk, escalationRisk = 0): number {
  const base = (fullRisk.schedulePressure + fullRisk.moraleRisk + fullRisk.safetyRisk + fullRisk.technicalComplexity + fullRisk.budgetRisk) / 5;
  return clamp(base + escalationRisk, 0, 100);
}

/**
 * Selects and rolls one production event from the risk-weighted pools - the
 * shared core of on-set event generation. The player's shoot calls this once
 * per day (after a daily-chance gate, rollDayEvent below); the rival execution
 * resolver (engine/rivalExecution.ts) calls it directly, a synthesized number
 * of times, to compress a whole shoot into a plausible history. Both feed the
 * result through the identical execution pipeline (engine/productionExecution.ts) -
 * the player and AI differ only in HOW the history is generated, never in how
 * the finished film is evaluated. Returns null when every reachable template
 * has already fired this shoot (usedIds). An empty `talentPool` simply yields
 * no mid-shoot replacement options (fine for a rival, who resolves the base
 * choices itself).
 */
export function pickShootEvent(
  fullRisk: FullProductionRisk,
  avgRisk: number,
  genre: Genre,
  usedIds: ReadonlySet<string>,
  talent: TalentAssignment[],
  script: Script | null,
  talentPool: Record<TalentProfession, Person[]>,
  rng: RandomFn,
  pairings: TalentPairing[] = [],
): { event: ProductionEvent } | { pendingChoice: PendingEventChoice } | null {
  const { positivePool, negativePool } = buildEventPools(fullRisk, genre, talent);
  const rollNegative = rng() * 100 < avgRisk;
  const pool = (rollNegative ? negativePool : positivePool).filter((t) => !usedIds.has(t.id));
  const fallbackPool = (rollNegative ? positivePool : negativePool).filter((t) => !usedIds.has(t.id));
  const polarityPool = pool.length > 0 ? pool : fallbackPool;
  if (polarityPool.length === 0) return null; // exhausted every template this shoot

  // Roll severity independently of polarity - "how big a deal" and "good
  // or bad news" are different questions. Falls back to any severity within
  // the same polarity pool if that specific tier happens to be empty (or
  // already exhausted this shoot via usedIds).
  const severity = pickSeverity(severityWeights(avgRisk), rng);
  const severityPool = polarityPool.filter((t) => t.severity === severity);
  const candidates = severityPool.length > 0 ? severityPool : polarityPool;

  // A well-matched pairing is likelier to actually hit its chemistry beat when
  // good news lands - read off `talent` plus any shared history (`pairings`), so
  // a proven duo lands it more reliably than personality alone would predict.
  // Read per dimension so cast chemistry and crew chemistry route to their own
  // beats. Reads identically for the player's shoot and the rival synthesizer;
  // neutral personalities with no history read 0 and leave selection unchanged.
  const chemistryByDimension: Record<ChemistryDimension, number> = {
    performance: computeEffectivePairChemistry(talent, pairings, 'performance') / 100,
    craft: computeEffectivePairChemistry(talent, pairings, 'craft') / 100,
  };
  const template = pickTemplateWeightedByChemistry(candidates, chemistryByDimension, rng);
  if (!template.interactive) {
    return { event: rollSimpleEvent(template, rng) };
  }

  const involved = template.involvesRole ? resolveInvolvedTalent(template.involvesRole, talent, rng, template.requiresTrait) : undefined;
  // involvesRole is only ever set on templates about a mandatory role, which
  // is guaranteed hired by the time photography can begin - but if it's
  // ever missing for any reason, skip this template for today rather than
  // show a decision about someone who doesn't exist.
  if (template.involvesRole && !involved) return null;

  const skillScore = involved ? talentSkillScore(involved, template.involvesRole, script) : 50;
  let choices = involved ? prepareChoicesForInvolvedTalent(template.choices, involved.identity.name, skillScore) : template.choices;
  const situation = involved ? interpolateName(template.situation, involved.identity.name) : template.situation;

  if (template.offersReplacementFor && involved) {
    const replacementPool = talentPool[professionForProductionRole(template.offersReplacementFor)] ?? [];
    choices = [...choices, ...buildReplacementChoices(template.offersReplacementFor, involved, replacementPool, script, rng)];
  }

  return {
    pendingChoice: {
      templateId: template.id,
      situation,
      polarity: template.polarity,
      severity: template.severity,
      choices,
      involvedTalentId: involved?.id,
      involvedTalentName: involved?.identity.name,
      involvedRole: template.involvesRole,
      replacementRole: template.offersReplacementFor,
      impact: template.impact ?? classifyEventImpact({ id: template.id }),
      escalates: template.escalates ?? defaultEscalates(template.severity, template.polarity),
    },
  };
}

/**
 * Rolls whatever happens on a single day of principal photography - most days,
 * nothing notable does (the daily-chance gate). Called once per
 * ADVANCE_SHOOTING_DAY dispatch (state/studioReducer.ts). Schedule Pressure is
 * recomputed fresh each call from how many days have elapsed so far, folded in
 * alongside the four static dimensions and any accumulated `escalationRisk`
 * (computeShootEscalation) - a shoot running long or already in trouble becomes
 * both more event-prone and more negative. On a day that does produce
 * something, the selection is delegated to the shared pickShootEvent above, so
 * the player and the rival synthesizer draw from the exact same pools.
 */
export function rollDayEvent(
  staticRisk: StaticProductionRisk,
  daysElapsed: number,
  recommendedDays: number,
  genre: Genre,
  usedIds: ReadonlySet<string>,
  talent: TalentAssignment[],
  script: Script | null,
  talentPool: Record<TalentProfession, Person[]>,
  rng: RandomFn,
  escalationRisk = 0,
  pairings: TalentPairing[] = [],
): { event: ProductionEvent } | { pendingChoice: PendingEventChoice } | null {
  const schedulePressure = computeSchedulePressure(daysElapsed, recommendedDays);
  const fullRisk: FullProductionRisk = { schedulePressure, ...staticRisk };
  const avgRisk = averageProductionRisk(fullRisk, escalationRisk);

  if (rng() >= dailyEventChance(avgRisk)) return null;

  return pickShootEvent(fullRisk, avgRisk, genre, usedIds, talent, script, talentPool, rng, pairings);
}

// --- Pre-production (the day-by-day prep phase) -----------------------------
// A lean sibling to the on-set roller above (types/index.ts:PreProductionState).
// Prep has no live risk dimensions of its own, so selection is simpler: a flat
// daily chance, then a uniform pick from the prep bank (minus anything already
// fired this prep, and gated by the same trait rules on-set events use). The
// prep history it builds then feeds the shoot two ways - computePrepRiskDelta
// (starting risk) and prepQualityEvents (finished film).

// Roughly one prep event every ~5-6 days - prep should feel eventful without a
// decision every day. First-draft, tunable.
const PREPROD_EVENT_CHANCE = 0.18;

/** Rolls whatever happens on a single day of pre-production - usually nothing. Mirrors rollDayEvent's shape (an interactive template returns a pendingChoice to pause on), but without the on-set risk model. */
export function rollPreProductionDayEvent(
  talent: TalentAssignment[],
  script: Script | null,
  usedIds: ReadonlySet<string>,
  rng: RandomFn,
): { event: ProductionEvent } | { pendingChoice: PendingEventChoice } | null {
  if (rng() >= PREPROD_EVENT_CHANCE) return null;
  const pool = PRE_PRODUCTION_EVENT_TEMPLATES.filter((t) => !usedIds.has(t.id) && traitSatisfied(t, talent));
  if (pool.length === 0) return null;

  const template = pool[randInt(rng, 0, pool.length - 1)];
  if (!template.interactive) return { event: rollSimpleEvent(template, rng) };

  const involved = template.involvesRole ? resolveInvolvedTalent(template.involvesRole, talent, rng, template.requiresTrait) : undefined;
  if (template.involvesRole && !involved) return null;

  const skillScore = involved ? talentSkillScore(involved, template.involvesRole, script) : 50;
  const choices = involved ? prepareChoicesForInvolvedTalent(template.choices, involved.identity.name, skillScore) : template.choices;
  const situation = involved ? interpolateName(template.situation, involved.identity.name) : template.situation;

  return {
    pendingChoice: {
      templateId: template.id,
      situation,
      polarity: template.polarity,
      severity: template.severity,
      choices,
      involvedTalentId: involved?.id,
      involvedTalentName: involved?.identity.name,
      involvedRole: template.involvesRole,
      impact: template.impact ?? classifyEventImpact({ id: template.id }),
      escalates: template.escalates ?? defaultEscalates(template.severity, template.polarity),
    },
  };
}

// The most prep can move the shoot's starting risk in either direction - bounded
// so no amount of good (or bad) prep can trivialize or doom a shoot on its own.
const MAX_PREP_RISK_SWING = 25;

/** The net starting-risk adjustment a finished prep produces, from its events' riskDelta - negative = well-prepared, clamped to a bounded swing. */
export function computePrepRiskDelta(preProduction: PreProductionState | null): number {
  if (!preProduction) return 0;
  const sum = preProduction.events.reduce((s, e) => s + (e.riskDelta ?? 0), 0);
  return clamp(sum, -MAX_PREP_RISK_SWING, MAX_PREP_RISK_SWING);
}

/**
 * The prep events that carry a finished-film consequence (nonzero qualityDelta),
 * merged into the shoot's execution history at release so good/bad prep genuinely
 * reaches the film. Cost/buzz/delay are ZEROED on the copy: a prep event's cash
 * cost was already charged live during pre-production (studioReducer:
 * ADVANCE_PREPRODUCTION_DAY), so only its quality/impact should reach the
 * finished-film accounting - not a second charge.
 */
export function prepQualityEvents(preProduction: PreProductionState | null): ProductionEvent[] {
  if (!preProduction) return [];
  return preProduction.events
    .filter((e) => e.qualityDelta !== 0)
    .map((e) => ({ ...e, costDelta: 0, buzzDelta: 0, delayDaysDelta: 0 }));
}

/** Applies a prep starting-risk delta uniformly across the four static risk dimensions (each clamped 0-100) - good prep lowers what the shoot begins with, bad prep raises it. */
export function applyPrepRiskDelta(risk: StaticProductionRisk, delta: number): StaticProductionRisk {
  if (delta === 0) return risk;
  const adj = (v: number) => clamp(Math.round(v + delta), 0, 100);
  return {
    moraleRisk: adj(risk.moraleRisk),
    safetyRisk: adj(risk.safetyRisk),
    technicalComplexity: adj(risk.technicalComplexity),
    budgetRisk: adj(risk.budgetRisk),
  };
}
