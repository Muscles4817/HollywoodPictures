import { describe, it, expect } from 'vitest';
import { withRng } from './random';
import { buildReadyDraft } from '../state/testFixtures';
import { generateTalentPool } from './talentGenerator';
import { RESHOOT_REQUIREMENTS, describeReshootBlockers, reshootAvailability, reshootChoiceConstraints, reshootSurcharge } from './reshootAvailability';
import type { FilmDraft, Person, ProductionRole, TalentProfession } from '../types';
import { professionForProductionRole } from '../data/helpers';

const TODAY = 400;

function setup() {
  const { result } = withRng(9, (rng) => ({ draft: buildReadyDraft(rng), talentPool: generateTalentPool(rng) }));
  return result;
}

type Booking = { role: ProductionRole; startDay: number; endDay: number; projectId?: string };

/**
 * Put this film's cast into the live pool, with whatever other work is holding
 * them up. Takes ALL bookings at once rather than being called repeatedly:
 * every call rebuilds each cast member from their draft snapshot, so a second
 * call would silently wipe the first call's booking.
 */
function poolWithCast(
  draft: FilmDraft,
  talentPool: Record<TalentProfession, Person[]>,
  ...bookings: Booking[]
): Record<TalentProfession, Person[]> {
  const next = { ...talentPool };
  for (const assignment of draft.talent) {
    const profession = professionForProductionRole(assignment.role);
    const commitments = bookings
      .filter((b) => b.role === assignment.role)
      .map((b) => ({ projectId: b.projectId ?? 'rival-film', role: assignment.role, startDay: b.startDay, endDay: b.endDay }));
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
    expect(reshootChoiceConstraints(draft, pool, TODAY)).toEqual({});
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
    const blocked = reshootChoiceConstraints(draft, pool, TODAY);
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

  // Buying a principal out (docs/domain/07-postproduction.md on reshoots).
  // The ceiling is the point: if money always worked, refusal would
  // collapse into a price and time would be buyable again.
  describe('buying a principal out', () => {
    it('offers a buy-out when the other job is nearly done, and prices it off their fee', () => {
      const { draft, talentPool } = setup();
      const pool = poolWithCast(draft, talentPool, { role: 'Lead Actor', startDay: TODAY - 40, endDay: TODAY + 5 });
      const pickups = reshootAvailability(draft, pool, TODAY, 'pickups')!;

      expect(pickups.available).toBe(false); // still not simply free
      expect(pickups.buyOut).not.toBeNull();
      expect(pickups.buyOut!.cost).toBeGreaterThan(0);
      expect(pickups.buyOut!.names).toEqual(pickups.blockers.map((b) => b.name));
      // Not a refusal any more - the option is takeable, at a price.
      expect(reshootChoiceConstraints(draft, pool, TODAY).pickups).toEqual({
        blocked: false,
        surcharge: pickups.buyOut!.cost,
        note: expect.stringContaining('release'),
      });
    });

    it('refuses at any price when the other production is too deep in its schedule', () => {
      const { draft, talentPool } = setup();
      // Well past MAX_BUY_OUT_REMAINING_DAYS - the ask stops being "let them go
      // early" and becomes "shut your film down".
      const pool = poolWithCast(draft, talentPool, { role: 'Lead Actor', startDay: TODAY - 5, endDay: TODAY + 120 });
      const pickups = reshootAvailability(draft, pool, TODAY, 'pickups')!;
      expect(pickups.buyOut).toBeNull();
      expect(reshootChoiceConstraints(draft, pool, TODAY).pickups.blocked).toBe(true);
      expect(describeReshootBlockers(pickups)).toContain('at any price');
      expect(reshootSurcharge(draft, pool, TODAY, 'pickups')).toBeNull();
    });

    it('costs more the deeper into their other commitment you reach', () => {
      const { draft, talentPool } = setup();
      const costAt = (endOffset: number) =>
        reshootAvailability(draft, poolWithCast(draft, talentPool, { role: 'Lead Actor', startDay: TODAY - 5, endDay: TODAY + endOffset }), TODAY, 'pickups')!
          .buyOut!.cost;
      // Nearly wrapped is close to a formality; a month out is ruinous.
      expect(costAt(2)).toBeLessThan(costAt(14));
      expect(costAt(14)).toBeLessThan(costAt(28));
    });

    it('is all-or-nothing - one immovable principal closes the option however cheap the rest are', () => {
      const { draft, talentPool } = setup();
      // The lead could be released; the director cannot. You cannot shoot the
      // scene without either of them, so the option is still refused.
      const pool = poolWithCast(
        draft,
        talentPool,
        { role: 'Lead Actor', startDay: TODAY - 5, endDay: TODAY + 3 },
        { role: 'Director', startDay: TODAY - 5, endDay: TODAY + 150 },
      );
      const reshoots = reshootAvailability(draft, pool, TODAY, 'major-reshoots')!;
      expect(reshoots.blockers.some((b) => b.buyOutCost !== null)).toBe(true);
      expect(reshoots.blockers.some((b) => b.buyOutCost === null)).toBe(true);
      expect(reshoots.buyOut).toBeNull();
    });

    it('charges nothing extra when nobody is blocked', () => {
      const { draft, talentPool } = setup();
      expect(reshootSurcharge(draft, poolWithCast(draft, talentPool), TODAY, 'pickups')).toBe(0);
      expect(reshootSurcharge(draft, talentPool, TODAY, 're-edit')).toBe(0);
    });
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

describe('a recalled principal is occupied by the reshoot', () => {
  it('books the required roles for the filming window', () => {
    // Review finding: the recall was charged for and then the principals were
    // left free in the pool, so a rival could book them the next day while they
    // were supposedly on this film's set.
    const { draft, talentPool } = setup();
    const pool = poolWithCast(draft, talentPool);
    expect(reshootAvailability(draft, pool, TODAY, 'pickups')!.available).toBe(true);

    // Simulate the reducer's own booking, then re-read.
    const filmingDays = RESHOOT_REQUIREMENTS.pickups.filmingDays;
    const occupied = {
      ...pool,
      Actor: pool.Actor.map((p) =>
        draft.talent.some((a) => a.role === 'Lead Actor' && a.person.id === p.id)
          ? { ...p, availability: { commitments: [{ projectId: 'another-film', role: 'Lead Actor' as const, startDay: TODAY, endDay: TODAY + filmingDays }] } }
          : p,
      ),
    };
    // Someone genuinely on a set cannot also be on another - which is the state
    // the reducer now puts them in, rather than leaving them advertised as free.
    expect(reshootAvailability(draft, occupied, TODAY, 'pickups')!.available).toBe(false);
  });
});
