/**
 * Empirical diagnostic for the Acting Model (docs/DESIGN_REVIEW_acting_model.md
 * §13). Generates a large procedural actor slate across the full salary/fame
 * range and reports, with no rebalancing:
 *
 *   1. fame vs craft correlation - must be ~zero (fame != craft): the generator
 *      draws actingStyle from rng alone, never the salary band, and craft
 *      derives from style, so a famous actor has no automatic craft edge.
 *   2. realized-performance distribution by actor ARCHETYPE (dependable pro /
 *      auteur-magnet / all-rounder) x DIRECTOR TYPE (none / hands-off /
 *      matched hands-on / mismatched hands-on), roleFit held at 100 to isolate
 *      direction - shows the floor delivered self-directed, the headroom a
 *      matched hands-on director unlocks, and the below-floor a mis-aimed one
 *      forces.
 *   3. the archetype curves crossing: the pro leads self-directed, the magnet
 *      leads with its ideal director.
 *
 * Opt-in (skipped in the normal suite):
 *   AI_ACTING_DIAGNOSTIC=1 npx vitest run src/engine/actingModel.diagnostic.test.ts --disable-console-intercept
 */
import { describe, it } from 'vitest';
import { generateTalentCandidates } from './talentGenerator';
import { actorCraft, computeRealizedPerformance } from './actingModel';
import { deriveToneFromActingStyle } from './compatibility';
import { getActorCareer } from './person';
import { withRng } from './random';
import type { ActingStyle, Person, ToneProfile } from '../types';

const ACTORS = 4000;
const FULL_FIT = 100;

function mean(xs: number[]): number { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }
function stdev(xs: number[]): number { const m = mean(xs); return xs.length ? Math.sqrt(mean(xs.map((x) => (x - m) ** 2))) : 0; }
function pearson(xs: number[], ys: number[]): number {
  const mx = mean(xs), my = mean(ys);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < xs.length; i++) { const a = xs[i] - mx, b = ys[i] - my; num += a * b; dx += a * a; dy += b * b; }
  return dx && dy ? num / Math.sqrt(dx * dy) : 0;
}
function pctile(xs: number[], p: number): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))))];
}

/** A director whose tone IS the actor's derived tone - a perfect aim. */
function matchedDirector(style: ActingStyle, skill: number, handsOn: number): Person {
  return synthDirector('m', deriveToneFromActingStyle(style), skill, handsOn);
}
/** A director pouring all weight on the actor's weakest tone - a confident wrong read. */
function mismatchedDirector(style: ActingStyle, skill: number, handsOn: number): Person {
  const tone = deriveToneFromActingStyle(style);
  const tones = Object.keys(tone) as Array<keyof ToneProfile>;
  const weakest = tones.reduce((w, t) => (tone[t] < tone[w] ? t : w), tones[0]);
  const profile = {} as ToneProfile;
  for (const t of tones) profile[t] = t === weakest ? 100 : 0;
  return synthDirector('x', profile, skill, handsOn);
}
function synthDirector(id: string, toneProfile: ToneProfile, skill: number, handsOn: number): Person {
  return {
    id: `diag-dir-${id}`,
    identity: { name: id, appearanceTags: [] },
    personality: { professionalism: 50, ambition: 50, loyalty: 50, ego: 50, temperament: 50, pressureHandling: 50, controversy: 50, adaptability: 50 },
    reputation: { fame: 50, prestige: 50, industryRespect: 50, reliability: 50, currentHeat: 50 },
    availability: { commitments: [] },
    traits: [],
    primaryRole: 'Director',
    careers: {
      director: {
        role: 'Director',
        active: true,
        experience: skill,
        roleReputation: 50,
        minimumSalary: 1,
        typicalSalary: 1,
        skill: skill,
        toneProfile: toneProfile,
        productionStyle: { environmentStrategy: { studio: 1, location: 0, digital: 0 }, effectsStrategy: { practical: 1, digital: 0 } },
        handsOn: handsOn,
      },
    },
  };
}

type Archetype = 'pro' | 'magnet' | 'allrounder';
function archetypeOf(floor: number, headroom: number): Archetype {
  if (headroom >= 25) return 'magnet';
  if (floor >= 60 && headroom < 15) return 'pro';
  return 'allrounder';
}

const enabled = Boolean((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.AI_ACTING_DIAGNOSTIC);

describe.skipIf(!enabled)('Acting Model diagnostic (craft distribution, fame decoupling, direction leverage)', () => {
  it('reports fame/craft correlation and realized performance by archetype x director', () => {
    const actors = withRng(4242, (rng) => generateTalentCandidates('Actor', rng, ACTORS, [0, 1])).result;

    const fame: number[] = [], floors: number[] = [], heads: number[] = [], ceilings: number[] = [];
    const byArch: Record<Archetype, Person[]> = { pro: [], magnet: [], allrounder: [] };
    for (const a of actors) {
      const { floor, headroom } = actorCraft(a);
      fame.push(a.reputation.fame); floors.push(floor); heads.push(headroom); ceilings.push(floor + headroom);
      byArch[archetypeOf(floor, headroom)].push(a);
    }

    const lines: string[] = [];
    lines.push(`\n=== ACTING MODEL DIAGNOSTIC (${ACTORS} procedural actors, full salary/fame range) ===\n`);

    lines.push('FAME vs CRAFT CORRELATION (must be ~0 - fame != craft)');
    lines.push(`  fame~floor        r = ${pearson(fame, floors).toFixed(3)}`);
    lines.push(`  fame~headroom     r = ${pearson(fame, heads).toFixed(3)}`);
    lines.push(`  fame~ceiling      r = ${pearson(fame, ceilings).toFixed(3)}`);

    lines.push('\nCRAFT DISTRIBUTION');
    lines.push(`  floor     mean ${mean(floors).toFixed(1)}  sd ${stdev(floors).toFixed(1)}  p10 ${pctile(floors, 10).toFixed(0)}  med ${pctile(floors, 50).toFixed(0)}  p90 ${pctile(floors, 90).toFixed(0)}`);
    lines.push(`  headroom  mean ${mean(heads).toFixed(1)}  sd ${stdev(heads).toFixed(1)}  p10 ${pctile(heads, 10).toFixed(0)}  med ${pctile(heads, 50).toFixed(0)}  p90 ${pctile(heads, 90).toFixed(0)}`);
    lines.push(`  archetype mix:  pro ${byArch.pro.length}  magnet ${byArch.magnet.length}  allrounder ${byArch.allrounder.length}`);

    // Realized performance by archetype x director type, roleFit=100 to isolate
    // direction. Each actor gets its OWN matched/mismatched director (aim is
    // per-actor), at a strong skill so the unlock is visible.
    const SKILL = 85;
    const realizedUnder = (a: Person, dir: Person | undefined) => computeRealizedPerformance(a, dir, FULL_FIT);
    lines.push('\nREALIZED PERFORMANCE by archetype x director (roleFit=100, director skill 85)');
    lines.push(`  ${'archetype'.padEnd(11)} ${'none'.padStart(6)} ${'handsOff'.padStart(9)} ${'matchedHO'.padStart(10)} ${'mismatchHO'.padStart(11)}`);
    for (const arch of ['pro', 'magnet', 'allrounder'] as Archetype[]) {
      const group = byArch[arch];
      if (!group.length) { lines.push(`  ${arch.padEnd(11)} (none)`); continue; }
      const none = group.map((a) => realizedUnder(a, undefined));
      const style = (a: Person) => getActorCareer(a)!.actingStyle;
      const handsOff = group.map((a) => realizedUnder(a, matchedDirector(style(a), SKILL, 0.05)));
      const matchedHO = group.map((a) => realizedUnder(a, matchedDirector(style(a), SKILL, 0.9)));
      const mismatchHO = group.map((a) => realizedUnder(a, mismatchedDirector(style(a), SKILL, 0.9)));
      lines.push(`  ${arch.padEnd(11)} ${mean(none).toFixed(1).padStart(6)} ${mean(handsOff).toFixed(1).padStart(9)} ${mean(matchedHO).toFixed(1).padStart(10)} ${mean(mismatchHO).toFixed(1).padStart(11)}`);
    }

    lines.push('\nCURVE CROSSING (mean, matched ideal hands-on director, skill 95 vs self-directed)');
    for (const arch of ['pro', 'magnet'] as Archetype[]) {
      const group = byArch[arch];
      if (!group.length) continue;
      const solo = mean(group.map((a) => realizedUnder(a, undefined)));
      const directed = mean(group.map((a) => realizedUnder(a, matchedDirector(getActorCareer(a)!.actingStyle, 95, 0.95))));
      lines.push(`  ${arch.padEnd(11)} solo ${solo.toFixed(1)}   ideal-director ${directed.toFixed(1)}`);
    }

    lines.push('');
    console.log(lines.join('\n'));
  });
});
