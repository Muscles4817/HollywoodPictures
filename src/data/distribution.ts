// Distribution Arm facility tuning (the studio's own theatrical distribution
// operation). Pure numbers; engine/distribution.ts reads them and the reducer
// applies them. Mirrors the Production Office's unlock-milestone + tiered-
// upgrade shape (data/producers.ts), one facility over.
import type { Genre } from '../types';

export const DISTRIBUTION_ARM_MAX_TIER = 3;

// Unlock is earned, not bought - a studio has to prove itself before the
// exhibitor relationships a self-distribution operation needs exist. Set a
// notch beyond the Production Office's own milestone (a later-game facility).
export const DISTRIBUTION_ARM_UNLOCK_FILMS_RELEASED = 4;
export const DISTRIBUTION_ARM_UNLOCK_BRAND = 45;

// Cash cost to *reach* each tier above the unlock. Tier 1 is the unlock itself
// (milestone-gated, not bought) - the studio stands up its own distribution.
export const DISTRIBUTION_ARM_UPGRADE_COST_BY_TIER: Record<number, number> = { 2: 3_000_000, 3: 7_000_000 };

// The Wide-release availability *ceiling* self-distribution can command at each
// arm tier, before the market (marketing spend + Brand, engine's own
// releaseStrength) decides how much of that ceiling actually lands. Tier 3
// matches the engine's full-Wide ceiling (0.95); a fledgling operation can't
// book every screen in the country on day one.
export const SELF_DISTRIBUTION_WIDE_CEILING_BY_TIER: Record<number, number> = { 1: 0.72, 2: 0.85, 3: 0.95 };

// --- Distributor offers (the early-game path onto Wide screens) -------------
// A studio that can't self-distribute a Wide release is pitched a few competing
// distributor offers (engine/distribution.ts:generateDistributorOffers). Terms
// are driven by the film's commercial appeal and the studio's brand: a
// distributor competes harder for a film it believes in (lower fee, wider
// release, bigger committed campaign). All numbers here are the tunable knobs;
// the engine does the interpolation.

/** The distributor's fee, as a fraction of the studio's *rentals* (domestic box-office keep). Real-world distribution fees are 10-35% of rentals; a low-appeal film with a no-name studio pays the top, a can't-miss film with a strong brand the floor. */
export const DISTRIBUTOR_FEE_RANGE = { min: 0.1, max: 0.35 };

/** The Wide screen ceiling a distributor offers, by the film's commercial appeal. A weak film opens narrow even Wide; a blockbuster gets near-saturation. */
export const DISTRIBUTOR_BREADTH_RANGE = { min: 0.55, max: 0.92 };

/** The P&A (marketing) budget a distributor commits and fronts, by commercial appeal - what they judge the film's commercial power commands. Recouped in full off the studio's gross. */
export const DISTRIBUTOR_PANDA_RANGE = { min: 3_000_000, max: 60_000_000 };

/** How much a distributor's read blends the film's own appeal with the studio's brand (the rest). Fee keys on this blend (reputation matters at the negotiating table); breadth and P&A key on raw film appeal (screens and spend follow the film). */
export const DISTRIBUTOR_BRAND_WEIGHT = 0.4;

/** The all-in production budget (talent + below-the-line) that reads as a "full commercial scale" signal when assessing appeal. Films at/above this contribute the max scale term. */
export const COMMERCIAL_SCALE_REFERENCE = 90_000_000;

/**
 * Per-archetype shaping of the base terms, so the 2-3 offers are a real
 * tradeoff rather than three copies. A *major* buys the widest release and the
 * biggest campaign but charges the steepest fee; a *boutique* takes a much
 * smaller cut for a narrower, cheaper release; *balanced* sits between. Fee
 * deltas are added to the base fee (then clamped to the range); breadth/P&A are
 * multipliers on the base.
 */
export const DISTRIBUTOR_ARCHETYPES = {
  major: { label: 'Major', feeDelta: 0.05, breadthMult: 1.0, pAndAMult: 1.3 },
  balanced: { label: 'Balanced', feeDelta: 0.0, breadthMult: 0.9, pAndAMult: 1.0 },
  boutique: { label: 'Boutique', feeDelta: -0.06, breadthMult: 0.72, pAndAMult: 0.55 },
} as const;

/** Cosmetic distributor names, drawn (deterministically per film) for the offer cards. */
export const DISTRIBUTOR_NAMES: readonly string[] = [
  'Meridian Pictures',
  'Atlas Releasing',
  'Silver Lake Distribution',
  'Empire Theatrical',
  'Northstar Films',
  'Coastline Releasing',
  'Vanguard Pictures',
  'Lighthouse Distribution',
  'Monarch Releasing',
  'Redwood Pictures',
];

// --- Domestic / International box-office split -----------------------------
// The audience simulation produces one *worldwide* gross (its addressable pool
// stands in for the whole worldwide audience - engine/audienceSimulationInputs.ts).
// The split below partitions that worldwide gross into a domestic (home-market)
// half a studio always earns, and an international half it only realises once it
// builds International Distribution on the Distribution Arm. First pass: this is
// purely an accounting split - the demand simulation itself is untouched.

/**
 * The share of a film's worldwide gross that comes from overseas, by genre.
 * Spectacle-driven genres travel (Action/Sci-Fi/Fantasy); dialogue- and
 * culture-dependent ones lean domestic (Comedy the least travelled). First
 * pass keys on genre only; engine/distribution.ts:computeInternationalAppeal is
 * the film-level seam that will later fold in scale/spectacle/cast reach/etc.
 * Kept strictly below 1 so a film always has a domestic half.
 */
export const GENRE_INTERNATIONAL_APPEAL: Record<Genre, number> = {
  Action: 0.62,
  'Sci-Fi': 0.62,
  Fantasy: 0.6,
  Thriller: 0.55,
  Horror: 0.52,
  Romance: 0.5,
  Drama: 0.45,
  Comedy: 0.38,
};

export const INTERNATIONAL_DISTRIBUTION_MAX_TIER = 3;

/**
 * How much of the international pool a studio's International Distribution track
 * reaches, by tier. Tier 0 is the hard gate - a studio with no international
 * distribution earns *no* international box office. The progression front-loads
 * the first tier (the leap from no overseas presence to a real one) then tapers.
 * Deliberately NOT modified by Brand this pass (see engine/distribution.ts) - a
 * displayed "100% reach" tier genuinely means 100%.
 */
export const INTERNATIONAL_REACH_BY_TIER: Record<number, number> = { 0: 0, 1: 0.4, 2: 0.7, 3: 1.0 };

/** Cash cost to *reach* each international tier (every tier is bought - unlike the arm's own tier 1, which is the milestone unlock). Requires the base Distribution Arm first. */
export const INTERNATIONAL_UPGRADE_COST_BY_TIER: Record<number, number> = { 1: 2_500_000, 2: 5_000_000, 3: 10_000_000 };

// Per-market studio keep shares - the old blended worldwide keep (0.42) split
// into a domestic half that keeps a little more and an international half that
// keeps less (more middlemen/sales agents abroad). Calibrated so a full-reach
// studio's blended keep lands near the old 0.42 across the genre-appeal range:
//   blended = (1 - appeal) * DOMESTIC_KEEP_SHARE + appeal * INTERNATIONAL_KEEP_SHARE
// e.g. appeal 0.38 (Comedy) -> ~0.430, appeal 0.62 (Action) -> ~0.410, the
// average genre (~0.53 appeal) -> ~0.418. Domestic-heavy films retain slightly
// more efficiently, international-heavy ones slightly less - intentional.
export const DOMESTIC_KEEP_SHARE = 0.46;
export const INTERNATIONAL_KEEP_SHARE = 0.38;
