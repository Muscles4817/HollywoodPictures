// A resolved pre-production decision's delay days are real prep days: they must
// advance the phase toward completion AND burn prep overhead, exactly as the
// non-interactive prep path and the on-set equivalent already do. Previously
// RESOLVE_PREPRODUCTION_CHOICE moved only the world calendar, leaving the prep
// phase's own daysElapsed and overhead untouched (delay days were free).
import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { buildStateWithReadyDraft } from './testFixtures';
import { playerDraftToProject, asPlayerDraft, findProject } from '../engine/project';
import { computeDailyPrepBurn } from '../engine/cost';
import type { GameState, GameAction } from './gameState';
import type { FilmDraft, PendingEventChoice, PreProductionState } from '../types';

const DELAY = 3;

function midPrepAwaitingChoice(): GameState {
  const base = buildStateWithReadyDraft(1);
  const draft = asPlayerDraft(base.projects[0])!;
  const pendingChoice: PendingEventChoice = {
    templateId: 'test-prep-decision',
    situation: 'The director wants more time to prep a sequence.',
    polarity: 'positive',
    severity: 'medium',
    choices: [
      // Deterministic: a fixed 3-day delay, no direct cost — so the only cash
      // movement is the prep overhead for those 3 delay days.
      { id: 'grant-the-time', label: 'Grant the time', description: 'x', costRange: [0, 0], qualityRange: [0, 0], buzzRange: [0, 0], delayDaysRange: [DELAY, DELAY] },
    ],
  };
  const preProduction: PreProductionState = {
    status: 'awaiting-choice',
    recommendedDays: 40,
    daysElapsed: 5,
    events: [],
    runningCost: 0,
    pendingChoice,
  };
  const prepping: FilmDraft = { ...draft, preProduction, photography: null, postProductionScreeningReadyDay: null };
  return { ...base, screen: 'production', projects: [playerDraftToProject(prepping)], focusedProjectId: prepping.id };
}

describe('RESOLVE_PREPRODUCTION_CHOICE — delay days are real prep days', () => {
  it('advances preProduction.daysElapsed by the delay and burns prep overhead for it', () => {
    const state = midPrepAwaitingChoice();
    const draft = asPlayerDraft(state.projects[0])!;
    const cashBefore = state.studio.cash;

    const after = studioReducer(state, {
      type: 'RESOLVE_PREPRODUCTION_CHOICE',
      productionId: state.focusedProjectId,
      choiceId: 'grant-the-time',
    } as GameAction);

    const prep = asPlayerDraft(findProject(after.projects, state.focusedProjectId))!.preProduction!;
    // The 3 delay days advance the prep phase toward its recommended length.
    expect(prep.daysElapsed).toBe(5 + DELAY);
    // ...and cost prep overhead (computeDailyPrepBurn × delay days), charged to cash.
    const expectedBurn = computeDailyPrepBurn(draft.script!.scale) * DELAY;
    expect(prep.runningCost).toBe(expectedBurn);
    expect(cashBefore - after.studio.cash).toBe(expectedBurn);
  });
});
