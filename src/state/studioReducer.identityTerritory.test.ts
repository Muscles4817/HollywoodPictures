// Studio identity as home-turf territory (engine/studioIdentity.ts). At
// SCHEDULE_RELEASE the studio's identity in the film's genre is frozen onto the
// release (MarketingChoices.studioGenreIdentity), the player-side analogue of
// the snapshot a rival freezes onto its own production. That frozen value lifts
// the release's competitive presence (engine/releaseCrowding.ts) so a rival
// choosing its release day steers around the player's home genre - "majors
// defend their territory," now symmetric between the player and the AI.
import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { buildStateWithReadyDraft } from './testFixtures';
import { asPlayerDraft, findProject, playerReleasedFilms } from '../engine/project';

describe('SCHEDULE_RELEASE - genre identity freeze (home-turf territory)', () => {
  it('freezes the studio identity in the film genre onto the release', () => {
    const base = buildStateWithReadyDraft(3);
    const genre = asPlayerDraft(findProject(base.projects, base.focusedProjectId))!.genre!;
    const state = { ...base, studio: { ...base.studio, genreIdentity: { [genre]: 70 } } };

    // A same-day release resolves immediately, so the frozen choices are visible on the Film.
    const released = studioReducer(state, { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    const film = playerReleasedFilms(released.projects)[0];
    expect(film.marketingChoices.studioGenreIdentity).toBe(70);
  });

  it('a studio with no identity in the genre freezes 0, not undefined - the explicit pre-identity baseline', () => {
    const base = buildStateWithReadyDraft(3);
    const released = studioReducer(base, { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    const film = playerReleasedFilms(released.projects)[0];
    expect(film.marketingChoices.studioGenreIdentity).toBe(0);
  });
});
