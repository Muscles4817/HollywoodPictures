// Time costs real things (docs/IMPLEMENTATION_PLAN_preproduction_realism.md Phase 5).
import { describe, expect, it } from 'vitest';
import { studioReducer, expectedShootEndDay, withSlipsMovePeopleForTest } from './studioReducer';
import { buildStateReadyToGreenlight } from './testFixtures';
import { asPlayerDraft, deriveInboxItems, findProject, inboxBadgeCount, playerDraftToProject } from '../engine/project';
import { applySlip, leaveShareForSlip } from '../engine/prep/slips';
import { personMeetsCharacterGender } from '../engine/casting';
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

describe('the Phase 5 review', () => {
  /** A greenlit film whose whole cast and crew each hold a far-off job elsewhere. */
  function everyoneBookedLater(): { s: GameState; d: FilmDraft; end: number } {
    const s0 = studioReducer(buildStateReadyToGreenlight(5), { type: 'GREENLIGHT_PROJECT' });
    const d = film(s0);
    const end = expectedShootEndDay(d, s0.totalDays)!;
    const onFilm = new Set(d.talent.map((a) => a.person.id));
    const talentPool = Object.fromEntries(
      Object.entries(s0.talentPool).map(([k, people]) => [k, people.map((p) => (onFilm.has(p.id) ? { ...p, availability: { commitments: [...p.availability.commitments, { projectId: `elsewhere-${p.id}`, role: 'Director' as const, startDay: end + 300, endDay: end + 400 }] } } : p))]),
    ) as GameState['talentPool'];
    return { s: { ...s0, talentPool }, d, end };
  }

  it('a run of small slips never takes more than the table\'s share of those in demand', () => {
    const { s, d, end } = everyoneBookedLater();
    const movable = d.talent.filter((a) => a.role !== 'Writer').length;
    let draft = d;
    let pool = s.talentPool;
    let left = 0;
    let total = 0;
    for (const step of [14, 1, 1, 1, 1]) {
      const oldEnd = end + total;
      total += step;
      const r = applySlip({ draft, oldEnd, newEnd: end + total, totalSlip: total, today: s.totalDays, worked: 0.1, pool });
      left += r.changes.filter((c) => c.reason === 'moved-on').length;
      draft = r.draft;
      pool = r.pool;
    }
    // 18 days in all sits in the 2-4 week band (35%); one fixed roll per person means no compounding.
    expect(left).toBeLessThanOrEqual(Math.ceil(0.35 * movable) + 2);
    expect(left).toBeLessThan(movable);
  });

  it('a buyout releases the clashing job, so it is paid once', () => {
    const { s, d, end, director } = withDirectorBookedAfter(5);
    // Nobody else can direct: empty the rest of the director pool.
    const prof = professionForProductionRole('Director');
    const pool = { ...s.talentPool, [prof]: s.talentPool[prof].filter((p) => p.id === director.id) };
    const first = applySlip({ draft: d, oldEnd: end, newEnd: end + 21, totalSlip: 21, today: s.totalDays, worked: 0.1, pool });
    expect(first.changes).toHaveLength(1);
    expect(first.changes[0].replacementName).toBeNull();
    expect(first.cash).toBeGreaterThan(0);
    const again = applySlip({ draft: first.draft, oldEnd: end + 21, newEnd: end + 28, totalSlip: 28, today: s.totalDays, worked: 0.1, pool: first.pool });
    expect(again.changes.filter((c) => c.role === 'Director')).toEqual([]);
  });

  it('a replacement actor can play the character (gender), and the books carry what the departed is owed', () => {
    const s0 = studioReducer(buildStateReadyToGreenlight(6), { type: 'GREENLIGHT_PROJECT' });
    const d = film(s0);
    const end = expectedShootEndDay(d, s0.totalDays)!;
    const lead = d.talent.find((a) => a.role === 'Lead Actor' && a.characterId)!;
    const character = d.script!.cast.find((c) => c.id === lead.characterId)!;
    const prof = professionForProductionRole('Lead Actor');
    const pool = { ...s0.talentPool, [prof]: s0.talentPool[prof].map((p) => (p.id === lead.person.id ? { ...p, availability: { commitments: [...p.availability.commitments, { projectId: 'other', role: 'Lead Actor' as const, startDay: end + 3, endDay: end + 90 }] } } : p)) };
    const r = applySlip({ draft: d, oldEnd: end, newEnd: end + 21, totalSlip: 21, today: s0.totalDays, worked: 0.1, pool });
    const replaced = r.draft.talent.find((a) => a.characterId === lead.characterId)!;
    expect(replaced.person.id).not.toBe(lead.person.id);
    expect(personMeetsCharacterGender(replaced.person, character)).toBe(true);
    // Pay-or-play: the departed lead's fee stays on the film's books.
    expect(r.booksCost).toBeGreaterThanOrEqual(lead.agreedSalary ?? 0);
  });

  it('fires through a real checkpoint answer that takes prep time', () => {
    for (let seed = 1; seed <= 12; seed++) {
      let s = buildStateReadyToGreenlight(seed);
      s = studioReducer(s, { type: 'SET_PREP_PLAN', plan: { lengthFactor: 1, activities: null, delegated: false } });
      s = studioReducer(s, { type: 'GREENLIGHT_PROJECT' });
      for (let i = 0; i < 400 && film(s).preProduction!.status === 'in-progress'; i++) s = studioReducer(s, { type: 'ADVANCE_PREPRODUCTION_DAY' });
      const prep = film(s).preProduction!;
      if (prep.status !== 'awaiting-checkpoint') continue;
      const timeable = prep.problems.find((p) => prep.pendingCheckpoint!.problemIds.includes(p.id) && ['long-lead-build', 'costume-lead-time', 'location-at-risk', 'action-unready', 'unrehearsed', 'visions-differ', 'director-undecided'].includes(p.kind));
      if (!timeable) continue;
      // Book the director into a job right after the film's current end.
      const d = film(s);
      const end = expectedShootEndDay(d, s.totalDays)!;
      const dir = d.talent.find((a) => a.role === 'Director')!;
      const prof = professionForProductionRole('Director');
      s = { ...s, talentPool: { ...s.talentPool, [prof]: s.talentPool[prof].map((p) => (p.id === dir.person.id ? { ...p, availability: { commitments: [...p.availability.commitments, { projectId: 'other', role: 'Director' as const, startDay: end + 1, endDay: end + 90 }] } } : p)) } };
      const after = studioReducer(s, { type: 'RESOLVE_PREP_CHECKPOINT', productionId: d.id, choices: { [timeable.id]: 'time' } });
      const slipped = film(after);
      expect(slipped.preProduction!.daysAdded).toBeGreaterThan(0);
      expect(slipped.crewChanges?.some((c) => c.role === 'Director')).toBe(true);
      // Bookings for those who stay follow at once, with no day passing.
      const lead = slipped.talent.find((a) => a.role === 'Lead Actor')!;
      const booking = after.talentPool[professionForProductionRole('Lead Actor')].find((p) => p.id === lead.person.id)!.availability.commitments.find((c) => c.projectId === d.id)!;
      expect(booking.endDay).toBeGreaterThanOrEqual(expectedShootEndDay(slipped, after.totalDays)!);
      return;
    }
    throw new Error('no seed paused on a problem with a time fix');
  });
});
