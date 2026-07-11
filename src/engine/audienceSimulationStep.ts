// Milestone 2 of the audience-based box office redesign (docs/DESIGN.md
// 5.34) - the pure weekly transition itself. Builds on the domain types
// from engine/audienceSimulation.ts (Milestone 1) but is kept in its own
// file: that module is "types and validation," this one is "the
// algorithm." Still fully isolated - no import from Film/Studio/ReleaseType
// or the live game, no randomness, no wiring into state/studioReducer.ts.
// engine/boxOffice.ts's Opening Weekend/Legs model is untouched and still
// what a real game session runs.
//
// The weekly lifecycle, as small named pure functions rather than one
// opaque calculation (numbered to match the design conversation):
//   1. applyExternalAwarenessGrowth
//   2. convertNewAwarenessToBaseInterest
//   3. computeCurrentWomInfluence (wraps deriveWordOfMouthActivity)
//   4. applyWomAwarenessGrowth
//   5. deriveWomNaturalInterestGrowth
//   6. deriveWomCrossoverExpansion
//   7. getBaselineAttendanceProbability
//   8. applyWomPullForward
//   9. sellTicketsThisWeek
//   10. advanceOneWeek assembles 1-9 into the next AudienceSimulationWeekState
//   11. hasSimulationEnded / advanceToWeek
//
// Word of mouth has three distinguishable effects (spreading awareness,
// creating new interest, pulling existing interest forward - DESIGN.md
// 5.34), each gated at a different sensitivity/threshold against the same
// underlying `womInfluence` signal (see WOM_RESPONSE_CURVES below) -
// "new interest" further splits into natural-audience growth (step 5) and
// exceptional crossover expansion beyond it (step 6), both still "new
// interest," differing only in which ceiling they're allowed to approach
// and how strong an influence they need to contribute anything at all.
//
// All threshold/sensitivity/lookback constants below are explicitly
// provisional placeholders, exactly like WOM_LOOKBACK_WEIGHTS in
// engine/audienceSimulation.ts - the real values are equations work for a
// later milestone. What's being proven here is the *shape* of the
// simulation, not tuned numbers.

import {
  createAudienceSimulationWeekState,
  deriveWeeklyAdmissions,
  deriveWordOfMouthActivity,
  maxInterestedAudience,
  type AudienceSimulationFixedState,
  type AudienceSimulationWeekState,
} from './audienceSimulation';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const WEEK_ZERO: AudienceSimulationWeekState = { week: 0, awareCount: 0, interestedRemaining: 0, cumulativeTicketsSold: 0 };

/** Step 1: a constant fraction of the still-unaware population becomes aware from non-word-of-mouth sources every week, including week 1 - see AudienceSimulationFixedState.externalWeeklyAwarenessRate. */
export function applyExternalAwarenessGrowth(fixed: AudienceSimulationFixedState, awareCount: number): number {
  const unaware = Math.max(0, fixed.totalAddressableAudience - awareCount);
  return awareCount + unaware * fixed.externalWeeklyAwarenessRate;
}

/** Step 2: of a batch of newly-aware people, the fraction with genuine natural fit (baseInterestFraction) become interested immediately - bounded by whatever natural-audience headroom is actually left. */
export function convertNewAwarenessToBaseInterest(fixed: AudienceSimulationFixedState, newlyAwareCount: number, totalEverInterested: number): number {
  const naturalCeiling = fixed.baseInterestFraction * fixed.totalAddressableAudience;
  const headroom = Math.max(0, naturalCeiling - totalEverInterested);
  return Math.min(Math.max(0, newlyAwareCount) * fixed.baseInterestFraction, headroom);
}

// Provisional response shape shared by all four word-of-mouth effects -
// zero below its own threshold, then grows convexly (squared) beyond it,
// clamped to [0,1]. Convex, not linear, for the same reason Buzz ->
// Opening Weekend is (engine/boxOffice.ts): most films should produce an
// ordinary response, only a genuinely strong influence should produce a
// disproportionate one.
function thresholdResponse(womInfluence: number, threshold: number, sensitivity: number): number {
  const excess = Math.max(0, womInfluence - threshold);
  return clamp(excess * excess * sensitivity, 0, 1);
}

// Each of word of mouth's three (four, counting the natural/crossover
// split) effects gets its own threshold and sensitivity against the same
// underlying influence signal - ordered lowest to highest bar, matching
// "ordinary reactions clear the first, only exceptional reactions clear
// the last" (DESIGN.md 5.34). Though computeCurrentWomInfluence is
// mathematically bounded by [0,1], a recency-weighted slice of admissions
// (deriveWordOfMouthActivity, summing to ~2.35x one week's admissions at
// most) over a whole-run ceiling realistically only ever reaches into the
// low hundredths even for an exceptional run - these thresholds/
// sensitivities are calibrated against that actual achievable range, not
// against [0,1] itself.
const AWARENESS_RESPONSE = { threshold: 0.0, sensitivity: 8000 };
const NATURAL_INTEREST_RESPONSE = { threshold: 0.003, sensitivity: 700 };
const PULL_FORWARD_RESPONSE = { threshold: 0.005, sensitivity: 500 };
const CROSSOVER_RESPONSE = { threshold: 0.008, sensitivity: 3000 };

// Reception -> a 0-1 multiplier on word-of-mouth influence, convex in the
// same spirit, with a small nonzero floor (organic chatter never reaches
// literally zero, even for a badly-received film) - mirrors
// engine/boxOffice.ts's HYPE_FLOOR treatment of Buzz.
const RECEPTION_FLOOR = 0.01;
const AUDIENCE_SCORE_WEIGHT = 0.7;
const CRITIC_SCORE_WEIGHT = 0.3;

/** How much a given reception (critic/audience score, reused verbatim from FilmResults - see AudienceSimulationFixedState) amplifies word of mouth - convex, audience-weighted over critic. */
export function computeReceptionResponseMultiplier(fixed: AudienceSimulationFixedState): number {
  const weighted = (fixed.audienceScore * AUDIENCE_SCORE_WEIGHT + fixed.criticScore * CRITIC_SCORE_WEIGHT) / 100;
  return RECEPTION_FLOOR + (1 - RECEPTION_FLOOR) * weighted * weighted;
}

/** Step 3: "current WOM influence" - recent-admissions activity (Milestone 1's deriveWordOfMouthActivity, recomputed from the stored weekly history, never its own stored field) scaled by how well the film was actually received. Normalized against maxInterestedAudience (the realistic ceiling of people who could ever be interested), not totalAddressableAudience - measuring "how much of the reachable audience is currently talking about this" against the whole population would dilute the signal to near-nothing for any film with a narrow natural fit, making crossover structurally unreachable regardless of reception. Always in [0,1]. */
export function computeCurrentWomInfluence(fixed: AudienceSimulationFixedState, weeks: AudienceSimulationWeekState[], asOfWeekIndex: number): number {
  const activityFraction = clamp(deriveWordOfMouthActivity(weeks, asOfWeekIndex) / maxInterestedAudience(fixed), 0, 1);
  return activityFraction * computeReceptionResponseMultiplier(fixed);
}

/** Step 4: word of mouth spreading awareness - the lowest bar of the three effects, so nearly every released film clears it to some degree. */
export function applyWomAwarenessGrowth(fixed: AudienceSimulationFixedState, awareCount: number, womInfluence: number): number {
  const unaware = Math.max(0, fixed.totalAddressableAudience - awareCount);
  const growthFraction = thresholdResponse(womInfluence, AWARENESS_RESPONSE.threshold, AWARENESS_RESPONSE.sensitivity);
  return awareCount + unaware * growthFraction;
}

/** Step 5: word of mouth convincing aware-but-not-yet-interested people who fit the film's natural audience - bounded by natural-audience headroom (baseInterestFraction) and by how many aware people are actually left to convince. */
export function deriveWomNaturalInterestGrowth(
  fixed: AudienceSimulationFixedState,
  awareCount: number,
  totalEverInterested: number,
  womInfluence: number,
): number {
  const naturalCeiling = fixed.baseInterestFraction * fixed.totalAddressableAudience;
  const headroom = Math.max(0, naturalCeiling - totalEverInterested);
  const awareNotYetInterested = Math.max(0, awareCount - totalEverInterested);
  const growthFraction = thresholdResponse(womInfluence, NATURAL_INTEREST_RESPONSE.threshold, NATURAL_INTEREST_RESPONSE.sensitivity);
  return Math.min(headroom, awareNotYetInterested) * growthFraction;
}

/**
 * Step 6: exceptional word of mouth reaching people outside the film's
 * natural audience entirely - the highest bar of the three effects.
 * Bounded by the *total* ceiling (natural + crossover capacity - see
 * maxInterestedAudience), so a film with zero crossoverCapacityFraction
 * gets zero headroom here regardless of how strong womInfluence is
 * (capacity, not just influence, gates this - DESIGN.md 5.34's "Originality
 * creates the capacity... audience reaction determines whether that
 * potential is actually realized").
 */
export function deriveWomCrossoverExpansion(
  fixed: AudienceSimulationFixedState,
  awareCount: number,
  totalEverInterested: number,
  womInfluence: number,
): number {
  const totalCeiling = maxInterestedAudience(fixed);
  const headroom = Math.max(0, totalCeiling - totalEverInterested);
  const awareNotYetInterested = Math.max(0, awareCount - totalEverInterested);
  const growthFraction = thresholdResponse(womInfluence, CROSSOVER_RESPONSE.threshold, CROSSOVER_RESPONSE.sensitivity);
  return Math.min(headroom, awareNotYetInterested) * growthFraction;
}

/** Step 7: the baseline weekly attendance probability is just AudienceSimulationFixedState.conversionPacingBaseline - a plain lookup, kept as its own named step because it's a conceptually separate input from the word-of-mouth modulation applied on top of it in step 8. Ordinary decline/growth is never modeled by this baseline shrinking over time - see module header and DESIGN.md 5.34: decay/growth emerge from the interested pool's own size changing, not from this probability decaying. */
export function getBaselineAttendanceProbability(fixed: AudienceSimulationFixedState): number {
  return fixed.conversionPacingBaseline;
}

/** Step 8: word of mouth pulling already-interested people forward in time - boosts this week's attendance probability for the whole remaining interested pool, whether their interest is old or newly formed this week. Needs a moderately strong influence to matter (DESIGN.md 5.34: "needs a genuinely good reaction, not just an average one"). */
export function applyWomPullForward(baselineProbability: number, womInfluence: number): number {
  const urgencyBoost = thresholdResponse(womInfluence, PULL_FORWARD_RESPONSE.threshold, PULL_FORWARD_RESPONSE.sensitivity);
  return clamp(baselineProbability + urgencyBoost * (1 - baselineProbability), 0, 1);
}

/** Step 9: tickets sold this week - the interested-and-unconverted pool times this week's (WOM-boosted) attendance probability. Since attendanceProbability is always in [0,1], this can never exceed interestedRemaining - selling more tickets than there are interested people left is structurally impossible, not just guarded against. */
export function sellTicketsThisWeek(interestedRemaining: number, attendanceProbability: number): number {
  return interestedRemaining * clamp(attendanceProbability, 0, 1);
}

/**
 * Step 10: composes steps 1-9 into the next week's state. Takes the whole
 * history (not just the last week) because step 3 needs it for the
 * recency-weighted lookback. `weeks` may be empty - a fresh run's week 1
 * is produced by applying this exact same transition to WEEK_ZERO, no
 * special-cased "seed the run" logic (see module header).
 */
export function advanceOneWeek(fixed: AudienceSimulationFixedState, weeks: AudienceSimulationWeekState[]): AudienceSimulationWeekState {
  const priorWeek = weeks.length > 0 ? weeks[weeks.length - 1] : WEEK_ZERO;
  const nextWeekNumber = priorWeek.week + 1;
  let totalEverInterested = priorWeek.interestedRemaining + priorWeek.cumulativeTicketsSold;

  // Step 1 + 2: external awareness growth, and the natural-fit slice of it converting to interest immediately.
  const awareAfterExternal = applyExternalAwarenessGrowth(fixed, priorWeek.awareCount);
  const newlyAwareExternal = awareAfterExternal - priorWeek.awareCount;
  const deltaInterestExternal = convertNewAwarenessToBaseInterest(fixed, newlyAwareExternal, totalEverInterested);
  totalEverInterested += deltaInterestExternal;

  // Step 3: derive this week's word-of-mouth influence from history already settled (not including this week, which hasn't happened yet).
  const womInfluence = computeCurrentWomInfluence(fixed, weeks, weeks.length);

  // Step 4: word of mouth spreads awareness further.
  const awareCount = applyWomAwarenessGrowth(fixed, awareAfterExternal, womInfluence);

  // Step 5: word of mouth convinces aware-but-undecided people within the natural audience.
  const deltaInterestNatural = deriveWomNaturalInterestGrowth(fixed, awareCount, totalEverInterested, womInfluence);
  totalEverInterested += deltaInterestNatural;

  // Step 6: exceptional word of mouth reaches beyond the natural audience.
  const deltaInterestCrossover = deriveWomCrossoverExpansion(fixed, awareCount, totalEverInterested, womInfluence);
  totalEverInterested += deltaInterestCrossover;

  const interestedBeforeSales = priorWeek.interestedRemaining + deltaInterestExternal + deltaInterestNatural + deltaInterestCrossover;

  // Step 7 + 8: baseline attendance probability, pulled forward by word of mouth's urgency effect.
  const attendanceProbability = applyWomPullForward(getBaselineAttendanceProbability(fixed), womInfluence);

  // Step 9: sell tickets from the interested-and-unconverted pool.
  const ticketsThisWeek = sellTicketsThisWeek(interestedBeforeSales, attendanceProbability);

  // Defensive final clamp - the step-by-step headroom bounding above should
  // already guarantee these never exceed their ceilings, but floating-point
  // accumulation across many weeks is cheap insurance against a validation
  // throw over an epsilon-scale rounding error.
  const ceiling = maxInterestedAudience(fixed);
  const clampedAwareCount = clamp(awareCount, 0, fixed.totalAddressableAudience);
  const interestedRemaining = clamp(interestedBeforeSales - ticketsThisWeek, 0, Math.min(clampedAwareCount, ceiling));
  const cumulativeTicketsSold = clamp(priorWeek.cumulativeTicketsSold + ticketsThisWeek, 0, fixed.totalAddressableAudience);

  return createAudienceSimulationWeekState(fixed, {
    week: nextWeekNumber,
    awareCount: clampedAwareCount,
    interestedRemaining,
    cumulativeTicketsSold,
  });
}

// Step 11 constants - independently defined here rather than imported from
// engine/boxOffice.ts (MAX_WEEKS/MIN_WEEKLY_GROSS_RATIO), to keep this
// module's isolation from the live game total (Milestone 1's own
// principle) - chosen to match that model's existing cutoff philosophy,
// not because the numbers must be identical.
export const MAX_SIMULATION_WEEKS = 20;
const MIN_WEEKLY_ADMISSIONS_RATIO = 0.02;

/**
 * Step 11: the stopping rule. A hard cap (MAX_SIMULATION_WEEKS) always
 * applies regardless of how slowly a run is decaying - the same backstop
 * engine/boxOffice.ts's MAX_WEEKS provides for the live model. Below that,
 * a run ends once its most recent week's admissions have fallen to a
 * trickle relative to its opening week - mirrors MIN_WEEKLY_GROSS_RATIO's
 * role, just measured in admissions instead of gross.
 */
export function hasSimulationEnded(weeks: AudienceSimulationWeekState[]): boolean {
  if (weeks.length === 0) return false;
  if (weeks.length >= MAX_SIMULATION_WEEKS) return true;
  const openingAdmissions = deriveWeeklyAdmissions(weeks, 0);
  if (openingAdmissions <= 0) return true;
  const latestAdmissions = deriveWeeklyAdmissions(weeks, weeks.length - 1);
  return latestAdmissions < openingAdmissions * MIN_WEEKLY_ADMISSIONS_RATIO;
}

/**
 * Catches a run up to `targetWeekNumber` (or until the stopping rule ends
 * it first) by repeatedly calling advanceOneWeek - deliberately the *only*
 * way multiple weeks ever get computed, so a big catch-up (e.g. a 45-day
 * calendar jump, once this is wired into state/studioReducer.ts the way
 * engine/boxOfficeRun.ts:settleBoxOfficeForAllFilms already catches up
 * multiple weeks in one call) can never diverge from calling advanceOneWeek
 * one week at a time - there's only one implementation of "what happens in
 * a week," not two that could drift apart.
 */
export function advanceToWeek(
  fixed: AudienceSimulationFixedState,
  weeks: AudienceSimulationWeekState[],
  targetWeekNumber: number,
): AudienceSimulationWeekState[] {
  let result = weeks;
  while (result.length < targetWeekNumber && !hasSimulationEnded(result)) {
    result = [...result, advanceOneWeek(fixed, result)];
  }
  return result;
}
