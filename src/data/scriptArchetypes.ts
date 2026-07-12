import type { Genre, ScriptScale, ScriptArchetype, StoryType, TargetAudience } from '../types';

// The generation pipeline's actual starting point (docs/DESIGN.md -
// screenplay redesign): Archetype -> quality profile + Story Type + Setting
// + Scale + commercial lean, all chosen to cohere with the archetype rather
// than independently rolled. This is what makes a generated script read as
// a coherent concept ("a commercial sports drama" vs. "an arthouse
// psychological thriller") before any number is shown.
//
// Deliberately five, deliberately cross-genre - each archetype is a shape
// any genre can take (a Spectacle Comedy exists, just rarer than a
// Spectacle Action film - see genreAffinity), not a per-genre catalog.
export interface QualityRange {
  originality: [number, number];
  structure: [number, number];
  characters: [number, number];
  dialogue: [number, number];
  complexity: [number, number];
}

export interface ArchetypeCommercialBias {
  // Additive biases (roughly -20..+20) applied on top of the concept's
  // otherwise-derived accessibility/hookiness/crossover potential - see
  // engine/commercialProfile.ts. Not the whole story on their own; a
  // Prestige archetype's negative accessibility bias can still be
  // outweighed by a broadly-accessible genre/story-type/scale combination.
  accessibility: number;
  hookiness: number;
  crossover: number;
}

export interface ScriptArchetypeProfile {
  description: string;
  qualityRange: QualityRange;
  scaleWeights: Record<ScriptScale, number>;
  // Multiplies each story type's base weight (default 1 if unlisted) -
  // combined with the story type's own scaleAffinity/settingAffinity during
  // generation, not a replacement for it.
  storyTypeAffinity: Partial<Record<StoryType, number>>;
  // Multiplies each genre's base likelihood of rolling this archetype -
  // default 1 if unlisted (engine/scriptGenerator.ts).
  genreAffinity: Partial<Record<Genre, number>>;
  targetAudienceWeights: Partial<Record<TargetAudience, number>>;
  commercial: ArchetypeCommercialBias;
}

export const SCRIPT_ARCHETYPES: ScriptArchetype[] = ['Prestige', 'CrowdPleaser', 'Spectacle', 'OriginalVision', 'GenreFormula'];

export const SCRIPT_ARCHETYPE_PROFILES: Record<ScriptArchetype, ScriptArchetypeProfile> = {
  Prestige: {
    description: 'A character- and dialogue-driven piece built for critical acclaim over broad reach.',
    qualityRange: { originality: [55, 90], structure: [50, 85], characters: [65, 100], dialogue: [65, 100], complexity: [10, 50] },
    scaleWeights: { Intimate: 3, Medium: 2, Epic: 0.3 },
    storyTypeAffinity: { Biography: 2.5, Documentary: 2, Mystery: 1.5, ComingOfAge: 1.8, Crime: 1.3, War: 1.3, Sports: 0.8, Musical: 0.5, Heist: 0.6, Superhero: 0.1 },
    genreAffinity: { Drama: 2, Romance: 1.3, Thriller: 1, Comedy: 0.8, Horror: 0.5, 'Sci-Fi': 0.6, Fantasy: 0.5, Action: 0.4 },
    targetAudienceWeights: { Critics: 3, Adults: 2, Niche: 2, 'Mass Market': 0.5, Teens: 0.5, Families: 0.4 },
    commercial: { accessibility: -15, hookiness: -10, crossover: 5 },
  },
  CrowdPleaser: {
    description: 'Structurally dependable and built for broad mainstream appeal.',
    qualityRange: { originality: [25, 60], structure: [65, 95], characters: [55, 85], dialogue: [55, 85], complexity: [20, 55] },
    scaleWeights: { Intimate: 0.7, Medium: 3, Epic: 1 },
    storyTypeAffinity: { Sports: 1.8, Musical: 1.5, Heist: 1.5, Crime: 1.2, ComingOfAge: 1.3, Mystery: 1, Superhero: 1, Biography: 0.8, War: 0.6, Documentary: 0.2 },
    genreAffinity: { Comedy: 1.5, Romance: 1.4, Action: 1.2, Fantasy: 1, Thriller: 1.1, 'Sci-Fi': 0.9, Drama: 0.8, Horror: 0.7 },
    targetAudienceWeights: { 'Mass Market': 3, Families: 1.5, Teens: 1.5, Adults: 1.2, Critics: 0.5, Niche: 0.3 },
    commercial: { accessibility: 15, hookiness: 15, crossover: 0 },
  },
  Spectacle: {
    description: 'Event-scale filmmaking, built to be seen big - effects and stunts carry as much weight as story.',
    qualityRange: { originality: [20, 55], structure: [45, 80], characters: [35, 70], dialogue: [30, 65], complexity: [65, 100] },
    scaleWeights: { Intimate: 0.1, Medium: 1, Epic: 3.5 },
    storyTypeAffinity: { Superhero: 3, War: 2, Heist: 1.5, Sports: 1, Mystery: 0.6, Crime: 0.8, Musical: 0.5, ComingOfAge: 0.4, Biography: 0.4, Documentary: 0.05 },
    genreAffinity: { Action: 2, 'Sci-Fi': 1.8, Fantasy: 1.8, Thriller: 1, Horror: 0.6, Comedy: 0.5, Drama: 0.3, Romance: 0.3 },
    targetAudienceWeights: { 'Mass Market': 3, Teens: 2, Families: 1.2, Adults: 1, Critics: 0.3, Niche: 0.2 },
    commercial: { accessibility: 20, hookiness: 10, crossover: 10 },
  },
  OriginalVision: {
    description: 'A genuinely novel premise - the biggest creative swing, and the least predictable outcome.',
    qualityRange: { originality: [70, 100], structure: [15, 90], characters: [40, 90], dialogue: [40, 90], complexity: [15, 70] },
    scaleWeights: { Intimate: 2, Medium: 1.5, Epic: 0.5 },
    storyTypeAffinity: { Mystery: 1.3, Documentary: 1.2, ComingOfAge: 1.2, Crime: 1, Sports: 0.8, Musical: 1, Superhero: 0.5, War: 0.8, Biography: 1, Heist: 1 },
    genreAffinity: { 'Sci-Fi': 1.3, Horror: 1.2, Drama: 1.1, Comedy: 1, Thriller: 1, Fantasy: 1, Action: 0.8, Romance: 0.8 },
    targetAudienceWeights: { Niche: 2, Adults: 1.8, Critics: 1.5, 'Mass Market': 1, Teens: 0.8, Families: 0.5 },
    commercial: { accessibility: -10, hookiness: -5, crossover: 20 },
  },
  GenreFormula: {
    description: 'Safe, familiar and dependable - cheap to make, reliable to sell.',
    qualityRange: { originality: [10, 40], structure: [45, 75], characters: [35, 65], dialogue: [35, 65], complexity: [15, 50] },
    scaleWeights: { Intimate: 1.5, Medium: 2.5, Epic: 0.5 },
    storyTypeAffinity: { Crime: 1.3, Mystery: 1.2, Sports: 1, ComingOfAge: 1, Heist: 1, Musical: 0.8, Biography: 0.6, War: 0.6, Superhero: 0.7, Documentary: 0.1 },
    genreAffinity: { Horror: 1.3, Romance: 1.2, Comedy: 1, Action: 1, Thriller: 1, Drama: 1, Fantasy: 0.9, 'Sci-Fi': 0.9 },
    targetAudienceWeights: { 'Mass Market': 2, Adults: 1.3, Teens: 1.3, Families: 1, Niche: 0.6, Critics: 0.6 },
    commercial: { accessibility: 5, hookiness: 5, crossover: -10 },
  },
};
