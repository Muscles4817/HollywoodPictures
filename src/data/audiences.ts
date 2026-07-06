import type { TargetAudience } from '../types';

// How forgiving/demanding each target audience is, and how it weights
// critic vs audience appeal when judging marketability.
export interface AudienceProfile {
  criticWeight: number; // 0-1, extra weight on critic score for marketability
  audienceWeight: number; // 0-1, extra weight on mass audience score
  marketSize: number; // 0-1, relative size of reachable box office pool
}

export const TARGET_AUDIENCES: TargetAudience[] = [
  'Mass Market',
  'Critics',
  'Teens',
  'Families',
  'Adults',
  'Niche',
];

export const AUDIENCE_PROFILES: Record<TargetAudience, AudienceProfile> = {
  'Mass Market': { criticWeight: 0.3, audienceWeight: 0.7, marketSize: 1.0 },
  Critics: { criticWeight: 0.85, audienceWeight: 0.15, marketSize: 0.55 },
  Teens: { criticWeight: 0.2, audienceWeight: 0.8, marketSize: 0.8 },
  Families: { criticWeight: 0.35, audienceWeight: 0.65, marketSize: 0.85 },
  Adults: { criticWeight: 0.55, audienceWeight: 0.45, marketSize: 0.75 },
  Niche: { criticWeight: 0.7, audienceWeight: 0.3, marketSize: 0.4 },
};
