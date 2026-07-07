import type { TalentRole } from '../types';
import type { Range } from '../engine/interpolate';

// Per-role calibration for procedural talent generation. Salary ranges span
// two to three orders of magnitude on purpose - sampled on a log scale (see
// engine/talentGenerator.ts) - so a genuine shoestring hire and a blockbuster
// star are both represented, and the whole spread is meaningfully reachable
// via a price slider. fameCeiling caps how famous this role can plausibly
// get even at the top of its pay scale (below-the-line crew don't become
// household names the way leads and directors do).
export interface RoleGenerationProfile {
  salaryRange: Range;
  fameCeiling: number;
}

export const ROLE_GENERATION_PROFILES: Record<TalentRole, RoleGenerationProfile> = {
  Director: { salaryRange: { min: 50_000, max: 12_000_000 }, fameCeiling: 98 },
  'Lead Actor': { salaryRange: { min: 40_000, max: 15_000_000 }, fameCeiling: 98 },
  'Supporting Actor': { salaryRange: { min: 20_000, max: 4_000_000 }, fameCeiling: 85 },
  Writer: { salaryRange: { min: 15_000, max: 2_000_000 }, fameCeiling: 55 },
  Composer: { salaryRange: { min: 15_000, max: 2_500_000 }, fameCeiling: 60 },
  Editor: { salaryRange: { min: 10_000, max: 1_200_000 }, fameCeiling: 45 },
  'VFX Supervisor': { salaryRange: { min: 30_000, max: 5_000_000 }, fameCeiling: 65 },
};

// Every film needs one of each mandatory role; VFX Supervisor is optional
// depending on genre. Shared between the reducer (candidate generation,
// budget splitting) and the Hire Talent screen.
export const MANDATORY_TALENT_ROLES: TalentRole[] = [
  'Director',
  'Lead Actor',
  'Supporting Actor',
  'Writer',
  'Composer',
  'Editor',
];
export const OPTIONAL_TALENT_ROLES: TalentRole[] = ['VFX Supervisor'];
export const ALL_TALENT_ROLES: TalentRole[] = [...MANDATORY_TALENT_ROLES, ...OPTIONAL_TALENT_ROLES];
