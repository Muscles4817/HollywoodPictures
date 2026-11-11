import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
  SAVE_VERSION,
  loadState,
  saveState,
  clearSavedState,
  hasSavedGame,
  hydrateSave,
  flushSave,
  getSaveStatus,
  resetPersistenceForTests,
} from './persistence';
import { readSave, writeSave, resetWrittenSnapshotForTests } from './saveDatabase';
import { studioReducer } from './studioReducer';
import { buildStateWithReadyDraft } from './testFixtures';
import { buildPopulatedStudio } from './renderFixtures';
import { MAX_SIMULATION_WEEKS } from '../engine/audienceSimulationStep';
import { playerReleasedFilms, projectId } from '../engine/project';
import type { GameState } from './gameState';

/** A minimal in-memory localStorage - only the legacy-key cleanup touches it now. */
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

/** What a page reload does to the save layer: memory is gone, the database is not. */
function simulateReload(): void {
  resetPersistenceForTests();
  resetWrittenSnapshotForTests();
}

function advanceDays(state: GameState, n: number): GameState {
  let s = state;
  for (let i = 0; i < n; i++) s = studioReducer(s, { type: 'ADVANCE_DAY' });
  return s;
}

beforeEach(() => {
  globalThis.localStorage = createMemoryStorage();
  globalThis.indexedDB = new IDBFactory();
  simulateReload();
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

describe('the in-memory save (what the app and the component tests read synchronously)', () => {
  it('no save present at all falls back to a brand new studio without throwing', () => {
    expect(() => loadState()).not.toThrow();
    const state = loadState();
    expect(state.projects).toEqual([]);
    expect(state.screen).toBe('dashboard');
  });

  it('clearSavedState followed by loadState behaves exactly like no save ever existed', async () => {
    const released = studioReducer(buildStateWithReadyDraft(4), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    saveState(released);
    await clearSavedState();
    expect(loadState().projects).toEqual([]);
  });

  it('hasSavedGame is false on a first launch - loadState generating a default studio does not count as a save', () => {
    loadState();
    expect(hasSavedGame()).toBe(false);
  });

  it('hasSavedGame is true once a state has been saved, and false again after clearSavedState', async () => {
    saveState(loadState());
    expect(hasSavedGame()).toBe(true);
    await clearSavedState();
    expect(hasSavedGame()).toBe(false);
  });

  it('never touches the database before hydrateSave has been called', async () => {
    saveState(buildStateWithReadyDraft(1));
    await flushSave();
    expect(await readSave(SAVE_VERSION)).toBeNull();
  });
});

describe('the database save survives a reload', () => {
  it('a studio written to the database comes back identical after a reload', async () => {
    await hydrateSave();
    const state = advanceDays(studioReducer(buildStateWithReadyDraft(5), { type: 'SCHEDULE_RELEASE', releaseDay: 1 }), 10);
    saveState(state);
    await flushSave();

    simulateReload();
    expect(hasSavedGame()).toBe(false);
    await hydrateSave();
    expect(hasSavedGame()).toBe(true);
    expect(loadState()).toEqual(state);
  });

  it('continuing a run reloaded from the database settles identically to continuing it in memory', async () => {
    await hydrateSave();
    const state = advanceDays(studioReducer(buildStateWithReadyDraft(3), { type: 'SCHEDULE_RELEASE', releaseDay: 1 }), 7);
    saveState(state);
    await flushSave();
    simulateReload();
    await hydrateSave();

    const days = MAX_SIMULATION_WEEKS * 7;
    const continuedOriginal = advanceDays(state, days);
    const continuedReloaded = advanceDays(loadState(), days);
    expect(playerReleasedFilms(continuedReloaded.projects)[0].boxOfficeRun).toEqual(playerReleasedFilms(continuedOriginal.projects)[0].boxOfficeRun);
  });

  it('a save larger than the old localStorage quota is stored and read back whole', async () => {
    // The regression this move exists for: a studio a year in is over the ~5.2M
    // characters localStorage holds, so the old save threw and was swallowed.
    const state = buildPopulatedStudio(42);
    expect(JSON.stringify(state).length).toBeGreaterThan(5_200_000);

    await hydrateSave();
    saveState(state);
    await flushSave();
    expect(getSaveStatus()).toEqual({ kind: 'ok' });

    simulateReload();
    await hydrateSave();
    const reloaded = loadState();
    expect(reloaded.projects.length).toBe(state.projects.length);
    expect(reloaded.projects.map(projectId)).toEqual(state.projects.map(projectId));
    expect(reloaded.totalDays).toBe(state.totalDays);
    expect(Object.keys(reloaded.talentPool)).toEqual(Object.keys(state.talentPool));
  });

  it('a save written under another schema version is ignored and removed', async () => {
    await writeSave(buildStateWithReadyDraft(2), SAVE_VERSION - 1);
    simulateReload();
    await hydrateSave();
    expect(hasSavedGame()).toBe(false);
    expect(loadState().projects).toEqual([]);
    expect(await readSave(SAVE_VERSION - 1)).toBeNull();
  });

  it('clearSavedState removes the studio from the database, not just from memory', async () => {
    await hydrateSave();
    saveState(buildStateWithReadyDraft(2));
    await flushSave();
    await clearSavedState();
    simulateReload();
    await hydrateSave();
    expect(hasSavedGame()).toBe(false);
  });

  it('hydrateSave removes every old localStorage save key, which would otherwise keep occupying the quota', async () => {
    localStorage.setItem('hollywood-pictures-save-v97', 'x'.repeat(1000));
    localStorage.setItem('hollywood-pictures-save-v98', 'x'.repeat(1000));
    localStorage.setItem('hollywood-pictures-settings', '{}');
    await hydrateSave();
    expect(localStorage.getItem('hollywood-pictures-save-v97')).toBeNull();
    expect(localStorage.getItem('hollywood-pictures-save-v98')).toBeNull();
    expect(localStorage.getItem('hollywood-pictures-settings')).toBe('{}');
  });
});

describe('a save only writes what changed', () => {
  it('a week of play rewrites a fraction of the slate, and never a film whose run is over', async () => {
    const state = buildPopulatedStudio(42);
    const first = await writeSave(state, SAVE_VERSION);
    expect(first.projectsPut).toBe(state.projects.length);

    const unchanged = await writeSave(state, SAVE_VERSION);
    expect(unchanged).toEqual({ projectsPut: 0, projectsDeleted: 0, talentPut: 0 });

    const dayLater = advanceDays(state, 1);
    const oneDay = await writeSave(dayLater, SAVE_VERSION);
    expect(oneDay.projectsPut).toBeLessThan(state.projects.length / 10);
    expect(oneDay.talentPut).toBe(0);

    // Every record skipped must still be current: what is in the database
    // equals the state in memory, not a stale mix.
    resetWrittenSnapshotForTests();
    expect(await readSave(SAVE_VERSION)).toEqual(dayLater);
  });

  it('a reset studio leaves none of the old studio\'s films behind', async () => {
    const state = buildPopulatedStudio(42);
    await writeSave(state, SAVE_VERSION);
    const reset = studioReducer(state, { type: 'RESET_SAVE', startingCash: 8_000_000 });
    const report = await writeSave(reset, SAVE_VERSION);
    expect(report.projectsDeleted).toBe(state.projects.length);
    resetWrittenSnapshotForTests();
    expect((await readSave(SAVE_VERSION))?.projects).toEqual([]);
  });

  it('two projects sharing an id are both kept', async () => {
    const state = buildPopulatedStudio(42);
    const doubled = { ...state, projects: [...state.projects.slice(0, 3), state.projects[0]] };
    await writeSave(doubled, SAVE_VERSION);
    resetWrittenSnapshotForTests();
    expect((await readSave(SAVE_VERSION))?.projects.length).toBe(4);
  });
});

describe('a failed save is reported, not swallowed', () => {
  it('reports failure when the database cannot be opened, keeps the game playable, and recovers on retry', async () => {
    const working = globalThis.indexedDB;
    // @ts-expect-error - simulating a browser with storage blocked
    globalThis.indexedDB = undefined;
    await hydrateSave();
    expect(getSaveStatus().kind).toBe('failed');

    const state = buildStateWithReadyDraft(6);
    saveState(state);
    await flushSave();
    expect(getSaveStatus().kind).toBe('failed');
    expect(loadState()).toBe(state); // still playable from memory

    globalThis.indexedDB = working;
    await flushSave();
    expect(getSaveStatus()).toEqual({ kind: 'ok' });
    resetWrittenSnapshotForTests();
    expect(await readSave(SAVE_VERSION)).toEqual(state);
  });

  it('names a full disk as the reason when the write runs out of quota', async () => {
    await hydrateSave();
    const working = globalThis.indexedDB;
    const quota = Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
    globalThis.indexedDB = { open: () => { throw quota; } } as unknown as IDBFactory;
    saveState(buildStateWithReadyDraft(6));
    await flushSave();
    const status = getSaveStatus();
    expect(status.kind).toBe('failed');
    expect(status.kind === 'failed' && status.reason).toMatch(/out of storage space/);
    globalThis.indexedDB = working;
  });
});
