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
//   0. applyReleaseDayAwarenessSeed (Milestone 3 - the one-time release-day lump, week 1 only)
//   1. applyExternalAwarenessGrowth
//   2. convertNewAwarenessToBaseInterest
//   3. computeCurrentWomInfluence (wraps deriveWordOfMouthActivity)
//   4. applyWomAwarenessGrowth
//   5. deriveWomNaturalInterestGrowth
//   6. deriveWomCrossoverExpansion
//   7. getBaselineAttendanceProbability
//   8. applyWomPullForward
//   9. sellTicketsThisWeek
//   10. advanceOneWeekWithDiagnostics assembles 0-9 into the next
//       AudienceSimulationWeekState *and* a WeekDiagnostics trace of every
//       intermediate value (Milestone 4, for the Outcome Inspector) - the
//       one true implementation; advanceOneWeek is a thin wrapper that
//       keeps its own pre-Milestone-4 signature
//   11. hasSimulationEnded / advanceToWeek / advanceToWeekWithDiagnostics
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

const WEEK_ZERO: AudienceSimulationWeekState = { week: 0, awareCount: 0, interestedRemaining: 0, cumulativeTicketsSold: 0, availabilityFraction: 0, cumulativeCrossoverRealized: 0 };

/** Step 0 (Milestone 3): the one-time release-day awareness lump (AudienceSimulationFixedState.initialAwareCount - Buzz, marketing spend, Release Type reach, see engine/audienceSimulationInputs.ts) lands only when week 1 is being computed (weeksLength === 0), never again on any later week - everything after that grows AwareCount only through step 1's ongoing trickle or word of mouth. Folded into awareCount *before* step 1 runs, so step 2's "newly aware this week" naturally includes the seed and converts its natural-fit slice into Interest, without a second, separate conversion formula. */
export function applyReleaseDayAwarenessSeed(fixed: AudienceSimulationFixedState, awareCount: number, weeksLength: number): number {
  if (weeksLength > 0) return awareCount;
  const unaware = Math.max(0, fixed.totalAddressableAudience - awareCount);
  return awareCount + Math.min(unaware, fixed.initialAwareCount);
}

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
// over a whole-run ceiling stays in the low hundredths for a *subdued*
// run - but this signal feeds a genuine positive feedback loop (higher
// admissions -> higher influence next week -> more awareness/interest ->
// higher admissions again), and a Milestone 3 diagnostic sweep across
// realistic release-scale inputs (engine/audienceSimulationInputs.ts,
// tens-of-millions addressable audiences, release-type-driven pacing)
// showed influence climbing past 0.3-0.7 once that loop actually takes
// off for a well-received film - a materially wider range than Milestone
// 2's own smaller-scale, subdued-pacing diagnostic ever produced. The
// sensitivities below were re-picked against *that* wider observed range
// (not the earlier, narrower one) specifically so a merely-decent
// reception doesn't instantly saturate every effect to 100% within a
// single week at realistic scale - still calibrated from an actual
// diagnostic sweep, never against the nominal [0,1] bound.
//
// NATURAL_INTEREST_RESPONSE and CROSSOVER_RESPONSE were halved again in
// the Quantum Signal incident fix (docs/DESIGN.md 5.34): even after the
// saturationDampening and pull-forward-scoping fixes below stopped any
// single week from consuming a huge slice of headroom at once, a
// "good-but-not-extraordinary" reception (~0.50 reception multiplier,
// nowhere near the floor) still sustained a growthFraction over 0.3 for
// 10+ *consecutive* weeks - the sensitivity was high enough that a
// merely-decent, self-sustaining activityFraction (not an exceptional
// one) was already most of the way to saturating the response. Given
// enough weeks, sustained-but-uncapped growthFraction asymptotically
// approaches its full headroom regardless of magnitude (that's what
// "asymptotic" means), so the real lever against "a merely good score
// generates phenomenon-level growth" (the user's own stated constraint)
// has to be how far up the reception scale growthFraction becomes
// non-trivial in the first place, not just how each single week is
// capped. Halving sensitivity pushes that inflection point further out,
// so ordinary-good reception now spends the whole run in the shallow
// part of the curve instead of the steep part.
const AWARENESS_RESPONSE = { threshold: 0.0, sensitivity: 300 };
const NATURAL_INTEREST_RESPONSE = { threshold: 0.003, sensitivity: 75 };
const PULL_FORWARD_RESPONSE = { threshold: 0.005, sensitivity: 100 };
const CROSSOVER_RESPONSE = { threshold: 0.0075, sensitivity: 100 };

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

/**
 * Step 5: word of mouth convincing aware-but-not-yet-interested people who
 * fit the film's natural audience - bounded by natural-audience headroom
 * (baseInterestFraction) and by how many aware people are actually left to
 * convince.
 *
 * `saturationDampening` (headroom as a *fraction* of the whole natural
 * ceiling, not just a hard cap) is load-bearing, not decorative - found
 * necessary after a real save produced a hyperbolic late-run explosion
 * (docs/DESIGN.md 5.34, "the Quantum Signal incident"). Step 4
 * (applyWomAwarenessGrowth) was always safe from this because its own
 * formula is `unaware * growthFraction` - headroom *is* the multiplicand,
 * so growth mechanically tapers to zero as awareCount approaches its
 * ceiling. This step's old formula, `Math.min(headroom, pool) *
 * growthFraction`, looks similar but isn't: once awareNotYetInterested
 * exceeds headroom (routine once awareness - which saturates fast - has
 * outpaced interest), `Math.min` degenerates into a flat cap with *no*
 * deceleration at all. At growthFraction near 1 (very achievable once the
 * positive feedback loop is running - see step 3's own docs), that
 * consumed the *entire* remaining headroom in a single week, however small
 * it had already shrunk to - a cliff, not a slope. Multiplying by
 * `headroom / naturalCeiling` restores the same self-dampening shape step
 * 4 already had: as headroom shrinks, the same influence produces a
 * shrinking absolute increment, approaching the ceiling asymptotically
 * instead of consuming whatever's left in one shot.
 */
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
  const saturationDampening = naturalCeiling > 0 ? headroom / naturalCeiling : 0;
  return Math.min(headroom, awareNotYetInterested) * growthFraction * saturationDampening;
}

/**
 * Step 6: exceptional word of mouth reaching people outside the film's
 * natural audience entirely - the highest bar of the three effects.
 * Bounded by crossover's *own* capacity ceiling
 * (crossoverCapacityFraction * totalAddressableAudience), so a film with
 * zero crossoverCapacityFraction gets zero headroom here regardless of how
 * strong womInfluence is (capacity, not just influence, gates this -
 * DESIGN.md 5.34's "the concept and its accessibility create the
 * capacity... audience reaction determines whether that potential is
 * actually realized"). `saturationDampening` exists for the exact same
 * reason step 5 needs it - see that function's docs (the "Quantum Signal
 * incident") - crossover is the effect with the most headroom to consume
 * in one shot once the tipping point is crossed, so it was the single
 * biggest contributor to the runaway blowup this fixes.
 *
 * Milestone 12 fix for a gap Milestone 10 left deliberately documented
 * rather than silently papered over: headroom here used to be bounded
 * against the *combined* natural+crossover ceiling (`maxInterestedAudience`),
 * using the same `totalEverInterested` running total steps 2/5 also draw
 * down - so a film's own `crossoverCapacityFraction` barely throttled
 * realized crossover whenever natural interest hadn't yet saturated its
 * own (typically much larger) ceiling, which is most of a run. A
 * diagnostic sweep confirmed the practical effect directly: swinging
 * crossoverCapacityFraction across its full realistic range (0.02-0.29,
 * via originality/spectacle/hookStrength) at fixed, merely-good reception
 * left legs and total gross essentially flat, and forcing capacity down to
 * its practical floor *still* let a film realize millions of crossover
 * admissions. `cumulativeCrossoverRealized` (AudienceSimulationWeekState,
 * new this milestone) fixes it at the source: crossover's headroom is now
 * checked against its *own* running total, completely independent of how
 * much natural-audience headroom happens to be left. `awareNotYetInterested`
 * still reads the *combined* `totalEverInterested`, deliberately - a
 * person who already became interested via natural growth (step 5) isn't
 * available to also become interested via crossover (step 6) this same
 * week; only the *headroom/ceiling* check needed to become crossover-only,
 * not the "who's still available to convert" check.
 */
export function deriveWomCrossoverExpansion(
  fixed: AudienceSimulationFixedState,
  awareCount: number,
  totalEverInterested: number,
  cumulativeCrossoverRealized: number,
  womInfluence: number,
): number {
  const crossoverCeiling = fixed.crossoverCapacityFraction * fixed.totalAddressableAudience;
  const headroom = Math.max(0, crossoverCeiling - cumulativeCrossoverRealized);
  const awareNotYetInterested = Math.max(0, awareCount - totalEverInterested);
  const growthFraction = thresholdResponse(womInfluence, CROSSOVER_RESPONSE.threshold, CROSSOVER_RESPONSE.sensitivity);
  const saturationDampening = crossoverCeiling > 0 ? headroom / crossoverCeiling : 0;
  return Math.min(headroom, awareNotYetInterested) * growthFraction * saturationDampening;
}

/** Step 7: the baseline weekly attendance probability is just AudienceSimulationFixedState.conversionPacingBaseline - a plain lookup, kept as its own named step because it's a conceptually separate input from the word-of-mouth modulation applied on top of it in step 8. Ordinary decline/growth is never modeled by this baseline shrinking over time - see module header and DESIGN.md 5.34: decay/growth emerge from the interested pool's own size changing, not from this probability decaying. */
export function getBaselineAttendanceProbability(fixed: AudienceSimulationFixedState): number {
  return fixed.conversionPacingBaseline;
}

/**
 * Step 8: word of mouth pulling already-interested people forward in time -
 * boosts this week's attendance probability for the *pre-existing* backlog
 * only (see the ticketsFromExistingPool/ticketsFromNewInterest split in
 * advanceOneWeekWithDiagnostics - newly-created interest never gets this
 * boost the same week it's created). Needs a moderately strong influence to
 * matter (DESIGN.md 5.34: "needs a genuinely good reaction, not just an
 * average one").
 *
 * Redesigned (docs/DESIGN.md 5.34, "crossover/pull-forward separation") away
 * from `thresholdResponse`'s convex-then-hard-clip-at-1 shape, which reached
 * its maximum urgency once womInfluence crossed a fairly low bar and then
 * *stayed* there for as long as reception kept producing that much WOM
 * activity - a real save (Lucky Internship) pinned at the exact maximum
 * urgency (and therefore the exact PULL_FORWARD_MAX_MULTIPLIER ceiling) for
 * four consecutive weeks (9-12), which is a plateau, not the smooth curve a
 * timing effect should have. Pull-forward's whole job is "how much sooner do
 * already-interested people decide to go," which should keep responding
 * (even if only a little) to a stronger reaction rather than topping out and
 * going flat.
 *
 * Two independent pieces, matching the user's own decomposition:
 *
 * 1. `pullForwardUrgencySignal` - a smooth Michaelis-Menten-style saturating
 *    curve (`excess / (excess + PULL_FORWARD_HALF_SATURATION)`) instead of a
 *    convex curve hard-clipped at 1. Zero at/below the threshold, rises
 *    quickly at first, then flattens - approaching but never *reaching* 1,
 *    so there is no plateau: a stronger womInfluence always produces at
 *    least a little more urgency, however diminishing the return.
 *    PULL_FORWARD_HALF_SATURATION (the excess-over-threshold value at which
 *    urgency reaches exactly 0.5) is picked so ordinary-good reception
 *    produces a modest signal (well under 0.5) and only sustained,
 *    exceptional reception pushes urgency up near its own ceiling - checked
 *    against a real diagnostic sweep, not guessed.
 *
 * 2. `pullForwardCeilingMultiplier` - how far urgency=1 *could* push this
 *    week's probability, decaying along two independent axes exactly as
 *    specified ("the boost weakens as the backlog becomes less eager AND as
 *    the run ages"):
 *    - `ageFactor`: a smooth `halfLife / (halfLife + weeksSinceRelease)`
 *      decay - week 1 gets the full multiplier, later weeks get
 *      progressively less, with no hard cutoff.
 *    - `backlogFreshnessFactor` (passed in - see
 *      advanceOneWeekWithDiagnostics): how much of everyone who has *ever*
 *      been interested is still sitting unconverted in the backlog
 *      (`priorWeek.interestedRemaining / priorTotalEverInterested`). Early
 *      in a run this is close to 1 (almost nobody interested has bought a
 *      ticket yet); late in a run it's small (most of the people who were
 *      ever going to go, already went) - a genuine "how eager is what's
 *      left" signal, not a reused proxy for something else.
 *    Both factors are >=0 and <=1 and multiply together, so the ceiling
 *    multiplier can only ever shrink from PULL_FORWARD_MAX_MULTIPLIER, never
 *    grow past it - preserving Milestone 8's original guarantee that this
 *    can never push a week's probability past a bounded multiple of
 *    baseline, while now *also* guaranteeing that multiple keeps shrinking
 *    as a run ages and its backlog thins out, so pull-forward cannot re-peak
 *    the same way indefinitely.
 *
 * The user's explicit preference ("a smooth saturating curve over a hard 3x
 * baseline cap if that is feasible") is satisfied by construction: nothing
 * here ever clips at exactly 1 the way thresholdResponse did - both the
 * urgency signal and each decay factor are smooth curves that only
 * asymptotically approach their bounds.
 */
const PULL_FORWARD_MAX_MULTIPLIER = 3;
const PULL_FORWARD_HALF_SATURATION = 0.15;
const PULL_FORWARD_AGE_HALF_LIFE_WEEKS = 8;

export function pullForwardUrgencySignal(womInfluence: number): number {
  const excess = Math.max(0, womInfluence - PULL_FORWARD_RESPONSE.threshold);
  return excess / (excess + PULL_FORWARD_HALF_SATURATION);
}

export function pullForwardCeilingMultiplier(weekNumber: number, backlogFreshnessFactor: number): number {
  const ageFactor = PULL_FORWARD_AGE_HALF_LIFE_WEEKS / (PULL_FORWARD_AGE_HALF_LIFE_WEEKS + Math.max(0, weekNumber - 1));
  const freshness = clamp(backlogFreshnessFactor, 0, 1);
  return 1 + (PULL_FORWARD_MAX_MULTIPLIER - 1) * ageFactor * freshness;
}

export function applyWomPullForward(baselineProbability: number, womInfluence: number, weekNumber: number, backlogFreshnessFactor: number): number {
  const urgencySignal = pullForwardUrgencySignal(womInfluence);
  const ceiling = baselineProbability * pullForwardCeilingMultiplier(weekNumber, backlogFreshnessFactor);
  return clamp(baselineProbability + urgencySignal * (ceiling - baselineProbability), 0, 1);
}

/** Step 9: tickets sold this week - the interested-and-unconverted pool times this week's (WOM-boosted) attendance probability. Since attendanceProbability is always in [0,1], this can never exceed interestedRemaining - selling more tickets than there are interested people left is structurally impossible, not just guarded against. This is *unconstrained demand* - "how many would attend if every one of them could get a ticket" - not yet gated by availability (step 9.5 below). */
export function sellTicketsThisWeek(interestedRemaining: number, attendanceProbability: number): number {
  return interestedRemaining * clamp(attendanceProbability, 0, 1);
}

// --- Step 9.5 (Milestone 9): availability - exhibition access, gating
// attendance without ever creating it ---------------------------------
//
// The Quantum Signal incident fix (Milestone 7-8) tempered *how explosive*
// WOM could get, but a follow-up regression matrix (docs/DESIGN.md 5.34)
// found two shapes the model still couldn't produce: ordinary Wide
// releases peaking 7-10 weeks late (because nothing makes admissions
// decline *fast* early on - only the interested pool depleting, which
// takes many weeks for a large audience), and slow-building Limited/
// Festival First releases that never finished their arc within the
// 20-week cap (their only growth lever, externalWeeklyAwarenessRate, is
// reception-independent and had to stay slow to keep *poor* Limited
// releases appropriately tiny - raising it broke that guarantee for
// every Limited release, good or bad, since "how fast the population
// finds out this exists" and "how many screens this film has" were the
// same lever).
//
// Both symptoms are the same root cause: the model was asking awareness/
// interest pacing to do exhibition's job. In reality, a Wide release
// doesn't decline because people stop being interested - it declines
// because screens get reallocated to next Friday's openers, on a
// timescale of weeks, largely independent of the interested pool's own
// size. And a Limited release doesn't grow because more of the
// population "hears about it" - it grows because a distributor adds
// screens in response to strong per-screen performance. `availabilityFraction`
// (AudienceSimulationWeekState) makes that access an explicit, separately
// evolving piece of state - constraining how much of the already-existing
// interested pool can convert to a ticket this week, never creating
// interest/awareness/WOM itself (those stay exactly as driven by steps
// 0-8 above; see AudienceSimulationFixedState.initialAvailabilityFraction's
// own doc comment for the full incident writeup).
//
// The feedback loop is deliberately one-week-lagged, never same-week:
//   this week's availability -> this week's *capacity* -> this week's
//   realised (capacity-gated) admissions -> this week's demand/capacity
//   utilisation -> NEXT week's availability.
// Nothing here reads this week's *own* nextAvailability before this
// week's ticket sale happens - see advanceOneWeekWithDiagnostics, where
// `availabilityThisWeek` (read from priorWeek, or seeded on week 1) gates
// step 9's sale, and `next.availabilityFraction` is only computed
// afterward, from that same sale's utilisation.

/** Step 9.5a: this week's available access - the release-day seed on week 1 (AudienceSimulationFixedState.initialAvailabilityFraction), or whatever last week's performance already set (AudienceSimulationWeekState.availabilityFraction) on every week after. Mirrors applyReleaseDayAwarenessSeed's one-time-seed-then-carry-forward shape. */
export function currentAvailabilityFraction(fixed: AudienceSimulationFixedState, priorWeek: AudienceSimulationWeekState, weeksLength: number): number {
  return weeksLength === 0 ? fixed.initialAvailabilityFraction : priorWeek.availabilityFraction;
}

// Even at 100% availability (every screen, every showtime), a film can
// only physically serve a bounded fraction of its whole reachable ceiling
// in a single week - real theatrical throughput is finite regardless of
// demand. Deliberately generous (chosen so an already-validated Wide
// release's peak week - which stays well under this fraction of its own
// ceiling even at exceptional reception, per the Quantum Signal fix's own
// before/after numbers - is never gated by this cap at full availability;
// the cap is meant to bind for *reduced* availability, not for Wide at
// its best).
const MAX_WEEKLY_THROUGHPUT_FRACTION = 0.5;

/**
 * Step 9.5b: the most tickets this film could possibly sell this week
 * given its current availability - a hard ceiling on step 9's
 * unconstrained demand, entirely independent of how many people want to
 * go.
 *
 * The anchor this multiplies is *blended*, not a single fixed number -
 * calibrating this against either extreme alone breaks the other:
 * anchoring to `maxInterestedAudience(fixed)` (taste-fit ceiling,
 * marketability/originality-driven) makes an ordinary Wide release's
 * capacity absurdly generous relative to its own modest opening (it never
 * meaningfully binds, defeating the point), because reception-driven
 * ceiling and marketing-driven screen count don't scale together -
 * a modest and a phenomenal Wide release can have similar taste-fit
 * ceilings while opening on wildly different numbers of screens.
 * Anchoring to `initialAwareCount` (release-day reach, Buzz/marketing-
 * driven - scales *correctly* between an ordinary and a phenomenal Wide
 * release) fixes that, but permanently starves a genuine Limited/Festival
 * First breakout: its initialAwareCount is deliberately tiny (that's the
 * whole point of "Limited"), so a platform release that's honestly earned
 * wide distribution would stay capped near its own tiny opening-day
 * number forever, never able to reach anything like a normal wide
 * release's throughput.
 *
 * `computeAvailabilityAnchor` blends the two based on how far availability
 * has traveled from its own release-day starting point
 * (initialAvailabilityFraction) toward full access (1.0) - a Wide release
 * starts close to 1.0 already, so this stays anchored to initialAwareCount
 * for essentially its whole (declining) run, exactly matching the
 * initialAwareCount-only calibration that already works correctly for it;
 * a Limited/Festival First release starts far from 1.0, so as it
 * genuinely expands (this is *itself* the earned "platform expansion"
 * signal - see computeNextAvailability), the anchor smoothly grows toward
 * maxInterestedAudience, unlocking real, Wide-movie-scale throughput for
 * a breakout that's actually earned it - never for one that hasn't (a
 * poorly-received Limited release's availability never expands in the
 * first place, so its anchor never moves off initialAwareCount either).
 */
// A film can legitimately release with initialAwareCount at or near zero
// (no release-day marketing seed at all, building purely from external
// trickle and word of mouth) - the anchor still needs *some* nonzero
// starting point, or a film like that could never bootstrap any capacity
// to begin with (zero capacity forever, regardless of how much genuine
// demand eventually builds - see computeDemandUtilisation's own handling
// of the capacity<=0 edge case for the other half of this fix).
const ANCHOR_FLOOR_FRACTION = 0.1;

function computeAvailabilityAnchor(fixed: AudienceSimulationFixedState, availabilityFraction: number): number {
  const ceiling = maxInterestedAudience(fixed);
  const baseAnchor = Math.max(fixed.initialAwareCount, ANCHOR_FLOOR_FRACTION * ceiling);
  const expansionProgress = fixed.initialAvailabilityFraction < AVAILABILITY_CEILING
    ? clamp((availabilityFraction - fixed.initialAvailabilityFraction) / (AVAILABILITY_CEILING - fixed.initialAvailabilityFraction), 0, 1)
    : 0;
  return baseAnchor + expansionProgress * (ceiling - baseAnchor);
}

export function computeAvailabilityCapacity(fixed: AudienceSimulationFixedState, availabilityFraction: number): number {
  return availabilityFraction * MAX_WEEKLY_THROUGHPUT_FRACTION * computeAvailabilityAnchor(fixed, availabilityFraction);
}

/** Step 9.5c: demand relative to this week's capacity - "how full is the film given the access it currently has," the single signal driving next week's availability (both Wide's contraction and Limited/Festival First's expansion - see computeNextAvailability). Can exceed 1 (demand outstripping capacity - turning people away) - that excess is exactly the "exceptional performance" signal that lets a Wide release hold/re-expand or a Limited release accelerate its platform expansion. Not the same as a utilization *rate limit* - this is the raw signal, computeNextAvailability does the clamping. Zero capacity with genuine demand (shouldn't normally arise given ANCHOR_FLOOR_FRACTION, but defensive regardless) is the *most* extreme undersupply, not a neutral reading - treated as a large multiple of the reference point so it drives expansion, never leaves a film stuck at zero capacity with no way out. */
export function computeDemandUtilisation(unconstrainedDemand: number, capacityThisWeek: number): number {
  if (capacityThisWeek <= 0) return unconstrainedDemand > 0 ? 100 : 0;
  return unconstrainedDemand / capacityThisWeek;
}

const AVAILABILITY_FLOOR = 0.02;
const AVAILABILITY_CEILING = 1.0;
// Demand exactly matching capacity is the "ordinary, no adjustment" reference point - selling out (utilisation > 1) is a positive signal, playing to empty seats (utilisation < 1) is a negative one.
const REFERENCE_UTILISATION = 1.0;
const AVAILABILITY_RESPONSE_SENSITIVITY = 0.5;
// Rate limit (Milestone 9's "asymptotic, not a jump" requirement) - at most
// this fraction of the remaining headroom to the ceiling (expanding) or
// floor (contracting) closes in a single week, on top of the ceiling/floor
// approach itself already being asymptotic (see computeNextAvailability).
const MAX_AVAILABILITY_RATE_MAGNITUDE = 0.2;

/** How much a given critic score alone (ignoring audience score entirely) amplifies availability expansion - same convex shape as computeReceptionResponseMultiplier, but critic-only, for Festival First's "critic-led before general audiences get a vote" phase (see criticLedExpansionWeight). */
function computeCriticOnlyReceptionMultiplier(fixed: AudienceSimulationFixedState): number {
  const weighted = fixed.criticScore / 100;
  return RECEPTION_FLOOR + (1 - RECEPTION_FLOOR) * weighted * weighted;
}

/**
 * How much this week's *expansion* signal (the positive/growth half of
 * computeNextAvailability only - contraction is never gated by reception,
 * see that function) gets throttled unless critic reception specifically
 * is also strong. `criticLedExpansionWeight` is 0 for Wide/Limited (gate
 * is always 1 - expansion is purely utilisation-driven, exactly as
 * requested: "Limited expansion must respond to performance... not raw
 * admissions," with no *extra* reception dependency layered on top of
 * what already drove that demand). Nonzero for Festival First - a strong
 * per-screen showing at a handful of festival-circuit screens isn't
 * enough on its own to earn wider release without critical validation
 * too, modeling that a festival film's expansion decision is made by
 * distributors reading reviews, not by general audiences who mostly
 * haven't had the chance to see it yet.
 */
function computeExpansionReceptionGate(fixed: AudienceSimulationFixedState): number {
  if (fixed.criticLedExpansionWeight <= 0) return 1;
  const criticOnly = computeCriticOnlyReceptionMultiplier(fixed);
  return 1 - fixed.criticLedExpansionWeight * (1 - criticOnly);
}

/**
 * Step 9.5d: next week's availability, from this week's demand/capacity
 * utilisation - one shared formula for both contraction (Wide) and
 * expansion (Limited/Festival First), differing only in each release
 * type's own `availabilityBaseWeeklyDecay` and `criticLedExpansionWeight`
 * (AudienceSimulationFixedState) rather than separate hand-built
 * formulas, the same "behavior emerges from a few differentiated inputs"
 * principle the rest of this file already follows. The performance ladder
 * the Milestone 9 brief asked for falls out of where `netRate` lands, not
 * from an explicit weak/ordinary/strong/exceptional branch:
 *   - weak performance (utilisation << 1): rawPerformanceAdjustment very
 *     negative -> netRate strongly negative -> fast contraction.
 *   - ordinary performance (utilisation ~= 1): rawPerformanceAdjustment
 *     ~= 0 -> netRate ~= -availabilityBaseWeeklyDecay -> plain age-based
 *     contraction (Wide) or roughly flat (Limited/Festival, whose decay
 *     is small) - "ordinary contraction."
 *   - strong performance (utilisation notably > 1): rawPerformanceAdjustment
 *     positive enough to offset the age decay -> netRate ~= 0 -> Wide
 *     holds its screens; Limited/Festival (negligible decay to offset)
 *     genuinely expands.
 *   - exceptional performance (utilisation far > 1, selling out and
 *     turning people away): netRate clearly positive -> Wide re-expands;
 *     Limited/Festival expands fast (still rate-limited, see below).
 *
 * Both directions approach their bound (AVAILABILITY_CEILING/AVAILABILITY_FLOOR)
 * asymptotically - a fixed *fraction* of remaining headroom closes each
 * week, the exact same self-dampening shape saturationDampening restored
 * to interest/crossover growth in the Quantum Signal fix - so availability
 * can never jump from a Limited release's tiny opening slate straight to
 * near-Wide access in one week, and this cannot itself become a new
 * runaway loop: `netRate` is hard-clamped to
 * +-MAX_AVAILABILITY_RATE_MAGNITUDE regardless of how extreme utilisation
 * gets, on top of that asymptotic approach.
 */
export function computeAvailabilityPerformanceAdjustment(fixed: AudienceSimulationFixedState, demandUtilisation: number): number {
  const rawPerformanceAdjustment = (demandUtilisation - REFERENCE_UTILISATION) * AVAILABILITY_RESPONSE_SENSITIVITY;
  const expansionGate = computeExpansionReceptionGate(fixed);
  return rawPerformanceAdjustment > 0 ? rawPerformanceAdjustment * expansionGate : rawPerformanceAdjustment;
}

export function computeNextAvailability(fixed: AudienceSimulationFixedState, currentAvailability: number, demandUtilisation: number): number {
  const performanceAdjustment = computeAvailabilityPerformanceAdjustment(fixed, demandUtilisation);
  const netRate = clamp(performanceAdjustment - fixed.availabilityBaseWeeklyDecay, -MAX_AVAILABILITY_RATE_MAGNITUDE, MAX_AVAILABILITY_RATE_MAGNITUDE);
  if (netRate >= 0) {
    return clamp(currentAvailability + (AVAILABILITY_CEILING - currentAvailability) * netRate, AVAILABILITY_FLOOR, AVAILABILITY_CEILING);
  }
  return clamp(currentAvailability - (currentAvailability - AVAILABILITY_FLOOR) * -netRate, AVAILABILITY_FLOOR, AVAILABILITY_CEILING);
}

/**
 * Milestone 4: every intermediate quantity step 10 computes on the way to
 * the next AudienceSimulationWeekState, exposed for the Outcome Inspector
 * (components/dev/OutcomeInspector.tsx) - "make it obvious why a film
 * opened strongly, collapsed, grew, plateaued, or remained niche" needs
 * more than the three fields AudienceSimulationWeekState stores. Nothing
 * here is money - the people-vs-money boundary conversion (weekly/
 * cumulative gross) is the reporting layer's job
 * (engine/audienceSimulationReporting.ts), not this module's (see file
 * header: "model people, not money... until the very last step").
 */
export interface WeekDiagnostics {
  week: number;
  totalAddressableAudience: number;
  awareCount: number;
  /** Total increase in awareCount this week, from every source (release-day seed on week 1, external trickle, word of mouth) combined. */
  newlyAware: number;
  /** Awareness growth broken out by source, summing to newlyAware - the release-day seed only ever contributes on week 1 (see applyReleaseDayAwarenessSeed). */
  newlyAwareFromReleaseDaySeed: number;
  newlyAwareFromExternal: number;
  newlyAwareFromWom: number;
  interestedRemaining: number;
  /** Step 2 + 5 combined - new interest from people who fit the film's natural audience (external conversion and word-of-mouth natural-interest growth), *excluding* crossover. */
  newInterestCreated: number;
  /** Step 6 alone - interest from people outside the natural audience, realized via word-of-mouth crossover. */
  crossoverInterestCreated: number;
  /** Milestone 12 - running total of crossoverInterestCreated across the whole run so far, i.e. AudienceSimulationWeekState.cumulativeCrossoverRealized. What deriveWomCrossoverExpansion's own headroom is now bounded against - never lets crossoverInterestCreated exceed crossoverCapacityFraction * totalAddressableAudience in total, independent of how much natural-audience headroom is separately left. */
  cumulativeCrossoverRealized: number;
  /** Step 3's output - this week's word-of-mouth influence signal, the single driver behind newlyAwareFromWom, the word-of-mouth share of newInterestCreated, crossoverInterestCreated, and womPullForwardBoost below. */
  womInfluence: number;
  baselineAttendanceProbability: number;
  /** Step 8's urgency boost alone (0-1), before combining with the baseline - how much word of mouth is pulling existing interest forward this week. */
  womPullForwardBoost: number;
  /** The actual attendance probability applied this week (baseline + pull-forward). */
  finalAttendanceProbability: number;
  /** Step 9.5a's output - this week's exhibition access (0-1), gating step 9's demand below. Set on release day (initialAvailabilityFraction) or carried over from last week's performance (see nextAvailabilityFraction below, one-week-lagged by construction). */
  availabilityFraction: number;
  /** Step 9's raw output before availability gates it - "how many would attend this week if every one of them could get a ticket." Always >= weeklyAdmissions. */
  unconstrainedDemand: number;
  /** Step 9.5b's output - the most tickets this film could physically sell this week at its current availabilityFraction, independent of demand. */
  maxServiceableDemand: number;
  /** unconstrainedDemand / maxServiceableDemand - can exceed 1 (sold out, turning people away), the single signal driving nextAvailabilityFraction below. */
  demandUtilisation: number;
  /** AudienceSimulationFixedState.availabilityBaseWeeklyDecay verbatim - the age-based contraction this release type would see at neutral (utilisation == 1) performance, before this week's actual performance adjusts it either way. */
  expectedAgeContraction: number;
  /** Step 9.5d's performance-driven term (see computeAvailabilityPerformanceAdjustment) - positive when this week sold out its available capacity (holding or expanding availability), negative when demand fell short of it (accelerating contraction), *before* combining with expectedAgeContraction to produce nextAvailabilityFraction. */
  performanceAdjustment: number;
  /** Step 9.5d's output - next week's availabilityFraction, computed from this week's demandUtilisation. Deliberately not this week's own availabilityFraction - see the availability step's module header for why the feedback loop is one-week-lagged. */
  nextAvailabilityFraction: number;
  weeklyAdmissions: number;
  cumulativeTicketsSold: number;
  /**
   * The weekly WOM reproduction ratio (see computeWomReproductionRatio) -
   * how many additional *next*-week admissions this week's own viewers
   * caused, per viewer. Always NaN here: a single week's own transition
   * can't know its own reproduction ratio, since that requires comparing
   * against the *following* week's actual admissions, which don't exist
   * yet at this point. Only advanceToWeekWithDiagnostics's post-pass (over
   * a whole settled run) can fill this in - see that function.
   */
  womReproductionRatio: number;
}

/**
 * The one true implementation of "what happens in a week" - computes both
 * the next AudienceSimulationWeekState *and* every intermediate value that
 * produced it, in a single pass, so the two views can never drift apart.
 * advanceOneWeek (below) is a thin wrapper that discards the diagnostics;
 * nothing duplicates this step sequence anywhere else.
 */
export function advanceOneWeekWithDiagnostics(
  fixed: AudienceSimulationFixedState,
  weeks: AudienceSimulationWeekState[],
  womInfluenceOverride?: number,
): { next: AudienceSimulationWeekState; diagnostics: WeekDiagnostics } {
  const priorWeek = weeks.length > 0 ? weeks[weeks.length - 1] : WEEK_ZERO;
  const nextWeekNumber = priorWeek.week + 1;
  let totalEverInterested = priorWeek.interestedRemaining + priorWeek.cumulativeTicketsSold;

  // Step 0: the release-day awareness lump, only on week 1.
  const awareAfterSeed = applyReleaseDayAwarenessSeed(fixed, priorWeek.awareCount, weeks.length);
  const newlyAwareFromReleaseDaySeed = awareAfterSeed - priorWeek.awareCount;

  // Step 1 + 2: external awareness growth, and the natural-fit slice of it converting to interest immediately.
  const awareAfterExternal = applyExternalAwarenessGrowth(fixed, awareAfterSeed);
  const newlyAwareFromExternal = awareAfterExternal - awareAfterSeed;
  const newlyAwareExternal = awareAfterExternal - priorWeek.awareCount;
  const deltaInterestExternal = convertNewAwarenessToBaseInterest(fixed, newlyAwareExternal, totalEverInterested);
  totalEverInterested += deltaInterestExternal;

  // Step 3: derive this week's word-of-mouth influence from history already
  // settled (not including this week, which hasn't happened yet).
  // `womInfluenceOverride` bypasses this - used only by
  // computeWomReproductionRatio's counterfactual (docs/DESIGN.md 5.34) to
  // ask "what would next week look like with a different influence signal,
  // everything else about this transition held identical" - never used by
  // the real simulation path (advanceOneWeek/advanceToWeek never pass it).
  const womInfluence = womInfluenceOverride ?? computeCurrentWomInfluence(fixed, weeks, weeks.length);

  // Step 4: word of mouth spreads awareness further.
  const awareCount = applyWomAwarenessGrowth(fixed, awareAfterExternal, womInfluence);
  const newlyAwareFromWom = awareCount - awareAfterExternal;

  // Step 5: word of mouth convinces aware-but-undecided people within the natural audience.
  const deltaInterestNatural = deriveWomNaturalInterestGrowth(fixed, awareCount, totalEverInterested, womInfluence);
  totalEverInterested += deltaInterestNatural;

  // Step 6: exceptional word of mouth reaches beyond the natural audience.
  // cumulativeCrossoverRealized (Milestone 12) is crossover's own running
  // total, tracked separately from totalEverInterested so its headroom
  // check above is never diluted by however much natural-audience headroom
  // happens to still be left - see deriveWomCrossoverExpansion's doc comment.
  const deltaInterestCrossover = deriveWomCrossoverExpansion(fixed, awareCount, totalEverInterested, priorWeek.cumulativeCrossoverRealized, womInfluence);
  totalEverInterested += deltaInterestCrossover;
  const cumulativeCrossoverRealized = priorWeek.cumulativeCrossoverRealized + deltaInterestCrossover;

  const newInterestThisWeek = deltaInterestExternal + deltaInterestNatural + deltaInterestCrossover;
  const interestedBeforeSales = priorWeek.interestedRemaining + newInterestThisWeek;

  // Step 7 + 8: baseline attendance probability, pulled forward by word of
  // mouth's urgency effect. backlogFreshnessFactor is read from the prior
  // week's own pool (before any of this week's steps 0-6 touch it) - "how
  // eager is the backlog that's about to be pulled forward," not this
  // week's post-growth numbers (see pullForwardCeilingMultiplier's doc
  // comment).
  const baselineAttendanceProbability = getBaselineAttendanceProbability(fixed);
  const priorTotalEverInterested = priorWeek.interestedRemaining + priorWeek.cumulativeTicketsSold;
  const backlogFreshnessFactor = priorTotalEverInterested > 0 ? priorWeek.interestedRemaining / priorTotalEverInterested : 1;
  const womPullForwardBoost = pullForwardUrgencySignal(womInfluence);
  const attendanceProbability = applyWomPullForward(baselineAttendanceProbability, womInfluence, nextWeekNumber, backlogFreshnessFactor);

  // Step 9: sell tickets. Pull-forward is "pulling *already*-interested
  // people forward in time" (see applyWomPullForward's doc comment) - it
  // only makes sense applied to the backlog that was already sitting in
  // the pool before this week started. People who just became interested
  // *this* week (via steps 2/5/6, whether external or WOM-driven) haven't
  // been sitting anywhere yet to be pulled forward from - they convert at
  // the plain baseline rate this week. Without this split, the same
  // womInfluence signal that manufactures a burst of new interest in a
  // week also immediately empties most of it via that same week's
  // pull-forward boost - the "same signal compounds across every channel
  // simultaneously" failure mode behind the Quantum Signal incident
  // (docs/DESIGN.md 5.34): WOM would create the backlog and drain it in
  // the same motion, rather than pull-forward genuinely just shifting
  // *timing* of demand that already existed.
  const ticketsFromExistingPool = sellTicketsThisWeek(priorWeek.interestedRemaining, attendanceProbability);
  const ticketsFromNewInterest = sellTicketsThisWeek(newInterestThisWeek, baselineAttendanceProbability);
  const unconstrainedDemand = ticketsFromExistingPool + ticketsFromNewInterest;

  // Step 9.5: availability gates unconstrained demand down to what this
  // film can physically serve this week - see the availability step's own
  // module header above for the full incident writeup. Deliberately
  // capping the *combined* total rather than splitting the cap
  // proportionally between ticketsFromExistingPool/ticketsFromNewInterest -
  // the state update below only needs their sum, and unserved demand
  // simply stays in interestedRemaining for next week (it was never
  // subtracted out), exactly satisfying "availability constrains
  // attendance, it does not shrink the interested pool independently."
  const availabilityThisWeek = currentAvailabilityFraction(fixed, priorWeek, weeks.length);
  const maxServiceableDemand = computeAvailabilityCapacity(fixed, availabilityThisWeek);
  const ticketsThisWeek = Math.min(unconstrainedDemand, maxServiceableDemand);
  const demandUtilisation = computeDemandUtilisation(unconstrainedDemand, maxServiceableDemand);
  const performanceAdjustment = computeAvailabilityPerformanceAdjustment(fixed, demandUtilisation);
  const nextAvailabilityFraction = computeNextAvailability(fixed, availabilityThisWeek, demandUtilisation);

  // Defensive final clamp - the step-by-step headroom bounding above should
  // already guarantee these never exceed their ceilings, but floating-point
  // accumulation across many weeks is cheap insurance against a validation
  // throw over an epsilon-scale rounding error.
  const ceiling = maxInterestedAudience(fixed);
  const clampedAwareCount = clamp(awareCount, 0, fixed.totalAddressableAudience);
  const interestedRemaining = clamp(interestedBeforeSales - ticketsThisWeek, 0, Math.min(clampedAwareCount, ceiling));
  const cumulativeTicketsSold = clamp(priorWeek.cumulativeTicketsSold + ticketsThisWeek, 0, fixed.totalAddressableAudience);
  const crossoverCeiling = fixed.crossoverCapacityFraction * fixed.totalAddressableAudience;
  const clampedCumulativeCrossoverRealized = clamp(cumulativeCrossoverRealized, 0, crossoverCeiling);

  const next = createAudienceSimulationWeekState(fixed, {
    week: nextWeekNumber,
    awareCount: clampedAwareCount,
    interestedRemaining,
    cumulativeTicketsSold,
    availabilityFraction: nextAvailabilityFraction,
    cumulativeCrossoverRealized: clampedCumulativeCrossoverRealized,
  });

  // Diagnostics are read from the *actual* resulting week state (post-clamp)
  // rather than the raw pre-clamp intermediates wherever the two could
  // differ, so a displayed row can never claim a number the stored history
  // itself doesn't back up.
  const diagnostics: WeekDiagnostics = {
    week: nextWeekNumber,
    totalAddressableAudience: fixed.totalAddressableAudience,
    awareCount: next.awareCount,
    newlyAware: next.awareCount - priorWeek.awareCount,
    newlyAwareFromReleaseDaySeed,
    newlyAwareFromExternal,
    newlyAwareFromWom,
    interestedRemaining: next.interestedRemaining,
    newInterestCreated: deltaInterestExternal + deltaInterestNatural,
    crossoverInterestCreated: deltaInterestCrossover,
    cumulativeCrossoverRealized: next.cumulativeCrossoverRealized,
    womInfluence,
    baselineAttendanceProbability,
    womPullForwardBoost,
    finalAttendanceProbability: attendanceProbability,
    availabilityFraction: availabilityThisWeek,
    unconstrainedDemand,
    maxServiceableDemand,
    demandUtilisation,
    expectedAgeContraction: fixed.availabilityBaseWeeklyDecay,
    performanceAdjustment,
    nextAvailabilityFraction,
    weeklyAdmissions: next.cumulativeTicketsSold - priorWeek.cumulativeTicketsSold,
    cumulativeTicketsSold: next.cumulativeTicketsSold,
    womReproductionRatio: NaN,
  };

  return { next, diagnostics };
}

/**
 * The weekly WOM "reproduction ratio" - epidemiological R0 for word of
 * mouth (docs/DESIGN.md 5.34, requested during the Quantum Signal incident
 * investigation): how many *additional* week-(t+1) admissions are
 * attributable to week t's own viewers, per week-t viewer. A ratio
 * meaningfully above 1 means the WOM loop is still amplifying (each
 * viewer is, on average, causing more than one more viewer next week);
 * near or below 1 means it's decaying toward replacement, the way any
 * stable epidemic/diffusion process eventually must.
 *
 * Computed by counterfactual subtraction, exactly as specified: week
 * t+1's word-of-mouth influence is recomputed with week t's own
 * admissions zeroed out of the recency-weighted activity sum that feeds
 * it (deriveWordOfMouthActivity's lookback=0 slot, whose weight is always
 * exactly 1 - see WOM_LOOKBACK_WEIGHTS in engine/audienceSimulation.ts),
 * then week t+1's *entire* transition (steps 4-9: awareness, interest,
 * crossover, pull-forward, sales) is rerun against that lower influence
 * via advanceOneWeekWithDiagnostics's womInfluenceOverride - holding week
 * t's actual real pool sizes fixed, changing only the WOM signal reaching
 * week t+1. The difference between real and counterfactual week-(t+1)
 * admissions is "how many of week t+1's admissions exist because week t's
 * viewers talked about it," divided by week t's own viewer count.
 *
 * Diagnostic-only, deliberately never folded into game state or fed back
 * into the simulation - a read of what the model is already doing, not a
 * new input to it (same reasoning as WeekDiagnostics itself).
 */
export function computeWomReproductionRatio(fixed: AudienceSimulationFixedState, weeks: AudienceSimulationWeekState[], weekIndex: number): number {
  if (weekIndex < 0 || weekIndex >= weeks.length) {
    throw new Error(`AudienceSimulation: weekIndex ${weekIndex} is out of range for a ${weeks.length}-week history`);
  }
  const weekTAdmissions = deriveWeeklyAdmissions(weeks, weekIndex);
  if (weekTAdmissions <= 0) return 0;
  // No week (t+1) exists yet to measure - nothing to compare against.
  if (weekIndex === weeks.length - 1) return NaN;

  const historyUpToT = weeks.slice(0, weekIndex + 1);
  const actualNextWeekAdmissions = deriveWeeklyAdmissions(weeks, weekIndex + 1);

  const actualRawActivity = deriveWordOfMouthActivity(weeks, weekIndex + 1);
  const counterfactualRawActivity = Math.max(0, actualRawActivity - weekTAdmissions);
  const counterfactualActivityFraction = clamp(counterfactualRawActivity / maxInterestedAudience(fixed), 0, 1);
  const counterfactualWomInfluence = counterfactualActivityFraction * computeReceptionResponseMultiplier(fixed);

  const counterfactualNextWeekAdmissions = advanceOneWeekWithDiagnostics(fixed, historyUpToT, counterfactualWomInfluence).diagnostics.weeklyAdmissions;

  const additionalAdmissionsCausedByWeekT = Math.max(0, actualNextWeekAdmissions - counterfactualNextWeekAdmissions);
  return additionalAdmissionsCausedByWeekT / weekTAdmissions;
}

/**
 * Step 10: composes steps 0-9 into the next week's state. Takes the whole
 * history (not just the last week) because step 3 needs it for the
 * recency-weighted lookback. `weeks` may be empty - a fresh run's week 1
 * is produced by applying this exact same transition to WEEK_ZERO, with
 * only step 0's one-time release-day seed distinguishing week 1 from every
 * later week (see applyReleaseDayAwarenessSeed) - no separate "seed the
 * run" algorithm. A thin wrapper over advanceOneWeekWithDiagnostics - see
 * that function for the actual step sequence.
 */
export function advanceOneWeek(fixed: AudienceSimulationFixedState, weeks: AudienceSimulationWeekState[]): AudienceSimulationWeekState {
  return advanceOneWeekWithDiagnostics(fixed, weeks).next;
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

/**
 * Milestone 4: the same catch-up as advanceToWeek, but built on
 * advanceOneWeekWithDiagnostics instead of advanceOneWeek so the Outcome
 * Inspector can show every week's full diagnostic trace, not just its
 * final state. `weeks[i]` and `diagnostics[i]` describe the same week -
 * calling advanceToWeek(fixed, seedWeeks, targetWeekNumber) against the
 * same inputs always produces a `weeks` identical to this function's,
 * since both are ultimately driven by the same
 * advanceOneWeekWithDiagnostics step sequence (see that function).
 */
export function advanceToWeekWithDiagnostics(
  fixed: AudienceSimulationFixedState,
  weeks: AudienceSimulationWeekState[],
  targetWeekNumber: number,
): { weeks: AudienceSimulationWeekState[]; diagnostics: WeekDiagnostics[] } {
  let resultWeeks = weeks;
  const diagnostics: WeekDiagnostics[] = [];
  while (resultWeeks.length < targetWeekNumber && !hasSimulationEnded(resultWeeks)) {
    const { next, diagnostics: weekDiagnostics } = advanceOneWeekWithDiagnostics(fixed, resultWeeks);
    resultWeeks = [...resultWeeks, next];
    diagnostics.push(weekDiagnostics);
  }
  // Post-pass: womReproductionRatio for week i needs week i+1's actual
  // settled admissions (see computeWomReproductionRatio), which don't
  // exist until the whole run above has finished - can't be filled in
  // during the loop itself. The final settled week always stays NaN
  // (there is no "next week" to measure against).
  const startIndex = weeks.length;
  for (let i = 0; i < diagnostics.length - 1; i++) {
    diagnostics[i].womReproductionRatio = computeWomReproductionRatio(fixed, resultWeeks, startIndex + i);
  }
  return { weeks: resultWeeks, diagnostics };
}
