// Regression coverage for "does the basic game loop actually work end to
// end" - added after a real production bug where GO_TO_STEP('talent') (the
// very next dispatch after picking a script and clicking Continue) threw
// uncaught deep inside the audience simulation whenever a previously-
// released film's BoxOfficeRun predated a shape change (Milestone 9's
// availability fields) - see state/persistence.ts's SAVE_KEY v19 -> v20
// comment for the full incident. `state/persistence.test.ts`'s "old saves
// migrate safely" suite pins that *specific* incident; this file's job is
// broader - actually drive the wizard through real dispatched actions
// (acquire an Asset -> create a Project -> hire talent -> plan production ->
// greenlight -> shoot -> post -> market -> release), the same reducer path a
// real player's clicks take (development-pipeline doc), rather than
// assembling a release-ready draft directly the way
// state/testFixtures.ts's buildReadyDraft does for the box-office-settlement
// tests. Any future shape change that breaks a screen transition - not just
// the specific one this bug came from - should show up here as a thrown
// error.
import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { createInitialStudio, type GameState } from './gameState';
import { buildReadyAsset, conformActorGenderToSlot } from './testFixtures';
import { generateTalentPool } from '../engine/talentGenerator';
import { withRng } from '../engine/random';
import { MANDATORY_TALENT_ROLES } from '../data/talentGeneration';
import { professionForProductionRole } from '../data/helpers';
import { effectiveRoleCapacity } from '../engine/castRequirements';
import { getTypicalSalaryForRole } from '../engine/person';
import { deriveFocusedDraft } from './selectors';
import { playerReleasedFilms } from '../engine/project';
import type { EffectsMethodKey, EnvironmentMethodKey } from '../types';

function freshState(seed: number): GameState {
  const { result, nextSeed } = withRng(seed, (rng) => ({ talentPool: generateTalentPool(rng) }));
  return {
    studio: createInitialStudio(50_000_000),
    screen: 'dashboard',
    projects: [],
    focusedProjectId: null,
    projectWorkspaceSection: 'overview',
    rngSeed: nextSeed,
    totalDays: 1,
    talentPool: result.talentPool,
    rivalStudios: [],
    opportunities: [],
    nextOpportunityCheckDay: 1,
    viewingRivalStudioName: null,
    viewingProductionId: null,
  };
}

const ENVIRONMENT_STRATEGY: Record<EnvironmentMethodKey, number> = { studio: 0.4, location: 0.4, digital: 0.2 };
const EFFECTS_STRATEGY: Record<EffectsMethodKey, number> = { practical: 0.5, digital: 0.5 };

/**
 * Drives one film through the entire wizard via real dispatched actions -
 * own an Asset, create a Project from it, hire, plan, greenlight, shoot,
 * post-produce, market, release - and back to the dashboard, exactly
 * mirroring a player clicking through every screen. Every intermediate
 * GO_TO_STEP is exercised (not skipped), since that's the exact action type
 * the regression this file guards against travels through - each one calls
 * settleBoxOfficeForAllFilms for every already-released film in the studio.
 * Seeds a fresh owned Asset onto the given state first (via the same
 * rngSeed the state is already carrying) so this can be called more than
 * once against the same evolving state for a multi-film session.
 */
function walkFilmThroughWizard(state: GameState): GameState {
  const { result: asset, nextSeed } = withRng(state.rngSeed, (rng) => buildReadyAsset(rng));
  let s: GameState = { ...state, rngSeed: nextSeed, studio: { ...state.studio, assets: [...state.studio.assets, asset] } };

  s = studioReducer(s, { type: 'CREATE_PROJECT_FROM_ASSET', assetId: asset.id });
  expect(s.screen).toBe('workspace');
  expect(s.projectWorkspaceSection).toBe('overview');
  expect(s.focusedProjectId).not.toBeNull();
  expect(deriveFocusedDraft(s)!.script).not.toBeNull();

  s = studioReducer(s, { type: 'SET_TITLE', title: 'A Regression Test Picture' });
  s = studioReducer(s, { type: 'SET_TARGET_AUDIENCE', targetAudience: 'Mass Market' });

  expect(() => {
    s = studioReducer(s, { type: 'OPEN_PROJECT_WORKSPACE_SECTION', section: 'cast-and-crew' });
  }).not.toThrow();
  expect(s.projectWorkspaceSection).toBe('cast-and-crew');

  // Hires enough candidates to satisfy every role's own
  // effectiveRoleCapacity.min, not just one each - Lead Actor/Supporting
  // Actor can each require more than one hire, per this script's own
  // requiredLeads/requiredSupporting (engine/castRequirements.ts).
  // engine/projectReadiness.ts's readiness gate (now enforced by
  // GREENLIGHT_PROJECT itself, not just the UI) checks against that same
  // capacity, so under-hiring a multi-slot role here would leave the draft
  // permanently un-greenlightable. Picks by ascending salary (with a
  // per-profession draw index) rather than raw pool order, for two reasons:
  // (1) Lead Actor and Supporting Actor now share one Actor pool (used to
  // be two disjoint pools) and would otherwise both pick the same real
  // person, which the double-cast guard (state/studioReducer.ts) then
  // correctly rejects; (2) the handcrafted real-actor entries at the front
  // of that shared pool (data/handcraftedTalents.ts) are high-fame,
  // high-salary stars - picking several of them can blow this test's
  // starting cash in a way cheap candidates never would have.
  const script = deriveFocusedDraft(s)!.script!;
  const drawIndexByProfession = new Map<string, number>();
  for (const role of MANDATORY_TALENT_ROLES) {
    const profession = professionForProductionRole(role);
    const need = Math.max(1, effectiveRoleCapacity(role, script).min);
    for (let i = 0; i < need; i++) {
      const index = drawIndexByProfession.get(profession) ?? 0;
      drawIndexByProfession.set(profession, index + 1);
      const cheapest = [...(s.talentPool[profession] ?? [])].sort((a, b) => getTypicalSalaryForRole(a, role) - getTypicalSalaryForRole(b, role));
      const candidate = cheapest[index];
      expect(candidate, `no ${role} candidate in the generated talent pool`).toBeDefined();
      s = studioReducer(s, { type: 'TOGGLE_TALENT_FOR_ROLE', role, person: conformActorGenderToSlot(candidate!, script, role, i) });
    }
  }

  expect(() => {
    s = studioReducer(s, { type: 'OPEN_PROJECT_WORKSPACE_SECTION', section: 'production' });
  }).not.toThrow();
  expect(s.projectWorkspaceSection).toBe('production');

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
  expect(deriveFocusedDraft(s)!.greenlitOnDay).toBeNull();

  s = studioReducer(s, { type: 'GREENLIGHT_PROJECT' });
  expect(s.screen).toBe('production');
  expect(deriveFocusedDraft(s)!.greenlitOnDay).not.toBeNull();
  expect(deriveFocusedDraft(s)!.photography?.status).toBe('in-progress');
  s = studioReducer(s, { type: 'FINISH_PHOTOGRAPHY', productionId: s.focusedProjectId! });
  expect(deriveFocusedDraft(s)!.photography?.status).toBe('finished');

  expect(() => {
    s = studioReducer(s, { type: 'GO_TO_STEP', step: 'post-production' });
  }).not.toThrow();
  expect(s.screen).toBe('post-production');

  s = studioReducer(s, {
    type: 'SET_POST_PRODUCTION_CHOICES',
    choices: { editStyle: 'Balanced', musicFocus: 'Standard', finalCutFocus: 'Trailer-focused' },
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
    s = studioReducer(s, { type: 'SCHEDULE_RELEASE', releaseDay: s.totalDays });
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

describe('wizard run-through: freely navigating the Producer Workspace never throws or costs calendar time', () => {
  it('bouncing between workspace sections in any order is a pure navigation no-op, not a crash', () => {
    const { result: asset, nextSeed } = withRng(freshState(5).rngSeed, (rng) => buildReadyAsset(rng));
    const seeded: GameState = { ...freshState(5), rngSeed: nextSeed, studio: { ...createInitialStudio(50_000_000), assets: [asset] } };

    let s = studioReducer(seeded, { type: 'CREATE_PROJECT_FROM_ASSET', assetId: asset.id });
    s = studioReducer(s, { type: 'SET_TITLE', title: 'Back And Forth' });
    s = studioReducer(s, { type: 'SET_TARGET_AUDIENCE', targetAudience: 'Teens' });
    const totalDaysAtStart = s.totalDays;

    expect(() => {
      s = studioReducer(s, { type: 'OPEN_PROJECT_WORKSPACE_SECTION', section: 'cast-and-crew' });
    }).not.toThrow();
    expect(s.projectWorkspaceSection).toBe('cast-and-crew');

    expect(() => {
      s = studioReducer(s, { type: 'OPEN_PROJECT_WORKSPACE_SECTION', section: 'overview' }); // Back
    }).not.toThrow();
    expect(s.projectWorkspaceSection).toBe('overview');

    expect(() => {
      s = studioReducer(s, { type: 'OPEN_PROJECT_WORKSPACE_SECTION', section: 'cast-and-crew' }); // forward again
    }).not.toThrow();
    expect(s.projectWorkspaceSection).toBe('cast-and-crew');
    expect(s.screen).toBe('workspace');
    expect(s.totalDays).toBe(totalDaysAtStart); // free navigation never advances the calendar
  });
});
