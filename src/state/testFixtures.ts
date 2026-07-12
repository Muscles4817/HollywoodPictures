// Shared test-only fixtures for Milestone 5's integration tests
// (docs/DESIGN.md 5.34) - not matched by vitest.config.ts's
// `src/**/*.test.ts` include, so this is never itself run as a suite, only
// imported by state/studioReducer.test.ts, engine/boxOfficeRun.test.ts and
// state/persistence.test.ts. Builds a fully release-ready FilmDraft/GameState
// without going through the whole wizard's own reducer actions - those are
// already exercised elsewhere; this milestone's tests are about box office
// settlement, not wizard-flow correctness, so a draft assembled directly is
// both faster and more focused than driving 20+ reducer actions per test.
import type { FilmDraft, MarketingChoices, PhotographyState, PostProductionChoices, ProductionChoices } from '../types';
import { createEmptyDraft, createInitialStudio, type GameState } from './gameState';
import { generateScriptOptions } from '../engine/scriptGenerator';
import { generateTalentCandidates } from '../engine/talentGenerator';
import { withRng, type RandomFn } from '../engine/random';

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
 * A fully release-ready FilmDraft (every field RELEASE_FILM's guard clause
 * requires is populated) built from real script/talent generators (so
 * Script/Talent shapes can never drift from what the generators actually
 * produce), with hand-picked production/post-production/marketing choices
 * for determinism. `rng` is consumed for script/talent generation only -
 * pass the same seed twice for an identical draft.
 */
export function buildReadyDraft(rng: RandomFn, marketingOverrides: Partial<MarketingChoices> = {}): FilmDraft {
  const script = generateScriptOptions('Action', rng, 1)[0];
  const director = generateTalentCandidates('Director', rng, 1)[0];
  const lead = generateTalentCandidates('Lead Actor', rng, 1)[0];
  const support = generateTalentCandidates('Supporting Actor', rng, 1)[0];

  return {
    ...createEmptyDraft(),
    title: script.title,
    genre: 'Action',
    targetAudience: 'Mass Market',
    scriptOptions: [script],
    script,
    talent: [director, lead, support],
    productionChoices: PRODUCTION_CHOICES,
    photography: finishedPhotography(40),
    postProductionChoices: POST_PRODUCTION_CHOICES,
    marketingChoices: defaultMarketingChoices(marketingOverrides),
  };
}

/** A GameState with a fresh studio and a release-ready draft loaded - ready to dispatch RELEASE_FILM against. */
export function buildStateWithReadyDraft(seed: number, marketingOverrides: Partial<MarketingChoices> = {}): GameState {
  const { result, nextSeed } = withRng(seed, (rng) => {
    // createInitialStudio's return is currently missing productionsInProgress
    // (unrelated in-progress work elsewhere in the tree, not this
    // milestone's concern - see docs/DESIGN.md 5.34 Milestone 5's summary)
    // - settleProductionsInProgress crashes on undefined without this. Not
    // fixed here since it isn't this fixture's job to patch gameState.ts;
    // just guaranteeing this test fixture's own studio is well-formed.
    const studio = { ...createInitialStudio(rng, 50_000_000), productionsInProgress: [] };
    const draft = buildReadyDraft(rng, marketingOverrides);
    return { studio, draft };
  });
  return {
    studio: result.studio,
    screen: 'marketing',
    draft: result.draft,
    rngSeed: nextSeed,
    totalDays: 1,
    rivalStudios: [],
    rivalProductionsInProgress: [],
    rivalFilmsReleased: [],
    viewingRivalStudioName: null,
    viewingProductionId: null,
  };
}
