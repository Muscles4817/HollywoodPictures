import type { CharacterArchetype, CharacterProminence, CharacterTraitProfile, Genre, StoryType } from '../types';

/**
 * A Character Archetype's baseline trait demands, plus how likely it is to
 * appear at all - genre/story-type/prominence-weighted, the same
 * `weightedPick`/`combineWeights` pattern data/scriptArchetypes.ts and
 * data/storyTypes.ts already use for the rest of generation (see
 * engine/scriptGenerator.ts:generateCast). `baseTraits` is a starting point,
 * not a fixed value - generation jitters around it (bounded, per-axis) so
 * two characters sharing an archetype don't read identically.
 */
export interface CharacterArchetypeProfile {
  description: string;
  baseTraits: CharacterTraitProfile;
  /** Multiplies each genre's base likelihood of this archetype appearing - default 1 if unlisted. */
  genreAffinity: Partial<Record<Genre, number>>;
  /** Multiplies each story type's base likelihood - default 1 if unlisted. */
  storyTypeAffinity: Partial<Record<StoryType, number>>;
  /** Which prominence tiers this archetype naturally fits, and how strongly - default 1 if unlisted. */
  prominenceAffinity: Partial<Record<CharacterProminence, number>>;
}

export const CHARACTER_ARCHETYPES: CharacterArchetype[] = [
  'ReluctantHero',
  'IdealisticHero',
  'Antihero',
  'ChosenOne',
  'Outsider',
  'Detective',
  'Survivor',
  'Mentor',
  'Rival',
  'Villain',
  'TragicVillain',
  'AuthorityFigure',
  'LoveInterest',
  'ComicRelief',
  'BestFriend',
  'FamilyMember',
  'EnsembleMember',
  'MonsterOrCreature',
  'Other',
];

export const CHARACTER_ARCHETYPE_PROFILES: Record<CharacterArchetype, CharacterArchetypeProfile> = {
  ReluctantHero: {
    description: 'Pulled into the story rather than seeking it out - the everyday person forced to rise to the occasion.',
    baseTraits: {
      dramaticDepth: 65, charismaDemand: 55, comedyDemand: 25, emotionalDemand: 70, physicalDemand: 50,
      transformationDemand: 60, audienceAccessibility: 75, distinctiveness: 40, merchandisePotential: 35,
    },
    genreAffinity: { Action: 1.3, Fantasy: 1.3, 'Sci-Fi': 1.2, Drama: 1, Thriller: 1.1 },
    storyTypeAffinity: { Superhero: 1.3, Heist: 1.1 },
    prominenceAffinity: { Lead: 3, Supporting: 0.3, Minor: 0.05 },
  },
  IdealisticHero: {
    description: 'Drives the story through genuine conviction rather than reluctance - the classic straightforward protagonist.',
    baseTraits: {
      dramaticDepth: 50, charismaDemand: 70, comedyDemand: 30, emotionalDemand: 55, physicalDemand: 45,
      transformationDemand: 35, audienceAccessibility: 85, distinctiveness: 35, merchandisePotential: 45,
    },
    genreAffinity: { Fantasy: 1.4, Action: 1.2, 'Sci-Fi': 1.1, Comedy: 0.9 },
    storyTypeAffinity: { Superhero: 1.4, Sports: 1.2 },
    prominenceAffinity: { Lead: 3, Supporting: 0.4, Minor: 0.05 },
  },
  Antihero: {
    description: 'Morally shaded, self-interested, or outright unlikeable at times - carried by pure charisma rather than likeability.',
    baseTraits: {
      dramaticDepth: 70, charismaDemand: 80, comedyDemand: 20, emotionalDemand: 55, physicalDemand: 50,
      transformationDemand: 50, audienceAccessibility: 55, distinctiveness: 60, merchandisePotential: 50,
    },
    genreAffinity: { Thriller: 1.4, Drama: 1.2, Action: 1.2, Horror: 0.9 },
    storyTypeAffinity: { Crime: 1.4, Heist: 1.3 },
    prominenceAffinity: { Lead: 3, Supporting: 0.6, Minor: 0.05 },
  },
  ChosenOne: {
    description: 'Marked out by fate or prophecy as the one who has to see this through.',
    baseTraits: {
      dramaticDepth: 55, charismaDemand: 60, comedyDemand: 20, emotionalDemand: 55, physicalDemand: 55,
      transformationDemand: 65, audienceAccessibility: 75, distinctiveness: 45, merchandisePotential: 55,
    },
    genreAffinity: { Fantasy: 1.6, 'Sci-Fi': 1.3, Action: 1 },
    storyTypeAffinity: { Superhero: 1.3 },
    prominenceAffinity: { Lead: 3, Supporting: 0.1, Minor: 0.02 },
  },
  Outsider: {
    description: 'Doesn\'t belong to the world they\'re thrown into - watches it, and is watched by it, from the edges.',
    baseTraits: {
      dramaticDepth: 60, charismaDemand: 40, comedyDemand: 25, emotionalDemand: 65, physicalDemand: 35,
      transformationDemand: 50, audienceAccessibility: 50, distinctiveness: 55, merchandisePotential: 25,
    },
    genreAffinity: { Drama: 1.3, Horror: 1.2, 'Sci-Fi': 1.1, Thriller: 1 },
    storyTypeAffinity: { ComingOfAge: 1.4, Mystery: 1.1 },
    prominenceAffinity: { Lead: 2, Supporting: 1.5, Minor: 0.3 },
  },
  Detective: {
    description: 'Pieces the truth together, one clue at a time - the audience\'s own investigative stand-in.',
    baseTraits: {
      dramaticDepth: 65, charismaDemand: 55, comedyDemand: 20, emotionalDemand: 45, physicalDemand: 30,
      transformationDemand: 25, audienceAccessibility: 65, distinctiveness: 45, merchandisePotential: 25,
    },
    genreAffinity: { Thriller: 1.4, Drama: 1.1, Comedy: 0.6 },
    storyTypeAffinity: { Mystery: 2, Crime: 1.6 },
    prominenceAffinity: { Lead: 3, Supporting: 0.5, Minor: 0.05 },
  },
  Survivor: {
    description: 'Defined by what they\'ve endured and what it takes to keep enduring it.',
    baseTraits: {
      dramaticDepth: 55, charismaDemand: 35, comedyDemand: 10, emotionalDemand: 70, physicalDemand: 65,
      transformationDemand: 55, audienceAccessibility: 60, distinctiveness: 40, merchandisePotential: 20,
    },
    genreAffinity: { Horror: 1.5, Thriller: 1.2, 'Sci-Fi': 1.1, Drama: 1 },
    storyTypeAffinity: { War: 1.2 },
    prominenceAffinity: { Lead: 2.5, Supporting: 1, Minor: 0.2 },
  },
  Mentor: {
    description: 'Guides the lead rather than driving the plot themselves - wisdom and presence over physical demand.',
    baseTraits: {
      dramaticDepth: 55, charismaDemand: 65, comedyDemand: 20, emotionalDemand: 65, physicalDemand: 20,
      transformationDemand: 20, audienceAccessibility: 60, distinctiveness: 35, merchandisePotential: 30,
    },
    genreAffinity: { Fantasy: 1.3, Drama: 1.1, Action: 1 },
    storyTypeAffinity: { Superhero: 1.2, ComingOfAge: 1.2 },
    prominenceAffinity: { Supporting: 3, Lead: 0.4, Minor: 0.3 },
  },
  Rival: {
    description: 'Pushes against the lead directly - a competitor or foil, not necessarily an enemy.',
    baseTraits: {
      dramaticDepth: 45, charismaDemand: 55, comedyDemand: 20, emotionalDemand: 40, physicalDemand: 50,
      transformationDemand: 25, audienceAccessibility: 50, distinctiveness: 45, merchandisePotential: 30,
    },
    genreAffinity: { Action: 1.2, Thriller: 1.1, Comedy: 1 },
    storyTypeAffinity: { Sports: 1.5, Heist: 1.1 },
    prominenceAffinity: { Supporting: 2.5, Lead: 0.6, Minor: 0.3 },
  },
  Villain: {
    description: 'The opposition the story is actually about - charisma matters more here than almost any other role.',
    baseTraits: {
      dramaticDepth: 50, charismaDemand: 75, comedyDemand: 15, emotionalDemand: 35, physicalDemand: 40,
      transformationDemand: 30, audienceAccessibility: 45, distinctiveness: 65, merchandisePotential: 55,
    },
    genreAffinity: { Action: 1.3, Fantasy: 1.3, Thriller: 1.2, Horror: 1.1 },
    storyTypeAffinity: { Superhero: 1.4, Crime: 1.1 },
    prominenceAffinity: { Supporting: 2.5, Lead: 1, Minor: 0.3 },
  },
  TragicVillain: {
    description: 'Opposition with real, sympathetic depth behind it - the audience understands them even while opposing them.',
    baseTraits: {
      dramaticDepth: 75, charismaDemand: 60, comedyDemand: 10, emotionalDemand: 60, physicalDemand: 35,
      transformationDemand: 45, audienceAccessibility: 40, distinctiveness: 60, merchandisePotential: 45,
    },
    genreAffinity: { Drama: 1.3, Fantasy: 1.2, Thriller: 1.1 },
    storyTypeAffinity: { Superhero: 1.1, Biography: 1.1 },
    prominenceAffinity: { Supporting: 2, Lead: 1, Minor: 0.2 },
  },
  AuthorityFigure: {
    description: 'A boss, official, or institution the story has to work around or answer to.',
    baseTraits: {
      dramaticDepth: 40, charismaDemand: 50, comedyDemand: 15, emotionalDemand: 30, physicalDemand: 15,
      transformationDemand: 10, audienceAccessibility: 55, distinctiveness: 20, merchandisePotential: 10,
    },
    genreAffinity: { Thriller: 1.2, Drama: 1.1, Horror: 1 },
    storyTypeAffinity: { Crime: 1.3, War: 1.2, Mystery: 1.1 },
    prominenceAffinity: { Supporting: 3, Minor: 1, Lead: 0.3 },
  },
  LoveInterest: {
    description: 'The story\'s central relationship, or half of it - charisma and chemistry over raw dramatic weight.',
    baseTraits: {
      dramaticDepth: 45, charismaDemand: 65, comedyDemand: 25, emotionalDemand: 65, physicalDemand: 25,
      transformationDemand: 25, audienceAccessibility: 75, distinctiveness: 30, merchandisePotential: 30,
    },
    genreAffinity: { Romance: 2, Comedy: 1.2, Drama: 1 },
    storyTypeAffinity: {},
    prominenceAffinity: { Lead: 2, Supporting: 2, Minor: 0.2 },
  },
  ComicRelief: {
    description: 'Exists to lighten the tone - comedy demand dominates over everything else.',
    baseTraits: {
      dramaticDepth: 20, charismaDemand: 50, comedyDemand: 85, emotionalDemand: 25, physicalDemand: 30,
      transformationDemand: 15, audienceAccessibility: 80, distinctiveness: 40, merchandisePotential: 35,
    },
    genreAffinity: { Comedy: 1.8, Fantasy: 1, Action: 1 },
    storyTypeAffinity: {},
    prominenceAffinity: { Supporting: 3, Minor: 1, Lead: 0.3 },
  },
  BestFriend: {
    description: 'The lead\'s own confidant and sounding board - warm, accessible, rarely the story\'s main event.',
    baseTraits: {
      dramaticDepth: 35, charismaDemand: 50, comedyDemand: 45, emotionalDemand: 50, physicalDemand: 25,
      transformationDemand: 15, audienceAccessibility: 75, distinctiveness: 25, merchandisePotential: 20,
    },
    genreAffinity: { Comedy: 1.3, Drama: 1, Romance: 1.1 },
    storyTypeAffinity: { ComingOfAge: 1.3 },
    prominenceAffinity: { Supporting: 3, Lead: 0.3, Minor: 0.5 },
  },
  FamilyMember: {
    description: 'A parent, sibling, or child the story is anchored to emotionally.',
    baseTraits: {
      dramaticDepth: 40, charismaDemand: 35, comedyDemand: 25, emotionalDemand: 60, physicalDemand: 15,
      transformationDemand: 15, audienceAccessibility: 70, distinctiveness: 20, merchandisePotential: 15,
    },
    genreAffinity: { Drama: 1.2, Horror: 1.1, Comedy: 1 },
    storyTypeAffinity: {},
    prominenceAffinity: { Supporting: 3, Minor: 1.2, Lead: 0.4 },
  },
  EnsembleMember: {
    description: 'One voice in a larger group - deliberately unremarkable individually, part of a bigger whole.',
    baseTraits: {
      dramaticDepth: 30, charismaDemand: 35, comedyDemand: 25, emotionalDemand: 30, physicalDemand: 30,
      transformationDemand: 15, audienceAccessibility: 55, distinctiveness: 15, merchandisePotential: 10,
    },
    genreAffinity: { Action: 1.1, Comedy: 1 },
    storyTypeAffinity: { Heist: 1.4, War: 1.2, Sports: 1.1 },
    prominenceAffinity: { Supporting: 2.5, Minor: 2, Lead: 0.1 },
  },
  MonsterOrCreature: {
    description: 'Not human, or not entirely - physicality and transformation carry the role rather than dialogue.',
    baseTraits: {
      dramaticDepth: 25, charismaDemand: 20, comedyDemand: 5, emotionalDemand: 30, physicalDemand: 85,
      transformationDemand: 80, audienceAccessibility: 35, distinctiveness: 80, merchandisePotential: 70,
    },
    genreAffinity: { Horror: 1.8, Fantasy: 1.3, 'Sci-Fi': 1.2 },
    storyTypeAffinity: {},
    prominenceAffinity: { Supporting: 2, Minor: 1, Lead: 0.4 },
  },
  Other: {
    description: 'A role that doesn\'t fit a more specific archetype.',
    baseTraits: {
      dramaticDepth: 40, charismaDemand: 40, comedyDemand: 25, emotionalDemand: 40, physicalDemand: 30,
      transformationDemand: 25, audienceAccessibility: 55, distinctiveness: 25, merchandisePotential: 20,
    },
    genreAffinity: {},
    storyTypeAffinity: {},
    prominenceAffinity: { Supporting: 1, Lead: 1, Minor: 1 },
  },
};
