import type { EditStyle, MusicFocus, TestScreeningResponse, FinalCutFocus } from '../types';

export const EDIT_STYLE_PROFILES: Record<EditStyle, { criticDelta: number; audienceDelta: number; description: string }> = {
  Commercial: {
    criticDelta: -5, audienceDelta: 10,
    description: 'Fast-paced, crowd-pleasing cut. Boosts audience score at the cost of some critical respect.',
  },
  Artistic: {
    criticDelta: 12, audienceDelta: -8,
    description: 'A slower, more deliberate cut aimed at critics. Wins over reviewers, risks losing mainstream audiences.',
  },
  Balanced: {
    criticDelta: 3, audienceDelta: 3,
    description: 'Splits the difference - a modest boost to both critic and audience scores.',
  },
};

export const MUSIC_FOCUS_PROFILES: Record<MusicFocus, { buzzDelta: number; qualityDelta: number; description: string }> = {
  Minimal: { buzzDelta: -5, qualityDelta: 0, description: 'A sparse, understated score. Cheapest option, but generates little buzz.' },
  Standard: { buzzDelta: 0, qualityDelta: 5, description: 'A conventional, well-produced score. Solid quality boost, no particular buzz.' },
  Heavy: { buzzDelta: 8, qualityDelta: 8, description: 'A bold, memorable score built to be talked about. Boosts both quality and buzz.' },
};

export const TEST_SCREENING_PROFILES: Record<
  TestScreeningResponse,
  { cost: number; qualityDelta: number; description: string }
> = {
  Ignore: {
    cost: 0, qualityDelta: -5,
    description: 'Skip the reshoots. Free, but the film ships with whatever problems the test audience flagged.',
  },
  'Minor Changes': {
    cost: 250_000, qualityDelta: 8,
    description: 'A modest reshoot/re-edit pass based on test audience feedback. Worthwhile quality gain for a moderate cost.',
  },
  'Major Changes': {
    cost: 1_000_000, qualityDelta: 15,
    description: 'A substantial rework chasing every note from the test screening. Expensive, but the biggest quality gain available here.',
  },
};

export const FINAL_CUT_FOCUS_PROFILES: Record<
  FinalCutFocus,
  { criticDelta: number; audienceDelta: number; buzzDelta: number; description: string }
> = {
  'Trailer-focused': {
    criticDelta: -3, audienceDelta: 8, buzzDelta: 10,
    description: 'Sell the big moments. Strong audience and buzz boost, a small critical hit.',
  },
  'Critic-focused': {
    criticDelta: 10, audienceDelta: -3, buzzDelta: 2,
    description: 'Lead with prestige and craft. The strongest critic boost here, at some cost to mainstream appeal.',
  },
  'Star-focused': {
    criticDelta: -2, audienceDelta: 6, buzzDelta: 6,
    description: 'Sell the cast. Decent audience and buzz boost, leaning on star power over story.',
  },
  'Mystery-focused': {
    criticDelta: 4, audienceDelta: 2, buzzDelta: 14,
    description: 'Give nothing away. The biggest buzz boost by far, with a small, even bump to both critic and audience scores.',
  },
};
