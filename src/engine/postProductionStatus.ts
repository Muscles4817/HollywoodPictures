// Post-production status + progress, derived once and shared by every surface
// that talks about the editing phase (the Dashboard project row, the Inbox, and
// the Post-Production screen). Post-production is a real, timed phase - it just
// never had a progress read the way Principal Photography does
// (PhotographyState.daysElapsed / recommendedDays). This module gives it one,
// derived from the milestone dates already on the draft plus the editing-window
// start day, so all three surfaces agree on "which phase, and how far along."
//
// Pure: plain draft + day in, plain status out. No React, no store.
import type { FilmDraft, GameDay } from '../types';
import { clamp } from './random';

export type PostProductionPhase =
  | 'not-started' // photography hasn't wrapped yet - post-production hasn't begun
  | 'editing' // the initial cut is being assembled, heading to the first test screening
  | 'screening-pending' // a test screening is in, waiting on the player's decision
  | 'recutting' // an editing round is underway, heading to the next screening
  | 'complete'; // a final cut is locked - ready for marketing/release

/** Elapsed/total progress through one editing window (initial cut or a recut). */
export interface PostProductionProgress {
  /** The day this editing window began. */
  startedDay: GameDay;
  /** The day it completes and the next test screening surfaces. */
  readyDay: GameDay;
  /** Total window length in days, floored at 1 so the fraction is always defined. */
  daysTotal: number;
  /** Days elapsed so far, clamped to [0, daysTotal]. */
  daysElapsed: number;
  /** Days left until the screening, floored at 0. */
  daysRemaining: number;
  /** Completion fraction in [0, 1] - drives the progress bar. */
  fraction: number;
}

export type PostProductionStatus =
  | { phase: 'not-started' }
  | { phase: 'editing'; progress: PostProductionProgress }
  | { phase: 'screening-pending' }
  | { phase: 'recutting'; progress: PostProductionProgress; round: number }
  | { phase: 'complete'; finalReadyDay: GameDay | null };

function computeProgress(startedDay: GameDay, readyDay: GameDay, totalDays: number): PostProductionProgress {
  const daysTotal = Math.max(1, readyDay - startedDay);
  const daysElapsed = clamp(totalDays - startedDay, 0, daysTotal);
  const daysRemaining = Math.max(0, readyDay - totalDays);
  return { startedDay, readyDay, daysTotal, daysElapsed, daysRemaining, fraction: clamp(daysElapsed / daysTotal, 0, 1) };
}

/**
 * The post-production phase a draft is in right now, with progress where the
 * phase is a timed wait. Ordering mirrors the reducer's own precedence: a
 * pending screening decision outranks any editing window (the window that led
 * to it is done), a live recut outranks the resolved flag, and the resolved
 * flag outranks the initial-cut wait.
 */
export function derivePostProductionStatus(draft: FilmDraft, totalDays: number): PostProductionStatus {
  if (!draft.photography || draft.photography.status !== 'finished') return { phase: 'not-started' };
  if (draft.testScreeningPendingChoice) return { phase: 'screening-pending' };
  if (draft.postProductionEditingUntilDay !== null) {
    const started = draft.postProductionEditingStartedDay ?? totalDays;
    return {
      phase: 'recutting',
      progress: computeProgress(started, draft.postProductionEditingUntilDay, totalDays),
      round: draft.postProductionEvents.length,
    };
  }
  if (draft.testScreeningResolved) return { phase: 'complete', finalReadyDay: draft.postProductionFinalReadyDay };
  if (draft.postProductionScreeningReadyDay !== null) {
    const started = draft.postProductionEditingStartedDay ?? draft.postProductionScreeningReadyDay;
    return { phase: 'editing', progress: computeProgress(started, draft.postProductionScreeningReadyDay, totalDays) };
  }
  return { phase: 'not-started' };
}

/** True while post-production is a passive, self-advancing wait (an editing window running) - i.e. the phases the Post-Production screen's own clock should tick through. */
export function isPostProductionAdvancing(status: PostProductionStatus): status is Extract<PostProductionStatus, { phase: 'editing' | 'recutting' }> {
  return status.phase === 'editing' || status.phase === 'recutting';
}

/** A short pill label for the phase - matches the vocabulary the cards and Inbox use. */
export function postProductionPillLabel(status: PostProductionStatus): string {
  switch (status.phase) {
    case 'editing': return 'In the edit';
    case 'screening-pending': return 'Test screening in';
    case 'recutting': return 'Re-cut in progress';
    case 'complete': return 'Awaiting release';
    default: return 'Post-production';
  }
}

/** A one-line status/countdown for the phase - the meta line under a project card and the Inbox detail. Qualitative day counts only (house style: no internal stat values). */
export function describePostProductionWait(status: PostProductionStatus): string {
  const days = (n: number) => `${n} day${n === 1 ? '' : 's'}`;
  switch (status.phase) {
    case 'editing':
      return status.progress.daysRemaining <= 0
        ? 'First test screening due any day now'
        : `Editing · first test screening in ~${days(status.progress.daysRemaining)}`;
    case 'recutting':
      return status.progress.daysRemaining <= 0
        ? 'Re-cut wrapping · next screening due any day now'
        : `Re-cut · next test screening in ~${days(status.progress.daysRemaining)}`;
    case 'screening-pending':
      return 'Test screening is in — your decision is needed';
    case 'complete':
      return 'Final cut locked — ready to take to market';
    default:
      return '';
  }
}
