// Coherent name generation (data/talentNames.ts).
//
// The one place a procedural person's or character's name is assembled. It
// exists because the three callers (talent, script characters, film titles) all
// used to do the same broken thing independently:
//
//     `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`
//
// Drawing the halves independently made ~80% of generated names cross-origin
// pairs - "Priyanka Flanagan", "Duke Suzuki", "Karim Chen". Those do not read as
// foreign; they read as GENERATED. A name is drawn as a coherent PAIR from one
// origin bank instead, with the origin chosen by a per-role weight.
//
// Pure: plain data plus an rng in, plain data out.
import type { TalentProfession } from '../types';
import {
  DEFAULT_NAME_ORIGIN_WEIGHTS,
  NAME_BANKS,
  NAME_ORIGIN_WEIGHTS_BY_ROLE,
  type NameBank,
  type NameOrigin,
  type NameOriginWeights,
} from '../data/talentNames';
import { pick, weightedPick, type RandomFn } from './random';

const ALL_ORIGINS = Object.keys(NAME_BANKS) as NameOrigin[];

export interface GeneratedName {
  /** "First Last", both halves from the same origin bank. */
  name: string;
  /** Which naming tradition it was drawn from - how the name READS, never a claim about anyone's heritage. */
  origin: NameOrigin;
  /** A plausible nationality for that tradition, for PersonIdentity.nationality. */
  nationality: string;
}

/** The origin mix for a role - its own entry if the survey covered it, otherwise the pooled default. */
export function nameOriginWeightsForRole(role: TalentProfession | undefined): NameOriginWeights {
  return (role && NAME_ORIGIN_WEIGHTS_BY_ROLE[role]) || DEFAULT_NAME_ORIGIN_WEIGHTS;
}

/**
 * A full name drawn coherently from one weighted origin.
 *
 * Nationality is derived from a stable hash of the finished name rather than a
 * further rng draw - the same trick engine/scriptGenerator.ts already uses for
 * a character's casting gender and age band, and for the same reason: it keeps
 * the number of rng calls (and so every seeded sequence downstream) independent
 * of how much detail is hung off a name.
 */
export function generateFullName(rng: RandomFn, weights: NameOriginWeights = DEFAULT_NAME_ORIGIN_WEIGHTS): GeneratedName {
  const origin = weightedPick(rng, ALL_ORIGINS, weights);
  const bank = NAME_BANKS[origin];
  const { surname, nationality } = drawSurname(rng, bank);
  // A surname that is also a first name in its own bank would otherwise produce
  // "Thibault Thibault". Step to the next first name rather than re-rolling, so
  // the number of rng draws stays fixed and every seeded sequence downstream is
  // unaffected by how often the collision happens.
  const firstIndex = bank.first.indexOf(pick(rng, bank.first));
  const first = bank.first[firstIndex] === surname
    ? bank.first[(firstIndex + 1) % bank.first.length]
    : bank.first[firstIndex];
  return { name: `${first} ${surname}`, origin, nationality };
}

/**
 * A surname plus the nationality it reads as. Nationalities are weighted by how
 * many surnames each carries, so a family's commoner naming traditions come up
 * more often than its rarer ones.
 */
function drawSurname(rng: RandomFn, bank: NameBank): { surname: string; nationality: string } {
  const nationalities = Object.keys(bank.last);
  const weights = Object.fromEntries(nationalities.map((n) => [n, bank.last[n].length]));
  const nationality = weightedPick(rng, nationalities, weights);
  return { surname: pick(rng, bank.last[nationality]), nationality };
}

/** Just a surname, drawn from a weighted origin - for possessive film titles ("Callahan's Redemption"). */
export function generateSurname(rng: RandomFn, weights: NameOriginWeights = DEFAULT_NAME_ORIGIN_WEIGHTS): string {
  return drawSurname(rng, NAME_BANKS[weightedPick(rng, ALL_ORIGINS, weights)]).surname;
}
