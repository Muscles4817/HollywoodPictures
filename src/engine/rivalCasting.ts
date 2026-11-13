// How a rival studio chooses whom to hire (docs/DESIGN_talent_model.md §4.6,
// stage 5).
//
// Rivals used to take the people whose fee was nearest a target price and pick
// among them at random. That made price the only thing that mattered, with two
// consequences. Their films were cast with no regard for how anyone's career
// was going. And the pool had no ladder: big films went to whoever was already
// expensive - the oldest people in it, and the first to retire - while a
// newcomer or a mid-priced person on a hot streak was never given the film that
// would make them, so fees crowded toward the middle
// (docs/DESIGN_talent_model.md §7.3).
//
// A rival now looks at everyone it can afford for the film and takes the ones
// with the best track record, as it reads it: heat and fame for the people the
// public knows, the respect of colleagues and years in the job for the crafts.
// The read is imperfect, so it does not always pick the same people, and a
// cheap person on a run is exactly who gets noticed. Rivals therefore compete
// for whoever is hot - including people the player has just made hot.
//
// What a rival knows is deliberately no more than a player can see of a
// stranger: standing and experience, not ability.
//
// Pure apart from the rng it is handed.
import type { Person, ProductionRole } from '../types';
import { getCareerForRole, getTypicalSalaryForRole } from './person';
import { findCandidatesNearPrice } from './talentFilter';
import { randFloat, type RandomFn } from './random';

/** A rival will pay up to this multiple of its target for the right person... */
export const RIVAL_STRETCH_ABOVE_TARGET = 1.12;
/** ...and looks no further beneath the film than this share of the target, unless it has to. */
export const RIVAL_REACH_BELOW_TARGET = 0.35;
const WIDER_REACH_BELOW_TARGET = 0.12;
/** How far off, in points, a rival's read of someone's standing can be either way. */
export const RIVAL_READ_NOISE = 14;

const PUBLIC_ROLES = new Set<ProductionRole>(['Lead Actor', 'Supporting Actor', 'Director']);

/** A person's track record as an outsider reads it, 0-100. */
export function trackRecordScore(person: Person, role: ProductionRole): number {
  const { fame, currentHeat, industryRespect } = person.reputation;
  if (PUBLIC_ROLES.has(role)) return 0.5 * currentHeat + 0.35 * fame + 0.15 * industryRespect;
  const experience = (getCareerForRole(person, role) as { experience?: number } | null)?.experience ?? 0;
  return 0.45 * industryRespect + 0.3 * experience + 0.25 * currentHeat;
}

/**
 * The people a rival hires for one role: from those it can afford, the best
 * track records by its own imperfect read. Falls back to whoever is nearest in
 * price when nobody is in range, so a thin patch of the pool never leaves a
 * film uncast.
 */
export function chooseRivalHires(available: Person[], role: ProductionRole, targetPrice: number, count: number, rng: RandomFn): Person[] {
  if (count <= 0) return [];
  const fee = (person: Person) => getTypicalSalaryForRole(person, role);
  const wanted = Math.max(count * 3, 6);
  const inReach = (reachBelow: number) => available.filter((person) => fee(person) <= targetPrice * RIVAL_STRETCH_ABOVE_TARGET && fee(person) >= targetPrice * reachBelow);

  let shortlist = inReach(RIVAL_REACH_BELOW_TARGET);
  if (shortlist.length < wanted) shortlist = inReach(WIDER_REACH_BELOW_TARGET);
  if (shortlist.length < count) shortlist = findCandidatesNearPrice(available, role, targetPrice, wanted).candidates;

  return shortlist
    .map((person) => ({ person, read: trackRecordScore(person, role) + randFloat(rng, -RIVAL_READ_NOISE, RIVAL_READ_NOISE) }))
    .sort((a, b) => b.read - a.read)
    .slice(0, count)
    .map((entry) => entry.person);
}
