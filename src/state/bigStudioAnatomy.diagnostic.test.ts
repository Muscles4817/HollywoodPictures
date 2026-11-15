// Why big studios cannot lose (docs/DESIGN_REVIEW_player_economy.md §13).
// Observational, opt-in: one bot career, then the player's finished films set
// against rivals' films of the same negative cost released in the same years -
// quality and its parts, reviews, gross and marketing per pound, profitability
// with and without the after-market, and post-theatrical income per rental
// pound with the multipliers behind it. Also every rival's cash, Brand and
// Prestige, start to end.
//
//   PLAYER_ECONOMY_DIAGNOSTIC=1 TIER=midmajor SEED=101 STRAT=Careful \
//     npx vitest run src/state/bigStudioAnatomy.diagnostic.test.ts --disable-console-intercept
import { it } from 'vitest';
import { runBot, createBotStudio, BOT_STRATEGIES } from './playerBot';
import { asFilm } from '../engine/project';
import { DIFFICULTY_TIERS } from '../data/difficulty';
import { ancillaryAttributesFromFilm, deriveAncillaryProfile, summariseFilmAwards } from '../engine/ancillary';
import { inferStudioBrandFromMarketingEfficiency } from '../engine/audienceSimulationInputs';
import { getDirectorCareer, isAvailableImmediately } from '../engine/person';
import { firstDayOfYear } from '../engine/calendar';
import type { GameState } from './gameState';
import type { Film, ProductionEvent } from '../types';

const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
const pct = (n: number, d: number) => d ? Math.round(100 * n / d) + '%' : '-';
/** Nearest-rank 10th percentile. */
const p10 = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.max(0, Math.ceil(0.1 * s.length) - 1)] : NaN; };
const sumQ = (events: ProductionEvent[]) => events.reduce((sum, e) => sum + (e.qualityDelta ?? 0), 0);
/** Net event quality points on a film, split by where they came from (docs/IMPLEMENTATION_PLAN_market_realism.md Phase 0). */
const eventPoints = (f: Film) => {
  const all = [...(f.events ?? []), ...(f.postProductionEvents ?? [])];
  const prep = all.filter((e) => e.id.startsWith('preprod-'));
  const choice = all.filter((e) => !e.id.startsWith('preprod-') && e.description.includes(' You chose: '));
  const rest = all.filter((e) => !prep.includes(e) && !choice.includes(e));
  return { net: sumQ(all), prep: sumQ(prep), choice: sumQ(choice), rest: sumQ(rest) };
};

it.skipIf(!process.env.PLAYER_ECONOMY_DIAGNOSTIC)('big studio anatomy', () => {
  const seed = Number(process.env.SEED ?? 101);
  const tier = DIFFICULTY_TIERS.find((t) => t.id === (process.env.TIER ?? 'midmajor'))!;
  const start = createBotStudio(seed, tier);
  // On one sampled day a year (mid-year), the share of the top tenth of
  // directors by true skill who are booked and cannot start now.
  const directorSamples: string[] = [];
  let nextSample = 1;
  const sampleDirectors = (st: GameState) => {
    if (st.totalDays < firstDayOfYear(nextSample) + 182) return;
    const ranked = (st.talentPool.Director ?? []).map((p) => ({ p, skill: getDirectorCareer(p)?.skill ?? 0 })).sort((a, b) => b.skill - a.skill);
    const top = ranked.slice(0, Math.max(1, Math.ceil(ranked.length / 10)));
    directorSamples.push(`Y${nextSample} ${pct(top.filter(({ p }) => !isAvailableImmediately(p, st.totalDays)).length, top.length)}`);
    nextSample += 1;
  };
  const run = runBot(seed, tier, BOT_STRATEGIES.find((b) => b.name === (process.env.STRAT ?? 'Careful'))!, 10, sampleDirectors);
  const s = run.finalState;
  const films = s.projects.map(asFilm).filter((f): f is Film => !!f && f.boxOfficeRun.status === 'finished');
  const mine = films.filter((f) => f.releasedBy === undefined);
  const theirs = films.filter((f) => f.releasedBy !== undefined);
  const bands: Array<[string, number, number]> = [['<10M', 0, 10e6], ['10-40M', 10e6, 40e6], ['40-100M', 40e6, 100e6], ['100M+', 100e6, 1e12]];
  const neg = (f: Film) => f.results.productionCost;
  const row = (label: string, fs: Film[]) => {
    if (!fs.length) return `  ${label.padEnd(7)} n=0`;
    return `  ${label.padEnd(7)} n=${String(fs.length).padStart(3)} q${med(fs.map((f) => f.results.qualityScore)).toFixed(0)} crit${med(fs.map((f) => f.results.criticScore)).toFixed(0)} aud${med(fs.map((f) => f.results.audienceScore)).toFixed(0)} script${med(fs.map((f) => f.results.scriptScore)).toFixed(0)} dir${med(fs.map((f) => f.results.directionScore)).toFixed(0)} act${med(fs.map((f) => f.results.actingScore)).toFixed(0)}` +
      ` gross/neg ${med(fs.map((f) => (f.results.totalBoxOffice ?? 0) / Math.max(1, neg(f)))).toFixed(2)} mkt/neg ${med(fs.map((f) => f.results.marketingCost / Math.max(1, neg(f)))).toFixed(2)} keep/gross ${med(fs.map((f) => (f.results.studioRevenue ?? 0) / Math.max(1, f.results.totalBoxOffice ?? 1))).toFixed(2)}` +
      ` profitable ${pct(fs.filter((f) => (f.results.profit ?? 0) > 0).length, fs.length)} +aftermkt ${pct(fs.filter((f) => (f.results.profit ?? 0) + (f.results.expectedAfterMarket ?? 0) > 0).length, fs.length)} aftermkt/neg ${med(fs.map((f) => (f.results.expectedAfterMarket ?? 0) / Math.max(1, neg(f)))).toFixed(2)} wide ${pct(fs.filter((f) => f.marketingChoices.releaseType === 'Wide').length, fs.length)}`;
  };
  for (const [label, lo, hi] of bands) {
    console.log(row('YOU ' + label, mine.filter((f) => neg(f) >= lo && neg(f) < hi)));
    console.log(row('RIV ' + label, theirs.filter((f) => neg(f) >= lo && neg(f) < hi)));
  }
  // Craft and luck: production and post scores, and the net quality points
  // events added (prep / decisions / the rest), per budget band.
  const craft = (label: string, fs: Film[]) => {
    if (!fs.length) return `  ${label.padEnd(11)} n=0`;
    const pts = fs.map(eventPoints);
    return `  ${label.padEnd(11)} n=${String(fs.length).padStart(3)} prod${med(fs.map((f) => f.results.productionScore)).toFixed(0)} post${med(fs.map((f) => f.results.postProductionScore)).toFixed(0)}` +
      ` events net med ${med(pts.map((p) => p.net)).toFixed(1)} p10 ${p10(pts.map((p) => p.net)).toFixed(1)}` +
      ` | prep med ${med(pts.map((p) => p.prep)).toFixed(1)} choice med ${med(pts.map((p) => p.choice)).toFixed(1)} rest med ${med(pts.map((p) => p.rest)).toFixed(1)}`;
  };
  console.log('craft and event points:');
  for (const [label, lo, hi] of bands) {
    console.log(craft('YOU ' + label, mine.filter((f) => neg(f) >= lo && neg(f) < hi)));
    console.log(craft('RIV ' + label, theirs.filter((f) => neg(f) >= lo && neg(f) < hi)));
  }
  console.log(craft('YOU all', mine));
  console.log(craft('RIV all', theirs));
  const rivalWide = theirs.filter((f) => f.marketingChoices.releaseType === 'Wide');
  const wideBrands = rivalWide.map((f) => inferStudioBrandFromMarketingEfficiency(f.boxOfficeRun.fixed.marketingEfficiency));
  console.log(`rival wide releases: n=${wideBrands.length} release-weighted mean Brand ${(wideBrands.reduce((a, b) => a + b, 0) / Math.max(1, wideBrands.length)).toFixed(1)}`);
  console.log(`top-tenth directors unavailable (sampled mid-year): ${directorSamples.join(', ')}`);
  console.log('player cash', (start.studio.cash / 1e6).toFixed(0), '->', (s.studio.cash / 1e6).toFixed(0), 'brand', s.studio.brand, 'prestige', s.studio.prestige, 'arm', JSON.stringify(s.studio.distributionArm));
  for (const r of s.rivalStudios) {
    const r0 = start.rivalStudios.find((x) => x.id === r.id)!;
    console.log(`  rival ${r.name.padEnd(22)} ${r.tier.padEnd(8)} cash ${(r0.cash / 1e6).toFixed(0)}->${(r.cash / 1e6).toFixed(0)} brand ${r0.brand}->${r.brand} prestige ${r0.prestige}->${r.prestige} films ${theirs.filter((f) => f.releasedBy === r.name).length}`);
  }
  const side = (label: string, fs: Film[]) => {
    const views = fs.filter((f) => f.results.totalBoxOffice != null).map((f) => {
      const prestige = f.releasedBy ? (s.rivalStudios.find((r) => r.name === f.releasedBy)?.prestige ?? 50) : s.studio.prestige;
      const attrs = ancillaryAttributesFromFilm(f, { studioPrestige: prestige, awards: summariseFilmAwards(s.awards?.history ?? [], f.id) });
      return { f, v: { profile: deriveAncillaryProfile(attrs, f.results.totalBoxOffice!) } };
    });
    const rentals = views.reduce((sum, x) => sum + (x.f.results.studioRevenue ?? 0), 0);
    const after = views.reduce((sum, x) => sum + x.v!.profile.lifetimeTotal, 0);
    const lic = med(views.map((x) => x.v!.profile.multipliers.licensing));
    const home = med(views.map((x) => x.v!.profile.multipliers.homeEntertainment));
    const lon = med(views.map((x) => x.v!.profile.multipliers.longevity));
    const reachPerGross = med(views.map((x) => x.v!.profile.reachBase / Math.max(1, x.f.results.totalBoxOffice ?? 1)));
    console.log(`  ${label} after-market/rentals ${(after / Math.max(1, rentals)).toFixed(2)} licensingMult ${lic.toFixed(2)} homeMult ${home.toFixed(2)} longevity ${lon.toFixed(2)} reach/gross ${reachPerGross.toFixed(2)} medGross ${(med(views.map((x) => x.f.results.totalBoxOffice ?? 0)) / 1e6).toFixed(0)}M`);
  };
  side('YOU', mine);
  side('RIV', theirs);
  console.log('cashflow', JSON.stringify(Object.fromEntries(Object.entries(run.cashFlow).map(([k, v]) => [k, Math.round(v / 1e6)]))));
}, 600000);
