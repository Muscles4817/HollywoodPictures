import type { EditStyle, MusicFocus, TestScreeningResponse, FinalCutFocus } from '../types';

export const EDIT_STYLE_PROFILES: Record<EditStyle, { criticDelta: number; audienceDelta: number }> = {
  Commercial: { criticDelta: -5, audienceDelta: 10 },
  Artistic: { criticDelta: 12, audienceDelta: -8 },
  Balanced: { criticDelta: 3, audienceDelta: 3 },
};

export const MUSIC_FOCUS_PROFILES: Record<MusicFocus, { buzzDelta: number; qualityDelta: number }> = {
  Minimal: { buzzDelta: -5, qualityDelta: 0 },
  Standard: { buzzDelta: 0, qualityDelta: 5 },
  Heavy: { buzzDelta: 8, qualityDelta: 8 },
};

export const TEST_SCREENING_PROFILES: Record<
  TestScreeningResponse,
  { cost: number; qualityDelta: number; riskDelta: number }
> = {
  Ignore: { cost: 0, qualityDelta: -5, riskDelta: 10 },
  'Minor Changes': { cost: 250_000, qualityDelta: 8, riskDelta: -5 },
  'Major Changes': { cost: 1_000_000, qualityDelta: 15, riskDelta: -15 },
};

export const FINAL_CUT_FOCUS_PROFILES: Record<
  FinalCutFocus,
  { criticDelta: number; audienceDelta: number; buzzDelta: number }
> = {
  'Trailer-focused': { criticDelta: -3, audienceDelta: 8, buzzDelta: 10 },
  'Critic-focused': { criticDelta: 10, audienceDelta: -3, buzzDelta: 2 },
  'Star-focused': { criticDelta: -2, audienceDelta: 6, buzzDelta: 6 },
  'Mystery-focused': { criticDelta: 4, audienceDelta: 2, buzzDelta: 14 },
};
