import type { Genre, Tone } from '../types';
import { PREMISE_BANKS } from '../data/premises';
import { pick, type RandomFn } from './random';

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Builds a script's one-sentence synopsis - conditioned on genre and which
 * tone (if any) got a flavor boost during tone-profile generation, so an
 * action-comedy script reads differently from a straight action script (see
 * engine/scriptGenerator.ts:generateToneProfile). Falls back to the genre's
 * 'straight' bucket when there's no bucket authored for the rolled flavor.
 * Every synopsis template starts with {protagonist}, so it's always what
 * gets capitalized when substituted in.
 */
export function generatePremise(genre: Genre, flavorTone: Tone | null, rng: RandomFn): string {
  const genreBank = PREMISE_BANKS[genre];
  const bucket = (flavorTone && genreBank[flavorTone]) || genreBank.straight!;
  const premise = pick(rng, bucket);
  return premise.synopsis
    .replace('{protagonist}', capitalize(premise.protagonist))
    .replace('{antagonist}', premise.antagonist ?? '');
}
