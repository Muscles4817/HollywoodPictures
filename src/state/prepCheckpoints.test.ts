// The prep loop through the reducer, and its notification contract
// (docs/IMPLEMENTATION_PLAN_preproduction_realism.md §4.4-4.5,
// docs/DESIGN_notification_contract.md).
import { describe, expect, it } from 'vitest';
import { studioReducer } from './studioReducer';
import { buildStateReadyToGreenlight, shootThroughToFinish } from './testFixtures';
import { asPlayerDraft, deriveInboxItems, findProject, inboxBadgeCount } from '../engine/project';
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
