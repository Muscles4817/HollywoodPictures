import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { buildStateWithReadyDraft } from './testFixtures';
import { asPlayerDraft, findProject } from '../engine/project';
import type { GameState } from './gameState';

/**
 * A release-ready state whose Lead Actor is (a) sent on a press tour and (b)
 * present in the talent pool with a known-low currentHeat, so the settlement's
 * reputation write-back has someone to land on and room to move them. The
 * fixture generates draft talent and the pool separately, so we inject the
 * drafted lead into the pool ourselves.
 */
function stateWithPooledTourer(seed: number): { state: GameState; tourerId: string; heatBefore: number } {
  const base = buildStateWithReadyDraft(seed);
  const draft = asPlayerDraft(findProject(base.projects, base.focusedProjectId))!;
  const lead = draft.talent.find((t) => t.role === 'Lead Actor')!.person;
  const heatBefore = 30;
  const pooledLead = { ...lead, reputation: { ...lead.reputation, currentHeat: heatBefore } };
  const touring = { ...draft, marketingChoices: { ...draft.marketingChoices!, pressTourCast: [lead.id] } };
  return {
    state: {
      ...base,
      talentPool: { ...base.talentPool, Actor: [pooledLead, ...base.talentPool.Actor] },
      projects: [{ kind: 'player-in-progress', draft: touring }],
    },
    tourerId: lead.id,
    heatBefore,
  };
}

describe('SCHEDULE_RELEASE - press tour reputation write-back (D2b)', () => {
  it("raises a tourer's currentHeat in the talent pool when their film releases same-day", () => {
    const { state, tourerId, heatBefore } = stateWithPooledTourer(1);
    const after = studioReducer(state, { type: 'SCHEDULE_RELEASE', releaseDay: state.totalDays });
    const poolPerson = after.talentPool.Actor.find((p) => p.id === tourerId)!;
    expect(poolPerson.reputation.currentHeat).toBeGreaterThan(heatBefore);
  });

  it('leaves the pool untouched when the released film ran no press tour', () => {
    const base = buildStateWithReadyDraft(2);
    const draft = asPlayerDraft(findProject(base.projects, base.focusedProjectId))!;
    const lead = draft.talent.find((t) => t.role === 'Lead Actor')!.person;
    const pooledLead = { ...lead, reputation: { ...lead.reputation, currentHeat: 30 } };
    const state: GameState = { ...base, talentPool: { ...base.talentPool, Actor: [pooledLead, ...base.talentPool.Actor] } };
    const after = studioReducer(state, { type: 'SCHEDULE_RELEASE', releaseDay: state.totalDays });
    const poolPerson = after.talentPool.Actor.find((p) => p.id === lead.id)!;
    expect(poolPerson.reputation.currentHeat).toBe(30);
  });
});
