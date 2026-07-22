// Marketing rollout (docs/DESIGN_REVIEW_marketing_rollout.md): a campaign is a
// rollout that takes place over the weeks before release, not an instant switch
// flipped on release day. SCHEDULE_RELEASE freezes when the campaign commits
// (campaignStartDay); the runway to the release day earns the campaign
// rollout-momentum, so a release given time to build lands harder than one
// rushed straight out - while a same-day release stays exactly the neutral
// baseline the rest of the suite is calibrated against.
import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { buildStateWithReadyDraft } from './testFixtures';
import { playerReleasedFilms } from '../engine/project';
import { MAX_SIMULATION_WEEKS } from '../engine/audienceSimulationStep';
import { CAMPAIGN_FULL_ROLLOUT_WEEKS } from '../data/marketing';
import type { GameState } from './gameState';

/** A release-ready state with no rivals, so competitive crowding is identical whatever calendar day a release settles on. */
function soloState(seed: number): GameState {
  const base = buildStateWithReadyDraft(seed);
  return { ...base, rivalStudios: [] };
}

function advanceDays(state: GameState, n: number): GameState {
  let s = state;
  for (let i = 0; i < n; i++) s = studioReducer(s, { type: 'ADVANCE_DAY' });
  return s;
}

describe('SCHEDULE_RELEASE - marketing rollout', () => {
  it('freezes the campaign start day onto the release', () => {
    const released = studioReducer(soloState(4), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    const film = playerReleasedFilms(released.projects)[0];
    // A same-day release commits its campaign on the day it goes out (day 1).
    expect(film.marketingChoices.campaignStartDay).toBe(1);
  });

  it('a same-day (rushed) release is the neutral baseline - a full-runway hold opens bigger for the identical film', () => {
    const rushedState = soloState(7);
    const rushed = studioReducer(rushedState, { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    const rushedFilm = playerReleasedFilms(rushed.projects)[0];

    // The same film, held a full rollout past the earliest date.
    const heldReleaseDay = 1 + CAMPAIGN_FULL_ROLLOUT_WEEKS * 7;
    const scheduled = studioReducer(soloState(7), { type: 'SCHEDULE_RELEASE', releaseDay: heldReleaseDay });
    const settled = advanceDays(scheduled, heldReleaseDay + MAX_SIMULATION_WEEKS * 7 + 7);
    const heldFilm = playerReleasedFilms(settled.projects)[0];

    expect(heldFilm.marketingChoices.campaignStartDay).toBe(1);
    // The rollout momentum a full runway builds lifts the opening; the rushed
    // release realises only the campaign's baseline reach.
    expect(heldFilm.results.openingWeekend).toBeGreaterThan(rushedFilm.results.openingWeekend);
  });
});
