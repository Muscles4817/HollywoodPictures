// Regression coverage for "does the basic game loop actually work end to
// end" - added after a real production bug where GO_TO_STEP('talent') (the
// very next dispatch after picking a script and clicking Continue) threw
// uncaught deep inside the audience simulation whenever a previously-
// released film's BoxOfficeRun predated a shape change (Milestone 9's
// availability fields) - see state/persistence.ts's SAVE_KEY v19 -> v20
// comment for the full incident. `state/persistence.test.ts`'s "old saves
// migrate safely" suite pins that *specific* incident; this file's job is
// broader - actually drive the wizard through real dispatched actions
// (START_NEW_FILM -> pick script -> hire talent -> plan production -> shoot
// -> post -> market -> release), the same reducer path a real player's
// clicks take, rather than assembling a release-ready draft directly the
// way state/testFixtures.ts's buildReadyDraft does for the box-office-
// settlement tests. Any future shape change that breaks a screen
// transition - not just the specific one this bug came from - should show
// up here as a thrown error.
import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { createInitialStudio, createEmptyDraft, type GameState } from './gameState';
import { generateTalentPool } from '../engine/talentGenerator';
import { withRng } from '../engine/random';
import { MANDATORY_TALENT_ROLES } from '../data/talentGeneration';
import { deriveFocusedDraft } from './selectors';
import { playerDraftToProject, playerReleasedFilms } from '../engine/project';
import type { EffectsMethodKey, EnvironmentMethodKey } from '../types';

function freshState(seed: number): GameState {
  const { result, nextSeed } = withRng(seed, (rng) => ({ talentPool: generateTalentPool(rng) }));
  return {
    studio: createInitialStudio(50_000_000),
    screen: 'dashboard',
    projects: [],
    focusedProjectId: null,
    rngSeed: nextSeed,
    totalDays: 1,
    talentPool: result.talentPool,
    rivalStudios: [],
    viewingRivalStudioName: null,
    viewingProductionId: null,
  };
}

const ENVIRONMENT_STRATEGY: Record<EnvironmentMethodKey, number> = { studio: 0.4, location: 0.4, digital: 0.2 };
const EFFECTS_STRATEGY: Record<EffectsMethodKey, number> = { practical: 0.5, digital: 0.5 };

/**
 * Drives one film through the entire wizard via real dispatched actions -
 * develop, hire, plan, shoot, post-produce, market, release - and back to
 * the dashboard, exactly mirroring a player clicking through every screen.
 * Every intermediate GO_TO_STEP is exercised (not skipped), since that's
 * the exact action type the regression this file guards against travels
 * through - each one calls settleBoxOfficeForAllFilms for every
 * already-released film in the studio.
 */
function walkFilmThroughWizard(state: GameState): GameState {
  let s = state;
  s = studioReducer(s, { type: 'START_NEW_FILM' });
  expect(s.screen).toBe('develop');
  expect(s.focusedProjectId).not.toBeNull();

  s = studioReducer(s, { type: 'SET_TITLE', title: 'A Regression Test Picture' });
  s = studioReducer(s, { type: 'SET_GENRE', genre: 'Action' });
  s = studioReducer(s, { type: 'SET_TARGET_AUDIENCE', targetAudience: 'Mass Market' });
  expect(deriveFocusedDraft(s)!.scriptOptions.length).toBeGreaterThan(0);

  // Pick a script and Continue - the exact click sequence the reported bug
  // happened on.
  s = studioReducer(s, { type: 'SELECT_SCRIPT', script: deriveFocusedDraft(s)!.scriptOptions[0] });
  expect(() => {
    s = studioReducer(s, { type: 'GO_TO_STEP', step: 'talent' });
  }).not.toThrow();
  expect(s.screen).toBe('talent');

  for (const role of MANDATORY_TALENT_ROLES) {
    const candidate = s.talentPool[role]?.[0];
    expect(candidate, `no ${role} candidate in the generated talent pool`).toBeDefined();
    s = studioReducer(s, { type: 'SET_TALENT_FOR_ROLE', role, talent: candidate! });
  }

  expect(() => {
    s = studioReducer(s, { type: 'GO_TO_STEP', step: 'production-planning' });
  }).not.toThrow();
  expect(s.screen).toBe('production-planning');

  s = studioReducer(s, {
    type: 'SET_PRODUCTION_PLAN',
    environmentStrategy: ENVIRONMENT_STRATEGY,
    environmentAmbition: 0.5,
    effectsStrategy: EFFECTS_STRATEGY,
    effectsAmbition: 0.5,
    contingencyAmount: 500_000,
    runtimeIntensity: 0.5,
  });
  expect(deriveFocusedDraft(s)!.productionChoices).not.toBeNull();

  expect(() => {
    s = studioReducer(s, { type: 'GO_TO_STEP', step: 'production' });
  }).not.toThrow();
  expect(s.screen).toBe('production');

  s = studioReducer(s, { type: 'BEGIN_PHOTOGRAPHY' });
  expect(deriveFocusedDraft(s)!.photography?.status).toBe('in-progress');
  s = studioReducer(s, { type: 'FINISH_PHOTOGRAPHY', productionId: s.focusedProjectId! });
  expect(deriveFocusedDraft(s)!.photography?.status).toBe('finished');

  expect(() => {
    s = studioReducer(s, { type: 'GO_TO_STEP', step: 'post-production' });
  }).not.toThrow();
  expect(s.screen).toBe('post-production');

  s = studioReducer(s, {
    type: 'SET_POST_PRODUCTION_CHOICES',
    choices: { editStyle: 'Balanced', musicFocus: 'Standard', testScreeningResponse: 'Ignore', finalCutFocus: 'Trailer-focused' },
  });

  expect(() => {
    s = studioReducer(s, { type: 'GO_TO_STEP', step: 'marketing' });
  }).not.toThrow();
  expect(s.screen).toBe('marketing');

  s = studioReducer(s, {
    type: 'SET_MARKETING_CHOICES',
    choices: { marketingSpend: 20_000_000, releaseType: 'Wide', releaseWindow: 'Quiet Month' },
  });

  expect(() => {
    s = studioReducer(s, { type: 'RELEASE_FILM' });
  }).not.toThrow();
  expect(s.screen).toBe('results');
  expect(playerReleasedFilms(s.projects)).toHaveLength(playerReleasedFilms(state.projects).length + 1);

  s = studioReducer(s, { type: 'RETURN_TO_DASHBOARD' });
  expect(s.screen).toBe('dashboard');
  expect(s.focusedProjectId).toBeNull();

  return s;
}

describe('wizard run-through: a full film survives every screen transition without throwing', () => {
  it('start to finish, on a brand-new studio', () => {
    const finalState = walkFilmThroughWizard(freshState(1));
    const films = playerReleasedFilms(finalState.projects);
    expect(films).toHaveLength(1);
    expect(films[0].boxOfficeRun.status).not.toBe('finished'); // still running, just released
  });

  it('advancing days after release (the box office settling every day) never throws', () => {
    let s = walkFilmThroughWizard(freshState(2));
    for (let i = 0; i < 30; i++) {
      expect(() => {
        s = studioReducer(s, { type: 'ADVANCE_DAY' });
      }).not.toThrow();
    }
  });

  it('a second film released while the first is still running never throws navigating through it - the exact structural condition of the reported incident', () => {
    // The reported bug specifically needed an *already-released, still-
    // running* film in the studio when a later GO_TO_STEP fired (every
    // GO_TO_STEP calls settleBoxOfficeForAllFilms for every released film,
    // not just the one being worked on) - a single-film run doesn't
    // exercise that path at all once the first film reaches 'results'.
    let s = walkFilmThroughWizard(freshState(3));
    expect(playerReleasedFilms(s.projects)).toHaveLength(1);
    expect(playerReleasedFilms(s.projects)[0].boxOfficeRun.status).toBe('running');

    // A few days pass with the first film mid-run before starting the second.
    for (let i = 0; i < 10; i++) s = studioReducer(s, { type: 'ADVANCE_DAY' });

    s = walkFilmThroughWizard(s);
    expect(playerReleasedFilms(s.projects)).toHaveLength(2);
  });

  it('three films in a row, each released while earlier ones are still running, never throws - a realistic extended play session', () => {
    let s = freshState(4);
    for (let i = 0; i < 3; i++) {
      s = walkFilmThroughWizard(s);
      for (let day = 0; day < 5; day++) s = studioReducer(s, { type: 'ADVANCE_DAY' });
    }
    expect(playerReleasedFilms(s.projects)).toHaveLength(3);
  });
});

describe('wizard run-through: going back and forward through already-visited steps never throws', () => {
  it('a Back-then-forward round trip mid-wizard is a pure navigation no-op, not a crash', () => {
    let s = studioReducer(freshState(5), { type: 'START_NEW_FILM' });
    s = studioReducer(s, { type: 'SET_TITLE', title: 'Back And Forth' });
    s = studioReducer(s, { type: 'SET_GENRE', genre: 'Comedy' });
    s = studioReducer(s, { type: 'SET_TARGET_AUDIENCE', targetAudience: 'Teens' });
    s = studioReducer(s, { type: 'SELECT_SCRIPT', script: deriveFocusedDraft(s)!.scriptOptions[0] });
    s = studioReducer(s, { type: 'GO_TO_STEP', step: 'talent' });

    expect(() => {
      s = studioReducer(s, { type: 'GO_TO_STEP', step: 'develop' }); // Back
    }).not.toThrow();
    expect(s.screen).toBe('develop');

    expect(() => {
      s = studioReducer(s, { type: 'GO_TO_STEP', step: 'talent' }); // forward again, already charged
    }).not.toThrow();
    expect(s.screen).toBe('talent');
  });
});

describe('wizard run-through: createEmptyDraft alone is a valid starting point for every wizard action the reducer accepts before a script exists', () => {
  it('setting genre/audience/title against a brand-new empty draft never throws', () => {
    const draft = createEmptyDraft();
    const s0: GameState = { ...freshState(6), screen: 'develop', projects: [playerDraftToProject(draft)], focusedProjectId: draft.id };
    expect(() => {
      let s = studioReducer(s0, { type: 'SET_GENRE', genre: 'Horror' });
      s = studioReducer(s, { type: 'SET_TARGET_AUDIENCE', targetAudience: 'Niche' });
      s = studioReducer(s, { type: 'SET_TITLE', title: 'Empty Draft Smoke Test' });
    }).not.toThrow();
  });
});
