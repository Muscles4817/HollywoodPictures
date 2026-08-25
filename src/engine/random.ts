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

/**
 * Picks one of `keys` with probability proportional to `weights[key]` -
 * unlisted keys default to weight 1, so a caller only has to specify the
 * keys it actually wants to bias (engine/scriptGenerator.ts's archetype-
 * first generation: archetype/story-type/setting/scale/target-audience
 * picks all combine several partial weight tables via combineWeights below,
 * then sample here). Falls back to the last key on a floating-point
 * rounding edge case rather than ever returning undefined.
 */
export function weightedPick<K extends string>(rng: RandomFn, keys: readonly K[], weights: Partial<Record<K, number>>): K {
  const total = keys.reduce((sum, key) => sum + Math.max(0, weights[key] ?? 1), 0);
  let roll = rng() * total;
  for (const key of keys) {
    const w = Math.max(0, weights[key] ?? 1);
    if (roll < w) return key;
    roll -= w;
  }
  return keys[keys.length - 1];
}

/**
 * Multiplies several partial weight tables together, key by key (an
 * unlisted key in any one source contributes 1, i.e. "no opinion") - how
 * engine/scriptGenerator.ts combines e.g. an archetype's own story-type
 * affinity with that story type's own target-audience lean into one
 * weightedPick call, without either source needing to know about the other.
 */
export function combineWeights<K extends string>(keys: readonly K[], sources: Array<Partial<Record<K, number>> | undefined>): Partial<Record<K, number>> {
  const result: Partial<Record<K, number>> = {};
  for (const key of keys) {
    result[key] = sources.reduce<number>((product, source) => product * (source?.[key] ?? 1), 1);
  }
  return result;
}

/**
 * A stable 0-1 value hashed from a string (FNV-1a), for choices that must be
 * deterministic WITHOUT consuming a draw.
 *
 * The distinction matters more than it looks. Anything derived from the shared
 * RandomFn is positional: it depends on how many draws happened before it, so
 * adding or removing a draw anywhere upstream moves it. Anything derived from
 * this depends only on the string, so it is stable under exactly the kind of
 * churn forkSeed above exists to contain - and it can be computed at any point
 * in a function without changing where every later draw lands.
 *
 * Feed it something already deterministic for the same seed (a generated title,
 * a character's name). Feeding it a value that is not itself seed-reproducible -
 * scriptGenerator.ts's newScriptId, for instance, which is Date.now() plus
 * Math.random() - hands you a value that changes between runs of the same seed,
 * which is worse than a draw.
 *
 * NOTE this is one of six copies of the same FNV-1a core in the engine, and it
 * is deliberately NOT the one true version - they differ in the tail, so folding
 * any of them together would silently move live values for no benefit:
 *
 *   engine/actingModel.ts:stableUnit              `% 100000 / 100000`  (exported)
 *   engine/personality.ts:hashUnit                `% 100000 / 100000`
 *   engine/castingPresentation.ts:stablePick      `% options.length`
 *   engine/castPerformancePresentation.ts:stablePick  `% options.length`
 *   engine/distribution.ts:seedFromId             raw `h >>> 0`
 *
 * actingModel's is the one to be most careful with: it is exported, it is
 * byte-identical to personality's, and it feeds derived craft - so it has the
 * widest blast radius of the six despite looking like a local helper. If anyone
 * does consolidate these one day, that is the one to do last and measure.
 */
export function hashUnit(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/**
 * A seed for a stream that runs alongside this one, taking exactly ONE draw
 * from the parent - the shared idiom for "this work needs its own stream".
 *
 * Its purpose is insulation. Two pieces of generation drawing from one stream
 * are coupled: change how many draws the first one takes and the second one's
 * results move, however unrelated they are. Forking a seed for the second BEFORE
 * running the first breaks that coupling in the direction that matters - the
 * second depends on the parent seed alone, and no longer on the first's
 * appetite. (See state/testFixtures.ts for the case this was extracted from.)
 *
 * Same range as withRng's own trailing draw below, deliberately: one spelling of
 * "draw a seed", not three.
 *
 * Caveat worth knowing before leaning on the word "independent": mulberry32
 * advances its state by a CONSTANT (createRng above), so every seed walks the
 * same cycle at a different phase. A forked stream is therefore a random offset
 * into the parent's own sequence rather than a genuinely separate generator.
 * Over the few thousand draws any one of these streams takes, the chance of
 * overlapping the parent is negligible (~1e-6), but this is not the primitive to
 * reach for if you ever need real statistical independence.
 */
export function forkSeed(rng: RandomFn): number {
  return randInt(rng, 1, 2 ** 31 - 1);
}

/** A child stream from `forkSeed` - see its note for what "child" does and does not mean here. */
export function forkRng(rng: RandomFn): RandomFn {
  return createRng(forkSeed(rng));
}

/** Runs `fn` with a deterministic RNG seeded from `seed`, returning the advanced seed to store back. */
export function withRng<T>(seed: number, fn: (rng: RandomFn) => T): { result: T; nextSeed: number } {
  const rng = createRng(seed);
  const result = fn(rng);
  const nextSeed = randInt(rng, 1, 2 ** 31 - 1);
  return { result, nextSeed };
}
