/**
 * Empirical diagnostic for AI rival studio *outcomes* - how often their films
 * turn a profit, and what quality / critic / audience scores they actually
 * ship - plus an awards-season analysis that quantifies two suspected bugs:
 *
 *   1. AI studios never hire a VFX Supervisor, so Best Visual Effects has zero
 *      rival contenders (only the player can ever be nominated).
 *   2. A competently-made player film is nominated / wins almost regardless of
 *      what else the player does, because the AI field it competes against is
 *      systematically weak (and the player alone gets a campaign boost).
 *
 * Like rivalStudios.diagnostic.test.ts, this drives the real settlement loop
 * (the same functions state/studioReducer.ts:runCalendarSettlement calls each
 * day, in the same order) headlessly over many in-game years and seeds, then
 * prints a report. It asserts nothing - it's an analysis harness. Run it with:
 *
 *   AI_STATS_DIAGNOSTIC=1 npx vitest run src/engine/aiStudioStats.diagnostic.test.ts
 *
 * Findings are written up in docs/DESIGN_REVIEW_ai_studio_awards_analysis.md.
 */
import { describe, it } from 'vitest';
import { generateRivalStudios, settleRivalMarket, type RivalMarketUpdate } from './rivalStudios';
import { settleTheatricalMarket } from './marketSettlement';
import { generateTalentPool } from './talentGenerator';
import { settleOpportunities } from './opportunities';
import { computeCeremony, accrueMomentum } from './awards';
import { yearOf } from './calendar';
import { withRng, type RandomFn } from './random';
import { AWARD_SHOWS, awardShow } from '../data/awardsShows';
import { AWARD_CATEGORIES, AWARD_CATEGORY_LABEL } from '../data/awards';
import type {
  AwardCategory,
  Film,
  Person,
  RivalProductionInProgress,
  RivalStudio,
} from '../types';

const YEARS = 15;
const DAYS_PER_YEAR = 365;
const HORIZON = YEARS * DAYS_PER_YEAR;
const SEEDS = 12;

// A representative player awards campaign, for the player-injection experiment
// below. campaignBoost(2,000,000) = 8 * (1 - e^-1) ~= 5.05 award-score points.
const PLAYER_CAMPAIGN = 2_000_000;
// The player's own studio Prestige - a fresh studio starts at 20
// (gameState.ts:createInitialStudio); the prestige nudge caps at +3 anyway.
const PLAYER_PRESTIGE = 20;
// Rivals in this harness aren't tracked per-film for the awards nudge; a mid
// field Prestige is a fair stand-in (the nudge caps at +3, so it barely moves
// anything - see engine/awards.ts:prestigeNudge).
const RIVAL_PRESTIGE = 45;

// ---------------------------------------------------------------------------
// Slim per-film record we actually keep (the full Film objects are dropped as
// soon as their run finishes, to stay fast over a 15-year horizon).
// ---------------------------------------------------------------------------
interface FilmRecord {
  film: Film; // kept whole - the awards experiment re-scores real talent/scripts
  profit: number;
  profitable: boolean;
  outcome: string;
  quality: number;
  critic: number;
  audience: number;
  hadVfxSupervisor: boolean;
  executionRating: string; // Phase 2 - rivals now carry a production-execution outcome
  eventCount: number;
  year: number;
}

function recordFinished(film: Film): FilmRecord {
  const r = film.results;
  return {
    film,
    profit: r.profit ?? 0,
    profitable: (r.profit ?? 0) > 0,
    outcome: r.outcome ?? 'unknown',
    quality: r.qualityScore,
    critic: r.criticScore,
    audience: r.audienceScore,
    hadVfxSupervisor: film.talent.some((t) => t.role === 'VFX Supervisor'),
    executionRating: r.productionExecution?.rating ?? 'none',
    eventCount: film.events.length,
    year: yearOf(film.releasedOnDay),
  };
}

/** One seed's worth of finished rival films, plus a VFX Supervisor person for the awards experiment. */
function runOneSeed(seed: number): { films: FilmRecord[]; vfxPerson: Person | null } {
  return withRng(seed, (rng: RandomFn) => {
    let rivalStudios: RivalStudio[] = generateRivalStudios(rng);
    let talentPool = generateTalentPool(rng);
    const vfxPerson = talentPool['VFX Supervisor'][0] ?? null;
    const initialOpp = settleOpportunities([], 1, 1, rng);
    let opportunities = initialOpp.opportunities;
    let nextOpportunityCheckDay = initialOpp.nextGenerationCheckDay;
    let productionsInProgress: RivalProductionInProgress[] = [];
    let runningFilms: Film[] = [];

    const recorded = new Set<string>();
    const films: FilmRecord[] = [];

    for (let day = 2; day <= HORIZON; day++) {
      const marketSettlement = settleTheatricalMarket(runningFilms, [], productionsInProgress, rivalStudios, day, 20, rng);

      // Capture every rival film the moment its box-office run finishes - that's
      // when profit / outcome become knowable (engine/boxOfficeRun.ts:finishFilm).
      for (const f of marketSettlement.settledFilms) {
        if (f.releasedBy === undefined) continue; // player has none in this harness
        if (f.boxOfficeRun.status !== 'finished') continue;
        if (recorded.has(f.id)) continue;
        recorded.add(f.id);
        films.push(recordFinished(f));
      }

      rivalStudios = rivalStudios.map((rival) => {
        const delta = marketSettlement.rivalDeltas.get(rival.name);
        if (!delta) return rival;
        return {
          ...rival,
          cash: rival.cash + delta.cashCredit,
          brand: Math.max(0, Math.min(100, rival.brand + delta.brandDelta)),
          prestige: Math.max(0, Math.min(100, rival.prestige + delta.prestigeDelta)),
          lifetimeRevenue: rival.lifetimeRevenue + delta.cashCredit,
        };
      });

      const oppSettlement = settleOpportunities(opportunities, nextOpportunityCheckDay, day, rng);
      const rivalBids = oppSettlement.resolvedBids.filter((b) => b.winnerId !== 'player');

      const current: RivalMarketUpdate = {
        rivalStudios,
        rivalProductionsInProgress: marketSettlement.stillInProgress,
        rivalFilmsReleased: marketSettlement.settledFilms.filter((f) => f.releasedBy !== undefined),
        talentPool,
        opportunities: oppSettlement.opportunities,
      };
      const rivalMarket = settleRivalMarket(current, rivalBids, day, [], rng);

      rivalStudios = rivalMarket.rivalStudios;
      productionsInProgress = rivalMarket.rivalProductionsInProgress;
      talentPool = rivalMarket.talentPool;
      opportunities = rivalMarket.opportunities;
      nextOpportunityCheckDay = oppSettlement.nextGenerationCheckDay;
      runningFilms = rivalMarket.rivalFilmsReleased.filter((f) => f.boxOfficeRun.status !== 'finished');
    }

    return { films, vfxPerson };
  }).result;
}

// --- basic stats helpers ---------------------------------------------------
function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[idx];
}
function pct(n: number, total: number): string {
  return total ? `${((n / total) * 100).toFixed(1)}%` : '0%';
}

// ---------------------------------------------------------------------------
// Awards experiment: run the real 4-show season over the year's rival field,
// optionally with a synthetic player film injected at a chosen quality tier,
// and report what the player film wins.
// ---------------------------------------------------------------------------

/** Clone a real finished rival film into a player-owned film at a uniform score tier, with a VFX Supervisor attached. */
function makeSyntheticPlayerFilm(template: Film, tier: number, vfxPerson: Person | null, year: number): Film {
  const talent = [...template.talent];
  if (vfxPerson && !talent.some((t) => t.role === 'VFX Supervisor')) {
    talent.push({ role: 'VFX Supervisor', person: vfxPerson });
  }
  return {
    ...template,
    id: `player-synthetic-${year}`,
    releasedBy: undefined, // player-owned
    talent,
    results: {
      ...template.results,
      qualityScore: tier,
      criticScore: tier,
      audienceScore: tier,
      scriptScore: tier,
      directionScore: tier,
      actingScore: tier,
      productionScore: tier,
      postProductionScore: tier,
    },
  };
}

/** Run a full season (all 4 shows, momentum accrued in order) and return the final Academy ceremony's nominations by category. */
function runSeason(
  eligibleFilms: Film[],
  campaignByFilm: Record<string, number>,
  year: number,
  rng: RandomFn,
): Record<AwardCategory, { nominees: string[]; winner: string | undefined }> {
  let momentum: Record<string, number> = {};
  let academyCeremony = null as ReturnType<typeof computeCeremony> | null;
  for (const show of AWARD_SHOWS) {
    const profile = awardShow(show.id);
    const ceremony = computeCeremony({
      show: show.id,
      categories: profile.categories,
      year,
      ceremonyDay: year * DAYS_PER_YEAR,
      eligibleFilms,
      campaignByFilm,
      studioPrestigeForFilm: (f: Film) => (f.releasedBy === undefined ? PLAYER_PRESTIGE : RIVAL_PRESTIGE),
      momentum,
      rng,
    });
    const delta = accrueMomentum(ceremony, profile.momentumWeight);
    const next = { ...momentum };
    for (const [k, v] of Object.entries(delta)) next[k] = (next[k] ?? 0) + v;
    momentum = next;
    if (show.id === 'academy') academyCeremony = ceremony;
  }
  const out = {} as Record<AwardCategory, { nominees: string[]; winner: string | undefined }>;
  for (const cat of AWARD_CATEGORIES) {
    const noms = academyCeremony?.categories[cat] ?? [];
    out[cat] = {
      nominees: noms.map((n) => n.filmId),
      winner: noms.find((n) => n.won)?.filmId,
    };
  }
  return out;
}

const diagnosticEnabled = Boolean(
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.AI_STATS_DIAGNOSTIC,
);

describe.skipIf(!diagnosticEnabled)('AI studio outcome & awards diagnostic', () => {
  it('reports profitability, quality/critic/audience scores, and awards concentration', () => {
    const allFilms: FilmRecord[] = [];
    const perSeedFilms: FilmRecord[][] = [];
    const vfxPersons: (Person | null)[] = [];
    for (let s = 0; s < SEEDS; s++) {
      const { films, vfxPerson } = runOneSeed(2000 + s);
      allFilms.push(...films);
      perSeedFilms.push(films);
      vfxPersons.push(vfxPerson);
    }

    const lines: string[] = [];
    const N = allFilms.length;
    lines.push(`\n=== AI STUDIO OUTCOME & AWARDS DIAGNOSTIC (${SEEDS} seeds x ${YEARS} in-game years) ===\n`);
    lines.push(`Rival films with a finished box-office run analysed: ${N}\n`);

    // --- 1. Profitability ---------------------------------------------------
    const profitable = allFilms.filter((f) => f.profitable).length;
    lines.push('PROFITABILITY');
    lines.push(`  Films turning a profit (studioRevenue > totalCost): ${profitable}/${N} = ${pct(profitable, N)}`);
    const outcomes = new Map<string, number>();
    for (const f of allFilms) outcomes.set(f.outcome, (outcomes.get(f.outcome) ?? 0) + 1);
    lines.push('  Outcome label distribution:');
    for (const [label, count] of [...outcomes.entries()].sort((a, b) => b[1] - a[1])) {
      lines.push(`    ${label.padEnd(14)} ${String(count).padStart(5)}  ${pct(count, N)}`);
    }

    // --- 2. Quality / critic / audience scores ------------------------------
    const quality = allFilms.map((f) => f.quality);
    const critic = allFilms.map((f) => f.critic);
    const audience = allFilms.map((f) => f.audience);
    lines.push('\nSCORE DISTRIBUTIONS (0-100)');
    lines.push(`  ${'metric'.padEnd(10)} ${'mean'.padStart(6)} ${'p10'.padStart(5)} ${'p25'.padStart(5)} ${'median'.padStart(7)} ${'p75'.padStart(5)} ${'p90'.padStart(5)}`);
    for (const [name, xs] of [['quality', quality], ['critic', critic], ['audience', audience]] as const) {
      lines.push(
        `  ${name.padEnd(10)} ${mean(xs).toFixed(1).padStart(6)} ${percentile(xs, 10).toFixed(0).padStart(5)} ${percentile(xs, 25).toFixed(0).padStart(5)} ${percentile(xs, 50).toFixed(0).padStart(7)} ${percentile(xs, 75).toFixed(0).padStart(5)} ${percentile(xs, 90).toFixed(0).padStart(5)}`,
      );
    }
    // Per-department sub-score spread - which departments actually vary, and
    // which are pinned (the "consistency" question). Also reports each
    // department's analytic leverage on the final qualityScore.
    const stdev = (xs: number[]): number => {
      const m = mean(xs);
      return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
    };
    const subScores: [string, number[]][] = [
      ['script', allFilms.map((f) => f.film.results.scriptScore)],
      ['direction', allFilms.map((f) => f.film.results.directionScore)],
      ['acting', allFilms.map((f) => f.film.results.actingScore)],
      ['production', allFilms.map((f) => f.film.results.productionScore)],
      ['postProd', allFilms.map((f) => f.film.results.postProductionScore)],
      ['events', allFilms.map((f) => f.film.results.eventsScore)],
    ];
    lines.push('\nPER-DEPARTMENT SUB-SCORES (raw, pre-dependency-chain)');
    lines.push(`  ${'dept'.padEnd(11)} ${'mean'.padStart(6)} ${'stdev'.padStart(6)} ${'p10'.padStart(5)} ${'p90'.padStart(5)}   note`);
    const notes: Record<string, string> = {
      script: 'top-level weight ~0.25',
      direction: 'top-level ~0.25 + drives the whole chain',
      acting: 'top-level weight ~0.25',
      production: 'NO top-level weight; ~0.02 quality/pt (cosmetic)',
      postProd: 'top-level ~0.25 but base 55 (compressed)',
      events: 'display-only; real path folds into Production (cosmetic)',
    };
    for (const [name, xs] of subScores) {
      lines.push(
        `  ${name.padEnd(11)} ${mean(xs).toFixed(1).padStart(6)} ${stdev(xs).toFixed(1).padStart(6)} ${percentile(xs, 10).toFixed(0).padStart(5)} ${percentile(xs, 90).toFixed(0).padStart(5)}   ${notes[name]}`,
      );
    }
    lines.push('  (A full-range swing in Production moves qualityScore ~2 pts; on-set');
    lines.push('   event deltas fold into Production 1:1, so a disastrous shoot ~= cosmetic.)');

    const qGe70 = quality.filter((q) => q >= 70).length;
    const qGe80 = quality.filter((q) => q >= 80).length;
    const cGe70 = critic.filter((c) => c >= 70).length;
    const cGe80 = critic.filter((c) => c >= 80).length;
    lines.push(`  Quality >= 70: ${pct(qGe70, N)}   >= 80: ${pct(qGe80, N)}`);
    lines.push(`  Critic  >= 70: ${pct(cGe70, N)}   >= 80: ${pct(cGe80, N)}`);

    // --- 2b. Rival production execution (Phase 2) ---------------------------
    lines.push('\nRIVAL PRODUCTION EXECUTION (Phase 2 - rivals now run the shared execution pipeline)');
    const RATINGS = ['catastrophic', 'troubled', 'solid', 'strong', 'exceptional'];
    const ratingCounts = new Map<string, number>();
    for (const f of allFilms) ratingCounts.set(f.executionRating, (ratingCounts.get(f.executionRating) ?? 0) + 1);
    lines.push(`  avg on-set events per rival film: ${mean(allFilms.map((f) => f.eventCount)).toFixed(1)}`);
    lines.push('  execution rating distribution:');
    for (const r of RATINGS) lines.push(`    ${r.padEnd(13)} ${pct(ratingCounts.get(r) ?? 0, N)}`);
    const catastrophic = ratingCounts.get('catastrophic') ?? 0;
    const exceptional = ratingCounts.get('exceptional') ?? 0;
    lines.push(`  => catastrophic ${pct(catastrophic, N)} | exceptional ${pct(exceptional, N)}`);
    // Quality band of the finished rival film (data/reviewBlurbs.ts:reviewBand).
    const BANDS = ['savaged', 'poor', 'mixed', 'solid', 'excellent', 'triumph'] as const;
    const bandOf = (q: number) => (q < 25 ? 'savaged' : q < 45 ? 'poor' : q < 60 ? 'mixed' : q < 75 ? 'solid' : q < 90 ? 'excellent' : 'triumph');
    const bandCounts = new Map<string, number>();
    for (const q of quality) bandCounts.set(bandOf(q), (bandCounts.get(bandOf(q)) ?? 0) + 1);
    lines.push('  finished quality band: ' + BANDS.map((b) => `${b} ${pct(bandCounts.get(b) ?? 0, N)}`).join('  '));
    lines.push('  (Compare vs the pre-Phase-2 neutral rival model: quality mean ~56, p90 ~63, max ~74,');
    lines.push('   with 0 on-set events and no execution variance at all.)');

    // --- 3. VFX Supervisor hiring (bug 1) -----------------------------------
    const withVfx = allFilms.filter((f) => f.hadVfxSupervisor).length;
    lines.push('\nVFX SUPERVISOR HIRING (bug 1)');
    lines.push(`  Rival films that hired a VFX Supervisor: ${withVfx}/${N} = ${pct(withVfx, N)}`);
    lines.push(
      withVfx === 0
        ? '  => Best Visual Effects has no rival contenders; only the player can be nominated.'
        : '  => Best Visual Effects is contested; see the awards table for the player win rate.',
    );

    // --- 4. Awards concentration (bug 2) ------------------------------------
    // The AI ceiling is ~67 (see the score distribution above - essentially no
    // rival film reaches quality 70). So the real question is: how good does a
    // *player* film have to be before it sweeps? We inject a synthetic player
    // film at a sweep of absolute quality tiers and measure its Oscar haul
    // against the real AI field, with the standard player-only campaign boost.
    const TIERS = [60, 65, 70, 75, 85];
    const filmsPerYear = allFilms.length / (SEEDS * YEARS);
    lines.push('\nAWARDS: SYNTHETIC PLAYER FILM vs THE AI FIELD (bug 2)');
    lines.push(`  AI field ~${filmsPerYear.toFixed(0)} films/year; 5 nominees/category; campaign = £${PLAYER_CAMPAIGN.toLocaleString()} (boost ~5 pts).`);
    lines.push(`  Player film scored uniformly at each tier. AI quality: mean ${mean(quality).toFixed(0)}, p90 ${percentile(quality, 90).toFixed(0)}, max ${Math.max(...quality).toFixed(0)}.`);

    // noms[cat][tier] / wins[cat][tier]
    const noms = {} as Record<AwardCategory, number[]>;
    const wins = {} as Record<AwardCategory, number[]>;
    for (const cat of AWARD_CATEGORIES) {
      noms[cat] = TIERS.map(() => 0);
      wins[cat] = TIERS.map(() => 0);
    }
    let categoryYears = 0;

    let seasonRng!: RandomFn;
    withRng(999, (rng) => { seasonRng = rng; });

    for (let s = 0; s < SEEDS; s++) {
      const vfxPerson = vfxPersons[s];
      const byYear = new Map<number, Film[]>();
      for (const rec of perSeedFilms[s]) {
        const arr = byYear.get(rec.year) ?? [];
        arr.push(rec.film);
        byYear.set(rec.year, arr);
      }
      for (const [year, rivalFilms] of byYear) {
        if (rivalFilms.length === 0) continue;
        categoryYears += 1;
        const template = rivalFilms[0];
        TIERS.forEach((tier, ti) => {
          const player = makeSyntheticPlayerFilm(template, tier, vfxPerson, year);
          const eligible = [...rivalFilms, player];
          const result = runSeason(eligible, { [player.id]: PLAYER_CAMPAIGN }, year, seasonRng);
          for (const cat of AWARD_CATEGORIES) {
            if (result[cat].nominees.includes(player.id)) noms[cat][ti] += 1;
            if (result[cat].winner === player.id) wins[cat][ti] += 1;
          }
        });
      }
    }

    lines.push(`\n  Category-years evaluated: ${categoryYears}`);
    lines.push('  NOMINATION rate for a player film scored at each tier:');
    lines.push(`  ${'category'.padEnd(24)} ${TIERS.map((t) => String(t).padStart(6)).join('')}`);
    for (const cat of AWARD_CATEGORIES) {
      lines.push(`  ${AWARD_CATEGORY_LABEL[cat].padEnd(24)} ${TIERS.map((_, ti) => pct(noms[cat][ti], categoryYears).padStart(6)).join('')}`);
    }
    lines.push('\n  WIN rate for a player film scored at each tier:');
    lines.push(`  ${'category'.padEnd(24)} ${TIERS.map((t) => String(t).padStart(6)).join('')}`);
    for (const cat of AWARD_CATEGORIES) {
      lines.push(`  ${AWARD_CATEGORY_LABEL[cat].padEnd(24)} ${TIERS.map((_, ti) => pct(wins[cat][ti], categoryYears).padStart(6)).join('')}`);
    }
    // Any-category haul: how many of the 11 Oscars a player film takes home.
    lines.push('\n  Player films\'s total Oscar haul (of 11 categories), by tier:');
    for (let ti = 0; ti < TIERS.length; ti++) {
      const totalNoms = AWARD_CATEGORIES.reduce((sum, cat) => sum + noms[cat][ti], 0);
      const totalWins = AWARD_CATEGORIES.reduce((sum, cat) => sum + wins[cat][ti], 0);
      lines.push(`    tier ${String(TIERS[ti]).padStart(3)}: avg ${(totalNoms / categoryYears).toFixed(1)} nominations, ${(totalWins / categoryYears).toFixed(1)} wins per year`);
    }

    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
  }, 300_000);
});
