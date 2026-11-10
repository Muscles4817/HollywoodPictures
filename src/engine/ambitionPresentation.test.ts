import { describe, it, expect } from 'vitest';
import { describeBetExposure, describeBetOutcomes } from './ambitionPresentation';

describe('describeBetExposure', () => {
  it('reads a plan with nothing at stake as safe, naming no drivers', () => {
    const read = describeBetExposure({ concept: 0, structure: 0, spectacle: 0, total: 0 });
    expect(read.headline).toMatch(/safe, dependable/);
    expect(read.drivers).toEqual([]);
  });

  it('reads a heavily exposed plan as a high-wire act and names what it reaches for', () => {
    const read = describeBetExposure({ concept: 1, structure: 0.8, spectacle: 0, total: 29 });
    expect(read.headline).toMatch(/high-wire/);
    expect(read.drivers).toEqual(['a bold, original concept', 'an intricate structure']);
  });

  it('never shows a number', () => {
    const read = describeBetExposure({ concept: 0.5, structure: 0.5, spectacle: 0.5, total: 15.3 });
    expect(`${read.headline} ${read.drivers.join(' ')}`).not.toMatch(/\d/);
  });
});

describe('describeBetOutcomes', () => {
  it('says nothing when there was no bet or it landed about as planned', () => {
    expect(describeBetOutcomes({})).toEqual([]);
    expect(describeBetOutcomes({ ambitionBets: { concept: 0.1, structure: -0.1, spectacle: 0 } })).toEqual([]);
  });

  it('names a bet that paid off and one that failed', () => {
    const notes = describeBetOutcomes({ ambitionBets: { concept: 0.8, structure: -0.6, spectacle: 0 } });
    expect(notes).toHaveLength(2);
    expect(notes[0]).toMatch(/concept came off/);
    expect(notes[1]).toMatch(/never quite came together/);
  });
});
