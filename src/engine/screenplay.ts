// The Asset-level screenplay API - authorship, revision lineage and
// development history (see types/index.ts's "Screenplay architectural
// contract"). Everything here treats Script and Asset as immutable value
// objects: no function mutates its input, each returns a new object. This is
// the seam a future Development Department plugs into; nothing here is wired to
// a screen or action yet.
import type { Asset, DevelopmentEvent, DevelopmentEventKind, GameDay, Money, OpportunitySource, PersonId, Script, ScriptCraft } from '../types';
import { estimateScriptCost, newScriptId } from './scriptGenerator';

/** The founding development event every Asset is born with - the moment it entered the library (bought as an Opportunity, or seeded as a founding test script when `cost` is 0). */
export function acquisitionEvent(day: GameDay, source: OpportunitySource, cost: Money): DevelopmentEvent {
  return {
    day,
    kind: 'acquired',
    summary: cost > 0 ? `Acquired as a ${source}` : `Founding script (${source})`,
    // Only record a cash movement when there was one - a free founding script moved none.
    costDelta: cost > 0 ? -cost : undefined,
  };
}

/** Append one event to an Asset's development history, returning a new Asset. */
export function appendDevelopmentEvent(asset: Asset, event: DevelopmentEvent): Asset {
  return { ...asset, developmentHistory: [...(asset.developmentHistory ?? []), event] };
}

/**
 * The full ordered lineage of an Asset's screenplay, oldest draft first and the
 * current head last - the read a "compare revisions" view uses. Falls out of
 * snapshots already kept (Asset.revisions + the head Asset.script), not a
 * separate diffing system.
 */
export function scriptRevisionHistory(asset: Asset): Script[] {
  return [...(asset.revisions ?? []), asset.script];
}

export interface RewriteOptions {
  /** GameState.totalDays this pass completed on. */
  day: GameDay;
  /** A full rewrite or a lighter polish - only these two produce a new head draft. */
  kind: Extract<DevelopmentEventKind, 'rewrite' | 'polish'>;
  /** Who authored this pass, if modelled - replaces the head's writer credits when provided. */
  writerIds?: PersonId[];
  /** Overrides the default development-log summary. */
  note?: string;
  /** Cash this pass cost, if any - recorded on the development event only; this function charges nothing itself. */
  costDelta?: Money;
}

/**
 * The single enforced seam a future Rewrite/Polish action goes through. Keeps
 * Script immutable and the concept fixed:
 *  - it never mutates the current head; it produces a NEW head Script with a
 *    fresh id and its cost recomputed from the changed craft,
 *  - the `Partial<ScriptCraft>` parameter makes it impossible to pass a concept
 *    field (genre/archetype/storyType/primarySetting/scale) - the compiler
 *    rejects it - so a rewrite can only ever improve execution, never redefine
 *    what the film is,
 *  - it pushes the previous head into `revisions` and records a DevelopmentEvent.
 * Charges no cash and touches nothing outside the Asset - wiring cost and time
 * to it is the Development Department's job, not this pure helper's.
 */
export function reviseScript(asset: Asset, craftChanges: Partial<ScriptCraft>, opts: RewriteOptions): Asset {
  const previousHead = asset.script;
  const base = { ...previousHead, ...craftChanges, id: newScriptId() };
  const revisedHead: Script = { ...base, cost: estimateScriptCost(base) };
  const event: DevelopmentEvent = {
    day: opts.day,
    kind: opts.kind,
    summary: opts.note ?? (opts.kind === 'polish' ? 'Dialogue / polish pass' : 'Rewrite'),
    costDelta: opts.costDelta,
  };
  return {
    ...asset,
    script: revisedHead,
    revisions: [...(asset.revisions ?? []), previousHead],
    writerIds: opts.writerIds ?? asset.writerIds,
    developmentHistory: [...(asset.developmentHistory ?? []), event],
  };
}
