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
import { computeDailyShootBurn, computeMarketingCost, computeProductionBudgetCost, computeTalentCost } from './cost';
import { highestBid, placeBid, reopenForfeitedOpportunity, type ResolvedBid } from './opportunities';
import { findCandidatesNearPrice } from './talentFilter';
import { logAmount } from './interpolate';
import { GENRE_PROFILES } from '../data/genres';
import { SHOOTING_BUDGET_RANGE, ENVIRONMENT_BUDGET_RANGE, PRACTICAL_EFFECTS_RANGE, VFX_RANGE } from '../data/production';
import { EDIT_STYLE_PROFILES, MUSIC_FOCUS_PROFILES, FINAL_CUT_FOCUS_PROFILES } from '../data/postProduction';
import { RELEASE_TYPE_PROFILES, MARKETING_SPEND_RANGE, campaignSpendFor } from '../data/release';
import { clamp, pick, pickMany, randFloat, randInt, weightedPick, type RandomFn } from './random';
import { deriveReleaseWindowFromDay } from './calendar';
// The seasonal read the AI scores days with is the same one the player's own
// date pickers show (engine/releaseDateReading.ts) - one formula, so the frames
// the AI chases are exactly the frames the player is told are good.
import { seasonalDesirability } from './releaseDateReading';
import { computeCompetitiveCrowding, computeRivalReleaseStrength, type UpcomingRelease } from './releaseCrowding';
import { genreIdentityFor } from './studioIdentity';
import { generateSequelScript } from './scriptGenerator';
import { establishRivalFranchises, growRivalFranchises, chooseRivalFranchiseToSequelize } from './rivalFranchise';

const EDIT_STYLES = Object.keys(EDIT_STYLE_PROFILES) as PostProductionChoices['editStyle'][];
const MUSIC_FOCI = Object.keys(MUSIC_FOCUS_PROFILES) as PostProductionChoices['musicFocus'][];
const FINAL_CUT_FOCI = Object.keys(FINAL_CUT_FOCUS_PROFILES) as PostProductionChoices['finalCutFocus'][];
const RELEASE_TYPES = Object.keys(RELEASE_TYPE_PROFILES) as MarketingChoices['releaseType'][];

// How a rival picks its release type. Scale is half the story and used to be the
// whole of it: a Big-budget tentpole goes out Wide (that's what all the spend is
// for) and no distributor platforms a $200M picture, which is physics rather
// than strategy. But WHO IS RELEASING IT is the other half, and the model had no
// term for it - so the same $15M horror film platformed four times in five
// whoever owned it.
//
// docs/domain/01-industry-structure.md is explicit that this is a property of
// the DISTRIBUTOR:
//
//  - §2 on specialty labels: they "release fewer, cheaper films, lean on
//    festivals and awards, and platform (open small, expand) RATHER THAN OPEN
//    WIDE". Platforming is the specialty distributor's whole method.
//  - §2 on a major: "a slate of 10-20 wide releases" - and §2.2.7 itemises that
//    slate as 2-4 tentpoles, 3-6 mid-budget AND 4-8 LOW-BUDGET films ($5-30M,
//    "horror, thriller, faith, specialty"). Those cheap films are counted in the
//    10-20 wide releases. A major owns a worldwide distribution and marketing
//    network (§2.1) and opens its slate on it; that network is most of what
//    being a major consists of.
//  - The exception the reference itself names is the 1-3 awards plays, which go
//    "often through the specialty label" - i.e. through a different distributor,
//    which in this model is the Indie tier. What a major keeps in-house and
//    platforms anyway is the remainder, and it is small.
//
// So a major opens nearly everything wide including its cheap films, a specialty
// label platforms nearly everything including its expensive ones, and a
// self-distributing mini-major sits between them. Weights are relative, not
// probabilities - weightedPick normalises by their sum (engine/random.ts).
type ReleaseTypeWeights = Partial<Record<MarketingChoices['releaseType'], number>>;
const RELEASE_TYPE_WEIGHTS: Record<StudioTier, Record<ProductionScale, ReleaseTypeWeights>> = {
  // Specialty label: platforms by method, at every budget it can reach.
  Indie: {
    Big: { Wide: 70, Limited: 22, 'Festival First': 8 },
    Medium: { Wide: 34, Limited: 44, 'Festival First': 22 },
    Small: { Wide: 14, Limited: 50, 'Festival First': 36 },
  },
  // Self-distributing mini-major: real wide releases, a thinner slate, and it
  // still platforms its awards and genre plays more often than a major does.
  'Mid-Size': {
    Big: { Wide: 90, Limited: 7, 'Festival First': 3 },
    Medium: { Wide: 66, Limited: 22, 'Festival First': 12 },
    Small: { Wide: 40, Limited: 38, 'Festival First': 22 },
  },
  // Major: the slate goes out on its own network. The low-budget end is wide too
  // - that is what §2.2.7's 4-8 low-budget films are doing inside a 10-20 wide
  // release slate.
  Major: {
    Big: { Wide: 96, Limited: 3, 'Festival First': 1 },
    Medium: { Wide: 88, Limited: 8, 'Festival First': 4 },
    Small: { Wide: 76, Limited: 15, 'Festival First': 9 },
  },
};

/** A rival's release type, weighted by who is distributing it and at what scale (see RELEASE_TYPE_WEIGHTS). Exported for tests. */
export function releaseTypeForScale(
  scale: ProductionScale,
  rng: RandomFn,
  tier: StudioTier = 'Mid-Size',
): MarketingChoices['releaseType'] {
  return weightedPick(rng, RELEASE_TYPES, RELEASE_TYPE_WEIGHTS[tier][scale]);
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
// Big's band pulled back from [0.75, 1.0] to [0.6, 0.88]. The old top was safe
// only because a rival could never afford it: the affordability gate was doing
// double duty as a budget governor, and the moment studios were capitalised to
// run a full slate (STARTING_CASH_BY_TIER) the median negative cost of a >$80M
// picture inflated to $217M - above the biggest film on the reference's whole
// twelve-picture slate (docs/domain/11 §5.4, a $210M tentpole miss) and well
// above its $150M median for that tier. A budget should be set by what the film
// needs, never by what the studio happens to have in the bank.
//
// THIRD WIDENING - Small became tier-dependent, because "low-budget" means
// something different depending on who is making the film, and the model had one
// number for both. docs/domain/01-industry-structure.md §2.2.7 puts a MAJOR's
// low-budget slate at $5-30M ("horror, thriller, faith, specialty") and
// docs/domain/11 §5.4's representative slate prices its cheap film at $15M. A
// true independent's is a different animal - the model's Indie tier makes films
// at a $2.5M median, which is right for what it is.
//
// The two were the same band, so the moment majors could make cheap films at all
// they made them at an INDIE's price and then opened them wide on a major's
// distribution network. Measured: an $8.8M median negative grossing $119M, a
// 12.1x gross-on-negative where the calibration target is 4.5-7x, and 23% of a
// major's slate returning 2.5-5x. The reference slate has exactly one such film
// and calls it "the best return on capital" on the whole slate; the model was
// making it the median. Pricing a studio's low-budget picture at what §2.2.7
// says it costs is the fix, not a penalty on cheap films.
const SCALE_SPEND_RANGE: Record<StudioTier, Record<ProductionScale, [number, number]>> = {
  Indie: { Small: [0.08, 0.32], Medium: [0.32, 0.65], Big: [0.5, 0.8] },
  'Mid-Size': { Small: [0.18, 0.42], Medium: [0.32, 0.65], Big: [0.5, 0.8] },
  Major: { Small: [0.26, 0.48], Medium: [0.32, 0.65], Big: [0.5, 0.8] },
};

// How a rival budgets its campaign: as a rule on the film's own negative cost,
// not as an independent taste. docs/domain/09-marketing-and-distribution.md §1.1
// is explicit that this is how the real number starts life - the greenlight
// placeholder is "a slate-average number by budget tier; often literally a rule
// (e.g. 0.8x negative cost domestic)" - and §1 gives the shape it has to end up
// in: roughly FLAT as a share of the negative (1.00x slate-wide in the worked
// 12-film slate, docs/domain/11 §5.4), rising for cheap films because the floor
// does not scale down.
//
// The AI used to pick marketingSpendT from scale and genre alone, with no
// reference to what the film cost, and the result had the economics backwards -
// P&A ran at 0.10x the negative for a small wide release and 0.65x for a
// tentpole, when the real ratio runs ~2.0x and ~0.9x respectively
// (docs/DESIGN_box_office_calibration_targets_v2_draft.md §4, ratified).
//
// spendPlan.marketingSpendT is kept, but demoted from the LEVEL to the
// APPETITE: it still carries the tier and genre adjustments (a Major markets
// aggressively, an Indie conservatively, a spectacle genre justifies a broader
// campaign), now as a multiplier around the rule rather than as the rule.
// data/release.ts:campaignSpendFor then floors the result for a Wide release,
// which is what produces the ratio's rise at the cheap end.
// The share DECLINES with budget, and that is the whole point of modelling it as
// a rule rather than a flat fraction. The reference slate runs 2.00x the negative
// on its $15M horror, a 1.27x median across the six films between $25M and $80M,
// and 0.93x across the five above $80M - because the floor a wide opening
// demands is the same for all of them, so it is a bigger multiple of a smaller
// film. A flat rule reproduces the tentpole and starves everything below it,
// which is what the first draft of this did (measured 1.8 / 1.1 / 1.2 against a
// reference 2.0 / 1.27 / 0.93 - the middle of the market under-costed).
//
// Fitted through the reference points as a power law in the negative cost:
// 2.0x at $15M and 0.80x at $200M gives an exponent of -0.354, which puts $40M
// at 1.41x and $110M at 0.99x against reference values of 1.27x and 0.95x.
//
// REFERENCE_SHARE is then 1.66 rather than 2.0 because the appetite term does
// not average to 1: marketingSpendT's own distribution centres near 0.9, so the
// median appetite is ~1.24, and the rule has to be set so the PRODUCT lands on
// the reference. Measured, that puts the three tiers at 2.06 / 1.39 / 0.93.
const PANDA_REFERENCE_NEGATIVE = 15_000_000;
const PANDA_REFERENCE_SHARE = 1.7;
const PANDA_SCALE_EXPONENT = -0.354;
const PANDA_APPETITE = { min: 0.7, max: 1.3 };

/** What share of its negative cost a film of this size spends on P&A, before the studio's own appetite. */
function pandaShareOfNegative(negativeCost: number): number {
  return PANDA_REFERENCE_SHARE * Math.pow(Math.max(1_000_000, negativeCost) / PANDA_REFERENCE_NEGATIVE, PANDA_SCALE_EXPONENT);
}

/**
 * A rival's planned campaign spend: the P&A rule on its own negative cost, scaled
 * by its appetite, floored by its release type.
 *
 * The rule sets a target campaign COST; the spend is that divided back through
 * the release type's own cost multiplier, so a Wide release's 1.2x support
 * premium does not silently inflate the ratio the rule is trying to hit.
 */
function rivalMarketingSpend(negativeCost: number, marketingSpendT: number, releaseType: MarketingChoices['releaseType']): number {
  const appetite = PANDA_APPETITE.min + (PANDA_APPETITE.max - PANDA_APPETITE.min) * clamp(marketingSpendT, 0, 1);
  const targetCost = negativeCost * pandaShareOfNegative(negativeCost) * appetite;
  const planned = targetCost / RELEASE_TYPE_PROFILES[releaseType].costMultiplier;
  return clamp(campaignSpendFor(releaseType, planned), MARKETING_SPEND_RANGE.min, MARKETING_SPEND_RANGE.max);
}

// Budget realism (docs/DESIGN_box_office_engine_map.md §11, "the unprofitable tail
// is a COST-side problem"). Every rival production's whole spend plan is nudged up
// by this fraction of the log-scale budget position. The tail investigation found
// rival wide releases were far too cheap to fail - median cost ~$20M against a
// ~$103M gross (1.75x return) - so almost nothing lost money (~20% vs a realistic
// ~50%), and the films that DID lose money were simply the expensive ones (same
// audience score as the profitable ones, 2.5x the cost). Lifting the whole slate a
// notch makes wide releases cost enough that the ones which don't break out fail
// to recoup, the way real theatrical economics work. Deliberately MODEST (+0.06):
// a diagnostic sweep showed this brings bomb% into band (7->11) and roughly
// halves the "everything profits" gap (unprofitable 20->32) while HOLDING the
// box-office centre, opening multiple, and the success tiers (major/blockbuster) -
// pushing it harder converts genuine successes into losses because the megahit
// top-tail isn't yet fat enough for expensive films to stay winners (that's the
// coupled crossover/market-size piece, §11). Paired with a capital bump
// (STARTING_CASH_BY_TIER ×1.5) so the pricier slate doesn't throttle the rivals'
// film output. Reaching the full 45-55% unprofitable target is the coordinated
// budget+capital+crossover+market-size effort the map scopes.
//
// 0.06 -> 0.10 at the third widening, BUT NOT FOR TENTPOLES. The widened slate
// came out more profitable than the one this was tuned against, and the reason
// is compositional: the wide pool is now dominated by major-tier films, which
// carry a major's talent, brand and campaign, so the same budget band buys a
// better film than it did when wide releases were mostly Mid-Size. Measured,
// small- and mid-tier wide releases came out 37% and 36% unprofitable against a
// 40-55% band, which is the gap this lever exists for.
//
// Big is deliberately left at 0.06. Lifting it too took big-budget films from
// 48% to 53% unprofitable (band 35-50) and their median all-in return from 1.02x
// to 0.96x - past break-even, in the tier that already runs closest to it. That
// is the same finding SCALE_SPEND_RANGE.Big records from the other direction: a
// tentpole budget is set by what the picture needs, and inflating it is how the
// most expensive films stop being able to recoup at all.
const RIVAL_BUDGET_REALISM: Record<ProductionScale, number> = { Small: 0.10, Medium: 0.10, Big: 0.06 };

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
  const [minSpend, maxSpend] = SCALE_SPEND_RANGE[rival.tier][scale];

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
    baseSpendT + tierAdjustment[rival.tier] + RIVAL_BUDGET_REALISM[scale],
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

// How often (in days) each studio tier attempts to start a new production, once
// it has spare capacity.
//
// The old spread (Indie 20-40, Mid-Size 15-30, Major 10-20) rested on a premise
// that no longer holds: "a Major has more going on at once, so it checks more
// often; an Indie's SINGLE FILM takes a while to turn around". An Indie ran one
// production at a time when that was written. It now runs up to six
// (startableScales), and a Mid-Size up to eighteen, so the cadence gap was
// throttling tiers whose concurrency limit had already been raised out from
// under it - measured, both sat at their ceilings only 4-6% of the time with
// scripts going unclaimed, i.e. limited by nothing but how rarely they looked.
//
// A specialty label releasing 5-15 films a year
// (docs/domain/01-industry-structure.md §2) is deciding what to make a good deal
// more often than once a month.
const SPAWN_CHECK_INTERVAL_DAYS: Record<StudioTier, [number, number]> = {
  Indie: [14, 28],
  'Mid-Size': [12, 24],
  Major: [10, 20],
};

// The roster: 2/2/2 originally, 4/4/4 to contest the weekly chart and the
// Opportunity Market with a fuller field, and now 8/6/5 - NOT a flat count per
// tier, because the real distributor population is not flat either.
//
// docs/DESIGN_REVIEW_slate_width.md §9.8 is what forces this. Three widenings
// put a major's own slate inside the reference's 8-20 wide releases a year, and
// the market was still running ~60 wide releases against a real ~110. The
// shortfall is not per-studio output any more, it is the number of studios: a
// real market's wide releases come from many distributors, and four-per-tier
// compressed that into twelve.
//
// docs/domain/01-industry-structure.md §2 gives the shape directly:
//
//  - FIVE majors, named exactly ("Walt Disney Studios, Warner Bros., Universal,
//    Paramount, Sony"). This is the least arbitrary number in the whole
//    document, so the Major tier is exactly five.
//  - EIGHT specialty / independent distributors, also named exactly ("A24,
//    Neon, Focus Features, Searchlight, Bleecker Street, IFC, Magnolia, Sony
//    Pictures Classics"), so the Indie tier is exactly eight.
//  - Mid-Size is the judgement call, and is flagged as one. §2's mini-major
//    list ("Lionsgate, Amazon MGM Studios, Apple Original Films") is three
//    examples under a category heading rather than a census, and two of the
//    three are streamers with "selective theatrical" - not what this tier
//    models. What it models is a self-distributing distributor below major
//    scale, and a theatrical market has more of those than three once the
//    specialty labels that routinely open wide are counted. Six.
const INITIAL_ROSTER_TIERS: StudioTier[] = [
  'Indie', 'Indie', 'Indie', 'Indie', 'Indie', 'Indie', 'Indie', 'Indie',
  'Mid-Size', 'Mid-Size', 'Mid-Size', 'Mid-Size', 'Mid-Size', 'Mid-Size',
  'Major', 'Major', 'Major', 'Major', 'Major',
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
// Raised ×1.5 (Indie 4M→6M... 260M→390M below) alongside RIVAL_BUDGET_REALISM: a
// pricier slate deletes cash faster and loses money on more films, so without more
// reserve the affordability gate (`cost > rival.cash`) throttles rivals into
// making fewer films (a budget-realism sweep saw the wide-film count fall ~40% at
// this budget shift with the old floats). The bump restores the film count to
// within ~10% of baseline (930 vs 1048 wide over the 6×8yr harness) - the
// power-law economy where a studio's hits carry the reserve it needs to keep
// funding an expensive, riskier slate. Headroom, not a throughput lever (see the
// note above the values). docs/DESIGN_box_office_engine_map.md §11.
//
// Raised ×1.8 again (Major 390M→700M) alongside the ratified whole-P&L
// recalibration, for exactly the reason the ×1.5 above documents and by the same
// measurement. P&A roughly tripled in that pass (a Wide release now funds a real
// campaign, and a rival budgets it as a rule on its own negative cost rather than
// independently of it), so a tentpole's all-in cost went from ~$135M to ~$260M
// while the reserve behind it did not move: the wide-release count held, but
// films over $80M of negative cost fell from 53 to 25 across the 6x8yr harness -
// the affordability gate quietly deleting the top of the market. For scale, the
// representative studio slate this calibration is anchored on
// (docs/domain/11-money-accounting-and-participations.md §5.4) deploys $2.2B
// across twelve films in a year.
// What share of each picture an outside co-financier funds, by tier
// (docs/domain/11-money-accounting-and-participations.md §7.1: an SPV "funds an
// agreed % of the negative cost of each qualifying picture (and often the same %
// of P&A), and receives the same % of the picture's defined revenue", at a
// participation rate of 20-50%).
//
// Studios do not fund their slates out of pocket, and modelling them as if they
// did was the binding constraint on how many films this industry made. Measured
// over three seeds x eight in-game years, the twelve rival studios released 20.3
// films a year between them - 1.06 for an Indie, 1.22 for a Mid-Size, 2.78 for a
// Major - against a reference where a single major releases 8-20 wide
// (docs/domain/01-industry-structure.md §2). Capacity was not the limit: the
// industry ran at 46% of its own concurrent-production ceiling, with 17
// unclaimed scripts sitting on the Opportunity Market. Cash was. Every tier
// ended broke or close to it (median $3M Indie, $23M Mid-Size, $205M Major)
// against productions costing far more than that.
//
// The rate rises as the balance sheet shrinks, which is the real pattern: a
// major co-finances to de-risk and keeps most of the upside, while an
// independent finances nearly every picture externally because it has no
// balance sheet to finance it from.
const CO_FINANCED_SHARE_BY_TIER: Record<StudioTier, number> = {
  Indie: 0.5,
  'Mid-Size': 0.42,
  Major: 0.32,
};

/** The fraction of a picture's cost and revenue this studio keeps for itself - the rest is its co-financier's (see CO_FINANCED_SHARE_BY_TIER). */
export function studioShareOf(rival: Pick<RivalStudio, 'coFinancedShare'>): number {
  return 1 - clamp(rival.coFinancedShare ?? 0, 0, 0.9);
}

//
// Indie and Mid-Size raised again with the roster widening, and for a reason the
// third widening missed: it doubled their CONCURRENCY ceilings (Indie 3 -> 6,
// Mid-Size 9 -> 18 across both scales) without revisiting the reserve behind
// them, which is the pairing every raise above exists to make. Measured, both
// were draining - an Indie's median cash fell to $22M and a Mid-Size's to $88M -
// so the affordability gate throttled exactly the tiers whose ceilings had just
// been raised out from under it. Indie 110M -> 220M, Mid-Size 700M -> 1.0B.
//
// Mid-Size is NOT scaled by the full ceiling ratio, which would have been 1.4B.
// Cash is meant to be headroom rather than a throughput lever, but it leaks into
// throughput through scriptBudget (a fraction of current cash), so a tier
// holding far more than it spends starts outbidding better-capitalised tiers for
// scripts. At 1.4B a Mid-Size sat on a $734M median against a Major's $95M and
// made MORE films than a Major, which is backwards. 1.0B leaves it funded
// without letting it buy the market.
//
// Major is deliberately NOT raised. Its $2.2B is not a headroom figure at all -
// it is the capital the reference slate itself deploys in a year
// (docs/domain/11 §5.4), and that anchor is worth more than the extra films
// loosening it would buy.
const STARTING_CASH_BY_TIER: Record<StudioTier, number> = {
  Indie: 220_000_000,
  'Mid-Size': 1_000_000_000,
  Major: 2_200_000_000,
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

// Strength-aware release scheduling (docs/DESIGN_box_office_calibration_
// targets.md §8). A production no longer merely *avoids* crowding - it picks
// the release day that maximises (seasonal desirability - relative crowding)
// across a forward search window. The key is that the crowding term is now
// RELATIVE (engine/releaseCrowding.ts:matchupWeight, fed the candidate's own
// pre-release strength): a strong film barely feels the crowd, so seasonal pull
// dominates and it heads straight for the prime window (summer/holidays) even
// though other majors are already there - majors contest each other for the
// best frames. A weak film feels the crowd hard, so the crowding term dominates
// and it retreats to a quiet pocket where it can survive - everyone else working
// around the majors. Both behaviours fall out of the SAME scoring formula via
// the matchup; nothing branches on tier.
//
// How far forward a production is willing to shift its release from its naive
// (production-driven) date to reach a better window. Wide enough to reach the
// next major season, not so wide that films drift a whole year.
const MAX_RELEASE_SHIFT_DAYS = 120;
// How the crowding penalty trades off against seasonal desirability in the day
// score. Seasonal desirability spans ~0.85 (quiet month) to ~1.5 (summer
// action); this weight sets how much *relative* crowding (0-1) has to bite
// before it outweighs a prime window's pull - i.e. how out-gunned a film must be
// before fleeing a good season for a quiet one. Tunable alongside the
// competition constants in engine/audienceSimulationStep.ts.
// Expressed in crowding units, so it moves with them: the crowding score is
// density-normalised (engine/releaseCrowding.ts:CROWDING_DENSITY_REFERENCE) and
// this weight is scaled by the same factor to leave the AI's avoidance behaviour
// exactly where it was - 0.6 -> 2.76 when that normalisation arrived, and
// 2.76 -> 4.14 at the third widening when the reference went 4.6 -> 6.9. Without
// it the crowd term shrinks against the seasonality and delay-cost terms it
// competes with, and rivals stop steering around each other's dates altogether.
const SCHEDULING_CROWD_WEIGHT = 6.0;
// Only step weekly through the search window - releases land on weekend frames,
// and a 1-day granularity would spend ~7x the compute for no behavioural gain.
const SCHEDULING_STEP_DAYS = 7;
// What a day of delay costs, in the same units as seasonal desirability.
//
// Without this, DELAYING IS FREE: the score was seasonal desirability minus
// crowding, and seasonal desirability is nearly flat from one week to the next,
// so ANY non-zero crowding made stepping forward strictly better - and the
// cheapest way to shed crowding entirely is one step past CROWDING_WINDOW_DAYS.
// Every rival therefore fled ~49 days from any competitor at all, by exactly the
// same distance whether the threat was strong, weak, or chasing a completely
// different audience. Two things the design needs died there: counterprogramming
// never happened, and a rival never collided with anyone, so no studio ever had
// to decide whether to hold a contested date.
//
// A production cannot actually wait for nothing. Capital is tied up, the
// negative accrues interest, crew and facilities are on hold, and marketing
// lead-times have been bought against a date. Pricing that makes the search
// weigh a better window against the cost of reaching it, rather than taking any
// improvement however small.
//
// Calibrated against the crowding term: at 0.004/day, shedding a FULL crowd
// (0.6) justifies about 150 days, a half crowd about 75, and the 0.15-weighted
// nudge of a counterprogrammed competitor about 10 - under the weekly step, so
// a mismatched rival stays put. See engine/releaseCrowding.diagnostic.test.ts.
const SCHEDULING_DELAY_COST_PER_DAY = 0.004;

/**
 * Picks the release day maximising seasonal desirability net of *relative*
 * crowding, searching forward from `naiveDay` (a film can delay to reach a
 * better frame, but never release before production wraps). Pure and rng-free -
 * the choice is fully deterministic given its inputs, as release-day selection
 * has always been. `candidateStrength` (pre-release, engine/releaseCrowding.ts:
 * computeRivalReleaseStrength) is what makes a strong film willing to sit in a
 * crowded prime window and a weak one flee it - see the block comment above.
 *
 * Exported for tests: the crowding-nudge property belongs to THIS function, and
 * asserting it through two full market settlements is unsound - adding a player
 * release perturbs the whole rival rng stream, so the "same seed, one variable"
 * premise such a test needs does not actually hold.
 */
export function chooseReleaseDay(
  naiveDay: number,
  candidate: Omit<UpcomingRelease, 'strength' | 'releaseDay'>,
  known: UpcomingRelease[],
  candidateStrength: number,
): number {
  let bestDay = naiveDay;
  let bestScore = -Infinity;
  for (let day = naiveDay; day <= naiveDay + MAX_RELEASE_SHIFT_DAYS; day += SCHEDULING_STEP_DAYS) {
    const crowd = computeCompetitiveCrowding({ releaseDay: day, ...candidate }, known, candidateStrength);
    const score =
      seasonalDesirability(day, candidate.genre) -
      SCHEDULING_CROWD_WEIGHT * crowd -
      SCHEDULING_DELAY_COST_PER_DAY * (day - naiveDay);
    // Strictly-greater keeps the earliest day among ties, so a film never delays
    // longer than an actual score improvement justifies.
    if (score > bestScore + 1e-9) {
      bestScore = score;
      bestDay = day;
    }
  }
  return bestDay;
}

/** A RivalProductionInProgress reduced to what computeCompetitiveCrowding needs - see engine/releaseCrowding.ts:UpcomingRelease. Exported for components/wizard/MarketingRelease.tsx, which needs the same conversion to preview crowding before a release is actually scheduled - one formula, not two independent implementations. */
export function rivalAsUpcomingRelease(p: RivalProductionInProgress): UpcomingRelease {
  return {
    releaseDay: p.releaseDay,
    genre: p.genre,
    targetAudience: p.targetAudience,
    strength: computeRivalReleaseStrength(p.marketingChoices.marketingSpend, p.scale, p.genreIdentity ?? 0),
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
      coFinancedShare: CO_FINANCED_SHARE_BY_TIER[tier],
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
  // Widened across every tier. These ceilings are the design statement of how
  // many pictures a studio runs at once, and they were set well below what the
  // reference describes: a major releases 8-20 wide a year
  // (docs/domain/01-industry-structure.md §2) and a film takes about eleven
  // months from greenlight to release here, so a major needs something like
  // 8-18 in flight to sustain that - it had six. The hard constraint on
  // concurrency in reality is physical (§13: stages, workshops, post
  // facilities), which is why a ceiling exists at all, not how low it sat.
  //
  // THIRD WIDENING - the low-budget end of a slate, which nobody above Indie
  // could make. §2.2.7 itemises a major's year as 2-4 tentpoles, 3-6 mid-budget
  // and 4-8 LOW-BUDGET films ($5-30M: horror, thriller, faith, specialty); the
  // model's majors made none, only Medium and Big, so roughly half of a real
  // major's slate simply did not exist. That is also why majors ran cash-poor
  // while sitting well below their concurrency ceiling (measured: at ceiling 2%
  // of the time, median cash $71M against a $117M median picture): every film
  // they could start was an expensive one. Cheap films are how a studio keeps a
  // slate moving through a thin year, and 4-8 of them is what the reference
  // says a major has in it.
  //
  // Mid-Size gets a smaller version of the same for the same reason - a
  // self-distributing mini-major's slate is not all mid-budget - and Indie's
  // Small ceiling goes 3 -> 6, the one tier that was genuinely capacity-bound
  // (at its ceiling 53% of the time) against a reference specialty label
  // releasing 5-15 films a year.
  //
  // Mid-Size is raised furthest (Small 4 -> 6, Medium 9 -> 12) because the field
  // was short at the NON-MAJOR end specifically. With majors inside their 8-20
  // band the market still ran ~69 wide releases a year against a real ~110, and
  // the missing ones are not more tentpoles: they are the long tail of ordinary
  // wide releases a mini-major puts out, most of which do not break $100M. A
  // real mini-major (Lionsgate) releases 12-18 films a year; this tier was
  // managing 9.5. Widening it is what puts the weak half of the wide-release
  // distribution back, which is where the gross-shape bands say the gap is.
  if (tier === 'Indie') {
    return counts.Small < 6 ? ['Small'] : [];
  }
  if (tier === 'Mid-Size') {
    const scales: ProductionScale[] = [];
    if (counts.Small < 6) scales.push('Small');
    if (counts.Big === 0 && counts.Medium < 12) scales.push('Medium');
    if (counts.Big === 0 && counts.Medium === 0) scales.push('Big');
    return scales;
  }
  // Major: the pools are independent and run simultaneously.
  const scales: ProductionScale[] = [];
  if (counts.Small < 7) scales.push('Small');
  if (counts.Medium < 11) scales.push('Medium');
  if (counts.Big < 4) scales.push('Big');
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
  const spendT = randFloat(rng, ...SCALE_SPEND_RANGE[rival.tier][scale]);
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
  // For a franchise sequel (stage 3): the rival franchise this entry belongs to,
  // carried onto the production so the flywheel can fold the finished film back
  // in (engine/rivalFranchise.ts). Absent for an ordinary won-from-market script.
  franchiseId?: string,
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
    shootingBudgetAmount: logAmount(
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
  const postProductionDays = computeRecommendedPostProductionDays(talent, script, productionChoices);
  const naiveReleaseDay = totalDays + recommendedDays + postProductionDays + RIVAL_MARKETING_LEAD_DAYS;
  // Strength-aware scheduling (docs/DESIGN_box_office_calibration_targets.md §8):
  // this production's own pre-release strength (marketing + scale) decides
  // whether it contests a prime window or retreats to a quiet one - see
  // chooseReleaseDay. Marketing spend is resolved here (rather than only inside
  // marketingChoices below) so it can feed both that strength and the campaign.
  // Release type is resolved here rather than inline below because the campaign
  // budget now depends on it: only a Wide release carries a structural floor
  // (data/release.ts:MINIMUM_CAMPAIGN_SPEND).
  const releaseType = releaseTypeForScale(scale, rng, rival.tier);
  const plannedNegative =
    computeTalentCost(talent) + computeProductionBudgetCost(productionChoices) + productionChoices.shootingBudgetAmount;
  const marketingSpend = rivalMarketingSpend(plannedNegative, spendPlan.marketingSpendT, releaseType);
  // The rival's identity in this genre lifts its own release strength, so a
  // studio contesting its home turf schedules more confidently against a crowded
  // window (and, once released, defends that turf against others - see
  // rivalAsUpcomingRelease). Snapshotted onto the production below.
  const productionGenreIdentity = genreIdentityFor(rival.genreIdentity, script.genre);
  const candidateStrength = computeRivalReleaseStrength(marketingSpend, scale, productionGenreIdentity);
  const releaseDay = chooseReleaseDay(naiveReleaseDay, { genre: script.genre, targetAudience: script.intendedAudience }, knownUpcoming, candidateStrength);

  const postProductionChoices: PostProductionChoices = {
    editStyle: pick(rng, EDIT_STYLES),
    musicFocus: pick(rng, MUSIC_FOCI),
    finalCutFocus: pick(rng, FINAL_CUT_FOCI),
  };
  const marketingChoices: MarketingChoices = {
    marketingSpend,
    releaseType,
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

  // The picture's full cost, then the studio's own share of it: a co-financier
  // funds the rest and takes the same share of the revenue on the way back
  // (CO_FINANCED_SHARE_BY_TIER). `cost` returned below is the studio's share,
  // because that is what it actually commits and what the affordability gate has
  // to be measured against - the film itself is still made at full size.
  const fullCost =
    bidAmount +
    computeTalentCost(talent) +
    computeProductionBudgetCost(productionChoices) +
    productionChoices.shootingBudgetAmount +
    computeMarketingCost(marketingChoices);
  const cost = fullCost * studioShareOf(rival);
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
      genreIdentity: productionGenreIdentity,
      franchiseId,
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
  studioGenreIdentity: number,
  knownUpcoming: UpcomingRelease[],
  rng: RandomFn,
): Film {
  // Synthesize this rival's production history and shooting ratio from its risk
  // profile and plan (engine/rivalExecution.ts), then feed both through the
  // exact same release pipeline the player uses - a rival's film is now shaped
  // by how its shoot went, not a flat neutral profile.
  const { events, shootingRatio } = resolveRivalExecution(production, rng);
  const recommendedDays = computeRecommendedShootDays(production.talent, production.script, production.productionChoices);
  const dailyBurn = computeDailyShootBurn(production.productionChoices.shootingBudgetAmount, recommendedDays);
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
      studioGenreIdentity,
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
    franchiseId: production.franchiseId,
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

  // Rival franchising (stage 3): a finished rival hit becomes a franchise, and a
  // finished franchise entry grows it - the rival analogue of the player's
  // promote + flywheel (engine/rivalFranchise.ts), run off the same finished-films
  // input the box-office diagnostic harness also drives this function with, so
  // both the live game and the harness see franchise entries on the rival side.
  // Both steps are deterministic and rng-free, so they never disturb the stream.
  const finishedRivalFilms = current.rivalFilmsReleased.filter((f) => f.boxOfficeRun.status === 'finished');
  rivalStudiosAfterWins = growRivalFranchises(establishRivalFranchises(rivalStudiosAfterWins, finishedRivalFilms, totalDays), finishedRivalFilms);

  const rivalStudios = rivalStudiosAfterWins.map((rival) => {
    if (rival.nextSpawnCheckDay > totalDays) return rival;
    const nextSpawnCheckDay = totalDays + randInt(rng, ...SPAWN_CHECK_INTERVAL_DAYS[rival.tier]);
    const currentForThisStudio = productionsInProgress.filter((p) => p.rivalStudioId === rival.id);
    const scales = startableScales(rival.tier, currentForThisStudio);
    if (scales.length === 0) return { ...rival, nextSpawnCheckDay };
    const scale = pick(rng, scales);

    // A rival with a franchise may spend this slot on a sequel rather than bidding
    // - developed in-house, so it skips the Opportunity Market entirely, exactly
    // as the player's DEVELOP_SEQUEL does. chooseRivalFranchiseToSequelize only
    // draws rng when the rival actually owns a franchise, so the franchise-less
    // majority that dominates early play leaves the shared stream untouched.
    const franchise = chooseRivalFranchiseToSequelize(rival, rng);
    if (franchise && franchise.genre) {
      const knownUpcoming = [...playerScheduled, ...productionsInProgress.map(rivalAsUpcomingRelease)];
      const sequelScript = generateSequelScript(franchise, franchise.genre, rng);
      const started = startRivalProductionFromWonScript(rival, scale, sequelScript, 0, totalDays, talentPool, knownUpcoming, rng, franchise.id);
      if (started) {
        productionsInProgress = [...productionsInProgress, started.production];
        talentPool = started.talentPool;
        return { ...rival, nextSpawnCheckDay, cash: rival.cash - started.cost, lifetimeExpenditure: rival.lifetimeExpenditure + started.cost };
      }
      // Couldn't afford/staff the sequel this pass - fall through to normal bidding.
    }

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
