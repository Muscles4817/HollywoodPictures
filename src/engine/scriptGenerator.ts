import type {
  Distribution,
  EffectsMethodKey,
  EnvironmentMethodKey,
  Genre,
  NormalizedScalar,
  Script,
  Tone,
  ToneProfile,
} from '../types';
import { GENRE_PROFILES, GENRE_TYPICAL_AUDIENCES, type GenreProfile } from '../data/genres';
import { SCRIPT_TITLE_WORDS } from '../data/scriptWords';
import { TONES } from '../data/tones';
import { generatePremise } from './premiseGenerator';
import { type RandomFn, clamp, normalizeWeights, pick, pickMany, randFloat, randInt } from './random';

let nextScriptId = 1;

function randomTitle(genre: Genre, rng: RandomFn): string {
  const bank = SCRIPT_TITLE_WORDS[genre];
  return `${pick(rng, bank.adjectives)} ${pick(rng, bank.nouns)}`;
}

const TITLE_RETRY_LIMIT = 15;

/** Re-rolls on a collision so one slate never shows the same title twice - see data/scriptWords.ts. */
function uniqueTitle(genre: Genre, rng: RandomFn, usedTitles: Set<string>): string {
  for (let attempt = 0; attempt < TITLE_RETRY_LIMIT; attempt++) {
    const title = randomTitle(genre, rng);
    if (!usedTitles.has(title)) {
      usedTitles.add(title);
      return title;
    }
  }
  // Word bank exhausted for this slate (shouldn't happen at 144 combinations
  // for a 12-script slate, but don't loop forever if it ever does).
  const title = randomTitle(genre, rng);
  usedTitles.add(title);
  return title;
}

const TONE_JITTER = 15;

// 0 flavor tones ~25% of the time (a "straight" genre film), 1 ~50%, 2 ~25%.
const FLAVOR_COUNT_WEIGHTS = [0, 1, 1, 2];
const FLAVOR_BOOST_RANGE: [number, number] = [20, 35];

/**
 * A script's tone profile starts as its genre's canonical vector plus
 * jitter, then gets 0-2 "flavor" tones boosted on top of that. This is what
 * produces real sub-genre variety - an action-comedy, an action-romance, a
 * low-budget action-revenge drama - instead of every script in a genre
 * reading as a pure, undiluted version of it. Most real films aren't just
 * their headline genre: buddy-cop action is action-comedy, most romantic
 * comedies are romance-comedy, plenty of horror leans hard into either
 * dark comedy or tragedy alongside the scares. Being "Action" doesn't mean
 * everything except spectacle has to be low.
 */
interface ToneGenerationResult {
  profile: ToneProfile;
  /**
   * Which tone(s), if any, got a flavor boost on top of the genre's
   * canonical vector - what actually produces sub-genre variety (an
   * action-comedy, a horror-comedy). Returned alongside the profile so
   * engine/premiseGenerator.ts can pick a matching synopsis bucket directly,
   * rather than re-deriving "was this flavored" from the final numbers.
   */
  flavorTones: Tone[];
}

function generateToneProfile(genre: Genre, rng: RandomFn): ToneGenerationResult {
  const canonical = GENRE_PROFILES[genre].canonicalTone;
  const profile = {} as ToneProfile;
  for (const tone of TONES) {
    profile[tone] = clamp(Math.round(canonical[tone] + randFloat(rng, -TONE_JITTER, TONE_JITTER)), 1, 100);
  }

  const flavorCount = pick(rng, FLAVOR_COUNT_WEIGHTS);
  const flavorTones = pickMany(rng, TONES, flavorCount);
  for (const tone of flavorTones) {
    profile[tone] = clamp(Math.round(profile[tone] + randFloat(rng, ...FLAVOR_BOOST_RANGE)), 1, 100);
  }

  return { profile, flavorTones };
}

// How far a Strategy/Ambition base value jitters per script, so two Action
// scripts don't read identically - same role TONE_JITTER plays for
// toneProfile above, just on a 0-1 scale instead of 1-100.
const STRATEGY_JITTER = 0.15;

function jitterWeight(base: number, rng: RandomFn): number {
  return Math.max(0.02, base + randFloat(rng, -STRATEGY_JITTER, STRATEGY_JITTER));
}

/**
 * The screenplay's own implied effects approach - anchored on the genre's
 * existing vfxImportance/practicalEffectsImportance (data/genres.ts) rather
 * than a new genre-level field. Those two numbers used to be read directly
 * as live scoring inputs (engine/scoring.ts); this is what makes them
 * generation inputs instead - what an individual script's own Strategy gets
 * generated around, same relationship GENRE_PROFILES.canonicalTone already
 * has to Script.toneProfile.
 */
function generateEffectsStrategy(profile: GenreProfile, rng: RandomFn): Distribution<EffectsMethodKey> {
  return normalizeWeights({
    digital: jitterWeight(profile.vfxImportance, rng),
    practical: jitterWeight(profile.practicalEffectsImportance, rng),
  });
}

/** How demanding the script's effects vision is, independent of the practical/digital split - genre's own effects importance, lifted a little further by script complexity. */
function generateEffectsAmbition(profile: GenreProfile, complexity: number, rng: RandomFn): NormalizedScalar {
  const genreBase = (profile.vfxImportance + profile.practicalEffectsImportance) / 2;
  const complexityLift = (complexity / 100) * 0.25;
  return clamp(genreBase * 0.75 + complexityLift + randFloat(rng, -0.15, 0.15), 0, 1);
}

/**
 * The screenplay's own implied environment approach. Weaker genre grounding
 * than effects - nothing in GENRE_PROFILES speaks to studio-vs-location
 * directly - so this is a rougher first pass, worth revisiting once a
 * recommendation engine is actually exercising it: `vfxImportance` sets how
 * much of the split goes to "digital" (a genre that leans on VFX for
 * spectacle tends to build its world digitally too), and
 * `lowBudgetFriendly` - a genre that tolerates a cheap budget usually gets
 * there partly by using real, found locations instead of paying to build
 * sets - splits what's left between location and studio.
 */
function generateEnvironmentStrategy(profile: GenreProfile, rng: RandomFn): Distribution<EnvironmentMethodKey> {
  const digitalBase = profile.vfxImportance * 0.7;
  const locationBase = profile.lowBudgetFriendly * 0.6;
  const studioBase = Math.max(0.05, 1 - digitalBase - locationBase);
  return normalizeWeights({
    studio: jitterWeight(studioBase, rng),
    location: jitterWeight(locationBase, rng),
    digital: jitterWeight(digitalBase, rng),
  });
}

/** How demanding the script's environment vision is, independent of the studio/location/digital split - same shape of formula as effects ambition. */
function generateEnvironmentAmbition(profile: GenreProfile, complexity: number, rng: RandomFn): NormalizedScalar {
  const genreBase = (1 - profile.lowBudgetFriendly) * 0.6 + profile.vfxImportance * 0.4;
  const complexityLift = (complexity / 100) * 0.25;
  return clamp(genreBase * 0.75 + complexityLift + randFloat(rng, -0.15, 0.15), 0, 1);
}

// Mostly a single protagonist; occasionally a pair or a true ensemble lead.
const LEAD_COUNT_WEIGHTS = [1, 1, 1, 1, 1, 2, 2, 2, 3];
// A typical-sized supporting cast is the common case; small and large ensembles both happen.
const SUPPORTING_COUNT_WEIGHTS = [1, 2, 2, 3, 3, 3, 4];

/**
 * Cost scales with the average of the script's quality attributes -
 * a highly original, well-structured, marketable script costs more to acquire.
 */
function estimateScriptCost(script: Pick<Script, 'originality' | 'structure' | 'dialogue' | 'marketability'>): number {
  const avgQuality = (script.originality + script.structure + script.dialogue + script.marketability) / 4;
  const baseCost = 50_000;
  const scaledCost = avgQuality * 6_000; // up to ~600k for a top-tier spec script
  return Math.round((baseCost + scaledCost) / 1000) * 1000;
}

/** Generates one script option for the given genre. */
function generateScript(genre: Genre, rng: RandomFn, title: string): Script {
  const genreFit = randInt(rng, 55, 100); // scripts are written with this genre in mind, so fit skews high
  const originality = randInt(rng, 10, 100);
  const structure = randInt(rng, 20, 100);
  const dialogue = randInt(rng, 20, 100);
  const marketability = randInt(rng, 15, 100);
  const complexity = randInt(rng, 10, 100);
  const { profile: toneProfile, flavorTones } = generateToneProfile(genre, rng);
  const genreProfile = GENRE_PROFILES[genre];

  return {
    id: `script-${nextScriptId++}`,
    title,
    genre,
    genreFit,
    originality,
    structure,
    dialogue,
    marketability,
    complexity,
    cost: estimateScriptCost({ originality, structure, dialogue, marketability }),
    toneProfile,
    environmentStrategy: generateEnvironmentStrategy(genreProfile, rng),
    environmentAmbition: generateEnvironmentAmbition(genreProfile, complexity, rng),
    effectsStrategy: generateEffectsStrategy(genreProfile, rng),
    effectsAmbition: generateEffectsAmbition(genreProfile, complexity, rng),
    synopsis: generatePremise(genre, flavorTones[0] ?? null, rng),
    requiredLeads: pick(rng, LEAD_COUNT_WEIGHTS),
    requiredSupporting: pick(rng, SUPPORTING_COUNT_WEIGHTS),
    intendedAudience: pick(rng, GENRE_TYPICAL_AUDIENCES[genre]),
  };
}

/** Generates a slate of script options for the player to choose from. */
export function generateScriptOptions(genre: Genre, rng: RandomFn, count = 12): Script[] {
  const usedTitles = new Set<string>();
  return Array.from({ length: count }, () => generateScript(genre, rng, uniqueTitle(genre, rng, usedTitles)));
}
