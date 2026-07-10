import type { TalentRole } from '../types';

// Every role is still hired through the same underlying mechanism (a price
// slider + a candidate grid, see components/wizard/RoleHiringDrawer.tsx),
// but shouldn't *read* the same - a producer thinks about a director
// differently than a composer. `category` picks which of three headline-stat
// templates a candidate card uses (see RoleHiringDrawer.tsx:roleCategoryOf);
// `blurb`/`hook` are copy, no behavior. Kept as data rather than duplicated
// per-component JSX so adding an eighth role later is a config entry, not a
// new render branch.

export type RoleCategory = 'director' | 'actor' | 'crew';

export interface TalentPresentationProfile {
  category: RoleCategory;
  /** Full framing text shown at the top of the hiring drawer. */
  blurb: string;
  /** Short version for the hub's role tile, before a hire is made. */
  hook: string;
}

export const TALENT_PRESENTATION: Record<TalentRole, TalentPresentationProfile> = {
  Director: {
    category: 'director',
    blurb:
      "The director shapes this production's whole creative approach - how it's shot, how effects get handled, and how well their instincts actually match what the screenplay calls for. Their production philosophy carries forward into Plan Production's recommendations later.",
    hook: 'Sets the whole creative direction.',
  },
  'Lead Actor': {
    category: 'actor',
    blurb:
      "Your lead carries the film's box office pull and its emotional center. Fame draws an audience in; compatibility is what makes the performance actually land.",
    hook: 'Carries box office pull and the emotional core.',
  },
  'Supporting Actor': {
    category: 'actor',
    blurb:
      'An ensemble role - hiring more than one averages their fit and fame together rather than stacking. Fit and reliability matter as much as star power here.',
    hook: 'An ensemble - fit matters as much as star power.',
  },
  Writer: {
    category: 'crew',
    blurb: "The writing craft behind the finished script - skill here feeds directly into how the film reads on screen.",
    hook: 'The craft behind the finished script.',
  },
  Composer: {
    category: 'crew',
    blurb: "Sets the film's musical identity.",
    hook: "Sets the film's musical identity.",
  },
  Editor: {
    category: 'crew',
    blurb: 'Shapes pacing and structure in the cutting room - the difference between a scene that lands and one that drags.',
    hook: 'Shapes pacing in the cutting room.',
  },
  'VFX Supervisor': {
    category: 'crew',
    blurb: 'Oversees the digital effects work, if this production leans on any. Optional - skip it for effects-light films.',
    hook: 'Optional - only matters for effects-heavy films.',
  },
};
