// Makes premise novelty a MEASURED property rather than an impression.
//
// Skipped in the normal suite; opt in with:
//
//   PREMISE_NOVELTY_DIAGNOSTIC=1 npx vitest run src/engine/premiseNovelty.diagnostic.test.ts --disable-console-intercept
//
// It reports the number that actually matters, which is not "how many log-lines
// are written" but how many a player realistically MEETS. Those diverge badly
// when selection concentrates: the corpus held 342 entries while the effective
// pool - the reciprocal of the summed squared share, i.e. how many equally-
// likely log-lines would produce the same repetition - sat at 61, because a
// Story Type bank of five was the only thing a heist could ever draw from.
//
// Two of these assert; the rest only print, so the harness stays a lens rather
// than a gate on numbers that are still being tuned.
import { describe, it, expect } from 'vitest';
import { generateScriptOptions } from './scriptGenerator';
import { createRng } from './random';
import type { Genre } from '../types';

const GENRES: Genre[] = ['Action', 'Comedy', 'Drama', 'Horror', 'Romance', 'Sci-Fi', 'Fantasy', 'Thriller'];
const SEEDS = 250;
const SLATE = 12;

const diagnosticEnabled = Boolean(
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.PREMISE_NOVELTY_DIAGNOSTIC,
);

/** How many equally-likely log-lines would produce the repetition actually observed. */
function effectivePool(counts: Map<string, number>, total: number): number {
  let sumSq = 0;
  for (const c of counts.values()) sumSq += (c / total) ** 2;
  return 1 / sumSq;
}

function sample(): { counts: Map<string, number>; total: number; slateDistinct: number[] } {
  const counts = new Map<string, number>();
  const slateDistinct: number[] = [];
  let total = 0;
  for (const genre of GENRES) {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const slate = generateScriptOptions(genre, createRng(seed), SLATE);
      slateDistinct.push(new Set(slate.map((s) => s.synopsis)).size);
      for (const s of slate) {
        counts.set(s.synopsis, (counts.get(s.synopsis) ?? 0) + 1);
        total += 1;
      }
    }
  }
  return { counts, total, slateDistinct };
}

describe.skipIf(!diagnosticEnabled)('premise novelty diagnostic', () => {
  it('reports how much of the corpus a player actually meets', () => {
    const { counts, total, slateDistinct } = sample();
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const effective = effectivePool(counts, total);
    const avgSlate = slateDistinct.reduce((a, b) => a + b, 0) / slateDistinct.length;

    const lines: string[] = [];
    lines.push(`\n=== PREMISE NOVELTY (${GENRES.length} genres x ${SEEDS} seeds x ${SLATE}) ===\n`);
    lines.push(`generated        ${total}`);
    lines.push(`distinct         ${counts.size}`);
    lines.push(`effective pool   ${effective.toFixed(1)}  <- the number that matters`);
    lines.push(`top share        ${((sorted[0][1] / total) * 100).toFixed(2)}%`);
    lines.push(`distinct / slate ${avgSlate.toFixed(3)} of ${SLATE}`);
    lines.push('\nmost repeated:');
    for (const [text, n] of sorted.slice(0, 5)) lines.push(`  ${((n / total) * 100).toFixed(2)}%  ${text.slice(0, 68)}`);
    lines.push('\nleast reached:');
    for (const [text, n] of sorted.slice(-5)) lines.push(`  ${((n / total) * 100).toFixed(2)}%  ${text.slice(0, 68)}`);
    console.log(lines.join('\n'));

    expect(counts.size).toBeGreaterThan(0);
  });

  it('reaches every log-line that exists, so nothing is written and never seen', () => {
    // Unreachable entries are the quiet failure of a tiered pool: an entry can
    // be authored, sit in a bank, and never be selected because the tier in
    // front of it always wins. This is the check for that.
    const { counts } = sample();
    expect(counts.size).toBe(342);
  });

  it('keeps the effective pool well above the strict-priority baseline of 61', () => {
    const { counts, total } = sample();
    expect(effectivePool(counts, total)).toBeGreaterThan(120);
  });
});
