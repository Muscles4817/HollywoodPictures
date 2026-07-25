// Stunt Team roster tuning (docs/DESIGN_REVIEW_production_redesign.md §5.2) — the
// head of the Practical Effects facet. A hireable team/vendor (not a Person)
// chosen per film; its effective skill (base + specialty fit for the genre) is
// the Practical facet's skill axis and swing tilt (engine/stuntTeams.ts).
import type { Genre, StuntSpecialty } from '../types';
import type { Range } from '../engine/interpolate';

export const STUNT_TEAM_POOL_SIZE = 24;

/** Per-film fee spread (log-scaled), mirroring the producer roster shape. */
export const STUNT_TEAM_SALARY_RANGE: Range = { min: 30_000, max: 2_500_000 };

export const STUNT_SPECIALTIES: readonly StuntSpecialty[] = [
  'FightChoreography',
  'Vehicular',
  'Fire',
  'HeightsAndFalls',
  'Creature',
  'Aquatic',
];

export const STUNT_SPECIALTY_LABEL: Record<StuntSpecialty, string> = {
  FightChoreography: 'Fight Choreography',
  Vehicular: 'Vehicular & Chases',
  Fire: 'Fire & Pyrotechnics',
  HeightsAndFalls: 'Heights & High Falls',
  Creature: 'Creature & Suit Work',
  Aquatic: 'Water & Underwater',
};

// Which specialties a genre's practical work leans on. A team with a matching
// specialty gets an effective-skill bump on that film (engine/stuntTeams.ts) —
// the "hire the right team for this kind of film" lever. Genres that barely use
// stunts (Drama, Romance) favour nothing, so any team is equally fine.
export const GENRE_FAVORED_STUNT_SPECIALTIES: Record<Genre, StuntSpecialty[]> = {
  Action: ['FightChoreography', 'Vehicular', 'HeightsAndFalls'],
  'Sci-Fi': ['Vehicular', 'Creature', 'Fire'],
  Fantasy: ['Creature', 'FightChoreography', 'HeightsAndFalls'],
  Horror: ['Creature', 'Fire'],
  Thriller: ['Vehicular', 'FightChoreography'],
  Comedy: ['FightChoreography'],
  Drama: [],
  Romance: [],
};

/** Effective-skill bump when at least one of a team's specialties fits the genre. */
export const STUNT_SPECIALTY_MATCH_BONUS = 12;

// Team name parts — "Apex Stunts", "Ironline Action Unit". Flavour only.
export const STUNT_TEAM_NAME_PREFIXES = [
  'Apex', 'Ironline', 'Redline', 'Vanguard', 'Kinetic', 'Highwire', 'Halcyon', 'Blacksmith',
  'Momentum', 'Riptide', 'Cascade', 'Ronin', 'Bedrock', 'Firebrand', 'Crosscut', 'Overdrive',
];
export const STUNT_TEAM_NAME_SUFFIXES = [
  'Stunts', 'Action Unit', 'Stunt Collective', 'Rigging', 'Action Design', 'Stunt Team', 'Coordination',
];
