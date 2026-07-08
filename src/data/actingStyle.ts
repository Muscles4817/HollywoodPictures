import type { ActingStyle, Tone } from '../types';

export const ACTING_STYLE_AXES: Array<keyof ActingStyle> = [
  'characterTransformation',
  'emotionalPerformance',
  'charisma',
  'comedy',
  'physicalPerformance',
];

export const ACTING_STYLE_LABELS: Record<keyof ActingStyle, string> = {
  characterTransformation: 'Character Transformation',
  emotionalPerformance: 'Emotional Performance',
  charisma: 'Charisma',
  comedy: 'Comedy',
  physicalPerformance: 'Physical Performance',
};

// How much each acting-style axis contributes to each tone when translating
// an actor's native stats into tone-space for compatibility scoring
// (engine/compatibility.ts:deriveToneFromActingStyle). Weights are relative
// within a tone, not required to sum to any total - only their ratio to each
// other matters. Comedy and Physical Performance are clean specialists;
// Character Transformation leans harder into drama, Emotional Performance
// spreads more evenly across the "serious" tones; Charisma gets a smaller
// share of every tone, including spectacle (a charismatic, physically
// committed star still earns some credit for anchoring a blockbuster, even
// though acting style otherwise has little to do with production spectacle).
export const ACTING_STYLE_TONE_WEIGHTS: Record<Tone, Partial<Record<keyof ActingStyle, number>>> = {
  action: { physicalPerformance: 3, charisma: 1 },
  comedy: { comedy: 3, charisma: 1 },
  romance: { emotionalPerformance: 2, charisma: 2 },
  suspense: { characterTransformation: 2, emotionalPerformance: 2, charisma: 1 },
  drama: { characterTransformation: 3, emotionalPerformance: 2, charisma: 1 },
  spectacle: { physicalPerformance: 1, charisma: 2 },
};
