// Where ids are minted.
//
// Ids are meant to be pure identity, and in normal play they are minted outside
// the seeded random stream on purpose (drawing one from `rng` would shift every
// later seeded roll): people, stunt teams and casting calls from process-wide
// counters, screenplays and drafts from the clock plus Math.random().
//
// But ids are not *only* identity. Several gameplay rolls are keyed on them so
// that they stay stable without consuming a draw - a person's craft aptitudes
// and specialties (creativeAptitudes.ts, crewSpecialty.ts, actingModel.ts), a
// director's demands and pitches (creativeDemands.ts, directorPitches.ts, keyed
// on the script id), a film's distributor offers (distribution.ts, keyed on the
// draft id). So two games from the same seed do not play out the same, and a
// second studio generated in the same process differs from the first.
//
// That is tolerable for a player and fatal for a measurement: a balance change
// cannot be told from noise if the baseline will not repeat. `withReplayableIds`
// is the way out - inside it every id comes from counters that start at 1, so a
// run depends on its seed alone. Normal play never calls it and is unchanged.
//
// This module holds state, which the rest of engine/ does not. It always did -
// the counters just lived in three different files.

type CounterKind = 'person' | 'stuntTeam' | 'castingCall' | 'unique';

const freshCounters = (): Record<CounterKind, number> => ({ person: 1, stuntTeam: 1, castingCall: 1, unique: 1 });

let counters = freshCounters();
let replayable = false;

/** The next number in a kind's sequence. People and producers share one sequence, as they always have. */
export function nextSequence(kind: Exclude<CounterKind, 'unique'>): number {
  return counters[kind]++;
}

/**
 * An id that will not collide with one minted in an earlier session of the same
 * save - for screenplays and drafts, which outlive a page reload where a
 * counter would restart at 1.
 */
export function uniqueId(prefix: string): string {
  if (replayable) return `${prefix}-r${counters.unique++}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Run `fn` with every id minted from counters starting at 1, so the result
 * depends only on the seeds `fn` uses. Restores the previous id state after,
 * so ids minted outside are unaffected. For harnesses and tests, not for play:
 * ids minted inside repeat from one call to the next, by design.
 */
export function withReplayableIds<T>(fn: () => T): T {
  const saved = { counters, replayable };
  counters = freshCounters();
  replayable = true;
  try {
    return fn();
  } finally {
    counters = saved.counters;
    replayable = saved.replayable;
  }
}
