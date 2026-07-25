// Talent Pairing History - the reducer wiring end to end: releasing a film
// records a pairing between each pair of key creatives, carrying the film's
// release-day outcome signals. Complements the pure-function coverage in
// engine/pairHistory.test.ts by exercising the settlement path that actually
// appends to GameState.talentPairings.
import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { buildStateWithReadyDraft } from './testFixtures';
import { playerReleasedFilms } from '../engine/project';
import { pairHistory } from '../engine/pairHistory';

describe('releasing a film records talent pairings', () => {
  it('appends one pairing per pair of key creatives (director<->lead, director<->supporting, lead<->supporting)', () => {
    const ready = buildStateWithReadyDraft(4817);
    const released = studioReducer(ready, { type: 'SCHEDULE_RELEASE', releaseDay: 1 });

    const film = playerReleasedFilms(released.projects)[0];
    expect(film).toBeDefined();

    const pairings = released.talentPairings ?? [];
    // The ready draft carries a Director, a Lead Actor and a Supporting Actor -
    // three people, so three distinct pairs.
    expect(pairings).toHaveLength(3);
    expect(pairings.every((p) => p.filmId === film.id)).toBe(true);
    expect(pairings.every((p) => p.personA <= p.personB)).toBe(true); // canonical order

    // Every pair of key people now has a shared-history entry.
    const key = film.talent.filter((a) => a.role === 'Director' || a.role === 'Lead Actor' || a.role === 'Supporting Actor');
    for (let i = 0; i < key.length; i++) {
      for (let j = i + 1; j < key.length; j++) {
        const h = pairHistory(pairings, key[i].person.id, key[j].person.id);
        expect(h).not.toBeNull();
        expect(h!.films).toBe(1);
      }
    }
  });

  it('does not double-record across subsequent calendar-advancing settlement passes', () => {
    const ready = buildStateWithReadyDraft(4817);
    let s = studioReducer(ready, { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    const afterRelease = (s.talentPairings ?? []).length;
    for (let i = 0; i < 5; i++) s = studioReducer(s, { type: 'ADVANCE_DAY' });
    expect((s.talentPairings ?? []).length).toBe(afterRelease);
  });
});
