import { describe, it, expect } from 'vitest';
import { createRng } from './random';
import { generateScriptOptions } from './scriptGenerator';
import { computeRewriteOutcome, estimateRewriteDuration, makePendingRewrite, resolveRewriteDuration, rewriteAxisRoom, rewriteDurationDays, rewriteFee, settleAssetRewrites } from './rewrite';
import type { Asset, Genre, Script, WriterCreativeProfile } from '../types';

const FLAT_GENRE: Record<Genre, number> = { Action: 50, Comedy: 50, Drama: 50, Horror: 50, Romance: 50, 'Sci-Fi': 50, Fantasy: 50, Thriller: 50 };

function profile(o: Partial<WriterCreativeProfile> = {}): WriterCreativeProfile {
  return {
    skill: 80,
    conceptAmbition: 80, craft: { structure: 80, characters: 80, dialogue: 80 },
    toneProfile: { action: 50, comedy: 50, romance: 50, suspense: 50, drama: 50, spectacle: 50 },
    genreAffinity: { ...FLAT_GENRE },
    commercialLean: 50,
    consistency: 70,
    ...o,
  };
}

function scriptWith(craft: Partial<Pick<Script, 'originality' | 'structure' | 'characters' | 'dialogue' | 'complexity'>>): Script {
  return { ...generateScriptOptions('Drama', createRng(1), 1)[0], ...craft };
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => { const m = avg(xs); return Math.sqrt(avg(xs.map((x) => (x - m) ** 2))); };
function sampleDialogue(writer: WriterCreativeProfile, script: Script, kind: 'rewrite' | 'polish', n: number): number[] {
  const rng = createRng(7);
  return Array.from({ length: n }, () => computeRewriteOutcome(writer, script, kind, rng).dialogue!);
}

describe('computeRewriteOutcome', () => {
  it('only ever touches the three craft axes - never the concept (incl. originality), complexity, or tone', () => {
    const out = computeRewriteOutcome(profile(), scriptWith({}), 'rewrite', createRng(3));
    expect(Object.keys(out).sort()).toEqual(['characters', 'dialogue', 'structure']);
  });

  it('a strong writer with room reliably lifts a weak script', () => {
    const weak = scriptWith({ originality: 30, structure: 30, characters: 30, dialogue: 30 });
    const strong = profile({ skill: 90, consistency: 90, conceptAmbition: 90, craft: { structure: 90, characters: 90, dialogue: 90 } });
    expect(avg(sampleDialogue(strong, weak, 'rewrite', 80))).toBeGreaterThan(45);
  });

  it('barely moves an already-great script, and can even nick it downward (a real gamble)', () => {
    const great = scriptWith({ originality: 95, structure: 95, characters: 95, dialogue: 95 });
    const outcomes = sampleDialogue(profile({ conceptAmbition: 90, craft: { structure: 90, characters: 90, dialogue: 90 } }), great, 'rewrite', 120);
    expect(avg(outcomes)).toBeLessThan(97); // no meaningful gain - no room
    expect(Math.min(...outcomes)).toBeLessThan(95); // downside risk is real
  });

  it('low consistency widens the outcome variance versus high consistency', () => {
    const script = scriptWith({ originality: 50, structure: 50, characters: 50, dialogue: 50 });
    const volatile = sampleDialogue(profile({ conceptAmbition: 50, craft: { structure: 50, characters: 50, dialogue: 50 }, consistency: 5 }), script, 'rewrite', 120);
    const steady = sampleDialogue(profile({ conceptAmbition: 50, craft: { structure: 50, characters: 50, dialogue: 50 }, consistency: 95 }), script, 'rewrite', 120);
    expect(sd(volatile)).toBeGreaterThan(sd(steady));
  });

  it('is deterministic for a given seed', () => {
    const s = scriptWith({});
    expect(computeRewriteOutcome(profile(), s, 'rewrite', createRng(5))).toEqual(computeRewriteOutcome(profile(), s, 'rewrite', createRng(5)));
  });
});

describe('fee, duration, room', () => {
  it('a rewrite costs more than a polish, and a pricier writer costs more', () => {
    expect(rewriteFee(1_000_000, 'rewrite')).toBeGreaterThan(rewriteFee(1_000_000, 'polish'));
    expect(rewriteFee(2_000_000, 'polish')).toBeGreaterThan(rewriteFee(1_000_000, 'polish'));
  });

  it('a rewrite takes longer than a polish, and a denser script takes longer', () => {
    expect(rewriteDurationDays('rewrite', scriptWith({ complexity: 50 }))).toBeGreaterThan(rewriteDurationDays('polish', scriptWith({ complexity: 50 })));
    expect(rewriteDurationDays('rewrite', scriptWith({ complexity: 100 }))).toBeGreaterThan(rewriteDurationDays('rewrite', scriptWith({ complexity: 0 })));
  });

  it('rewriteAxisRoom is positive only where the writer out-levels the script (execution craft only - originality is not an axis)', () => {
    const room = rewriteAxisRoom(profile({ conceptAmbition: 90, craft: { structure: 40, characters: 80, dialogue: 60 } }), scriptWith({ originality: 50, structure: 50, characters: 50, dialogue: 60 }));
    expect(room.characters).toBe(30); // writer out-levels the script here
    expect(room.structure).toBe(0); // writer weaker here
    expect(room.dialogue).toBe(0); // equal
    expect('originality' in room).toBe(false); // originality is Concept - never a rewrite axis
  });
});

describe('settleAssetRewrites', () => {
  function assetWithPending(readyOnDay: number): Asset {
    const head = scriptWith({ dialogue: 40 });
    return {
      id: 'a1', script: head, provenance: 'Acquired', marketSource: 'Spec Screenplay', acquisitionCost: 100, acquiredOnDay: 1,
      writerIds: ['author-1'],
      pendingRewrite: makePendingRewrite('rewriter-9', 'rewrite', 1, readyOnDay, { dialogue: 88 }, 500),
    };
  }

  it('leaves a pass that has not completed yet untouched', () => {
    const asset = assetWithPending(10);
    const [after] = settleAssetRewrites([asset], 9);
    expect(after).toBe(asset);
  });

  it('applies a completed pass: new head, cleared pending, revision kept, rewriter credited, log entry', () => {
    const asset = assetWithPending(10);
    const head = asset.script;
    const [after] = settleAssetRewrites([asset], 10);
    expect(after.pendingRewrite).toBeUndefined();
    expect(after.script.dialogue).toBe(88);
    expect(after.script).not.toBe(head);
    expect(after.revisions).toEqual([head]);
    expect(after.writerIds).toEqual(['author-1', 'rewriter-9']);
    expect(after.developmentHistory?.at(-1)).toMatchObject({ kind: 'rewrite' });
  });

  it('ignores assets with no pending pass', () => {
    const plain: Asset = { id: 'a2', script: scriptWith({}), provenance: 'Founding', acquisitionCost: 0, acquiredOnDay: 1 };
    const [after] = settleAssetRewrites([plain], 999);
    expect(after).toBe(plain);
  });
});

// Development time used to be exactly knowable, which is most of why waiting
// was free - a pass could be timed to the day and slotted between commitments.
// docs/DESIGN_REVIEW_project_clocks_and_script_openness.md section 4.2.
describe('rewrite duration - an estimate with named causes', () => {
  const script = (complexity: number): Script => scriptWith({ complexity });

  it('bounds the estimate by the scheduled length below, and names every contributor', () => {
    const s = script(50);
    const estimate = estimateRewriteDuration(70, s, 'rewrite');
    // A pass comes in on schedule or late, never early - the low end is the honest optimistic case.
    expect(estimate.low).toBe(rewriteDurationDays('rewrite', s));
    expect(estimate.high).toBeGreaterThan(estimate.low);
    // Nothing in the range is unexplained: the factors account for the whole span.
    const named = estimate.factors.reduce((sum, f) => sum + f.days, 0);
    expect(named).toBe(estimate.high);
  });

  it('narrows the range for a reliable writer and widens it for an unreliable one', () => {
    const s = script(50);
    const dependable = estimateRewriteDuration(95, s, 'rewrite');
    const volatile = estimateRewriteDuration(10, s, 'rewrite');
    expect(dependable.low).toBe(volatile.low); // same scheduled pass
    expect(dependable.high).toBeLessThan(volatile.high); // who you hire is part of how long it takes
  });

  it('resolves within its own estimate, and always explains where it landed', () => {
    const s = script(80);
    const estimate = estimateRewriteDuration(40, s, 'rewrite');
    for (let seed = 0; seed < 60; seed++) {
      const outcome = resolveRewriteDuration(40, 'Dana Vance', s, 'rewrite', createRng(seed));
      expect(outcome.days).toBeGreaterThanOrEqual(estimate.low);
      expect(outcome.days).toBeLessThanOrEqual(estimate.high);
      // Principle 3/4: an overrun is never an unexplained slip - the days that
      // went over are exactly the days the named causes account for.
      const overrun = outcome.days - estimate.low;
      expect(outcome.causes.reduce((sum, c) => sum + c.days, 0)).toBe(overrun);
      expect(outcome.summary).not.toBe('');
      if (overrun === 0) expect(outcome.causes).toHaveLength(0);
    }
  });

  it('is deterministic for a given seed - a reload cannot shop for a shorter pass', () => {
    const s = script(60);
    const first = resolveRewriteDuration(30, 'Dana Vance', s, 'polish', createRng(4242));
    const second = resolveRewriteDuration(30, 'Dana Vance', s, 'polish', createRng(4242));
    expect(second).toEqual(first);
  });
});
