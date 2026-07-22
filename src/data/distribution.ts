// Distribution Arm facility tuning (the studio's own theatrical distribution
// operation). Pure numbers; engine/distribution.ts reads them and the reducer
// applies them. Mirrors the Production Office's unlock-milestone + tiered-
// upgrade shape (data/producers.ts), one facility over.

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
