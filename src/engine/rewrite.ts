// Freelance Rewrite / Polish passes on an owned Asset (Phase 3: Development
// Department MVP). A writer improves a screenplay's *craft* - never its concept
// (that's compiler-locked by reviseScript's Partial<ScriptCraft>) - as a
// probabilistic gamble, not a guaranteed upgrade: a strong writer with room to
// work reliably lifts a script, while a weak or inconsistent one on an
// already-good script is a net-negative risk. Same "increase probabilities, not
// certainty" philosophy as Phase 2's writer-driven generation.
import type { Asset, FilmDraft, GameDay, Money, PendingRewrite, Script, ScriptCraft, WriterCreativeProfile } from '../types';
import { reviseScript } from './screenplay';
import { clamp, randFloat, randInt, type RandomFn } from './random';

export type RewriteKind = 'rewrite' | 'polish';

// The craft axes a pass can touch (structure/characters/dialogue). Originality
// is a Concept field now, not craft (docs/SIMULATION_PHILOSOPHY.md Principle 9):
// a rewrite refines the writing, it cannot manufacture a more original idea - the
// Partial<ScriptCraft> seam in reviseScript makes that a compile-time guarantee.
// Complexity and tone are likewise deliberately left alone - a rewrite improves
// the writing, not the production ambition or the concept.
const CRAFT_AXES = ['structure', 'characters', 'dialogue'] as const;

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

/**
 * The SCHEDULED length of a pass - a base by kind plus a complexity term (a
 * denser script takes longer to rework). Deterministic, and the floor of the
 * estimate below: this is what the writer signs up to, not what it takes.
 */
export function rewriteDurationDays(kind: RewriteKind, script: Script): number {
  return DURATION_BASE[kind] + Math.round((script.complexity / 100) * DURATION_COMPLEXITY[kind]);
}

// --- How long it ACTUALLY takes ------------------------------------------
// (docs/DESIGN_REVIEW_project_clocks_and_script_openness.md section 4.2.)
//
// Development time used to be exactly knowable before committing, which is
// most of why waiting was free: you could time a pass to the day and slot it
// between commitments. It is now a RANGE the player sees before choosing, and
// resolves once - at commission - into a stored number with a stored CAUSE.
//
// Two deliberate constraints, both from the philosophy:
//  - It is not opaque. A player must never be able to say "the engine picked
//    41 instead of 24 and punished me" (Principle 3). Every day of overrun is
//    attributable to something with a name, recorded in the development log.
//  - It is not re-rollable. Resolved at commission and stored on
//    PendingRewrite, exactly as craftChanges already is, so reloading a save
//    cannot shop for a better outcome (Principle 2 - the randomness happened
//    when the decision was made).
//
// The overrun is one-sided on purpose: a pass comes in on schedule or late,
// never early. The estimate's low end is the honest optimistic case.

/** The ceiling on writer slippage, before reliability buys it down. */
const SLIP_MAX: Record<RewriteKind, number> = { polish: 6, rewrite: 14 };
/** Reliability at 100 removes this fraction of the slippage ceiling; at 0 it removes none. */
const SLIP_RELIABILITY_RELIEF = 0.8;
/** One extra round after notes, if the pass draws them - a bigger pass costs more to redo. */
const NOTES_ROUND_DAYS: Record<RewriteKind, number> = { polish: 4, rewrite: 9 };
/** Odds of drawing a notes round at complexity 0, and the extra added at complexity 100. */
const NOTES_CHANCE_BASE = 0.15;
const NOTES_CHANCE_COMPLEXITY = 0.3;

/** One named contributor to a pass's length - what the player is shown, and what the log records. */
export interface RewriteDurationFactor {
  /** Player-facing cause, e.g. "Writer reliability". */
  label: string;
  /** Days this contributed. On an estimate, the worst case; on a resolution, what it actually cost. */
  days: number;
}

export interface RewriteDurationEstimate {
  /** The scheduled length - what it takes if nothing goes wrong. */
  low: number;
  /** Everything going long at once. */
  high: number;
  factors: RewriteDurationFactor[];
}

function slipCeiling(kind: RewriteKind, reliability: number): number {
  return Math.round(SLIP_MAX[kind] * (1 - (reliability / 100) * SLIP_RELIABILITY_RELIEF));
}

function notesChance(script: Script): number {
  return NOTES_CHANCE_BASE + (script.complexity / 100) * NOTES_CHANCE_COMPLEXITY;
}

/**
 * The range and its named causes, for the projection shown BEFORE commissioning
 * - the information that makes this a legible bet rather than a hidden roll.
 * Pure and deterministic: same writer, script and kind always describe the same
 * range.
 */
export function estimateRewriteDuration(writerReliability: number, script: Script, kind: RewriteKind): RewriteDurationEstimate {
  const scheduled = rewriteDurationDays(kind, script);
  const slip = slipCeiling(kind, writerReliability);
  const notes = NOTES_ROUND_DAYS[kind];
  return {
    low: scheduled,
    high: scheduled + slip + notes,
    factors: [
      { label: 'Scheduled pass', days: scheduled },
      { label: 'Writer reliability', days: slip },
      { label: 'A further round after notes', days: notes },
    ],
  };
}

/** A pass's resolved length, with what each day of overrun is owed to - rolled ONCE, at commission, and stored. */
export interface RewriteDurationOutcome {
  days: number;
  /** Only what actually happened - empty when the pass ran exactly to schedule. */
  causes: RewriteDurationFactor[];
  /** The one-line account for the development log; empty when it ran to schedule. */
  summary: string;
}

/**
 * Resolves how long a pass really takes. Rolls the writer's slippage and
 * whether the pass draws a further round after notes, then reports both as
 * named causes - so an overrun always arrives with its own explanation and the
 * completion log can say why it landed where it did (Principle 4).
 */
export function resolveRewriteDuration(
  writerReliability: number,
  writerName: string,
  script: Script,
  kind: RewriteKind,
  rng: RandomFn,
): RewriteDurationOutcome {
  const scheduled = rewriteDurationDays(kind, script);
  const causes: RewriteDurationFactor[] = [];

  const slip = randInt(rng, 0, slipCeiling(kind, writerReliability));
  if (slip > 0) causes.push({ label: `${writerName} ran over`, days: slip });

  const notes = rng() < notesChance(script) ? NOTES_ROUND_DAYS[kind] : 0;
  if (notes > 0) causes.push({ label: 'A further round after notes', days: notes });

  const summary = causes.length === 0
    ? `Delivered on schedule in ${scheduled} days.`
    : `Completed in ${scheduled + slip + notes} days — ${causes.map((c) => `${c.label} (+${c.days})`).join(', ')}.`;

  return { days: scheduled + slip + notes, causes, summary };
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
      // The completion entry carries WHY it landed when it did, so an overrun is
      // readable history rather than an unexplained slip in the calendar.
      note: [pending.kind === 'polish' ? 'Polish pass completed' : 'Rewrite completed', pending.durationSummary]
        .filter(Boolean)
        .join(' — '),
      // Fee already charged at commission - no cash moves now, so no costDelta.
    });
    return { ...revised, pendingRewrite: undefined };
  });
}

/**
 * The pre-photography invariant: a project that hasn't started shooting is still
 * working from its Asset's CURRENT head draft, so a pass that lands mid-project
 * flows straight through to it. This is the other half of lifting the old "an
 * Asset with a pass in flight can't start a Project" restriction - without it a
 * draft would keep a stale copy of the script it was created from
 * (state/gameState.ts:createDraftFromAsset copies the head in by value).
 *
 * Once photography begins the draft's script is FROZEN: what's on the page is
 * what gets shot. Changing that is Script Openness
 * (docs/DESIGN_REVIEW_project_clocks_and_script_openness.md section 3.4),
 * deliberately out of scope.
 *
 * Pure and idempotent - a draft already at its Asset's head is returned by
 * reference, so the caller can cheaply detect "nothing moved". An orphaned
 * draft (no matching Asset) is likewise returned untouched.
 */
export function draftAtAssetHead(draft: FilmDraft, assets: Asset[]): FilmDraft {
  if (draft.photography !== null) return draft;
  const asset = assets.find((a) => a.id === draft.assetId);
  if (!asset || asset.script.id === draft.script?.id) return draft;
  // Only the screenplay moves - a rewrite never touches the title (reviseScript
  // carries it over from the previous head), and the draft's own title is the
  // player's to hold.
  return { ...draft, script: asset.script };
}

/** Assembles the PendingRewrite record from an already-rolled outcome - the reducer's single source for the shape. */
export function makePendingRewrite(
  writerId: string,
  kind: RewriteKind,
  startedOnDay: GameDay,
  readyOnDay: GameDay,
  craftChanges: Partial<ScriptCraft>,
  fee: Money,
  duration?: { estimatedDays: { low: GameDay; high: GameDay }; summary: string },
): PendingRewrite {
  return { writerId, kind, startedOnDay, readyOnDay, craftChanges, fee, estimatedDays: duration?.estimatedDays, durationSummary: duration?.summary };
}
