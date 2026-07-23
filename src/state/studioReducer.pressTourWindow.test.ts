import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { buildStateWithReadyDraft } from './testFixtures';
import { asScheduled, asPlayerDraft, playerDraftToProject } from '../engine/project';
import type { GameState } from './gameState';
import type { FilmDraft } from '../types';

/** A state whose one film is release-ready, tours its (loose-cannon) lead, and is scheduled for `offset` days out (so it stays 'scheduled'). */
function scheduledTouringState(seed: number, offset = 45): { state: GameState; leadId: string } {
  const base = buildStateWithReadyDraft(seed);
  const draft = asPlayerDraft(base.projects[0])!;
  const lead = draft.talent.find((t) => t.role === 'Lead Actor')!.person;
  // A maxed liability so window incidents actually fire on a fraction of seeds.
  const wild = { ...lead, personality: { ...lead.personality, controversy: 95, professionalism: 20, pressureHandling: 15 } };
  const touring: FilmDraft = {
    ...draft,
    talent: draft.talent.map((t) => (t.person.id === lead.id ? { ...t, person: wild } : t)),
    marketingChoices: { ...draft.marketingChoices!, pressTourCast: [lead.id] },
  };
  const staged: GameState = { ...base, projects: [playerDraftToProject(touring)], focusedProjectId: touring.id };
  const scheduled = studioReducer(staged, { type: 'SCHEDULE_RELEASE', releaseDay: base.totalDays + offset });
  return { state: scheduled, leadId: lead.id };
}

function scheduledDraftOf(state: GameState): FilmDraft | undefined {
  const scheduledProject = state.projects.find((p) => p.kind === 'scheduled');
  return scheduledProject ? asScheduled(scheduledProject)!.draft : undefined;
}

describe('ADVANCE_DAY - press tour window roll', () => {
  it('rolls the window exactly once, marking the scheduled draft rolled after the first advance', () => {
    const { state } = scheduledTouringState(1);
    expect(scheduledDraftOf(state)!.pressTourWindowRolled).toBeFalsy(); // not yet
    const after = studioReducer(state, { type: 'ADVANCE_DAY' });
    expect(scheduledDraftOf(after)!.pressTourWindowRolled).toBe(true);
  });

  it('never rolls a scheduled film that booked no press tour', () => {
    const base = buildStateWithReadyDraft(2);
    const draft = asPlayerDraft(base.projects[0])!;
    const staged: GameState = { ...base, projects: [playerDraftToProject(draft)], focusedProjectId: draft.id };
    const scheduled = studioReducer(staged, { type: 'SCHEDULE_RELEASE', releaseDay: base.totalDays + 45 });
    const after = studioReducer(scheduled, { type: 'ADVANCE_DAY' });
    const d = scheduledDraftOf(after)!;
    expect(d.pressTourWindowRolled).toBeFalsy();
    expect(d.pressTourIncident ?? null).toBeNull();
  });

  it('some seed fires an incident, keyed to the tourer, with a response set to answer', () => {
    let fired: FilmDraft | undefined;
    for (let seed = 1; seed <= 60 && !fired; seed++) {
      const { state, leadId } = scheduledTouringState(seed);
      const after = studioReducer(state, { type: 'ADVANCE_DAY' });
      const d = scheduledDraftOf(after);
      if (d?.pressTourIncident) {
        expect(d.pressTourIncident.base.personId).toBe(leadId);
        expect(d.pressTourIncident.polarity).toBe('negative');
        expect(typeof d.pressTourIncident.situation).toBe('string');
        fired = d;
      }
    }
    expect(fired, 'expected at least one seed in 1..60 to fire a window incident').toBeDefined();
  });
});

describe('RESOLVE_PRESS_TOUR_INCIDENT', () => {
  /** Find a seed whose first advance fires an incident, and return that post-incident state + the scheduled id. */
  function stateWithFiredIncident(): { state: GameState; productionId: string } {
    for (let seed = 1; seed <= 60; seed++) {
      const { state } = scheduledTouringState(seed);
      const after = studioReducer(state, { type: 'ADVANCE_DAY' });
      const d = scheduledDraftOf(after);
      if (d?.pressTourIncident) return { state: after, productionId: d.id };
    }
    throw new Error('no seed fired an incident');
  }

  it('answering an incident stores the resolved moment and clears the pending incident', () => {
    const { state, productionId } = stateWithFiredIncident();
    const after = studioReducer(state, { type: 'RESOLVE_PRESS_TOUR_INCIDENT', choiceId: 'apologize', productionId });
    const d = scheduledDraftOf(after)!;
    expect(d.pressTourIncident ?? null).toBeNull();
    expect(d.pressTourResolvedMoment).toBeTruthy();
    // The apology story clause was appended.
    expect(d.pressTourResolvedMoment!.story).toContain('apology');
  });

  it('is a no-op for an unknown production id', () => {
    const { state } = stateWithFiredIncident();
    const after = studioReducer(state, { type: 'RESOLVE_PRESS_TOUR_INCIDENT', choiceId: 'apologize', productionId: 'nope' });
    expect(after).toBe(state);
  });
});
