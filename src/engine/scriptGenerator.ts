import type { Genre, Script, Tone, ToneProfile } from '../types';
import { GENRE_PROFILES, GENRE_TYPICAL_AUDIENCES } from '../data/genres';
import { SCRIPT_TITLE_WORDS } from '../data/scriptWords';
import { TONES } from '../data/tones';
import { generatePremise } from './premiseGenerator';
import { type RandomFn, clamp, pick, pickMany, randFloat, randInt } from './random';

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
