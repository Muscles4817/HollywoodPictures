import { describe, it, expect } from 'vitest';
import {
  derivePostProductionStatus,
  isPostProductionAdvancing,
  postProductionPillLabel,
  describePostProductionWait,
  type PostProductionStatus,
} from './postProductionStatus';
import type { FilmDraft } from '../types';

// A draft carries only the fields the selector reads; cast a partial through
// unknown so the tests stay focused on the post-production state machine.
function draft(over: Partial<FilmDraft>): FilmDraft {
  return {
    photography: { status: 'finished', recommendedDays: 40, daysElapsed: 40, events: [], runningCost: 0, pendingChoice: null },
    postProductionScreeningReadyDay: null,
    postProductionFinalReadyDay: null,
    postProductionEditingUntilDay: null,
    postProductionEditingStartedDay: null,
    testScreeningPendingChoice: null,
    testScreeningResolved: false,
    postProductionEvents: [],
    ...over,
  } as unknown as FilmDraft;
}

describe('derivePostProductionStatus', () => {
  it('is not-started until photography has finished', () => {
    const d = draft({ photography: { status: 'in-progress', recommendedDays: 40, daysElapsed: 10, events: [], runningCost: 0, pendingChoice: null } as never });
    expect(derivePostProductionStatus(d, 20).phase).toBe('not-started');
  });

  it('reports the initial-cut editing window with elapsed/total progress', () => {
    const d = draft({ postProductionEditingStartedDay: 100, postProductionScreeningReadyDay: 120 });
    const status = derivePostProductionStatus(d, 109);
    expect(status.phase).toBe('editing');
    if (status.phase !== 'editing') throw new Error('unreachable');
    expect(status.progress.daysTotal).toBe(20);
    expect(status.progress.daysElapsed).toBe(9);
    expect(status.progress.daysRemaining).toBe(11);
    expect(status.progress.fraction).toBeCloseTo(0.45, 5);
  });

  it('clamps progress at the ends of the window', () => {
    const d = draft({ postProductionEditingStartedDay: 100, postProductionScreeningReadyDay: 120 });
    const before = derivePostProductionStatus(d, 95);
    const done = derivePostProductionStatus(d, 130);
    if (before.phase !== 'editing' || done.phase !== 'editing') throw new Error('unreachable');
    expect(before.progress.fraction).toBe(0); // before it "started" reads 0, never negative
    expect(done.progress.fraction).toBe(1);
    expect(done.progress.daysRemaining).toBe(0);
  });

  it('surfaces a pending screening as screening-pending, outranking any window', () => {
    const d = draft({ postProductionScreeningReadyDay: 120, postProductionEditingStartedDay: 100, testScreeningPendingChoice: { id: 'x' } as never });
    expect(derivePostProductionStatus(d, 121).phase).toBe('screening-pending');
  });

  it('reports a recut in progress with its round number and progress', () => {
    const d = draft({
      postProductionScreeningReadyDay: 120,
      postProductionEditingStartedDay: 125,
      postProductionEditingUntilDay: 135,
      postProductionEvents: [{ delayDaysDelta: 10 } as never],
    });
    const status = derivePostProductionStatus(d, 130);
    expect(status.phase).toBe('recutting');
    if (status.phase !== 'recutting') throw new Error('unreachable');
    expect(status.round).toBe(1);
    expect(status.progress.fraction).toBeCloseTo(0.5, 5);
    expect(status.progress.daysRemaining).toBe(5);
  });

  it('reports complete once a final cut is locked', () => {
    const d = draft({ postProductionScreeningReadyDay: 120, testScreeningResolved: true, postProductionFinalReadyDay: 128 });
    const status = derivePostProductionStatus(d, 140);
    expect(status.phase).toBe('complete');
    if (status.phase !== 'complete') throw new Error('unreachable');
    expect(status.finalReadyDay).toBe(128);
  });
});

describe('post-production labels', () => {
  const editing: PostProductionStatus = { phase: 'editing', progress: { startedDay: 100, readyDay: 120, daysTotal: 20, daysElapsed: 9, daysRemaining: 11, fraction: 0.45 } };
  const recut: PostProductionStatus = { phase: 'recutting', progress: { startedDay: 125, readyDay: 135, daysTotal: 10, daysElapsed: 5, daysRemaining: 5, fraction: 0.5 }, round: 1 };

  it('advances only while an editing window is running', () => {
    expect(isPostProductionAdvancing(editing)).toBe(true);
    expect(isPostProductionAdvancing(recut)).toBe(true);
    expect(isPostProductionAdvancing({ phase: 'screening-pending' })).toBe(false);
    expect(isPostProductionAdvancing({ phase: 'complete', finalReadyDay: 1 })).toBe(false);
  });

  it('gives a distinct pill per phase', () => {
    expect(postProductionPillLabel(editing)).toBe('In the edit');
    expect(postProductionPillLabel(recut)).toBe('Re-cut in progress');
    expect(postProductionPillLabel({ phase: 'complete', finalReadyDay: 1 })).toBe('Awaiting release');
  });

  it('counts down the wait, and never shows a raw internal number', () => {
    expect(describePostProductionWait(editing)).toBe('Editing · first test screening in ~11 days');
    expect(describePostProductionWait(recut)).toBe('Re-cut · next test screening in ~5 days');
    // Singular day, and the "any day now" edge when the wait is up.
    const oneDay: PostProductionStatus = { phase: 'editing', progress: { startedDay: 100, readyDay: 120, daysTotal: 20, daysElapsed: 19, daysRemaining: 1, fraction: 0.95 } };
    expect(describePostProductionWait(oneDay)).toBe('Editing · first test screening in ~1 day');
    const due: PostProductionStatus = { phase: 'editing', progress: { startedDay: 100, readyDay: 120, daysTotal: 20, daysElapsed: 20, daysRemaining: 0, fraction: 1 } };
    expect(describePostProductionWait(due)).toBe('First test screening due any day now');
  });
});
