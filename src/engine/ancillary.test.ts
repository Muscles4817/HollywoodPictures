import { describe, it, expect } from 'vitest';
import type { AwardsCeremony, Film, ScriptCharacter } from '../types';
import {
  awardsLift,
  deriveAncillaryMultipliers,
  deriveAncillaryProfile,
  ancillaryOutlook,
  leadMerchandisePotential,
  summariseFilmAwards,
  ancillaryAttributesFromFilm,
  type AncillaryAttributes,
} from './ancillary';
import { STUDIO_BOX_OFFICE_SHARE } from './boxOfficeRun';
import { generateScriptOptions } from './scriptGenerator';
import { createRng } from './random';

// A deliberately mainstream baseline; individual tests override just the axis
// they exercise. Calibration of the exact dollar bands is Stage 6 of the design
// (docs/DESIGN_REVIEW_studio_financial_model.md §3.7); these tests assert the
// SHAPE and ORDERING the model must always produce, not tuned magnitudes.
function attrs(overrides: Partial<AncillaryAttributes> = {}): AncillaryAttributes {
  return {
    genre: 'Action',
    targetAudience: 'Mass Market',
    audienceScore: 65,
    criticScore: 60,
    accessibility: 65,
    franchiseRecognition: 0,
    leadMerchandisePotential: 40,
    originality: 50,
    studioPrestige: 40,
    releaseWindow: 'Summer',
    awards: { wins: 0, nominations: 0 },
    ...overrides,
  };
}

const SUPERHERO = attrs({
  genre: 'Fantasy',
  targetAudience: 'Teens',
  audienceScore: 78,
  criticScore: 62,
  accessibility: 72,
  franchiseRecognition: 80,
  leadMerchandisePotential: 75,
  releaseWindow: 'Summer',
});

const OSCAR_DRAMA = attrs({
  genre: 'Drama',
  targetAudience: 'Adults',
  audienceScore: 82,
  criticScore: 90,
  accessibility: 40,
  franchiseRecognition: 0,
  leadMerchandisePotential: 5,
  originality: 80,
  releaseWindow: 'Awards Season',
  awards: { wins: 2, nominations: 6 },
});

describe('awardsLift', () => {
  it('is zero with no awards and rises with wins and nominations', () => {
    expect(awardsLift({ wins: 0, nominations: 0 })).toBe(0);
    expect(awardsLift({ wins: 1, nominations: 0 })).toBeCloseTo(0.25);
    expect(awardsLift({ wins: 0, nominations: 3 })).toBeCloseTo(0.15);
  });
  it('clamps to 1 for a sweep', () => {
    expect(awardsLift({ wins: 8, nominations: 20 })).toBe(1);
  });
});

describe('leadMerchandisePotential', () => {
  const ch = (prominence: ScriptCharacter['prominence'], merch: number): ScriptCharacter =>
    ({ prominence, traits: { merchandisePotential: merch } } as unknown as ScriptCharacter);

  it('averages over Lead characters only when leads exist', () => {
    expect(leadMerchandisePotential([ch('Lead', 80), ch('Lead', 60), ch('Supporting', 0)])).toBe(70);
  });
  it('falls back to the whole cast when there are no leads', () => {
    expect(leadMerchandisePotential([ch('Supporting', 40), ch('Minor', 20)])).toBe(30);
  });
  it('is 0 for an empty cast rather than a fabricated neutral', () => {
    expect(leadMerchandisePotential([])).toBe(0);
  });
});

describe('summariseFilmAwards', () => {
  const ceremony = (noms: { filmId: string; won: boolean }[]): AwardsCeremony =>
    ({
      categories: {
        'Best Picture': noms.map((n) => ({ filmId: n.filmId, awardScore: 50, won: n.won })),
      },
    } as unknown as AwardsCeremony);

  it('counts nominations and wins for the target film across ceremonies', () => {
    const history = [
      ceremony([{ filmId: 'f1', won: true }, { filmId: 'f2', won: false }]),
      ceremony([{ filmId: 'f1', won: false }]),
    ];
    expect(summariseFilmAwards(history, 'f1')).toEqual({ wins: 1, nominations: 2 });
    expect(summariseFilmAwards(history, 'f2')).toEqual({ wins: 0, nominations: 1 });
    expect(summariseFilmAwards(history, 'nope')).toEqual({ wins: 0, nominations: 0 });
  });
});

describe('deriveAncillaryMultipliers — genre differentiation', () => {
  it('gives a superhero franchise huge merch and a drama almost none', () => {
    const hero = deriveAncillaryMultipliers(SUPERHERO);
    const drama = deriveAncillaryMultipliers(OSCAR_DRAMA);
    expect(hero.merchandising).toBeGreaterThan(5);
    expect(drama.merchandising).toBeLessThan(0.3);
    expect(hero.merchandising).toBeGreaterThan(drama.merchandising * 20);
  });

  it('lifts merchandising with franchise recognition, all else equal', () => {
    const original = deriveAncillaryMultipliers(attrs({ genre: 'Sci-Fi', franchiseRecognition: 0 }));
    const franchise = deriveAncillaryMultipliers(attrs({ genre: 'Sci-Fi', franchiseRecognition: 90 }));
    expect(franchise.merchandising).toBeGreaterThan(original.merchandising);
  });

  it('lifts home entertainment for a family audience', () => {
    const adult = deriveAncillaryMultipliers(attrs({ targetAudience: 'Adults' }));
    const family = deriveAncillaryMultipliers(attrs({ targetAudience: 'Families' }));
    expect(family.homeEntertainment).toBeGreaterThan(adult.homeEntertainment);
  });

  it('lifts licensing with critical acclaim and awards', () => {
    const plain = deriveAncillaryMultipliers(attrs({ criticScore: 50, awards: { wins: 0, nominations: 0 } }));
    const acclaimed = deriveAncillaryMultipliers(attrs({ criticScore: 95, awards: { wins: 2, nominations: 5 } }));
    expect(acclaimed.licensing).toBeGreaterThan(plain.licensing);
  });
});

describe('deriveAncillaryMultipliers — catalogue longevity', () => {
  it('is high for an award-winning, beloved film and low for a forgettable one', () => {
    const classic = deriveAncillaryMultipliers(OSCAR_DRAMA).longevity;
    const forgettable = deriveAncillaryMultipliers(attrs({ audienceScore: 45, awards: { wins: 0, nominations: 0 } })).longevity;
    expect(classic).toBeGreaterThan(0.5);
    expect(forgettable).toBeLessThan(0.25);
  });
});

describe('deriveAncillaryProfile — dollars', () => {
  it('produces zero dollars pre-release (gross 0) while multipliers stay meaningful', () => {
    const p = deriveAncillaryProfile(SUPERHERO, 0);
    expect(p.homeEntertainment).toBe(0);
    expect(p.licensing).toBe(0);
    expect(p.merchandising).toBe(0);
    expect(p.catalogue.total).toBe(0);
    expect(p.lifetimeTotal).toBe(0);
    expect(p.multipliers.merchandising).toBeGreaterThan(5); // attribute read still works
  });

  it('scales every window with worldwide gross', () => {
    const small = deriveAncillaryProfile(SUPERHERO, 100_000_000);
    const big = deriveAncillaryProfile(SUPERHERO, 800_000_000);
    expect(big.merchandising).toBeGreaterThan(small.merchandising);
    expect(big.lifetimeTotal).toBeGreaterThan(small.lifetimeTotal);
  });

  it('grants no catalogue tail below the longevity floor and a durable one above it', () => {
    const forgettable = deriveAncillaryProfile(attrs({ audienceScore: 45 }), 300_000_000);
    expect(forgettable.catalogue).toEqual({ annualFirstYear: 0, years: 0, total: 0 });

    const classic = deriveAncillaryProfile(OSCAR_DRAMA, 60_000_000);
    expect(classic.catalogue.years).toBeGreaterThan(8);
    expect(classic.catalogue.total).toBeGreaterThan(0);
    // The tail decays: first year exceeds the per-year average.
    expect(classic.catalogue.annualFirstYear).toBeGreaterThan(classic.catalogue.total / classic.catalogue.years);
  });

  it('turns a theatrically-unprofitable blockbuster profitable over its lifetime', () => {
    // The exact brief: a $750M film that "lost money" theatrically.
    const gross = 750_000_000;
    const totalCost = 350_000_000;
    const theatricalRentals = gross * STUDIO_BOX_OFFICE_SHARE; // ~$315M
    const theatricalProfit = theatricalRentals - totalCost; // ~ -$35M
    expect(theatricalProfit).toBeLessThan(0);

    const ancillary = deriveAncillaryProfile(SUPERHERO, gross).lifetimeTotal;
    expect(theatricalProfit + ancillary).toBeGreaterThan(0);
  });

  it('contrasts the two archetypes: hero front-loads merch, drama leans on catalogue longevity', () => {
    const hero = deriveAncillaryProfile(SUPERHERO, 750_000_000);
    const drama = deriveAncillaryProfile(OSCAR_DRAMA, 60_000_000);
    // Hero: merch is a major slice of its afterlife; drama's merch is negligible.
    expect(hero.merchandising).toBeGreaterThan(hero.licensing);
    expect(drama.merchandising).toBeLessThan(drama.licensing * 0.1);
    // Drama: the longest catalogue tail.
    expect(drama.catalogue.years).toBeGreaterThan(hero.catalogue.years);
  });
});

describe('ancillaryOutlook — qualitative, pre-release', () => {
  it('names merchandising as a strength for a superhero film', () => {
    const o = ancillaryOutlook(deriveAncillaryMultipliers(SUPERHERO));
    expect(o.merchandising).toBe('exceptional');
    expect(o.headline.toLowerCase()).toContain('merchandising');
  });

  it('rates a drama negligible on merch but names its downstream strengths', () => {
    const o = ancillaryOutlook(deriveAncillaryMultipliers(OSCAR_DRAMA));
    expect(o.merchandising).toBe('negligible');
    expect(o.headline.toLowerCase()).not.toContain('merchandising');
    // Its money is downstream: a strong TV & streaming licensing window, named
    // in the headline, plus a durable (at least moderate) catalogue tail.
    expect(o.licensing).toBe('strong');
    expect(o.headline.toLowerCase()).toContain('tv & streaming');
    expect(['moderate', 'strong', 'exceptional']).toContain(o.catalogue);
  });

  it('tells a film with no downstream potential that it lives or dies in cinemas', () => {
    const o = ancillaryOutlook(deriveAncillaryMultipliers(attrs({ genre: 'Drama', audienceScore: 40, criticScore: 40, accessibility: 30 })));
    expect(o.headline.toLowerCase()).toContain('cinemas');
  });

  it('never leaks a raw number into the headline', () => {
    const o = ancillaryOutlook(deriveAncillaryMultipliers(SUPERHERO));
    expect(o.headline).not.toMatch(/\d/);
  });
});

describe('ancillaryAttributesFromFilm — extraction from a live Film', () => {
  it('reads genre, scores, franchise, merch and release window off the film', () => {
    const script = generateScriptOptions('Fantasy', createRng(7), 1)[0];
    const film = {
      genre: 'Fantasy',
      targetAudience: 'Families',
      script: { ...script, franchiseRecognition: 60 },
      results: { audienceScore: 80, criticScore: 70 },
      marketingChoices: { releaseWindow: 'Christmas' },
    } as unknown as Film;

    const a = ancillaryAttributesFromFilm(film, { studioPrestige: 55, awards: { wins: 1, nominations: 2 } });
    expect(a.genre).toBe('Fantasy');
    expect(a.targetAudience).toBe('Families');
    expect(a.audienceScore).toBe(80);
    expect(a.criticScore).toBe(70);
    expect(a.franchiseRecognition).toBe(60);
    expect(a.releaseWindow).toBe('Christmas');
    expect(a.studioPrestige).toBe(55);
    expect(a.awards).toEqual({ wins: 1, nominations: 2 });
    expect(a.accessibility).toBeGreaterThan(0); // derived via deriveCommercialProfile
    // The generated cast drives a real (non-negative) mean merch potential.
    expect(a.leadMerchandisePotential).toBeGreaterThanOrEqual(0);
  });
});
