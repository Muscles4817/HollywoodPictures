import type { Genre, SettingArchetype, StoryType, Tone } from '../types';
import { PREMISE_BANKS, STORY_TYPE_PREMISES, type Premise } from '../data/premises';
import { randInt, type RandomFn } from './random';

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function render(premise: Premise): string {
  return premise.synopsis
    .replaceAll('{protagonist}', capitalize(premise.protagonist))
    .replaceAll('{antagonist}', premise.antagonist ?? '');
}

/**
 * Which log-line pool a script draws from - concept-aware, and entirely
 * deterministic (no rng), so premise selection still consumes exactly one
 * random draw regardless of concept or de-duplication (see generatePremise).
 *
 * Priority:
 * 1. A specific Story Type (Heist, Sports, Biography, ...) is the strongest
 *    hook there is, so it wins outright - a heist reads like a heist whatever
 *    genre it sits in. 'Original' story types (the common case) have no bank
 *    and fall through.
 * 2. Otherwise the genre's flavor-tone bucket (an action-comedy, a
 *    horror-drama), or its 'straight' bucket when the rolled flavor has none.
 * 3. Setting nudge: if any log-line in the chosen pool is tagged as
 *    especially suiting this script's Setting, narrow to those - so a
 *    Spacecraft sci-fi or a Medieval fantasy leans toward log-lines written
 *    for it, without needing a bespoke pool per setting.
 */
function selectPool(genre: Genre, storyType: StoryType, setting: SettingArchetype, flavorTone: Tone | null): Premise[] {
  const genreBank = PREMISE_BANKS[genre];
  const storyBank = storyType !== 'Original' ? STORY_TYPE_PREMISES[storyType] : undefined;
  const base = (storyBank && storyBank.length > 0 ? storyBank : (flavorTone && genreBank[flavorTone]) || genreBank.straight)!;
  const settingMatched = base.filter((p) => p.settings?.includes(setting));
  return settingMatched.length > 0 ? settingMatched : base;
}

/**
 * Builds a script's one-sentence synopsis, conditioned on its genre, Story
 * Type, Setting and flavor tone (see selectPool). `usedSynopses` is the set
 * of log-lines already handed out in this slate - the picked one is added to
 * it, and a collision walks forward through the pool (deterministically, no
 * extra rng) to the next unused entry, so one slate doesn't show the same
 * log-line twice the way titles already avoid doing. Only when the whole pool
 * is exhausted does it fall back to repeating. Consumes exactly one rng draw
 * (the start index), keeping every downstream seeded sequence identical to a
 * plain single pick.
 */
export function generatePremise(
  genre: Genre,
  storyType: StoryType,
  setting: SettingArchetype,
  flavorTone: Tone | null,
  usedSynopses: Set<string>,
  rng: RandomFn,
): string {
  const pool = selectPool(genre, storyType, setting, flavorTone);
  const start = randInt(rng, 0, pool.length - 1);
  for (let i = 0; i < pool.length; i++) {
    const text = render(pool[(start + i) % pool.length]);
    if (!usedSynopses.has(text)) {
      usedSynopses.add(text);
      return text;
    }
  }
  const text = render(pool[start]);
  usedSynopses.add(text);
  return text;
}
