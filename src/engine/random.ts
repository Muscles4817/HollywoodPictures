// Small seeded PRNG so simulations can be re-run deterministically when a seed
// is supplied, while still feeling random during normal play (seed = Date.now()).
// Mulberry32 - fast, good enough distribution for a game simulation.

export type RandomFn = () => number; // returns float in [0, 1)

export function createRng(seed: number): RandomFn {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

/** Integer in [min, max] inclusive. */
export function randInt(rng: RandomFn, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** Float in [min, max]. */
export function randFloat(rng: RandomFn, min: number, max: number): number {
  return rng() * (max - min) + min;
}

/** Pick a random element from a non-empty array. */
export function pick<T>(rng: RandomFn, items: readonly T[]): T {
  return items[randInt(rng, 0, items.length - 1)];
}

/** Pick `count` distinct elements from an array (no replacement). */
export function pickMany<T>(rng: RandomFn, items: readonly T[], count: number): T[] {
  const pool = [...items];
  const result: T[] = [];
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const idx = randInt(rng, 0, pool.length - 1);
    result.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return result;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Turns a set of non-negative raw weights into a proper distribution
 * (sums to exactly 1) - the shared math behind any types/index.ts:Distribution<K>
 * value, whether the raw weights came from genre signals (engine/scriptGenerator.ts)
 * or a personal lean (engine/talentGenerator.ts). Falls back to an even
 * split if every weight is zero, rather than dividing by zero.
 */
export function normalizeWeights<K extends string>(weights: Record<K, number>): Record<K, number> {
  const keys = Object.keys(weights) as K[];
  const total = keys.reduce((sum, key) => sum + Math.max(0, weights[key]), 0);
  const result = {} as Record<K, number>;
  for (const key of keys) {
    result[key] = total > 0 ? Math.max(0, weights[key]) / total : 1 / keys.length;
  }
  return result;
}

/** Runs `fn` with a deterministic RNG seeded from `seed`, returning the advanced seed to store back. */
export function withRng<T>(seed: number, fn: (rng: RandomFn) => T): { result: T; nextSeed: number } {
  const rng = createRng(seed);
  const result = fn(rng);
  const nextSeed = randInt(rng, 1, 2 ** 31 - 1);
  return { result, nextSeed };
}
