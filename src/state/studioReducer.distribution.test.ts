import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { buildStateWithReadyDraft } from './testFixtures';
import { playerReleasedFilms } from '../engine/project';
import { MAX_SIMULATION_WEEKS } from '../engine/audienceSimulationStep';
import {
  DOMESTIC_KEEP_SHARE,
  INTERNATIONAL_DISTRIBUTION_MAX_TIER,
  INTERNATIONAL_UPGRADE_COST_BY_TIER,
  RENTED_DISTRIBUTION_KEEP_MULTIPLIER,
  RENTED_WIDE_CEILING,
} from '../data/distribution';
import { internationalReachForTier } from '../engine/distribution';
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

describe('UPGRADE_INTERNATIONAL_DISTRIBUTION', () => {
  it('is a no-op without a Distribution Arm - the base arm must exist first', () => {
    const base = noArmState(2);
    expect(studioReducer(base, { type: 'UPGRADE_INTERNATIONAL_DISTRIBUTION' })).toBe(base);
  });

  it('charges cash and raises the international tier, from the hard gate up', () => {
    const base = noArmState(2);
    const t0: GameState = { ...base, studio: { ...base.studio, distributionArm: { tier: 1, internationalTier: 0 }, cash: 50_000_000 } };
    const upgraded = studioReducer(t0, { type: 'UPGRADE_INTERNATIONAL_DISTRIBUTION' });
    expect(upgraded.studio.distributionArm?.internationalTier).toBe(1);
    expect(t0.studio.cash - upgraded.studio.cash).toBe(INTERNATIONAL_UPGRADE_COST_BY_TIER[1]);
  });

  it('caps at the max tier', () => {
    const base = noArmState(2);
    const maxed: GameState = {
      ...base,
      studio: { ...base.studio, distributionArm: { tier: 1, internationalTier: INTERNATIONAL_DISTRIBUTION_MAX_TIER }, cash: 50_000_000 },
    };
    expect(studioReducer(maxed, { type: 'UPGRADE_INTERNATIONAL_DISTRIBUTION' })).toBe(maxed);
  });

  it('no-ops when the upgrade cannot be afforded', () => {
    const base = noArmState(2);
    const poor: GameState = { ...base, studio: { ...base.studio, distributionArm: { tier: 1, internationalTier: 0 }, cash: 100 } };
    expect(studioReducer(poor, { type: 'UPGRADE_INTERNATIONAL_DISTRIBUTION' })).toBe(poor);
  });
});

describe('SCHEDULE_RELEASE - international reach freeze', () => {
  it('freezes the studio\'s current international reach onto the release', () => {
    // Default fixture ships a full international tier.
    const released = studioReducer(buildStateWithReadyDraft(4), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    const film = playerReleasedFilms(released.projects)[0];
    expect(film.marketingChoices.internationalReachFraction).toBe(internationalReachForTier(INTERNATIONAL_DISTRIBUTION_MAX_TIER));
    expect(film.results.internationalReachFraction).toBe(internationalReachForTier(INTERNATIONAL_DISTRIBUTION_MAX_TIER));
  });

  it('a studio with no international distribution ships a hard-gated (reach 0) release - domestic only end to end', () => {
    const base = buildStateWithReadyDraft(4);
    const gated: GameState = {
      ...base,
      studio: { ...base.studio, distributionArm: { tier: 3, internationalTier: 0 } },
    };
    const released = studioReducer(gated, { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    const film = playerReleasedFilms(released.projects)[0];
    expect(film.results.internationalReachFraction).toBe(0);

    const finished = runToFinish(released);
    const settled = playerReleasedFilms(finished.projects)[0];
    // Every settled week is domestic-only.
    for (const w of settled.boxOfficeRun.weeks) {
      expect(w.internationalGross ?? 0).toBe(0);
    }
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
    expect(film.results.distributionKeepShare).toBeCloseTo(DOMESTIC_KEEP_SHARE * RENTED_DISTRIBUTION_KEEP_MULTIPLIER, 6);

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
    expect(film.results.distributionKeepShare).toBeUndefined(); // full domestic keep
  });
});
