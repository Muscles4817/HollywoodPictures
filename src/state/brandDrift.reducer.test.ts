// Brand reversion on the quarterly tick, its carry, and the Inbox notice
// (docs/IMPLEMENTATION_PLAN_market_realism.md Phase 3).
import { describe, expect, it } from 'vitest';
import { studioReducer, BRAND_NOTICE_POINTS } from './studioReducer';
import { buildStateWithReadyDraft } from './testFixtures';
import { deriveInboxItems, filmToProject, inboxBadgeCount, playerReleasedFilms } from '../engine/project';
import { MAX_SIMULATION_WEEKS } from '../engine/audienceSimulationStep';
import { RUNNING_COST_INTERVAL_DAYS } from '../engine/runningCosts';
import { computeBrandAnchor, driftBrand } from '../engine/reputation';
import { generateRivalStudios } from '../engine/rivalStudios';
import { createRng } from '../engine/random';
import type { Film } from '../types';
import type { GameState } from './gameState';

// One finished player film, run for real, cloned below into a studio's record.
const template: Film = (() => {
  let s = studioReducer(buildStateWithReadyDraft(10), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
  for (let i = 0; i < MAX_SIMULATION_WEEKS * 7 + 7; i++) s = studioReducer(s, { type: 'ADVANCE_DAY' });
  return playerReleasedFilms(s.projects)[0];
})();

function filmsGrossing(gross: number, count: number, releasedBy?: string): Film[] {
  return Array.from({ length: count }, (_, i) => ({
    ...template,
    id: `${releasedBy ?? 'player'}-film-${gross}-${i}`,
    releasedOnDay: 10 + i,
    ...(releasedBy ? { releasedBy } : { releasedBy: undefined }),
    boxOfficeRun: { ...template.boxOfficeRun, status: 'finished' as const, acknowledged: true },
    results: { ...template.results, totalBoxOffice: gross },
  }));
}

/** A state the day before a running-cost day, with this record of finished films and Brands. */
function stateWith(playerBrand: number, playerFilms: Film[], rivalBrand: number, rivalGross: number): GameState {
  const built = buildStateWithReadyDraft(11);
  const base = { ...built, rivalStudios: generateRivalStudios(createRng(5)) };
  const rival = base.rivalStudios[0];
  const day = RUNNING_COST_INTERVAL_DAYS * 4 - 1;
  return {
    ...base,
    // No awards season in the window: a ceremony moves Brand too.
    awards: { history: [], season: null, nextSeasonDay: 1e9 },
    focusedProjectId: null,
    totalDays: day,
    studio: { ...base.studio, brand: playerBrand },
    rivalStudios: base.rivalStudios.map((r) => (r.id === rival.id ? { ...r, brand: rivalBrand } : r)),
    projects: [...playerFilms, ...filmsGrossing(rivalGross, 4, rival.name)].map(filmToProject),
  };
}

const tick = (s: GameState) => studioReducer(s, { type: 'ADVANCE_DAY' });

describe('Brand drift on the running-cost day', () => {
  it('drifts the player and each rival once when the quarter turns, and not on other days', () => {
    const before = stateWith(90, filmsGrossing(1_000_000, 4), 20, 1_000_000_000);
    const after = tick(before);
    const rival0 = before.rivalStudios[0];
    expect(after.studio.brand).toBe(Math.round(driftBrand(90, computeBrandAnchor([1e6, 1e6, 1e6, 1e6]), 0.25)));
    expect(after.studio.brand).toBeLessThan(90);
    expect(after.rivalStudios.find((r) => r.id === rival0.id)!.brand).toBeGreaterThan(20);
    // A rival with no finished films has no anchor and does not move.
    const quiet = before.rivalStudios[1];
    expect(after.rivalStudios.find((r) => r.id === quiet.id)!.brand).toBe(quiet.brand);
    // The next day is not a running-cost day: nothing drifts.
    const next = tick(after);
    expect(next.studio.brand).toBe(after.studio.brand);
  });

  it('carries sub-point drift until it rounds into a whole point', () => {
    // Anchor 60 (£100M films) against Brand 61: a quarter closes ~0.04 of a point.
    let s = stateWith(61, filmsGrossing(100_000_000, 4), 50, 100_000_000);
    s = tick(s);
    expect(s.studio.brand).toBe(61);
    expect(s.studio.brandDriftCarry).toBeLessThan(0);
    const firstCarry = s.studio.brandDriftCarry!;
    s = { ...s, totalDays: RUNNING_COST_INTERVAL_DAYS * 5 - 1 };
    s = tick(s);
    expect(s.studio.brandDriftCarry!).toBeLessThan(firstCarry); // accumulating
    for (let q = 6; q < 40 && s.studio.brand === 61; q++) s = tick({ ...s, totalDays: RUNNING_COST_INTERVAL_DAYS * q - 1 });
    expect(s.studio.brand).toBe(60);
  });
});

describe('the Brand notice', () => {
  /** Runs quarters until drift alone has moved Brand at least BRAND_NOTICE_POINTS. */
  function quartersUntilNotice(s: GameState): GameState {
    for (let q = 4; q < 60 && !s.studio.brandNotice; q++) s = tick({ ...s, totalDays: RUNNING_COST_INTERVAL_DAYS * q - 1 });
    return s;
  }

  it('appears after a 5-point drift, lights the badge, clears when shown, and waits for a further 5 points', () => {
    let s = stateWith(90, filmsGrossing(1_000_000, 4), 50, 100_000_000);
    s = tick(s);
    expect(90 - s.studio.brand).toBeLessThan(BRAND_NOTICE_POINTS);
    expect(s.studio.brandNotice).toBeUndefined();
    s = quartersUntilNotice(s);
    expect(s.studio.brandNotice?.direction).toBe('fading');
    expect(deriveInboxItems(s.projects, null, s.totalDays, s.studio.brandNotice).brandNotice).not.toBeNull();
    const lit = inboxBadgeCount(s.projects, null, s.totalDays, s.studio.brandNotice);
    expect(lit).toBe(inboxBadgeCount(s.projects, null, s.totalDays) + 1);

    s = studioReducer(s, { type: 'ACKNOWLEDGE_BRAND_NOTICE' });
    expect(deriveInboxItems(s.projects, null, s.totalDays, s.studio.brandNotice).brandNotice).toBeNull();
    expect(inboxBadgeCount(s.projects, null, s.totalDays, s.studio.brandNotice)).toBe(lit - 1);

    // One more quarter's drift (well under five points) does not bring it back.
    const brandAtNotice = s.studio.brand;
    const day = s.studio.brandNotice!.day;
    s = tick({ ...s, totalDays: day - 1 + RUNNING_COST_INTERVAL_DAYS });
    expect(brandAtNotice - s.studio.brand).toBeLessThan(BRAND_NOTICE_POINTS);
    expect(s.studio.brandNotice!.day).toBe(day);
    expect(s.studio.brandNotice!.acknowledged).toBe(true);
    // ...a further five points does.
    for (let q = 2; q < 60 && s.studio.brandNotice!.day === day; q++) s = tick({ ...s, totalDays: day - 1 + RUNNING_COST_INTERVAL_DAYS * q });
    expect(s.studio.brandNotice!.day).toBeGreaterThan(day);
    expect(s.studio.brandNotice!.acknowledged).toBeUndefined();
  });

  it('reads recovering when drift lifts the name', () => {
    const s = quartersUntilNotice(stateWith(20, filmsGrossing(500_000_000, 4), 50, 100_000_000));
    expect(s.studio.brandNotice?.direction).toBe('recovering');
  });
});
