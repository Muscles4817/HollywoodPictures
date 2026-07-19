// Regression tests that recreate real, well-known films from the shipped
// Test Scripts (data/testScripts.ts) cast with the real people from the
// handcrafted roster (data/handcraftedTalents.ts), release them through the
// real reducer, settle the full box-office run, and assert the resulting
// craft scores and box office "make sense".
//
// Two kinds of assertion, on purpose:
//   1. Sanity ranges - a faithful, well-funded recreation of a great film
//      (Inception: Nolan + an A-list ensemble + a blockbuster budget) lands
//      in the "clearly a well-reviewed hit" part of the scale, not a flop and
//      not a literally-impossible 100.
//   2. Comparative/monotonic - the faithful recreation out-scores AND
//      out-earns a deliberately weak recreation of the SAME script (no-name
//      director, cheap low-range actors, a shoestring marketing spend). This
//      is the durable half: it keeps holding as the scoring/box-office
//      formulas get retuned, because it only asserts an ordering, never an
//      absolute number a tuning pass could move.
//
// It also doubles as a roster guard - findByName throws if any of the real
// people an established film needs has been renamed or dropped from
// handcraftedTalents.ts, so removing (say) Joseph Gordon-Levitt fails loudly
// here instead of silently degrading the recreation.
import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { createInitialStudio, createDraftFromAsset, type GameState } from './gameState';
import { conformActorGenderToSlot } from './testFixtures';
import { withRng } from '../engine/random';
import { generateTalentPool } from '../engine/talentGenerator';
import { playerDraftToProject, playerReleasedFilms } from '../engine/project';
import { MAX_SIMULATION_WEEKS } from '../engine/audienceSimulationStep';
import { DEFAULT_POST_PRODUCTION_CHOICES } from '../data/postProduction';
import { TEST_SCRIPT_ASSETS } from '../data/testScripts';
import { HANDCRAFTED_DIRECTORS, HANDCRAFTED_ACTORS } from '../data/handcraftedTalents';
import type { FilmDraft, FilmResults, PhotographyState, Person, ProductionChoices, TalentAssignment } from '../types';

/** Dispatches ADVANCE_DAY n times, threading state through - the same background tick App.tsx fires, driven directly (mirrors studioReducer.test.ts). */
function advanceDays(state: GameState, n: number): GameState {
  let s = state;
  for (let i = 0; i < n; i++) s = studioReducer(s, { type: 'ADVANCE_DAY' });
  return s;
}

function finishedPhotography(recommendedDays: number): PhotographyState {
  return { status: 'finished', recommendedDays, daysElapsed: recommendedDays, events: [], runningCost: 0, pendingChoice: null };
}

// A generous blockbuster line: high set quality/VFX/practical spend - the
// production-budget dials a tentpole would actually push.
const BLOCKBUSTER_PRODUCTION_CHOICES: ProductionChoices = {
  contingencyAmount: 5_000_000,
  setQualityAmount: 20_000_000,
  practicalEffectsAmount: 10_000_000,
  vfxAmount: 15_000_000,
  runtimeIntensity: 0.6,
};

function findByName(pool: Person[], name: string): Person {
  const person = pool.find((p) => p.identity.name === name);
  if (!person) throw new Error(`Talent roster is missing "${name}" - a real-film regression test depends on it being in handcraftedTalents.ts.`);
  return person;
}

/** How to recreate one real film: which shipped Test Script, who directs, and the real actors mapped in cast order (leads then supporting, matching the script's own Lead-then-Supporting cast ordering). */
interface FilmRecreation {
  scriptId: string;
  director: string;
  leads: string[];
  supporting: string[];
  marketingSpend: number;
}

function assetFor(scriptId: string) {
  const asset = TEST_SCRIPT_ASSETS.find((a) => a.script.id === scriptId);
  if (!asset) throw new Error(`No Test Script with id "${scriptId}".`);
  return asset;
}

/**
 * Build a release-ready GameState whose focused draft is a recreation of a
 * real film. Talent is assembled directly (bypassing the hire actions) the
 * same way state/testFixtures.ts does, so this is about scoring/box office,
 * not the wizard flow. conformActorGenderToSlot is a no-op for correctly-cast
 * roles but keeps the helper safe to reuse for any future film.
 */
function buildRecreationState(seed: number, spec: FilmRecreation, foundingCash: number, talent: TalentAssignment[]): GameState {
  const asset = assetFor(spec.scriptId);
  const draft: FilmDraft = {
    ...createDraftFromAsset(asset, {}),
    targetAudience: asset.script.intendedAudience,
    talent,
    productionChoices: BLOCKBUSTER_PRODUCTION_CHOICES,
    greenlitOnDay: 1,
    photography: finishedPhotography(60),
    postProductionScreeningReadyDay: 1,
    postProductionFinalReadyDay: 1,
    testScreeningResolved: true,
    postProductionChoices: DEFAULT_POST_PRODUCTION_CHOICES,
    marketingChoices: { marketingSpend: spec.marketingSpend, releaseType: 'Wide', releaseWindow: 'Summer' },
  };
  const { result, nextSeed } = withRng(seed, (rng) => {
    const studio = createInitialStudio(foundingCash);
    const talentPool = generateTalentPool(rng);
    return { studio, talentPool };
  });
  return {
    studio: { ...result.studio, assets: [{ id: draft.assetId, script: draft.script!, source: 'Studio Original', acquisitionCost: 0, acquiredOnDay: 1 }] },
    screen: 'marketing',
    projects: [playerDraftToProject(draft)],
    focusedProjectId: draft.id,
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

/** The faithful, real-talent cast for a recreation, cast into the script's slots in order. */
function realTalent(spec: FilmRecreation): TalentAssignment[] {
  const script = assetFor(spec.scriptId).script;
  const talent: TalentAssignment[] = [{ role: 'Director', person: findByName(HANDCRAFTED_DIRECTORS, spec.director) }];
  spec.leads.forEach((name, i) => {
    talent.push({ role: 'Lead Actor', person: conformActorGenderToSlot(findByName(HANDCRAFTED_ACTORS, name), script, 'Lead Actor', i) });
  });
  spec.supporting.forEach((name, i) => {
    talent.push({ role: 'Supporting Actor', person: conformActorGenderToSlot(findByName(HANDCRAFTED_ACTORS, name), script, 'Supporting Actor', i) });
  });
  return talent;
}

let weakId = 0;
function weakActor(gender: 'Male' | 'Female'): Person {
  weakId += 1;
  return {
    id: `weak-actor-${weakId}`,
    identity: { name: `Unknown ${weakId}`, appearanceTags: [], gender, dateOfBirth: { year: -30, month: 1, day: 1 } },
    personality: { professionalism: 40, ambition: 50, loyalty: 50, ego: 50, temperament: 50, pressureHandling: 40, controversy: 20, adaptability: 45 },
    reputation: { fame: 8, prestige: 8, industryRespect: 15, reliability: 40, currentHeat: 6 },
    primaryRole: 'Actor',
    careers: {
      actor: {
        role: 'Actor', active: true, experience: 12, roleReputation: 12, minimumSalary: 50_000, typicalSalary: 100_000,
        actingStyle: { characterTransformation: 22, emotionalPerformance: 22, charisma: 25, comedy: 20, physicalPerformance: 22 },
      },
    },
    availability: { commitments: [] },
    traits: [],
  };
}

function weakDirector(): Person {
  return {
    id: 'weak-director-1',
    identity: { name: 'Unknown Director', appearanceTags: [], gender: 'Male', dateOfBirth: { year: -35, month: 1, day: 1 } },
    personality: { professionalism: 40, ambition: 50, loyalty: 50, ego: 50, temperament: 50, pressureHandling: 40, controversy: 20, adaptability: 45 },
    reputation: { fame: 8, prestige: 8, industryRespect: 15, reliability: 40, currentHeat: 6 },
    primaryRole: 'Director',
    careers: {
      director: {
        role: 'Director', active: true, experience: 12, roleReputation: 12, minimumSalary: 50_000, typicalSalary: 100_000, skill: 22,
        toneProfile: { action: 30, comedy: 30, romance: 30, suspense: 30, drama: 30, spectacle: 30 },
        productionStyle: { environmentStrategy: { studio: 0.34, location: 0.33, digital: 0.33 }, effectsStrategy: { practical: 0.5, digital: 0.5 } },
      },
    },
    availability: { commitments: [] },
    traits: [],
  };
}

/** A deliberately weak recreation of the same script: no-name director + cheap low-range actors in every slot (genders still matched so the cast is valid). */
function weakTalent(spec: FilmRecreation): TalentAssignment[] {
  const script = assetFor(spec.scriptId).script;
  const talent: TalentAssignment[] = [{ role: 'Director', person: weakDirector() }];
  script.cast.filter((c) => c.prominence === 'Lead').forEach((c, i) => {
    const gender = c.castingGender === 'Female' ? 'Female' : 'Male';
    talent.push({ role: 'Lead Actor', person: conformActorGenderToSlot(weakActor(gender), script, 'Lead Actor', i) });
  });
  script.cast.filter((c) => c.prominence === 'Supporting').forEach((c, i) => {
    const gender = c.castingGender === 'Female' ? 'Female' : 'Male';
    talent.push({ role: 'Supporting Actor', person: conformActorGenderToSlot(weakActor(gender), script, 'Supporting Actor', i) });
  });
  return talent;
}

/** Release the focused draft and settle the whole theatrical run, returning the final (fully-populated) FilmResults. */
function releaseAndSettle(state: GameState): FilmResults {
  const released = studioReducer(state, { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
  const finished = advanceDays(released, MAX_SIMULATION_WEEKS * 7 + 7);
  const film = playerReleasedFilms(finished.projects)[0];
  return film.results;
}

const INCEPTION: FilmRecreation = {
  scriptId: 'test-script-inception',
  director: 'Christopher Nolan',
  // Cast order matches the script's own: Dom Cobb, Arthur (leads); Ariadne,
  // Eames, Robert Fischer, Mal (supporting). Ariadne is written Female, so
  // Anne Hathaway (a real Nolan collaborator) stands in - the binary gender
  // model the sim enforces can't represent Elliot Page's actual casting.
  leads: ['Leonardo DiCaprio', 'Joseph Gordon-Levitt'],
  supporting: ['Anne Hathaway', 'Tom Hardy', 'Cillian Murphy', 'Marion Cotillard'],
  marketingSpend: 100_000_000,
};

describe('real-film regression: Inception', () => {
  it('has the whole cast and crew present in the handcrafted roster', () => {
    // Throws (failing the test) if any needed real person is missing/renamed.
    expect(() => realTalent(INCEPTION)).not.toThrow();
    const talent = realTalent(INCEPTION);
    expect(talent).toHaveLength(7); // 1 director + 2 leads + 4 supporting
    expect(talent.filter((t) => t.role === 'Lead Actor')).toHaveLength(2);
    expect(talent.filter((t) => t.role === 'Supporting Actor')).toHaveLength(4);
  });

  it('a faithful, well-funded recreation lands as a well-reviewed hit (sane score + box-office ranges)', () => {
    const results = releaseAndSettle(buildRecreationState(101, INCEPTION, 400_000_000, realTalent(INCEPTION)));

    // Craft scores: clearly strong, but never the impossible extremes.
    expect(results.qualityScore).toBeGreaterThan(65);
    expect(results.qualityScore).toBeLessThan(100);
    expect(results.criticScore).toBeGreaterThan(65);
    expect(results.criticScore).toBeLessThanOrEqual(100);
    expect(results.audienceScore).toBeGreaterThan(65);
    expect(results.audienceScore).toBeLessThanOrEqual(100);
    expect(results.actingScore).toBeGreaterThan(65);
    expect(results.directionScore).toBeGreaterThan(65);

    // Box office: the run has fully settled, and it's a profitable hit that
    // out-grosses its own combined production + marketing outlay.
    expect(results.totalBoxOffice).not.toBeNull();
    expect(results.totalBoxOffice!).toBeGreaterThan(results.totalCost);
    expect(results.profit).not.toBeNull();
    expect(results.profit!).toBeGreaterThan(0);
    expect(results.outcome).not.toBeNull();
    expect(['Modest Success', 'Hit', 'Blockbuster', 'Phenomenon', 'Cult Hit', 'Masterpiece']).toContain(results.outcome);
  });

  it('the faithful A-list recreation out-scores AND out-earns a weak recreation of the same script', () => {
    // Same script, same budget dials, same seed - the only difference is the
    // talent quality and marketing spend. This ordering must survive any
    // future retuning of the scoring or box-office curves.
    const strong = releaseAndSettle(buildRecreationState(202, INCEPTION, 400_000_000, realTalent(INCEPTION)));
    const weak = releaseAndSettle(buildRecreationState(202, { ...INCEPTION, marketingSpend: 3_000_000 }, 400_000_000, weakTalent(INCEPTION)));

    expect(strong.actingScore).toBeGreaterThan(weak.actingScore);
    expect(strong.directionScore).toBeGreaterThan(weak.directionScore);
    expect(strong.qualityScore).toBeGreaterThan(weak.qualityScore);
    expect(strong.criticScore).toBeGreaterThan(weak.criticScore);
    expect(strong.audienceScore).toBeGreaterThan(weak.audienceScore);
    expect(strong.totalBoxOffice!).toBeGreaterThan(weak.totalBoxOffice!);
    expect(strong.profit!).toBeGreaterThan(weak.profit!);
  });
});
