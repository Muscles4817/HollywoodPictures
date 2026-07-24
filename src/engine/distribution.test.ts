import { describe, it, expect } from 'vitest';
import {
  assessCommercialAppeal,
  canSelfDistributeWide,
  canUnlockDistributionArm,
  computeInternationalAppeal,
  defaultDistributionMethod,
  distributionArmTier,
  distributionArmUpgradeCost,
  feeFractionFromKeepShare,
  generateDistributorOffers,
  internationalReachForTier,
  internationalTier,
  internationalUpgradeCost,
  isDistributionArmUnlocked,
  nextDistributionArmTier,
  nextInternationalTier,
  resolveDistribution,
  resolveDistributorDeal,
  splitBoxOfficeGross,
  studioCreditFromMarkets,
  type CommercialAppealInput,
} from './distribution';
import { createInitialStudio } from '../state/gameState';
import {
  DISTRIBUTION_ARM_UNLOCK_BRAND,
  DISTRIBUTION_ARM_UNLOCK_FILMS_RELEASED,
  DISTRIBUTION_ARM_UPGRADE_COST_BY_TIER,
  DISTRIBUTOR_FEE_RANGE,
  DOMESTIC_KEEP_SHARE,
  GENRE_INTERNATIONAL_APPEAL,
  INTERNATIONAL_DISTRIBUTION_MAX_TIER,
  INTERNATIONAL_KEEP_SHARE,
  INTERNATIONAL_UPGRADE_COST_BY_TIER,
  SELF_DISTRIBUTION_WIDE_CEILING_BY_TIER,
} from '../data/distribution';
import { createRng, withRng } from './random';
import { buildReadyDraft } from '../state/testFixtures';
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
  it('defaults a Wide release to a distributor without an arm, self-distribution with one', () => {
    expect(defaultDistributionMethod('Wide', studioWithArm(null))).toBe('distributor');
    expect(defaultDistributionMethod('Wide', studioWithArm(1))).toBe('self');
  });

  it('always self-distributes the ungated release types', () => {
    expect(defaultDistributionMethod('Limited', studioWithArm(null))).toBe('self');
    expect(defaultDistributionMethod('Festival First', studioWithArm(null))).toBe('self');
  });
});

describe('resolveDistribution (self / non-Wide paths)', () => {
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
});

function appealInputFor(overrides: { budget?: number } = {}): CommercialAppealInput {
  const { result: draft } = withRng(2024, (rng) => buildReadyDraft(rng));
  return {
    script: draft.script!,
    genre: draft.genre!,
    talent: draft.talent,
    productionBudget: overrides.budget ?? 30_000_000,
  };
}

describe('assessCommercialAppeal', () => {
  it('is a fraction in [0,1] and rises with production scale', () => {
    const lean = assessCommercialAppeal(appealInputFor({ budget: 2_000_000 }));
    const blockbuster = assessCommercialAppeal(appealInputFor({ budget: 200_000_000 }));
    expect(lean).toBeGreaterThanOrEqual(0);
    expect(blockbuster).toBeLessThanOrEqual(1);
    expect(blockbuster).toBeGreaterThan(lean);
  });
});

describe('generateDistributorOffers', () => {
  it('pitches one offer per archetype, terms all inside their ranges', () => {
    const offers = generateDistributorOffers(0.5, 50, createRng(1));
    expect(offers.map((o) => o.archetype).sort()).toEqual(['balanced', 'boutique', 'major']);
    for (const o of offers) {
      expect(o.feeFraction).toBeGreaterThanOrEqual(DISTRIBUTOR_FEE_RANGE.min);
      expect(o.feeFraction).toBeLessThanOrEqual(DISTRIBUTOR_FEE_RANGE.max);
      expect(o.breadth).toBeGreaterThan(0);
      expect(o.breadth).toBeLessThanOrEqual(0.95);
      expect(o.pAndA).toBeGreaterThan(0);
    }
  });

  it('is deterministic for a fixed seed (stable across renders)', () => {
    const a = generateDistributorOffers(0.5, 50, createRng(42));
    const b = generateDistributorOffers(0.5, 50, createRng(42));
    expect(a).toEqual(b);
  });

  it('a more appealing film with a stronger studio gets better terms (lower fee, wider, bigger campaign)', () => {
    const weak = generateDistributorOffers(0.2, 10, createRng(7));
    const strong = generateDistributorOffers(0.9, 90, createRng(7));
    const byArch = (offers: typeof weak, a: string) => offers.find((o) => o.archetype === a)!;
    expect(byArch(strong, 'balanced').feeFraction).toBeLessThan(byArch(weak, 'balanced').feeFraction);
    expect(byArch(strong, 'balanced').breadth).toBeGreaterThan(byArch(weak, 'balanced').breadth);
    expect(byArch(strong, 'balanced').pAndA).toBeGreaterThan(byArch(weak, 'balanced').pAndA);
  });

  it('the major charges the most and reaches widest; the boutique charges the least', () => {
    const offers = generateDistributorOffers(0.6, 60, createRng(3));
    const major = offers.find((o) => o.archetype === 'major')!;
    const boutique = offers.find((o) => o.archetype === 'boutique')!;
    expect(major.breadth).toBeGreaterThan(boutique.breadth);
    expect(major.pAndA).toBeGreaterThan(boutique.pAndA);
    expect(major.feeFraction).toBeGreaterThan(boutique.feeFraction);
  });
});

describe('resolveDistributorDeal / feeFractionFromKeepShare', () => {
  it('turns an offer into frozen terms: keepShare below the default, P&A both fronted and recouped', () => {
    const [offer] = generateDistributorOffers(0.5, 50, createRng(1));
    const deal = resolveDistributorDeal(offer);
    expect(deal.method).toBe('distributor');
    expect(deal.breadth).toBe(offer.breadth);
    expect(deal.keepShare).toBeCloseTo(DOMESTIC_KEEP_SHARE * (1 - offer.feeFraction), 6);
    expect(deal.keepShare!).toBeLessThan(DOMESTIC_KEEP_SHARE);
    expect(deal.pAndA).toBe(offer.pAndA);
    expect(deal.marketingRecoup).toBe(offer.pAndA);
    // The fee fraction round-trips out of the keepShare (display helper).
    expect(feeFractionFromKeepShare(deal.keepShare)).toBeCloseTo(offer.feeFraction, 6);
  });

  it('feeFractionFromKeepShare is 0 for a self-distributed film (no override)', () => {
    expect(feeFractionFromKeepShare(undefined)).toBe(0);
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
