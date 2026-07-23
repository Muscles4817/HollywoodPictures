import type { ProductionRole, TalentProfession } from '../types';
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

export const ROLE_GENERATION_PROFILES: Record<TalentProfession, RoleGenerationProfile> = {
  // Directors are fully hand-authored - there is no procedural director pool
  // (see engine/talentGenerator.ts:generateTalentPool). The range spans the
  // ~340-strong handcrafted roster's actual salaries (~$0.3M-$20M in
  // HANDCRAFTED_DIRECTORS, from microbudget festival names up to the A-list)
  // so the price slider, rival target pricing, and casting-call bands only
  // ever point where a real director exists. The old $50K-$12M range couldn't
  // reach the $20M A-list, and its bottom sat below any real director until
  // the roster was filled out across the low- and mid-budget tiers.
  Director: { salaryRange: { min: 300_000, max: 20_000_000 }, fameCeiling: 98 },
  // Top of the actor market lifted to £25M to reach real A-list upfront pay
  // ($20-30M/film for a bankable star) - the handcrafted marquee names already
  // sit at ~£20M, but the old £15M ceiling meant a rival's target price could
  // never climb high enough to actually reach for them. See
  // docs/DESIGN_REVIEW_ai_studio_behavior.md "Reality check". (Generated
  // budget actors are still capped far below this at BUDGET_ACTOR_SALARY_CEILING.)
  'Actor': { salaryRange: { min: 20_000, max: 25_000_000 }, fameCeiling: 98 },
  Writer: { salaryRange: { min: 15_000, max: 2_000_000 }, fameCeiling: 55 },
  Cinematographer: { salaryRange: { min: 25_000, max: 6_000_000 }, fameCeiling: 62 },
  Composer: { salaryRange: { min: 15_000, max: 2_500_000 }, fameCeiling: 60 },
  Editor: { salaryRange: { min: 10_000, max: 1_200_000 }, fameCeiling: 45 },
  'VFX Supervisor': { salaryRange: { min: 30_000, max: 5_000_000 }, fameCeiling: 65 },
  'Casting Director': { salaryRange: { min: 20_000, max: 3_000_000 }, fameCeiling: 40 },
};

// Every film needs one of each mandatory role; VFX Supervisor and Casting
// Director are both optional (Casting Redesign, Phase D - biases
// engine/castingCalls.ts's applicant generation when present, never blocks
// Greenlight without one, same shape as VFX Supervisor). Shared between the
// reducer (candidate generation, budget splitting) and the Hire Talent screen.
export const MANDATORY_TALENT_ROLES: ProductionRole[] = [
  'Director',
  'Lead Actor',
  'Supporting Actor',
  'Writer',
  'Cinematographer',
  'Composer',
  'Editor',
];
export const OPTIONAL_TALENT_ROLES: ProductionRole[] = ['VFX Supervisor', 'Casting Director'];
export const ALL_TALENT_ROLES: ProductionRole[] = [...MANDATORY_TALENT_ROLES, ...OPTIONAL_TALENT_ROLES];

// Every profession the world talent pool actually generates a candidate
// slate for - one bucket each, unlike ALL_TALENT_ROLES above (which lists
// Lead Actor and Supporting Actor as separate casting slots, both of which
// hire from this same single 'Actor' bucket - see engine/talentGenerator.ts:generateTalentPool
// and data/helpers.ts:professionForProductionRole).
export const ALL_TALENT_PROFESSIONS: TalentProfession[] = [
  'Director',
  'Actor',
  'Writer',
  'Cinematographer',
  'Composer',
  'Editor',
  'VFX Supervisor',
  'Casting Director',
];

// How many people a role can hold. Most roles are one-in, one-out (hiring
// someone new replaces whoever's there); Supporting Actor is the first role
// that supports an ensemble - up to 4, at least 1. min applies only to
// mandatory roles; OPTIONAL_TALENT_ROLES ignore it (0 hired is fine).
export interface RoleCapacity {
  min: number;
  max: number;
}

export const ROLE_CAPACITY: Record<ProductionRole, RoleCapacity> = {
  Director: { min: 1, max: 1 },
  'Lead Actor': { min: 1, max: 1 },
  'Supporting Actor': { min: 1, max: 4 },
  Writer: { min: 1, max: 1 },
  Cinematographer: { min: 1, max: 1 },
  Composer: { min: 1, max: 1 },
  Editor: { min: 1, max: 1 },
  'VFX Supervisor': { min: 0, max: 1 },
  'Casting Director': { min: 0, max: 1 },
};
