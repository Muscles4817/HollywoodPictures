import type {
  Film,
  MarketingChoices,
  PostProductionChoices,
  ProductionChoices,
  ProductionScale,
  RivalProductionInProgress,
  RivalStudio,
  Studio,
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
import { computeDailyContingencyBurn } from './cost';
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
 * mandatory role right now (the shared pool is temporarily tapped out) -
 * the caller just tries again at this studio's next spawn check.
 */
function startRivalProduction(
  rival: RivalStudio,
  scale: ProductionScale,
  studio: Studio,
  talentPool: Record<TalentRole, Talent[]>,
  rng: RandomFn,
): { production: RivalProductionInProgress; talentPool: Record<TalentRole, Talent[]> } | null {
  const genre = pick(rng, GENRES);
  const script = generateScriptOptions(genre, rng, 1)[0];
  const spendT = randFloat(rng, ...SCALE_SPEND_RANGE[scale]);

  const talent: Talent[] = [];
  const bookedIds = new Set<string>();
  for (const role of MANDATORY_TALENT_ROLES) {
    const capacity = effectiveRoleCapacity(role, script);
    const targetPrice = logAmount(spendT, ROLE_GENERATION_PROFILES[role].salaryRange);
    const available = talentPool[role].filter((t) => !t.bookedUntil || t.bookedUntil <= studio.totalDays);
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

  const recommendedDays = computeRecommendedShootDays(talent, script, productionChoices);
  const releaseDay = studio.totalDays + NON_SHOOT_STAGE_DAYS + recommendedDays;

  const updatedPool = { ...talentPool };
  for (const role of MANDATORY_TALENT_ROLES) {
    updatedPool[role] = updatedPool[role].map((t) => (bookedIds.has(t.id) ? { ...t, bookedUntil: releaseDay } : t));
  }

  return {
    production: {
      id: `rival-prod-${rival.id}-${studio.totalDays}-${randInt(rng, 0, 999_999)}`,
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
  };
}

/**
 * Turns a finished rival production into a full Film, via the exact same
 * release-day scoring pipeline the player's own films use
 * (engine/releaseFilm.ts:computeReleaseResults) - a rival's reception,
 * Opening Weekend and legs are computed identically, just from a
 * synthesized shoot instead of a lived one. `shootingRatio` is rolled
 * within a plausible band rather than tracked live, since nobody watches a
 * rival's production happen day by day.
 */
function resolveRivalProduction(production: RivalProductionInProgress, rivalStudioName: string, rng: RandomFn): Film {
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
      studioReputation: 50, // rivals don't carry their own persistent reputation - a flat industry-average stand-in for Buzz
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
 * The whole rival-market tick: resolve anything that's released, settle
 * every rival film's box office (reusing engine/boxOfficeRun.ts exactly -
 * its cash/reputation output is simply discarded here, since none of it is
 * the player's), then let any studio whose spawn-check day has arrived try
 * to start a new production if it has spare capacity. Called from the same
 * places engine/boxOfficeRun.ts:settleBoxOfficeForAllFilms is (see
 * state/studioReducer.ts) - every action that can advance Studio.totalDays.
 */
export function settleRivalMarket(studio: Studio, rng: RandomFn): RivalMarketUpdate {
  const due = studio.rivalProductionsInProgress.filter((p) => p.releaseDay <= studio.totalDays);
  const stillInProgress = studio.rivalProductionsInProgress.filter((p) => p.releaseDay > studio.totalDays);
  const newlyReleased = due.map((p) =>
    resolveRivalProduction(p, studio.rivalStudios.find((r) => r.id === p.rivalStudioId)?.name ?? 'A Rival Studio', rng),
  );

  const afterBoxOffice = settleBoxOfficeForAllFilms([...studio.rivalFilmsReleased, ...newlyReleased], studio.totalDays);

  let talentPool = studio.talentPool;
  let productionsInProgress = stillInProgress;
  const rivalStudios = studio.rivalStudios.map((rival) => {
    if (rival.nextSpawnCheckDay > studio.totalDays) return rival;
    const nextSpawnCheckDay = studio.totalDays + randInt(rng, ...SPAWN_CHECK_INTERVAL_DAYS[rival.tier]);
    const currentForThisStudio = productionsInProgress.filter((p) => p.rivalStudioId === rival.id);
    const scales = startableScales(rival.tier, currentForThisStudio);
    if (scales.length === 0) return { ...rival, nextSpawnCheckDay };
    const scale = pick(rng, scales);
    const started = startRivalProduction(rival, scale, { ...studio, talentPool }, talentPool, rng);
    if (!started) return { ...rival, nextSpawnCheckDay };
    productionsInProgress = [...productionsInProgress, started.production];
    talentPool = started.talentPool;
    return { ...rival, nextSpawnCheckDay };
  });

  return {
    rivalStudios,
    rivalProductionsInProgress: productionsInProgress,
    rivalFilmsReleased: afterBoxOffice.filmsReleased,
    talentPool,
  };
}
