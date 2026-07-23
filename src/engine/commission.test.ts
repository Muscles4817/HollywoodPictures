import { describe, it, expect } from 'vitest';
import { createRng } from './random';
import { commissionDurationBounds, commissionDurationDays, commissionFee, commissionedEvent, generateCommissionedScript, makePendingCommission, settlePendingCommissions } from './commission';
import type { Genre, Person, Script } from '../types';

const FLAT_GENRE: Record<Genre, number> = { Action: 50, Comedy: 50, Drama: 50, Horror: 50, Romance: 50, 'Sci-Fi': 50, Fantasy: 50, Thriller: 50 };

function writerPerson(id: string, craft: { originality: number; structure: number; characters: number; dialogue: number }, skill = 80): Person {
  return {
    id,
    identity: { name: `Writer ${id}`, appearanceTags: [] },
    personality: { professionalism: 50, ambition: 50, loyalty: 50, ego: 50, temperament: 50, pressureHandling: 50, controversy: 20, adaptability: 50 },
    reputation: { fame: 40, prestige: 40, industryRespect: 50, reliability: 50, currentHeat: 40 },
    primaryRole: 'Writer',
    careers: {
      writer: {
        role: 'Writer', active: true, experience: skill, roleReputation: 40, minimumSalary: 100_000, typicalSalary: 200_000, skill,
        craft, toneProfile: { action: 50, comedy: 50, romance: 50, suspense: 50, drama: 50, spectacle: 50 },
        genreAffinity: { ...FLAT_GENRE }, commercialLean: 50, consistency: 70,
      },
    },
    availability: { commitments: [] },
    traits: [],
  };
}

const nonWriter: Person = { ...writerPerson('nw', { originality: 50, structure: 50, characters: 50, dialogue: 50 }), careers: {} };
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('commission fee & duration', () => {
  it('scales the fee with the writer salary', () => {
    expect(commissionFee(1_000_000)).toBeGreaterThan(commissionFee(200_000));
  });
  it('takes longer for a more complex script, and stays within the advertised bounds', () => {
    const bounds = commissionDurationBounds();
    const simple = generateCommissionedScript(writerPerson('a', { originality: 60, structure: 60, characters: 60, dialogue: 60 }), 'Drama', createRng(1))!;
    expect(commissionDurationDays({ ...simple, complexity: 100 })).toBeGreaterThan(commissionDurationDays({ ...simple, complexity: 0 }));
    expect(commissionDurationDays({ ...simple, complexity: 50 })).toBeGreaterThanOrEqual(bounds.min);
    expect(commissionDurationDays({ ...simple, complexity: 50 })).toBeLessThanOrEqual(bounds.max);
  });
});

describe('generateCommissionedScript', () => {
  it('writes in the briefed genre', () => {
    const script = generateCommissionedScript(writerPerson('a', { originality: 60, structure: 60, characters: 60, dialogue: 60 }), 'Horror', createRng(2))!;
    expect(script.genre).toBe('Horror');
  });

  it("reflects the writer's craft - a strong-dialogue writer averages higher dialogue than a weak one", () => {
    const strong = writerPerson('s', { originality: 60, structure: 60, characters: 60, dialogue: 95 });
    const weak = writerPerson('w', { originality: 60, structure: 60, characters: 60, dialogue: 15 });
    const rngA = createRng(3);
    const rngB = createRng(3);
    const strongDialogue = Array.from({ length: 40 }, () => generateCommissionedScript(strong, 'Drama', rngA)!.dialogue);
    const weakDialogue = Array.from({ length: 40 }, () => generateCommissionedScript(weak, 'Drama', rngB)!.dialogue);
    expect(avg(strongDialogue)).toBeGreaterThan(avg(weakDialogue) + 10);
  });

  it('returns null for a person with no writer career', () => {
    expect(generateCommissionedScript(nonWriter, 'Drama', createRng(4))).toBeNull();
  });
});

describe('settlePendingCommissions', () => {
  function pendingFor(readyOnDay: number) {
    const writer = writerPerson('rw', { originality: 70, structure: 70, characters: 70, dialogue: 70 });
    const script: Script = generateCommissionedScript(writer, 'Thriller', createRng(5))!;
    return { writer, script, commission: makePendingCommission(writer, 'Thriller', 1, readyOnDay, script, 250_000) };
  }

  it('keeps a commission that has not been delivered yet in flight', () => {
    const { commission } = pendingFor(30);
    const result = settlePendingCommissions([commission], 29);
    expect(result.delivered).toEqual([]);
    expect(result.pendingCommissions).toEqual([commission]);
  });

  it('delivers a completed commission as an owned Studio-Original Asset credited to the writer', () => {
    const { commission, script } = pendingFor(30);
    const result = settlePendingCommissions([commission], 30);
    expect(result.pendingCommissions).toEqual([]);
    expect(result.delivered).toHaveLength(1);
    const asset = result.delivered[0];
    expect(asset.script).toBe(script);
    expect(asset.source).toBe('Studio Original');
    expect(asset.acquisitionCost).toBe(250_000);
    expect(asset.writerIds).toEqual([commission.writerId]);
    expect(asset.developmentHistory?.[0].kind).toBe('commissioned');
  });
});

describe('commissionedEvent', () => {
  it('records the writer and the fee as a spend', () => {
    expect(commissionedEvent(12, 'Aaron Sorkin', 400_000)).toMatchObject({ day: 12, kind: 'commissioned', costDelta: -400_000 });
  });
});
