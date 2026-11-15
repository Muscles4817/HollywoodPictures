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
import type { Film } from '../types';

const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
const pct = (n: number, d: number) => d ? Math.round(100 * n / d) + '%' : '-';

it.skipIf(!process.env.PLAYER_ECONOMY_DIAGNOSTIC)('big studio anatomy', () => {
  const seed = Number(process.env.SEED ?? 101);
  const tier = DIFFICULTY_TIERS.find((t) => t.id === (process.env.TIER ?? 'midmajor'))!;
  const start = createBotStudio(seed, tier);
  const run = runBot(seed, tier, BOT_STRATEGIES.find((b) => b.name === (process.env.STRAT ?? 'Careful'))!, 10);
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
