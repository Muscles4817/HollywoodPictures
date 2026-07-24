// Talent Relationship History (docs/DESIGN_REVIEW_domain_model.md) - the
// persistent studio<->person working history and the relationship standing read
// over it. Covers recording (idempotent, key-people-only, outcome signals) and
// the read (tiers, familiarity amplification, the appeal-term mappings).
import { describe, it, expect } from 'vitest';
import {
  PLAYER_STUDIO_ID,
  NO_RELATIONSHIP,
  computeRelationship,
  recordFilmCollaborations,
  recordPlayerFilmCollaborations,
  relationshipAppealDelta,
  relationshipThresholdDelta,
  relationshipSalaryMultiplier,
  relationshipRefuses,
} from './relationships';
import type { Collaboration, Film, Person, ProductionRole, TalentAssignment } from '../types';

function personFixture(id: string): Person {
  return {
    id,
    identity: { name: id, appearanceTags: [] },
    personality: { professionalism: 50, ambition: 50, loyalty: 50, ego: 50, temperament: 50, pressureHandling: 50, controversy: 50, adaptability: 50 },
    reputation: { fame: 50, prestige: 50, industryRespect: 50, reliability: 50, currentHeat: 50 },
    availability: { commitments: [] },
    traits: [],
    primaryRole: 'Actor',
    careers: {},
  };
}

function assignment(id: string, role: ProductionRole): TalentAssignment {
  return { role, person: personFixture(id) };
}

// A minimal released Film carrying only what recordFilmCollaborations reads -
// id, talent, and the release-day results signals. The rest of the Film shape
// is irrelevant to collaboration recording, so it's filled with a neutral stub.
function filmFixture(opts: {
  id: string;
  talent: TalentAssignment[];
  criticScore: number;
  audienceScore: number;
  stars?: number;
}): Film {
  return {
    id: opts.id,
    talent: opts.talent,
    results: {
      criticScore: opts.criticScore,
      audienceScore: opts.audienceScore,
      ...(opts.stars !== undefined
        ? { productionExecution: { stars: opts.stars, rating: 'solid', headline: '', detail: '', causes: [], mitigation: [], modifiers: { performanceCapture: 0, postExecution: 0, scriptExecution: 0, coverageRatio: 1, overall: 0 } } }
        : {}),
    },
  } as unknown as Film;
}

function collaboration(overrides: Partial<Collaboration> = {}): Collaboration {
  return {
    studioId: PLAYER_STUDIO_ID,
    personId: 'p1',
    filmId: 'f1',
    role: 'Lead Actor',
    day: 100,
    reception: 50,
    shootSmoothness: 3,
    ...overrides,
  };
}

describe('recordFilmCollaborations', () => {
  it('records one entry per key person (director + lead/supporting actors), skipping crew', () => {
    const film = filmFixture({
      id: 'f1',
      talent: [
        assignment('dir', 'Director'),
        assignment('lead', 'Lead Actor'),
        assignment('supp', 'Supporting Actor'),
        assignment('dop', 'Cinematographer'),
        assignment('writer', 'Writer'),
      ],
      criticScore: 80,
      audienceScore: 70,
      stars: 4,
    });
    const result = recordFilmCollaborations([], film, PLAYER_STUDIO_ID, 200);
    const ids = result.map((c) => c.personId).sort();
    expect(ids).toEqual(['dir', 'lead', 'supp']);
    // Outcome signals read once from the film's results.
    expect(result.every((c) => c.reception === 75)).toBe(true); // (80 + 70) / 2
    expect(result.every((c) => c.shootSmoothness === 4)).toBe(true);
    expect(result.every((c) => c.day === 200 && c.filmId === 'f1' && c.studioId === PLAYER_STUDIO_ID)).toBe(true);
  });

  it('is idempotent - re-recording the same film adds nothing', () => {
    const film = filmFixture({ id: 'f1', talent: [assignment('lead', 'Lead Actor')], criticScore: 60, audienceScore: 60, stars: 3 });
    const once = recordFilmCollaborations([], film, PLAYER_STUDIO_ID, 10);
    const twice = recordFilmCollaborations(once, film, PLAYER_STUDIO_ID, 10);
    expect(twice).toBe(once); // same array reference - no additions
    expect(twice).toHaveLength(1);
  });

  it('defaults shoot smoothness to a neutral 3 when the film carries no production-execution outcome', () => {
    const film = filmFixture({ id: 'f1', talent: [assignment('lead', 'Lead Actor')], criticScore: 90, audienceScore: 90 });
    const result = recordFilmCollaborations([], film, PLAYER_STUDIO_ID, 1);
    expect(result[0].shootSmoothness).toBe(3);
  });

  it('recordPlayerFilmCollaborations folds every settled player film in under the player sentinel', () => {
    const films = [
      filmFixture({ id: 'f1', talent: [assignment('a', 'Lead Actor')], criticScore: 50, audienceScore: 50, stars: 3 }),
      filmFixture({ id: 'f2', talent: [assignment('b', 'Director')], criticScore: 50, audienceScore: 50, stars: 3 }),
    ];
    const result = recordPlayerFilmCollaborations([], films, 5);
    expect(result).toHaveLength(2);
    expect(result.every((c) => c.studioId === PLAYER_STUDIO_ID)).toBe(true);
  });
});

describe('computeRelationship', () => {
  it('returns the neutral standing for strangers', () => {
    expect(computeRelationship([], PLAYER_STUDIO_ID, 'p1')).toEqual(NO_RELATIONSHIP);
  });

  it('a single well-received, smoothly-shot film reads as a positive (loyal/warm) standing', () => {
    const standing = computeRelationship([collaboration({ reception: 95, shootSmoothness: 5 })], PLAYER_STUDIO_ID, 'p1');
    expect(standing.collaborations).toBe(1);
    expect(standing.warmth).toBeGreaterThan(0);
    expect(['warm', 'loyal']).toContain(standing.tier);
  });

  it('a flop that blew up on set reads as a grudge, with negative warmth', () => {
    const standing = computeRelationship([collaboration({ reception: 5, shootSmoothness: 1 })], PLAYER_STUDIO_ID, 'p1');
    expect(standing.warmth).toBeLessThan(0);
    expect(['strained', 'grudge']).toContain(standing.tier);
  });

  it('repeat collaboration amplifies a positive history (deeper loyalty) and tracks the latest day', () => {
    const one = computeRelationship([collaboration({ filmId: 'f1', reception: 80, shootSmoothness: 4, day: 100 })], PLAYER_STUDIO_ID, 'p1');
    const three = computeRelationship(
      [
        collaboration({ filmId: 'f1', reception: 80, shootSmoothness: 4, day: 100 }),
        collaboration({ filmId: 'f2', reception: 80, shootSmoothness: 4, day: 300 }),
        collaboration({ filmId: 'f3', reception: 80, shootSmoothness: 4, day: 500 }),
      ],
      PLAYER_STUDIO_ID,
      'p1',
    );
    expect(three.collaborations).toBe(3);
    expect(three.warmth).toBeGreaterThan(one.warmth); // familiarity deepens the same average sentiment
    expect(three.lastWorkedDay).toBe(500);
  });

  it('only counts the queried studio<->person pair', () => {
    const list = [
      collaboration({ studioId: PLAYER_STUDIO_ID, personId: 'p1', filmId: 'f1' }),
      collaboration({ studioId: 'rival-x', personId: 'p1', filmId: 'f2' }),
      collaboration({ studioId: PLAYER_STUDIO_ID, personId: 'p2', filmId: 'f3' }),
    ];
    expect(computeRelationship(list, PLAYER_STUDIO_ID, 'p1').collaborations).toBe(1);
  });
});

describe('appeal-term mappings', () => {
  it('are all neutral for a stranger', () => {
    expect(relationshipAppealDelta(NO_RELATIONSHIP)).toBe(0);
    expect(relationshipThresholdDelta(NO_RELATIONSHIP)).toBe(0);
    expect(relationshipSalaryMultiplier(NO_RELATIONSHIP)).toBe(1);
    expect(relationshipRefuses(NO_RELATIONSHIP)).toBe(false);
  });

  it('loyalty lifts appeal, lowers the threshold, and discounts the salary floor', () => {
    const loyal = computeRelationship([collaboration({ reception: 100, shootSmoothness: 5 })], PLAYER_STUDIO_ID, 'p1');
    expect(relationshipAppealDelta(loyal)).toBeGreaterThan(0);
    expect(relationshipThresholdDelta(loyal)).toBeGreaterThan(0); // subtracted from the threshold -> a lower bar
    expect(relationshipSalaryMultiplier(loyal)).toBeLessThan(1);
  });

  it('a grudge saps appeal, raises the threshold, and inflates the salary floor', () => {
    const grudge = computeRelationship([collaboration({ reception: 0, shootSmoothness: 1 })], PLAYER_STUDIO_ID, 'p1');
    expect(relationshipAppealDelta(grudge)).toBeLessThan(0);
    expect(relationshipThresholdDelta(grudge)).toBeLessThan(0); // subtracted -> a higher bar
    expect(relationshipSalaryMultiplier(grudge)).toBeGreaterThan(1);
  });

  it('the deepest grudge is a hard refusal', () => {
    // Several consecutive disasters drive warmth past the hard-refusal cutoff.
    const disasters = [1, 2, 3].map((i) => collaboration({ filmId: `f${i}`, reception: 0, shootSmoothness: 1 }));
    const standing = computeRelationship(disasters, PLAYER_STUDIO_ID, 'p1');
    expect(relationshipRefuses(standing)).toBe(true);
  });
});
