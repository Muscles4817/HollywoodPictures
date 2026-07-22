import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { buildStateWithReadyDraft } from './testFixtures';
import { playerReleasedFilms } from '../engine/project';
import { MAX_SIMULATION_WEEKS } from '../engine/audienceSimulationStep';
import { STUDIO_BOX_OFFICE_SHARE } from '../engine/boxOfficeRun';
import { RENTED_DISTRIBUTION_KEEP_MULTIPLIER, RENTED_WIDE_CEILING } from '../data/distribution';
import type { GameState } from './gameState';

/** A release-ready state whose studio has no Distribution Arm (default fixture ships one). */
function noArmState(seed: number): GameState {
  const base = buildStateWithReadyDraft(seed);
  return { ...base, studio: { ...base.studio, distributionArm: null } };
}

function runToFinish(state: GameState): GameState {
  let s = state;
  for (let i = 0; i < MAX_SIMULATION_WEEKS * 7 + 7; i++) s = studioReducer(s, { type: 'ADVANCE_DAY' });
  return s;
}

describe('UNLOCK_DISTRIBUTION_ARM', () => {
  it('is a no-op until the milestone is met, then builds the arm at tier 1', () => {
    const locked: GameState = { ...noArmState(1), studio: { ...noArmState(1).studio, brand: 10 } };
    expect(studioReducer(locked, { type: 'UNLOCK_DISTRIBUTION_ARM' })).toBe(locked); // milestone not met

    const eligible: GameState = { ...locked, studio: { ...locked.studio, brand: 90 } };
    const built = studioReducer(eligible, { type: 'UNLOCK_DISTRIBUTION_ARM' });
    expect(built.studio.distributionArm?.tier).toBe(1);
  });
});

describe('UPGRADE_DISTRIBUTION_ARM', () => {
  it('charges cash and raises the tier; no-ops when it cannot be afforded', () => {
    const base = noArmState(2);
    const t1: GameState = { ...base, studio: { ...base.studio, distributionArm: { tier: 1 }, cash: 50_000_000 } };
    const upgraded = studioReducer(t1, { type: 'UPGRADE_DISTRIBUTION_ARM' });
    expect(upgraded.studio.distributionArm?.tier).toBe(2);
    expect(upgraded.studio.cash).toBeLessThan(t1.studio.cash);

    const poor: GameState = { ...t1, studio: { ...t1.studio, cash: 100 } };
    expect(studioReducer(poor, { type: 'UPGRADE_DISTRIBUTION_ARM' })).toBe(poor);
  });
});

describe('SCHEDULE_RELEASE - distribution gate and frozen deal', () => {
  it('hard-blocks a self-distributed Wide release when the studio has no Distribution Arm', () => {
    const base = noArmState(3);
    // Force the (invalid) self choice the UI would never offer.
    const forcedSelf: GameState = {
      ...base,
      projects: base.projects.map((p) =>
        'draft' in p ? { ...p, draft: { ...p.draft, marketingChoices: { ...p.draft.marketingChoices!, distributionMethod: 'self' as const } } } : p,
      ),
    };
    expect(studioReducer(forcedSelf, { type: 'SCHEDULE_RELEASE', releaseDay: 1 })).toBe(forcedSelf); // no-op
  });

  it('a no-arm Wide release is rented: the deal is frozen and the distributor takes a cut of the gross', () => {
    const released = studioReducer(noArmState(4), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    const film = playerReleasedFilms(released.projects)[0];
    // The rented deal is frozen onto the film.
    expect(film.marketingChoices.distributionMethod).toBe('rented');
    expect(film.marketingChoices.distributionBreadth).toBe(RENTED_WIDE_CEILING);
    expect(film.results.distributionKeepShare).toBeCloseTo(STUDIO_BOX_OFFICE_SHARE * RENTED_DISTRIBUTION_KEEP_MULTIPLIER, 6);

    // End to end: the reduced keep actually flows into studioRevenue.
    const finished = runToFinish(released);
    const settled = playerReleasedFilms(finished.projects)[0];
    expect(settled.results.totalBoxOffice).not.toBeNull();
    expect(settled.results.studioRevenue).toBe(
      Math.round(settled.results.totalBoxOffice! * settled.results.distributionKeepShare!),
    );
  });

  it('a studio with an arm self-distributes Wide by default: full keep, no distributor cut', () => {
    // The default fixture ships a tier-3 arm.
    const released = studioReducer(buildStateWithReadyDraft(4), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    const film = playerReleasedFilms(released.projects)[0];
    expect(film.marketingChoices.distributionMethod).toBe('self');
    expect(film.results.distributionKeepShare).toBeUndefined(); // full STUDIO_BOX_OFFICE_SHARE
  });
});
