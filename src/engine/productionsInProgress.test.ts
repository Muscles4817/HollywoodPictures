// Backgrounded pre-production settlement - the prep mirror of the backgrounded
// shoot settlement in the same module. Proves prep advances as a side effect of
// the calendar (settlePreProductionsInProgress) rather than only while the
// player watches the Pre-Production screen's local ticker.
import { describe, it, expect } from 'vitest';
import { settlePreProductionsInProgress } from './productionsInProgress';
import { buildStateWithReadyDraft } from '../state/testFixtures';
import { asPlayerDraft } from './project';
import { computeDailyPrepBurn } from './cost';
import type { FilmDraft, PreProductionState } from '../types';

// 0.9 >= PREPROD_EVENT_CHANCE (0.18), so rollPreProductionDayEvent never fires -
// the prep advances one clean day per calendar day, no interactive pauses.
const noEventRng = () => 0.9;

function preppingDraft(status: PreProductionState['status'], daysElapsed: number, recommendedDays: number): FilmDraft {
  const base = asPlayerDraft(buildStateWithReadyDraft(1).projects[0])!;
  const preProduction: PreProductionState = { status, recommendedDays, daysElapsed, events: [], runningCost: 0, pendingChoice: null };
  return { ...base, preProduction, photography: null };
}

describe('settlePreProductionsInProgress', () => {
  it('advances an in-progress prep by the calendar and reports its overhead charge', () => {
    const draft = preppingDraft('in-progress', 0, 40);
    const { drafts, charges } = settlePreProductionsInProgress([draft], 1, noEventRng);

    expect(drafts[0].preProduction!.daysElapsed).toBe(1);
    expect(drafts[0].preProduction!.status).toBe('in-progress');
    // Charged the same daily overhead the focused ADVANCE_PREPRODUCTION_DAY charges.
    expect(charges).toHaveLength(1);
    expect(charges[0].amount).toBe(computeDailyPrepBurn(draft.script!.scale));
  });

  it('finishes prep and opens Principal Photography once it reaches its recommended days', () => {
    const draft = preppingDraft('in-progress', 0, 3);
    const { drafts } = settlePreProductionsInProgress([draft], 3, noEventRng);

    expect(drafts[0].preProduction!.status).toBe('finished');
    expect(drafts[0].photography?.status).toBe('in-progress');
    expect(drafts[0].photography?.daysElapsed).toBe(0);
  });

  it('leaves scheduled / awaiting-choice / finished preps untouched and uncharged', () => {
    for (const status of ['scheduled', 'awaiting-choice', 'finished'] as const) {
      const draft = preppingDraft(status, 5, 40);
      const { drafts, charges } = settlePreProductionsInProgress([draft], 5, noEventRng);
      expect(drafts[0].preProduction!.daysElapsed).toBe(5);
      expect(drafts[0].photography).toBeNull();
      expect(charges).toHaveLength(0);
    }
  });

  it('is a no-op for a non-positive day span', () => {
    const draft = preppingDraft('in-progress', 4, 40);
    const { drafts, charges } = settlePreProductionsInProgress([draft], 0, noEventRng);
    expect(drafts[0]).toBe(draft);
    expect(charges).toHaveLength(0);
  });
});
