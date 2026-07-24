import type {
  Film,
  MarketingChoices,
  Opportunity,
  Person,
  PostProductionChoices,
  ProductionChoices,
  ProductionRole,
  ProductionScale,
  RivalProductionInProgress,
  RivalStudio,
  Script,
  StudioTier,
  TalentAssignment,
  TalentProfession,
} from '../types';
import { RIVAL_STUDIO_NAMES_BY_TIER } from '../data/rivalStudioNames';
import { MANDATORY_TALENT_ROLES, ROLE_GENERATION_PROFILES } from '../data/talentGeneration';
import { professionForProductionRole } from '../data/helpers';
import { isPersonAvailableOnDay, withCommitment } from './person';
import { effectiveRoleCapacity, characterForRoleSlot } from './castRequirements';
import { computeRecommendedShootDays, computeRecommendedPostProductionDays } from './production';
import { resolveRivalExecution } from './rivalExecution';
import { computeReleaseResults } from './releaseFilm';
import { internationalReachForRivalStudio } from './distribution';
import { computeDailyContingencyBurn, computeMarketingCost, computeProductionBudgetCost, computeTalentCost } from './cost';
import { highestBid, placeBid, reopenForfeitedOpportunity, type ResolvedBid } from './opportunities';
import { findCandidatesNearPrice } from './talentFilter';
import { logAmount } from './interpolate';
import { GENRE_PROFILES } from '../data/genres';
import { SHOOTING_BUDGET_RANGE, ENVIRONMENT_BUDGET_RANGE, PRACTICAL_EFFECTS_RANGE, VFX_RANGE } from '../data/production';
import { EDIT_STYLE_PROFILES, MUSIC_FOCUS_PROFILES, FINAL_CUT_FOCUS_PROFILES } from '../data/postProduction';
import { RELEASE_TYPE_PROFILES, MARKETING_SPEND_RANGE } from '../data/release';
import { clamp, pick, pickMany, randFloat, randInt, weightedPick, type RandomFn } from './random';
import { deriveReleaseWindowFromDay } from './calendar';
import { computeCompetitiveCrowding, computeRivalReleaseStrength, type UpcomingRelease } from './releaseCrowding';

const EDIT_STYLES = Object.keys(EDIT_STYLE_PROFILES) as PostProductionChoices['editStyle'][];
const MUSIC_FOCI = Object.keys(MUSIC_FOCUS_PROFILES) as PostProductionChoices['musicFocus'][];
const FINAL_CUT_FOCI = Object.keys(FINAL_CUT_FOCUS_PROFILES) as PostProductionChoices['finalCutFocus'][];
const RELEASE_TYPES = Object.keys(RELEASE_TYPE_PROFILES) as MarketingChoices['releaseType'][];

// How a rival picks its release type - by the film's SCALE, the way a real
// studio's does, rather than the uniform coin flip this used to be. A
// Big-budget tentpole goes out Wide (that's what all the spend is for); a Small
// film is far likelier to platform via a cheaper Limited run or a Festival First
// prestige play. Some randomness is retained (a rival isn't perfectly
// predictable), but a blockbuster no longer randomly opens in ten theaters.
// Weights are relative, not probabilities - weightedPick normalises by their
// sum (engine/random.ts).
const RELEASE_TYPE_WEIGHTS_BY_SCALE: Record<ProductionScale, Partial<Record<MarketingChoices['releaseType'], number>>> = {
  Big: { Wide: 88, Limited: 8, 'Festival First': 4 },
  Medium: { Wide: 60, Limited: 25, 'Festival First': 15 },
  Small: { Wide: 22, Limited: 46, 'Festival First': 32 },
};

/** A rival's release type, weighted toward what makes sense for the film's scale (see RELEASE_TYPE_WEIGHTS_BY_SCALE). Exported for tests. */
export function releaseTypeForScale(scale: ProductionScale, rng: RandomFn): MarketingChoices['releaseType'] {
  return weightedPick(rng, RELEASE_TYPES, RELEASE_TYPE_WEIGHTS_BY_SCALE[scale]);
}

// A rival never actually runs a post-production/marketing pipeline of its
// own - resolveRivalProduction below settles it instantly the moment
// releaseDay arrives - so this is only ever used to keep a rival's naive
// pacing (naiveReleaseDay below) realistic relative to how long the
// player's own equivalent film would take. Post-Production Redesign, Phase
// C retired the flat STAGE_DURATIONS.post-production/.marketing charges
// this used to sum (data/schedule.ts) - a rival's own post-production
// stretch is now estimated the same real way the player's is
// (computeRecommendedPostProductionDays, engine/production.ts), so a
// skilled-Editor rival isn't stuck with the same flat number as everyone
// else. Marketing's own pacing stays a flat constant here, same "simplest
// thing that fits" call the design review makes for the player's own
// marketing pacing (docs/DESIGN_REVIEW_post_production_redesign.md section 3).
const RIVAL_MARKETING_LEAD_DAYS = 30;

/**
 * The day a rival production's marketing rollout goes public - production and
 * post-production have wrapped and the campaign begins, the rival's analogue of
 * the player committing a campaign at SCHEDULE_RELEASE. Until this day the
 * film's title and cast are under wraps (a "secret" project the player only
 * knows the scale/genre/studio/timing of); from here on they're announced,
 * exactly as a real studio reveals a title and cast once it starts marketing.
 * Reads the frozen campaignStartDay when present, falling back to a lead-time
 * window before release for productions that predate it (no save migration).
 */
export function rivalCampaignStartDay(production: RivalProductionInProgress): number {
  return production.marketingChoices.campaignStartDay ?? production.releaseDay - RIVAL_MARKETING_LEAD_DAYS;
}

/** Whether a rival's marketing rollout has begun as of `today` - i.e. whether its real title and cast are now public (see rivalCampaignStartDay). */
export function rivalReleaseIsAnnounced(production: RivalProductionInProgress, today: number): boolean {
  return today >= rivalCampaignStartDay(production);
}

// Where a production's target price (0-1, log-scale) lands based on its
// scale - governs both casting price and production spend, same way the
// player's own sliders do.
// Big's band is lifted (0.65-0.98 -> 0.75-1.0) so a Major's tentpoles cluster
// nearer the top of the log-scale budget ranges - the ranges themselves
// already reach genuine tentpole figures (VFX alone up to £150M), the AI just
// wasn't reaching for them often. Pushes the average Big budget up toward real
// blockbuster scale without touching Small/Medium. See
// docs/DESIGN_REVIEW_ai_studio_behavior.md "Reality check".
const SCALE_SPEND_RANGE: Record<ProductionScale, [number, number]> = {
  Small: [0.08, 0.32],
  Medium: [0.32, 0.65],
  Big: [0.75, 1.0],
};

// How the production scale nudges a rival's VFX-Supervisor hire probability on
// top of the genre's own vfxImportance: a Big-scale tentpole staffs a VFX lead
// as a matter of course, a Small-scale film slightly less often than its genre
// baseline. See rivalHiresVfxSupervisor.
const VFX_HIRE_SCALE_ADJUSTMENT: Record<ProductionScale, number> = { Small: -0.05, Medium: 0, Big: 0.15 };

/**
 * Whether a rival attaches a VFX Supervisor to this production. The role is
 * optional for the player too (min 0, hired per film); a rival mirrors that by
 * rolling against the genre's own vfxImportance - a Sci-Fi/Action/Fantasy
 * tentpole almost always has a VFX lead, a Drama or Romance almost never -
 * nudged by scale (VFX_HIRE_SCALE_ADJUSTMENT) and capped below 1 so it's never
 * a certainty. Before this, rivals only ever cast MANDATORY_TALENT_ROLES, so no
 * rival film ever had a VFX Supervisor and Best Visual Effects had no rival
 * contenders at all (docs/DESIGN_REVIEW_ai_studio_awards_analysis.md).
 */
function rivalHiresVfxSupervisor(script: Script, scale: ProductionScale, rng: RandomFn): boolean {
  const probability = clamp(GENRE_PROFILES[script.genre].vfxImportance + VFX_HIRE_SCALE_ADJUSTMENT[scale], 0, 0.95);
  return randFloat(rng, 0, 1) < probability;
}

interface RivalSpendPlan {
  talentSpendT: number;
  shootingSpendT: number;
  environmentSpendT: number;
  practicalSpendT: number;
  vfxSpendT: number;
  marketingSpendT: number;
  runtimeIntensity: number;
}

function jitter(
  rng: RandomFn,
  value: number,
  amount = 0.06,
): number {
  return clamp(
    value + randFloat(rng, -amount, amount),
    0,
    1,
  );
}

function deriveRivalSpendPlan(
  rival: RivalStudio,
  scale: ProductionScale,
  script: Script,
  rng: RandomFn,
): RivalSpendPlan {
  const [minSpend, maxSpend] = SCALE_SPEND_RANGE[scale];

  // One broad ambition roll still exists, but it no longer controls every
  // department identically.
  const baseSpendT = randFloat(rng, minSpend, maxSpend);

  const genreProfile = GENRE_PROFILES[script.genre];
  const complexityT = script.complexity / 100;

  const tierAdjustment: Record<StudioTier, number> = {
    Indie: -0.06,
    'Mid-Size': 0,
    Major: 0.08,
  };

  const adjustedBase = clamp(
    baseSpendT + tierAdjustment[rival.tier],
    0,
    1,
  );

  const talentFocusedGenres = new Set([
    'Drama',
    'Comedy',
    'Romance',
    'Thriller',
  ]);

  const spectacleGenres = new Set([
    'Action',
    'Fantasy',
    'Sci-Fi',
  ]);

  const practicalFriendlyGenres = new Set([
    'Action',
    'Horror',
    'Thriller',
  ]);

  const talentGenreBonus = talentFocusedGenres.has(script.genre)
    ? 0.10
    : 0;

  const spectacleGenreBonus = spectacleGenres.has(script.genre)
    ? 0.08
    : 0;

  const practicalGenreBonus = practicalFriendlyGenres.has(script.genre)
    ? 0.06
    : 0;

  // Indies concentrate more of their limited resources into people.
  // Majors are more willing to pay for recognisable/high-end talent.
  const talentTierBonus =
    rival.tier === 'Indie'
      ? 0.06
      : rival.tier === 'Major'
        ? 0.10
        : 0;

  const talentSpendT = jitter(
    rng,
    adjustedBase + talentGenreBonus + talentTierBonus,
  );

  // Complex scripts and large productions require more shooting resource.
  const shootingSpendT = jitter(
    rng,
    adjustedBase +
      (complexityT - 0.5) * 0.16 +
      (scale === 'Big' ? 0.06 : 0),
  );

  // Environment spend loosely follows scale, complexity and spectacle.
  const environmentSpendT = jitter(
    rng,
    adjustedBase +
      spectacleGenreBonus +
      (complexityT - 0.5) * 0.12,
  );

  // Genre profiles already describe how important practical effects are.
  const practicalSpendT = jitter(
    rng,
    adjustedBase +
      (genreProfile.practicalEffectsImportance - 0.5) * 0.30 +
      practicalGenreBonus,
  );

  // Likewise, VFX spend should respond directly to the genre's VFX needs.
  const vfxSpendT = jitter(
    rng,
    adjustedBase +
      (genreProfile.vfxImportance - 0.5) * 0.38 +
      spectacleGenreBonus,
  );

  // Majors market aggressively; Indies are more conservative.
  // Blockbuster-friendly genres also justify broader campaigns.
  const marketingTierAdjustment =
    rival.tier === 'Indie'
      ? -0.12
      : rival.tier === 'Major'
        ? 0.14
        : 0;

  const marketingSpendT = jitter(
    rng,
    adjustedBase +
      marketingTierAdjustment +
      spectacleGenreBonus,
  );

  // More complex and larger films tend toward greater runtime ambition.
  // Still imperfect: this is an AI preference, not an optimal answer.
  const runtimeIntensity = jitter(
    rng,
    0.38 +
      complexityT * 0.35 +
      (scale === 'Big' ? 0.12 : 0) -
      (scale === 'Small' ? 0.08 : 0),
    0.08,
  );

  return {
    talentSpendT,
    shootingSpendT,
    environmentSpendT,
    practicalSpendT,
    vfxSpendT,
    marketingSpendT,
    runtimeIntensity,
  };
}

// How often (in days) each studio tier attempts to start a new production,
// once it has spare capacity - a Major has more going on at once, so it
// checks more often; an Indie's single film takes a while to turn around.
const SPAWN_CHECK_INTERVAL_DAYS: Record<StudioTier, [number, number]> = {
  Indie: [20, 40],
  'Mid-Size': [15, 30],
  Major: [10, 20],
};

// Doubled from the original six-studio roster (2/2/2) to twelve (4/4/4) so the
// weekly chart and Opportunity Market are contested by a fuller field of AI
// competitors - the shared talentPool has comfortable headroom for it (see
// docs/DESIGN.md 5.24).
const INITIAL_ROSTER_TIERS: StudioTier[] = [
  'Indie', 'Indie', 'Indie', 'Indie',
  'Mid-Size', 'Mid-Size', 'Mid-Size', 'Mid-Size',
  'Major', 'Major', 'Major', 'Major',
];

// Milestone: AI Studios 2.0 - starting cash per tier. Calibrated against a
// scratch diagnostic sampling real total-commitment costs (script + talent +
// production budget + contingency + marketing + test screening, the same
// formula startRivalProduction's affordability check uses below) across 20
// productions per scale from the real generation functions: Small averaged
// ~£1.5M (range £0.95M-£2.7M), Medium ~£8.3M (£2.9M-£17.5M), Big ~£70M
// (£20M-£172M, log-scale spend ranges make the top of Big genuinely
// blockbuster-priced). Set generously above what each tier's normal cadence
// needs (Indie only ever runs one Small at a time; Mid-Size one Big OR up to
// three Medium; Major up to two Big and four Medium at once) so the
// affordability gate rarely binds in ordinary play - occasional throttling
// right after a fresh game start, before any box-office revenue has come in
// and a tier is attempting to fill every production slot at once, is
// expected and intentional (see this milestone's "Cash Recovery" note in
// docs/DESIGN.md), not a bug to tune away.
// Major raised 180M -> 260M alongside the lifted Big spend band above: a
// tentpole now clusters nearer the top of the budget ranges (talent alone
// averages ~£27M, total commitment can approach £200M), so the bump keeps a
// Major able to carry two concurrent Big films once box-office revenue starts
// flowing, rather than the second Big waiting on cash. It's headroom, not a
// throughput lever - the 6-year Big-vs-Medium share is governed by
// production-slot and shoot-length dynamics, not this float (verified via
// engine/rivalStudios.diagnostic.test.ts: the bump barely moves the mix).
const STARTING_CASH_BY_TIER: Record<StudioTier, number> = {
  Indie: 6_000_000,
  'Mid-Size': 40_000_000,
  Major: 260_000_000,
};

// Flavor, not balance - a Major studio has already been making films for
// years before the player's own studio exists, so it starts already
// meaningfully known and respected, unlike the player's own fresh
// Studio.brand/prestige (both 20, gameState.ts:createInitialStudio) or a
// brand-new Indie rival. Both still grow/fall from the same
// computeBrandChange/computePrestigeChange formulas as any other studio
// (see resolveRivalProduction/settleRivalBoxOffice below) - this is only
// the starting point.
const STARTING_BRAND_BY_TIER: Record<StudioTier, number> = { Indie: 25, 'Mid-Size': 45, Major: 70 };
const STARTING_PRESTIGE_BY_TIER: Record<StudioTier, number> = { Indie: 25, 'Mid-Size': 40, Major: 55 };

// Roadmap Phase 7.4, upgraded for Phase 1 of release scheduling
// competition: a new production nudges its naive release day forward, one
// day at a time, while computeCompetitiveCrowding scores it above this
// threshold against the shared calendar (the player's own scheduled
// projects and every other rival's own in-progress production) - genre/
// audience-weighted now, not just date-proximity. Deliberately small and
// deterministic (no rng spent on it) - just enough that a rival steers away
// from genuinely stiff competition, without trying to actually optimize
// the calendar. First-draft, tunable alongside engine/releaseCrowding.ts's
// own constants.
const MAX_ACCEPTABLE_CROWDING = 0.35;
const MAX_RELEASE_DAY_NUDGES = 14;

/**
 * Pushes `naiveDay` forward past any day that scores above
 * MAX_ACCEPTABLE_CROWDING against `known` - see startRivalProductionFromWonScript
 * below. Pure and rng-free by design: the release-day choice stays fully
 * deterministic given the same inputs, same as everything else about when
 * a rival's production starts.
 */
function avoidCrowdedReleaseDay(
  naiveDay: number,
  candidate: Omit<UpcomingRelease, 'strength' | 'releaseDay'>,
  known: UpcomingRelease[],
): number {
  let day = naiveDay;
  let nudges = 0;
  while (computeCompetitiveCrowding({ releaseDay: day, ...candidate }, known) > MAX_ACCEPTABLE_CROWDING && nudges < MAX_RELEASE_DAY_NUDGES) {
    day += 1;
    nudges += 1;
  }
  return day;
}

/** A RivalProductionInProgress reduced to what computeCompetitiveCrowding needs - see engine/releaseCrowding.ts:UpcomingRelease. Exported for components/wizard/MarketingRelease.tsx, which needs the same conversion to preview crowding before a release is actually scheduled - one formula, not two independent implementations. */
export function rivalAsUpcomingRelease(p: RivalProductionInProgress): UpcomingRelease {
  return {
    releaseDay: p.releaseDay,
    genre: p.genre,
    targetAudience: p.targetAudience,
    strength: computeRivalReleaseStrength(p.marketingChoices.marketingSpend, p.scale),
  };
}

/** Generates the persistent roster of AI competitors once, at game start - see docs/DESIGN.md 5.24. Each studio is named after a real-world studio drawn from its own tier's pool (data/rivalStudioNames.ts), without replacement, so no two rivals ever share a name and a Major reads like a real major, an Indie like a real independent. */
export function generateRivalStudios(rng: RandomFn): RivalStudio[] {
  const remainingNamesByTier: Record<StudioTier, string[]> = {
    Indie: [...RIVAL_STUDIO_NAMES_BY_TIER.Indie],
    'Mid-Size': [...RIVAL_STUDIO_NAMES_BY_TIER['Mid-Size']],
    Major: [...RIVAL_STUDIO_NAMES_BY_TIER.Major],
  };
  return INITIAL_ROSTER_TIERS.map((tier, i) => {
    const pool = remainingNamesByTier[tier];
    const name = pool.length > 0 ? pool.splice(randInt(rng, 0, pool.length - 1), 1)[0] : `Rival Studio ${i + 1}`;
    return {
      id: `rival-studio-${i}`,
      name,
      tier,
      nextSpawnCheckDay: 1 + randInt(rng, 0, SPAWN_CHECK_INTERVAL_DAYS[tier][1]),
      cash: STARTING_CASH_BY_TIER[tier],
      brand: STARTING_BRAND_BY_TIER[tier],
      prestige: STARTING_PRESTIGE_BY_TIER[tier],
      lifetimeRevenue: 0,
      lifetimeExpenditure: 0,
    };
  });
}

function countByScale(productions: RivalProductionInProgress[]): Record<ProductionScale, number> {
  return {
    Small: productions.filter((p) => p.scale === 'Small').length,
    Medium: productions.filter((p) => p.scale === 'Medium').length,
    Big: productions.filter((p) => p.scale === 'Big').length,
  };
}

/**
 * Which scales a studio could start a new production at right now, given
 * what it already has in progress - see docs/DESIGN.md 5.24 for the
 * reasoning behind each tier's numbers. A Mid-Size studio is genuinely
 * either/or: once it has any Medium running it can't pivot to a Big until
 * those wrap, and vice versa - it doesn't juggle both scales at once the
 * way a Major does.
 */
export function startableScales(tier: StudioTier, current: RivalProductionInProgress[]): ProductionScale[] {
  const counts = countByScale(current);
  if (tier === 'Indie') {
    return counts.Small === 0 ? ['Small'] : [];
  }
  if (tier === 'Mid-Size') {
    const scales: ProductionScale[] = [];
    if (counts.Big === 0 && counts.Medium < 3) scales.push('Medium');
    if (counts.Big === 0 && counts.Medium === 0) scales.push('Big');
    return scales;
  }
  // Major: both pools are independent and run simultaneously.
  const scales: ProductionScale[] = [];
  if (counts.Medium < 4) scales.push('Medium');
  if (counts.Big < 2) scales.push('Big');
  return scales;
}

// Milestone: Opportunity Market bidding - rivals no longer generate their
// own scripts (engine/scriptGenerator.ts is untouched, but this module no
// longer calls it directly). A rival's own "decide to make a film" and
// "have the script" moments are no longer atomic the way direct generation
// let them be, since the script now has to actually be won from the shared
// Opportunity pool first - see considerBiddingOnOpportunity (Phase 1,
// still on the existing per-tier spawn-check cadence) and
// startRivalProductionFromWonScript (Phase 2, only reachable once a bid has
// actually won, at the next weekly market tick - see
// engine/opportunities.ts:settleOpportunities). No fallback to direct
// generation if the market has nothing suitable - the rival just skips this
// attempt and tries again next check, same as a talent-pool shortage
// already does below.

/** Rough heuristic cap on how much of a rival's *current* cash it's willing to put toward a script bid, leaving room for the rest of the production - re-validated for real (against the actual cast/budget once known) at Phase 2. Not a precise budget split, deliberately - script cost has always been a small slice of total spend (docs/COST_REPORT_film_production.md §1 vs §8). Scaled by the same SCALE_SPEND_RANGE `spendT` position production budget levels already use, so a Small-scale attempt doesn't reach for a Big-scale-priced script just because the studio happens to be cash-rich, and vice versa. */
const SCRIPT_BUDGET_FRACTION = 0.15;
/** How much above the floor (the current highest bid, or acquisitionCost if none) a rival is willing to open at. */
const BID_OPENING_PREMIUM_RANGE: [number, number] = [0, 0.15];
/** How much above the current leader a rival raises to, when outbid on its own already-active bid. */
const BID_RAISE_INCREMENT_FRACTION = 0.05;

/** How much a rival is willing to put toward a script bid, for a given scale - see SCRIPT_BUDGET_FRACTION's own doc comment for the reasoning. */
function scriptBudget(rival: RivalStudio, scale: ProductionScale, rng: RandomFn): number {
  const spendT = randFloat(rng, ...SCALE_SPEND_RANGE[scale]);
  return rival.cash * SCRIPT_BUDGET_FRACTION * spendT;
}

/**
 * Phase 1: decide whether this rival wants to bid on something this spawn
 * check, and how much - never starts a production directly, just places
 * (engine/opportunities.ts:placeBid) or raises a bid. Returns null (skip
 * this attempt, try again next check) if the rival already has an active
 * bid outstanding and is still leading it (nothing to do), if it's been
 * outbid but raising would exceed its own rough budget (no formal "abandon"
 * action - it just never raises again, same "purely additive" reasoning
 * engine/opportunities.ts:placeBid's own doc comment uses), or if nothing
 * in the pool fits its target genre/scale/budget at all.
 */

function scriptCraftScore(script: Script): number {
  return (
    script.originality +
    script.structure +
    script.characters +
    script.dialogue
  ) / 4;
}

const GENRE_TIER_BIAS: Record<
  StudioTier,
  Partial<Record<Script['genre'], number>>
> = {
  // Horror leads, just ahead of Drama: real boutiques (Blumhouse, and A24's
  // own Hereditary/Midsommar line) lean on sub-budget horror as their profit
  // engine as much as on prestige drama, and the game's own economics already
  // favour it (Horror.lowBudgetFriendly = 0.9). See
  // docs/DESIGN_REVIEW_ai_studio_behavior.md "Reality check".
  Indie: {
    Horror: 20,
    Drama: 15,
    Thriller: 14,
    Romance: 10,
    Comedy: 4,
    Action: -12,
    Fantasy: -20,
    'Sci-Fi': -16,
  },

  'Mid-Size': {
    Horror: 18,
    Thriller: 16,
    Action: 12,
    Comedy: 10,
    Drama: 4,
    Romance: 4,
    'Sci-Fi': 0,
    Fantasy: -4,
  },

  Major: {
    Action: 18,
    Fantasy: 20,
    'Sci-Fi': 18,
    Comedy: 6,
    Horror: 2,
    Thriller: 4,
    Drama: -6,
    Romance: -6,
  },
};

function genreTierBias(tier: StudioTier, script: Script): number {
  return GENRE_TIER_BIAS[tier][script.genre] ?? 0;
}

function evaluateOpportunityForTier(
  rival: RivalStudio,
  scale: ProductionScale,
  opportunity: Opportunity,
  budget: number,
): number {
  const script = opportunity.script;
  const craft = scriptCraftScore(script);
  const originality = script.originality;
  
  const currentPrice =
    highestBid(opportunity)?.amount ??
    opportunity.acquisitionCost;

  const affordability =
    budget > 0
      ? clamp(100 - (currentPrice / budget) * 100, 0, 100)
      : 0;

  const genreBias = genreTierBias(rival.tier, script);

  let score: number;

  if (rival.tier === 'Indie') {
    score =
      craft * 0.50 +
      originality * 0.30 +
      affordability * 0.20 +
      genreBias;
  } else if (rival.tier === 'Mid-Size') {
    score =
      craft * 0.45 +
      originality * 0.15 +
      affordability * 0.40 +
      genreBias;
  } else {
    score =
      craft * 0.40 +
      originality * 0.10 +
      affordability * 0.20 +
      genreBias;
  }

  // Small productions should be more price-sensitive.
  if (scale === 'Small') {
    score += affordability * 0.10;
  }

  // Majors planning Big films lean harder into blockbuster-friendly genres.
  if (rival.tier === 'Major' && scale === 'Big') {
    score += genreBias * 0.50;
  }

  return score;
}

function considerBiddingOnOpportunity(
  rival: RivalStudio,
  scale: ProductionScale,
  opportunities: Opportunity[],
  totalDays: number,
  rng: RandomFn,
): { opportunityId: string; amount: number } | null {
  const active = opportunities.filter((o) => o.expiresOnDay > totalDays);

  const ownOpportunity = active.find((o) => o.bids.some((b) => b.bidderId === rival.id));
  if (ownOpportunity) {
    const own = ownOpportunity.bids.find((b) => b.bidderId === rival.id)!;
    const leader = highestBid(ownOpportunity)!;
    if (leader.bidderId === rival.id) return null; // still leading - nothing to do
    // Re-checks against the scale it originally bid with (own.scale), not
    // whatever scale this spawn check happens to be considering for a
    // hypothetical new attempt - raising is about defending the one it
    // already wants, not re-targeting.
    const budget = scriptBudget(rival, own.scale ?? scale, rng);
    const raised = Math.round(leader.amount * (1 + BID_RAISE_INCREMENT_FRACTION));
    if (raised > budget) return null; // outbid beyond what it's worth - let it go
    return { opportunityId: ownOpportunity.id, amount: raised };
  }

  const budget = scriptBudget(rival, scale, rng);

  const candidates = active.filter(
    (opportunity) =>
      (highestBid(opportunity)?.amount ??
        opportunity.acquisitionCost) <= budget,
  );

  if (candidates.length === 0) return null;

  const ranked = candidates
    .map((opportunity) => ({
      opportunity,
      score: evaluateOpportunityForTier(
        rival,
        scale,
        opportunity,
        budget,
      ),
    }))
    .sort((a, b) => b.score - a.score);

  const bestScore = ranked[0].score;

  // Do not make the AI perfectly deterministic.
  // Pick among scripts close enough to the best option.
  const competitiveCandidates = ranked.filter(
    (candidate) => candidate.score >= bestScore - 8,
  );

  const chosen = pick(rng, competitiveCandidates).opportunity;
  const floor = highestBid(chosen)?.amount ?? chosen.acquisitionCost;
  const premium = 1 + randFloat(rng, ...BID_OPENING_PREMIUM_RANGE);
  const amount = Math.min(budget, Math.round(floor * premium));
  if (amount < floor) return null; // budget too tight even to meet the floor
  return { opportunityId: chosen.id, amount };
}

/**
 * Phase 2: cast, plan, and actually start a production from a script the
 * rival has just won at a weekly market tick - the same body
 * `startRivalProduction` always had, minus the `generateScriptOptions` call
 * it no longer needs (the script - and its own genre - are already decided,
 * by whichever Opportunity was won). `bidAmount` is what the rival actually
 * pays for the script - usually *less* than the old flat `script.cost`
 * charge, since `acquisitionCost` (what a won bid is floored at) is
 * `script.cost` times a source multiplier that's often under 1 (see
 * engine/opportunities.ts:SOURCE_COST_MULTIPLIER) - rivals now pay what the
 * market actually prices it at, same as the player, not a flat proxy.
 * Returns null (forfeit - the caller reopens the Opportunity, bids cleared)
 * if capacity or cash no longer supports it by the time this runs, same
 * "skip the attempt" shape as every other failure mode here.
 */
function startRivalProductionFromWonScript(
  rival: RivalStudio,
  scale: ProductionScale,
  script: Script,
  bidAmount: number,
  totalDays: number,
  talentPool: Record<TalentProfession, Person[]>,
  knownUpcoming: UpcomingRelease[],
  rng: RandomFn,
): { production: RivalProductionInProgress; talentPool: Record<TalentProfession, Person[]>; cost: number } | null {
  // Assigned up front (not just at the return, the way this used to build
  // its id) so it's available to tag each hire's own commitment with below.
  const productionId = `rival-prod-${rival.id}-${totalDays}-${randInt(rng, 0, 999_999)}`;

  const spendPlan = deriveRivalSpendPlan(
    rival,
    scale,
    script,
    rng,
  );

  // Lead Actor and Supporting Actor both draw from the same shared Actor
  // pool now (used to be two disjoint pools, so no cross-role collision was
  // possible) - bookedIds accumulates across every role processed so far in
  // this loop and is excluded from `available`, so this rival can't cast the
  // same real person as both its own lead and a supporting actor.
  const talent: TalentAssignment[] = [];
  const bookedIds = new Set<string>();
  // VFX Supervisor is optional (min 0), so it lives outside MANDATORY_TALENT_ROLES
  // and rivals used to never cast it at all - no rival film ever had one, which
  // left Best Visual Effects with zero rival contenders (the player won it
  // unopposed every year, see docs/DESIGN_REVIEW_ai_studio_awards_analysis.md).
  // A rival now attaches one when rivalHiresVfxSupervisor rolls true (genre-
  // driven), appended to the cast list so the same loop hires it - one when the
  // pool has a candidate, gracefully none when it's dry (min 0 never blocks).
  const rolesToCast: ProductionRole[] = rivalHiresVfxSupervisor(script, scale, rng)
    ? [...MANDATORY_TALENT_ROLES, 'VFX Supervisor']
    : MANDATORY_TALENT_ROLES;
  for (const role of rolesToCast) {
    const capacity = effectiveRoleCapacity(role, script);
    const profession = professionForProductionRole(role);
    const targetPrice = logAmount(spendPlan.talentSpendT, ROLE_GENERATION_PROFILES[profession].salaryRange);
    const available = talentPool[profession].filter((t) => isPersonAvailableOnDay(t, totalDays) && !bookedIds.has(t.id));
    if (available.length < capacity.min) return null;
    const { candidates } = findCandidatesNearPrice(available, role, targetPrice, Math.max(capacity.max * 3, 6));
    const picked = pickMany(rng, candidates, Math.min(capacity.max, candidates.length));
    if (picked.length < capacity.min) return null;
    for (const p of picked) bookedIds.add(p.id);
    // Bind each actor to the Character at its slot (characterForRoleSlot is
    // null for crew), so rival films carry the same explicit actor<->character
    // link the player's do and score identically (slot-bound casting).
    talent.push(...picked.map((person, i) => {
      const character = characterForRoleSlot(script, role, i);
      return character ? { role, person, characterId: character.id } : { role, person };
    }));
  }

  const productionChoices: ProductionChoices = {
    contingencyAmount: logAmount(
      spendPlan.shootingSpendT,
      SHOOTING_BUDGET_RANGE,
    ),

    setQualityAmount: logAmount(
      spendPlan.environmentSpendT,
      ENVIRONMENT_BUDGET_RANGE,
    ),

    practicalEffectsAmount: logAmount(
      spendPlan.practicalSpendT,
      PRACTICAL_EFFECTS_RANGE,
    ),

    vfxAmount: logAmount(
      spendPlan.vfxSpendT,
      VFX_RANGE,
    ),

    runtimeIntensity: spendPlan.runtimeIntensity,
  };

  // Computed before marketingChoices now (Phase 1 - release scheduling
  // competition) specifically so releaseWindow can be derived from the
  // real releaseDay it ends up on, instead of the two being picked
  // independently - see engine/calendar.ts:deriveReleaseWindowFromDay.
  const recommendedDays = computeRecommendedShootDays(talent, script, productionChoices);
  const postProductionDays = computeRecommendedPostProductionDays(talent, productionChoices);
  const naiveReleaseDay = totalDays + recommendedDays + postProductionDays + RIVAL_MARKETING_LEAD_DAYS;
  // Roadmap Phase 7.4, upgraded for Phase 1 of release scheduling
  // competition: nudges forward while the day is genuinely crowded (genre/
  // audience-weighted, not just date-proximity) instead of just avoiding
  // exact-day clustering - reads the shared calendar (the player's own
  // scheduled releases, every other rival's already-in-progress production)
  // instead of picking a day in a vacuum.
  const releaseDay = avoidCrowdedReleaseDay(naiveReleaseDay, { genre: script.genre, targetAudience: script.intendedAudience }, knownUpcoming);

  const postProductionChoices: PostProductionChoices = {
    editStyle: pick(rng, EDIT_STYLES),
    musicFocus: pick(rng, MUSIC_FOCI),
    finalCutFocus: pick(rng, FINAL_CUT_FOCI),
  };
  const marketingChoices: MarketingChoices = {
    marketingSpend: logAmount(spendPlan.marketingSpendT, MARKETING_SPEND_RANGE),
    releaseType: releaseTypeForScale(scale, rng),
    releaseWindow: deriveReleaseWindowFromDay(releaseDay),
    // Rivals are established majors with full overseas distribution - freeze
    // full international reach so their grosses aren't nerfed by the gate.
    internationalReachFraction: internationalReachForRivalStudio(rival),
    // When this production's marketing rollout goes public: the day the shoot
    // and post wrap (naiveReleaseDay is exactly this plus the marketing lead).
    // The title and cast are announced from here on (rivalReleaseIsAnnounced);
    // before it, the project is under wraps. Purely a reveal anchor - a rival's
    // box office never reads the rollout multiplier (resolveRivalProduction),
    // so its commercial calibration is unchanged.
    campaignStartDay: totalDays + recommendedDays + postProductionDays,
  };

  const cost =
    bidAmount +
    computeTalentCost(talent) +
    computeProductionBudgetCost(productionChoices) +
    productionChoices.contingencyAmount +
    computeMarketingCost(marketingChoices);
  if (cost > rival.cash) return null;

  // Per-assignment, not per-role-then-profession: Lead Actor and Supporting
  // Actor share the same 'Actor' pool, so looping MANDATORY_TALENT_ROLES and
  // updating updatedPool[profession] each time would visit that pool twice
  // and double up every actor's commitment. Each TalentAssignment already
  // carries the exact role its person was actually cast under.
  const updatedPool = { ...talentPool };
  for (const assignment of talent) {
    const profession = professionForProductionRole(assignment.role);
    const commitment = { projectId: productionId, role: assignment.role, startDay: totalDays, endDay: releaseDay };
    updatedPool[profession] = updatedPool[profession].map((t) =>
      t.id === assignment.person.id ? withCommitment(t, commitment) : t,
    );
  }

  return {
    production: {
      id: productionId,
      rivalStudioId: rival.id,
      scale,
      genre: script.genre,
      script,
      talent,
      productionChoices,
      postProductionChoices,
      marketingChoices,
      targetAudience: script.intendedAudience,
      releaseDay,
    },
    talentPool: updatedPool,
    cost,
  };
}

/**
 * Turns a finished rival production into a full Film, via the exact same
 * release-day scoring pipeline the player's own films use
 * (engine/releaseFilm.ts:computeReleaseResults) - a rival's reception,
 * Opening Weekend and legs are computed identically, just from a
 * synthesized shoot instead of a lived one. `shootingRatio` is rolled
 * within a plausible band rather than tracked live, since nobody watches a
 * rival's production happen day by day. `studioBrand` (Milestone: AI
 * Studios 2.0) is this rival's own current Brand - the same feedback loop
 * the player's own Buzz already has, not a flat industry-average stand-in
 * any more.
 */
export function resolveRivalProduction(
  production: RivalProductionInProgress,
  rivalStudioName: string,
  studioBrand: number,
  knownUpcoming: UpcomingRelease[],
  rng: RandomFn,
): Film {
  // Synthesize this rival's production history and shooting ratio from its risk
  // profile and plan (engine/rivalExecution.ts), then feed both through the
  // exact same release pipeline the player uses - a rival's film is now shaped
  // by how its shoot went, not a flat neutral profile.
  const { events, shootingRatio } = resolveRivalExecution(production, rng);
  const recommendedDays = computeRecommendedShootDays(production.talent, production.script, production.productionChoices);
  const dailyBurn = computeDailyContingencyBurn(production.productionChoices.contingencyAmount, recommendedDays);
  const photographyCost = Math.round(dailyBurn * recommendedDays * shootingRatio);
  const competitiveCrowding = computeCompetitiveCrowding(
    { releaseDay: production.releaseDay, genre: production.genre, targetAudience: production.targetAudience },
    knownUpcoming,
  );

  const { results, fixed } = computeReleaseResults(
    {
      title: production.script.title,
      genre: production.genre,
      targetAudience: production.targetAudience,
      script: production.script,
      talent: production.talent,
      productionChoices: production.productionChoices,
      postProductionChoices: production.postProductionChoices,
      marketingChoices: production.marketingChoices,
      events,
      postProductionEvents: [],
      photographyCost,
      shootingRatio,
      studioBrand,
      competitiveCrowding,
    },
    rng,
  );

  return {
    id: `rival-film-${production.id}`,
    title: production.script.title,
    genre: production.genre,
    targetAudience: production.targetAudience,
    script: production.script,
    talent: production.talent,
    productionChoices: production.productionChoices,
    postProductionChoices: production.postProductionChoices,
    marketingChoices: production.marketingChoices,
    events,
    postProductionEvents: [],
    results,
    boxOfficeRun: {
      status: 'running',
      fixed,
      simWeeks: [],
      weeks: [],
      cumulativeGross: 0,
      acknowledged: true, // the finished-run popup only ever looks at the player's own films
      premiereSeen: true, // likewise the Premiere Reveal - a rival's opening is never the player's to watch
    },
    releasedOnDay: production.releaseDay,
    releasedBy: rivalStudioName,
  };
}

export interface RivalMarketUpdate {
  rivalStudios: RivalStudio[];
  rivalProductionsInProgress: RivalProductionInProgress[];
  rivalFilmsReleased: Film[];
  talentPool: Record<TalentProfession, Person[]>;
  /** Milestone: Opportunity Market bidding - the shared pool, already settled for expiry/generation/this-week's-resolutions by the caller (engine/opportunities.ts:settleOpportunities) before being handed in here. */
  opportunities: Opportunity[];
}

/**
 * The rival market's bidding/Opportunity-market tick: apply this week's
 * already-resolved bid wins (Milestone: Opportunity Market bidding -
 * `resolvedRivalBids` comes from engine/opportunities.ts:settleOpportunities,
 * already filtered by the caller to rival winners only; a player win is
 * state/studioReducer.ts's own, separate concern), then let any studio
 * whose spawn-check day has arrived try to bid on something new if it has
 * spare capacity AND (Milestone: AI Studios 2.0) can plausibly afford it -
 * considerBiddingOnOpportunity returns null and this loop falls back to
 * just updating nextSpawnCheckDay exactly the way it already did for a
 * talent-pool shortage, so an unaffordable studio naturally sits out this
 * attempt and tries again at its next spawn check.
 *
 * Release resolution and box office settlement - what this function used to
 * do first, before the bidding logic below - moved to
 * engine/marketSettlement.ts:settleTheatricalMarket (the "Live screen
 * competition" implementation plan): unifying every rival's box office with
 * the player's own into one settlement pass is what lets a film actually
 * compete for screens against a rival's, not just its own owner's other
 * films. `current.rivalStudios`/`rivalFilmsReleased`/
 * `rivalProductionsInProgress` are expected to already reflect that pass's
 * own results by the time they reach here (see state/studioReducer.ts) -
 * this function only ever adds *bidding* activity on top, never touches box
 * office itself. Takes a `RivalMarketUpdate`-shaped `current` rather than a
 * `Studio` - rivalStudios/rivalProductionsInProgress/rivalFilmsReleased/
 * opportunities are world-level (GameState), not the player's Studio's own
 * business; only `talentPool` is still Studio-shaped (shared with the
 * player, until it too moves world-level). `totalDays` is passed in
 * explicitly for the same reason. `playerScheduled` (roadmap Phase 7.4,
 * upgraded for Phase 1 of release scheduling competition) is the player's
 * own upcoming releases, reduced to what
 * engine/releaseCrowding.ts:computeCompetitiveCrowding needs
 * (engine/project.ts:scheduledPlayerReleases) - threaded through so a
 * newly-started rival production can steer its own naive release day away
 * from genuinely crowded windows (see startRivalProductionFromWonScript's
 * avoidCrowdedReleaseDay call) - the player's own choices are never
 * otherwise read or affected here.
 */
export function settleRivalMarket(
  current: RivalMarketUpdate,
  resolvedRivalBids: ResolvedBid[],
  totalDays: number,
  playerScheduled: UpcomingRelease[],
  rng: RandomFn,
): RivalMarketUpdate {
  let talentPool = current.talentPool;
  let productionsInProgress = current.rivalProductionsInProgress;
  let opportunities = current.opportunities;
  let rivalStudiosAfterWins = current.rivalStudios;
  for (const resolved of resolvedRivalBids) {
    const rival = rivalStudiosAfterWins.find((r) => r.id === resolved.winnerId);
    if (!rival || !resolved.scale) {
      opportunities = reopenForfeitedOpportunity(opportunities, resolved.opportunity);
      continue;
    }
    const knownUpcoming = [...playerScheduled, ...productionsInProgress.map(rivalAsUpcomingRelease)];
    const started = startRivalProductionFromWonScript(
      rival,
      resolved.scale,
      resolved.opportunity.script,
      resolved.amount,
      totalDays,
      talentPool,
      knownUpcoming,
      rng,
    );
    if (!started) {
      opportunities = reopenForfeitedOpportunity(opportunities, resolved.opportunity);
      continue;
    }
    productionsInProgress = [...productionsInProgress, started.production];
    talentPool = started.talentPool;
    rivalStudiosAfterWins = rivalStudiosAfterWins.map((r) =>
      r.id === rival.id ? { ...r, cash: r.cash - started.cost, lifetimeExpenditure: r.lifetimeExpenditure + started.cost } : r,
    );
  }

  const rivalStudios = rivalStudiosAfterWins.map((rival) => {
    if (rival.nextSpawnCheckDay > totalDays) return rival;
    const nextSpawnCheckDay = totalDays + randInt(rng, ...SPAWN_CHECK_INTERVAL_DAYS[rival.tier]);
    const currentForThisStudio = productionsInProgress.filter((p) => p.rivalStudioId === rival.id);
    const scales = startableScales(rival.tier, currentForThisStudio);
    if (scales.length === 0) return { ...rival, nextSpawnCheckDay };
    const scale = pick(rng, scales);
    const bid = considerBiddingOnOpportunity(rival, scale, opportunities, totalDays, rng);
    if (!bid) return { ...rival, nextSpawnCheckDay };
    opportunities = placeBid(opportunities, bid.opportunityId, { bidderId: rival.id, bidderName: rival.name, amount: bid.amount, scale });
    return { ...rival, nextSpawnCheckDay };
  });

  return {
    rivalStudios,
    rivalProductionsInProgress: productionsInProgress,
    rivalFilmsReleased: current.rivalFilmsReleased,
    talentPool,
    opportunities,
  };
}
