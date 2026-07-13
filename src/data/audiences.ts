import type { TargetAudience } from '../types';

// How big a reachable box office pool each target audience represents.
export interface AudienceProfile {
  marketSize: number; // 0-1, relative size of reachable box office pool
  description: string; // shown to the player when they pick this audience
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
  'Mass Market': {
    marketSize: 1.0,
    description: 'The biggest possible audience. Safe, but you’re competing with everything else aiming for the same crowd.',
  },
  Critics: {
    marketSize: 0.55,
    description: 'A smaller box office ceiling, but strong reviews travel further and boost Prestige more with this crowd.',
  },
  Teens: {
    marketSize: 0.8,
    description: 'A large, enthusiastic audience that shows up for fun over prestige - forgiving of a rough edge or two.',
  },
  Families: {
    marketSize: 0.85,
    description: 'A big, reliable audience - repeat viewings and word-of-mouth from parents drive strong turnout.',
  },
  Adults: {
    marketSize: 0.75,
    description: 'A solid mid-sized audience that expects a bit more craft than the mass market does.',
  },
  Niche: {
    marketSize: 0.4,
    description: 'The smallest reachable audience by far - only worth it if you’re confident the film is genuinely excellent.',
  },
};
