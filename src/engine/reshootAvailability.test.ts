import { describe, it, expect } from 'vitest';
import { withRng } from './random';
import { buildReadyDraft } from '../state/testFixtures';
import { generateTalentPool } from './talentGenerator';
import { blockedReshootChoices, describeReshootBlockers, reshootAvailability } from './reshootAvailability';
import type { FilmDraft, Person, ProductionRole, TalentProfession } from '../types';
import { professionForProductionRole } from '../data/helpers';

const TODAY = 400;

function setup() {
  const { result } = withRng(9, (rng) => ({ draft: buildReadyDraft(rng), talentPool: generateTalentPool(rng) }));
  return result;
}

/** Put this film's cast into the live pool, optionally booking one of them elsewhere. */
function poolWithCast(
  draft: FilmDraft,
  talentPool: Record<TalentProfession, Person[]>,
  booking?: { role: ProductionRole; startDay: number; endDay: number; projectId?: string },
): Record<TalentProfession, Person[]> {
  const next = { ...talentPool };
  for (const assignment of draft.talent) {
    const profession = professionForProductionRole(assignment.role);
    const commitments =
      booking && booking.role === assignment.role
        ? [{ projectId: booking.projectId ?? 'rival-film', role: assignment.role, startDay: booking.startDay, endDay: booking.endDay }]
        : [];
    const live: Person = { ...assignment.person, availability: { commitments } };
    next[profession] = [live, ...next[profession].filter((p) => p.id !== live.id)];
  }
  return next;
}

describe('reshootAvailability', () => {
  it('is null for options that need nobody back in front of a camera', () => {
    const { draft, talentPool } = setup();
    // A re-edit is exactly what a studio does when it cannot reshoot, so it
    // must never be blocked by who is free.
    expect(reshootAvailability(draft, talentPool, TODAY, 're-edit')).toBeNull();
    expect(reshootAvailability(draft, talentPool, TODAY, 'release-as-is')).toBeNull();
    expect(reshootAvailability(draft, talentPool, TODAY, 'revert-to-original')).toBeNull();
  });

  it('allows a reshoot when the principals are free', () => {
    const { draft, talentPool } = setup();
    const pool = poolWithCast(draft, talentPool);
    for (const id of ['pickups', 'major-reshoots']) {
      expect(reshootAvailability(draft, pool, TODAY, id)!.available).toBe(true);
    }
    expect(blockedReshootChoices(draft, pool, TODAY)).toEqual({});
  });

  it('refuses a reshoot when a required principal is shooting elsewhere, and names them', () => {
    const { draft, talentPool } = setup();
    const pool = poolWithCast(draft, talentPool, { role: 'Lead Actor', startDay: TODAY - 20, endDay: TODAY + 90 });

    const pickups = reshootAvailability(draft, pool, TODAY, 'pickups')!;
    expect(pickups.available).toBe(false);
    expect(pickups.blockers).not.toHaveLength(0);
    expect(pickups.blockers[0].role).toBe('Lead Actor');
    // Principle 3: a named cause, never a bare refusal.
    expect(describeReshootBlockers(pickups)).toContain(pickups.blockers[0].name);
    expect(describeReshootBlockers(pickups)).toContain('shooting elsewhere');
    // ...and it says when they free up, so the refusal is reasoned about, not just suffered.
    expect(pickups.earliestStartDay).toBe(TODAY + 91);
  });

  it('leaves the edit open when photography is closed - the real studio response', () => {
    const { draft, talentPool } = setup();
    const pool = poolWithCast(draft, talentPool, { role: 'Lead Actor', startDay: TODAY - 20, endDay: TODAY + 90 });
    const blocked = blockedReshootChoices(draft, pool, TODAY);
    expect(Object.keys(blocked).sort()).toEqual(['major-reshoots', 'pickups']);
    expect(blocked['re-edit']).toBeUndefined();
  });

  it('ignores this film\'s own commitment - the cast were booked to make it', () => {
    const { draft, talentPool } = setup();
    const pool = poolWithCast(draft, talentPool, { role: 'Lead Actor', startDay: TODAY - 20, endDay: TODAY + 90, projectId: draft.id });
    expect(reshootAvailability(draft, pool, TODAY, 'pickups')!.available).toBe(true);
  });

  it('reads the LIVE pool, not the hire-time snapshot', () => {
    const { draft, talentPool } = setup();
    // The snapshot on draft.talent predates everything since the hire, so a
    // booking made afterwards only exists in the pool. If this read snapshots
    // the constraint could never fire at all.
    const booked = poolWithCast(draft, talentPool, { role: 'Lead Actor', startDay: TODAY - 5, endDay: TODAY + 30 });
    expect(reshootAvailability(draft, booked, TODAY, 'pickups')!.available).toBe(false);
    expect(draft.talent.every((a) => a.person.availability.commitments.length === 0)).toBe(true);
  });

  it('only blocks when the other job actually overlaps the filming window', () => {
    const { draft, talentPool } = setup();
    // Pickups need 4 days. A job starting well after that does not clash.
    const later = poolWithCast(draft, talentPool, { role: 'Lead Actor', startDay: TODAY + 40, endDay: TODAY + 200 });
    expect(reshootAvailability(draft, later, TODAY, 'pickups')!.available).toBe(true);
    // ...but major reshoots need 16 days, so a job starting in 10 does clash.
    const soon = poolWithCast(draft, talentPool, { role: 'Lead Actor', startDay: TODAY + 10, endDay: TODAY + 200 });
    expect(reshootAvailability(draft, soon, TODAY, 'pickups')!.available).toBe(true);
    expect(reshootAvailability(draft, soon, TODAY, 'major-reshoots')!.available).toBe(false);
  });

  it('blocks major reshoots on the director too, not just the cast', () => {
    const { draft, talentPool } = setup();
    const pool = poolWithCast(draft, talentPool, { role: 'Director', startDay: TODAY - 5, endDay: TODAY + 60 });
    // Pickups do not need the director back; a full reworking does.
    expect(reshootAvailability(draft, pool, TODAY, 'pickups')!.available).toBe(true);
    const reshoots = reshootAvailability(draft, pool, TODAY, 'major-reshoots')!;
    expect(reshoots.available).toBe(false);
    expect(reshoots.blockers[0].role).toBe('Director');
  });
});
