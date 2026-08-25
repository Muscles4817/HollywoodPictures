// The director bake-off (Phase B2 - docs/DESIGN_director_pitch_and_bakeoff.md).
// For a non-marquee director slot the player opens the role for *pitches* instead
// of approaching a name: interested directors submit a DirectorPitch over the
// next few in-game weeks, and the player picks one (or passes). This module owns
// two pure steps - opening a round (who will pitch, and when) and the day-tick
// that lands due pitches - mirroring engine/castingCalls.ts's openCastingCall /
// tickCastingCalls shape and its "tick every day, gate work behind a stored
// due-day" discipline.
//
// Deterministic, like the pitch itself: who pitches is fixed at open time
// (stableUnit, not rng), so the round never reshuffles on an unrelated tick and
// re-opening the same slot yields the same field. That also means a bake-off
// can't be re-rolled for a better pitch - its only cost is the calendar time
// spent waiting, which is real under the game's clock.
import type { DirectorPitch, DirectorPitchProcess, FilmDraft, GameDay, Money, Person, ScheduledPitch, Script, Studio } from '../types';
import { computeDirectorAppeal } from './directorAppeal';
import { computeAcceptanceThreshold } from './castingAppeal';
import { generateDirectorPitch } from './directorPitch';
import { stableUnit } from './actingModel';
import { NO_RELATIONSHIP, type RelationshipStanding } from './relationships';
import { clamp } from './random';

type RelationshipLookup = (personId: string) => RelationshipStanding;

// First-draft, tunable constants. Pitching is lower-commitment than accepting a
// firm offer, so the interest bar sits a notch below the offer threshold.
const PITCH_BAR_RELIEF = 12;
// The two-tier split, in reverse: a working director is eager to pitch, a
// near-marquee name rarely deigns to (they expect to be offered). Inclination
// falls with fame and bottoms out at the ceiling.
const FAME_PITCH_CEILING = 85;
const MIN_PITCH_INCLINATION = 0.05;
// A bake-off surfaces a handful of the most-interested directors, not the whole
// eligible pool - the review is a comparison, not a slog.
const MAX_PITCHES = 6;
// How long a pitch takes to land: a floor plus a per-director stable spread, so
// they arrive staggered over a few weeks rather than all at once.
const PITCH_MIN_DELAY_DAYS = 7;
const PITCH_DELAY_SPREAD_DAYS = 14;

/** How inclined a director of this fame is to pitch at all - working directors eager, marquee names rarely (0..1). */
export function pitchInclination(fame: number): number {
  return clamp(1 - fame / FAME_PITCH_CEILING, MIN_PITCH_INCLINATION, 1);
}

/**
 * The directors who would pitch for this slot, most-interested first, capped at
 * MAX_PITCHES. A director pitches when they clear their own (relieved) interest
 * bar - past every hard gate the offer path uses (prestige, schedule, salary
 * floor, taste) - AND their fame-driven inclination rolls in (deterministic per
 * director x script). Exported for the bake-off UI's forecast and for tests.
 */
export function willingPitchers(
  script: Script,
  studio: Studio,
  directorPool: Person[],
  advertisedFee: Money,
  totalDays: GameDay,
  relationshipOf: RelationshipLookup = () => NO_RELATIONSHIP,
): Person[] {
  const interested: Array<{ director: Person; overall: number }> = [];
  for (const director of directorPool) {
    const relationship = relationshipOf(director.id);
    const appeal = computeDirectorAppeal(director, script, studio, advertisedFee, totalDays, relationship);
    if (!appeal || appeal === 'prestige-gate') continue;
    if (appeal.schedule.status !== 'available' || appeal.belowSalaryFloor || appeal.belowTasteFloor) continue;
    if (appeal.overall < computeAcceptanceThreshold(director, relationship) - PITCH_BAR_RELIEF) continue;
    if (stableUnit(`${director.id}|pitch|${script.id}`) >= pitchInclination(director.reputation.fame)) continue;
    interested.push({ director, overall: appeal.overall });
  }
  return interested.sort((a, b) => b.overall - a.overall).slice(0, MAX_PITCHES).map((entry) => entry.director);
}

/**
 * Open a bake-off for the Director slot: fix the field of pitchers and stagger
 * their due days. Returns an empty-pending process when no one bites (the player
 * still sees the outcome and can pass / raise the fee / approach a name). Pure -
 * the reducer stores the result on the draft.
 */
export function openDirectorPitches(
  script: Script,
  studio: Studio,
  directorPool: Person[],
  advertisedFee: Money,
  totalDays: GameDay,
  relationshipOf: RelationshipLookup = () => NO_RELATIONSHIP,
): DirectorPitchProcess {
  const pending: ScheduledPitch[] = willingPitchers(script, studio, directorPool, advertisedFee, totalDays, relationshipOf).map((director) => ({
    directorId: director.id,
    dueDay: totalDays + PITCH_MIN_DELAY_DAYS + Math.floor(stableUnit(`${director.id}|due|${script.id}`) * PITCH_DELAY_SPREAD_DAYS),
  }));
  return { openedOnDay: totalDays, advertisedFee, pending, submitted: [] };
}

/**
 * The pitches on this draft that have landed but the player hasn't read yet -
 * the Inbox's "the pitches are in" beat (components/common/Inbox.tsx). Opening
 * the bake-off panel marks them seen (ACKNOWLEDGE_DIRECTOR_PITCHES), so this
 * pings once per arrival rather than nagging until the round is decided - the
 * same read-state contract screen tests and casting applicants already use.
 */
export function directorPitchesAwaitingReview(draft: FilmDraft): DirectorPitch[] {
  return (draft.directorPitches?.submitted ?? []).filter((pitch) => !pitch.acknowledged);
}

/**
 * The day-tick: land every pitch whose due-day has arrived, moving it from
 * `pending` to `submitted`. Returns the draft unchanged when there's no open
 * round or nothing is due yet (the identity short-circuit the reducer relies on
 * to avoid churn) - the same contract as tickCastingCalls.
 */
export function tickDirectorPitches(draft: FilmDraft, totalDays: GameDay, directorPool: Person[]): FilmDraft {
  const process = draft.directorPitches;
  if (!process || !draft.script || process.pending.length === 0) return draft;
  const due = process.pending.filter((p) => p.dueDay <= totalDays);
  if (due.length === 0) return draft;

  const byId = new Map(directorPool.map((person) => [person.id, person] as const));
  const landed = due
    .map((p) => byId.get(p.directorId))
    .filter((director): director is Person => director !== undefined)
    .map((director) => generateDirectorPitch(director, draft.script!));

  return {
    ...draft,
    directorPitches: {
      ...process,
      pending: process.pending.filter((p) => p.dueDay > totalDays),
      submitted: [...process.submitted, ...landed],
    },
  };
}
