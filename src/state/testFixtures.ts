// Shared test-only fixtures for Milestone 5's integration tests
// (docs/DESIGN.md 5.34) - not matched by vitest.config.ts's
// `src/**/*.test.ts` include, so this is never itself run as a suite, only
// imported by state/studioReducer.test.ts, engine/boxOfficeRun.test.ts and
// state/persistence.test.ts. Builds a fully release-ready FilmDraft/GameState
// without going through the whole wizard's own reducer actions - those are
// already exercised elsewhere; this milestone's tests are about box office
// settlement, not wizard-flow correctness, so a draft assembled directly is
// both faster and more focused than driving 20+ reducer actions per test.
import type { Asset, FilmDraft, MarketingChoices, PhotographyState, PostProductionChoices, ProductionChoices } from '../types';
import { createDraftFromAsset, createInitialStudio, type GameState } from './gameState';
import { generateScriptOptions } from '../engine/scriptGenerator';
import { generateTalentCandidates, generateTalentPool } from '../engine/talentGenerator';
import { withRng, type RandomFn } from '../engine/random';
import { playerDraftToProject } from '../engine/project';

const PRODUCTION_CHOICES: ProductionChoices = {
  contingencyAmount: 500_000,
  setQualityAmount: 1_000_000,
  practicalEffectsAmount: 500_000,
  vfxAmount: 500_000,
  runtimeIntensity: 0.5,
};

const POST_PRODUCTION_CHOICES: PostProductionChoices = {
  editStyle: 'Balanced',
  musicFocus: 'Standard',
  testScreeningResponse: 'Ignore',
  finalCutFocus: 'Trailer-focused',
};

function finishedPhotography(recommendedDays: number): PhotographyState {
  return { status: 'finished', recommendedDays, daysElapsed: recommendedDays, events: [], runningCost: 0, pendingChoice: null };
}

export function defaultMarketingChoices(overrides: Partial<MarketingChoices> = {}): MarketingChoices {
  return { marketingSpend: 20_000_000, releaseType: 'Wide', releaseWindow: 'Quiet Month', ...overrides };
}

/**
 * An owned Asset built from a freshly-generated Script - the development-
 * pipeline doc's prerequisite for any FilmDraft (see
 * gameState.ts:createDraftFromAsset). `rng` is consumed for script
 * generation only.
 */
export function buildReadyAsset(rng: RandomFn): Asset {
  const script = generateScriptOptions('Action', rng, 1)[0];
  return { id: `asset-${script.id}`, script, source: 'Studio Original', acquisitionCost: script.cost, acquiredOnDay: 1 };
}

/**
 * A fully release-ready FilmDraft (every field RELEASE_FILM's guard clause
 * requires is populated) built from a real owned Asset and real talent
 * generators (so Script/Talent shapes can never drift from what the
 * generators actually produce), with hand-picked production/post-production/
 * marketing choices for determinism. `rng` is consumed for script/talent
 * generation only - pass the same seed twice for an identical draft.
 */
export function buildReadyDraft(rng: RandomFn, marketingOverrides: Partial<MarketingChoices> = {}): FilmDraft {
  const asset = buildReadyAsset(rng);
  const director = generateTalentCandidates('Director', rng, 1)[0];
  const lead = generateTalentCandidates('Actor', rng, 1)[0];
  const support = generateTalentCandidates('Actor', rng, 1)[0];

  return {
    ...createDraftFromAsset(asset, {}),
    targetAudience: 'Mass Market',
    talent: [
      { role: 'Director', talent: director },
      { role: 'Lead Actor', talent: lead },
      { role: 'Supporting Actor', talent: support },
    ],
    productionChoices: PRODUCTION_CHOICES,
    greenlitOnDay: 1,
    photography: finishedPhotography(40),
    postProductionChoices: POST_PRODUCTION_CHOICES,
    marketingChoices: defaultMarketingChoices(marketingOverrides),
  };
}

/** A GameState with a fresh studio (its Asset library already containing the draft's own originating Asset) and a release-ready draft loaded (and focused) - ready to dispatch RELEASE_FILM against. */
export function buildStateWithReadyDraft(seed: number, marketingOverrides: Partial<MarketingChoices> = {}): GameState {
  const { result, nextSeed } = withRng(seed, (rng) => {
    const studio = createInitialStudio(50_000_000);
    const talentPool = generateTalentPool(rng);
    const draft = buildReadyDraft(rng, marketingOverrides);
    return { studio, talentPool, draft };
  });
  return {
    studio: { ...result.studio, assets: [{ id: result.draft.assetId, script: result.draft.script!, source: 'Studio Original', acquisitionCost: result.draft.script!.cost, acquiredOnDay: 1 }] },
    screen: 'marketing',
    projects: [playerDraftToProject(result.draft)],
    focusedProjectId: result.draft.id,
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
