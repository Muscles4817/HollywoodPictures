// Bounded quantities that carry their own bound.
//
// This file exists because of a measured problem, not a style preference. The
// engine had ~540 `clamp(x, 0, 1)` / `Math.min(100, ...)` calls, the
// overwhelming majority of them re-asserting - at the point of USE - an
// invariant that nothing enforced at the point of CONSTRUCTION. Two costs
// follow from that, and the second one is the expensive one:
//
//  1. The invariant is stated hundreds of times and guaranteed nowhere, so
//     forgetting it once is invisible.
//  2. Far worse: a clamp at a use site is indistinguishable from a clamp that
//     is doing real modelling work. When every third line clamps to [0, 1],
//     nobody notices the one clamp that is silently deciding an outcome -
//     which is exactly how computePlayerReleaseStrength came to lose an entire
//     decision behind `Math.min(1, ...)` (see docs/CODE_QUALITY.md).
//
// So: construct through `unit`/`stat`, and stop clamping at use sites. A clamp
// that survives in engine code after this should be doing something a reader
// has to think about, and should say what.
//
// The brands are compile-time only - `Unit` and `Stat` ARE numbers at runtime,
// with zero wrapper cost, and pass freely anywhere a number is wanted.
// Arithmetic on them yields a plain number, which is the point: the moment you
// combine two bounded values you are back in unbounded space and have to say,
// explicitly, what the result's bound is and why.

declare const UNIT_BRAND: unique symbol;
declare const STAT_BRAND: unique symbol;

/**
 * A fraction, 0 to 1 inclusive. The engine's default currency for "how much of
 * a thing" - a share, a probability, a normalized dial position.
 *
 * Assignable to `number` (it is one); a raw `number` is NOT assignable to it.
 * That asymmetry is the whole mechanism: the only way in is `unit()`, and
 * `unit()` is the only place the bound is applied.
 */
export type Unit = number & { readonly [UNIT_BRAND]: true };

/**
 * A 0-100 score - the scale every player-facing stat uses (fame, skill, brand,
 * prestige, genre identity). Distinct from `Unit` on purpose: mixing the two
 * scales silently is a real bug this codebase has had, and the compiler can
 * catch it once they are different types.
 */
export type Stat = number & { readonly [STAT_BRAND]: true };

/**
 * The one place a fraction is bounded.
 *
 * NaN maps to 0 rather than propagating: a NaN escaping into the simulation
 * poisons every downstream sum silently, and there is no sensible fraction it
 * could mean. A caller that wants to KNOW about bad input should check before
 * calling, not rely on the bound to tell it.
 */
export function unit(value: number): Unit {
  if (!Number.isFinite(value)) return 0 as Unit;
  return (value < 0 ? 0 : value > 1 ? 1 : value) as Unit;
}

/** The one place a 0-100 score is bounded. Same NaN policy as `unit`. */
export function stat(value: number): Stat {
  if (!Number.isFinite(value)) return 0 as Stat;
  return (value < 0 ? 0 : value > 100 ? 100 : value) as Stat;
}

/** A 0-100 score read as a fraction - the conversion between the two scales, in one place. */
export function statAsUnit(value: number): Unit {
  return unit(stat(value) / 100);
}

/**
 * Blend `lift` of the headroom remaining above `base` - the shape to reach for
 * when a bonus must not push a bounded quantity past its own ceiling.
 *
 * This is the alternative to `Math.min(1, base + bonus)`, and the difference is
 * not cosmetic. A hard cap makes every input above the ceiling produce the same
 * output, so whatever distinctions those inputs carried are destroyed - which
 * is only ever noticed by measuring how often the cap binds. This form is
 * strictly monotonic: two different inputs always give two different outputs,
 * and the ceiling is approached rather than hit.
 *
 * It also says something truer than a flat bonus does. A lift that scales with
 * remaining headroom means the same advantage is worth more to a film that has
 * room to grow than to one already near the top - which is usually the honest
 * model of an advantage, not a convenient one.
 */
export function liftTowardCeiling(base: Unit, lift: Unit): Unit {
  return unit(base + lift * (1 - base));
}
