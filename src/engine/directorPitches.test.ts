import { describe, it, expect } from 'vitest';
import { openDirectorPitches, tickDirectorPitches, willingPitchers, pitchInclination } from './directorPitches';
import { generateScriptOptions } from './scriptGenerator';
import { createRng } from './random';
import type { DirectorPitchProcess, FilmDraft, Genre, Person, Script, Studio, ToneProfile } from '../types';

function scriptOfGenre(genre: Genre, seed: number): Script {
  return generateScriptOptions(genre, createRng(seed), 1)[0];
}

function studio(overrides: Partial<Studio> = {}): Studio {
  return { name: 'Test Studio', cash: 10_000_000, brand: 50, prestige: 50, assets: [], intellectualProperties: [], ...overrides };
}

const FLAT_TONE: ToneProfile = { action: 50, comedy: 50, romance: 50, suspense: 50, drama: 50, spectacle: 50 };

function director(id: string, overrides: { fame?: number; ego?: number; toneProfile?: ToneProfile; bookedUntil?: number } = {}): Person {
  return {
    id,
    identity: { name: id, appearanceTags: [] },
    personality: { professionalism: 50, ambition: 50, loyalty: 50, ego: overrides.ego ?? 50, temperament: 50, pressureHandling: 50, controversy: 50, adaptability: 50 },
    reputation: { fame: overrides.fame ?? 40, prestige: 50, industryRespect: 50, reliability: 50, currentHeat: 50 },
    availability: { commitments: overrides.bookedUntil ? [{ projectId: 'p', role: 'Director', startDay: 1, endDay: overrides.bookedUntil }] : [] },
    traits: [],
    primaryRole: 'Director',
    careers: {
      director: {
        role: 'Director', active: true, experience: 50, roleReputation: 50, minimumSalary: 200_000, typicalSalary: 2_000_000,
        skill: 50,
        toneProfile: overrides.toneProfile ?? { ...FLAT_TONE },
        productionStyle: { environmentStrategy: { studio: 0.34, location: 0.33, digital: 0.33 }, effectsStrategy: { practical: 0.5, digital: 0.5 } },
      },
    },
  };
}

function draftWith(script: Script, process?: DirectorPitchProcess): FilmDraft {
  // Minimal draft shell - only the fields the pitch tick reads.
  return { script, directorPitches: process, talent: [] } as unknown as FilmDraft;
}

describe('pitchInclination', () => {
  it('falls with fame: a working director is far keener to pitch than a marquee name', () => {
    expect(pitchInclination(20)).toBeGreaterThan(pitchInclination(80));
  });
  it('bottoms out (never zero) for the biggest names', () => {
    expect(pitchInclination(100)).toBeGreaterThan(0);
    expect(pitchInclination(100)).toBeLessThan(0.2);
  });
});

describe('willingPitchers', () => {
  it('includes eager working directors and excludes booked ones', () => {
    const script = scriptOfGenre('Drama', 60);
    const pool = [
      director('free-working', { fame: 25 }),
      director('booked-working', { fame: 25, bookedUntil: 10_000 }),
    ];
    const names = willingPitchers(script, studio(), pool, 1_000_000, 1).map((d) => d.id);
    expect(names).toContain('free-working');
    expect(names).not.toContain('booked-working');
  });

  it('caps the field at a handful, not the whole pool', () => {
    const script = scriptOfGenre('Drama', 61);
    const pool = Array.from({ length: 30 }, (_, i) => director(`d${i}`, { fame: 20 }));
    expect(willingPitchers(script, studio(), pool, 1_000_000, 1).length).toBeLessThanOrEqual(6);
  });

  it('excludes a director gated out of the offer path (a distasteful tonal misfit)', () => {
    const script = scriptOfGenre('Comedy', 62);
    // A proud director whose taste maximally opposes the comedy: the taste veto
    // that blocks the offer also blocks pitching.
    const opp = (v: number) => (v > 50 ? 0 : 100);
    const opposed: ToneProfile = { action: opp(script.toneProfile.action), comedy: opp(script.toneProfile.comedy), romance: opp(script.toneProfile.romance), suspense: opp(script.toneProfile.suspense), drama: opp(script.toneProfile.drama), spectacle: opp(script.toneProfile.spectacle) };
    const pool = [director('distaste', { fame: 20, ego: 95, toneProfile: opposed })];
    expect(willingPitchers(script, studio(), pool, 1_000_000, 1).map((d) => d.id)).not.toContain('distaste');
  });
});

describe('openDirectorPitches', () => {
  it('schedules each pitcher a staggered future due-day and starts with no submissions', () => {
    const script = scriptOfGenre('Drama', 63);
    const pool = [director('a', { fame: 20 }), director('b', { fame: 30 })];
    const process = openDirectorPitches(script, studio(), pool, 1_000_000, 100);
    expect(process.submitted).toEqual([]);
    expect(process.pending.length).toBeGreaterThan(0);
    for (const p of process.pending) expect(p.dueDay).toBeGreaterThan(100);
  });

  it('is deterministic - the same round opens the same field', () => {
    const script = scriptOfGenre('Drama', 64);
    const pool = [director('a', { fame: 20 }), director('b', { fame: 30 })];
    expect(openDirectorPitches(script, studio(), pool, 1_000_000, 1)).toEqual(openDirectorPitches(script, studio(), pool, 1_000_000, 1));
  });
});

describe('tickDirectorPitches', () => {
  it('is a no-op before any pitch is due, and lands them once their day arrives', () => {
    const script = scriptOfGenre('Drama', 65);
    const pool = [director('a', { fame: 20 }), director('b', { fame: 30 })];
    const process = openDirectorPitches(script, studio(), pool, 1_000_000, 100);
    const firstDue = Math.min(...process.pending.map((p) => p.dueDay));

    const draft = draftWith(script, process);
    expect(tickDirectorPitches(draft, firstDue - 1, pool)).toBe(draft); // identity short-circuit

    const after = tickDirectorPitches(draft, firstDue, pool);
    expect(after.directorPitches!.submitted.length).toBeGreaterThan(0);
    expect(after.directorPitches!.pending.length).toBeLessThan(process.pending.length);
  });

  it('lands every pitch once the calendar passes the last due-day', () => {
    const script = scriptOfGenre('Drama', 66);
    const pool = [director('a', { fame: 20 }), director('b', { fame: 30 }), director('c', { fame: 25 })];
    const process = openDirectorPitches(script, studio(), pool, 1_000_000, 100);
    const lastDue = Math.max(...process.pending.map((p) => p.dueDay));
    const after = tickDirectorPitches(draftWith(script, process), lastDue, pool);
    expect(after.directorPitches!.pending).toEqual([]);
    expect(after.directorPitches!.submitted.length).toBe(process.pending.length);
  });

  it('is a no-op with no open round', () => {
    const script = scriptOfGenre('Drama', 67);
    const draft = draftWith(script);
    expect(tickDirectorPitches(draft, 500, [])).toBe(draft);
  });
});
