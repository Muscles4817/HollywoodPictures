// Sequel development (Franchise stage 2). Developing a new entry in an existing
// IP is deliberately *not* instant: rights / legal / greenlight setup takes real
// time before a screenplay exists. The player kicks off one development from the
// IP Library; after SEQUEL_DEVELOPMENT_SETUP_DAYS the sequel screenplay - already
// rolled at kickoff, hidden until then - is delivered as a new owned Asset linked
// back to its IP (Asset.ipId), the seed of the franchise flywheel.
//
// The MVP is one-click "open development": the studio commissions competent
// execution and the draw is pre-sold (franchiseRecognition is inherited from the
// IP by generateSequelScript). The PendingSequelDevelopment record reserves seams
// (path/writerId/brief/pitchId) for the richer development-office paths - see
// docs/DESIGN_REVIEW_development_office_paths.md - which this MVP does not fill in.
import type { Asset, DevelopmentEvent, GameDay, IntellectualProperty, PendingSequelDevelopment, Script } from '../types';

// The legal / rights / greenlight setup a franchise entry needs before it has a
// screenplay. A flat span for the MVP - there is no writer or brief yet to vary
// it by; a future development-office path can derive the duration from those.
export const SEQUEL_DEVELOPMENT_SETUP_DAYS = 60;

/** The founding development event of a delivered sequel Asset. */
export function sequelDevelopedEvent(day: GameDay, ipName: string): DevelopmentEvent {
  return { day, kind: 'developed', summary: `Sequel screenplay developed for ${ipName}` };
}

/**
 * Assembles the pending-development record - the reducer's single source for the
 * shape. `id` doubles as the delivered Asset's id (the script id is globally
 * unique - Phase 1). The MVP leaves the path/writer/brief/pitch seams unset.
 */
export function makePendingSequelDevelopment(ip: IntellectualProperty, startedOnDay: GameDay, readyOnDay: GameDay, script: Script): PendingSequelDevelopment {
  return { id: `sequel-${script.id}`, ipId: ip.id, ipName: ip.name, startedOnDay, readyOnDay, script };
}

/** How far along a development is, 0..1, for a progress readout. */
export function sequelDevelopmentProgress(development: PendingSequelDevelopment, totalDays: GameDay): number {
  const span = development.readyOnDay - development.startedOnDay;
  if (span <= 0) return 1;
  return Math.max(0, Math.min(1, (totalDays - development.startedOnDay) / span));
}

export interface SequelDevelopmentSettlementResult {
  /** New owned Assets to append - developments delivered by `totalDays`. */
  delivered: Asset[];
  /** Developments still in flight. */
  pendingSequelDevelopments: PendingSequelDevelopment[];
}

/**
 * Delivers every development whose readyOnDay has arrived - wrapping its
 * already-generated sequel script as a new owned Asset (provenance 'Commissioned'
 * - the studio created it, it never appeared on the market, so no marketSource)
 * carrying `ipId` back to its franchise - and leaves the rest in flight. The
 * delivered Asset is indistinguishable downstream from any other owned script
 * except for that `ipId` link. No fee is charged for the MVP one-click
 * development (pricing attaches with the writer-commission paths), so
 * acquisitionCost is 0.
 */
export function settlePendingSequelDevelopments(pending: PendingSequelDevelopment[], totalDays: GameDay): SequelDevelopmentSettlementResult {
  const delivered: Asset[] = [];
  const stillPending: PendingSequelDevelopment[] = [];
  for (const development of pending) {
    if (totalDays < development.readyOnDay) {
      stillPending.push(development);
      continue;
    }
    delivered.push({
      id: development.id,
      script: development.script,
      provenance: 'Commissioned',
      acquisitionCost: 0,
      acquiredOnDay: development.readyOnDay,
      ipId: development.ipId,
      developmentHistory: [sequelDevelopedEvent(development.readyOnDay, development.ipName)],
    });
  }
  return { delivered, pendingSequelDevelopments: stillPending };
}
