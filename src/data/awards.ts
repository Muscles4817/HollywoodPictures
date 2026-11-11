// Tuning data for Awards Season (docs/DESIGN_REVIEW_awards_season.md). Pure
// numbers; the logic that reads them lives in engine/awards.ts. Rebalance here
// without touching the engine.
import type { AwardCategory } from '../types';

// The Academy's own 11 categories - the flagship set, and the canonical
// "unsplit" categories every other show's results map back onto.
export const AWARD_CATEGORIES: readonly AwardCategory[] = [
  'best-picture',
  'best-director',
  'best-screenplay',
  'best-actor',
  'best-actress',
  'best-supporting-actor',
  'best-supporting-actress',
  'best-cinematography',
  'best-film-editing',
  'best-original-score',
  'best-visual-effects',
  'best-production-design',
];

// Every category any show can award, in a stable display order (the Academy
// set, then the Globes' Drama/Comedy splits). The UI renders whichever of
// these a given ceremony actually contains.
export const ALL_AWARD_CATEGORIES: readonly AwardCategory[] = [
  ...AWARD_CATEGORIES,
  'best-picture-drama',
  'best-picture-comedy',
  'best-actor-drama',
  'best-actor-comedy',
  'best-actress-drama',
  'best-actress-comedy',
];

// Player-facing names, so the UI never hardcodes copy.
export const AWARD_CATEGORY_LABEL: Record<AwardCategory, string> = {
  'best-picture': 'Best Picture',
  'best-director': 'Best Director',
  'best-screenplay': 'Best Screenplay',
  'best-actor': 'Best Actor',
  'best-actress': 'Best Actress',
  'best-supporting-actor': 'Best Supporting Actor',
  'best-supporting-actress': 'Best Supporting Actress',
  'best-cinematography': 'Best Cinematography',
  'best-film-editing': 'Best Film Editing',
  'best-original-score': 'Best Original Score',
  'best-visual-effects': 'Best Visual Effects',
  'best-production-design': 'Best Production Design',
  'best-picture-drama': 'Best Picture — Drama',
  'best-picture-comedy': 'Best Picture — Musical/Comedy',
  'best-actor-drama': 'Best Actor — Drama',
  'best-actor-comedy': 'Best Actor — Musical/Comedy',
  'best-actress-drama': 'Best Actress — Drama',
  'best-actress-comedy': 'Best Actress — Musical/Comedy',
};

// How much each category counts toward payoffs (Best Picture is the big one;
// the majors weigh more than the crafts). Also scales the box-office bump. A
// split category weighs the same as its unsplit equivalent.
export const AWARD_CATEGORY_WEIGHT: Record<AwardCategory, number> = {
  'best-picture': 1.0,
  'best-director': 0.7,
  'best-screenplay': 0.7,
  'best-actor': 0.7,
  'best-actress': 0.7,
  'best-supporting-actor': 0.55,
  'best-supporting-actress': 0.55,
  'best-cinematography': 0.4,
  'best-film-editing': 0.4,
  'best-original-score': 0.4,
  'best-visual-effects': 0.4,
  'best-production-design': 0.4,
  'best-picture-drama': 1.0,
  'best-picture-comedy': 1.0,
  'best-actor-drama': 0.7,
  'best-actor-comedy': 0.7,
  'best-actress-drama': 0.7,
  'best-actress-comedy': 0.7,
};

// --- Precursor momentum (engine/awards.ts) --------------------------------
// A film/performer that lands at the earlier shows carries that momentum into
// every later ceremony, culminating at the Academy Awards. Real awards-season
// bandwagoning - a Globes + BAFTA sweep makes an Oscar far likelier - without
// ever letting momentum alone beat a genuinely stronger contender (the 0-100
// merit term dwarfs the cap).

/** Award-score points a nomination / win at one precursor adds toward its Academy-equivalent category, before the show's own momentumWeight and the category weight. */
export const MOMENTUM_NOMINATION = 1.5;
export const MOMENTUM_WIN = 4;

/** The most accumulated precursor momentum any single contender can carry into a later ceremony. */
export const MOMENTUM_CAP = 12;

/** Nominees per category (fewer if the field is smaller). */
export const NOMINEES_PER_CATEGORY = 5;

// --- Timing ---------------------------------------------------------------

/** Days into the new year the ceremony resolves (year-N films, ceremony early N+1). */
export const CEREMONY_DELAY_DAYS = 45;

// --- Award scoring (engine/awards.ts) -------------------------------------
// awardScore = meritTerm + prestigeNudge + campaignBoost + jitter, on a 0-100
// merit scale. The merit term dominates; the rest only reorder close races.

/** A small benefit-of-the-doubt from the film's studio Prestige: min(cap, prestige * factor). */
export const PRESTIGE_NUDGE_FACTOR = 0.03;
export const PRESTIGE_NUDGE_CAP = 3;

/** Bounded random reorder: awardScore gains a value in [-JITTER, +JITTER]. Small, so upsets stay near-ties. */
export const AWARD_JITTER_MAGNITUDE = 4;

// Campaign: boost = CAMPAIGN_MAX * (1 - e^(-spend / CAMPAIGN_SCALE)) - smooth
// diminishing returns, capped, so money sways a genuine contender but can't
// manufacture a nomination (the 0-100 merit term dwarfs it at the extremes).
export const CAMPAIGN_MAX = 8;
export const CAMPAIGN_SCALE = 2_000_000;

// --- Payoff (engine/awards.ts, applied by the reducer) --------------------

/** Prestige added per nomination / win, multiplied by the category weight. */
export const NOMINATION_PRESTIGE = 1.2;
export const WIN_PRESTIGE = 4;

/** Brand added per win only (wins are commercial cachet), multiplied by category weight. */
export const WIN_BRAND = 2;

// Box-office "awards lift": a one-time credit standing in for the extra
// business recognition brings a film - a fraction of what the film had earned
// the studio by ceremony day, scaled by its award haul and capped, then by how
// much awards attention could actually still do for it (the two tables below).
export const NOMINATION_BUMP_FRACTION = 0.03;
export const WIN_BUMP_FRACTION = 0.12;
export const BUMP_CAP_FRACTION = 0.4;

// Awards do not pay prize money. What they are worth at the box office depends
// on whether the film is still there to benefit (docs/domain/13 §1.1): a Best
// Picture nomination lifts the remaining gross of a platform release by 30% to
// 100% or more, a played-out drama by 10-25%, and a tentpole by about nothing.
// Paid on a film's whole run regardless, the lift was GBP 320-390M over a
// Mid-Major career, 15-20% of all its income
// (docs/DESIGN_REVIEW_player_economy.md §4). The lasting value of awards to a
// film that has left cinemas is its after-market premium (engine/ancillary.ts:
// awardsLift), which is modelled separately and untouched by this.

/** How far awards attention can move a film's box office, by how broadly it was released. A wide release has already reached its audience. */
export const AWARDS_LIFT_BY_RELEASE: Record<'platform' | 'wide', number> = { platform: 1, wide: 0.1 };

/** ...and by whether it was still in cinemas on ceremony day: playing, recently gone (a re-release is worth mounting), or long gone. */
export const AWARDS_LIFT_STILL_PLAYING = 1;
export const AWARDS_LIFT_RECENTLY_CLOSED = 0.5;
export const AWARDS_LIFT_LONG_CLOSED = 0.2;
/** A film that left cinemas within this many days of the ceremony counts as recently closed. */
export const AWARDS_LIFT_RECENT_DAYS = 90;
