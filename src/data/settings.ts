import type { NormalizedScalar, SettingArchetype } from '../types';

/**
 * Production-pressure profile for a Setting Archetype - what kind of place
 * the story mostly happens in, read by engine/scriptGenerator.ts to bias
 * ProductionRequirements/Environment Strategy/Effects Strategy, and by
 * engine/production.ts/recommendation.ts to influence recommended shoot
 * days, cost estimates, and risk once a specific script is in production
 * (see docs/CHARACTER_AND_SETTING_FOUNDATIONS.md section 8). Every numeric
 * field is a 0-1 *pressure* reading, not a direct cost - a demanding setting
 * creates more to manage, it doesn't automatically spend money on the
 * player's behalf.
 */
export interface SettingProfile {
  description: string;
  /** How large/expansive the implied world is - a single room vs. a whole built-out city or planet. */
  environmentScale: NormalizedScalar;
  /** How many distinct locations, and how hard they are to shoot - independent of scale (a single alien planet can still be one contained location). */
  locationComplexity: NormalizedScalar;
  /** Physical build/production-design pressure - sets, props, dressing. */
  setConstructionDemand: NormalizedScalar;
  /** Real-world permits/travel/crew logistics pressure - getting people and equipment to and around the setting. */
  practicalLogisticsDemand: NormalizedScalar;
  /** How much of the world has to be built or extended digitally. */
  vfxEnvironmentDemand: NormalizedScalar;
  /** Background/crowd cast pressure this setting naturally implies. */
  extrasDemand: NormalizedScalar;
  /** How location/travel-heavy the shoot itself is, distinct from locationComplexity (a Global Multi-Location shoot travels constantly even if each individual location is simple). */
  travelDemand: NormalizedScalar;
  /** How naturally this setting supports a contained, mostly-studio-based shoot - the inverse pole of environmentScale/travelDemand, not simply 1 minus them (a Spacecraft is small in scale but still needs a substantial built set). */
  containedProductionAffinity: NormalizedScalar;
  /** Costume/production design has to recreate a real historical era. */
  periodSetting: boolean;
  /** Probability the setting alone pushes the production toward needing vehicles. */
  vehiclesLikely: NormalizedScalar;
}

export const SETTING_ARCHETYPES: SettingArchetype[] = [
  'ContemporaryCity',
  'SmallTown',
  'SuburbanCommunity',
  'RuralWilderness',
  'SingleInteriorLocation',
  'HauntedLocation',
  'SchoolOrUniversity',
  'Workplace',
  'HistoricalCity',
  'HistoricalBattlefield',
  'MedievalKingdom',
  'FantasyRealm',
  'ModernWarzone',
  'FuturisticCity',
  'SpacecraftOrStation',
  'AlienWorld',
  'PostApocalypticWasteland',
  'UnderwaterEnvironment',
  'GlobalMultiLocation',
  'Other',
];

export const SETTING_ARCHETYPE_PROFILES: Record<SettingArchetype, SettingProfile> = {
  ContemporaryCity: {
    description: 'A real present-day city - streets, traffic, skylines, everyday urban life.',
    environmentScale: 0.5, locationComplexity: 0.55, setConstructionDemand: 0.25, practicalLogisticsDemand: 0.45,
    vfxEnvironmentDemand: 0.2, extrasDemand: 0.5, travelDemand: 0.3, containedProductionAffinity: 0.25,
    periodSetting: false, vehiclesLikely: 0.3,
  },
  SmallTown: {
    description: 'A close-knit small town - modest in scale, easy to shoot around.',
    environmentScale: 0.3, locationComplexity: 0.35, setConstructionDemand: 0.15, practicalLogisticsDemand: 0.3,
    vfxEnvironmentDemand: 0.05, extrasDemand: 0.3, travelDemand: 0.25, containedProductionAffinity: 0.4,
    periodSetting: false, vehiclesLikely: 0.25,
  },
  SuburbanCommunity: {
    description: 'Ordinary suburban homes and streets - low-key, contained, familiar.',
    environmentScale: 0.25, locationComplexity: 0.3, setConstructionDemand: 0.15, practicalLogisticsDemand: 0.2,
    vfxEnvironmentDemand: 0.05, extrasDemand: 0.2, travelDemand: 0.15, containedProductionAffinity: 0.55,
    periodSetting: false, vehiclesLikely: 0.2,
  },
  RuralWilderness: {
    description: 'Remote countryside or untamed nature - light on built sets, heavy on getting a crew there at all.',
    environmentScale: 0.4, locationComplexity: 0.45, setConstructionDemand: 0.1, practicalLogisticsDemand: 0.55,
    vfxEnvironmentDemand: 0.1, extrasDemand: 0.1, travelDemand: 0.6, containedProductionAffinity: 0.15,
    periodSetting: false, vehiclesLikely: 0.3,
  },
  SingleInteriorLocation: {
    description: 'The whole story plays out in one contained space - the cheapest, most controllable setting there is.',
    environmentScale: 0.05, locationComplexity: 0.05, setConstructionDemand: 0.15, practicalLogisticsDemand: 0.05,
    vfxEnvironmentDemand: 0.02, extrasDemand: 0.05, travelDemand: 0.02, containedProductionAffinity: 0.95,
    periodSetting: false, vehiclesLikely: 0.02,
  },
  HauntedLocation: {
    description: 'One atmospheric, unsettling location - contained, but with real production-design pressure to make it feel wrong.',
    environmentScale: 0.2, locationComplexity: 0.2, setConstructionDemand: 0.3, practicalLogisticsDemand: 0.15,
    vfxEnvironmentDemand: 0.15, extrasDemand: 0.05, travelDemand: 0.1, containedProductionAffinity: 0.75,
    periodSetting: false, vehiclesLikely: 0.02,
  },
  SchoolOrUniversity: {
    description: 'Classrooms, halls and campus grounds - contained, with a naturally large young ensemble around the edges.',
    environmentScale: 0.25, locationComplexity: 0.25, setConstructionDemand: 0.15, practicalLogisticsDemand: 0.15,
    vfxEnvironmentDemand: 0.02, extrasDemand: 0.35, travelDemand: 0.1, containedProductionAffinity: 0.6,
    periodSetting: false, vehiclesLikely: 0.05,
  },
  Workplace: {
    description: 'Offices, precincts, hospitals, kitchens - contained, procedural, everyday.',
    environmentScale: 0.2, locationComplexity: 0.2, setConstructionDemand: 0.15, practicalLogisticsDemand: 0.15,
    vfxEnvironmentDemand: 0.02, extrasDemand: 0.25, travelDemand: 0.1, containedProductionAffinity: 0.65,
    periodSetting: false, vehiclesLikely: 0.05,
  },
  HistoricalCity: {
    description: 'A real past era\'s city, recreated - production design and costuming stand in for VFX.',
    environmentScale: 0.55, locationComplexity: 0.5, setConstructionDemand: 0.6, practicalLogisticsDemand: 0.5,
    vfxEnvironmentDemand: 0.35, extrasDemand: 0.5, travelDemand: 0.3, containedProductionAffinity: 0.2,
    periodSetting: true, vehiclesLikely: 0.15,
  },
  HistoricalBattlefield: {
    description: 'A recreated historical conflict - heavy on coordinated crowd and logistics work.',
    environmentScale: 0.5, locationComplexity: 0.4, setConstructionDemand: 0.45, practicalLogisticsDemand: 0.6,
    vfxEnvironmentDemand: 0.3, extrasDemand: 0.7, travelDemand: 0.45, containedProductionAffinity: 0.1,
    periodSetting: true, vehiclesLikely: 0.25,
  },
  MedievalKingdom: {
    description: 'Castles, courts and villages of an invented or recreated medieval world - major set and costume work.',
    environmentScale: 0.65, locationComplexity: 0.55, setConstructionDemand: 0.75, practicalLogisticsDemand: 0.6,
    vfxEnvironmentDemand: 0.45, extrasDemand: 0.6, travelDemand: 0.35, containedProductionAffinity: 0.15,
    periodSetting: true, vehiclesLikely: 0.05,
  },
  FantasyRealm: {
    description: 'An entirely invented, magical world - built largely through visual effects and world-building.',
    environmentScale: 0.75, locationComplexity: 0.55, setConstructionDemand: 0.5, practicalLogisticsDemand: 0.35,
    vfxEnvironmentDemand: 0.7, extrasDemand: 0.35, travelDemand: 0.25, containedProductionAffinity: 0.2,
    periodSetting: false, vehiclesLikely: 0.02,
  },
  ModernWarzone: {
    description: 'A present-day conflict zone - heavy crowd and logistics pressure, moderate effects work.',
    environmentScale: 0.5, locationComplexity: 0.45, setConstructionDemand: 0.4, practicalLogisticsDemand: 0.6,
    vfxEnvironmentDemand: 0.3, extrasDemand: 0.55, travelDemand: 0.5, containedProductionAffinity: 0.1,
    periodSetting: false, vehiclesLikely: 0.5,
  },
  FuturisticCity: {
    description: 'A speculative future skyline - the most set-and-VFX-hungry contemporary-adjacent setting there is.',
    environmentScale: 0.85, locationComplexity: 0.55, setConstructionDemand: 0.65, practicalLogisticsDemand: 0.3,
    vfxEnvironmentDemand: 0.85, extrasDemand: 0.45, travelDemand: 0.2, containedProductionAffinity: 0.2,
    periodSetting: false, vehiclesLikely: 0.2,
  },
  SpacecraftOrStation: {
    description: 'Confined to a ship or station - small in footprint, but the whole set has to be built from nothing.',
    environmentScale: 0.4, locationComplexity: 0.2, setConstructionDemand: 0.6, practicalLogisticsDemand: 0.1,
    vfxEnvironmentDemand: 0.85, extrasDemand: 0.1, travelDemand: 0.02, containedProductionAffinity: 0.7,
    periodSetting: false, vehiclesLikely: 0.05,
  },
  AlienWorld: {
    description: 'Set beyond Earth entirely, on an invented world - the most visual-effects-dependent setting there is.',
    environmentScale: 0.9, locationComplexity: 0.5, setConstructionDemand: 0.5, practicalLogisticsDemand: 0.2,
    vfxEnvironmentDemand: 0.9, extrasDemand: 0.2, travelDemand: 0.15, containedProductionAffinity: 0.25,
    periodSetting: false, vehiclesLikely: 0.05,
  },
  PostApocalypticWasteland: {
    description: 'A ruined, abandoned world - heavy set-dressing and location-logistics pressure.',
    environmentScale: 0.55, locationComplexity: 0.5, setConstructionDemand: 0.55, practicalLogisticsDemand: 0.5,
    vfxEnvironmentDemand: 0.4, extrasDemand: 0.2, travelDemand: 0.35, containedProductionAffinity: 0.2,
    periodSetting: false, vehiclesLikely: 0.3,
  },
  UnderwaterEnvironment: {
    description: 'Set at or below the waterline - among the most logistically demanding settings to actually shoot.',
    environmentScale: 0.45, locationComplexity: 0.4, setConstructionDemand: 0.4, practicalLogisticsDemand: 0.7,
    vfxEnvironmentDemand: 0.6, extrasDemand: 0.05, travelDemand: 0.3, containedProductionAffinity: 0.3,
    periodSetting: false, vehiclesLikely: 0.05,
  },
  GlobalMultiLocation: {
    description: 'The story hops between several real-world locations - a travel- and logistics-heavy shoot rather than a VFX-heavy one.',
    environmentScale: 0.5, locationComplexity: 0.8, setConstructionDemand: 0.25, practicalLogisticsDemand: 0.75,
    vfxEnvironmentDemand: 0.25, extrasDemand: 0.4, travelDemand: 0.85, containedProductionAffinity: 0.05,
    periodSetting: false, vehiclesLikely: 0.35,
  },
  Other: {
    description: 'A setting that doesn\'t fit a more specific archetype - treated as a moderate, unremarkable production.',
    environmentScale: 0.35, locationComplexity: 0.35, setConstructionDemand: 0.25, practicalLogisticsDemand: 0.3,
    vfxEnvironmentDemand: 0.15, extrasDemand: 0.25, travelDemand: 0.25, containedProductionAffinity: 0.35,
    periodSetting: false, vehiclesLikely: 0.15,
  },
};
