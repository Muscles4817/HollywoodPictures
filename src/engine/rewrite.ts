// Freelance Rewrite / Polish passes on an owned Asset (Phase 3: Development
// Department MVP). A writer improves a screenplay's *craft* - never its concept
// (that's compiler-locked by reviseScript's Partial<ScriptCraft>) - as a
// probabilistic gamble, not a guaranteed upgrade: a strong writer with room to
// work reliably lifts a script, while a weak or inconsistent one on an
// already-good script is a net-negative risk. Same "increase probabilities, not
// certainty" philosophy as Phase 2's writer-driven generation.
import type { Asset, GameDay, Money, PendingRewrite, Script, ScriptCraft, WriterCreativeProfile } from '../types';
import { reviseScript } from './screenplay';
import { clamp, randFloat, type RandomFn } from './random';

export type RewriteKind = 'rewrite' | 'polish';

// The four craft axes a pass can touch (originality/structure/characters/
// dialogue). Complexity and tone are deliberately left alone in the MVP - a
// rewrite improves the writing, not the production ambition or the concept.
const CRAFT_AXES = ['originality', 'structure', 'characters', 'dialogue'] as const;

// How much of the gap toward the writer's own level a pass closes. A full
// rewrite closes twice as much as a polish.
const PASS_STRENGTH: Record<RewriteKind, number> = { polish: 0.25, rewrite: 0.5 };
// Base symmetric noise (the gamble) before consistency narrows it. A rewrite is
// swingier than a polish - more upside, more downside.
const PASS_SPREAD: Record<RewriteKind, number> = { polish: 6, rewrite: 12 };
// Consistency at 100 removes this fraction of the spread (a dependable
// craftsman); at 0 it removes none (a volatile auteur).
const CONSISTENCY_SPREAD_RELIEF = 0.7;

/** Overall skill maps to how much of a positive gap actually gets realised - even a low-skill writer lands some of it (floor), a top writer nearly all. */
function skillFactor(skill: number): number {
  return 0.4 + 0.6 * (skill / 100);
}

/**
 * Rolls the craft outcome of a pass - a Partial<ScriptCraft> of new values for
 * the four craft axes. Each axis is pulled toward the writer's own level on it
 * (only where they're better - `max(0, gap)`), scaled by pass strength and
 * skill, plus consistency-scaled symmetric noise that can push an axis *down*.
 * Diminishing returns fall out for free: the gap shrinks as a script approaches
 * the writer's level, so a great script is hard to improve and a mediocre one
 * has room. Rolled once, at commission (deterministic thereafter).
 */
export function computeRewriteOutcome(writer: WriterCreativeProfile, script: Script, kind: RewriteKind, rng: RandomFn): Partial<ScriptCraft> {
  const strength = PASS_STRENGTH[kind];
  const spread = PASS_SPREAD[kind] * (1 - (writer.consistency / 100) * CONSISTENCY_SPREAD_RELIEF);
  const factor = skillFactor(writer.skill);

  const changes: Partial<ScriptCraft> = {};
  for (const axis of CRAFT_AXES) {
    const current = script[axis];
    const gap = writer.craft[axis] - current;
    const lift = strength * factor * Math.max(0, gap);
    const noise = randFloat(rng, -spread, spread);
    changes[axis] = clamp(Math.round(current + lift + noise), 1, 100);
  }
  return changes;
}

/** The per-axis positive room a writer has on a script (writer level - current, only where positive) - for the qualitative projection shown before commissioning. */
export function rewriteAxisRoom(writer: WriterCreativeProfile, script: Script): Record<(typeof CRAFT_AXES)[number], number> {
  const room = {} as Record<(typeof CRAFT_AXES)[number], number>;
  for (const axis of CRAFT_AXES) room[axis] = Math.max(0, writer.craft[axis] - script[axis]);
  return room;
}

const FEE_MULTIPLIER: Record<RewriteKind, number> = { polish: 0.15, rewrite: 0.35 };

/** A pass fee, as a fraction of what the writer would cost for a full film - so a better (pricier) writer costs more and delivers more. */
export function rewriteFee(writerTypicalSalary: Money, kind: RewriteKind): Money {
  return Math.round(writerTypicalSalary * FEE_MULTIPLIER[kind]);
}

const DURATION_BASE: Record<RewriteKind, number> = { polish: 10, rewrite: 24 };
const DURATION_COMPLEXITY: Record<RewriteKind, number> = { polish: 6, rewrite: 12 };

/** How many days a pass takes - a base by kind plus a complexity term (a denser script takes longer to rework). Deterministic. */
export function rewriteDurationDays(kind: RewriteKind, script: Script): number {
  return DURATION_BASE[kind] + Math.round((script.complexity / 100) * DURATION_COMPLEXITY[kind]);
}

/**
 * Applies every Asset whose pending pass has completed by `totalDays` -
 * producing the new head Script via reviseScript (which handles the fresh id,
 * cost recompute, revision lineage and the completion development-log entry)
 * and clearing pendingRewrite. Assets with no pending pass, or one not yet due,
 * are returned untouched. The writer's own commitment expires by its endDay, so
 * no talent-pool write-back is needed here. Called inside runCalendarSettlement.
 */
export function settleAssetRewrites(assets: Asset[], totalDays: GameDay): Asset[] {
  return assets.map((asset) => {
    const pending = asset.pendingRewrite;
    if (!pending || totalDays < pending.readyOnDay) return asset;
    const revised = reviseScript(asset, pending.craftChanges, {
      day: pending.readyOnDay,
      kind: pending.kind,
      // Credit the rewriter alongside the original author(s), rather than
      // replacing them - "written by X, rewrite by Y". Dedup keeps it clean.
      writerIds: [...new Set([...(asset.writerIds ?? []), pending.writerId])],
      note: pending.kind === 'polish' ? 'Polish pass completed' : 'Rewrite completed',
      // Fee already charged at commission - no cash moves now, so no costDelta.
    });
    return { ...revised, pendingRewrite: undefined };
  });
}

/** Assembles the PendingRewrite record from an already-rolled outcome - the reducer's single source for the shape. */
export function makePendingRewrite(writerId: string, kind: RewriteKind, startedOnDay: GameDay, readyOnDay: GameDay, craftChanges: Partial<ScriptCraft>, fee: Money): PendingRewrite {
  return { writerId, kind, startedOnDay, readyOnDay, craftChanges, fee };
}
