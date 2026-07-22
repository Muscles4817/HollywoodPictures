// Shared test-only fixtures for Milestone 5's integration tests
// (docs/DESIGN.md 5.34) - not matched by vitest.config.ts's
// `src/**/*.test.ts` include, so this is never itself run as a suite, only
// imported by state/studioReducer.test.ts, engine/boxOfficeRun.test.ts and
// state/persistence.test.ts. Builds a fully release-ready FilmDraft/GameState
// without going through the whole wizard's own reducer actions - those are
// already exercised elsewhere; this milestone's tests are about box office
// settlement, not wizard-flow correctness, so a draft assembled directly is
// both faster and more focused than driving 20+ reducer actions per test.
import type { Asset, FilmDraft, MarketingChoices, PhotographyState, Person, ProductionChoices, ProductionRole, Script } from '../types';
import { createDraftFromAsset, createInitialStudio, type GameState } from './gameState';
import { generateScriptOptions } from '../engine/scriptGenerator';
import { generateTalentCandidates, generateTalentPool } from '../engine/talentGenerator';
import { withRng, type RandomFn } from '../engine/random';
import { asPlayerDraft, findProject, playerDraftToProject } from '../engine/project';
import { footageLowerBound } from '../engine/production';
import { studioReducer } from './studioReducer';
import { characterForRoleSlot } from '../engine/castRequirements';
import { DEFAULT_POST_PRODUCTION_CHOICES } from '../data/postProduction';

/**
 * Test-only: make a synthetic actor satisfy the gender written for the
 * Character at (role, slotIndex), so a helper that casts fabricated or
 * cheapest-in-pool actors doesn't trip the real gender guard now enforced at
 * hire time (engine/casting.ts). A no-op for non-actor roles and 'Any'/absent
 * casting genders. Overwrites only identity.gender - deterministic, and adds
 * no RNG draws, so seeded generation sequences elsewhere are unchanged.
 */
export function conformActorGenderToSlot(person: Person, script: Script | null, role: ProductionRole, slotIndex: number): Person {
  const character = script ? characterForRoleSlot(script, role, slotIndex) : null;
  const required = character?.castingGender;
  if (!required || required === 'Any' || person.identity.gender === required) return person;
  return { ...person, identity: { ...person.identity, gender: required } };
}

const PRODUCTION_CHOICES: ProductionChoices = {
  contingencyAmount: 500_000,
  setQualityAmount: 1_000_000,
  practicalEffectsAmount: 500_000,
  vfxAmount: 500_000,
  runtimeIntensity: 0.5,
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
      { role: 'Director', person: director },
      { role: 'Lead Actor', person: lead },
      { role: 'Supporting Actor', person: support },
    ],
    productionChoices: PRODUCTION_CHOICES,
    greenlitOnDay: 1,
    photography: finishedPhotography(40),
    // A release-ready draft is one whose post-production has fully wrapped -
    // the mandatory test screening has fired and been resolved (Release
    // As-Is: no delay), which SCHEDULE_RELEASE now requires before a film can
    // go out (state/studioReducer.ts). Both ready-day fields sit in the past
    // so the release-day clamp is a no-op for these box-office fixtures.
    postProductionScreeningReadyDay: 1,
    postProductionFinalReadyDay: 1,
    testScreeningResolved: true,
    postProductionChoices: DEFAULT_POST_PRODUCTION_CHOICES,
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
    // A full Distribution Arm so the fixture's default Wide release self-
    // distributes (keeping the standard box-office share these box-office
    // fixtures are calibrated against), rather than taking the rented cut a
    // studio with no arm would - see engine/distribution.ts.
    studio: { ...result.studio, distributionArm: { tier: 3, internationalTier: 3 }, assets: [{ id: result.draft.assetId, script: result.draft.script!, source: 'Studio Original', acquisitionCost: result.draft.script!.cost, acquiredOnDay: 1 }] },
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

/**
 * Shoot a greenlit, focused project through to a wrapped shoot: advance
 * principal photography (resolving any on-set choice with its first option)
 * until there's enough footage to wrap (engine/production.ts:footageLowerBound),
 * then finish. Replaces the old "greenlight then FINISH_PHOTOGRAPHY on day 0"
 * shortcut, which the footage lower bound now (correctly) blocks.
 */
export function shootThroughToFinish(state: GameState, productionId?: string): GameState {
  let s = state;
  const id = productionId ?? s.focusedProjectId!;
  for (let guard = 0; guard < 1000; guard++) {
    const photo = asPlayerDraft(findProject(s.projects, id))?.photography;
    if (!photo || photo.status === 'finished') break;
    if (photo.status === 'awaiting-choice' && photo.pendingChoice) {
      s = studioReducer(s, { type: 'RESOLVE_EVENT_CHOICE', choiceId: photo.pendingChoice.choices[0].id, productionId: id });
      continue;
    }
    if (photo.daysElapsed >= footageLowerBound(photo.recommendedDays)) {
      s = studioReducer(s, { type: 'FINISH_PHOTOGRAPHY', productionId: id });
      break;
    }
    s = studioReducer(s, { type: 'ADVANCE_SHOOTING_DAY' });
  }
  return s;
}
