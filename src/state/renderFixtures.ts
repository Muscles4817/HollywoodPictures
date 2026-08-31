import { createRng, forkSeed } from '../engine/random';
import { generateProducerPool, generateTalentPool } from '../engine/talentGenerator';
import { generateRivalStudios } from '../engine/rivalStudios';
import { generateStuntTeamPool } from '../engine/stuntTeams';
import { createInitialStudio } from './gameState';
import { firstDayOfYear } from '../engine/calendar';
import { playerDraftToProject } from '../engine/project';
import { GENERATED_TALENT_DB } from '../data/talentDatabases';
import { studioReducer } from './studioReducer';
import { buildReadyDraft } from './testFixtures';
import type { GameState } from './gameState';

/**
 * A studio with a history, for looking at rather than asserting on.
 *
 * `testFixtures.ts:buildStateWithReadyDraft` is calibrated: ~36 test files
 * enter through it, and the order of its four generator calls is load-bearing
 * (its own comment says "Don't reorder these", because taking the downstream
 * seed in the wrong place silently re-runs every simulated shoot in the
 * suite). It is also deliberately minimal - `rivalStudios: []`,
 * `opportunities: []`, one asset, one project - which is right for a unit test
 * and useless for judging a screen.
 *
 * That emptiness is not a small problem for design work. It is why the Release
 * Calendar, the Opportunity Market and the Dashboard's competition panel all
 * render as empty states: they have nothing to show *by construction*, so any
 * density or layout judgement made against them is a judgement about an empty
 * page.
 *
 * This builds the other thing - the shape a real save has after a few years of
 * play - by replicating what `persistence.ts:loadState` generates for a fresh
 * studio and then running the reducer forward. Nothing here is calibrated and
 * nothing asserts on it; it exists so a screen can be looked at with real
 * content in it.
 */

export interface PopulatedStudioOptions {
  /** How many finished films the studio should have behind it. */
  releasedFilms?: number;
  /** Days to run on after the last release, so rivals and the market fill in. */
  settleDays?: number;
}

/** A fresh studio of the shape `loadState` generates, minus the localStorage. */
function freshStudioState(seed: number): GameState {
  const rng = createRng(seed);
  const talentPool = generateTalentPool(rng, GENERATED_TALENT_DB);
  const rivalStudios = generateRivalStudios(rng);
  const producerPool = generateProducerPool(rng);
  const stuntTeamPool = generateStuntTeamPool(rng);
  const rngSeed = forkSeed(rng);

  return {
    studio: { ...createInitialStudio(50_000_000), distributionArm: { tier: 3, internationalTier: 3 }, assets: [] },
    screen: 'dashboard',
    projects: [],
    focusedProjectId: null,
    projectWorkspaceSection: 'sheet',
    rngSeed,
    totalDays: 1,
    talentPool,
    talentDatabaseId: GENERATED_TALENT_DB.id,
    rivalStudios,
    producerPool,
    stuntTeamPool,
    opportunities: [],
    nextOpportunityCheckDay: 1,
    collaborations: [],
    talentPairings: [],
    awards: { history: [], season: null, nextSeasonDay: firstDayOfYear(2) },
    bidNotifications: [],
    viewingRivalStudioName: null,
    viewingProductionId: null,
  } as GameState;
}

export function buildPopulatedStudio(seed: number, options: PopulatedStudioOptions = {}): GameState {
  const { releasedFilms = 4, settleDays = 40 } = options;
  const rng = createRng(seed + 7919);
  let state = freshStudioState(seed);

  for (let i = 0; i < releasedFilms; i++) {
    // A fully packaged draft, dropped in focused and sent straight out - the
    // point is the finished record, not the route it took to get there.
    const draft = buildReadyDraft(rng);
    state = {
      ...state,
      projects: [...state.projects, playerDraftToProject(draft)],
      focusedProjectId: draft.id,
      studio: {
        ...state.studio,
        assets: [
          ...state.studio.assets,
          { id: draft.assetId, script: draft.script!, provenance: 'Founding', acquisitionCost: draft.script!.cost, acquiredOnDay: state.totalDays },
        ],
      },
    };
    state = studioReducer(state, { type: 'SCHEDULE_RELEASE', releaseDay: state.totalDays });
    // Long enough for the run to settle and for the next film to open on a
    // different date rather than all of them stacking on one week.
    for (let d = 0; d < 90; d++) state = studioReducer(state, { type: 'ADVANCE_DAY' });
  }

  for (let d = 0; d < settleDays; d++) state = studioReducer(state, { type: 'ADVANCE_DAY' });
  return { ...state, screen: 'dashboard', focusedProjectId: null };
}
