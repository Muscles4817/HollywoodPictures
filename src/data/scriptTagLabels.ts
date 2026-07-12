import type { ScriptArchetype, ScriptScale, Setting, StoryType } from '../types';

// Display labels for the screenplay-redesign tag enums (docs/DESIGN.md -
// screenplay redesign, presentation polish pass) - the enum values
// themselves are camelCase/PascalCase identifiers meant for code
// (`ComingOfAge`, `SciFi`, `CrowdPleaser`), not prose; every place that
// shows one of these tags to a player reads its label from here instead of
// the raw identifier. Same "explicit label map next to its enum" pattern
// data/tones.ts:TONE_LABELS already established.
export const ARCHETYPE_LABELS: Record<ScriptArchetype, string> = {
  Prestige: 'Prestige',
  CrowdPleaser: 'Crowd-Pleaser',
  Spectacle: 'Spectacle',
  OriginalVision: 'Original Vision',
  GenreFormula: 'Genre Formula',
};

export const STORY_TYPE_LABELS: Record<StoryType, string> = {
  Original: 'Original',
  Sports: 'Sports',
  Musical: 'Musical',
  Biography: 'Biography',
  Documentary: 'Documentary',
  Crime: 'Crime',
  Mystery: 'Mystery',
  Superhero: 'Superhero',
  War: 'War',
  ComingOfAge: 'Coming of Age',
  Heist: 'Heist',
};

// 'Sci-Fi' matches data/genres.ts's own Genre spelling, so the Setting badge
// and the Genre badge never disagree on how to write the same word.
export const SETTING_LABELS: Record<Setting, string> = {
  Modern: 'Modern',
  Historical: 'Historical',
  Fantasy: 'Fantasy',
  SciFi: 'Sci-Fi',
  Space: 'Space',
};

export const SCALE_LABELS: Record<ScriptScale, string> = {
  Intimate: 'Intimate',
  Medium: 'Medium',
  Epic: 'Epic',
};
