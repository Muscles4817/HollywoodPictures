// Casting Appeal Rework - director interest. Structurally parallel to
// engine/castingAppeal.ts's actor-side computeActorAppeal (same building
// blocks: prestigeLean, computeSelectiveness, computeEffectiveMinimumSalary,
// computeSalaryFit, computeScheduleAssessment, a resolveOfferResponse-shaped
// resolution) but kept as its own file rather than folded in - that file's
// own header scopes "the one appeal function" explicitly to the three actor
// attachment paths, and a director's hard prestige-vs-fame gate has no
// actor equivalent to share a formula with.
//
// Before this file existed, Director hiring (components/wizard/RoleHiringDrawer.tsx)
// had no interest step at all - any director in a studio's price band
// attached instantly on click. That let a no-name studio instant-hire a
// director whose fame implies they'd never actually consider such an
// offer. The gate below is checked first, ahead of any scoring: below it,
// no script quality or salary makes the studio interesting to them.
import type { Distribution, DirectorProductionStyle, GameDay, Money, Person, Script, Studio, Tone } from '../types';
import { TONES } from '../data/tones';
import { getDirectorCareer } from './person';
import { computeScriptScore } from './scoring';
import { computeCompatibility } from './compatibility';
import { APTITUDE_DOMAINS, deriveDirectorAptitudes, type AptitudeDomain } from './creativeAptitudes';
import { clamp } from './random';
import {
  computeAcceptanceThreshold,
  computeEffectiveMinimumSalary,
  computeSalaryFit,
  computeScheduleAssessment,
  prestigeLean,
  type ActorScheduleAssessment,
} from './castingAppeal';
import { NO_RELATIONSHIP, relationshipAppealDelta, relationshipRefuses, type RelationshipStanding } from './relationships';

export interface DirectorAppealFactors {
  /**
   * How much THIS director personally wants to make THIS film, 0-100
   * (computeDirectorAppetite) - their taste for the material (tone), whether
   * their craft strengths are what it needs, whether its implied production
   * matches how they shoot, and - only as much as they care - its raw quality.
   * Replaces the old flat computeScriptScore(script): that read the *material's*
   * global quality, identical for every director, which is exactly what let a
   * well-funded prestige studio land any A-lister. Now the same script draws a
   * different appetite from each director. See
   * docs/DESIGN_director_pitch_and_bakeoff.md Phase A.
   */
  scriptFit: number;
  /** studio.brand, weighted by this director's own commercial lean. */
  brandFit: number;
  /** studio.prestige + script quality, weighted by this director's own prestige lean - no "director reputation" term the way an actor's prestigeFit has, since this director *is* the one being sized up here. */
  prestigeFit: number;
  /** Offered salary vs. this director's own effective minimum/typicalSalary - identical mechanism to the actor path (computeEffectiveMinimumSalary), just with no directorDraw input (a director isn't drawn to themselves). */
  salaryFit: number;
}

export type DirectorAppealResult = DirectorAppealFactors & {
  overall: number;
  schedule: ActorScheduleAssessment;
  belowSalaryFloor: boolean;
  /**
   * The director finds the material genuinely distasteful (computeDirectorTasteFit
   * below TASTE_FLOOR) - a hard creative veto, resolved ahead of the soft
   * `overall` comparison exactly like belowSalaryFloor, so no fee or studio
   * prestige can buy past it. This is what stops a rich, prestigious studio from
   * landing any director on any film (the specific wrong Phase A removes).
   */
  belowTasteFloor: boolean;
};

// A director's own fame sets a floor on how prestigious a studio has to be
// before they're interested at all, independent of script quality or
// salary - first-draft, tunable linear ramp. A brand-new studio (prestige
// 20, createInitialStudio's own starting value) only clears this for a
// director with fame under ~37; a fame-95 A-lister needs studio prestige
// north of 66.
const PRESTIGE_GATE_FAME_RATIO = 0.8;
const PRESTIGE_GATE_OFFSET = 10;

function requiredStudioPrestige(director: Person): number {
  return clamp(director.reputation.fame * PRESTIGE_GATE_FAME_RATIO - PRESTIGE_GATE_OFFSET, 0, 100);
}

function computeDirectorPrestigeSignal(studio: Studio, script: Script): number {
  return studio.prestige * 0.5 + computeScriptScore(script) * 0.5;
}

const WEIGHTS = {
  scriptFit: 0.4,
  reputationFit: 0.35,
  salaryFit: 0.25,
};

// --- Personal appetite: how much THIS director wants to make THIS film -------
// The individual-creative read the flat computeScriptScore never gave us. All
// four terms are built from signals that already exist (SIMULATION_PHILOSOPHY
// Principle 7 - connect, don't duplicate): tone compatibility (compatibility.ts),
// domain aptitudes (creativeAptitudes.ts), the director's production style vs the
// script's implied one (both already share Distribution keys by design), and the
// script's own quality. First-draft, tunable weights (they sum to 1), like every
// other numeric constant in this simulation.
const APPETITE_WEIGHTS = {
  tone: 0.4, // does the material suit their taste (computeCompatibility)
  craft: 0.2, // are their strong domains what this script needs
  method: 0.15, // does the script's implied production match how they shoot
  material: 0.25, // raw script quality - but only as much as they personally care (prestigeLean)
};

const NEUTRAL = 50;

// How much a high-ego director's appetite swings wider around neutral on tone:
// a proud auteur loves their kind of film more and recoils from off-type
// material harder than a jobbing director who'll shoot anything. ego=1 widens
// the tone signal's distance from neutral by this fraction. This is why money
// alone stops landing big names on the wrong film.
const EGO_TONE_SENSITIVITY = 0.6;

// The creative veto: a director whose ego-amplified taste fit falls below this
// won't make the film at any fee - the creative equivalent of the salary floor.
// Tuned low so only a genuine taste mismatch (a proud director on strongly
// off-type material) trips it; a merely-lukewarm director still weighs the whole
// offer through `overall`, and neutral/humble directors have their taste fit
// pulled toward NEUTRAL, well clear of this.
const TASTE_FLOOR = 30;

// A first-draft, tunable read of "what a script with this emotional fingerprint
// most needs from its director." Drama/suspense are story- and craft-forward;
// action/spectacle are visual; comedy leans on directing performance and the
// timing of the assembly. Weighted by the script's own tone emphasis, then used
// to weight the director's own domain aptitudes into one craft-fit read.
const TONE_DOMAIN_DEMAND: Record<Tone, Partial<Record<AptitudeDomain, number>>> = {
  action: { visual: 1 },
  comedy: { performance: 0.6, craft: 0.4 },
  romance: { performance: 1 },
  suspense: { story: 0.5, craft: 0.5 },
  drama: { story: 0.6, performance: 0.4 },
  spectacle: { visual: 1 },
};

// A small uniform floor added to every domain's demand so a director is never
// judged on a single craft alone (every film needs a bit of all four).
const DOMAIN_DEMAND_FLOOR = 5;

/** The four-domain craft demand this script implies, from its tone emphasis. */
function scriptDomainDemand(script: Script): Record<AptitudeDomain, number> {
  const demand: Record<AptitudeDomain, number> = { story: 0, visual: 0, performance: 0, craft: 0 };
  for (const tone of TONES) {
    const weight = script.toneProfile[tone];
    const contrib = TONE_DOMAIN_DEMAND[tone];
    for (const d of APTITUDE_DOMAINS) demand[d] += (contrib[d] ?? 0) * weight;
  }
  for (const d of APTITUDE_DOMAINS) demand[d] += DOMAIN_DEMAND_FLOOR;
  return demand;
}

/** The director's aptitudes weighted by what this script actually needs (0-100). */
function computeCraftFit(director: Person, script: Script): number {
  const apt = deriveDirectorAptitudes(director);
  const demand = scriptDomainDemand(script);
  let weighted = 0;
  let total = 0;
  for (const d of APTITUDE_DOMAINS) {
    weighted += demand[d] * apt[d];
    total += demand[d];
  }
  return total > 0 ? clamp(weighted / total, 0, 100) : NEUTRAL;
}

/** Histogram intersection of two distributions over the same keys - 0 (disjoint) to 1 (identical). */
function distributionOverlap<K extends string>(a: Distribution<K>, b: Distribution<K>): number {
  let overlap = 0;
  for (const key of Object.keys(a) as K[]) overlap += Math.min(a[key], b[key] ?? 0);
  return clamp(overlap, 0, 1);
}

/** How closely the director's preferred way of shooting matches the script's implied approach (0-100). */
function computeMethodAffinity(style: DirectorProductionStyle, script: Script): number {
  const env = distributionOverlap(style.environmentStrategy, script.environmentStrategy);
  const fx = distributionOverlap(style.effectsStrategy, script.effectsStrategy);
  return ((env + fx) / 2) * 100;
}

/**
 * How much this director's *taste* suits this material (0-100) - tone
 * compatibility, then widened around neutral by ego so a proud auteur loves
 * their kind of film more and recoils from off-type material harder. Separate
 * from the blended appetite because it is also the creative veto
 * (belowTasteFloor / TASTE_FLOOR): a director can be perfectly capable of making
 * a film well and still not *want* to. NEUTRAL fallback for the
 * impossible-in-practice non-director person.
 */
export function computeDirectorTasteFit(person: Person, script: Script): number {
  const career = getDirectorCareer(person);
  if (!career) return NEUTRAL;
  const ego = clamp((person.personality?.ego ?? 50) / 100, 0, 1);
  const rawTone = computeCompatibility(script.toneProfile, career.toneProfile);
  return clamp(NEUTRAL + (rawTone - NEUTRAL) * (1 + ego * EGO_TONE_SENSITIVITY), 0, 100);
}

/**
 * How much this specific director wants to make this specific film, independent
 * of pay (salary is scored separately, in salaryFit). Falls back to a neutral
 * NEUTRAL for the impossible-in-practice non-director person, matching how the
 * aptitude/hands-on derivations stay total under the same case.
 */
export function computeDirectorAppetite(person: Person, script: Script): number {
  const career = getDirectorCareer(person);
  if (!career) return NEUTRAL;

  const tone = computeDirectorTasteFit(person, script);
  const craft = computeCraftFit(person, script);
  const method = computeMethodAffinity(career.productionStyle, script);

  // Material quality matters to a prestige-minded director and barely registers
  // for a commercial one, so it pulls appetite from neutral toward the script's
  // actual quality in proportion to their prestige lean - never dragging a
  // commercial director down on a merely-fun film.
  const material = NEUTRAL + (computeScriptScore(script) - NEUTRAL) * prestigeLean(person);

  return clamp(
    tone * APPETITE_WEIGHTS.tone +
      craft * APPETITE_WEIGHTS.craft +
      method * APPETITE_WEIGHTS.method +
      material * APPETITE_WEIGHTS.material,
    0,
    100,
  );
}

/**
 * How interested this director is in directing this script for this
 * studio, at this offered salary - null only if `person` has no Director
 * career at all. `'prestige-gate'` (checked first, ahead of any scoring)
 * means this director won't consider this studio at all right now,
 * regardless of script quality or salary - see requiredStudioPrestige.
 */
export function computeDirectorAppeal(
  person: Person,
  script: Script,
  studio: Studio,
  offeredSalary: Money,
  plannedStartDay: GameDay,
  // Talent Relationship History (engine/relationships.ts) - this director's
  // persistent standing with the offering studio. Neutral-by-default, same as
  // the actor path, so strangers and un-updated call sites are unchanged. The
  // prestige gate stays ahead of it: a relationship never buys past the "won't
  // attach my name to a studio this small" floor - it colours how a director
  // who's already willing to consider you weighs the offer, not whether they'll
  // look at you at all.
  relationship: RelationshipStanding = NO_RELATIONSHIP,
): DirectorAppealResult | 'prestige-gate' | null {
  const career = getDirectorCareer(person);
  if (!career) return null;

  if (studio.prestige < requiredStudioPrestige(person)) return 'prestige-gate';

  const lean = prestigeLean(person);
  const prestigeSignal = computeDirectorPrestigeSignal(studio, script);
  // No directorDraw term - a director isn't drawn to working with
  // themselves the way an actor can be drawn to a director already
  // attached.
  const effectiveMinimum = computeEffectiveMinimumSalary(person, career.minimumSalary, prestigeSignal, 0, relationship);

  const factors: DirectorAppealFactors = {
    scriptFit: computeDirectorAppetite(person, script),
    brandFit: studio.brand * (1 - lean),
    prestigeFit: prestigeSignal * lean,
    salaryFit: computeSalaryFit(offeredSalary, effectiveMinimum, career.typicalSalary),
  };

  const reputationFit = factors.brandFit + factors.prestigeFit;
  const overall =
    factors.scriptFit * WEIGHTS.scriptFit +
    reputationFit * WEIGHTS.reputationFit +
    factors.salaryFit * WEIGHTS.salaryFit +
    // A delta from neutral (0 for strangers) - see the actor path's own note.
    relationshipAppealDelta(relationship);

  return {
    ...factors,
    overall: clamp(overall, 0, 100),
    schedule: computeScheduleAssessment(person, plannedStartDay),
    belowSalaryFloor: offeredSalary < effectiveMinimum,
    belowTasteFloor: computeDirectorTasteFit(person, script) < TASTE_FLOOR,
  };
}

export type DirectorOfferRejectionReason = 'prestige-gate' | 'script-fit' | 'brand-prestige-mismatch' | 'salary' | 'schedule' | 'relationship';

export type DirectorOfferResponse = { status: 'accepted' } | { status: 'rejected'; reason: DirectorOfferRejectionReason };

function directorRejectionReason(factors: DirectorAppealFactors, reputationFit: number): DirectorOfferRejectionReason {
  const candidates: Array<[DirectorOfferRejectionReason, number]> = [
    ['script-fit', factors.scriptFit],
    ['brand-prestige-mismatch', reputationFit],
    ['salary', factors.salaryFit],
  ];
  return candidates.reduce((worst, candidate) => (candidate[1] < worst[1] ? candidate : worst))[0];
}

/**
 * Resolves one director offer - mirrors engine/castingAppeal.ts:resolveOfferResponse's
 * ordering exactly (prestige gate, then schedule, then the salary floor,
 * all ahead of the soft `overall`-vs-selectiveness comparison). `null` only
 * when `computeDirectorAppeal` itself returned null (no Director career).
 */
export function resolveDirectorOfferResponse(
  outcome: DirectorAppealResult | 'prestige-gate' | null,
  person: Person,
  relationship: RelationshipStanding = NO_RELATIONSHIP,
): DirectorOfferResponse | null {
  if (outcome === null) return null;
  if (outcome === 'prestige-gate') return { status: 'rejected', reason: 'prestige-gate' };
  if (outcome.schedule.status !== 'available') return { status: 'rejected', reason: 'schedule' };
  if (outcome.belowSalaryFloor) return { status: 'rejected', reason: 'salary' };
  // The creative veto - a hard gate like the salary floor above (Phase A): a
  // director who finds the material distasteful won't be bought onto it, no
  // matter the fee or the studio's standing.
  if (outcome.belowTasteFloor) return { status: 'rejected', reason: 'script-fit' };
  // A deep grudge is a hard refusal, same as the actor path (engine/relationships.ts).
  if (relationshipRefuses(relationship)) return { status: 'rejected', reason: 'relationship' };
  const threshold = computeAcceptanceThreshold(person, relationship);
  if (outcome.overall >= threshold) return { status: 'accepted' };
  const reputationFit = outcome.brandFit + outcome.prestigeFit;
  return { status: 'rejected', reason: directorRejectionReason(outcome, reputationFit) };
}
