// Roadmap Phase 7.2's release-resolution behavior, retargeted onto
// engine/marketSettlement.ts:settleTheatricalMarket - the box-office-and-
// release-resolution job engine/scheduledReleases.ts's own
// settleScheduledReleases used to do in isolation now lives there, unified
// with rival release resolution and ongoing box office settlement so every
// film can genuinely compete for screens (see the "Live screen competition"
// implementation plan). No running films and no rival activity in any of
// these fixtures, so settledFilms is exactly the newly-resolved set - same
// assertions as before settleScheduledReleases retired, just against the
// new call site and field names (newlyReleased -> settledFilms,
// costCharged -> playerCostCharged).
import { describe, it, expect } from 'vitest';
import { settleTheatricalMarket } from './marketSettlement';
import { buildReadyDraft } from '../state/testFixtures';
import { withRng } from './random';

function readyDraft(seed: number) {
  return withRng(seed, (rng) => buildReadyDraft(rng)).result;
}

describe('settleTheatricalMarket - player release resolution (roadmap Phase 7.2)', () => {
  it('leaves a not-yet-due release untouched', () => {
    const draft = readyDraft(1);
    const { result } = withRng(2, (rng) => settleTheatricalMarket([], [{ draft, releaseDay: 100 }], [], [], 50, 50, rng));
    expect(result.stillScheduled).toEqual([{ draft, releaseDay: 100 }]);
    expect(result.settledFilms).toHaveLength(0);
    expect(result.playerCostCharged).toBe(0);
  });

  it('resolves a due release into a Film that keeps the exact id its draft carried', () => {
    const draft = readyDraft(2);
    const { result } = withRng(3, (rng) => settleTheatricalMarket([], [{ draft, releaseDay: 40 }], [], [], 40, 50, rng));
    expect(result.stillScheduled).toHaveLength(0);
    expect(result.settledFilms).toHaveLength(1);
    const film = result.settledFilms[0];
    expect(film.id).toBe(draft.id);
    expect(film.releasedOnDay).toBe(40);
    expect(film.boxOfficeRun.status).toBe('running');
    expect(result.playerCostCharged).toBeGreaterThan(0);
  });

  it('a big jump past releaseDay resolves the same film, on the same scheduled day, as a jump that lands exactly on it', () => {
    const draftA = readyDraft(4);
    const draftB = { ...readyDraft(4), id: draftA.id }; // same generated content, forced to the same id for an apples-to-apples compare
    const { result: exact } = withRng(5, (rng) => settleTheatricalMarket([], [{ draft: draftA, releaseDay: 40 }], [], [], 40, 50, rng));
    const { result: overshoot } = withRng(5, (rng) => settleTheatricalMarket([], [{ draft: draftB, releaseDay: 40 }], [], [], 90, 50, rng));
    expect(overshoot.settledFilms[0].releasedOnDay).toBe(40); // the scheduled day, not the day the jump actually landed on
    expect(overshoot.settledFilms[0].results).toEqual(exact.settledFilms[0].results);
  });

  it('resolves several due releases in the same pass, each keeping its own id', () => {
    const draftA = readyDraft(6);
    const draftB = readyDraft(7);
    const { result } = withRng(8, (rng) =>
      settleTheatricalMarket([], [{ draft: draftA, releaseDay: 30 }, { draft: draftB, releaseDay: 35 }], [], [], 40, 50, rng),
    );
    expect(result.settledFilms.map((f) => f.id).sort()).toEqual([draftA.id, draftB.id].sort());
    expect(result.stillScheduled).toHaveLength(0);
  });

  it('a higher studioBrand at resolution time (not scheduling time) measurably changes the outcome - proves results are computed fresh on release day, not frozen at SCHEDULE_RELEASE', () => {
    const draft = readyDraft(9);
    const { result: lowRep } = withRng(10, (rng) => settleTheatricalMarket([], [{ draft, releaseDay: 40 }], [], [], 40, 10, rng));
    const { result: highRep } = withRng(10, (rng) => settleTheatricalMarket([], [{ draft, releaseDay: 40 }], [], [], 40, 90, rng));
    expect(lowRep.settledFilms[0].results.buzzScore).not.toBe(highRep.settledFilms[0].results.buzzScore);
  });
});
