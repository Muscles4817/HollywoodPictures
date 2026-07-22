// Distribution Arm - pure facility logic (unlock/upgrade helpers) plus the
// resolver that turns a Wide release's distribution *method* into the concrete
// terms the release computation and box office consume. No React, no state.
// Tunables live in data/distribution.ts.
import type { Genre, Money, ReleaseType, RivalStudio, Studio } from '../types';
import { clamp } from './random';
import {
  DISTRIBUTION_ARM_MAX_TIER,
  DISTRIBUTION_ARM_UNLOCK_BRAND,
  DISTRIBUTION_ARM_UNLOCK_FILMS_RELEASED,
  DISTRIBUTION_ARM_UPGRADE_COST_BY_TIER,
  DOMESTIC_KEEP_SHARE,
  GENRE_INTERNATIONAL_APPEAL,
  INTERNATIONAL_DISTRIBUTION_MAX_TIER,
  INTERNATIONAL_KEEP_SHARE,
  INTERNATIONAL_REACH_BY_TIER,
  INTERNATIONAL_UPGRADE_COST_BY_TIER,
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
      // The rented cut applies to the DOMESTIC keep - the deal's keepShare is the
      // domestic half of the split now (engine/boxOfficeRun.ts). International is
      // gated separately by the International Distribution track.
      keepShare: DOMESTIC_KEEP_SHARE * RENTED_DISTRIBUTION_KEEP_MULTIPLIER,
    };
  }
  // Self-distribution: the ceiling this arm tier can command (undefined at
  // tier 0, which the schedule-time gate rejects), full keep.
  return { method: 'self', breadth: SELF_DISTRIBUTION_WIDE_CEILING_BY_TIER[armTier] };
}

// --- International Distribution track (an independent upgrade track ON the arm,
// mirroring the Production Office's Market Research track) -------------------

export function internationalTier(studio: Studio): number {
  return studio.distributionArm?.internationalTier ?? 0;
}

/** The tier International Distribution could next reach, or null if the arm is locked or the track is maxed. */
export function nextInternationalTier(studio: Studio): number | null {
  if (!isDistributionArmUnlocked(studio)) return null; // the base arm must exist first
  const tier = internationalTier(studio);
  return tier < INTERNATIONAL_DISTRIBUTION_MAX_TIER ? tier + 1 : null;
}

/** Cash cost to reach the next international tier, or null if there is none. */
export function internationalUpgradeCost(studio: Studio): Money | null {
  const next = nextInternationalTier(studio);
  return next != null ? (INTERNATIONAL_UPGRADE_COST_BY_TIER[next] ?? null) : null;
}

/** How much of the international pool a given International Distribution tier reaches (tier 0 = the hard gate = 0). */
export function internationalReachForTier(tier: number): number {
  return INTERNATIONAL_REACH_BY_TIER[tier] ?? 0;
}

/** The international reach an established rival studio commands. First pass: always full - rivals are majors and shouldn't be nerfed. The seam for future rival identities (majors vs indies) with narrower overseas coverage. */
export function internationalReachForRivalStudio(_rivalStudio: RivalStudio): number {
  return 1;
}

/**
 * The share of a film's worldwide gross that comes from overseas. Film-level
 * seam by design: the first pass keys on genre alone, but callers pass film
 * inputs (not a genre constant) so this can later fold in production scale,
 * effects/spectacle, target audience, cast international reach, franchise
 * strength, etc. without any caller changing. Clamped strictly below 1 so a
 * film always retains a domestic half.
 */
export interface InternationalAppealInput {
  genre: Genre;
}
export function computeInternationalAppeal(input: InternationalAppealInput): number {
  return clamp(GENRE_INTERNATIONAL_APPEAL[input.genre], 0, 0.95);
}

// --- The one market split every money boundary uses -------------------------

export interface MarketGrossSplit {
  /** The simulated worldwide gross fed in (what the audience sim would earn at full worldwide reach). */
  worldwidePotentialGross: number;
  domesticGross: number;
  /** The full overseas half, before reach gating. */
  internationalPotentialGross: number;
  /** The overseas gross actually realised = potential x reach. */
  internationalGross: number;
  /** Overseas gross left on the table for want of distribution (potential - realised). Never part of headline or cash. */
  internationalLostGross: number;
  /** What actually played = domestic + realised international. This is the reported gross. */
  headlineGross: number;
  /** Studio cash from this gross = domestic x domesticKeep + realised international x INTERNATIONAL_KEEP_SHARE. */
  studioCredit: number;
}

/**
 * Partition one simulated worldwide gross into its domestic and international
 * markets, gate the international half by distribution reach, and compute the
 * studio's cash from per-market keep shares. The single source of truth for the
 * split - weekly settlement, opening weekend, the final tally, previews and
 * tests all call this rather than repeating the arithmetic. Every input is
 * clamped defensively so bad data can never manufacture negative revenue.
 */
export function splitBoxOfficeGross(
  simulatedWorldwideGross: number,
  internationalAppeal: number,
  internationalReachFraction: number,
  domesticKeepShare: number,
): MarketGrossSplit {
  const worldwide = Math.max(0, simulatedWorldwideGross);
  const appeal = clamp(internationalAppeal, 0, 1);
  const reach = clamp(internationalReachFraction, 0, 1);
  const domesticKeep = clamp(domesticKeepShare, 0, 1);

  const domesticGross = worldwide * (1 - appeal);
  const internationalPotentialGross = worldwide * appeal;
  const internationalGross = internationalPotentialGross * reach;
  const internationalLostGross = internationalPotentialGross - internationalGross;
  const headlineGross = domesticGross + internationalGross;
  const studioCredit = studioCreditFromMarkets(domesticGross, internationalGross, domesticKeep);

  return {
    worldwidePotentialGross: worldwide,
    domesticGross,
    internationalPotentialGross,
    internationalGross,
    internationalLostGross,
    headlineGross,
    studioCredit,
  };
}

/** The domestic keep share for a film - its frozen deal value (rented-Wide takes a cut) or the default. The single reader of the domestic keep. */
export function domesticKeepShareForFilm(distributionKeepShare: number | undefined): number {
  return distributionKeepShare ?? DOMESTIC_KEEP_SHARE;
}

/** Studio cash from a domestic + realised-international gross pair, applying each market's keep. The one place the international keep constant is spent. */
export function studioCreditFromMarkets(domesticGross: number, internationalGross: number, domesticKeepShare: number): number {
  return Math.max(0, domesticGross) * clamp(domesticKeepShare, 0, 1) + Math.max(0, internationalGross) * INTERNATIONAL_KEEP_SHARE;
}
