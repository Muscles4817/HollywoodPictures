// Deferred Start - the earliest a shoot can begin without a booking clash.
import { describe, it, expect } from 'vitest';
import { latestCastBookingEnd } from './person';
import type { Person, PersonCommitment } from '../types';

function actor(id: string, commitments: PersonCommitment[]): Person {
  return { id, availability: { commitments } } as unknown as Person;
}
const booking = (projectId: string, endDay: number): PersonCommitment =>
  ({ projectId, role: 'Lead Actor', startDay: 0, endDay }) as PersonCommitment;

describe('latestCastBookingEnd', () => {
  it('is undefined when nobody is booked', () => {
    expect(latestCastBookingEnd([actor('a', []), actor('b', [])])).toBeUndefined();
    expect(latestCastBookingEnd([])).toBeUndefined();
  });

  it('returns the latest end day across all cast members', () => {
    const cast = [actor('a', [booking('x', 40)]), actor('b', [booking('y', 120), booking('z', 30)])];
    expect(latestCastBookingEnd(cast)).toBe(120);
  });

  it('ignores this film\'s own commitments so it reads only OTHER work', () => {
    const cast = [actor('a', [booking('mine', 500), booking('other', 60)])];
    expect(latestCastBookingEnd(cast, 'mine')).toBe(60);
    // With no exception, the film's own (larger) booking would dominate.
    expect(latestCastBookingEnd(cast)).toBe(500);
  });
});
