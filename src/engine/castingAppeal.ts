// Casting Redesign, Phase B (docs/DESIGN_REVIEW_casting_redesign.md section
// 3) - "the one appeal function." A second, independent reading from
// engine/compatibility.ts's computeActorCharacterCompatibility (Suitability
// below reuses that directly, unchanged): that function asks "does this
// actor's craft suit this role," this one asks "would this actor actually
// want it" - fame, salary, schedule, and the studio's own reputation all
// factor in, Suitability is only one term among several. One function feeds
// Open Casting's applicant weighting (engine/castingCalls.ts), and will feed
// Direct Approach/Interested Talent's accept-or-decline rolls once Phase C
// adds them - never three divergent formulas for the three attachment
// paths (design review TL;DR).
import type { GameDay, Money, Person, Script, ScriptCharacter, Studio, TalentAssignment } from '../types';
import { computeActorCharacterCompatibility } from './compatibility';
import { computeScriptScore } from './scoring';
import { getActorCareer, deriveBookedUntil } from './person';
import { clamp } from './random';
import { WEEK_LENGTH_DAYS } from './opportunities';

export interface ActorAppealFactors {
  /** computeActorCharacterCompatibility - reused directly, unchanged. */
  suitability: number;
  /** studio.brand, weighted by this actor's own commercial lean. */
  brandFit: number;
  /** studio.prestige + script quality + director reputation, weighted by this actor's own prestige lean. */
  prestigeFit: number;
  /** Offered salary vs. this actor's own minimumSalary/typicalSalary. */
  salaryFit: number;
  /** How free this actor reads against the project's planned start, derived from their existing commitments. */
  scheduleFit: number;
  /** Derived fresh from whoever's already attached to *this* project (director + cast so far) - never stored, never decays. A major name signing raises this on the very next calculation for everyone else being considered, with no separate ticking bonus to track (design review section 3's own pushback on "production momentum" as a stored value). */
  attachmentMomentum: number;
}

// First-draft, tunable weights, like every other numeric constant in this
// simulation - sums to 1 so `overall` stays on the same 0-100 scale as its
// inputs.
const APPEAL_WEIGHTS: Record<keyof ActorAppealFactors, number> = {
  suitability: 0.3,
  brandFit: 0.15,
  prestigeFit: 0.15,
  salaryFit: 0.2,
  scheduleFit: 0.1,
  attachmentMomentum: 0.1,
};

/**
 * How much this actor personally leans toward valuing the studio's
 * Prestige over its Brand, 0 (fully commercial) to 1 (fully
 * prestige-minded) - derived from Person fields that already exist
 * (reputation.prestige, personality.ambition/ego) rather than a new stored
 * preference stat (design review section 3/4 - "no new actor values
 * taxonomy until this simple version proves insufficient"). High existing
 * critical standing reads as still caring about it; high ambition/ego
 * without matching prestige reads as hungrier for visibility and stardom
 * than for critical respect.
 */
function prestigeLean(person: Person): number {
  const commercialPull = (person.personality.ambition + person.personality.ego) / 2;
  const prestigePull = person.reputation.prestige;
  return clamp((prestigePull - commercialPull) / 200 + 0.5, 0, 1);
}

function computeBrandFit(studio: Studio, lean: number): number {
  return studio.brand * (1 - lean);
}

function computePrestigeFit(studio: Studio, script: Script, director: Person | undefined, lean: number): number {
  const scriptQuality = computeScriptScore(script);
  const directorReputation = director ? (director.reputation.prestige + director.reputation.industryRespect) / 2 : 50;
  const prestigeSignal = studio.prestige * 0.4 + scriptQuality * 0.3 + directorReputation * 0.3;
  return prestigeSignal * lean;
}

function computeSalaryFit(offeredSalary: Money, minimumSalary: Money, typicalSalary: Money): number {
  if (offeredSalary >= typicalSalary) return 100;
  if (offeredSalary <= minimumSalary || typicalSalary <= minimumSalary) return 0;
  return clamp(((offeredSalary - minimumSalary) / (typicalSalary - minimumSalary)) * 100, 0, 100);
}

// How many days of schedule overlap with the project's planned start before
// an actor's own commitments drag scheduleFit all the way to 0 - a
// first-draft, tunable ceiling, not a hard rule about real production
// scheduling.
const MAX_SCHEDULE_OVERLAP_DAYS = 180;

function computeScheduleFit(person: Person, plannedStartDay: GameDay): number {
  const bookedUntil = deriveBookedUntil(person.availability.commitments);
  if (!bookedUntil || bookedUntil <= plannedStartDay) return 100;
  const overlapDays = bookedUntil - plannedStartDay;
  return clamp(100 - (overlapDays / MAX_SCHEDULE_OVERLAP_DAYS) * 100, 0, 100);
}

function computeAttachmentMomentum(currentTalent: TalentAssignment[]): number {
  if (currentTalent.length === 0) return 0;
  const totalFame = currentTalent.reduce((sum, a) => sum + a.person.reputation.fame, 0);
  const totalPrestige = currentTalent.reduce((sum, a) => sum + a.person.reputation.prestige, 0);
  return (totalFame + totalPrestige) / (currentTalent.length * 2);
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
): (ActorAppealFactors & { overall: number }) | null {
  const career = getActorCareer(person);
  if (!career) return null;

  const lean = prestigeLean(person);
  const factors: ActorAppealFactors = {
    suitability: computeActorCharacterCompatibility(person, character) ?? 50,
    brandFit: computeBrandFit(studio, lean),
    prestigeFit: computePrestigeFit(studio, script, director, lean),
    salaryFit: computeSalaryFit(offeredSalary, career.minimumSalary, career.typicalSalary),
    scheduleFit: computeScheduleFit(person, plannedStartDay),
    attachmentMomentum: computeAttachmentMomentum(currentTalent),
  };

  const overall = (Object.keys(APPEAL_WEIGHTS) as Array<keyof ActorAppealFactors>).reduce(
    (sum, key) => sum + factors[key] * APPEAL_WEIGHTS[key],
    0,
  );

  return { ...factors, overall: clamp(overall, 0, 100) };
}

// --- Phase C - Direct Approach's accept/decline (docs/DESIGN_REVIEW_casting_redesign.md
// section 5), and the same resolution reused for an Open Casting "Cast"
// click now that applicants aren't automatically willing (section 13's
// phasing table: "applied to both Direct Approach *and* Open Casting
// applicants"). A deliberately deterministic threshold comparison, not a
// dice roll - `overall` is already a real, legible number the player can
// see and manage (Suitability/Fame/salary/schedule cards, describeApplicantInterest),
// so "did it clear the bar" reads as a consequence of decisions already
// visible on screen rather than one more hidden probability.

/** Which factor to blame - the single lowest-scoring one among the four an offer can actually act on. brandFit/prestigeFit collapse into one reading (whichever this actor's own lean actually weights - the other is already ~0 by construction and would otherwise unfairly dominate "why they said no"); attachmentMomentum isn't something an offer's own terms can move, so it's never the named reason. */
export type OfferRejectionReason = 'suitability' | 'brand-prestige-mismatch' | 'salary' | 'schedule';

export type OfferResponse = { status: 'accepted' } | { status: 'rejected'; reason: OfferRejectionReason };

function offerRejectionReason(factors: ActorAppealFactors): OfferRejectionReason {
  const reputationFit = Math.max(factors.brandFit, factors.prestigeFit);
  const candidates: Array<[OfferRejectionReason, number]> = [
    ['suitability', factors.suitability],
    ['brand-prestige-mismatch', reputationFit],
    ['salary', factors.salaryFit],
    ['schedule', factors.scheduleFit],
  ];
  return candidates.reduce((worst, candidate) => (candidate[1] < worst[1] ? candidate : worst))[0];
}

// First-draft, tunable - a bigger star (higher fame) or a bigger ego both
// plausibly raise how much it takes to land them, independent of how well
// the role itself actually suits them.
const BASE_ACCEPTANCE_THRESHOLD = 45;
const MAX_SELECTIVENESS_BONUS = 25;

// No-softlock widening (design review section 9) - every rejection this
// Character has accumulated, and every full week its call has stayed open,
// softens the bar a little further, capped so it never disappears entirely
// (a role should get easier to fill, not free). "Days open" reads as 0 for
// a Direct Approach with no call yet (findOrOpenCastingCall opens one the
// same day), so a first offer is never pre-widened.
const WIDENING_PER_REJECTION = 4;
const WIDENING_PER_WEEK_OPEN = 2;
const MAX_WIDENING = 30;
const MIN_ACCEPTANCE_THRESHOLD = 15;

export function computeAcceptanceThreshold(person: Person, rejectionCount: number, daysOpen: number): number {
  const selectiveness = (person.reputation.fame + person.personality.ego) / 2;
  const base = BASE_ACCEPTANCE_THRESHOLD + (selectiveness / 100) * MAX_SELECTIVENESS_BONUS;
  const widening = Math.min(
    MAX_WIDENING,
    rejectionCount * WIDENING_PER_REJECTION + Math.floor(Math.max(0, daysOpen) / WEEK_LENGTH_DAYS) * WIDENING_PER_WEEK_OPEN,
  );
  return clamp(base - widening, MIN_ACCEPTANCE_THRESHOLD, 100);
}

/** Resolves one offer - Direct Approach or an Open Casting "Cast" click alike - against this Character's own accumulated rejectionCount/daysOpen. */
export function resolveOfferResponse(
  appeal: ActorAppealFactors & { overall: number },
  person: Person,
  rejectionCount: number,
  daysOpen: number,
): OfferResponse {
  const threshold = computeAcceptanceThreshold(person, rejectionCount, daysOpen);
  if (appeal.overall >= threshold) return { status: 'accepted' };
  return { status: 'rejected', reason: offerRejectionReason(appeal) };
}
