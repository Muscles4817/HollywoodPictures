import { describe, it, expect, beforeEach } from 'vitest';
import { loadState, saveState, clearSavedState } from './persistence';
import { studioReducer } from './studioReducer';
import { buildStateWithReadyDraft } from './testFixtures';
import { MAX_SIMULATION_WEEKS } from '../engine/audienceSimulationStep';

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
    const released = studioReducer(buildStateWithReadyDraft(1), { type: 'RELEASE_FILM' });
    let state = released;
    for (let i = 0; i < 21; i++) state = studioReducer(state, { type: 'ADVANCE_DAY' }); // 3 weeks in, still running

    saveState(state);
    const reloaded = loadState();

    expect(reloaded.studio.filmsReleased).toHaveLength(1);
    expect(reloaded.studio.filmsReleased[0].boxOfficeRun).toEqual(state.studio.filmsReleased[0].boxOfficeRun);
    expect(reloaded.studio.filmsReleased[0].results).toEqual(state.studio.filmsReleased[0].results);
    expect(reloaded.studio.cash).toBe(state.studio.cash);
    expect(reloaded.studio.totalDays).toBe(state.studio.totalDays);
  });

  it('a finished run also round-trips exactly, including the final totalBoxOffice/profit/outcome', () => {
    const released = studioReducer(buildStateWithReadyDraft(2), { type: 'RELEASE_FILM' });
    let state = released;
    for (let i = 0; i < MAX_SIMULATION_WEEKS * 7 + 7; i++) state = studioReducer(state, { type: 'ADVANCE_DAY' });
    expect(state.studio.filmsReleased[0].boxOfficeRun.status).toBe('finished');

    saveState(state);
    const reloaded = loadState();
    expect(reloaded.studio.filmsReleased[0]).toEqual(state.studio.filmsReleased[0]);
  });

  it('continuing a reloaded run settles identically to continuing the original in memory', () => {
    const released = studioReducer(buildStateWithReadyDraft(3), { type: 'RELEASE_FILM' });
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
    expect(continuedReloaded.studio.filmsReleased[0].boxOfficeRun).toEqual(continuedOriginal.studio.filmsReleased[0].boxOfficeRun);
  });
});

describe('old saves migrate safely', () => {
  it('no save present at all (fresh browser) falls back to a brand new studio without throwing', () => {
    expect(() => loadState()).not.toThrow();
    const state = loadState();
    expect(state.studio.filmsReleased).toEqual([]);
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
    expect(state.studio.filmsReleased).toEqual([]);
    expect(state.studio.cash).toBeGreaterThan(1); // a genuinely fresh studio's starting cash, not the stale save's
  });

  it('malformed data under the current key also falls back cleanly, rather than throwing', () => {
    globalThis.localStorage.setItem('hollywood-pictures-save-v19', 'not valid json{{{');
    expect(() => loadState()).not.toThrow();
    expect(loadState().studio.filmsReleased).toEqual([]);
  });

  it('clearSavedState followed by loadState behaves exactly like no save ever existed', () => {
    const released = studioReducer(buildStateWithReadyDraft(4), { type: 'RELEASE_FILM' });
    saveState(released);
    clearSavedState();
    const state = loadState();
    expect(state.studio.filmsReleased).toEqual([]);
  });
});
