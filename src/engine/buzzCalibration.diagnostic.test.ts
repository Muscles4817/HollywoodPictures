/**
 * Calibration harness — BUZZ bands & real-film fixtures.
 *
 * Encodes docs/DESIGN_box_office_calibration_targets.md §6: the 0-100 buzz
 * scale's meaning bands, a set of real-film fixtures whose pre-release buzz must
 * land in a target band, and - the load-bearing property - NON-PURCHASABILITY:
 * marketing spend alone (no stars, no brand) must not reach the top bands.
 *
 * Expected to FAIL until computeBuzzScore is recalibrated (plan step 4). Opt-in
 * (see CLAUDE.md), same flag as the distribution harness:
 *
 *   BOX_OFFICE_DIAGNOSTIC=1 npx vitest run src/engine/buzzCalibration.diagnostic.test.ts --disable-console-intercept
 */
import { describe, it, expect } from 'vitest';
import { computeBuzzScore } from './scoring';
import { generateScriptOptions } from './scriptGenerator';
import { createRng } from './random';
import type { PostProductionChoices, Person, Script, TalentAssignment, ProductionRole } from '../types';

const NEUTRAL_POST: PostProductionChoices = { editStyle: 'Balanced', musicFocus: 'Standard', finalCutFocus: 'Trailer-focused' };

// computeBuzzScore reads only reputation.fame (via the Director / Lead Actor
// role on the TalentAssignment), so an empty `careers` keeps this a valid Person
// without constructing full career records that buzz never looks at.
function person(id: string, fame: number, role: 'Actor' | 'Director'): Person {
  return {
    id,
    identity: { name: id, appearanceTags: [] },
    personality: { professionalism: 50, ambition: 50, loyalty: 50, ego: 50, temperament: 50, pressureHandling: 50, controversy: 50, adaptability: 50 },
    reputation: { fame, prestige: 50, industryRespect: 50, reliability: 50, currentHeat: 50 },
    availability: { commitments: [] },
    traits: [],
    primaryRole: role,
    careers: {},
  };
}

function cast(directorFame: number, leadFame: number, leadCount = 1): TalentAssignment[] {
  const t: TalentAssignment[] = [{ role: 'Director' as ProductionRole, person: person('dir', directorFame, 'Director') }];
  for (let i = 0; i < leadCount; i++) t.push({ role: 'Lead Actor' as ProductionRole, person: person(`lead-${i}`, leadFame, 'Actor') });
  return t;
}

function script(genre: Parameters<typeof generateScriptOptions>[0], seed: number): Script {
  return generateScriptOptions(genre, createRng(seed), 1)[0];
}

interface Fixture {
  name: string;
  buzz: number;
  band: [number, number];
}

function buzzOf(s: Script, talent: TalentAssignment[], marketing: number, brand: number): number {
  return computeBuzzScore(s, talent, [], NEUTRAL_POST, marketing, brand);
}

const enabled = Boolean(
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.BOX_OFFICE_DIAGNOSTIC,
);

describe.skipIf(!enabled)('buzz calibration - bands, fixtures, non-purchasability', () => {
  it('real-film fixtures land in their target bands, and marketing alone cannot reach the top bands', () => {
    // Each fixture models a real film from ONLY pre-release info: how famous the
    // people are, how commercially recognised the studio is, how big the
    // campaign is. Target bands are §6 of the calibration spec.
    const fixtures: Fixture[] = [
      { name: 'Ordinary studio action film', band: [48, 58], buzz: buzzOf(script('Action', 11), cast(45, 50), 30_000_000, 50) },
      { name: 'Well-marketed star vehicle', band: [62, 72], buzz: buzzOf(script('Thriller', 12), cast(55, 85), 60_000_000, 55) },
      { name: 'Successful horror sequel', band: [58, 68], buzz: buzzOf(script('Horror', 13), cast(40, 55), 25_000_000, 60) },
      { name: 'Marvel-style tentpole', band: [80, 90], buzz: buzzOf(script('Action', 14), cast(70, 82, 3), 120_000_000, 85) },
      { name: 'Barbie', band: [90, 95], buzz: buzzOf(script('Comedy', 15), cast(80, 88, 2), 140_000_000, 88) },
      { name: 'The Force Awakens', band: [96, 99], buzz: buzzOf(script('Sci-Fi', 16), cast(70, 85, 3), 150_000_000, 95) },
      { name: 'Avengers: Endgame', band: [98, 100], buzz: buzzOf(script('Action', 17), cast(75, 90, 4), 150_000_000, 98) },
    ];

    // Non-purchasability probes: max marketing, but nobodies and an unknown
    // studio. Must NOT reach "major blockbuster" (>=75).
    const moneyOnly = buzzOf(script('Action', 18), cast(10, 15), 150_000_000, 20);
    const moneyOnlyMidBrand = buzzOf(script('Action', 19), cast(20, 20), 150_000_000, 40);

    const failures: string[] = [];
    const lines: string[] = ['\nBUZZ FIXTURES', `  ${'fixture'.padEnd(30)} ${'buzz'.padStart(5)}   band`];
    for (const f of fixtures) {
      const ok = f.buzz >= f.band[0] && f.buzz <= f.band[1];
      if (!ok) failures.push(`${f.name}: ${f.buzz.toFixed(1)} not in [${f.band[0]}, ${f.band[1]}]`);
      lines.push(`  ${(ok ? 'PASS ' : 'FAIL ')}${f.name.padEnd(25)} ${f.buzz.toFixed(1).padStart(5)}   [${f.band[0]}, ${f.band[1]}]`);
    }
    lines.push('\nNON-PURCHASABILITY (marketing alone, must stay < 75)');
    for (const [label, val] of [['max mktg / nobodies / unknown studio', moneyOnly], ['max mktg / nobodies / mid brand', moneyOnlyMidBrand]] as [string, number][]) {
      const ok = val < 75;
      if (!ok) failures.push(`${label}: ${val.toFixed(1)} reached the top bands (>= 75) on marketing alone`);
      lines.push(`  ${(ok ? 'PASS ' : 'FAIL ')}${label.padEnd(38)} ${val.toFixed(1).padStart(5)}`);
    }
    console.log(lines.join('\n'));
    expect(failures, `\n${failures.join('\n')}\n`).toEqual([]);
  });
});
