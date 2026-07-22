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

// Renting a major's distribution (the early-game escape hatch): a fixed, decent
// screen ceiling that's always available without owning an arm - but the
// distributor takes a cut of the studio's box-office keep as its fee.
export const RENTED_WIDE_CEILING = 0.8;
/** The distributor's fee, as the fraction of the studio's normal box-office keep it leaves you (0.72 => the distributor takes ~28%). */
export const RENTED_DISTRIBUTION_KEEP_MULTIPLIER = 0.72;

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
