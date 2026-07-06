import type { Genre, Script } from '../types';
import { SCRIPT_TITLE_WORDS } from '../data/scriptWords';
import { type RandomFn, pick, randInt } from './random';

let nextScriptId = 1;

function randomTitle(genre: Genre, rng: RandomFn): string {
  const bank = SCRIPT_TITLE_WORDS[genre];
  return `${pick(rng, bank.adjectives)} ${pick(rng, bank.nouns)}`;
}

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
function generateScript(genre: Genre, rng: RandomFn): Script {
  const genreFit = randInt(rng, 55, 100); // scripts are written with this genre in mind, so fit skews high
  const originality = randInt(rng, 10, 100);
  const structure = randInt(rng, 20, 100);
  const dialogue = randInt(rng, 20, 100);
  const marketability = randInt(rng, 15, 100);
  const complexity = randInt(rng, 10, 100);

  return {
    id: `script-${nextScriptId++}`,
    title: randomTitle(genre, rng),
    genre,
    genreFit,
    originality,
    structure,
    dialogue,
    marketability,
    complexity,
    cost: estimateScriptCost({ originality, structure, dialogue, marketability }),
  };
}

/** Generates a slate of script options for the player to choose from. */
export function generateScriptOptions(genre: Genre, rng: RandomFn, count = 4): Script[] {
  return Array.from({ length: count }, () => generateScript(genre, rng));
}
