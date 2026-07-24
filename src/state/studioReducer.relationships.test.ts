// Talent Relationship History - the reducer wiring end to end: releasing a
// film records a collaboration with each key person, and the record carries the
// film's release-day outcome signals. Complements the pure-function coverage in
// engine/relationships.test.ts by exercising the settlement path that actually
// appends to GameState.collaborations.
import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { buildStateWithReadyDraft } from './testFixtures';
import { playerReleasedFilms } from '../engine/project';
import { computeRelationship, PLAYER_STUDIO_ID } from '../engine/relationships';

describe('releasing a film records collaborations', () => {
  it('appends one collaboration per key person (director + lead + supporting), keyed to the player and the released film', () => {
    const ready = buildStateWithReadyDraft(4817);
    const keyTalent = playerReleasedFilms([]).length; // 0 - sanity that we start with no films
    expect(keyTalent).toBe(0);

    const released = studioReducer(ready, { type: 'SCHEDULE_RELEASE', releaseDay: 1 });

    const film = playerReleasedFilms(released.projects)[0];
    expect(film).toBeDefined();

    const collaborations = released.collaborations ?? [];
    // The ready draft carries a Director, a Lead Actor and a Supporting Actor.
    expect(collaborations).toHaveLength(3);
    expect(collaborations.every((c) => c.studioId === PLAYER_STUDIO_ID)).toBe(true);
    expect(collaborations.every((c) => c.filmId === film.id)).toBe(true);

    // Every key person on the film now has a standing with the studio.
    for (const assignment of film.talent.filter((a) => a.role === 'Director' || a.role === 'Lead Actor' || a.role === 'Supporting Actor')) {
      const standing = computeRelationship(collaborations, PLAYER_STUDIO_ID, assignment.person.id);
      expect(standing.collaborations).toBe(1);
      expect(standing.tier).not.toBe('none');
    }

    // The recorded outcome signals match the film's release-day results.
    const expectedReception = (film.results.criticScore + film.results.audienceScore) / 2;
    expect(collaborations.every((c) => Math.abs(c.reception - expectedReception) < 1)).toBe(true);
  });

  it('does not double-record across subsequent calendar-advancing settlement passes', () => {
    const ready = buildStateWithReadyDraft(4817);
    let s = studioReducer(ready, { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    const afterRelease = (s.collaborations ?? []).length;
    // Advance several days - each runs a settlement pass that re-sees the now-
    // running film, which must not append duplicate collaborations.
    for (let i = 0; i < 5; i++) s = studioReducer(s, { type: 'ADVANCE_DAY' });
    expect((s.collaborations ?? []).length).toBe(afterRelease);
  });
});
