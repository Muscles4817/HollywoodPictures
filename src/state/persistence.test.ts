import { describe, it, expect, beforeEach } from 'vitest';
import { loadState, saveState, clearSavedState } from './persistence';
import { studioReducer } from './studioReducer';
import { buildStateWithReadyDraft } from './testFixtures';
import { MAX_SIMULATION_WEEKS } from '../engine/audienceSimulationStep';
import { playerReleasedFilms } from '../engine/project';

/**
 * A minimal in-memory localStorage, since vitest's default (Node)
 * environment has no DOM/localStorage global and this project's
 * vitest.config.ts deliberately stays DOM-free (see its own comment -
 * "everything under test so far is pure engine/domain logic"). No jsdom/
 * happy-dom dependency needed for this one interface.
 */
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

beforeEach(() => {
  globalThis.localStorage = createMemoryStorage();
});

describe('save / reload preserves exact run state', () => {
  it('a film mid-run round-trips through saveState/loadState with its boxOfficeRun byte-for-byte identical', () => {
    const released = studioReducer(buildStateWithReadyDraft(1), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    let state = released;
    for (let i = 0; i < 21; i++) state = studioReducer(state, { type: 'ADVANCE_DAY' }); // 3 weeks in, still running

    saveState(state);
    const reloaded = loadState();

    expect(playerReleasedFilms(reloaded.projects)).toHaveLength(1);
    expect(playerReleasedFilms(reloaded.projects)[0].boxOfficeRun).toEqual(playerReleasedFilms(state.projects)[0].boxOfficeRun);
    expect(playerReleasedFilms(reloaded.projects)[0].results).toEqual(playerReleasedFilms(state.projects)[0].results);
    expect(reloaded.studio.cash).toBe(state.studio.cash);
    expect(reloaded.totalDays).toBe(state.totalDays);
  });

  it('a finished run also round-trips exactly, including the final totalBoxOffice/profit/outcome', () => {
    const released = studioReducer(buildStateWithReadyDraft(2), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    let state = released;
    for (let i = 0; i < MAX_SIMULATION_WEEKS * 7 + 7; i++) state = studioReducer(state, { type: 'ADVANCE_DAY' });
    expect(playerReleasedFilms(state.projects)[0].boxOfficeRun.status).toBe('finished');

    saveState(state);
    const reloaded = loadState();
    expect(playerReleasedFilms(reloaded.projects)[0]).toEqual(playerReleasedFilms(state.projects)[0]);
  });

  it('continuing a reloaded run settles identically to continuing the original in memory', () => {
    const released = studioReducer(buildStateWithReadyDraft(3), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    let state = released;
    for (let i = 0; i < 7; i++) state = studioReducer(state, { type: 'ADVANCE_DAY' }); // 1 week in
    saveState(state);

    const reloaded = loadState();
    let continuedOriginal = state;
    let continuedReloaded = reloaded;
    for (let i = 0; i < MAX_SIMULATION_WEEKS * 7; i++) {
      continuedOriginal = studioReducer(continuedOriginal, { type: 'ADVANCE_DAY' });
      continuedReloaded = studioReducer(continuedReloaded, { type: 'ADVANCE_DAY' });
    }
    expect(playerReleasedFilms(continuedReloaded.projects)[0].boxOfficeRun).toEqual(playerReleasedFilms(continuedOriginal.projects)[0].boxOfficeRun);
  });
});

describe('old saves migrate safely', () => {
  it('no save present at all (fresh browser) falls back to a brand new studio without throwing', () => {
    expect(() => loadState()).not.toThrow();
    const state = loadState();
    expect(state.projects).toEqual([]);
    expect(state.screen).toBe('dashboard');
  });

  it('a save under an old, pre-Milestone-5 key is invisible to the new SAVE_KEY - falls back to a fresh studio, not a crash reading a stale BoxOfficeRun shape', () => {
    // Simulates the exact "bump the version, old data goes untouched under
    // its own old key" migration strategy this file's own SAVE_KEY comment
    // documents - an old save literally using legs/retention (the fields
    // this milestone removed from BoxOfficeRun) never gets read by
    // loadState() at all, since it's stored under a different key entirely.
    globalThis.localStorage.setItem(
      'hollywood-pictures-save-v18',
      JSON.stringify({ studio: { cash: 1, filmsReleased: [{ boxOfficeRun: { legs: 4, retention: 0.8 } }] } }),
    );
    const state = loadState();
    expect(state.projects).toEqual([]);
    expect(state.studio.cash).toBeGreaterThan(1); // a genuinely fresh studio's starting cash, not the stale save's
  });

  it('malformed data under the current key also falls back cleanly, rather than throwing', () => {
    globalThis.localStorage.setItem('hollywood-pictures-save-v20', 'not valid json{{{');
    expect(() => loadState()).not.toThrow();
    expect(loadState().projects).toEqual([]);
  });

  it('a save under the pre-Milestone-9 v19 key (missing availability fields on BoxOfficeRun.fixed/simWeeks) is invisible to v20 - falls back to a fresh studio rather than crashing the first time a film\'s week is next advanced', () => {
    // The actual production bug this test pins: a v19 save's fixed/simWeeks
    // predate initialAvailabilityFraction/availabilityBaseWeeklyDecay/
    // criticLedExpansionWeight/availabilityFraction entirely (undefined,
    // not just stale values). Loading it and then advancing any released
    // film's box office (GO_TO_STEP/ADVANCE_DAY, via settleBoxOfficeForAllFilms)
    // used to read those as undefined, produce NaN, and throw inside
    // createAudienceSimulationWeekState's validation - uncaught, with no
    // ErrorBoundary anywhere in the app, blanking the whole page. See
    // SAVE_KEY's own v19 -> v20 comment.
    globalThis.localStorage.setItem(
      'hollywood-pictures-save-v19',
      JSON.stringify({
        studio: {
          cash: 1,
          filmsReleased: [{
            boxOfficeRun: {
              status: 'running',
              fixed: {
                totalAddressableAudience: 1_000_000, baseInterestFraction: 0.2, marketingEfficiency: 0.5,
                crossoverCapacityFraction: 0.1, conversionPacingBaseline: 0.12, externalWeeklyAwarenessRate: 0.1,
                criticScore: 60, audienceScore: 60, initialAwareCount: 100_000,
                // no initialAvailabilityFraction/availabilityBaseWeeklyDecay/criticLedExpansionWeight - the pre-Milestone-9 shape
              },
              simWeeks: [{ week: 1, awareCount: 200_000, interestedRemaining: 50_000, cumulativeTicketsSold: 10_000 }],
              // no availabilityFraction on the week either
            },
          }],
        },
      }),
    );
    const state = loadState();
    expect(state.projects).toEqual([]);
    expect(state.studio.cash).toBeGreaterThan(1); // a genuinely fresh studio's starting cash, not the stale save's

    // The actual failure mode: advancing days used to throw once a v19-shaped
    // film reached this code path. With the fresh studio loadState() actually
    // returns (no released films), this must be a no-op, not a crash.
    expect(() => studioReducer(state, { type: 'ADVANCE_DAY' })).not.toThrow();
    expect(() => studioReducer(state, { type: 'GO_TO_STEP', step: 'talent' })).not.toThrow();
  });

  it('a save under the pre-Phase-1.1 v22 key (Studio.totalDays nested, no top-level GameState.totalDays) is invisible to v23 - falls back to a fresh studio rather than a hybrid state', () => {
    // Studio.totalDays moved to GameState.totalDays (architecture roadmap
    // Phase 1.1) - a v22 save has totalDays nested inside `studio`, not at
    // the top level `parsed.totalDays` this file's loadState() now expects.
    // Same class of break as every past shape change here: no migration
    // code, an old save simply isn't found under the new key.
    globalThis.localStorage.setItem(
      'hollywood-pictures-save-v22',
      JSON.stringify({ studio: { cash: 1, totalDays: 999, filmsReleased: [] } }),
    );
    const state = loadState();
    expect(state.projects).toEqual([]);
    expect(state.studio.cash).toBeGreaterThan(1); // a genuinely fresh studio's starting cash, not the stale save's
    expect(state.totalDays).toBe(1); // a genuinely fresh calendar, not the stale save's totalDays: 999
  });

  it('a save under the pre-Phase-1.2 v23 key (rival state nested in studio, no top-level GameState.rivalStudios) is invisible to v24 - falls back to a fresh studio and roster rather than a hybrid state', () => {
    // Studio.rivalStudios/rivalProductionsInProgress/rivalFilmsReleased moved
    // to GameState (architecture roadmap Phase 1.2) - a v23 save has all
    // three nested inside `studio`, not at the top level this file's
    // loadState() now expects. Same class of break as every past shape
    // change here: no migration code, an old save simply isn't found under
    // the new key.
    globalThis.localStorage.setItem(
      'hollywood-pictures-save-v23',
      JSON.stringify({
        studio: { cash: 1, totalDays: 1, filmsReleased: [], rivalStudios: [{ id: 'stale', name: 'Stale Pictures', tier: 'Indie', nextSpawnCheckDay: 1 }] },
      }),
    );
    const state = loadState();
    expect(state.projects).toEqual([]);
    expect(state.studio.cash).toBeGreaterThan(1); // a genuinely fresh studio's starting cash, not the stale save's
    expect(state.rivalStudios).not.toEqual([]); // a genuinely fresh (real) roster, not the stale save's studio-nested one
    expect(state.rivalStudios.some((r) => r.name === 'Stale Pictures')).toBe(false);
  });

  it('a save under the pre-Phase-1.3 v24 key (talentPool nested in studio, no top-level GameState.talentPool) is invisible to v25 - falls back to a fresh studio and roster rather than a hybrid state', () => {
    // Studio.talentPool moved to GameState (architecture roadmap Phase 1.3)
    // - a v24 save has it nested inside `studio`, not at the top level this
    // file's loadState() now expects. Same class of break as every past
    // shape change here: no migration code, an old save simply isn't found
    // under the new key.
    globalThis.localStorage.setItem(
      'hollywood-pictures-save-v24',
      JSON.stringify({
        studio: { cash: 1, totalDays: 1, filmsReleased: [], talentPool: { Director: [{ id: 'stale-director', name: 'Stale Director' }] } },
      }),
    );
    const state = loadState();
    expect(state.projects).toEqual([]);
    expect(state.studio.cash).toBeGreaterThan(1); // a genuinely fresh studio's starting cash, not the stale save's
    expect(state.talentPool.Director.some((t) => t.name === 'Stale Director')).toBe(false);
    expect(state.talentPool.Director.length).toBeGreaterThan(0); // a genuinely fresh (real) pool, not an empty one
  });

  it('a save under the pre-Phase-5 v25 key (draft/Studio.filmsReleased/Studio.productionsInProgress/rival state instead of GameState.projects) is invisible to v26 - falls back to a fresh studio rather than a hybrid state', () => {
    // GameState.draft/Studio.filmsReleased/Studio.productionsInProgress/
    // GameState.rivalProductionsInProgress/GameState.rivalFilmsReleased all
    // collapsed into GameState.projects/focusedProjectId (architecture
    // roadmap Phase 5) - a v25 save has none of the new fields at all. Same
    // class of break as every past shape change here: no migration code, an
    // old save simply isn't found under the new key.
    globalThis.localStorage.setItem(
      'hollywood-pictures-save-v25',
      JSON.stringify({
        studio: { cash: 1, reputation: 20, name: 'Stale Pictures', filmsReleased: [], productionsInProgress: [] },
        draft: null,
        totalDays: 1,
        rivalProductionsInProgress: [],
        rivalFilmsReleased: [],
      }),
    );
    const state = loadState();
    expect(state.projects).toEqual([]);
    expect(state.focusedProjectId).toBeNull();
    expect(state.studio.cash).toBeGreaterThan(1); // a genuinely fresh studio's starting cash, not the stale save's
    expect(state.studio.name).not.toBe('Stale Pictures');
  });

  it('a save under the pre-Phase-7.2 v26 key (no SCHEDULE_RELEASE/scheduled projects yet) is invisible to v27 - falls back to a fresh studio rather than a hybrid state', () => {
    // Real release scheduling (architecture roadmap Phase 7.1/7.2) added a
    // fourth Project kind, 'scheduled', that a v26 save's projects array
    // can't contain (the kind didn't exist yet). Same class of break as
    // every past shape change here: no migration code, an old save simply
    // isn't found under the new key.
    globalThis.localStorage.setItem(
      'hollywood-pictures-save-v26',
      JSON.stringify({
        studio: { cash: 1, reputation: 20, name: 'Stale Pictures' },
        projects: [],
        focusedProjectId: null,
        totalDays: 1,
      }),
    );
    const state = loadState();
    expect(state.projects).toEqual([]);
    expect(state.studio.cash).toBeGreaterThan(1); // a genuinely fresh studio's starting cash, not the stale save's
    expect(state.studio.name).not.toBe('Stale Pictures');
  });

  it('a save under the pre-development-pipeline v27 key (no opportunities/assets yet) is invisible to v28 - falls back to a fresh studio rather than a hybrid state', () => {
    // The development pipeline (docs/DESIGN_REVIEW_development_pipeline.md)
    // added required GameState.opportunities/nextOpportunityCheckDay and
    // Studio.assets, and replaced FilmDraft's old scriptOptions-based shape
    // with assetId/greenlitOnDay - a v27 save's studio/projects have none of
    // these. Same class of break as every past shape change here: no
    // migration code, an old save simply isn't found under the new key.
    globalThis.localStorage.setItem(
      'hollywood-pictures-save-v27',
      JSON.stringify({
        studio: { cash: 1, reputation: 20, name: 'Stale Pictures' },
        projects: [],
        focusedProjectId: null,
        totalDays: 1,
      }),
    );
    const state = loadState();
    expect(state.projects).toEqual([]);
    expect(state.opportunities).toEqual([]);
    expect(state.studio.assets).toEqual([]);
    expect(state.studio.cash).toBeGreaterThan(1); // a genuinely fresh studio's starting cash, not the stale save's
    expect(state.studio.name).not.toBe('Stale Pictures');
  });

  it('a save under the pre-Brand/Prestige v28 key (single reputation stat instead of brand/prestige) is invisible to v29 - falls back to a fresh studio rather than a hybrid state', () => {
    // Brand Recognition and Prestige (docs/DESIGN.md) replaced the single
    // Studio.reputation stat with two independent ones, Studio.brand/
    // Studio.prestige - a v28 save's studio has neither field. Same class of
    // break as every past shape change here: no migration code, an old save
    // simply isn't found under the new key.
    globalThis.localStorage.setItem(
      'hollywood-pictures-save-v28',
      JSON.stringify({
        studio: { cash: 1, reputation: 20, name: 'Stale Pictures' },
        projects: [],
        focusedProjectId: null,
        totalDays: 1,
      }),
    );
    const state = loadState();
    expect(state.projects).toEqual([]);
    expect(state.studio.brand).toBeGreaterThan(1);
    expect(state.studio.prestige).toBeGreaterThan(1);
    expect(state.studio.cash).toBeGreaterThan(1); // a genuinely fresh studio's starting cash, not the stale save's
    expect(state.studio.name).not.toBe('Stale Pictures');
  });

  it('clearSavedState followed by loadState behaves exactly like no save ever existed', () => {
    const released = studioReducer(buildStateWithReadyDraft(4), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    saveState(released);
    clearSavedState();
    const state = loadState();
    expect(state.projects).toEqual([]);
  });
});
