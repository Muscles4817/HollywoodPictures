import type {
  Film,
  MarketingChoices,
  PostProductionChoices,
  ProductionChoices,
  ProductionScale,
  RivalProductionInProgress,
  RivalStudio,
  StudioTier,
  Talent,
  TalentRole,
} from '../types';
import { RIVAL_STUDIO_NAME_PREFIXES, RIVAL_STUDIO_NAME_SUFFIXES } from '../data/rivalStudioNames';
import { MANDATORY_TALENT_ROLES, ROLE_GENERATION_PROFILES } from '../data/talentGeneration';
import { effectiveRoleCapacity } from './castRequirements';
import { generateScriptOptions } from './scriptGenerator';
import { computeRecommendedShootDays } from './production';
import { computeReleaseResults } from './releaseFilm';
import { settleBoxOfficeForAllFilms } from './boxOfficeRun';
import { computeDailyContingencyBurn, computeMarketingCost, computeProductionBudgetCost, computeTalentCost } from './cost';
import { applyStatChange } from './reputation';
import { findCandidatesNearPrice } from './talentFilter';
import { logAmount } from './interpolate';
import { STAGE_DURATIONS } from '../data/schedule';
import { GENRE_PROFILES } from '../data/genres';
import { CONTINGENCY_RANGE, SET_QUALITY_RANGE, PRACTICAL_EFFECTS_RANGE, VFX_RANGE } from '../data/production';
import { EDIT_STYLE_PROFILES, MUSIC_FOCUS_PROFILES, TEST_SCREENING_PROFILES, FINAL_CUT_FOCUS_PROFILES } from '../data/postProduction';
import { RELEASE_TYPE_PROFILES, RELEASE_WINDOW_BASE_MULTIPLIER, MARKETING_SPEND_RANGE } from '../data/release';
import { clamp, pick, pickMany, randFloat, randInt, type RandomFn } from './random';

const GENRES = Object.keys(GENRE_PROFILES) as Array<keyof typeof GENRE_PROFILES>;
const EDIT_STYLES = Object.keys(EDIT_STYLE_PROFILES) as PostProductionChoices['editStyle'][];
const MUSIC_FOCI = Object.keys(MUSIC_FOCUS_PROFILES) as PostProductionChoices['musicFocus'][];
const TEST_SCREENING_RESPONSES = Object.keys(TEST_SCREENING_PROFILES) as PostProductionChoices['testScreeningResponse'][];
const FINAL_CUT_FOCI = Object.keys(FINAL_CUT_FOCUS_PROFILES) as PostProductionChoices['finalCutFocus'][];
const RELEASE_TYPES = Object.keys(RELEASE_TYPE_PROFILES) as MarketingChoices['releaseType'][];
const RELEASE_WINDOWS = Object.keys(RELEASE_WINDOW_BASE_MULTIPLIER) as MarketingChoices['releaseWindow'][];

// Every stage's fixed calendar cost except Photography itself (charged
// separately via the shoot's own recommended length below) - the same sum
// STAGE_DURATIONS already charges the player for develop/talent/planning/
// post/marketing, reused so a rival's total dev-to-release window is
// grounded in the same numbers instead of an invented constant.
const NON_SHOOT_STAGE_DAYS = Object.values(STAGE_DURATIONS).reduce((sum, days) => sum + (days ?? 0), 0);

// Where a production's target price (0-1, log-scale) lands based on its
// scale - governs both casting price and production spend, same way the
// player's own sliders do.
const SCALE_SPEND_RANGE: Record<ProductionScale, [number, number]> = {
  Small: [0.08, 0.32],
  Medium: [0.32, 0.65],
  Big: [0.65, 0.98],
};

// How often (in days) each studio tier attempts to start a new production,
// once it has spare capacity - a Major has more going on at once, so it
// checks more often; an Indie's single film takes a while to turn around.
const SPAWN_CHECK_INTERVAL_DAYS: Record<StudioTier, [number, number]> = {
  Indie: [20, 40],
  'Mid-Size': [15, 30],
  Major: [10, 20],
};

const INITIAL_ROSTER_TIERS: StudioTier[] = ['Indie', 'Indie', 'Mid-Size', 'Mid-Size', 'Major', 'Major'];

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
const STARTING_CASH_BY_TIER: Record<StudioTier, number> = {
  Indie: 6_000_000,
  'Mid-Size': 40_000_000,
  Major: 180_000_000,
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

// Roadmap Phase 7.4: a new production nudges its naive release day forward,
// one day at a time, while it's within this many days of another release
// already on the shared calendar (the player's own scheduled projects and
// every other rival's own in-progress production) - a light clustering
// avoidance, not a hard scheduling algorithm. Deliberately small and
// deterministic (no rng spent on it) - just enough that two releases don't
// land on literally the same day by pure chance as often as they otherwise
// would, without trying to actually optimize the calendar.
const RELEASE_DAY_CLUSTER_BUFFER = 3;
const MAX_RELEASE_DAY_NUDGES = 14;

/**
 * Pushes `naiveDay` forward past any day within RELEASE_DAY_CLUSTER_BUFFER
 * of an already-known release - see startRivalProduction below. Pure and
 * rng-free by design: the release-day choice stays fully deterministic
 * given the same inputs, same as everything else about when a rival's
 * production starts.
 */
function avoidReleaseDayClustering(naiveDay: number, knownReleaseDays: number[]): number {
  const occupied = new Set<number>();
  for (const day of knownReleaseDays) {
    for (let d = day - RELEASE_DAY_CLUSTER_BUFFER; d <= day + RELEASE_DAY_CLUSTER_BUFFER; d++) occupied.add(d);
  }
  let day = naiveDay;
  let nudges = 0;
  while (occupied.has(day) && nudges < MAX_RELEASE_DAY_NUDGES) {
    day += 1;
    nudges += 1;
  }
  return day;
}

/** Generates the persistent roster of AI competitors once, at game start - see docs/DESIGN.md 5.24. */
export function generateRivalStudios(rng: RandomFn): RivalStudio[] {
  const usedNames = new Set<string>();
  return INITIAL_ROSTER_TIERS.map((tier, i) => {
    let name = '';
    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = `${pick(rng, RIVAL_STUDIO_NAME_PREFIXES)} ${pick(rng, RIVAL_STUDIO_NAME_SUFFIXES)}`;
      if (!usedNames.has(candidate)) {
        name = candidate;
        usedNames.add(candidate);
        break;
      }
    }
    return {
      id: `rival-studio-${i}`,
      name: name || `Rival Studio ${i + 1}`,
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

/**
 * Casts and plans one rival production - no live shoot, just enough to
 * reserve real talent-pool candidates (bookedUntil) for a believable
 * window and know what to resolve into a Film once releaseDay arrives.
 * Returns null if there genuinely isn't enough available talent for some
 * mandatory role right now (the shared pool is temporarily tapped out), OR
 * (Milestone: AI Studios 2.0) if `rival` can't afford the production's full
 * total commitment - either way the caller just tries again at this
 * studio's next spawn check, same "skip the attempt" fallback either
 * failure already used before affordability existed.
 *
 * The commitment is every real cost this production will ever incur,
 * charged once, in full, right here: script cost (mirrors what
 * ACQUIRE_OPPORTUNITY charges the player for a screenplay - rivals don't
 * go through the Opportunity/Asset pipeline, see docs/DESIGN_REVIEW_development_pipeline.md,
 * so this charges the same underlying script.cost directly rather than
 * fabricating a rival-only Opportunity source), talent salaries + production
 * budget + the full contingency reserve (exactly GREENLIGHT_PROJECT's own
 * upfrontCharge formula, state/studioReducer.ts), and marketing + test
 * screening cost (mirrors what SCHEDULE_RELEASE charges the player as the
 * release-time remainder). A live player production spreads those charges
 * across three separate decisions (acquire, greenlight, release) with a
 * contingency-reserve-vs-actual-burn reconciliation at FINISH_PHOTOGRAPHY in
 * between; a rival production is resolved in one synthesized step
 * (resolveRivalProduction) with no live shoot to reconcile against, so this
 * folds every one of those charges into the single real decision point a
 * rival actually has - deliberately not a full mechanical replica of the
 * player's own multi-stage cash flow, just its total.
 */
function startRivalProduction(
  rival: RivalStudio,
  scale: ProductionScale,
  totalDays: number,
  talentPool: Record<TalentRole, Talent[]>,
  knownReleaseDays: number[],
  rng: RandomFn,
): { production: RivalProductionInProgress; talentPool: Record<TalentRole, Talent[]>; cost: number } | null {
  const genre = pick(rng, GENRES);
  const script = generateScriptOptions(genre, rng, 1)[0];
  const spendT = randFloat(rng, ...SCALE_SPEND_RANGE[scale]);

  const talent: Talent[] = [];
  const bookedIds = new Set<string>();
  for (const role of MANDATORY_TALENT_ROLES) {
    const capacity = effectiveRoleCapacity(role, script);
    const targetPrice = logAmount(spendT, ROLE_GENERATION_PROFILES[role].salaryRange);
    const available = talentPool[role].filter((t) => !t.bookedUntil || t.bookedUntil <= totalDays);
    if (available.length < capacity.min) return null;
    const { candidates } = findCandidatesNearPrice(available, targetPrice, Math.max(capacity.max * 3, 6));
    const picked = pickMany(rng, candidates, Math.min(capacity.max, candidates.length));
    if (picked.length < capacity.min) return null;
    for (const p of picked) bookedIds.add(p.id);
    talent.push(...picked);
  }

  const productionChoices: ProductionChoices = {
    contingencyAmount: logAmount(spendT, CONTINGENCY_RANGE),
    setQualityAmount: logAmount(spendT, SET_QUALITY_RANGE),
    practicalEffectsAmount: logAmount(spendT, PRACTICAL_EFFECTS_RANGE),
    vfxAmount: logAmount(spendT, VFX_RANGE),
    runtimeIntensity: rng(),
  };
  const postProductionChoices: PostProductionChoices = {
    editStyle: pick(rng, EDIT_STYLES),
    musicFocus: pick(rng, MUSIC_FOCI),
    testScreeningResponse: pick(rng, TEST_SCREENING_RESPONSES),
    finalCutFocus: pick(rng, FINAL_CUT_FOCI),
  };
  const marketingChoices: MarketingChoices = {
    marketingSpend: logAmount(spendT, MARKETING_SPEND_RANGE),
    releaseType: pick(rng, RELEASE_TYPES),
    releaseWindow: pick(rng, RELEASE_WINDOWS),
  };

  const cost =
    script.cost +
    computeTalentCost(talent) +
    computeProductionBudgetCost(productionChoices) +
    productionChoices.contingencyAmount +
    computeMarketingCost(marketingChoices) +
    TEST_SCREENING_PROFILES[postProductionChoices.testScreeningResponse].cost;
  if (cost > rival.cash) return null;

  const recommendedDays = computeRecommendedShootDays(talent, script, productionChoices);
  const naiveReleaseDay = totalDays + NON_SHOOT_STAGE_DAYS + recommendedDays;
  // Roadmap Phase 7.4 - reads the shared calendar (the player's own
  // scheduled releases, every other rival's already-in-progress production)
  // instead of picking a day in a vacuum.
  const releaseDay = avoidReleaseDayClustering(naiveReleaseDay, knownReleaseDays);

  const updatedPool = { ...talentPool };
  for (const role of MANDATORY_TALENT_ROLES) {
    updatedPool[role] = updatedPool[role].map((t) => (bookedIds.has(t.id) ? { ...t, bookedUntil: releaseDay } : t));
  }

  return {
    production: {
      id: `rival-prod-${rival.id}-${totalDays}-${randInt(rng, 0, 999_999)}`,
      rivalStudioId: rival.id,
      scale,
      genre,
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
function resolveRivalProduction(production: RivalProductionInProgress, rivalStudioName: string, studioBrand: number, rng: RandomFn): Film {
  const shootingRatio = clamp(randFloat(rng, 0.85, 1.25), 0.5, 2);
  const recommendedDays = computeRecommendedShootDays(production.talent, production.script, production.productionChoices);
  const dailyBurn = computeDailyContingencyBurn(production.productionChoices.contingencyAmount, recommendedDays);
  const photographyCost = Math.round(dailyBurn * recommendedDays * shootingRatio);

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
      events: [],
      photographyCost,
      shootingRatio,
      studioBrand,
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
    events: [],
    results,
    boxOfficeRun: {
      status: 'running',
      fixed,
      simWeeks: [],
      weeks: [],
      cumulativeGross: 0,
      acknowledged: true, // the finished-run popup only ever looks at the player's own films
    },
    releasedOnDay: production.releaseDay,
    releasedBy: rivalStudioName,
  };
}

export interface RivalMarketUpdate {
  rivalStudios: RivalStudio[];
  rivalProductionsInProgress: RivalProductionInProgress[];
  rivalFilmsReleased: Film[];
  talentPool: Record<TalentRole, Talent[]>;
}

/**
 * Settles box office per rival studio, not once across every rival
 * combined - engine/boxOfficeRun.ts:settleBoxOfficeForAllFilms returns one
 * aggregate cashCredit/brandDelta/prestigeDelta for whatever list it's
 * given, so crediting the right studio means grouping first (by
 * `Film.releasedBy`, the only rival-studio correlation a resolved Film
 * carries - see resolveRivalProduction). A studio with no films this call
 * (nothing in `allRivalFilms` matches its name) is returned untouched.
 * Reuses settleBoxOfficeForAllFilms exactly, per group - same weekly
 * settlement, same finished-run brand/prestige computation the player's own
 * films get, just attributed to the studio that actually earned it instead
 * of discarded (Milestone: AI Studios 2.0 - previously every rival's box
 * office ran through this same function with its cash/brand/prestige output
 * simply thrown away, since no rival carried any of those yet).
 */
function settleRivalBoxOffice(
  rivalStudios: RivalStudio[],
  allRivalFilms: Film[],
  totalDays: number,
): { rivalStudios: RivalStudio[]; filmsReleased: Film[] } {
  const filmsByStudioName = new Map<string, Film[]>();
  for (const film of allRivalFilms) {
    const key = film.releasedBy ?? '';
    const list = filmsByStudioName.get(key);
    if (list) list.push(film);
    else filmsByStudioName.set(key, [film]);
  }

  const settledById = new Map<string, Film>();
  const rivalStudiosAfter = rivalStudios.map((rival) => {
    const studioFilms = filmsByStudioName.get(rival.name);
    if (!studioFilms || studioFilms.length === 0) return rival;
    const settlement = settleBoxOfficeForAllFilms(studioFilms, totalDays);
    for (const film of settlement.filmsReleased) settledById.set(film.id, film);
    return {
      ...rival,
      cash: rival.cash + settlement.cashCredit,
      brand: applyStatChange(rival.brand, settlement.brandDelta),
      prestige: applyStatChange(rival.prestige, settlement.prestigeDelta),
      lifetimeRevenue: rival.lifetimeRevenue + settlement.cashCredit,
    };
  });

  return {
    rivalStudios: rivalStudiosAfter,
    // Preserves allRivalFilms' own order rather than the grouped-by-studio
    // order settledById was built in - nothing downstream should care about
    // rival film order, but there's no reason to reshuffle it either.
    filmsReleased: allRivalFilms.map((f) => settledById.get(f.id) ?? f),
  };
}

/**
 * The whole rival-market tick: resolve anything that's released, settle
 * every rival studio's own box office (crediting cash/brand/prestige to the
 * studio that actually earned it - settleRivalBoxOffice above), then let
 * any studio whose spawn-check day has arrived try to start a new
 * production if it has spare capacity AND (Milestone: AI Studios 2.0) can
 * actually afford it - startRivalProduction returns null and this loop
 * falls back to just updating nextSpawnCheckDay exactly the way it already
 * did for a talent-pool shortage, so an unaffordable studio naturally sits
 * out this attempt and tries again at its next spawn check once box office
 * revenue (or a wrapped production freeing up capacity) has had a chance to
 * change the picture. Called from the same places
 * engine/boxOfficeRun.ts:settleBoxOfficeForAllFilms is (see
 * state/studioReducer.ts) - every action that can advance GameState.totalDays.
 * Takes a `RivalMarketUpdate`-shaped `current` rather than a `Studio` -
 * rivalStudios/rivalProductionsInProgress/rivalFilmsReleased are world-level
 * (GameState), not the player's Studio's own business; only `talentPool` is
 * still Studio-shaped (shared with the player, until it too moves world-level).
 * `totalDays` is passed in explicitly for the same reason. `playerScheduledReleaseDays`
 * (roadmap Phase 7.4) is the player's own upcoming release days
 * (engine/project.ts:scheduledPlayerReleases) - threaded through purely so
 * a newly-started rival production can nudge its own naive release day away
 * from ones already on the shared calendar (see startRivalProduction's
 * avoidReleaseDayClustering call) - the player's own choices are never
 * otherwise read or affected here.
 */
export function settleRivalMarket(
  current: RivalMarketUpdate,
  totalDays: number,
  playerScheduledReleaseDays: number[],
  rng: RandomFn,
): RivalMarketUpdate {
  const due = current.rivalProductionsInProgress.filter((p) => p.releaseDay <= totalDays);
  const stillInProgress = current.rivalProductionsInProgress.filter((p) => p.releaseDay > totalDays);
  const newlyReleased = due.map((p) => {
    const rival = current.rivalStudios.find((r) => r.id === p.rivalStudioId);
    return resolveRivalProduction(p, rival?.name ?? 'A Rival Studio', rival?.brand ?? 50, rng);
  });

  const afterBoxOffice = settleRivalBoxOffice(current.rivalStudios, [...current.rivalFilmsReleased, ...newlyReleased], totalDays);

  let talentPool = current.talentPool;
  let productionsInProgress = stillInProgress;
  const rivalStudios = afterBoxOffice.rivalStudios.map((rival) => {
    if (rival.nextSpawnCheckDay > totalDays) return rival;
    const nextSpawnCheckDay = totalDays + randInt(rng, ...SPAWN_CHECK_INTERVAL_DAYS[rival.tier]);
    const currentForThisStudio = productionsInProgress.filter((p) => p.rivalStudioId === rival.id);
    const scales = startableScales(rival.tier, currentForThisStudio);
    if (scales.length === 0) return { ...rival, nextSpawnCheckDay };
    const scale = pick(rng, scales);
    const knownReleaseDays = [...playerScheduledReleaseDays, ...productionsInProgress.map((p) => p.releaseDay)];
    const started = startRivalProduction(rival, scale, totalDays, talentPool, knownReleaseDays, rng);
    if (!started) return { ...rival, nextSpawnCheckDay };
    productionsInProgress = [...productionsInProgress, started.production];
    talentPool = started.talentPool;
    return {
      ...rival,
      nextSpawnCheckDay,
      cash: rival.cash - started.cost,
      lifetimeExpenditure: rival.lifetimeExpenditure + started.cost,
    };
  });

  return {
    rivalStudios,
    rivalProductionsInProgress: productionsInProgress,
    rivalFilmsReleased: afterBoxOffice.filmsReleased,
    talentPool,
  };
}
