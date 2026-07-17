import type { CharacterArchetype, ScriptArchetype, ScriptScale, SettingArchetype, StoryType } from '../types';

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

export const SETTING_LABELS: Record<SettingArchetype, string> = {
  ContemporaryCity: 'Contemporary City',
  SmallTown: 'Small Town',
  SuburbanCommunity: 'Suburban Community',
  RuralWilderness: 'Rural Wilderness',
  SingleInteriorLocation: 'Single Interior Location',
  HauntedLocation: 'Haunted Location',
  SchoolOrUniversity: 'School or University',
  Workplace: 'Workplace',
  HistoricalCity: 'Historical City',
  HistoricalBattlefield: 'Historical Battlefield',
  MedievalKingdom: 'Medieval Kingdom',
  FantasyRealm: 'Fantasy Realm',
  ModernWarzone: 'Modern Warzone',
  FuturisticCity: 'Futuristic City',
  SpacecraftOrStation: 'Spacecraft or Space Station',
  AlienWorld: 'Alien World',
  PostApocalypticWasteland: 'Post-Apocalyptic Wasteland',
  UnderwaterEnvironment: 'Underwater Environment',
  GlobalMultiLocation: 'Global Multi-Location',
  Other: 'Other',
};

export const SCALE_LABELS: Record<ScriptScale, string> = {
  Intimate: 'Intimate',
  Medium: 'Medium',
  Epic: 'Epic',
};

export const CHARACTER_ARCHETYPE_LABELS: Record<CharacterArchetype, string> = {
  ReluctantHero: 'Reluctant Hero',
  IdealisticHero: 'Idealistic Hero',
  Antihero: 'Antihero',
  ChosenOne: 'Chosen One',
  Outsider: 'Outsider',
  Detective: 'Detective',
  Survivor: 'Survivor',
  Mentor: 'Mentor',
  Rival: 'Rival',
  Villain: 'Villain',
  TragicVillain: 'Tragic Villain',
  AuthorityFigure: 'Authority Figure',
  LoveInterest: 'Love Interest',
  ComicRelief: 'Comic Relief',
  BestFriend: 'Best Friend',
  FamilyMember: 'Family Member',
  EnsembleMember: 'Ensemble Member',
  MonsterOrCreature: 'Monster or Creature',
  Other: 'Other',
};
