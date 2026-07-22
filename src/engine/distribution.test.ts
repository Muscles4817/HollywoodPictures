import { describe, it, expect } from 'vitest';
import {
  canSelfDistributeWide,
  canUnlockDistributionArm,
  defaultDistributionMethod,
  distributionArmTier,
  distributionArmUpgradeCost,
  isDistributionArmUnlocked,
  nextDistributionArmTier,
  resolveDistribution,
} from './distribution';
import { STUDIO_BOX_OFFICE_SHARE } from './boxOfficeRun';
import { createInitialStudio } from '../state/gameState';
import {
  DISTRIBUTION_ARM_UNLOCK_BRAND,
  DISTRIBUTION_ARM_UNLOCK_FILMS_RELEASED,
  DISTRIBUTION_ARM_UPGRADE_COST_BY_TIER,
  RENTED_DISTRIBUTION_KEEP_MULTIPLIER,
  RENTED_WIDE_CEILING,
  SELF_DISTRIBUTION_WIDE_CEILING_BY_TIER,
} from '../data/distribution';
import type { Studio } from '../types';

function studioWithArm(tier: number | null): Studio {
  const studio = createInitialStudio(50_000_000);
  return tier == null ? studio : { ...studio, distributionArm: { tier } };
}

describe('Distribution Arm facility helpers', () => {
  it('is locked until built, and self-distributing Wide needs it', () => {
    const none = studioWithArm(null);
    expect(isDistributionArmUnlocked(none)).toBe(false);
    expect(distributionArmTier(none)).toBe(0);
    expect(canSelfDistributeWide(none)).toBe(false);

    const built = studioWithArm(1);
    expect(isDistributionArmUnlocked(built)).toBe(true);
    expect(canSelfDistributeWide(built)).toBe(true);
  });

  it('unlocks on the films-released OR Brand milestone', () => {
    expect(canUnlockDistributionArm(0, DISTRIBUTION_ARM_UNLOCK_FILMS_RELEASED)).toBe(true);
    expect(canUnlockDistributionArm(DISTRIBUTION_ARM_UNLOCK_BRAND, 0)).toBe(true);
    expect(canUnlockDistributionArm(DISTRIBUTION_ARM_UNLOCK_BRAND - 1, DISTRIBUTION_ARM_UNLOCK_FILMS_RELEASED - 1)).toBe(false);
  });

  it('upgrades cost through the tiers, then maxes out', () => {
    expect(distributionArmUpgradeCost(studioWithArm(null))).toBeNull(); // locked
    expect(nextDistributionArmTier(studioWithArm(1))).toBe(2);
    expect(distributionArmUpgradeCost(studioWithArm(1))).toBe(DISTRIBUTION_ARM_UPGRADE_COST_BY_TIER[2]);
    expect(distributionArmUpgradeCost(studioWithArm(2))).toBe(DISTRIBUTION_ARM_UPGRADE_COST_BY_TIER[3]);
    expect(nextDistributionArmTier(studioWithArm(3))).toBeNull(); // maxed
    expect(distributionArmUpgradeCost(studioWithArm(3))).toBeNull();
  });
});

describe('defaultDistributionMethod', () => {
  it('defaults a Wide release to renting without an arm, self-distribution with one', () => {
    expect(defaultDistributionMethod('Wide', studioWithArm(null))).toBe('rented');
    expect(defaultDistributionMethod('Wide', studioWithArm(1))).toBe('self');
  });

  it('always self-distributes the ungated release types', () => {
    expect(defaultDistributionMethod('Limited', studioWithArm(null))).toBe('self');
    expect(defaultDistributionMethod('Festival First', studioWithArm(null))).toBe('self');
  });
});

describe('resolveDistribution', () => {
  it('carries no overrides for a non-Wide release', () => {
    expect(resolveDistribution('Limited', 'self', 0)).toEqual({ method: 'self' });
    expect(resolveDistribution('Festival First', 'self', 3)).toEqual({ method: 'self' });
  });

  it('scales the self-distributed Wide screen ceiling with arm tier, keeping the full share', () => {
    const t1 = resolveDistribution('Wide', 'self', 1);
    const t3 = resolveDistribution('Wide', 'self', 3);
    expect(t1.breadth).toBe(SELF_DISTRIBUTION_WIDE_CEILING_BY_TIER[1]);
    expect(t3.breadth).toBe(SELF_DISTRIBUTION_WIDE_CEILING_BY_TIER[3]);
    expect(t3.breadth!).toBeGreaterThan(t1.breadth!);
    // No keep-share override => the studio keeps its full box-office share.
    expect(t1.keepShare).toBeUndefined();
    expect(t3.keepShare).toBeUndefined();
  });

  it('a rented Wide reaches a fixed ceiling but surrenders a cut of the keep', () => {
    const rented = resolveDistribution('Wide', 'rented', 0);
    expect(rented.breadth).toBe(RENTED_WIDE_CEILING);
    expect(rented.keepShare).toBeCloseTo(STUDIO_BOX_OFFICE_SHARE * RENTED_DISTRIBUTION_KEEP_MULTIPLIER, 6);
    expect(rented.keepShare!).toBeLessThan(STUDIO_BOX_OFFICE_SHARE); // the distributor's fee
  });
});
