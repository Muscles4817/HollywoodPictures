import type { Genre, SettingArchetype, StoryType, Tone } from '../types';
import { PREMISE_BANKS, STORY_TYPE_PREMISES, type Premise } from '../data/premises';
import { hashUnit, type RandomFn } from './random';

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function render(premise: Premise): string {
  return premise.synopsis
    .replaceAll('{protagonist}', capitalize(premise.protagonist))
    .replaceAll('{antagonist}', premise.antagonist ?? '');
}

interface PremisePool {
  /** Identifies WHICH pool was chosen, so a premise hash can be keyed to it - see generatePremise. */
  key: string;
  entries: Premise[];
}

/**
 * Which log-line pool a script draws from - concept-aware, and entirely
 * deterministic (no rng): the pool is a function of the concept alone, which is
 * what lets generatePremise hash against it instead of drawing.
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
function selectPool(genre: Genre, storyType: StoryType, setting: SettingArchetype, flavorTone: Tone | null): PremisePool {
  const genreBank = PREMISE_BANKS[genre];
  const storyBank = storyType !== 'Original' ? STORY_TYPE_PREMISES[storyType] : undefined;
  const usingStoryBank = Boolean(storyBank && storyBank.length > 0);
  const flavorBank = flavorTone ? genreBank[flavorTone] : undefined;
  const base = (usingStoryBank ? storyBank : flavorBank || genreBank.straight)!;
  const baseKey = usingStoryBank ? `story:${storyType}` : `${genre}:${flavorBank ? flavorTone : 'straight'}`;

  const settingMatched = base.filter((p) => p.settings?.includes(setting));
  return settingMatched.length > 0
    ? { key: `${baseKey}+${setting}`, entries: settingMatched }
    : { key: baseKey, entries: base };
}

/**
 * Builds a script's one-sentence synopsis, conditioned on its genre, Story
 * Type, Setting and flavor tone (see selectPool). `usedSynopses` is the set
 * of log-lines already handed out in this slate - the picked one is added to
 * it, and a collision walks forward through the pool (deterministically, no
 * extra rng) to the next unused entry, so one slate doesn't show the same
 * log-line twice the way titles already avoid doing. Only when the whole pool
 * is exhausted does it fall back to repeating.
 *
 * The starting entry is HASHED from `title` plus the chosen pool, not drawn -
 * see the note in the body for why, and for why the one rng draw it still takes
 * is deliberately thrown away.
 */
export function generatePremise(
  genre: Genre,
  storyType: StoryType,
  setting: SettingArchetype,
  flavorTone: Tone | null,
  title: string,
  usedSynopses: Set<string>,
  rng: RandomFn,
): string {
  const { key, entries } = selectPool(genre, storyType, setting, flavorTone);

  // The starting index is HASHED from the script's own title plus the pool it
  // landed in, rather than drawn from the rng.
  //
  // Which log-line a script gets is now a property of that script rather than of
  // its position in the generation stream, and picking one costs no draw. That
  // is what makes it movable: the work that follows needs premise selection to
  // happen EARLIER than it does today (early enough for the concept to inform
  // the cast and the production requirements it implies), and a positional draw
  // cannot move without shifting every draw after it.
  //
  // Salted with the title rather than the script id: ids are Date.now() plus
  // Math.random() (scriptGenerator.ts:newScriptId, deliberately - they are
  // identity, not a replayable outcome), so hashing one would hand back a
  // different synopsis on every run of the same seed, which is worse than the
  // draw it replaces. Note the title is itself drawn from the stream by
  // uniqueTitle, so a synopsis is not wholly stream-independent - but the title
  // is a PARAMETER of generateScript, fixed before its body runs, which is the
  // property that actually matters here: selection can move anywhere inside
  // generation without shifting a single draw.
  //
  // Keyed on the pool as well as the title so a repeat title landing in a
  // different pool is free to sit at a different offset within it. Worth being
  // precise about why, since the obvious reason is wrong: uniqueTitle makes
  // in-slate title collisions impossible (measured at zero across 12,000
  // slates), and usedSynopses is per-slate, so it never sees the case. What
  // repeats is titles ACROSS slates over a playthrough, where nothing
  // de-duplicates - and there, keying stops one recurring title dragging the
  // same offset through every pool it ever lands in.
  //
  // The rng draw below is retained, and its value deliberately discarded, purely
  // so this change is provably stream-neutral: every later draw in generation
  // lands exactly where it did before, so the only thing that can differ in the
  // whole suite is which log-line a script carries. It is dead weight the moment
  // premise selection actually moves, and should be deleted then.
  rng();
  const start = Math.floor(hashUnit(`${title}|${key}`) * entries.length);

  for (let i = 0; i < entries.length; i++) {
    const text = render(entries[(start + i) % entries.length]);
    if (!usedSynopses.has(text)) {
      usedSynopses.add(text);
      return text;
    }
  }
  const text = render(entries[start]);
  usedSynopses.add(text);
  return text;
}
