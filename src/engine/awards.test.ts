import { describe, it, expect } from 'vitest';
import type { AwardsCeremony, CrewRole, Film, FilmResults, Gender, Person, ProductionRole } from '../types';
import { createRng } from './random';
import {
  campaignBoost,
  computeBoxOfficeBump,
  computeCeremony,
  computeStudioAwardDeltas,
  filmsForAwardsYear,
  nominatedFilmIds,
  type CeremonyInput,
} from './awards';
import { AWARD_CATEGORY_WEIGHT, CAMPAIGN_MAX, WIN_PRESTIGE } from '../data/awards';

let pid = 0;
function person(opts: { gender?: Gender; crewRole?: CrewRole; skill?: number } = {}): Person {
  const careers: Record<string, unknown> = {};
  if (opts.crewRole) {
    const key = { Writer: 'writer', Cinematographer: 'cinematographer', Composer: 'composer', Editor: 'editor', 'VFX Supervisor': 'vfxSupervisor', 'Casting Director': 'castingDirector' }[opts.crewRole];
    careers[key] = { role: opts.crewRole, skill: opts.skill ?? 50 };
  }
  return {
    id: `p${pid++}`,
    identity: { name: 'X', gender: opts.gender, appearanceTags: [] },
    personality: { professionalism: 50, ambition: 50, loyalty: 50, ego: 30, temperament: 50, pressureHandling: 50, controversy: 20, adaptability: 50 },
    reputation: { fame: 40, prestige: 40, industryRespect: 50, reliability: 60, currentHeat: 40 },
    primaryRole: opts.crewRole ?? 'Director',
    careers,
    availability: { commitments: [] },
    traits: [],
  } as unknown as Person;
}

function results(overrides: Partial<FilmResults> = {}): FilmResults {
  return {
    qualityScore: 60, criticScore: 60, scriptScore: 60, directionScore: 60,
    actingScore: 60, productionScore: 60, postProductionScore: 60, studioRevenue: 5_000_000,
    ...overrides,
  } as FilmResults;
}

let fid = 0;
function film(opts: {
  releasedOnDay?: number;
  results?: Partial<FilmResults>;
  talent?: Array<{ role: ProductionRole; person: Person }>;
  originality?: number;
}): Film {
  return {
    id: `f${fid++}`,
    releasedOnDay: opts.releasedOnDay ?? 100,
    script: { originality: opts.originality ?? 60 },
    talent: opts.talent ?? [],
    results: results(opts.results),
  } as unknown as Film;
}

function input(films: Film[], overrides: Partial<CeremonyInput> = {}): CeremonyInput {
  return {
    year: 1,
    ceremonyDay: 410,
    eligibleFilms: films,
    campaignByFilm: {},
    studioPrestigeForFilm: () => 20,
    rng: createRng(1),
    ...overrides,
  };
}

describe('filmsForAwardsYear', () => {
  it('buckets by releasedOnDay: last day of a year is in, first day of the next is out', () => {
    const y1 = film({ releasedOnDay: 365 });
    const y2 = film({ releasedOnDay: 366 });
    expect(filmsForAwardsYear([y1, y2], 1).map((f) => f.id)).toEqual([y1.id]);
    expect(filmsForAwardsYear([y1, y2], 2).map((f) => f.id)).toEqual([y2.id]);
  });
});

describe('campaignBoost', () => {
  it('is 0 at 0, monotonic increasing, and capped below CAMPAIGN_MAX', () => {
    expect(campaignBoost(0)).toBe(0);
    expect(campaignBoost(1_000_000)).toBeLessThan(campaignBoost(3_000_000));
    // A mid-size spend is still short of the cap; an extreme spend saturates it.
    expect(campaignBoost(3_000_000)).toBeLessThan(CAMPAIGN_MAX);
    expect(campaignBoost(1e12)).toBeLessThanOrEqual(CAMPAIGN_MAX);
    expect(campaignBoost(1e12)).toBeGreaterThan(CAMPAIGN_MAX - 0.01);
  });
});

describe('computeCeremony - Best Picture', () => {
  it('the clearly strongest film wins, jitter can’t flip a wide gap', () => {
    const strong = film({ results: { qualityScore: 95, criticScore: 95 } });
    const weak = film({ results: { qualityScore: 40, criticScore: 40 } });
    const ceremony = computeCeremony(input([weak, strong]));
    const picture = ceremony.categories['best-picture'];
    expect(picture[0].filmId).toBe(strong.id);
    expect(picture[0].won).toBe(true);
    expect(picture.filter((n) => n.won)).toHaveLength(1);
  });

  it('is deterministic for a given seed', () => {
    const films = [film({ results: { qualityScore: 80 } }), film({ results: { qualityScore: 70 } })];
    const a = computeCeremony(input(films, { rng: createRng(42) }));
    const b = computeCeremony(input(films, { rng: createRng(42) }));
    expect(a).toEqual(b);
  });
});

describe('computeCeremony - crafts separate on crew skill', () => {
  it('equal productionScore, better cinematographer wins Best Cinematography', () => {
    const ace = person({ crewRole: 'Cinematographer', skill: 95 });
    const dud = person({ crewRole: 'Cinematographer', skill: 20 });
    const filmA = film({ results: { productionScore: 70 }, talent: [{ role: 'Cinematographer', person: ace }] });
    const filmB = film({ results: { productionScore: 70 }, talent: [{ role: 'Cinematographer', person: dud }] });
    const ceremony = computeCeremony(input([filmB, filmA]));
    expect(ceremony.categories['best-cinematography'][0].filmId).toBe(filmA.id);
    expect(ceremony.categories['best-cinematography'][0].personId).toBe(ace.id);
  });

  it('a film with no VFX Supervisor is not in the VFX race', () => {
    const withVfx = film({ talent: [{ role: 'VFX Supervisor', person: person({ crewRole: 'VFX Supervisor', skill: 80 }) }] });
    const without = film({ talent: [] });
    const ceremony = computeCeremony(input([withVfx, without]));
    const vfx = ceremony.categories['best-visual-effects'];
    expect(vfx).toHaveLength(1);
    expect(vfx[0].filmId).toBe(withVfx.id);
  });
});

describe('computeCeremony - gender-split acting', () => {
  it('buckets male/female leads into Actor/Actress and places a non-binary lead in exactly one', () => {
    const male = person({ gender: 'Male' });
    const female = person({ gender: 'Female' });
    const nb = person({ gender: 'NonBinary' });
    const f = film({ talent: [
      { role: 'Lead Actor', person: male },
      { role: 'Lead Actor', person: female },
      { role: 'Lead Actor', person: nb },
    ] });
    const ceremony = computeCeremony(input([f]));

    const actorIds = ceremony.categories['best-actor'].map((n) => n.personId);
    const actressIds = ceremony.categories['best-actress'].map((n) => n.personId);
    expect(actorIds).toContain(male.id);
    expect(actressIds).toContain(female.id);
    // Non-binary appears exactly once across the two fields.
    const nbAppearances = [...actorIds, ...actressIds].filter((id) => id === nb.id).length;
    expect(nbAppearances).toBe(1);
  });
});

describe('payoff', () => {
  const ceremony: AwardsCeremony = {
    year: 1,
    ceremonyDay: 410,
    categories: {
      'best-picture': [{ filmId: 'f1', awardScore: 90, won: true }, { filmId: 'f2', awardScore: 80, won: false }],
      'best-director': [], 'best-screenplay': [], 'best-actor': [], 'best-actress': [],
      'best-supporting-actor': [], 'best-supporting-actress': [],
      'best-cinematography': [{ filmId: 'f2', awardScore: 70, won: false }],
      'best-film-editing': [], 'best-original-score': [], 'best-visual-effects': [],
    },
  };

  it('a Best Picture win earns more Prestige than a single craft nomination', () => {
    const bpWinner = computeStudioAwardDeltas(ceremony, new Set(['f1']));
    const craftNominee = computeStudioAwardDeltas(ceremony, new Set(['f2']));
    expect(bpWinner.prestige).toBeGreaterThan(craftNominee.prestige);
    expect(bpWinner.brand).toBeGreaterThan(0); // wins add Brand
    expect(craftNominee.brand).toBe(0); // a lone nomination does not
    expect(computeStudioAwardDeltas(ceremony, new Set()).prestige).toBe(0);
  });

  it('the Best Picture Prestige matches the category weight formula', () => {
    // f1 only appears as the BP winner here.
    const onlyBp: AwardsCeremony = { ...ceremony, categories: { ...ceremony.categories, 'best-picture': [{ filmId: 'f1', awardScore: 90, won: true }] } };
    expect(computeStudioAwardDeltas(onlyBp, new Set(['f1'])).prestige).toBeCloseTo(WIN_PRESTIGE * AWARD_CATEGORY_WEIGHT['best-picture'], 6);
  });

  it('box-office bump rewards a win over a nomination and respects the cap', () => {
    const winner = { id: 'f1', results: { studioRevenue: 10_000_000 } } as unknown as Film;
    const nominee = { id: 'f2', results: { studioRevenue: 10_000_000 } } as unknown as Film;
    const winnerBump = computeBoxOfficeBump(winner, ceremony);
    const nomineeBump = computeBoxOfficeBump(nominee, ceremony);
    expect(winnerBump).toBeGreaterThan(nomineeBump);
    expect(nomineeBump).toBeGreaterThan(0);
    expect(winnerBump).toBeLessThanOrEqual(10_000_000 * 0.4); // BUMP_CAP_FRACTION
  });

  it('nominatedFilmIds collects every nominated film', () => {
    expect(nominatedFilmIds(ceremony)).toEqual(new Set(['f1', 'f2']));
  });
});
