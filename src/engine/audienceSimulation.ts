// Milestone 1 of the audience-based box office redesign (docs/DESIGN.md
// 5.34) - domain types, construction and validation only. This module is
// deliberately isolated: nothing here is imported by the live game yet
// (state/studioReducer.ts still runs engine/boxOffice.ts's Opening
// Weekend/Legs model unchanged), and this module imports nothing from the
// live game either - it depends on plain numbers, not on Film/FilmResults/
// ReleaseType types, so it can be built and tested completely on its own.
// The weekly simulation step (how AwareCount/InterestedRemaining/
// CumulativeTicketsSold actually move week to week) is equations work,
// explicitly out of scope until that's designed - see "What deliberately
// isn't decided yet" in DESIGN.md 5.34.
//
// Three kinds of value live in this file, and the split is the entire
// point of this design (DESIGN.md 5.34):
//   1. Fixed release-time state (AudienceSimulationFixedState) - computed
//      once, never recomputed.
//   2. Evolving weekly state (AudienceSimulationWeekState) - the only
//      things that change once a run is underway, and only three fields.
//   3. Derived observations (deriveWeeklyAdmissions, deriveWordOfMouthActivity
//      below) - computed on demand from the weekly history, never stored.
// Nothing resembling Momentum, AudienceReactionScore or a stored "recent
// viewership pulse" exists anywhere in this file - see the design doc for
// why each of those was rejected as stored state during design.

/** Every field here is a plain finite number - a validation failure throws, it never produces NaN/Infinity in the wild. */
function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`AudienceSimulation: ${name} must be a finite number, got ${value}`);
  }
}

function assertNonNegative(value: number, name: string): void {
  assertFinite(value, name);
  if (value < 0) {
    throw new Error(`AudienceSimulation: ${name} must be >= 0, got ${value}`);
  }
}

/** 0-1 inclusive - every probability/fraction in this model is normalized to this range, never a raw percentage. */
function assertUnitInterval(value: number, name: string): void {
  assertFinite(value, name);
  if (value < 0 || value > 1) {
    throw new Error(`AudienceSimulation: ${name} must be between 0 and 1 inclusive, got ${value}`);
  }
}

/** 0-100 inclusive - matches FilmResults.criticScore/audienceScore's existing convention (engine/scoring.ts), reused verbatim rather than renormalized. */
function assertScoreRange(value: number, name: string): void {
  assertFinite(value, name);
  if (value < 0 || value > 100) {
    throw new Error(`AudienceSimulation: ${name} must be between 0 and 100 inclusive, got ${value}`);
  }
}

/**
 * Everything about a film's audience potential that's known at release and
 * never changes afterward - the same release-day-knowable moment
 * engine/releaseFilm.ts:computeReleaseResults already computes from
 * (script, cast, genre, marketing/release choices). This module doesn't
 * import those source types - callers are responsible for turning
 * Marketability/Originality/Release Type/etc. into these plain numbers
 * (that translation is itself equations work, not yet designed - see
 * DESIGN.md 5.34's "Where each existing lever enters the system" table for
 * the intended mapping once it exists).
 */
export interface AudienceSimulationFixedState {
  /** Everyone who could conceivably see a film like this - a headcount, not a dollar figure. Population EXPECTATION value (a continuous approximation of a discrete count), not required to be an integer, the same way real diffusion models treat population sizes. */
  totalAddressableAudience: number;
  /** Of totalAddressableAudience, what fraction has genuine taste-fit for this specific film - sizes the initial Interested pool. */
  baseInterestFraction: number;
  /** How efficiently marketing spend converts into Awareness - pitch clarity, not pool size. */
  marketingEfficiency: number;
  /** The ceiling on how far Interest can expand beyond baseInterestFraction via word of mouth, as an additional fraction of totalAddressableAudience. */
  crossoverCapacityFraction: number;
  /** Baseline weekly probability that an interested-but-unconverted person attends this particular week, before any word-of-mouth urgency modulation. */
  conversionPacingBaseline: number;
  /** Fraction of the currently-unaware population that becomes aware each week from non-word-of-mouth sources (residual marketing tail, organic press, incidental discovery) - applied every week, including week 1, since this isolated module doesn't yet model a Release-Type-driven initial marketing burst (see engine/audienceSimulationStep.ts and DESIGN.md 5.34 Milestone 2). */
  externalWeeklyAwarenessRate: number;
  /** Reused from FilmResults.criticScore (engine/scoring.ts), not duplicated - same 0-100 meaning. */
  criticScore: number;
  /** Reused from FilmResults.audienceScore (engine/scoring.ts), not duplicated - same 0-100 meaning. */
  audienceScore: number;
}

/**
 * Validating factory - every field is checked, invalid input throws rather
 * than silently producing a simulation that could go negative or exceed
 * its own bounds later. `crossoverCapacityFraction` is checked against
 * `1 - baseInterestFraction` too: the two together describe how much of
 * the addressable audience could ever be interested (base + expansion),
 * which can't exceed the whole population.
 */
export function createAudienceSimulationFixedState(input: AudienceSimulationFixedState): AudienceSimulationFixedState {
  assertNonNegative(input.totalAddressableAudience, 'totalAddressableAudience');
  if (input.totalAddressableAudience === 0) {
    throw new Error('AudienceSimulation: totalAddressableAudience must be > 0 - a film with no possible audience cannot be simulated');
  }
  assertUnitInterval(input.baseInterestFraction, 'baseInterestFraction');
  assertUnitInterval(input.marketingEfficiency, 'marketingEfficiency');
  assertUnitInterval(input.crossoverCapacityFraction, 'crossoverCapacityFraction');
  assertUnitInterval(input.conversionPacingBaseline, 'conversionPacingBaseline');
  assertUnitInterval(input.externalWeeklyAwarenessRate, 'externalWeeklyAwarenessRate');
  assertScoreRange(input.criticScore, 'criticScore');
  assertScoreRange(input.audienceScore, 'audienceScore');
  if (input.baseInterestFraction + input.crossoverCapacityFraction > 1) {
    throw new Error(
      'AudienceSimulation: baseInterestFraction + crossoverCapacityFraction must not exceed 1 - the base pool plus its maximum crossover expansion cannot exceed the whole addressable audience',
    );
  }
  return { ...input };
}

/** The absolute ceiling InterestedRemaining can ever reach for a given fixed state - base pool plus fully-realized crossover, both as a share of totalAddressableAudience. */
export function maxInterestedAudience(fixed: AudienceSimulationFixedState): number {
  return (fixed.baseInterestFraction + fixed.crossoverCapacityFraction) * fixed.totalAddressableAudience;
}

/**
 * The only three things that change once a run is underway (DESIGN.md
 * 5.34's "Evolving weekly state") - deliberately nothing else. No
 * Momentum, no stored word-of-mouth pulse - see deriveWordOfMouthActivity
 * below for why that's derived instead of tracked.
 */
export interface AudienceSimulationWeekState {
  /** 1-indexed - week 1 is always the release week. */
  week: number;
  /** Cumulative people who know the film exists. Monotonically non-decreasing across a run, enforced across consecutive weeks by createNextWeekState, not by this type alone. */
  awareCount: number;
  /** Aware, interested (including any realized crossover), hasn't bought a ticket yet. */
  interestedRemaining: number;
  /** Running total tickets sold - the only quantity money is ever derived from, and only outside this module. Repeat viewing isn't modeled (out of scope for this milestone), so this is also the count of distinct people who've seen the film. */
  cumulativeTicketsSold: number;
}

/**
 * Validating factory for a single week's state. Checked against the fixed
 * state it belongs to, not just its own internal shape - awareCount can't
 * exceed totalAddressableAudience, interestedRemaining can't exceed either
 * awareCount (can't be interested-and-unconverted without being aware) or
 * this film's maxInterestedAudience ceiling, and cumulativeTicketsSold
 * can't exceed totalAddressableAudience (no repeat viewing yet - see
 * module header).
 */
export function createAudienceSimulationWeekState(
  fixed: AudienceSimulationFixedState,
  input: AudienceSimulationWeekState,
): AudienceSimulationWeekState {
  if (!Number.isInteger(input.week) || input.week < 1) {
    throw new Error(`AudienceSimulation: week must be a positive integer, got ${input.week}`);
  }
  assertNonNegative(input.awareCount, 'awareCount');
  assertNonNegative(input.interestedRemaining, 'interestedRemaining');
  assertNonNegative(input.cumulativeTicketsSold, 'cumulativeTicketsSold');

  if (input.awareCount > fixed.totalAddressableAudience) {
    throw new Error('AudienceSimulation: awareCount cannot exceed totalAddressableAudience');
  }
  if (input.interestedRemaining > input.awareCount) {
    throw new Error('AudienceSimulation: interestedRemaining cannot exceed awareCount - someone can\'t be interested-and-unconverted without already being aware');
  }
  const ceiling = maxInterestedAudience(fixed);
  if (input.interestedRemaining > ceiling) {
    throw new Error(`AudienceSimulation: interestedRemaining (${input.interestedRemaining}) cannot exceed this film's maximum possible interested audience (${ceiling})`);
  }
  if (input.cumulativeTicketsSold > fixed.totalAddressableAudience) {
    throw new Error('AudienceSimulation: cumulativeTicketsSold cannot exceed totalAddressableAudience - repeat viewing is not modeled yet');
  }

  return { ...input };
}

/**
 * A complete run: the fixed state plus its weekly history in chronological
 * order. The history is the single source of truth for anything derived
 * from "what's happened so far" (see deriveWordOfMouthActivity) - nothing
 * is ever cached alongside it.
 */
export interface AudienceSimulationRun {
  fixed: AudienceSimulationFixedState;
  /** Chronological, weeks[0] is week 1. */
  weeks: AudienceSimulationWeekState[];
}

/**
 * Validates a full run: the fixed state, every week against it, and the
 * cross-week invariants a single week's own validation can't see -
 * sequential week numbers starting at 1, and awareCount/cumulativeTicketsSold
 * both monotonically non-decreasing (interestedRemaining is deliberately
 * NOT required to be monotonic - it shrinks as people convert and grows
 * via crossover, both are legitimate).
 */
export function createAudienceSimulationRun(fixed: AudienceSimulationFixedState, weeks: AudienceSimulationWeekState[]): AudienceSimulationRun {
  const validatedFixed = createAudienceSimulationFixedState(fixed);
  const validatedWeeks = weeks.map((w) => createAudienceSimulationWeekState(validatedFixed, w));

  for (let i = 0; i < validatedWeeks.length; i++) {
    if (validatedWeeks[i].week !== i + 1) {
      throw new Error(`AudienceSimulation: weeks must be sequential starting at 1 - expected week ${i + 1}, got ${validatedWeeks[i].week}`);
    }
    if (i > 0) {
      if (validatedWeeks[i].awareCount < validatedWeeks[i - 1].awareCount) {
        throw new Error(`AudienceSimulation: awareCount must not decrease week to week (week ${i + 1})`);
      }
      if (validatedWeeks[i].cumulativeTicketsSold < validatedWeeks[i - 1].cumulativeTicketsSold) {
        throw new Error(`AudienceSimulation: cumulativeTicketsSold must not decrease week to week (week ${i + 1})`);
      }
    }
  }

  return { fixed: validatedFixed, weeks: validatedWeeks };
}

/**
 * This week's new admissions - the source of truth is cumulativeTicketsSold
 * (already stored, needed for reporting regardless), so a single week's
 * "new viewers" figure is always a derived difference, never its own
 * stored field.
 */
export function deriveWeeklyAdmissions(weeks: AudienceSimulationWeekState[], weekIndex: number): number {
  if (weekIndex < 0 || weekIndex >= weeks.length) {
    throw new Error(`AudienceSimulation: weekIndex ${weekIndex} is out of range for a ${weeks.length}-week history`);
  }
  const previous = weekIndex > 0 ? weeks[weekIndex - 1].cumulativeTicketsSold : 0;
  return weeks[weekIndex].cumulativeTicketsSold - previous;
}

// Placeholder recency weights - week-just-passed first, tapering to
// negligible by ~5 weeks back, matching the shape discussed in design (not
// yet tuned; the actual curve is equations work for a later milestone).
// Deliberately a plain array here rather than a formula, so it's obvious
// at a glance that these specific numbers are provisional.
const WOM_LOOKBACK_WEIGHTS = [1, 0.7, 0.4, 0.2, 0.05];

/**
 * "How large and how recent is the pool of people currently talking about
 * this film" - a recency-weighted sum over admissions from the trailing
 * weeks before `asOfWeekIndex`, computed fresh from the already-stored
 * weekly history every time it's needed. This is the piece that used to
 * be a stored `RecentViewershipPulse` in an earlier design draft - it's a
 * derived observation instead (DESIGN.md 5.34), because a value computed
 * from the authoritative weekly record can never drift from what that
 * record actually implies, the same reasoning that removed Momentum.
 *
 * Returns a raw weighted admissions count, not yet normalized to 0-1 or
 * combined with reception quality (WordOfMouthStrength, a separate,
 * not-yet-built function - see module header) - purely "how many recent
 * viewers," independent of whether they loved or hated it.
 */
export function deriveWordOfMouthActivity(weeks: AudienceSimulationWeekState[], asOfWeekIndex: number): number {
  if (asOfWeekIndex < 0 || asOfWeekIndex > weeks.length) {
    throw new Error(`AudienceSimulation: asOfWeekIndex ${asOfWeekIndex} is out of range for a ${weeks.length}-week history`);
  }
  let activity = 0;
  for (let lookback = 0; lookback < WOM_LOOKBACK_WEIGHTS.length; lookback++) {
    const weekIndex = asOfWeekIndex - 1 - lookback;
    if (weekIndex < 0) break;
    activity += deriveWeeklyAdmissions(weeks, weekIndex) * WOM_LOOKBACK_WEIGHTS[lookback];
  }
  return activity;
}
