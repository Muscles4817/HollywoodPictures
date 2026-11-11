import { describe, it, expect } from 'vitest';
import type { ActingStyle, Genre, LeadOuting, Person } from '../types';
import {
  computeStarDraw,
  computeStarDrawProfile,
  deriveSeededLeadRecord,
  fameReadiness,
  heatFactor,
  leadRecordOf,
  personaFit,
  proofInGenre,
} from './starPower';
import { DRAW_FAME_FLOOR, LEAD_RECORD_LENGTH, PERSONA_PROOF_WEIGHT, SEEDED_RECORD } from '../data/starPower';

const ACTION_STYLE: ActingStyle = { characterTransformation: 40, emotionalPerformance: 40, charisma: 80, comedy: 20, physicalPerformance: 90 };

/** Minimal Person carrying only what engine/starPower.ts reads. */
function actor(opts: {
  fame?: number;
  heat?: number;
  style?: ActingStyle;
  record?: LeadOuting[];
  name?: string;
  birthYear?: number;
  experience?: number;
} = {}): Person {
  const fame = opts.fame ?? 95;
  return {
    id: 'a1',
    identity: { name: opts.name ?? 'Nova Sterling', dateOfBirth: { year: opts.birthYear ?? -44, month: 1, day: 1 }, appearanceTags: [] },
    reputation: { fame, currentHeat: opts.heat ?? fame, prestige: fame, industryRespect: 50, reliability: 50 },
    careers: {
      actor: {
        role: 'Actor',
        active: true,
        experience: opts.experience ?? 60,
        roleReputation: 50,
        minimumSalary: 0,
        typicalSalary: 0,
        actingStyle: opts.style ?? ACTION_STYLE,
        ...(opts.record ? { leadRecord: opts.record } : {}),
      },
    },
  } as unknown as Person;
}

const outing = (genre: Genre, openingScore: number, presold = 0, day = 0): LeadOuting => ({ day, genre, openingScore, presold });

describe('fame readiness - the steep threshold', () => {
  it('is zero at and below the floor, one at 100, and rises monotonically', () => {
    expect(fameReadiness(DRAW_FAME_FLOOR)).toBe(0);
    expect(fameReadiness(40)).toBe(0);
    expect(fameReadiness(100)).toBe(1);
    let last = 0;
    for (let f = DRAW_FAME_FLOOR + 1; f <= 100; f++) {
      expect(fameReadiness(f)).toBeGreaterThan(last);
      last = fameReadiness(f);
    }
  });

  it('is convex: the 90s add far more than the 70s', () => {
    expect(fameReadiness(100) - fameReadiness(90)).toBeGreaterThan(3 * (fameReadiness(80) - fameReadiness(70)));
  });
});

describe('heat - momentum against standing, not a second fame reading', () => {
  it('is neutral when heat equals fame, whatever the fame', () => {
    expect(heatFactor(95, 95)).toBe(1);
    expect(heatFactor(30, 30)).toBe(1);
  });

  it('lifts a hot actor and cuts a cold one, symmetrically and boundedly', () => {
    expect(heatFactor(95, 75)).toBeGreaterThan(1);
    expect(heatFactor(55, 75)).toBeLessThan(1);
    expect(heatFactor(100, 0) - 1).toBeCloseTo(1 - heatFactor(0, 100));
  });
});

describe('persona fit - genre binding', () => {
  it('reads a physical, charismatic actor as an action lead, not a comedy one', () => {
    expect(personaFit(ACTION_STYLE, 'Action')).toBeGreaterThan(personaFit(ACTION_STYLE, 'Comedy'));
  });
});

describe('proof in a genre', () => {
  it('with no record, is persona fit at its reduced weight', () => {
    expect(proofInGenre(ACTION_STYLE, [], 'Action')).toBeCloseTo(PERSONA_PROOF_WEIGHT * personaFit(ACTION_STYLE, 'Action'));
  });

  it('two hits raise it above the persona prior; two flops pull it below', () => {
    const prior = proofInGenre(ACTION_STYLE, [], 'Action');
    expect(proofInGenre(ACTION_STYLE, [outing('Action', 0.8), outing('Action', 0.7)], 'Action')).toBeGreaterThan(prior);
    expect(proofInGenre(ACTION_STYLE, [outing('Action', -0.8), outing('Action', -0.7)], 'Action')).toBeLessThan(prior);
  });

  it('credits a franchise opening to its lead less than an original one', () => {
    const prior = proofInGenre(ACTION_STYLE, [], 'Action');
    const original = proofInGenre(ACTION_STYLE, [outing('Action', 0.9, 0)], 'Action');
    const sequel = proofInGenre(ACTION_STYLE, [outing('Action', 0.9, 1)], 'Action');
    expect(sequel).toBeGreaterThan(prior);
    expect(sequel).toBeLessThan(original);
  });

  it('weights the latest outing most: a recent flop outweighs an old hit', () => {
    const recentFlop = proofInGenre(ACTION_STYLE, [outing('Action', 0.8), outing('Action', -0.8)], 'Action');
    const recentHit = proofInGenre(ACTION_STYLE, [outing('Action', -0.8), outing('Action', 0.8)], 'Action');
    expect(recentHit).toBeGreaterThan(recentFlop);
  });

  it('carries a proven record into other genres only partly', () => {
    const record = [outing('Action', 0.9), outing('Action', 0.9), outing('Action', 0.9)];
    const action = proofInGenre(ACTION_STYLE, record, 'Action');
    const comedy = proofInGenre(ACTION_STYLE, record, 'Comedy');
    expect(comedy).toBeGreaterThan(proofInGenre(ACTION_STYLE, [], 'Comedy'));
    expect(comedy).toBeLessThan(action);
  });
});

describe('star draw', () => {
  const proven = [outing('Action', 0.8), outing('Action', 0.7), outing('Action', 0.9)];

  it('is zero without an actor career, and zero below the fame floor however good the record', () => {
    expect(computeStarDraw({ ...actor(), careers: {} } as unknown as Person, 'Action')).toBe(0);
    expect(computeStarDraw(actor({ fame: DRAW_FAME_FLOOR, record: proven }), 'Action')).toBe(0);
  });

  it('separates fame from draw: an equally famous actor with flops draws far less', () => {
    const hit = computeStarDraw(actor({ fame: 95, record: proven }), 'Action');
    const flops = computeStarDraw(actor({ fame: 95, record: [outing('Action', -0.7), outing('Action', -0.8)] }), 'Action');
    expect(hit).toBeGreaterThan(2 * flops);
  });

  it('is genre-bound: an action draw is strongest in action', () => {
    const profile = computeStarDrawProfile(actor({ fame: 95, record: proven }));
    expect(profile.bestGenre).toBe('Action');
    expect(profile.byGenre.Action).toBeGreaterThan(profile.byGenre.Comedy);
  });

  it('stays within 0..1 at the extremes', () => {
    const d = computeStarDraw(actor({ fame: 100, heat: 100, record: [outing('Action', 1), outing('Action', 1), outing('Action', 1)] }), 'Action');
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThanOrEqual(1);
  });
});

describe('the lead record', () => {
  it('uses a stored record when one exists, and the seeded one otherwise', () => {
    const stored = [outing('Drama', 0.2, 0, 400)];
    expect(leadRecordOf(actor({ record: stored }))).toBe(stored);
    const seeded = leadRecordOf(actor());
    expect(seeded.length).toBeGreaterThan(0);
  });

  it('seeds the same record for the same person every time', () => {
    const a = actor({ fame: 92 });
    const career = a.careers.actor!;
    expect(deriveSeededLeadRecord(a, career)).toEqual(deriveSeededLeadRecord(actor({ fame: 92 }), career));
  });

  it('seeds no outings below the lead fame floor, and never more than a full record', () => {
    const minor = actor({ fame: SEEDED_RECORD.leadFameFloor });
    expect(deriveSeededLeadRecord(minor, minor.careers.actor!)).toEqual([]);
    const veteran = actor({ fame: 100, birthYear: -60 });
    expect(deriveSeededLeadRecord(veteran, veteran.careers.actor!).length).toBe(LEAD_RECORD_LENGTH);
  });

  it('gives a young star a shorter record than a veteran of the same fame', () => {
    const young = actor({ fame: 95, birthYear: -24 });
    const veteran = actor({ fame: 95, birthYear: -50 });
    expect(deriveSeededLeadRecord(young, young.careers.actor!).length).toBeLessThan(
      deriveSeededLeadRecord(veteran, veteran.careers.actor!).length,
    );
  });

  it('keeps seeded outings in the actor\'s best two persona genres, with scores and presold in range', () => {
    const a = actor({ fame: 98, birthYear: -50 });
    const record = deriveSeededLeadRecord(a, a.careers.actor!);
    const top2 = (['Action', 'Comedy', 'Drama', 'Horror', 'Romance', 'Sci-Fi', 'Fantasy', 'Thriller'] as Genre[])
      .sort((x, y) => personaFit(ACTION_STYLE, y) - personaFit(ACTION_STYLE, x))
      .slice(0, 2);
    for (const o of record) {
      expect(top2).toContain(o.genre);
      expect(o.openingScore).toBeGreaterThanOrEqual(-1);
      expect(o.openingScore).toBeLessThanOrEqual(1);
      expect(o.presold).toBeGreaterThanOrEqual(0);
      expect(o.presold).toBeLessThanOrEqual(SEEDED_RECORD.maxPresold);
    }
  });
});
