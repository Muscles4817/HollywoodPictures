/**
 * Empirical diagnostic for the personality-archetype work: proof that the six
 * formerly-flat personality axes now cohere into recognisable archetypes, so
 * engine/personTraits.ts:deriveTraits() surfaces a VARIED distribution across
 * the roster instead of the near-nothing it fired on flat 50/50/20 inputs.
 *
 * Reports, with no rebalancing:
 *   1. trait-count distribution across the actor pool - most actors should
 *      surface 1-3 believable ranked traits, few should surface none or a wall;
 *   2. per-trait frequency - the palette should be broad and NO single trait
 *      should dominate;
 *   3. worked archetype examples - named actors read as the person you'd expect.
 *
 * Aggregated across several fresh talent pools (handcrafted roster + procedural
 * budget tier), since the pool is where a real player meets these people.
 *
 * Opt-in (skipped in the normal suite):
 *   PERSONALITY_DIAGNOSTIC=1 npx vitest run src/engine/personality.diagnostic.test.ts --disable-console-intercept
 */
import { describe, it, expect } from 'vitest';
import { generateTalentPool } from './talentGenerator';
import { deriveTraits, TRAIT_LABELS } from './personTraits';
import { withRng } from './random';
import type { Person, PersonTrait } from '../types';

const SEEDS = 6;

const diagnosticEnabled = Boolean(
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.PERSONALITY_DIAGNOSTIC,
);

function pct(n: number, total: number): string {
  return total ? `${((100 * n) / total).toFixed(1)}%` : '0%';
}

describe.skipIf(!diagnosticEnabled)('personality archetype diagnostic', () => {
  it('deriveTraits produces a varied, non-dominated distribution across the actor pool', () => {
    const actors: Person[] = [];
    for (let s = 0; s < SEEDS; s++) {
      const { result: pool } = withRng(2200 + s, (rng) => generateTalentPool(rng));
      actors.push(...pool.Actor);
    }

    const traitCounts: number[] = [];
    const freq = new Map<PersonTrait, number>();
    for (const actor of actors) {
      const traits = deriveTraits(actor);
      traitCounts.push(traits.length);
      for (const t of traits) freq.set(t, (freq.get(t) ?? 0) + 1);
    }

    const total = actors.length;
    const withSome = traitCounts.filter((c) => c >= 1).length;
    const oneToThree = traitCounts.filter((c) => c >= 1 && c <= 3).length;
    const none = traitCounts.filter((c) => c === 0).length;
    const distinctTraits = freq.size;
    const topTrait = [...freq.entries()].sort((a, b) => b[1] - a[1])[0];

    const lines: string[] = [];
    lines.push(`\n=== PERSONALITY ARCHETYPE DIAGNOSTIC (${SEEDS} pools, ${total} actors) ===\n`);
    lines.push('Trait-count distribution (traits per actor):');
    for (let c = 0; c <= 5; c++) {
      const n = traitCounts.filter((x) => (c === 5 ? x >= 5 : x === c)).length;
      lines.push(`  ${c === 5 ? '5+' : `${c} `} traits: ${String(n).padStart(5)}  ${pct(n, total)}`);
    }
    lines.push(`\n  at least one trait: ${pct(withSome, total)}   1-3 traits: ${pct(oneToThree, total)}   none: ${pct(none, total)}`);

    lines.push('\nPer-trait frequency (share of actors carrying it), strongest-first:');
    for (const [trait, n] of [...freq.entries()].sort((a, b) => b[1] - a[1])) {
      lines.push(`  ${TRAIT_LABELS[trait].padEnd(22)} ${String(n).padStart(5)}  ${pct(n, total)}`);
    }
    lines.push(`\n  distinct traits seen: ${distinctTraits} / ${Object.keys(TRAIT_LABELS).length}`);
    lines.push(`  most common trait: ${TRAIT_LABELS[topTrait[0]]} at ${pct(topTrait[1], total)}`);

    // Worked examples: a handful of marquee names read as who they should.
    const firstPool = withRng(2200, (rng) => generateTalentPool(rng)).result;
    const examples = [
      'real-lead-actor-tom-hanks',
      'real-lead-actor-marlon-brando',
      'real-lead-actor-daniel-day-lewis',
      'real-lead-actor-will-smith',
      'real-lead-actor-dwayne-johnson',
      'real-lead-actor-keanu-reeves',
    ];
    lines.push('\nWorked marquee examples (id → ranked traits):');
    for (const id of examples) {
      const person = firstPool.Actor.find((p) => p.id === id);
      if (person) {
        const traits = deriveTraits(person).map((t) => TRAIT_LABELS[t]);
        lines.push(`  ${person.identity.name.padEnd(20)} ${traits.join(', ') || '(none)'}`);
      }
    }

    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));

    // Assertions capturing the goal (generous bands so tuning doesn't break them
    // but a real regression - back to flat, near-empty traits - does).
    expect(withSome / total).toBeGreaterThan(0.6); // most actors surface something
    expect(oneToThree / total).toBeGreaterThan(0.5); // most surface a believable 1-3
    expect(distinctTraits).toBeGreaterThanOrEqual(9); // a broad palette actually fires
    expect(topTrait[1] / total).toBeLessThan(0.4); // no single trait dominates
  });
});
