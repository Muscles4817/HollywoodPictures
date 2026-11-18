// Time costs real things (docs/IMPLEMENTATION_PLAN_preproduction_realism.md Phase 5).
import { describe, expect, it } from 'vitest';
import { studioReducer, expectedShootEndDay, withSlipsMovePeopleForTest } from './studioReducer';
import { buildStateReadyToGreenlight } from './testFixtures';
import { asPlayerDraft, deriveInboxItems, findProject, inboxBadgeCount, playerDraftToProject } from '../engine/project';
import { applySlip, leaveShareForSlip } from '../engine/prep/slips';
import { professionForProductionRole } from '../data/helpers';
import type { GameState } from './gameState';
import type { FilmDraft, Person } from '../types';

const film = (s: GameState): FilmDraft => asPlayerDraft(findProject(s.projects, s.focusedProjectId!))!;

/** Greenlit, prepping, with the director booked on another film starting `gap` days after this one's current end. */
function withDirectorBookedAfter(gap: number): { s: GameState; d: FilmDraft; end: number; director: Person } {
  let s = studioReducer(buildStateReadyToGreenlight(3), { type: 'GREENLIGHT_PROJECT' });
  const d = film(s);
  const end = expectedShootEndDay(d, s.totalDays)!;
  const a = d.talent.find((t) => t.role === 'Director')!;
  const prof = professionForProductionRole('Director');
  const pool = {
    ...s.talentPool,
    [prof]: s.talentPool[prof].map((p) => (p.id === a.person.id ? { ...p, availability: { commitments: [...p.availability.commitments, { projectId: 'other-film', role: 'Director' as const, startDay: end + gap, endDay: end + gap + 60 }] } } : p)),
  };
  s = { ...s, talentPool: pool };
  return { s, d, end, director: pool[prof].find((p) => p.id === a.person.id)! };
}

describe('applySlip', () => {
  it('a three-week slip into the director\'s next job loses the director, and someone free replaces them', () => {
    const { s, d, end, director } = withDirectorBookedAfter(10);
    const r = applySlip({ draft: d, oldEnd: end, newEnd: end + 21, totalSlip: 21, today: s.totalDays, worked: 0.1, pool: s.talentPool });
    const newDirector = r.draft.talent.find((t) => t.role === 'Director')!.person;
    expect(newDirector.id).not.toBe(director.id);
    expect(r.changes.some((c) => c.role === 'Director' && c.reason === 'clash' && c.replacementName === newDirector.identity.name)).toBe(true);
    // The director is pay-or-play: the studio pays the replacement on top.
    expect(r.cash).toBeGreaterThan(0);
    // The departed is released from the film; the replacement is booked for the new window.
    const prof = professionForProductionRole('Director');
    expect(r.pool[prof].find((p) => p.id === director.id)!.availability.commitments.some((c) => c.projectId === d.id)).toBe(false);
    expect(r.pool[prof].find((p) => p.id === newDirector.id)!.availability.commitments.some((c) => c.projectId === d.id && c.endDay === end + 21)).toBe(true);
  });

  it('a two-day slip that clashes with nobody loses nobody', () => {
    const { s, d, end } = withDirectorBookedAfter(30);
    const r = applySlip({ draft: d, oldEnd: end, newEnd: end + 2, totalSlip: 2, today: s.totalDays, worked: 0.1, pool: s.talentPool });
    expect(r.changes).toEqual([]);
    expect(r.draft).toBe(d);
  });

  it('the further a film slips, the more of its in-demand people move on (04 §9.6)', () => {
    expect(leaveShareForSlip(3)).toBe(0);
    expect(leaveShareForSlip(7)).toBeLessThan(leaveShareForSlip(21));
    expect(leaveShareForSlip(21)).toBeLessThan(leaveShareForSlip(50));
  });
});

describe('a slip through the reducer', () => {
  it('replaces whoever clashes, charges for it, notifies the player, and the notice clears on acknowledgement', () => {
    const { s: before, d } = withDirectorBookedAfter(5);
    // Prep grows by three weeks, as a time fix makes it.
    const grown: FilmDraft = { ...d, preProduction: { ...d.preProduction!, recommendedDays: d.preProduction!.recommendedDays + 21, daysAdded: 21 } };
    const after: GameState = { ...before, projects: before.projects.map((p) => (asPlayerDraft(p)?.id === d.id ? playerDraftToProject(grown) : p)) };
    const slippedState = withSlipsMovePeopleForTest(before, after);
    const slipped = asPlayerDraft(findProject(slippedState.projects, d.id))!;
    expect(slipped.crewChanges!.some((c) => c.role === 'Director')).toBe(true);
    expect(slipped.preProduction!.log.some((e) => e.kind === 'note')).toBe(true);
    expect(slippedState.studio.cash).toBeLessThan(before.studio.cash);
    expect(deriveInboxItems(slippedState.projects, slippedState.focusedProjectId, slippedState.totalDays).crewChanges.map((x) => x.id)).toEqual([d.id]);
    const badge = inboxBadgeCount(slippedState.projects, slippedState.focusedProjectId, slippedState.totalDays);
    const read = studioReducer(slippedState, { type: 'ACKNOWLEDGE_CREW_CHANGES', productionId: d.id });
    expect(deriveInboxItems(read.projects, read.focusedProjectId, read.totalDays).crewChanges).toEqual([]);
    expect(inboxBadgeCount(read.projects, read.focusedProjectId, read.totalDays)).toBe(badge - 1);
  });

  it('extends the bookings of those who stay once the calendar moves', () => {
    const { s: before, d } = withDirectorBookedAfter(400);
    const grown: FilmDraft = { ...d, preProduction: { ...d.preProduction!, recommendedDays: d.preProduction!.recommendedDays + 10, daysAdded: 10 } };
    const after: GameState = { ...before, projects: before.projects.map((p) => (asPlayerDraft(p)?.id === d.id ? playerDraftToProject(grown) : p)) };
    const next = studioReducer(after, { type: 'ADVANCE_DAY' });
    const lead = asPlayerDraft(findProject(next.projects, d.id))!.talent.find((t) => t.role === 'Lead Actor')!;
    const live = next.talentPool[professionForProductionRole('Lead Actor')].find((p) => p.id === lead.person.id)!;
    const booking = live.availability.commitments.find((c) => c.projectId === d.id)!;
    expect(booking.endDay).toBeGreaterThanOrEqual(expectedShootEndDay(asPlayerDraft(findProject(next.projects, d.id))!, next.totalDays)!);
  });
});
