/**
 * Observational harness - THE SHAPE OF THE STAR TIER
 * (docs/DESIGN_REVIEW_star_power.md §5, phase 1).
 *
 * Draw (engine/starPower.ts) is meant to sit in a small top tier: of a
 * 900-actor pool, roughly 15-30 bankable in their best genre, with plenty of
 * famous-but-unproven names below them (docs/domain/17 §4.2). This reports, per
 * generated pool:
 *   - how many actors clear BANKABLE_DRAW, and the draw distribution above 0
 *   - famous-but-unproven: fame >= 80 with best draw under half the bar
 *   - the bankable tier's fame and age mix, and which genres they draw in
 *   - the top ten by draw
 * No box-office effect exists yet; this is the tier only. No assertions.
 *
 *   BOX_OFFICE_DIAGNOSTIC=1 npx vitest run src/engine/starTier.diagnostic.test.ts --disable-console-intercept
 *   (optional: STAR_TIER_SEEDS=1,2,3)
 */
import { describe, it } from 'vitest';
import { generateTalentPool } from './talentGenerator';
import { withRng } from './random';
import { computeStarDrawProfile, leadRecordOf } from './starPower';
import { BANKABLE_DRAW } from '../data/starPower';
import { getPersonAge, type Genre, type Person } from '../types';

const SEEDS = ((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.STAR_TIER_SEEDS ?? '1,2,3')
  .split(',')
  .map(Number);
const enabled = !!(globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.BOX_OFFICE_DIAGNOSTIC;
const GAME_START = { year: 1, month: 1, day: 1 };

const median = (xs: number[]) => {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

describe.skipIf(!enabled)('star tier shape', () => {
  it('reports the bankable tier per pool', () => {
    for (const seed of SEEDS) {
      const pool = withRng(seed, (rng) => generateTalentPool(rng)).result;
      const actors: Person[] = pool.Actor ?? [];
      const rows = actors.map((p) => ({ p, profile: computeStarDrawProfile(p) }));

      const bands = [0, 0.05, 0.15, 0.25, BANKABLE_DRAW, 0.5, 0.7];
      const bandCounts = bands.map((lo, i) => rows.filter((r) => r.profile.best > lo && r.profile.best <= (bands[i + 1] ?? 1.01)).length);
      const zero = rows.filter((r) => r.profile.best === 0).length;
      const bankable = rows.filter((r) => r.profile.best >= BANKABLE_DRAW);
      const famous = rows.filter((r) => r.p.reputation.fame >= 80);
      const famousUnproven = famous.filter((r) => r.profile.best < BANKABLE_DRAW / 2);
      const noRecord = famous.filter((r) => leadRecordOf(r.p).length === 0).length;

      console.log(`\n=== seed ${seed}: ${actors.length} actors ===`);
      console.log(`best draw: 0 -> ${zero}; ${bands.map((lo, i) => `>${lo} -> ${bandCounts[i]}`).join('; ')}`);
      console.log(`bankable (>= ${BANKABLE_DRAW}): ${bankable.length}`);
      console.log(`fame >= 80: ${famous.length}, of whom famous-but-unproven (draw < ${BANKABLE_DRAW / 2}): ${famousUnproven.length}, with no lead record: ${noRecord}`);

      const ages = bankable.map((r) => getPersonAge(r.p.identity.dateOfBirth, GAME_START)).filter((a): a is number => a !== undefined);
      const allAges = actors.map((p) => getPersonAge(p.identity.dateOfBirth, GAME_START)).filter((a): a is number => a !== undefined);
      console.log(
        `bankable tier: median fame ${median(bankable.map((r) => r.p.reputation.fame))}, ` +
          `median age ${median(ages)} (whole pool ${median(allAges)}), ` +
          `over 40: ${ages.filter((a) => a > 40).length}/${ages.length}`,
      );
      const byGenre = new Map<Genre, number>();
      for (const r of bankable) byGenre.set(r.profile.bestGenre, (byGenre.get(r.profile.bestGenre) ?? 0) + 1);
      console.log(`bankable by best genre: ${[...byGenre].map(([g, n]) => `${g} ${n}`).join(', ')}`);

      const top = [...rows].sort((a, b) => b.profile.best - a.profile.best).slice(0, 10);
      for (const r of top) {
        const record = leadRecordOf(r.p);
        console.log(
          `  ${r.profile.best.toFixed(2)} ${r.profile.bestGenre.padEnd(8)} fame ${r.p.reputation.fame} heat ${r.p.reputation.currentHeat} ` +
            `age ${getPersonAge(r.p.identity.dateOfBirth, GAME_START) ?? '?'} outings ${record.length} ${r.p.identity.name}`,
        );
      }
    }
  });
});
