// Personality archetypes — turning the six previously-flat personality axes
// (ambition, loyalty, temperament, pressureHandling, controversy, adaptability)
// into varied-but-coherent numbers so the trait-derivation engine
// (engine/personTraits.ts) can actually fire.
//
// The design goal is the one SIMULATION_PHILOSOPHY.md draws a line under:
// **variance is not uniqueness**. Six independent uniform rolls would give a
// numerically "varied" roster of incoherent noise — a person high on ambition,
// loyalty AND controversy at once reads as nothing at all. Instead every person
// is drawn from a small set of latent ARCHETYPES — a temperamental prima donna,
// a reliable journeyman, a hungry up-and-comer, a scandal magnet, a beloved
// veteran, and so on. Each archetype is a coherent point in personality space;
// a person is that point plus modest per-axis jitter, so two "professionals"
// differ without either stopping reading as a professional.
//
// Two things keep it from feeling procedural-random:
//   1. The archetype is drawn *biased by the person's already-fixed stats*
//      (ego, reliability=professionalism, fame, prestige, respect, heat, age),
//      so a high-ego famous person genuinely tends toward the prima donna and a
//      low-ego respected veteran toward the mentor — the numbers cohere with
//      who the person already is, rather than contradicting it.
//   2. professionalism and ego are NOT invented here — they're passed in
//      already-authored/generated and carried through untouched. Only the six
//      formerly-flat axes are derived. The archetypes are chosen to sit
//      *consistently* with the fixed pair (see the trait comments per axis).
//
// STREAM SAFETY (see docs/DESIGN_REVIEW_acting_model.md §15): everything here is
// derived by HASH from stable per-person entropy, never by consuming the rng
// stream. Adding an archetype draw mid-generation would shift every downstream
// rng draw and silently reshuffle the whole talent pool, breaking seed-specific
// tests — exactly the sharp edge craft/handsOn were built to avoid. Hashing
// keeps the generation stream byte-identical while making personality
// deterministic and stable per person. Pure: plain data in, plain data out.
import type { Person, PersonPersonality } from '../types';
import { clamp } from './random';

/** The six axes this module derives — professionalism and ego are fixed inputs, not derived. */
type DerivedAxes = Pick<
  PersonPersonality,
  'ambition' | 'loyalty' | 'temperament' | 'pressureHandling' | 'controversy' | 'adaptability'
>;

/** The stats already decided for a person before their personality is derived — the archetype draw is biased by these so the result coheres with who they already are. */
export interface FixedTraits {
  professionalism: number; // === reliability
  ego: number;
  fame: number;
  prestige: number;
  industryRespect: number;
  currentHeat: number;
  /** Years old — biases hungry-upstart (young) vs beloved-veteran (old). Defaults to a mid-career ~42 when unknown. */
  age?: number;
}

/**
 * A latent personality archetype: a coherent centroid over the six derived
 * axes, plus how strongly it's drawn given a person's fixed stats. The
 * comments name the traits each archetype is built to surface through
 * engine/personTraits.ts once combined with the fixed professionalism/ego.
 */
interface Archetype {
  key: string;
  /** Centroid for the six derived axes (0–100). A person is this + per-axis jitter. */
  target: DerivedAxes;
  /** How common this archetype is before stat-affinity is applied. */
  baseWeight: number;
  /** A non-negative multiplier on baseWeight from the person's fixed stats — the coherence bias. */
  affinity: (f: NormalizedFixed) => number;
}

// Fixed stats mapped to 0–1 once, so affinity curves read cleanly.
interface NormalizedFixed {
  ego: number;
  reliability: number;
  fame: number;
  prestige: number;
  respect: number;
  heat: number;
  age: number;
}

// Affinity shaping helpers — gentle [0.35, 1.35] curves so no archetype is ever
// impossible (every draw keeps a floor of probability) but stats meaningfully
// tilt the odds. `hi` favours a high stat, `lo` a low one.
const hi = (x01: number) => 0.35 + x01;
const lo = (x01: number) => 0.35 + (1 - x01);

export const ARCHETYPES: readonly Archetype[] = [
  // The unremarkable-but-pleasant baseline. Deliberately the most common draw so
  // the roster isn't wall-to-wall extremes: an everyman surfaces 0–1 traits, which
  // is what keeps any single loud trait from dominating the pool.
  {
    key: 'GroundedEveryman',
    target: { ambition: 50, loyalty: 58, temperament: 60, pressureHandling: 56, controversy: 16, adaptability: 54 },
    baseWeight: 2.4,
    affinity: () => 1,
  },
  // The reliable journeyman. Even temper + low controversy + modest ambition; a
  // dependable pro who does the job and goes home. Loyalty is deliberately only
  // moderate - kept below the Mentor gate so the sheer number of low-ego, highly
  // reliable pros read as clean MediaDarlings rather than all collapsing into
  // Mentor. The genuine mentor read is reserved for the BelovedVeteran below
  // (respected AND loyal AND old).
  {
    key: 'ConsummateProfessional',
    target: { ambition: 44, loyalty: 54, temperament: 74, pressureHandling: 72, controversy: 10, adaptability: 50 },
    baseWeight: 1.5,
    affinity: (f) => hi(f.reliability) ** 1.4 * lo(f.ego),
  },
  // The exacting auteur/craftsperson. LOW adaptability against a high fixed
  // professionalism is exactly the Perfectionist read; the drive tips into
  // Workaholic.
  {
    key: 'ExactingPerfectionist',
    target: { ambition: 68, loyalty: 55, temperament: 54, pressureHandling: 66, controversy: 18, adaptability: 20 },
    baseWeight: 1.1,
    affinity: (f) => hi(f.reliability) * (0.6 + f.ego * 0.7),
  },
  // The temperamental prima donna. LOW temperament against a high fixed ego is the
  // DifficultToWorkWith read; drawn to fame + ego.
  {
    key: 'TemperamentalStar',
    target: { ambition: 60, loyalty: 40, temperament: 22, pressureHandling: 44, controversy: 44, adaptability: 34 },
    baseWeight: 1.0,
    affinity: (f) => hi(f.ego) ** 1.6 * hi(f.fame),
  },
  // The hungry up-and-comer. High ambition + low loyalty is PaychequeDriven; the
  // drive also reads Workaholic. Drawn to the young and not-yet-famous.
  {
    key: 'HungryUpstart',
    target: { ambition: 86, loyalty: 28, temperament: 52, pressureHandling: 62, controversy: 30, adaptability: 70 },
    baseWeight: 1.3,
    affinity: (f) => lo(f.fame) ** 1.3 * lo(f.age),
  },
  // The scandal magnet. High controversy is ScandalProne; drawn to heat that
  // outstrips respect. Kept comparatively rare on purpose.
  {
    key: 'ScandalMagnet',
    target: { ambition: 60, loyalty: 36, temperament: 38, pressureHandling: 40, controversy: 84, adaptability: 56 },
    baseWeight: 0.7,
    affinity: (f) => hi(f.heat) * lo(f.respect),
  },
  // The creative risk-taker. High adaptability + high pressure-handling is
  // RiskTaker; for actors with comedy/charisma it also reads NaturalImproviser.
  {
    key: 'MaverickImproviser',
    target: { ambition: 66, loyalty: 46, temperament: 56, pressureHandling: 82, controversy: 40, adaptability: 84 },
    baseWeight: 1.1,
    affinity: (f) => (0.7 + f.ego * 0.5) * (0.7 + f.fame * 0.5),
  },
  // The beloved veteran. High loyalty + even temper against a low fixed ego and
  // high respect is the Mentor read; clean fame makes them a MediaDarling too.
  {
    key: 'BelovedVeteran',
    target: { ambition: 32, loyalty: 82, temperament: 78, pressureHandling: 74, controversy: 10, adaptability: 56 },
    baseWeight: 1.1,
    affinity: (f) => hi(f.respect) * lo(f.ego) ** 1.5 * hi(f.age),
  },
];

/** A stable 0..1 value from a string via FNV-1a — a deterministic stand-in for a per-person roll that never touches the rng stream (same person always reads the same). Mirrors engine/actingModel.ts's identical helper. */
function hashUnit(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

function normalize(f: FixedTraits): NormalizedFixed {
  const age = f.age ?? 42;
  return {
    ego: clamp(f.ego, 0, 100) / 100,
    reliability: clamp(f.professionalism, 0, 100) / 100,
    fame: clamp(f.fame, 0, 100) / 100,
    prestige: clamp(f.prestige, 0, 100) / 100,
    respect: clamp(f.industryRespect, 0, 100) / 100,
    heat: clamp(f.currentHeat, 0, 100) / 100,
    // Younger → higher hungry-upstart pull, older → higher veteran pull.
    // Maps ~20→0.85, ~42→0.5, ~70→0.1 so both tails are reachable.
    age: clamp((age - 15) / 60, 0, 1),
  };
}

/** Weighted archetype pick using a stable hash roll (not rng) — base commonness × stat-affinity. */
function pickArchetype(f: NormalizedFixed, seed: string): Archetype {
  const weights = ARCHETYPES.map((a) => a.baseWeight * Math.max(0, a.affinity(f)));
  const total = weights.reduce((s, w) => s + w, 0);
  let roll = hashUnit(`${seed}:archetype`) * total;
  for (let i = 0; i < ARCHETYPES.length; i++) {
    if (roll < weights[i]) return ARCHETYPES[i];
    roll -= weights[i];
  }
  return ARCHETYPES[ARCHETYPES.length - 1];
}

/** Spread of the per-axis jitter around the archetype centroid — enough that two members of an archetype differ, small enough that the archetype still reads. */
const AXIS_SPREAD = 13;

/**
 * Derive the six formerly-flat axes for a person: pick a latent archetype
 * biased by their fixed stats, then jitter each axis around that archetype's
 * centroid. All from a stable hash of `seed`, never rng.
 */
export function deriveAxes(fixed: FixedTraits, seed: string): DerivedAxes {
  const f = normalize(fixed);
  const a = pickArchetype(f, seed);
  const jitter = (axis: keyof DerivedAxes): number =>
    Math.round(clamp(a.target[axis] + (hashUnit(`${seed}:${axis}`) - 0.5) * 2 * AXIS_SPREAD, 1, 100));
  return {
    ambition: jitter('ambition'),
    loyalty: jitter('loyalty'),
    temperament: jitter('temperament'),
    pressureHandling: jitter('pressureHandling'),
    controversy: jitter('controversy'),
    adaptability: jitter('adaptability'),
  };
}

/**
 * Build a full PersonPersonality: the fixed professionalism/ego carried through
 * untouched, the other six derived from the archetype system. The single entry
 * point used both by procedural generation (seed = stable per-person entropy)
 * and by the handcrafted long tail (seed = the person's stable `real-…` id).
 */
export function buildPersonality(fixed: FixedTraits, seed: string): PersonPersonality {
  return {
    professionalism: fixed.professionalism,
    ego: fixed.ego,
    ...deriveAxes(fixed, seed),
  };
}

// The flat sentinel the handcrafted roster (and old generator) wrote for every
// person: professionalism/ego authored, the other six left at these constants.
// A person still carrying it verbatim has an *underived* personality; anything
// else is authored (a marquee override or a hand-tuned entry) and left alone.
const FLAT_DEFAULT = {
  ambition: 50,
  loyalty: 50,
  temperament: 50,
  pressureHandling: 50,
  controversy: 20,
  adaptability: 50,
} as const;

/** True when the six derived axes still hold the flat default sentinel — i.e. nobody has authored this person's personality yet. */
export function isFlatDefaultPersonality(p: PersonPersonality): boolean {
  return (
    p.ambition === FLAT_DEFAULT.ambition &&
    p.loyalty === FLAT_DEFAULT.loyalty &&
    p.temperament === FLAT_DEFAULT.temperament &&
    p.pressureHandling === FLAT_DEFAULT.pressureHandling &&
    p.controversy === FLAT_DEFAULT.controversy &&
    p.adaptability === FLAT_DEFAULT.adaptability
  );
}

/**
 * Resolve the personality for a handcrafted, real-named person — the "sensible
 * default from existing stats" move the acting model used for craft (§9), so the
 * ~1,387-strong roster reads as recognisable people without hand-typing every
 * one:
 *
 *   1. an authored `override` (a marquee name, see data/marqueePersonalities.ts)
 *      wins outright — these are the recognisable faces where a wrong personality
 *      would jar, so they're hand-authored rather than derived;
 *   2. anyone already carrying a non-flat personality is left untouched (also
 *      authored, just inline in the data);
 *   3. everyone else — the long tail — has their six axes DERIVED from their own
 *      existing reputation + age via the same archetype system as the procedural
 *      pool, seeded by their stable `real-…` id. Their fame/prestige/respect/heat
 *      /ego already say a lot about who they are; this simply lets the archetype
 *      draw cohere with it (a low-ego respected veteran tends to the mentor; a
 *      high-ego star to the prima donna) instead of leaving them flat.
 *
 * Pure and deterministic: same person (+ same override) always resolves the same.
 */
export function resolveHandcraftedPersonality(person: Person, override?: PersonPersonality): PersonPersonality {
  if (override) return override;
  if (!isFlatDefaultPersonality(person.personality)) return person.personality;
  const dob = person.identity.dateOfBirth;
  return buildPersonality(
    {
      professionalism: person.personality.professionalism,
      ego: person.personality.ego,
      fame: person.reputation.fame,
      prestige: person.reputation.prestige,
      industryRespect: person.reputation.industryRespect,
      currentHeat: person.reputation.currentHeat,
      age: dob ? 1 - dob.year : undefined,
    },
    person.id,
  );
}
