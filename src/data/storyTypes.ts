import type { NormalizedScalar, SettingArchetype, StoryType, TargetAudience } from '../types';

// What a story hook implies about a production, independent of genre - a
// Sports Drama and a Crime Drama are both Drama, but call for very
// different casts, locations and commercial pitches. Read by
// engine/scriptGenerator.ts to derive ProductionRequirements and by
// engine/commercialProfile.ts to derive accessibility/hookiness, the same
// "one data table, several consumers" pattern data/genres.ts:GENRE_PROFILES
// already uses.
export interface StoryTypeProfile {
  description: string;
  // Baseline production-requirement intensities (0-1) this story type pulls
  // toward - blended with ScriptScale's own floors and Setting's biases
  // during generation, never used alone.
  extras: NormalizedScalar;
  locations: NormalizedScalar;
  practicalEffects: NormalizedScalar;
  vfx: NormalizedScalar;
  stunts: NormalizedScalar;
  choreography: NormalizedScalar;
  crowdWork: NormalizedScalar;
  vehiclesLikely: number; // 0-1 probability the production requires vehicles
  animalsLikely: number; // 0-1 probability the production requires animals
  // Multiplies the base Lead/Supporting weighted-pick result - a
  // documentary rarely calls for a conventional dramatic cast at all, a
  // heist calls for a bigger ensemble than the genre default.
  castSizeMultiplier: number;
  // Commercial-appeal biases (0-100), blended in engine/commercialProfile.ts.
  accessibility: number;
  hookiness: number;
  // Nudges which ScriptScale/Setting/TargetAudience this story type
  // tends toward - default weight is 1 for any key left unlisted.
  scaleAffinity?: Partial<Record<'Intimate' | 'Medium' | 'Epic', number>>;
  settingAffinity?: Partial<Record<SettingArchetype, number>>;
  targetAudienceWeights: Partial<Record<TargetAudience, number>>;
}

export const STORY_TYPES: StoryType[] = [
  'Original', 'Sports', 'Musical', 'Biography', 'Documentary', 'Crime', 'Mystery', 'Superhero', 'War', 'ComingOfAge', 'Heist',
];

export const STORY_TYPE_PROFILES: Record<StoryType, StoryTypeProfile> = {
  Original: {
    description: 'No particular subgenre hook - a straight, unhyphenated take on its genre.',
    extras: 0.35, locations: 0.4, practicalEffects: 0.3, vfx: 0.3, stunts: 0.25, choreography: 0.05, crowdWork: 0.15,
    vehiclesLikely: 0.15, animalsLikely: 0.1, castSizeMultiplier: 1,
    accessibility: 55, hookiness: 50,
    targetAudienceWeights: { 'Mass Market': 3, Adults: 2, Teens: 2, Families: 1, Niche: 1, Critics: 1 },
  },
  Sports: {
    description: 'Built around competition and a team or athlete\'s arc - crowds, stadiums, physical training.',
    extras: 0.5, locations: 0.45, practicalEffects: 0.35, vfx: 0.15, stunts: 0.5, choreography: 0.1, crowdWork: 0.55,
    vehiclesLikely: 0.1, animalsLikely: 0.05, castSizeMultiplier: 1.1,
    accessibility: 65, hookiness: 60,
    targetAudienceWeights: { 'Mass Market': 3, Teens: 2, Families: 2, Adults: 1 },
  },
  Musical: {
    description: 'Staged musical numbers carry the story - choreography and composition matter more than almost anywhere else.',
    extras: 0.45, locations: 0.35, practicalEffects: 0.2, vfx: 0.2, stunts: 0.1, choreography: 0.9, crowdWork: 0.35,
    vehiclesLikely: 0.05, animalsLikely: 0.05, castSizeMultiplier: 1.1,
    accessibility: 55, hookiness: 55,
    targetAudienceWeights: { Families: 3, 'Mass Market': 2, Adults: 1 },
  },
  Biography: {
    description: 'A real life, dramatized - character and period authenticity matter more than spectacle.',
    extras: 0.3, locations: 0.4, practicalEffects: 0.25, vfx: 0.1, stunts: 0.1, choreography: 0.05, crowdWork: 0.2,
    vehiclesLikely: 0.15, animalsLikely: 0.05, castSizeMultiplier: 0.9,
    accessibility: 50, hookiness: 45,
    settingAffinity: {
      HistoricalCity: 2, HistoricalBattlefield: 1.3, ContemporaryCity: 1.5, SmallTown: 1.2, Workplace: 1.2,
      FantasyRealm: 0.1, AlienWorld: 0.05, SpacecraftOrStation: 0.05, FuturisticCity: 0.1,
    },
    targetAudienceWeights: { Adults: 3, Critics: 2, 'Mass Market': 1 },
  },
  Documentary: {
    description: 'Presented as nonfiction - little to no conventional dramatic cast, almost entirely location-driven.',
    extras: 0.15, locations: 0.5, practicalEffects: 0.05, vfx: 0.05, stunts: 0.02, choreography: 0.02, crowdWork: 0.1,
    vehiclesLikely: 0.1, animalsLikely: 0.15, castSizeMultiplier: 0.15,
    accessibility: 25, hookiness: 20,
    scaleAffinity: { Intimate: 2.5, Medium: 1, Epic: 0.1 },
    settingAffinity: {
      ContemporaryCity: 1.8, SmallTown: 1.5, Workplace: 1.5, RuralWilderness: 1.3, HistoricalCity: 1,
      FantasyRealm: 0.02, AlienWorld: 0.02, SpacecraftOrStation: 0.02, FuturisticCity: 0.05,
    },
    targetAudienceWeights: { Critics: 3, Niche: 3, Adults: 2 },
  },
  Crime: {
    description: 'Built around a crime, its planning, or its investigation - streetwise, morally shaded.',
    extras: 0.35, locations: 0.45, practicalEffects: 0.3, vfx: 0.15, stunts: 0.4, choreography: 0.05, crowdWork: 0.2,
    vehiclesLikely: 0.35, animalsLikely: 0.05, castSizeMultiplier: 1,
    accessibility: 55, hookiness: 55,
    targetAudienceWeights: { Adults: 3, 'Mass Market': 2, Teens: 1 },
  },
  Mystery: {
    description: 'A puzzle the audience solves alongside the characters - dialogue and structure carry it more than spectacle.',
    extras: 0.25, locations: 0.35, practicalEffects: 0.2, vfx: 0.1, stunts: 0.15, choreography: 0.02, crowdWork: 0.1,
    vehiclesLikely: 0.15, animalsLikely: 0.05, castSizeMultiplier: 1,
    accessibility: 50, hookiness: 50,
    targetAudienceWeights: { Adults: 3, 'Mass Market': 2, Critics: 1 },
  },
  Superhero: {
    description: 'Larger-than-life, powers-driven spectacle - the most VFX/stunt-dependent story type there is.',
    extras: 0.5, locations: 0.4, practicalEffects: 0.4, vfx: 0.85, stunts: 0.75, choreography: 0.15, crowdWork: 0.6,
    vehiclesLikely: 0.3, animalsLikely: 0.02, castSizeMultiplier: 1,
    accessibility: 80, hookiness: 75,
    settingAffinity: {
      ContemporaryCity: 2, FuturisticCity: 1.5, FantasyRealm: 1, HistoricalCity: 0.1, AlienWorld: 0.4,
      SpacecraftOrStation: 0.4, ModernWarzone: 0.8,
    },
    targetAudienceWeights: { 'Mass Market': 3, Teens: 3, Families: 1 },
  },
  War: {
    description: 'A conflict and the people inside it - heavy on crowd/battle coordination and practical craft.',
    extras: 0.6, locations: 0.55, practicalEffects: 0.55, vfx: 0.35, stunts: 0.55, choreography: 0.05, crowdWork: 0.75,
    vehiclesLikely: 0.5, animalsLikely: 0.1, castSizeMultiplier: 1.1,
    accessibility: 45, hookiness: 45,
    settingAffinity: {
      HistoricalBattlefield: 2.5, HistoricalCity: 1, ModernWarzone: 2, FuturisticCity: 0.4, AlienWorld: 0.2,
      MedievalKingdom: 0.5, FantasyRealm: 0.3,
    },
    targetAudienceWeights: { Adults: 3, 'Mass Market': 2, Critics: 1 },
  },
  ComingOfAge: {
    description: 'A young protagonist finding themselves - intimate, character-first, rarely spectacle-driven.',
    extras: 0.25, locations: 0.3, practicalEffects: 0.15, vfx: 0.05, stunts: 0.05, choreography: 0.1, crowdWork: 0.1,
    vehiclesLikely: 0.1, animalsLikely: 0.05, castSizeMultiplier: 0.9,
    accessibility: 50, hookiness: 45,
    scaleAffinity: { Intimate: 2, Medium: 1.2, Epic: 0.2 },
    targetAudienceWeights: { Teens: 3, Adults: 2, Families: 1 },
  },
  Heist: {
    description: 'A crew planning and pulling off an elaborate score - ensemble-cast, plan-and-execute structure.',
    extras: 0.35, locations: 0.4, practicalEffects: 0.3, vfx: 0.2, stunts: 0.5, choreography: 0.05, crowdWork: 0.15,
    vehiclesLikely: 0.4, animalsLikely: 0.02, castSizeMultiplier: 1.3,
    accessibility: 60, hookiness: 65,
    targetAudienceWeights: { 'Mass Market': 3, Adults: 2, Teens: 1 },
  },
};
