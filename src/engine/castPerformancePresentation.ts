// Player-facing prose for the post-release per-actor performance read
// (engine/castPerformance.ts). The engine hands over a category - a band and a
// named cause; this file owns the words, per the house style (CLAUDE.md: no raw
// stat values in front of the player). Deterministic: a stable per-person hash
// picks among phrasings so a slate of cast reads never looks copy-pasted, but
// the same actor always reads the same way (no RNG at render time).
import type { ActingStyle } from '../types';
import type { CastPerformanceRead, PerformanceBand, PerformanceCause, PerformanceTone } from './castPerformance';

// The actor's signature axis as a natural-language noun phrase - "their comic
// timing", "their physical commitment" - so a gift can be named in a sentence
// without ever showing the axis as a stat. Mirrors ACTING_STYLE_LABELS, but
// phrased to drop into prose rather than head a bar.
const GIFT_NOUN: Record<keyof ActingStyle, string> = {
  characterTransformation: 'their gift for disappearing into a role',
  emotionalPerformance: 'their emotional depth',
  charisma: 'their sheer screen presence',
  comedy: 'their comic timing',
  physicalPerformance: 'their physical commitment',
};

// A stable index from a person id - variety ACROSS the cast list, consistency
// PER actor, without touching the rng stream (the same fnv-1a helper the other
// presentation modules use).
function stablePick<T>(id: string, options: T[]): T {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return options[(h >>> 0) % options.length];
}

/** A compact chip label for a performance band - the scannable "good / neutral / bad" verdict. */
const BAND_LABEL: Record<PerformanceBand, string> = {
  inspired: 'Inspired casting',
  strong: 'Strong turn',
  solid: 'Dependable',
  weak: 'Underwhelming',
  poor: 'Miscast',
};

export function castBandLabel(band: PerformanceBand): string {
  return BAND_LABEL[band];
}

// One or two phrasings per cause. `{name}` is the actor; `{gift}` is filled from
// GIFT_NOUN when the read carries a gift axis (only the causes that reference a
// gift use it). Kept deliberately varied in angle - the outcome, the director's
// hand, the fit - so a cast list reads as authored notes, not a filled template.
const CAUSE_PHRASES: Record<PerformanceCause, string[]> = {
  'gift-realized': [
    '{name} was inspired casting — {gift} was exactly what the part called for.',
    'The part played straight to {name}: {gift} carried scene after scene.',
  ],
  'director-unlocked': [
    'The director drew a career-best out of {name}.',
    '{name} and the director clicked, and it shows — a performance well above their usual level.',
  ],
  'well-fitted': [
    '{name} was a natural fit for the role and delivered.',
    'Well cast — {name} slotted into the part without a seam.',
  ],
  steady: [
    '{name} turned in a dependable, no-surprises performance.',
    'Solid, professional work from {name} — it never lifted the film, but never let it down.',
  ],
  'director-flat': [
    '{name} was left on autopilot — the direction never pushed them, and the potential went untapped.',
    "There was more in {name} than made it to screen; a hands-off shoot left it there.",
  ],
  miscast: [
    '{name} was miscast — the role pulled against what they do best.',
    'The part never suited {name}; it asked for something other than what they bring.',
  ],
  'director-misfire': [
    "The director's read fought against {name}'s instincts, and the performance suffered for it.",
    '{name} and the director never found the same wavelength — the friction shows on screen.',
  ],
  limited: [
    '{name} was out of their depth — the part asked for more than they had to give.',
    'The role stretched {name} past their range.',
  ],
};

// Miscasting a genuinely gifted actor has a sharper sting - name the strength
// the film wasted. Only added when the read carries a gift axis, so a limited
// actor with no standout isn't credited with a wasted one.
const WASTED_GIFT_TAIL: Record<'miscast' | 'director-misfire', string> = {
  miscast: ' {gift} went to waste.',
  'director-misfire': ' {gift} never got the chance to land.',
};

function fill(template: string, name: string, giftAxis: keyof ActingStyle | null): string {
  const gift = giftAxis ? GIFT_NOUN[giftAxis] : '';
  return template.replaceAll('{name}', name).replaceAll('{gift}', gift);
}

/**
 * The full post-release read for one cast member as a producer would put it -
 * "was casting them the right call," in a sentence. Names the actor's signature
 * gift when the story turns on it (realised on a standout, wasted on a miscast).
 */
export function describeCastPerformance(read: CastPerformanceRead): string {
  const base = stablePick(`${read.personId}:perf`, CAUSE_PHRASES[read.cause]);
  let sentence = fill(base, read.name, read.giftAxis);
  if (read.giftAxis && (read.cause === 'miscast' || read.cause === 'director-misfire')) {
    // The tail is its own sentence (the base already ends in a full stop), so
    // capitalise its first word - the gift noun starts lower-case ("their ...").
    const tail = fill(WASTED_GIFT_TAIL[read.cause], read.name, read.giftAxis).trimStart();
    sentence += ` ${tail.charAt(0).toUpperCase()}${tail.slice(1)}`;
  }
  return sentence;
}

/** The tone marker a card uses to colour a performance line - a small glyph for good / neutral / bad. */
export function castPerformanceMarker(tone: PerformanceTone): string {
  switch (tone) {
    case 'good':
      return '▲';
    case 'bad':
      return '▼';
    case 'neutral':
      return '■';
  }
}
