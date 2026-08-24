// Shared test-only fixtures for Milestone 5's integration tests
// (docs/DESIGN.md 5.34) - not matched by vitest.config.ts's
// `src/**/*.test.ts` include, so this file is never itself run as a suite -
// its own tests live next door in testFixtures.test.ts. Imported by ~64 test
// files, which is why the rng discipline below matters so much: anything these
// builders couple together, they couple together for most of the suite.
// Builds a fully release-ready FilmDraft/GameState
// without going through the whole wizard's own reducer actions - those are
// already exercised elsewhere; this milestone's tests are about box office
// settlement, not wizard-flow correctness, so a draft assembled directly is
// both faster and more focused than driving 20+ reducer actions per test.
import type { Asset, CharacterAgeBand, FilmDraft, MarketingChoices, PhotographyState, Person, ProductionChoices, ProductionRole, Script } from '../types';
import { createDraftFromAsset, createInitialStudio, type GameState } from './gameState';
import { generateScriptOptions } from '../engine/scriptGenerator';
import { generateTalentCandidates, generateTalentPool } from '../engine/talentGenerator';
import { createRng, forkRng, forkSeed, type RandomFn } from '../engine/random';
import { asPlayerDraft, findProject, playerDraftToProject } from '../engine/project';
import { footageLowerBound } from '../engine/production';
import { studioReducer } from './studioReducer';
import { characterForRoleSlot } from '../engine/castRequirements';
import { DEFAULT_POST_PRODUCTION_CHOICES } from '../data/postProduction';

/** A whole-year age comfortably inside each written age band, so a conformed actor clears the hire-time age gate. */
const AGE_BAND_TARGET_AGE: Record<Exclude<CharacterAgeBand, 'Any'>, number> = {
  Child: 8,
  Teen: 16,
  YoungAdult: 25,
  Adult: 37,
  MiddleAged: 52,
  Senior: 67,
};

/**
 * Test-only: make a synthetic actor satisfy BOTH casting qualifiers written for
 * the Character at (role, slotIndex) - gender (an exact match) and age band (a
 * fitting birth date) - so a helper that casts fabricated or cheapest-in-pool
 * actors doesn't trip the real hire-time guards (engine/casting.ts). A no-op
 * for non-actor roles and for 'Any'/absent qualifiers. Overwrites only
 * identity.gender/dateOfBirth - deterministic, and adds no RNG draws, so seeded
 * generation sequences elsewhere are unchanged. The birth date targets an age
 * mid-band as of Year 1 (day 1 = Year 1), where these fixtures do their hiring.
 */
export function conformActorGenderToSlot(person: Person, script: Script | null, role: ProductionRole, slotIndex: number): Person {
  const character = script ? characterForRoleSlot(script, role, slotIndex) : null;
  if (!character) return person;
  let identity = person.identity;
  const requiredGender = character.castingGender;
  if (requiredGender && requiredGender !== 'Any' && identity.gender !== requiredGender) {
    identity = { ...identity, gender: requiredGender };
  }
  const requiredBand = character.castingAgeBand;
  if (requiredBand && requiredBand !== 'Any') {
    identity = { ...identity, dateOfBirth: { year: 1 - AGE_BAND_TARGET_AGE[requiredBand], month: 1, day: 1 } };
  }
  return identity === person.identity ? person : { ...person, identity };
}

const PRODUCTION_CHOICES: ProductionChoices = {
  shootingBudgetAmount: 500_000,
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
  return { id: `asset-${script.id}`, script, provenance: 'Founding', acquisitionCost: script.cost, acquiredOnDay: 1 };
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
  // THE RNG DISCIPLINE FOR THIS FILE, stated once here and pointed at from the
  // other builders: anything that must not move when script generation changes
  // takes its seed from the caller's stream BEFORE the script is generated.
  //
  // Script and talent used to share one stream, so a change to how many draws a
  // script costs re-rolled the director and both actors of every draft built
  // here - across ~64 test files. Measured, the cost of that coupling is real
  // but narrower than it looks: a pure draw-count change to script generation
  // moved two execution/calibration suites before this discipline and none
  // after. It buys nothing at all for changes that alter script CONTENT (a
  // different premise, a different rolled field) - those move the fixtures'
  // scripts, and their downstream results, whatever we do about streams. The
  // point is only to stop unrelated churn masquerading as a regression.
  //
  // The reverse coupling is deliberately kept - scripts still draw from the
  // caller's own stream - because nothing downstream re-rolls talent mid-fixture.
  const talentRng = forkRng(rng);
  const asset = buildReadyAsset(rng);
  const director = generateTalentCandidates('Director', talentRng, 1)[0];
  const lead = generateTalentCandidates('Actor', talentRng, 1)[0];
  const support = generateTalentCandidates('Actor', talentRng, 1)[0];

  return {
    ...createDraftFromAsset(asset, {}, 1),
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
  // Same discipline as buildReadyDraft above, and for the larger half of the
  // fixture surface: the ORDER of these four lines is the whole point.
  //
  // The talent pool is generated first and the state's own downstream seed is
  // forked second, both before the script exists. That seed is what every later
  // reducer roll runs on - pre-production events, on-set choices, the test
  // screening, the box office - so if it were taken after script generation
  // (which is exactly what withRng's trailing nextSeed does, since it draws once
  // fn has returned) then a one-draw change inside the script generator would
  // silently re-run every simulated shoot in the suite. That is the same
  // amplifier buildReadyDraft just removed, and it reaches further: ~36 files
  // enter through here.
  //
  // withRng is deliberately not used for that reason. Don't reorder these.
  const rng = createRng(seed);
  const studio = createInitialStudio(50_000_000);
  const talentPool = generateTalentPool(rng);
  const downstreamSeed = forkSeed(rng);
  const draft = buildReadyDraft(rng, marketingOverrides);
  const result = { studio, talentPool, draft };
  return {
    // A full Distribution Arm so the fixture's default Wide release self-
    // distributes (keeping the standard box-office share these box-office
    // fixtures are calibrated against), rather than taking the rented cut a
    // studio with no arm would - see engine/distribution.ts.
    studio: { ...result.studio, distributionArm: { tier: 3, internationalTier: 3 }, assets: [{ id: result.draft.assetId, script: result.draft.script!, provenance: 'Founding', acquisitionCost: result.draft.script!.cost, acquiredOnDay: 1 }] },
    screen: 'marketing',
    projects: [playerDraftToProject(result.draft)],
    focusedProjectId: result.draft.id,
    projectWorkspaceSection: 'overview',
    rngSeed: downstreamSeed,
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
/**
 * Advance a focused, greenlit project's pre-production to completion - resolving
 * any prep decision with its first option - which auto-opens Principal
 * Photography (state/studioReducer.ts:ADVANCE_PREPRODUCTION_DAY). A no-op once
 * the project is already shooting. ADVANCE_PREPRODUCTION_DAY always drives the
 * FOCUSED project, so this only advances prep for the focused one.
 */
export function prepThroughToShoot(state: GameState, productionId?: string): GameState {
  let s = state;
  const id = productionId ?? s.focusedProjectId!;
  for (let guard = 0; guard < 1000; guard++) {
    const prep = asPlayerDraft(findProject(s.projects, id))?.preProduction;
    if (!prep || prep.status === 'finished') break;
    if (prep.status === 'awaiting-choice' && prep.pendingChoice) {
      s = studioReducer(s, { type: 'RESOLVE_PREPRODUCTION_CHOICE', choiceId: prep.pendingChoice.choices[0].id, productionId: id });
      continue;
    }
    s = studioReducer(s, { type: 'ADVANCE_PREPRODUCTION_DAY' });
  }
  return s;
}

export function shootThroughToFinish(state: GameState, productionId?: string): GameState {
  let s = state;
  const id = productionId ?? s.focusedProjectId!;
  // Greenlight now drops into a live pre-production phase before photography
  // (types/index.ts:PreProductionState); run it to completion first (resolving
  // any prep decision with its first option), which auto-opens the shoot.
  s = prepThroughToShoot(s, id);
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
