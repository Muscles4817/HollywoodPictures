// Marketing rollout (docs/DESIGN_REVIEW_marketing_rollout.md): a campaign is a
// rollout that takes place over the weeks before release, not an instant switch
// flipped on release day. SCHEDULE_RELEASE freezes when the campaign commits
// (campaignStartDay); the runway to the release day earns the campaign
// rollout-momentum, so a release given time to build lands harder than one
// rushed straight out. And rushing is not neutral for a WIDE release
// (docs/DESIGN_REVIEW_rush_penalty_and_screen_collapse.md): it opens soft, and
// a self-distributed one that plays to empty seats is pulled from theatres.
import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { buildStateWithReadyDraft } from './testFixtures';
import { playerReleasedFilms } from '../engine/project';
import { MAX_SIMULATION_WEEKS } from '../engine/audienceSimulationStep';
import { CAMPAIGN_FULL_ROLLOUT_WEEKS } from '../data/marketing';
import type { GameState } from './gameState';
import type { DistributionMethod } from '../engine/distribution';
import { wasPulledFromTheatres } from '../engine/boxOfficeRun';

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

/** A release-ready Wide release from a studio with a full Distribution Arm, distributed as asked. */
function wideState(seed: number, method: DistributionMethod): GameState {
  const base = soloState(seed);
  const projects = base.projects.map((p) =>
    p.kind === 'player-in-progress' ? { ...p, draft: { ...p.draft, marketingChoices: { ...p.draft.marketingChoices!, distributionMethod: method } } } : p,
  );
  return { ...base, projects, studio: { ...base.studio, distributionArm: { tier: 3, internationalTier: 3 } } };
}

function releaseAfter(state: GameState, runwayWeeks: number) {
  const releaseDay = 1 + runwayWeeks * 7;
  const scheduled = studioReducer(state, { type: 'SCHEDULE_RELEASE', releaseDay });
  return playerReleasedFilms(advanceDays(scheduled, releaseDay + MAX_SIMULATION_WEEKS * 7 + 7).projects)[0];
}

describe('SCHEDULE_RELEASE - rushed wide release', () => {
  it('a self-distributed Wide release rushed out cold is pulled from theatres and loses money the held release makes', () => {
    const rushed = releaseAfter(wideState(3, 'self'), 0);
    const held = releaseAfter(wideState(3, 'self'), CAMPAIGN_FULL_ROLLOUT_WEEKS);

    expect(rushed.marketingChoices.distributionMethod).toBe('self');
    expect(wasPulledFromTheatres(rushed)).toBe(true);
    expect(wasPulledFromTheatres(held)).toBe(false);
    // Opens soft, runs short, and the run's total collapses with it.
    expect(rushed.results.openingWeekend).toBeLessThan(held.results.openingWeekend * 0.7);
    expect(rushed.boxOfficeRun.simWeeks.length).toBeLessThan(held.boxOfficeRun.simWeeks.length);
    expect(rushed.results.totalBoxOffice!).toBeLessThan(held.results.totalBoxOffice! * 0.6);
    // The same film: a deep loss rushed, a profit held.
    expect(held.results.profit!).toBeGreaterThan(0);
    expect(rushed.results.profit!).toBeLessThan(0);
  });

  it('a distributor deal is never pulled - the distributor was already running the campaign', () => {
    for (const seed of [3, 7, 11]) {
      const rushed = releaseAfter(wideState(seed, 'distributor'), 0);
      expect(rushed.marketingChoices.distributionMethod).toBe('distributor');
      expect(rushed.boxOfficeRun.fixed.screenCollapseArmed).toBe(false);
      expect(wasPulledFromTheatres(rushed)).toBe(false);
    }
  });

  it('a Limited release opens on its platform as it always did - rushing a platform release costs nothing', () => {
    const limited = (method: DistributionMethod) => {
      const s = wideState(3, method);
      return {
        ...s,
        projects: s.projects.map((p) =>
          p.kind === 'player-in-progress' ? { ...p, draft: { ...p.draft, marketingChoices: { ...p.draft.marketingChoices!, releaseType: 'Limited' as const } } } : p,
        ),
      };
    };
    const rushed = releaseAfter(limited('self'), 0);
    expect(rushed.boxOfficeRun.fixed.openingRushMultiplier).toBe(1);
    expect(rushed.boxOfficeRun.fixed.screenCollapseArmed).toBe(false);
  });
});
