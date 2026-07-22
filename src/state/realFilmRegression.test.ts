// Regression tests that recreate real, well-known films from the shipped
// Test Scripts (data/testScripts.ts) cast with the real people from the
// handcrafted roster (data/handcraftedTalents.ts), release them through the
// real reducer, settle the full box-office run, and assert the resulting
// craft scores and box office "make sense".
//
// Two films anchor the two ends of the "does the model make sense" question:
//
//   - Inception (great script + Nolan + an A-list ensemble + a blockbuster
//     budget) - the craft showcase. Should land as a clearly well-reviewed,
//     profitable hit, never a flop and never an impossible 100.
//
//   - Suicide Squad (a big, star-studded, heavily-marketed comic-book film
//     with a notoriously *weak screenplay*) - the "bad but sells" case.
//     Note the real film was NOT a box-office failure: it was critically
//     savaged (Metacritic 40 / RT 26%) yet grossed ~$747M worldwide and made
//     money. The recreation must reproduce exactly that shape - low craft
//     scores, but still commercially profitable - which is the interesting
//     property: star power + IP + marketing can carry a badly-written film
//     commercially, so a weak critic score must NOT force a money-loss.
//
// Two kinds of assertion, on purpose:
//   1. Sanity/reality ranges - each recreation lands in the part of the scale
//      its real counterpart occupies (Inception a strong hit; Suicide Squad
//      panned-but-profitable), with headroom so a tuning pass doesn't break
//      them but a real regression does.
//   2. Comparative/monotonic - orderings that must survive any retuning: the
//      faithful Inception out-scores and out-earns a deliberately weak
//      recreation of its own script; and the well-written Inception out-scores
//      the badly-written Suicide Squad on every craft axis.
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
    // These recreations are major-studio Wide releases, so the studio self-
    // distributes (a full Distribution Arm) - keeping the box-office share the
    // ranges below were calibrated against, rather than the rented cut a studio
    // with no arm would take (engine/distribution.ts).
    studio: { ...result.studio, distributionArm: { tier: 3, internationalTier: 3 }, assets: [{ id: draft.assetId, script: draft.script!, source: 'Studio Original', acquisitionCost: 0, acquiredOnDay: 1 }] },
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

const SUICIDE_SQUAD: FilmRecreation = {
  scriptId: 'test-script-suicide-squad',
  director: 'David Ayer',
  // Cast order matches the script's own: Deadshot, Harley Quinn (leads);
  // Amanda Waller, Rick Flag, The Joker, Enchantress (supporting).
  leads: ['Will Smith', 'Margot Robbie'],
  supporting: ['Viola Davis', 'Joel Kinnaman', 'Jared Leto', 'Cara Delevingne'],
  // A real tentpole marketing blitz - the spend that carries a weak film
  // commercially.
  marketingSpend: 150_000_000,
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
    // A clear commercial success of *some* stripe - never a Flop or a Weak
    // return. The exact headline label is pinned separately below.
    expect(results.outcome).not.toBeNull();
    expect(results.outcome).not.toBe('Flop');
    expect(results.outcome).not.toBe('Weak');
  });

  it('compares sanely to the real film - and documents the current (ROI-driven) "Cult Hit" label quirk', () => {
    // How the recreation lines up against Inception (2010, Warner Bros.):
    //
    //   metric            real                    recreation      read
    //   ----------------  ----------------------  --------------  -------------------
    //   critic score      Metacritic 74 / RT 87   ~74             ~exact vs Metacritic
    //   audience score    RT 91% / CinemaScore A- ~79             a touch conservative
    //   worldwide gross   $836.8M                 ~$761M          within ~9%
    //   total cost        ~$160M + ~$100M mktg    ~$240M          close
    //   studio profit     ~$90M theatrical        ~$80M           close (42% share)
    //   headline outcome  blockbuster/phenomenon  "Cult Hit"      <-- diverges
    //
    // The scores and box office land remarkably close to reality. The LABEL is
    // the one deliberate-for-now divergence: engine/outcome.ts keys the
    // headline off profit *ratio*, not gross scale. At a 42% studio share a
    // ~$761M gross on a ~$240M film returns only ~0.33x its cost, which caps
    // the commercial tier at 'Modest Success'; strong audience love (>=78)
    // then upgrades it to 'Cult Hit'. So a film that out-grosses the entire
    // market can still read as a "Cult Hit" purely on margin. That's a
    // defensible ROI-first stance, but it collides with real-world language.
    //
    // This test pins that behaviour intentionally: if the label rules ever
    // grow a gross-scale route (so tentpole grosses read as Blockbuster/
    // Phenomenon regardless of margin), this assertion is meant to fail and be
    // updated - it's the tripwire for that follow-up, not a claim it's ideal.
    const results = releaseAndSettle(buildRecreationState(101, INCEPTION, 400_000_000, realTalent(INCEPTION)));

    expect(results.criticScore).toBeGreaterThanOrEqual(68);
    expect(results.criticScore).toBeLessThanOrEqual(82); // real Metacritic 74, in-band
    expect(results.audienceScore).toBeGreaterThanOrEqual(72);
    expect(results.totalBoxOffice!).toBeGreaterThan(500_000_000); // real worldwide $836.8M
    expect(results.totalBoxOffice!).toBeLessThan(1_100_000_000);
    expect(results.outcome).toBe('Cult Hit'); // known-quirk tripwire (see comment above)
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

describe('real-film regression: Suicide Squad (bad reviews, still made money)', () => {
  it('has the whole cast and crew present in the handcrafted roster', () => {
    expect(() => realTalent(SUICIDE_SQUAD)).not.toThrow();
    const talent = realTalent(SUICIDE_SQUAD);
    expect(talent).toHaveLength(7); // 1 director + 2 leads + 4 supporting
  });

  it('recreates the real shape: critically panned on craft, but a commercially profitable release', () => {
    // How the recreation lines up against Suicide Squad (2016, Warner Bros.):
    //
    //   metric            real                    recreation      read
    //   ----------------  ----------------------  --------------  -------------------
    //   critic score      Metacritic 40 / RT 26%  ~49             bad, as it should be
    //   script quality    "incoherent, choppy"    ~41             the weakest axis
    //   audience score    RT ~58% / CinemaScore B+ ~68            mediocre-to-ok
    //   worldwide gross   $746.8M                 ~$785M          within ~5%
    //   total cost        ~$175M + ~$150M mktg    ~$274M          close
    //   headline outcome  profitable despite pans  Modest Success matches reality
    //
    // The point of this case: a weak *screenplay* correctly tanks the craft
    // scores (critic/script well below Inception's) even with A-list stars,
    // yet the film still MAKES MONEY, because star power + IP + a huge
    // marketing spend drive the box office. A bad critic score must never, by
    // itself, force a commercial loss - that's the real-world truth this
    // recreation is here to keep honest.
    const results = releaseAndSettle(buildRecreationState(101, SUICIDE_SQUAD, 400_000_000, realTalent(SUICIDE_SQUAD)));

    // Craft: genuinely poorly reviewed - the script is the weak link.
    expect(results.criticScore).toBeLessThan(62); // real Metacritic 40
    expect(results.scriptScore).toBeLessThan(55);
    // Audience is more forgiving than critics for a crowd-pleasing spectacle.
    expect(results.audienceScore).toBeGreaterThan(50);
    expect(results.audienceScore).toBeLessThan(82);

    // ...but it still made money. This is the defining fact about the real
    // film, and the recreation reproduces it.
    expect(results.totalBoxOffice!).toBeGreaterThan(400_000_000); // real $746.8M
    expect(results.profit!).toBeGreaterThan(0);
    expect(results.outcome).not.toBe('Flop');
    // Not a craft accolade, and not the top commercial tiers either - a
    // middling-return crowd hit.
    expect(results.outcome).not.toBe('Masterpiece');
    expect(results.outcome).not.toBe('Phenomenon');
    expect(results.outcome).not.toBe('Blockbuster');
  });

  it('is out-classed on every craft axis by the well-written Inception (bad script scores below good script)', () => {
    // Same everything the sim can hold equal (budget dials, seed); the films
    // differ in script quality and cast. A durable ordering: a great
    // screenplay + great director must beat a weak screenplay on craft,
    // regardless of how the absolute numbers are later retuned.
    const inception = releaseAndSettle(buildRecreationState(303, INCEPTION, 400_000_000, realTalent(INCEPTION)));
    const suicideSquad = releaseAndSettle(buildRecreationState(303, SUICIDE_SQUAD, 400_000_000, realTalent(SUICIDE_SQUAD)));

    expect(inception.criticScore).toBeGreaterThan(suicideSquad.criticScore);
    expect(inception.scriptScore).toBeGreaterThan(suicideSquad.scriptScore);
    expect(inception.qualityScore).toBeGreaterThan(suicideSquad.qualityScore);
  });

  it("a bad script only profits BECAUSE of its stars and marketing - strip those and the same film barely survives", () => {
    // The commercial success is attributable to star power + spend, NOT the
    // screenplay: give the identical (weak) script a no-name cast and a
    // shoestring marketing budget and its profit return collapses toward zero.
    // This is what makes Suicide Squad "critic-proof" rather than "good".
    const starVehicle = releaseAndSettle(buildRecreationState(404, SUICIDE_SQUAD, 400_000_000, realTalent(SUICIDE_SQUAD)));
    const stripped = releaseAndSettle(buildRecreationState(404, { ...SUICIDE_SQUAD, marketingSpend: 3_000_000 }, 400_000_000, weakTalent(SUICIDE_SQUAD)));

    const starRatio = starVehicle.profit! / starVehicle.totalCost;
    const strippedRatio = stripped.profit! / stripped.totalCost;
    expect(starVehicle.totalBoxOffice!).toBeGreaterThan(stripped.totalBoxOffice! * 2);
    expect(starRatio).toBeGreaterThan(strippedRatio);
  });
});
