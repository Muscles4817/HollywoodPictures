import { describe, it, expect } from 'vitest';
import {
  canSelfDistributeWide,
  canUnlockDistributionArm,
  computeInternationalAppeal,
  defaultDistributionMethod,
  distributionArmTier,
  distributionArmUpgradeCost,
  internationalReachForTier,
  internationalTier,
  internationalUpgradeCost,
  isDistributionArmUnlocked,
  nextDistributionArmTier,
  nextInternationalTier,
  resolveDistribution,
  splitBoxOfficeGross,
  studioCreditFromMarkets,
} from './distribution';
import { createInitialStudio } from '../state/gameState';
import {
  DISTRIBUTION_ARM_UNLOCK_BRAND,
  DISTRIBUTION_ARM_UNLOCK_FILMS_RELEASED,
  DISTRIBUTION_ARM_UPGRADE_COST_BY_TIER,
  DOMESTIC_KEEP_SHARE,
  GENRE_INTERNATIONAL_APPEAL,
  INTERNATIONAL_DISTRIBUTION_MAX_TIER,
  INTERNATIONAL_KEEP_SHARE,
  INTERNATIONAL_UPGRADE_COST_BY_TIER,
  RENTED_DISTRIBUTION_KEEP_MULTIPLIER,
  RENTED_WIDE_CEILING,
  SELF_DISTRIBUTION_WIDE_CEILING_BY_TIER,
} from '../data/distribution';
import type { Genre, Studio } from '../types';

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

  it('a rented Wide reaches a fixed ceiling but surrenders a cut of the domestic keep', () => {
    const rented = resolveDistribution('Wide', 'rented', 0);
    expect(rented.breadth).toBe(RENTED_WIDE_CEILING);
    // The rented cut now applies to the domestic keep - international is gated
    // separately by the International Distribution track.
    expect(rented.keepShare).toBeCloseTo(DOMESTIC_KEEP_SHARE * RENTED_DISTRIBUTION_KEEP_MULTIPLIER, 6);
    expect(rented.keepShare!).toBeLessThan(DOMESTIC_KEEP_SHARE); // the distributor's fee
  });
});

function studioWithIntlTier(intlTier: number | null, armTier: number | null = 1): Studio {
  const studio = createInitialStudio(50_000_000);
  if (armTier == null) return studio; // no arm at all
  return { ...studio, distributionArm: { tier: armTier, ...(intlTier != null ? { internationalTier: intlTier } : {}) } };
}

const ALL_GENRES = Object.keys(GENRE_INTERNATIONAL_APPEAL) as Genre[];

describe('International Distribution track helpers', () => {
  it('reports the current international tier, defaulting to 0', () => {
    expect(internationalTier(studioWithIntlTier(null))).toBe(0);
    expect(internationalTier(studioWithIntlTier(2))).toBe(2);
  });

  it('has no next tier without an arm, and caps at the max', () => {
    expect(nextInternationalTier(studioWithIntlTier(null, null))).toBeNull(); // arm locked
    expect(nextInternationalTier(studioWithIntlTier(0))).toBe(1);
    expect(nextInternationalTier(studioWithIntlTier(INTERNATIONAL_DISTRIBUTION_MAX_TIER))).toBeNull(); // maxed
  });

  it('prices the next tier, and has no price when locked or maxed', () => {
    expect(internationalUpgradeCost(studioWithIntlTier(0))).toBe(INTERNATIONAL_UPGRADE_COST_BY_TIER[1]);
    expect(internationalUpgradeCost(studioWithIntlTier(null, null))).toBeNull();
    expect(internationalUpgradeCost(studioWithIntlTier(INTERNATIONAL_DISTRIBUTION_MAX_TIER))).toBeNull();
  });

  it('tier 0 is the hard gate (reach 0) and the max tier reaches everything (reach 1)', () => {
    expect(internationalReachForTier(0)).toBe(0);
    expect(internationalReachForTier(INTERNATIONAL_DISTRIBUTION_MAX_TIER)).toBe(1);
    // Reach is monotonically non-decreasing across tiers.
    for (let t = 1; t <= INTERNATIONAL_DISTRIBUTION_MAX_TIER; t++) {
      expect(internationalReachForTier(t)).toBeGreaterThanOrEqual(internationalReachForTier(t - 1));
    }
    expect(internationalReachForTier(999)).toBe(0); // unknown tier => gated
  });

  it('every genre has an international appeal strictly inside (0, 1) so a film always keeps a domestic half', () => {
    for (const genre of ALL_GENRES) {
      const appeal = computeInternationalAppeal({ genre });
      expect(appeal).toBeGreaterThan(0);
      expect(appeal).toBeLessThan(1);
    }
  });
});

describe('splitBoxOfficeGross - the one market split', () => {
  const APPEAL = 0.6;

  it('tier-0 reach earns domestic only - no international gross or credit from overseas', () => {
    const split = splitBoxOfficeGross(100_000_000, APPEAL, 0, DOMESTIC_KEEP_SHARE);
    expect(split.internationalGross).toBe(0);
    expect(split.headlineGross).toBe(split.domesticGross);
    expect(split.domesticGross).toBeCloseTo(100_000_000 * (1 - APPEAL), 6);
    // All of the overseas half is lost when hard-gated.
    expect(split.internationalLostGross).toBeCloseTo(split.internationalPotentialGross, 6);
    expect(split.studioCredit).toBeCloseTo(split.domesticGross * DOMESTIC_KEEP_SHARE, 6);
  });

  it('full reach captures the whole overseas half, and headline == worldwide', () => {
    const split = splitBoxOfficeGross(100_000_000, APPEAL, 1, DOMESTIC_KEEP_SHARE);
    expect(split.internationalGross).toBeCloseTo(split.internationalPotentialGross, 6);
    expect(split.internationalLostGross).toBeCloseTo(0, 6);
    expect(split.headlineGross).toBeCloseTo(100_000_000, 6);
  });

  it('domestic + international potential always reconstitute the worldwide gross', () => {
    for (const reach of [0, 0.4, 0.7, 1]) {
      const split = splitBoxOfficeGross(80_000_000, APPEAL, reach, DOMESTIC_KEEP_SHARE);
      expect(split.domesticGross + split.internationalPotentialGross).toBeCloseTo(80_000_000, 6);
      // Headline is domestic + *realised* international, never the lost portion.
      expect(split.headlineGross).toBeCloseTo(split.domesticGross + split.internationalGross, 6);
      expect(split.headlineGross + split.internationalLostGross).toBeCloseTo(80_000_000, 6);
    }
  });

  it('credit applies each market its own keep - the two constants are distinct', () => {
    const split = splitBoxOfficeGross(100_000_000, APPEAL, 1, DOMESTIC_KEEP_SHARE);
    const expected = split.domesticGross * DOMESTIC_KEEP_SHARE + split.internationalGross * INTERNATIONAL_KEEP_SHARE;
    expect(split.studioCredit).toBeCloseTo(expected, 6);
    // The international keep really is the lower of the two (more middlemen abroad).
    expect(INTERNATIONAL_KEEP_SHARE).toBeLessThan(DOMESTIC_KEEP_SHARE);
  });

  it('clamps hostile inputs so no negative revenue is ever manufactured', () => {
    const split = splitBoxOfficeGross(-100, 2, 5, 3);
    expect(split.worldwidePotentialGross).toBe(0);
    expect(split.domesticGross).toBe(0);
    expect(split.internationalGross).toBe(0);
    expect(split.studioCredit).toBe(0);
  });

  it("a full-reach studio's blended keep lands near the old 0.42 across the genre mix", () => {
    // §9 calibration: (1-appeal)*DOMESTIC + appeal*INTL should average ~0.42.
    const blended = ALL_GENRES.map((genre) => {
      const appeal = computeInternationalAppeal({ genre });
      return (1 - appeal) * DOMESTIC_KEEP_SHARE + appeal * INTERNATIONAL_KEEP_SHARE;
    });
    const avg = blended.reduce((s, b) => s + b, 0) / blended.length;
    expect(avg).toBeGreaterThan(0.40);
    expect(avg).toBeLessThan(0.44);
    // And every single genre stays in a sane band (no wild outlier).
    for (const b of blended) {
      expect(b).toBeGreaterThan(0.38);
      expect(b).toBeLessThan(0.46);
    }
  });
});

describe('studioCreditFromMarkets', () => {
  it('is the sum of each market at its keep, and never negative', () => {
    expect(studioCreditFromMarkets(100, 100, 0.46)).toBeCloseTo(100 * 0.46 + 100 * INTERNATIONAL_KEEP_SHARE, 6);
    expect(studioCreditFromMarkets(-100, -100, 0.46)).toBe(0);
  });
});
