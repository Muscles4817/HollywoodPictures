// Casting Redesign, Phase B (docs/DESIGN_REVIEW_casting_redesign.md section
// 3) - "the one appeal function." A second, independent reading from
// engine/compatibility.ts's computeActorCharacterCompatibility (Suitability
// below reuses that directly, unchanged): that function asks "does this
// actor's craft suit this role," this one asks "would this actor actually
// want it" - fame, salary, schedule, and the studio's own reputation all
// factor in, Suitability is only one term among several. One function feeds
// Open Casting's applicant weighting (engine/castingCalls.ts), and Direct
// Approach/Interested Talent's accept-or-decline rolls - never three
// divergent formulas for the three attachment paths (design review TL;DR).
// Director interest is a structurally parallel *sibling*
// (engine/directorAppeal.ts), not folded in here - see that file's own
// header for why.
//
// Casting Appeal Rework - schedule and the salary floor used to be small
// weighted preferences (7.5% and, effectively, capped at 25% no matter how
// total the mismatch) inside `overall`. That let a suitability/reputation-
// heavy candidate fully outvote a wildly unaffordable salary or a genuinely
// incompatible schedule (measured: a $10M actor could still clear a
// mid-prestige studio's overall bar for a $500k role). Both are now hard
// eligibility gates resolved *before* `overall` is even compared against a
// threshold - see ActorScheduleAssessment and `belowSalaryFloor` below, and
// resolveOfferResponse's own ordering.
import type { GameDay, Money, Person, ProductionRole, Script, ScriptCharacter, Studio, TalentAssignment } from '../types';
import { computeActorCharacterCompatibility } from './compatibility';
import { computeScriptScore } from './scoring';
import { getActorCareer, deriveBookedUntil } from './person';
import { clamp } from './random';
import { deriveTraits } from './personTraits';

export interface ActorAppealFactors {
  /** computeActorCharacterCompatibility - reused directly, unchanged. */
  suitability: number;
  /** studio.brand, weighted by this actor's own commercial lean. */
  brandFit: number;
  /** studio.prestige + script quality + director reputation, weighted by this actor's own prestige lean. */
  prestigeFit: number;
  /** Offered salary vs. this actor's own *effective* minimum/typicalSalary - see computeEffectiveMinimumSalary. Only ever scored for offers that already cleared the floor; a below-floor offer is gated out before `overall` matters, not merely scored low here. */
  salaryFit: number;
  /** Derived fresh from whoever's already attached to *this* project (director + cast so far) - never stored, never decays. A major name signing raises this on the very next calculation for everyone else being considered, with no separate ticking bonus to track (design review section 3's own pushback on "production momentum" as a stored value). Role-weighted with diminishing returns over the top few attachments - see computeAttachmentMomentum. */
  attachmentMomentum: number;
}

/** Whether this person can even start on the project's planned day - a hard gate, not a weighted preference (Casting Appeal Rework). `requires-delay` is a real, distinct outcome from `unavailable` (a finite overlap under MAX_SCHEDULE_OVERLAP_DAYS vs. one beyond it), meant as the hook a future "shift the production date" flow would key off - there's no such flow yet, so both resolve as a rejection today. */
export interface ActorScheduleAssessment {
  status: 'available' | 'requires-delay' | 'unavailable';
  availableFromDay: GameDay;
  delayDays: number;
}

export type ActorAppealResult = ActorAppealFactors & {
  overall: number;
  schedule: ActorScheduleAssessment;
  /** offeredSalary < this person's effective minimum - a hard gate, checked ahead of `overall` (see resolveOfferResponse and engine/castingCalls.ts's pool-eligibility filter). `salaryFit` above still carries a low score in this case, purely for display (e.g. sorting an applicant list), never for the accept/decline or pool-inclusion decision. */
  belowSalaryFloor: boolean;
};

// First-draft, tunable weights, like every other numeric constant in this
// simulation. Schedule is excluded entirely - it's a gate now, not a
// preference (see ActorScheduleAssessment). brandFit and prestigeFit are NOT
// independent budget the way suitability/salaryFit/attachmentMomentum are -
// prestigeLean always splits a given actor between the two as complementary
// fractions (studio.brand*(1-lean) and prestigeSignal*lean), so summing both
// at their own weight only ever gives the *blended* reputation-fit signal an
// EFFECTIVE weight equal to that one shared weight, never their sum.
// reputationFit below is computed explicitly (brandFit + prestigeFit) and
// given its own single weight, on equal footing with suitability.
const WEIGHTS = {
  suitability: 0.35,
  reputationFit: 0.3,
  salaryFit: 0.25,
  attachmentMomentum: 0.1,
};

/**
 * How much this actor personally leans toward valuing the studio's
 * Prestige over its Brand, 0 (fully commercial) to 1 (fully
 * prestige-minded) - derived from Person fields that already exist
 * (reputation.prestige, personality.ambition/ego) rather than a new stored
 * preference stat. High existing critical standing reads as still caring
 * about it; high ambition/ego without matching prestige reads as hungrier
 * for visibility and stardom than for critical respect.
 */
export function prestigeLean(person: Person): number {
  const commercialPull = (person.personality.ambition + person.personality.ego) / 2;
  const prestigePull = person.reputation.prestige;
  return clamp((prestigePull - commercialPull) / 200 + 0.5, 0, 1);
}

function computeBrandFit(studio: Studio, lean: number): number {
  return studio.brand * (1 - lean);
}

// No-director default for the term below - deliberately low, not a neutral
// midpoint. Matches createInitialStudio's own starting brand/prestige (20),
// the same "unproven until you show something" read a fresh studio itself
// gets.
const NO_DIRECTOR_REPUTATION_DEFAULT = 20;

/**
 * How prestigious this opportunity reads, independent of any one person's
 * own lean toward caring about that - studio standing, script quality, and
 * whoever's directing. Shared by computePrestigeFit (actor-lean-scaled) and
 * computeEffectiveMinimumSalary's discount (Casting Appeal Rework - the same
 * signal that makes an actor *want* a project is what makes them willing to
 * take less for it).
 */
function computePrestigeSignal(studio: Studio, script: Script, director: Person | undefined): number {
  const scriptQuality = computeScriptScore(script);
  const directorReputation = director
    ? (director.reputation.prestige + director.reputation.industryRespect) / 2
    : NO_DIRECTOR_REPUTATION_DEFAULT;
  return studio.prestige * 0.4 + scriptQuality * 0.3 + directorReputation * 0.3;
}

function computePrestigeFit(prestigeSignal: number, lean: number): number {
  return prestigeSignal * lean;
}

// How many days of schedule overlap with the project's planned start before
// an actor reads as genuinely unavailable rather than merely needing a
// delayed start - first-draft, tunable ceiling, not a hard rule about real
// production scheduling. Reused as the boundary between
// ActorScheduleAssessment's 'requires-delay' and 'unavailable'.
const MAX_SCHEDULE_OVERLAP_DAYS = 180;

export function computeScheduleAssessment(person: Person, plannedStartDay: GameDay): ActorScheduleAssessment {
  const bookedUntil = deriveBookedUntil(person.availability.commitments);
  if (!bookedUntil || bookedUntil <= plannedStartDay) {
    return { status: 'available', availableFromDay: plannedStartDay, delayDays: 0 };
  }
  const delayDays = bookedUntil - plannedStartDay;
  return {
    status: delayDays <= MAX_SCHEDULE_OVERLAP_DAYS ? 'requires-delay' : 'unavailable',
    availableFromDay: bookedUntil,
    delayDays,
  };
}

// How far below a raw minimumSalary a discount can ever push the effective
// floor - first-draft, tunable. Nobody works for free, no matter how drawn
// to the project.
const MAX_SALARY_DISCOUNT = 0.4;
// PrestigeFocused actors lean harder into a paycut for the right project -
// amplifies the same drawSignal rather than introducing a second formula.
const PRESTIGE_FOCUSED_DISCOUNT_MULTIPLIER = 1.5;
// How much a specific director's own draw (independent of this actor's own
// prestige lean) can contribute to the discount, relative to the
// prestige-lean-scaled studio/script signal.
const DIRECTOR_DRAW_WEIGHT = 0.5;

/**
 * The salary floor a specific offer is actually judged against - not always
 * the person's raw career minimumSalary. Reuses engine/personTraits.ts's
 * already-derived PaychequeDriven/PrestigeFocused reads rather than a new
 * stored preference field (this codebase's own "derive, don't store" rule):
 * PaychequeDriven actors never discount (minimumSalary stays an absolute
 * floor); PrestigeFocused actors discount more readily off the same signal;
 * everyone else gets a smaller, still-nonzero discount. `directorDraw` (a
 * specific attached director's own fame/prestige, via personMomentumScore -
 * shared with engine/directorAppeal.ts) can pull the discount up
 * independent of this actor's own prestige lean - a star doesn't need to be
 * prestige-focused themselves to take a cut for a director they
 * specifically want to work with.
 */
export function computeEffectiveMinimumSalary(
  person: Person,
  minimumSalary: Money,
  prestigeSignal: number,
  directorDraw: number,
): Money {
  const traits = deriveTraits(person);
  if (traits.includes('PaychequeDriven')) return minimumSalary;

  const lean = prestigeLean(person);
  const drawSignal = clamp(prestigeSignal * lean + directorDraw * DIRECTOR_DRAW_WEIGHT, 0, 100);
  const baseDiscountFraction = (drawSignal / 100) * MAX_SALARY_DISCOUNT;
  const discountFraction = traits.includes('PrestigeFocused')
    ? clamp(baseDiscountFraction * PRESTIGE_FOCUSED_DISCOUNT_MULTIPLIER, 0, MAX_SALARY_DISCOUNT)
    : baseDiscountFraction;

  return Math.round(minimumSalary * (1 - discountFraction));
}

/**
 * offeredSalary vs. this person's *effective* minimum/typicalSalary - the
 * effective minimum itself reads as a moderately acceptable ~50 (not 0, per
 * the Casting Appeal Rework - a minimum-salary offer shouldn't read as
 * meaningless), typicalSalary as ~85, and a premium offer above typical
 * approaches 100 with diminishing returns. Purely a display/ranking score -
 * the actual below-floor accept/decline gate is `belowSalaryFloor` on
 * ActorAppealResult, checked separately.
 */
export function computeSalaryFit(offeredSalary: Money, effectiveMinimum: Money, typicalSalary: Money): number {
  if (typicalSalary <= effectiveMinimum) return offeredSalary >= effectiveMinimum ? 100 : 0;
  if (offeredSalary >= typicalSalary) {
    const premiumRatio = typicalSalary > 0 ? (offeredSalary - typicalSalary) / typicalSalary : 0;
    return clamp(85 + 15 * (1 - Math.exp(-premiumRatio * 3)), 0, 100);
  }
  if (offeredSalary <= effectiveMinimum) {
    return effectiveMinimum > 0 ? clamp((offeredSalary / effectiveMinimum) * 50, 0, 50) : 50;
  }
  const t = (offeredSalary - effectiveMinimum) / (typicalSalary - effectiveMinimum);
  return clamp(50 + t * 35, 0, 100);
}

// Role weighting for attachmentMomentum below - a director or lead actor
// signing on should carry noticeably more pull than a minor crew hire, not
// an equal vote in the average (Casting Appeal Rework). Unlisted roles
// default to 1 (an even vote).
const MOMENTUM_ROLE_WEIGHTS: Partial<Record<ProductionRole, number>> = {
  Director: 1.3,
  'Lead Actor': 1.2,
};

// Additive, not averaged - the top attachment is counted in full (weight 1),
// a second/third add only a diminishing bonus on top. Deliberately NOT a
// weighted average over however many attachments exist: averaging would
// mean a single strong attachment's *share* of the total shrinks the moment
// a second (even much weaker) one is added, which reads as being "dragged
// down" by hiring more people - exactly what this rework set out to stop.
// Additive means momentum is monotonic non-decreasing in attachments by
// construction - a pile of minor crew hires can only ever add a little, and
// only up to the 100 clamp, never subtract.
const MOMENTUM_TOP_N_WEIGHTS = [1, 0.3, 0.15];

/** Shared by attachmentMomentum's ranking and computeEffectiveMinimumSalary's directorDraw input - exported for engine/directorAppeal.ts to reuse the identical "how much pull does this specific person carry" read. */
export function personMomentumScore(person: Person): number {
  return (person.reputation.fame + person.reputation.prestige) / 2;
}

function computeAttachmentMomentum(currentTalent: TalentAssignment[]): number {
  if (currentTalent.length === 0) return 0;
  const ranked = currentTalent
    .map((a) => personMomentumScore(a.person) * (MOMENTUM_ROLE_WEIGHTS[a.role] ?? 1))
    .sort((a, b) => b - a)
    .slice(0, MOMENTUM_TOP_N_WEIGHTS.length);
  const weightedSum = ranked.reduce((sum, score, i) => sum + score * MOMENTUM_TOP_N_WEIGHTS[i], 0);
  return clamp(weightedSum, 0, 100);
}

/**
 * How appealing this specific Character, on this specific production,
 * reads to this specific actor - null only if `person` has no Actor career
 * at all (mirrors computeActorCharacterCompatibility's own
 * null-for-not-applicable convention). `currentTalent` is whoever's
 * already attached to this project (director + cast so far) - read for
 * attachmentMomentum only, never mutated here.
 */
export function computeActorAppeal(
  person: Person,
  character: ScriptCharacter,
  script: Script,
  studio: Studio,
  director: Person | undefined,
  currentTalent: TalentAssignment[],
  offeredSalary: Money,
  plannedStartDay: GameDay,
): ActorAppealResult | null {
  const career = getActorCareer(person);
  if (!career) return null;

  const lean = prestigeLean(person);
  const prestigeSignal = computePrestigeSignal(studio, script, director);
  const directorDraw = director ? personMomentumScore(director) : 0;
  const effectiveMinimum = computeEffectiveMinimumSalary(person, career.minimumSalary, prestigeSignal, directorDraw);

  const factors: ActorAppealFactors = {
    suitability: computeActorCharacterCompatibility(person, character) ?? 50,
    brandFit: computeBrandFit(studio, lean),
    prestigeFit: computePrestigeFit(prestigeSignal, lean),
    salaryFit: computeSalaryFit(offeredSalary, effectiveMinimum, career.typicalSalary),
    attachmentMomentum: computeAttachmentMomentum(currentTalent),
  };

  // brandFit + prestigeFit, not each weighted separately - see WEIGHTS' own
  // comment on why that pair is one blended signal, not two independent ones.
  const reputationFit = factors.brandFit + factors.prestigeFit;
  const overall =
    factors.suitability * WEIGHTS.suitability +
    reputationFit * WEIGHTS.reputationFit +
    factors.salaryFit * WEIGHTS.salaryFit +
    factors.attachmentMomentum * WEIGHTS.attachmentMomentum;

  return {
    ...factors,
    overall: clamp(overall, 0, 100),
    schedule: computeScheduleAssessment(person, plannedStartDay),
    belowSalaryFloor: offeredSalary < effectiveMinimum,
  };
}

// --- Accept/decline (docs/DESIGN_REVIEW_casting_redesign.md section 5),
// applied to both Direct Approach and an Open Casting "Cast" click alike -
// applicants aren't automatically willing. A deliberately deterministic
// threshold comparison, not a dice roll - `overall` is already a real,
// legible number the player can see and manage (Suitability/Fame/salary
// cards, describeApplicantInterest), so "did it clear the bar" reads as a
// consequence of decisions already visible on screen rather than one more
// hidden probability.

/** Which factor to blame - the single lowest-scoring one among suitability/reputation/salary, whichever of the three wasn't already the reason via a hard gate (schedule/below-floor salary are resolved in resolveOfferResponse before this is ever called). brandFit/prestigeFit collapse into one combined reputationFit reading, matching how `overall` itself blends them - using Math.max here instead would let a balanced actor (moderate on both, low on neither) get falsely blamed on reputation. */
export type OfferRejectionReason = 'suitability' | 'brand-prestige-mismatch' | 'salary' | 'schedule';

export type OfferResponse = { status: 'accepted' } | { status: 'rejected'; reason: OfferRejectionReason };

function offerRejectionReason(factors: ActorAppealFactors, reputationFit: number): OfferRejectionReason {
  const candidates: Array<[OfferRejectionReason, number]> = [
    ['suitability', factors.suitability],
    ['brand-prestige-mismatch', reputationFit],
    ['salary', factors.salaryFit],
  ];
  return candidates.reduce((worst, candidate) => (candidate[1] < worst[1] ? candidate : worst))[0];
}

// First-draft, tunable - a bigger star (higher fame/heat) or a bigger
// ego/ambition all plausibly raise how much it takes to land them,
// independent of how well the role itself actually suits them. No longer
// widened by rejectionCount/daysOpen (Casting Appeal Rework) - a rejection
// from one studio shouldn't quietly soften this actor's bar for every other
// studio too; anti-softlock relief now lives entirely in
// engine/castingCalls.ts's applicant-pool weighting instead.
const BASE_ACCEPTANCE_THRESHOLD = 45;
const MAX_SELECTIVENESS_BONUS = 25;
const MIN_ACCEPTANCE_THRESHOLD = 15;

/** How choosy this specific person reads, purely from who they are - fame and current heat (how hot they are *right now*) alongside ego/ambition, not just fame/ego as before. Exported for engine/directorAppeal.ts to reuse the identical read. */
export function computeSelectiveness(person: Person): number {
  return (person.reputation.fame + person.reputation.currentHeat + person.personality.ego + person.personality.ambition) / 4;
}

export function computeAcceptanceThreshold(person: Person): number {
  const selectiveness = computeSelectiveness(person);
  return clamp(BASE_ACCEPTANCE_THRESHOLD + (selectiveness / 100) * MAX_SELECTIVENESS_BONUS, MIN_ACCEPTANCE_THRESHOLD, 100);
}

/**
 * Resolves one offer - Direct Approach or an Open Casting "Cast" click
 * alike. Ordering matters (Casting Appeal Rework): schedule and the salary
 * floor are hard gates, checked before `overall` is ever compared against a
 * threshold, so neither can be outvoted by a strong suitability/reputation
 * score the way they used to be as small weighted terms.
 */
export function resolveOfferResponse(appeal: ActorAppealResult, person: Person): OfferResponse {
  if (appeal.schedule.status !== 'available') return { status: 'rejected', reason: 'schedule' };
  if (appeal.belowSalaryFloor) return { status: 'rejected', reason: 'salary' };
  const threshold = computeAcceptanceThreshold(person);
  if (appeal.overall >= threshold) return { status: 'accepted' };
  const reputationFit = appeal.brandFit + appeal.prestigeFit;
  return { status: 'rejected', reason: offerRejectionReason(appeal, reputationFit) };
}
