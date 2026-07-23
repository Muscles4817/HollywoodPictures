import { describe, it, expect } from 'vitest';
import { isAvailableImmediately } from './person';
import type { Person, PersonCommitment } from '../types';

// isAvailableImmediately only reads person.availability.commitments, so a thin
// partial is enough to exercise it precisely.
function personWith(commitments: PersonCommitment[]): Person {
  return { availability: { commitments } } as Person;
}
const commitment = (startDay: number, endDay: number): PersonCommitment => ({ projectId: 'p', role: 'Lead Actor', startDay, endDay });

describe('isAvailableImmediately', () => {
  it('is available with no commitments', () => {
    expect(isAvailableImmediately(personWith([]), 100)).toBe(true);
  });

  it('is unavailable while a commitment still runs past today', () => {
    expect(isAvailableImmediately(personWith([commitment(50, 150)]), 100)).toBe(false);
  });

  it('is available once every commitment has ended by today (inclusive of ending exactly today)', () => {
    expect(isAvailableImmediately(personWith([commitment(10, 90)]), 100)).toBe(true);
    expect(isAvailableImmediately(personWith([commitment(10, 100)]), 100)).toBe(true);
  });

  it('flags a not-yet-started future booking as unavailable (matches the "Busy until X" card reading)', () => {
    expect(isAvailableImmediately(personWith([commitment(120, 200)]), 100)).toBe(false);
  });

  it('reads the latest commitment end across several', () => {
    expect(isAvailableImmediately(personWith([commitment(10, 40), commitment(60, 130)]), 100)).toBe(false);
    expect(isAvailableImmediately(personWith([commitment(10, 40), commitment(60, 90)]), 100)).toBe(true);
  });
});
