// Distribution Arm - pure facility logic (unlock/upgrade helpers) plus the
// resolver that turns a Wide release's distribution *method* into the concrete
// terms the release computation and box office consume. No React, no state.
// Tunables live in data/distribution.ts.
import type { DistributorArchetype, DistributorOffer, Genre, Money, ReleaseType, RivalStudio, Script, Studio, TalentAssignment } from '../types';
import { clamp, createRng, pickMany, randFloat, type RandomFn } from './random';
import { deriveCommercialProfile } from './commercialProfile';
import { GENRE_PROFILES } from '../data/genres';
import {
  COMMERCIAL_SCALE_REFERENCE,
  DISTRIBUTION_ARM_MAX_TIER,
  DISTRIBUTION_ARM_UNLOCK_BRAND,
  DISTRIBUTION_ARM_UNLOCK_FILMS_RELEASED,
  DISTRIBUTION_ARM_UPGRADE_COST_BY_TIER,
  DISTRIBUTOR_ARCHETYPES,
  DISTRIBUTOR_BRAND_WEIGHT,
  DISTRIBUTOR_BREADTH_RANGE,
  DISTRIBUTOR_FEE_RANGE,
  DISTRIBUTOR_NAMES,
  DISTRIBUTOR_PANDA_RANGE,
  DOMESTIC_KEEP_SHARE,
  GENRE_INTERNATIONAL_APPEAL,
  INTERNATIONAL_DISTRIBUTION_MAX_TIER,
  INTERNATIONAL_KEEP_SHARE,
  INTERNATIONAL_REACH_BY_TIER,
  INTERNATIONAL_UPGRADE_COST_BY_TIER,
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

export type DistributionMethod = 'self' | 'distributor';

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
   * default DOMESTIC_KEEP_SHARE (self-distribution and every non-Wide
   * release); a distributor Wide release keeps less - the distributor's fee.
   */
  keepShare?: number;
  /** The P&A a distributor committed (fronted + recouped). Undefined for self-distribution. */
  pAndA?: number;
  /** The dollar amount recouped off the studio's gross (== pAndA for a distributor deal). Undefined for self. */
  marketingRecoup?: number;
  /** The accepted distributor's display name. Undefined for self. */
  distributorName?: string;
  /** The fee fraction of rentals the distributor charged (for display). Undefined for self. */
  feeFraction?: number;
}

/**
 * The method a release defaults to. Only Wide is gated: without an owned arm a
 * studio can't self-distribute a Wide release, so it defaults to taking a
 * distributor. Limited/Festival First are always self-distributed (a studio can
 * four-wall a handful of screens itself).
 */
export function defaultDistributionMethod(releaseType: ReleaseType, studio: Studio): DistributionMethod {
  if (releaseType !== 'Wide') return 'self';
  return canSelfDistributeWide(studio) ? 'self' : 'distributor';
}

// --- Distributor offers -----------------------------------------------------

export interface CommercialAppealInput {
  script: Script;
  genre: Genre;
  talent: TalentAssignment[];
  /** All-in production budget (talent + below-the-line) - the film's scale signal. */
  productionBudget: number;
}

function averageFameOf(talent: TalentAssignment[], role: TalentAssignment['role']): number {
  const matching = talent.filter((t) => t.role === role);
  if (matching.length === 0) return 0;
  return matching.reduce((sum, t) => sum + t.person.reputation.fame, 0) / matching.length;
}

/**
 * A distributor's pre-release read on how commercially appealing a film is, 0-1
 * - the signals they can actually see before it opens: the concept's own
 * commercial profile (accessibility/hook/crossover), the genre's popularity,
 * the star + director wattage, and the sheer scale of the production. Pure and
 * deterministic; no reception or buzz (those aren't known yet). Higher appeal =
 * better offers.
 */
export function assessCommercialAppeal(input: CommercialAppealInput): number {
  const profile = deriveCommercialProfile(input.script);
  const conceptAppeal = (profile.accessibility + profile.hookStrength + profile.crossoverPotential) / 3 / 100;
  const popularity = clamp(GENRE_PROFILES[input.genre].popularity / 100, 0, 1);
  const starFame = clamp((averageFameOf(input.talent, 'Lead Actor') + averageFameOf(input.talent, 'Director')) / 2 / 100, 0, 1);
  const scale = clamp(input.productionBudget / COMMERCIAL_SCALE_REFERENCE, 0, 1);
  return clamp(0.35 * conceptAppeal + 0.2 * popularity + 0.25 * starFame + 0.2 * scale, 0, 1);
}

/** A stable integer seed from a film's id, so a given film's offers don't reshuffle across renders (FNV-1a). */
function seedFromId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

/**
 * The competing distributor offers pitched for a Wide release the studio can't
 * (or chooses not to) self-distribute. One offer per archetype (major /
 * balanced / boutique). Base terms interpolate from the film's commercial
 * `appeal` and the studio's `brand` (a distributor competes harder - lower fee,
 * wider release, bigger campaign - for a film it believes in, and reputation
 * sways the fee); each archetype then shapes those base terms into a real
 * tradeoff. A small deterministic jitter (seeded per film via `rng`) keeps
 * offers feeling alive without reshuffling on re-render.
 */
export function generateDistributorOffers(appeal: number, brand: number, rng: RandomFn): DistributorOffer[] {
  const rep = clamp(brand / 100, 0, 1);
  // Fee keys on a blend of appeal + reputation (both help you at the table);
  // breadth and P&A follow the film's own commercial power.
  const attractiveness = clamp((1 - DISTRIBUTOR_BRAND_WEIGHT) * appeal + DISTRIBUTOR_BRAND_WEIGHT * rep, 0, 1);
  const baseFee = lerp(DISTRIBUTOR_FEE_RANGE.max, DISTRIBUTOR_FEE_RANGE.min, attractiveness);
  const baseBreadth = lerp(DISTRIBUTOR_BREADTH_RANGE.min, DISTRIBUTOR_BREADTH_RANGE.max, appeal);
  const basePAndA = lerp(DISTRIBUTOR_PANDA_RANGE.min, DISTRIBUTOR_PANDA_RANGE.max, appeal);

  const names = pickMany(rng, DISTRIBUTOR_NAMES, 3);
  const archetypes = Object.keys(DISTRIBUTOR_ARCHETYPES) as DistributorArchetype[];
  return archetypes.map((archetype, i) => {
    const mod = DISTRIBUTOR_ARCHETYPES[archetype];
    const feeJitter = randFloat(rng, -0.015, 0.015);
    const pAndAJitter = randFloat(rng, 0.95, 1.05);
    const feeFraction = clamp(baseFee + mod.feeDelta + feeJitter, DISTRIBUTOR_FEE_RANGE.min, DISTRIBUTOR_FEE_RANGE.max);
    const breadth = clamp(baseBreadth * mod.breadthMult, 0.4, 0.95);
    const pAndA = Math.round((basePAndA * mod.pAndAMult * pAndAJitter) / 100_000) * 100_000;
    return {
      id: archetype,
      archetype,
      name: names[i] ?? mod.label,
      feeFraction,
      breadth,
      pAndA,
      blurb: distributorBlurb(archetype, feeFraction, breadth, pAndA),
    };
  });
}

/**
 * The offers for a specific film - the single entry point both the Marketing &
 * Release screen and the SCHEDULE_RELEASE freeze call, so both see the identical
 * set. Deterministically seeded from the film id (offers are stable across
 * re-renders and reproducible at freeze time), keyed on the film's assessed
 * commercial appeal and the studio's current brand.
 */
export function distributorOffersForFilm(params: { id: string; appealInput: CommercialAppealInput; brand: number }): DistributorOffer[] {
  const appeal = assessCommercialAppeal(params.appealInput);
  return generateDistributorOffers(appeal, params.brand, createRng(seedFromId(params.id)));
}

function distributorBlurb(archetype: DistributorArchetype, feeFraction: number, breadth: number, pAndA: number): string {
  const feePct = Math.round(feeFraction * 100);
  const screensPct = Math.round(breadth * 100);
  const paM = Math.round(pAndA / 100_000) / 10;
  switch (archetype) {
    case 'major':
      return `A major's full theatrical muscle: up to ${screensPct}% of screens and a $${paM}M campaign, at the steepest cut (${feePct}% of your rentals).`;
    case 'boutique':
      return `A prestige boutique: a narrower ${screensPct}% release and a leaner $${paM}M campaign, but only a ${feePct}% cut of your rentals.`;
    case 'balanced':
      return `A dependable mid-major: ${screensPct}% of screens and a $${paM}M campaign for a fair ${feePct}% of your rentals.`;
  }
}

/**
 * Turn a chosen distributor offer into the frozen deal terms the release and
 * box office consume. The fee applies to the DOMESTIC keep (the deal's
 * keepShare is the domestic half of the split); the P&A is both the committed
 * marketing spend and the amount recouped off the top of the studio's gross.
 */
export function resolveDistributorDeal(offer: DistributorOffer): DistributionDeal {
  return {
    method: 'distributor',
    breadth: offer.breadth,
    keepShare: DOMESTIC_KEEP_SHARE * (1 - offer.feeFraction),
    pAndA: offer.pAndA,
    marketingRecoup: offer.pAndA,
    distributorName: offer.name,
    feeFraction: offer.feeFraction,
  };
}

/**
 * Resolve the concrete distribution terms for the two paths that don't need a
 * specific offer object: self-distribution (arm-owned) and any non-Wide
 * release. A distributor Wide release is resolved from its chosen offer via
 * resolveDistributorDeal instead.
 */
export function resolveDistribution(releaseType: ReleaseType, _method: DistributionMethod, armTier: number): DistributionDeal {
  if (releaseType !== 'Wide') return { method: 'self' };
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

/** The domestic keep share for a film - its frozen deal value (a distributor Wide takes a cut) or the default. The single reader of the domestic keep. */
export function domesticKeepShareForFilm(distributionKeepShare: number | undefined): number {
  return distributionKeepShare ?? DOMESTIC_KEEP_SHARE;
}

/** Recover the distributor's fee fraction (of rentals) from a frozen domestic keepShare - the inverse of resolveDistributorDeal's keepShare = DOMESTIC_KEEP_SHARE * (1 - fee). For display only. */
export function feeFractionFromKeepShare(keepShare: number | undefined): number {
  if (keepShare == null) return 0;
  return clamp(1 - keepShare / DOMESTIC_KEEP_SHARE, 0, 1);
}

/** Studio cash from a domestic + realised-international gross pair, applying each market's keep. The one place the international keep constant is spent. */
export function studioCreditFromMarkets(domesticGross: number, internationalGross: number, domesticKeepShare: number): number {
  return Math.max(0, domesticGross) * clamp(domesticKeepShare, 0, 1) + Math.max(0, internationalGross) * INTERNATIONAL_KEEP_SHARE;
}
