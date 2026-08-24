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

export interface PremisePool {
  /** Identifies WHICH pool was chosen, so a premise hash can be keyed to it - see generatePremise. */
  key: string;
  /** The concept-specific entries first, then the genre's wider bank - see selectPool. */
  entries: Premise[];
  /** How many leading `entries` are the concept-specific tier. 0 when the concept has no tier of its own. */
  preferredCount: number;
}

// How much of the hash space the concept-specific tier gets when one exists.
// Above 0.5 so a heist still usually reads like a heist and a Spacecraft sci-fi
// still usually gets a log-line written for spacecraft; below 1 so neither is
// trapped in a bank of five. Tunable - this is the whole "specific vs varied"
// dial for premise selection.
const PREFERRED_SHARE = 0.6;

/** The entries of `pool` written especially for `setting` - see Premise.settings. */
function taggedForSetting(pool: Premise[], setting: SettingArchetype): Premise[] {
  return pool.filter((p) => p.settings?.includes(setting));
}

/**
 * Which log-lines a script can draw from - concept-aware, and entirely
 * deterministic (no rng): the pool is a function of the concept alone, which is
 * what lets generatePremise hash against it instead of drawing.
 *
 * TWO TIERS, not one bank. The specific tier is what the concept most deserves;
 * the wider tier is the genre's general bank behind it, and selection is biased
 * toward the front by PREFERRED_SHARE.
 *
 * 1. Specific tier: a real Story Type (Heist, Sports, Biography, ...) is the
 *    strongest hook there is, so its own bank leads - a heist reads like a heist
 *    whatever genre it sits in. Failing that, the entries of the genre's bank
 *    written for this Setting, so a Spacecraft sci-fi or a Medieval fantasy
 *    leans toward log-lines meant for it without needing a bespoke pool per
 *    setting. 'Original' story types in an untagged setting have no specific
 *    tier at all, and the wider bank simply is the pool.
 * 2. Wider tier: the genre's flavor-tone bucket (an action-comedy, a
 *    horror-drama), or its 'straight' bucket when the rolled flavor has none.
 *
 * The tiering exists because strict priority starved the corpus. A Story Type
 * bank holds five log-lines and a setting-narrowed bank can hold one, and under
 * "most specific wins outright" those were the ONLY entries such a script could
 * ever receive - so the great majority of generated scripts drew from a small
 * fraction of the 342 written, and a player commissioning heists saw the same
 * five sentences for a whole playthrough. Measured over 24,000 generated
 * scripts, tiering lifts the effective pool from 60.9 to 147.4 without a word
 * of new content. It costs a little specificity per script and buys back most
 * of the corpus.
 */
export function selectPool(genre: Genre, storyType: StoryType, setting: SettingArchetype, flavorTone: Tone | null): PremisePool {
  const genreBank = PREMISE_BANKS[genre];
  const flavorBank = flavorTone ? genreBank[flavorTone] : undefined;
  const wider = (flavorBank ?? genreBank.straight)!;
  const widerKey = `${genre}:${flavorBank ? flavorTone : 'straight'}`;

  const storyBank = storyType !== 'Original' ? STORY_TYPE_PREMISES[storyType] : undefined;
  const hasStoryBank = Boolean(storyBank && storyBank.length > 0);

  // Where the specific tier comes from, in order: a Story Type bank's own
  // setting-tagged entries, else the whole Story Type bank, else the genre
  // bank's setting-tagged entries. Note the genre bank contributes NOTHING to
  // the specific tier once a Story Type bank exists - the Story Type is the
  // stronger hook, and the genre bank is already the tier behind.
  const storyTier = hasStoryBank ? storyBank! : [];
  const settingTagged = taggedForSetting(hasStoryBank ? storyTier : wider, setting);
  const preferred = settingTagged.length > 0 ? settingTagged : storyTier;

  // Two tiers, not three, deliberately. When a Story Type bank HAS setting-tagged
  // entries, the untagged remainder of that bank falls back into the wide tier
  // alongside the genre's general lines rather than sitting in a middle tier of
  // its own - so a War script set in a Modern Warzone puts its warzone-tagged war
  // lines up front and its remaining war line in with everything else. A third
  // tier (tagged story -> untagged story -> genre) is the natural shape if that
  // ever reads wrong; it costs one more count and one more stretch of the hash.
  // Measured own-bank share is 0.57-0.63 per Story Type as it stands, so the
  // flattening is not currently costing specificity.
  const behind = hasStoryBank ? [...storyTier, ...wider] : wider;
  const rest = behind.filter((p) => !preferred.includes(p));

  const specificKey = hasStoryBank ? `story:${storyType}` : widerKey;
  const key = preferred.length > 0
    ? `${settingTagged.length > 0 ? `${specificKey}+${setting}` : specificKey}|${widerKey}`
    : widerKey;

  return { key, entries: [...preferred, ...rest], preferredCount: preferred.length };
}

/**
 * Where in a two-tier pool a hash lands: PREFERRED_SHARE of the hash space maps
 * onto the leading concept-specific entries and the remainder onto the wider
 * bank behind them, so the split is a probability rather than a hard gate.
 *
 * Stretching each half back across its own tier (rather than scaling the raw
 * hash across everything) is what keeps the bias honest - within a tier the
 * distribution stays flat, so no single log-line becomes the favourite.
 */
export function startIndex(hash: number, total: number, preferredCount: number): number {
  if (preferredCount <= 0 || preferredCount >= total) return Math.floor(hash * total);
  if (hash < PREFERRED_SHARE) return Math.floor((hash / PREFERRED_SHARE) * preferredCount);
  const widerCount = total - preferredCount;
  return preferredCount + Math.floor(((hash - PREFERRED_SHARE) / (1 - PREFERRED_SHARE)) * widerCount);
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
  const { key, entries, preferredCount } = selectPool(genre, storyType, setting, flavorTone);

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
  const start = startIndex(hashUnit(`${title}|${key}`), entries.length, preferredCount);

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
