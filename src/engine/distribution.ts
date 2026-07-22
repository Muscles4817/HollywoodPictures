// Distribution Arm - pure facility logic (unlock/upgrade helpers) plus the
// resolver that turns a Wide release's distribution *method* into the concrete
// terms the release computation and box office consume. No React, no state.
// Tunables live in data/distribution.ts.
import type { Money, ReleaseType, Studio } from '../types';
import { STUDIO_BOX_OFFICE_SHARE } from './boxOfficeRun';
import {
  DISTRIBUTION_ARM_MAX_TIER,
  DISTRIBUTION_ARM_UNLOCK_BRAND,
  DISTRIBUTION_ARM_UNLOCK_FILMS_RELEASED,
  DISTRIBUTION_ARM_UPGRADE_COST_BY_TIER,
  RENTED_DISTRIBUTION_KEEP_MULTIPLIER,
  RENTED_WIDE_CEILING,
  SELF_DISTRIBUTION_WIDE_CEILING_BY_TIER,
} from '../data/distribution';

// --- Facility helpers (mirror engine/producers.ts's office helpers) ---------

export function distributionArmTier(studio: Studio): number {
  return studio.distributionArm?.tier ?? 0;
}

export function isDistributionArmUnlocked(studio: Studio): boolean {
  return studio.distributionArm != null;
}

/** Whether the arm's unlock milestone is met - earned (films shipped OR Brand), not bought. */
export function canUnlockDistributionArm(brand: number, filmsReleased: number): boolean {
  return filmsReleased >= DISTRIBUTION_ARM_UNLOCK_FILMS_RELEASED || brand >= DISTRIBUTION_ARM_UNLOCK_BRAND;
}

/** The tier the arm could next upgrade to, or null if locked or already maxed. */
export function nextDistributionArmTier(studio: Studio): number | null {
  const tier = distributionArmTier(studio);
  return tier > 0 && tier < DISTRIBUTION_ARM_MAX_TIER ? tier + 1 : null;
}

/** Cash cost to reach the next tier, or null if there is no next tier. */
export function distributionArmUpgradeCost(studio: Studio): Money | null {
  const next = nextDistributionArmTier(studio);
  return next != null ? (DISTRIBUTION_ARM_UPGRADE_COST_BY_TIER[next] ?? null) : null;
}

/** Self-distributing a Wide release requires an owned arm (tier >= 1). */
export function canSelfDistributeWide(studio: Studio): boolean {
  return distributionArmTier(studio) >= 1;
}

// --- Distribution method resolution -----------------------------------------

export type DistributionMethod = 'self' | 'rented';

export interface DistributionDeal {
  method: DistributionMethod;
  /**
   * The Wide availability ceiling for this deal, before the market's own
   * releaseStrength scaling (engine/audienceSimulationInputs.ts). Undefined for
   * a non-Wide release, where the engine keeps the release type's own value.
   */
  breadth?: number;
  /**
   * The studio's box-office keep share for this deal. Undefined means the
   * default STUDIO_BOX_OFFICE_SHARE (self-distribution and every non-Wide
   * release); a rented Wide release keeps less - the distributor's fee.
   */
  keepShare?: number;
}

/**
 * The method a release defaults to. Only Wide is gated: without an owned arm a
 * studio can't self-distribute a Wide release, so it defaults to renting.
 * Limited/Festival First are always self-distributed (a studio can four-wall a
 * handful of screens itself).
 */
export function defaultDistributionMethod(releaseType: ReleaseType, studio: Studio): DistributionMethod {
  if (releaseType !== 'Wide') return 'self';
  return canSelfDistributeWide(studio) ? 'self' : 'rented';
}

/**
 * Resolve the concrete distribution terms. Non-Wide releases carry no overrides
 * (the engine uses their own modest, ungated values). A Wide release's screen
 * ceiling and revenue keep depend on whether it's self-distributed (ceiling
 * scales with arm tier, full keep) or rented (fixed ceiling, a fee off the top).
 */
export function resolveDistribution(releaseType: ReleaseType, method: DistributionMethod, armTier: number): DistributionDeal {
  if (releaseType !== 'Wide') return { method: 'self' };
  if (method === 'rented') {
    return {
      method: 'rented',
      breadth: RENTED_WIDE_CEILING,
      keepShare: STUDIO_BOX_OFFICE_SHARE * RENTED_DISTRIBUTION_KEEP_MULTIPLIER,
    };
  }
  // Self-distribution: the ceiling this arm tier can command (undefined at
  // tier 0, which the schedule-time gate rejects), full keep.
  return { method: 'self', breadth: SELF_DISTRIBUTION_WIDE_CEILING_BY_TIER[armTier] };
}
