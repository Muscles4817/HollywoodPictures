// Coherent name drawing (data/talentNames.ts).
//
// The one place a procedural name's two halves are chosen, shared by all three
// callers: talent (engine/talentGenerator.ts), script characters
// (engine/scriptGenerator.ts) and film titles (engine/titleGenerator.ts). A
// character called "Duke Suzuki" is exactly as wrong as a person called that.
//
// TWO PROPERTIES THIS MODULE EXISTS TO HOLD AT ONCE:
//
//  1. The halves agree. Names correlate in life; drawing them independently
//     across ten regions put ~80% of people on a cross-region pairing, which
//     reads as GENERATED rather than as cosmopolitan. A deliberate minority
//     still mix (CROSS_REGION_CHANCE) - mixed heritage, marriage and chosen
//     professional names are real - but as a minority, not the default.
//
//  2. The rng draw COUNT is unchanged. Every stochastic outcome in the
//     simulation shares one seeded sequence, so spending an extra draw per
//     person here would shift talent stats, production events, rival behaviour
//     and box office alike - a flavour change masquerading as a balance change.
//     (engine/talentGenerator.ts's own note is emphatic about this, having been
//     bitten by it.) Region choice therefore costs NO draw of its own: the
//     first-name pool is pre-weighted so a single uniform pick is simultaneously
//     a weighted choice of region and a uniform choice within it, and the
//     cross-region roll is hash-derived rather than drawn.
import type { TalentProfession } from '../types';
import {
  DEFAULT_NAME_REGION_WEIGHTS,
  NAME_BANKS,
  NAME_REGIONS,
  NAME_REGION_WEIGHTS_BY_ROLE,
  REGION_OF_FIRST_NAME,
  TALENT_FIRST_NAMES,
  TALENT_LAST_NAMES,
  type NameRegion,
  type NameRegionWeights,
} from '../data/talentNames';
import { pick, type RandomFn } from './random';

/** How often the two halves come from different traditions - see property 1 above. */
export const CROSS_REGION_CHANCE = 0.18;

/** FNV-1a. Cheap, well-mixed, dependency-free, and identical across runs and platforms. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A stable 0-1 value for one subject and one decision, independent of the shared rng. */
export function nameVariant(seed: string, salt: number): number {
  return hashString(`${seed}#${salt}`) / 0x100000000;
}

/**
 * A pool with each region's names repeated in proportion to its weight, so one
 * uniform draw is a weighted region choice and a uniform within-region choice at
 * the same time. Built once per (role, half) and cached; the arrays are a few
 * thousand short strings.
 */
const poolCache = new Map<string, string[]>();

function weightedPool(key: string, weights: NameRegionWeights, half: 'first' | 'last'): string[] {
  const cacheKey = `${key}|${half}`;
  const cached = poolCache.get(cacheKey);
  if (cached) return cached;
  const pool: string[] = [];
  for (const region of NAME_REGIONS) {
    // Rounded up so any non-zero weight is genuinely reachable; a region with no
    // entry simply never comes up.
    const copies = Math.ceil(weights[region] ?? 0);
    for (let i = 0; i < copies; i += 1) pool.push(...NAME_BANKS[region][half]);
  }
  const built = pool.length > 0 ? pool : half === 'first' ? TALENT_FIRST_NAMES : TALENT_LAST_NAMES;
  poolCache.set(cacheKey, built);
  return built;
}

/** The regional mix for a role - its own survey-anchored entry, or the pooled default. */
export function regionWeightsForRole(role: TalentProfession | undefined): NameRegionWeights {
  return (role && NAME_REGION_WEIGHTS_BY_ROLE[role]) || DEFAULT_NAME_REGION_WEIGHTS;
}

export interface DrawnName {
  first: string;
  last: string;
  /** The first name's tradition. Undefined only if a name somehow sits outside every bank. */
  region: NameRegion | undefined;
  /** True when the surname was deliberately drawn from another tradition. */
  crossRegion: boolean;
}

/**
 * Draws a coherent first/last pair in EXACTLY TWO rng draws - the same two the
 * flat banks always took. `seed` distinguishes two people who drew the same
 * first name so they do not receive identical treatment downstream.
 */
export function drawCoherentName(rng: RandomFn, seed: string, weights = DEFAULT_NAME_REGION_WEIGHTS, poolKey = '*'): DrawnName {
  const first = pick(rng, weightedPool(poolKey, weights, 'first'));
  const region = REGION_OF_FIRST_NAME.get(first);
  const crossRegion = region === undefined || nameVariant(`${first}|${seed}`, 5) < CROSS_REGION_CHANCE;
  const last = pick(rng, crossRegion ? TALENT_LAST_NAMES : NAME_BANKS[region].last);
  return { first, last, region, crossRegion };
}

/** Just a surname, in one draw - for possessive film titles ("Callahan's Redemption"). */
export function drawSurname(rng: RandomFn, weights = DEFAULT_NAME_REGION_WEIGHTS, poolKey = '*'): string {
  return pick(rng, weightedPool(poolKey, weights, 'last'));
}

/**
 * A plausible nationality for a finished name, read from the region its SURNAME
 * belongs to - not the first name's, since a mixed name reads by its surname.
 * Derived, never drawn. Populates PersonIdentity.nationality, which existed and
 * was displayed but was never set by anything.
 *
 * KNOWN COARSENESS: the regions group several traditions each ('France, Iberia,
 * Italy'; 'Germany, Low Countries, Nordics'), so the nationality is drawn from
 * the whole region and can sit beside a name from a different tradition within
 * it - "Marisol Palacios (French)". It is right at region granularity and only
 * approximate below that. Fixing it properly means sub-grouping each region's
 * surnames by nationality, which is a data change rather than a logic one; the
 * field is display-only, so this is recorded rather than blocking.
 */
export function nationalityFor(fullName: string): string | undefined {
  const surname = fullName.split(' ').pop()?.split('-')[0];
  if (!surname) return undefined;
  const region = NAME_REGIONS.find((r) => NAME_BANKS[r].last.includes(surname));
  if (!region) return undefined;
  const options = NAME_BANKS[region].nationalities;
  return options[Math.floor(nameVariant(fullName, 6) * options.length)];
}
