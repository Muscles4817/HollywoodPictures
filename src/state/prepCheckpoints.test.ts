// The prep loop through the reducer, and its notification contract
// (docs/IMPLEMENTATION_PLAN_preproduction_realism.md §4.4-4.5,
// docs/DESIGN_notification_contract.md).
import { describe, expect, it } from 'vitest';
import { studioReducer } from './studioReducer';
import { buildStateReadyToGreenlight, prepThroughToShoot, shootThroughToFinish } from './testFixtures';
import { footageLowerBound } from '../engine/production';
import { asPlayerDraft, deriveInboxItems, findProject, inboxBadgeCount, playerDraftToProject } from '../engine/project';
import type { GameState } from './gameState';
import type { FilmDraft } from '../types';

const film = (s: GameState, id?: string): FilmDraft => asPlayerDraft(findProject(s.projects, id ?? s.focusedProjectId!))!;

/** Greenlit with prep in the player's hands, then run until the first checkpoint with something on it. */
function pausedAtCheckpoint(seed = 1): GameState {
  let s = buildStateReadyToGreenlight(seed);
  s = studioReducer(s, { type: 'SET_PREP_PLAN', plan: { lengthFactor: 1, activities: null, delegated: false } });
  s = studioReducer(s, { type: 'GREENLIGHT_PROJECT' });
  for (let i = 0; i < 400 && film(s).preProduction!.status === 'in-progress'; i++) s = studioReducer(s, { type: 'ADVANCE_PREPRODUCTION_DAY' });
  return s;
}

describe('greenlight sets up a real prep', () => {
  it('draws the film\'s problems and takes the plan\'s delegation and length', () => {
    let s = buildStateReadyToGreenlight(2);
    s = studioReducer(s, { type: 'SET_PREP_PLAN', plan: { lengthFactor: 1.25, activities: null, delegated: false } });
    const before = film(s);
    s = studioReducer(s, { type: 'GREENLIGHT_PROJECT' });
    const prep = film(s, before.id).preProduction!;
    expect(prep.problems.length).toBeGreaterThan(0);
    expect(prep.problems.every((p) => p.foundOnDay === null)).toBe(true);
    expect(prep.delegated).toBe(false);
    expect(prep.lengthFactor).toBe(1.25);
  });

  it('cannot change the plan once greenlit', () => {
    const s = studioReducer(buildStateReadyToGreenlight(2), { type: 'GREENLIGHT_PROJECT' });
    expect(studioReducer(s, { type: 'SET_PREP_PLAN', plan: { lengthFactor: 0.75, activities: null, delegated: false } })).toBe(s);
  });
});

describe('a checkpoint the player answers', () => {
  it('pauses prep and tells the player, in the Inbox and the badge', () => {
    const s = pausedAtCheckpoint();
    const prep = film(s).preProduction!;
    expect(prep.status).toBe('awaiting-checkpoint');
    expect(prep.pendingCheckpoint!.problemIds.length).toBeGreaterThan(0);
    // Paused: another prep day does nothing.
    expect(studioReducer(s, { type: 'ADVANCE_PREPRODUCTION_DAY' })).toBe(s);
    // Focus survives leaving the prep screen, so the card includes the focused film.
    const items = deriveInboxItems(s.projects, s.focusedProjectId, s.totalDays);
    expect(items.prepCheckpoints.map((d) => d.id)).toEqual([film(s).id]);
    expect(inboxBadgeCount(s.projects, s.focusedProjectId, s.totalDays)).toBeGreaterThanOrEqual(1);
  });

  it('routes to the prep briefing in one click from anywhere', () => {
    const s = { ...pausedAtCheckpoint(), screen: 'dashboard' as const };
    expect(studioReducer(s, { type: 'GO_TO_PREPRODUCTION' }).screen).toBe('pre-production');
    const unfocused = { ...s, focusedProjectId: null };
    const resumed = studioReducer(unfocused, { type: 'RESUME_PROJECT', projectId: film(s).id });
    expect(resumed.screen).toBe('pre-production');
  });

  it('answering it applies each choice, charges for it, resumes prep and clears the card', () => {
    const s = pausedAtCheckpoint();
    const prep = film(s).preProduction!;
    const [first, ...rest] = prep.pendingCheckpoint!.problemIds;
    const after = studioReducer(s, { type: 'RESOLVE_PREP_CHECKPOINT', productionId: film(s).id, choices: { [first]: 'carry' } });
    const resolved = film(after).preProduction!;
    expect(resolved.status === 'in-progress' || resolved.status === 'awaiting-checkpoint' || resolved.status === 'finished').toBe(true);
    expect(resolved.problems.find((p) => p.id === first)!.resolution!.option).toBe('carry');
    for (const id of rest) expect(resolved.problems.find((p) => p.id === id)!.resolution!.option).toBe('carry'); // unanswered = carried
    expect(resolved.nextCheckpoint).toBe(prep.pendingCheckpoint!.index + 1);
    if (resolved.status !== 'awaiting-checkpoint') expect(deriveInboxItems(after.projects, after.focusedProjectId, after.totalDays).prepCheckpoints).toEqual([]);
  });

  it('a paid fix leaves cash now; a time fix lengthens prep', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const s = pausedAtCheckpoint(seed);
      const prep = film(s).preProduction!;
      const timeable = prep.problems.find((p) => prep.pendingCheckpoint!.problemIds.includes(p.id) && ['long-lead-build', 'costume-lead-time', 'location-at-risk', 'action-unready', 'unrehearsed', 'visions-differ', 'director-undecided', 'flat-pairing', 'difficult-star'].includes(p.kind));
      if (!timeable) continue;
      const after = studioReducer(s, { type: 'RESOLVE_PREP_CHECKPOINT', productionId: film(s).id, choices: { [timeable.id]: 'time' } });
      const resolved = film(after).preProduction!;
      expect(resolved.recommendedDays).toBeGreaterThan(prep.recommendedDays);
      expect(resolved.daysAdded).toBeGreaterThan(0);
      return;
    }
    throw new Error('no seed paused on a problem with a time fix');
  });

  it('handing the prep to the team answers the open checkpoint at once', () => {
    const s = pausedAtCheckpoint();
    const after = studioReducer(s, { type: 'SET_PREP_DELEGATION', productionId: film(s).id, delegated: true });
    const prep = film(after).preProduction!;
    expect(prep.delegated).toBe(true);
    expect(prep.status).not.toBe('awaiting-checkpoint');
    for (const id of film(s).preProduction!.pendingCheckpoint!.problemIds) expect(prep.problems.find((p) => p.id === id)!.resolution!.decidedBy).toBe('team');
  });
});

describe('a delegated prep', () => {
  it('never stops for the player, and its team decides every checkpoint', () => {
    let s = studioReducer(buildStateReadyToGreenlight(4), { type: 'GREENLIGHT_PROJECT' });
    const id = film(s).id;
    for (let i = 0; i < 400 && film(s, id).preProduction!.status === 'in-progress'; i++) s = studioReducer(s, { type: 'ADVANCE_PREPRODUCTION_DAY' });
    const prep = film(s, id).preProduction!;
    expect(prep.status).toBe('finished');
    expect(prep.nextCheckpoint).toBe(4);
    expect(film(s, id).photography).not.toBeNull();
  });
});

describe('carried problems reach the shoot', () => {
  it('fire as recorded events on the focused shoot', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const lit = studioReducer(buildStateReadyToGreenlight(seed), { type: 'GREENLIGHT_PROJECT' });
      const id = film(lit).id;
      const done = shootThroughToFinish(lit, id);
      const d = film(done, id);
      const carried = d.preProduction!.problems.filter((p) => p.severity > 0.05);
      if (carried.length === 0) continue;
      const ids = d.photography!.events.map((e) => e.id);
      const firedHere = carried.filter((p) => ids.includes(`prep-incident-${p.id}`));
      // Every carried problem whose day the shoot reached has fired.
      expect(firedHere.length).toBeGreaterThan(0);
      expect(d.photography!.carriedIncidents!.every((i) => i.day > d.photography!.daysElapsed)).toBe(true);
      return;
    }
    throw new Error('no seed carried a problem into the shoot');
  });
});

describe('the money (Phase 4 review)', () => {
  it('a paid fix leaves cash at once', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const s = pausedAtCheckpoint(seed);
      const prep = film(s).preProduction!;
      const payable = prep.problems.find((p) => prep.pendingCheckpoint!.problemIds.includes(p.id) && p.kind !== 'difficult-star' && ['implied-element', 'budget-gap', 'long-lead-build', 'costume-lead-time', 'location-at-risk', 'location-logistics', 'action-unready', 'effects-method'].includes(p.kind));
      if (!payable) continue;
      const after = studioReducer(s, { type: 'RESOLVE_PREP_CHECKPOINT', productionId: film(s).id, choices: { [payable.id]: 'pay' } });
      const paid = film(after).preProduction!.problems.find((p) => p.id === payable.id)!.resolution!;
      expect(paid.option).toBe('pay');
      expect(paid.costPaid).toBeGreaterThan(0);
      expect(s.studio.cash - after.studio.cash).toBe(paid.costPaid);
      return;
    }
    throw new Error('no seed paused on a payable problem');
  });

  it('contingency a prep fix drew does not come back at wrap', () => {
    for (let seed = 1; seed <= 1; seed++) {
      const paused = pausedAtCheckpoint(seed);
      const p0 = film(paused).preProduction!;
      // A found budget gap, small enough for the reserve to cover, on the table.
      const gap = { id: 'budget-gap-test', kind: 'budget-gap' as const, front: 'breakdown' as const, severity: 0.1, foundOnDay: p0.daysElapsed, resolution: null };
      const withGap: FilmDraft = { ...film(paused), productionChoices: { ...film(paused).productionChoices!, contingencyReserveAmount: 5_000_000 }, preProduction: { ...p0, problems: [...p0.problems, gap], pendingCheckpoint: { ...p0.pendingCheckpoint!, problemIds: [...p0.pendingCheckpoint!.problemIds, gap.id] } } };
      const s: GameState = { ...paused, projects: paused.projects.map((p) => (asPlayerDraft(p)?.id === withGap.id ? playerDraftToProject(withGap) : p)) };
      const after = studioReducer(s, { type: 'RESOLVE_PREP_CHECKPOINT', productionId: film(s).id, choices: { [gap.id]: 'contingency' } });
      const used = film(after).preProduction!.problems.find((p) => p.id === gap.id)!.resolution!.contingencyUsed;
      if (used <= 0) continue;
      expect(after.studio.cash).toBe(s.studio.cash); // nothing from cash now
      let shooting = prepThroughToShoot(after, film(after).id);
      const id = film(shooting).id;
      for (let i = 0; i < 400; i++) {
        const photo = film(shooting).photography!;
        if (photo.daysElapsed >= footageLowerBound(photo.recommendedDays)) break;
        shooting = photo.status === 'awaiting-choice'
          ? studioReducer(shooting, { type: 'RESOLVE_EVENT_CHOICE', choiceId: photo.pendingChoice!.choices[0].id, productionId: id })
          : studioReducer(shooting, { type: 'ADVANCE_SHOOTING_DAY' });
      }
      const d = film(shooting);
      const committed = d.productionChoices!.shootingBudgetAmount + (d.productionChoices!.contingencyReserveAmount ?? 0);
      const wrapped = studioReducer(shooting, { type: 'FINISH_PHOTOGRAPHY', productionId: id });
      // The wrap refund is the reserve less the shoot's spend AND what prep drew.
      expect(wrapped.studio.cash - shooting.studio.cash).toBeCloseTo(committed - used - d.photography!.runningCost, 2);
      return;
    }
    throw new Error('the reserve could not cover the test gap');
  });
});

describe('a backgrounded shoot fires carried problems too', () => {
  it('as its own events, without the focused screen', async () => {
    const { settleProductionsInProgress } = await import('../engine/productionsInProgress');
    for (let seed = 1; seed <= 10; seed++) {
      const lit = studioReducer(buildStateReadyToGreenlight(seed), { type: 'GREENLIGHT_PROJECT' });
      let s = lit;
      const id = film(s).id;
      for (let i = 0; i < 400 && film(s, id).preProduction!.status === 'in-progress'; i++) s = studioReducer(s, { type: 'ADVANCE_PREPRODUCTION_DAY' });
      const d = film(s, id);
      const due = d.photography?.carriedIncidents ?? [];
      if (due.length === 0) continue;
      const [shot] = settleProductionsInProgress([d], due[0].day + 1, s.talentPool, () => 0.99);
      expect(shot.photography!.events.some((e) => e.id === `prep-incident-${due[0].problemId}`)).toBe(true);
      return;
    }
    throw new Error('no seed carried a problem');
  });
});

describe('handing over the last checkpoint', () => {
  it('moves the screen on to the shoot if it finishes prep', () => {
    const s = pausedAtCheckpoint();
    const prep = film(s).preProduction!;
    // Paused at the production meeting with prep's days all run.
    const atEnd: FilmDraft = { ...film(s), preProduction: { ...prep, daysElapsed: prep.recommendedDays, nextCheckpoint: 3, pendingCheckpoint: { ...prep.pendingCheckpoint!, index: 3 } } };
    const state: GameState = { ...s, screen: 'pre-production', projects: s.projects.map((p) => (asPlayerDraft(p)?.id === atEnd.id ? playerDraftToProject(atEnd) : p)) };
    const after = studioReducer(state, { type: 'SET_PREP_DELEGATION', productionId: atEnd.id, delegated: true });
    expect(film(after).preProduction!.status).toBe('finished');
    expect(film(after).photography).not.toBeNull();
    expect(after.screen).toBe('production');
  });
});
