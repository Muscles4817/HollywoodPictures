import { describe, it, expect } from 'vitest';
import { CAREER_SHAPES, MAX_STARTING_AGE, deriveCareerHistory, experienceFromYears } from './careerHistory';
import { generateTalentPool } from './talentGenerator';
import { createRng } from './random';
import { GENERATED_TALENT_DB } from '../data/talentDatabases';
import type { Person, TalentProfession } from '../types';

describe('deriveCareerHistory', () => {
  it('age is the age they started plus the years they have worked', () => {
    for (const role of Object.keys(CAREER_SHAPES) as Array<keyof typeof CAREER_SHAPES>) {
      for (const [t, a, b] of [[0, 0, 0], [0.5, 0.5, 0.5], [1, 1, 1], [1, 0, 0], [0, 1, 1]] as const) {
        const h = deriveCareerHistory(role, t, a, b, 0.5);
        const [youngest, oldest] = CAREER_SHAPES[role].startAge;
        expect(h.age - h.yearsActive).toBeGreaterThanOrEqual(youngest);
        expect(h.age - h.yearsActive).toBeLessThanOrEqual(oldest);
        expect(h.age).toBeLessThanOrEqual(MAX_STARTING_AGE);
      }
    }
  });

  it('a higher fee position means a longer career, more so for a head of department than for an actor', () => {
    const gain = (role: 'Actor' | 'Cinematographer') =>
      deriveCareerHistory(role, 1, 0.5, 0.5, 0.5).yearsActive - deriveCareerHistory(role, 0, 0.5, 0.5, 0.5).yearsActive;
    expect(gain('Actor')).toBeGreaterThan(0);
    expect(gain('Cinematographer')).toBeGreaterThan(gain('Actor'));
  });

  it('leaves room for a cheap veteran and for a young star', () => {
    expect(deriveCareerHistory('Director', 0, 0.5, 1, 0.5).yearsActive).toBeGreaterThan(15); // never got expensive
    expect(deriveCareerHistory('Actor', 1, 0, 0, 0.5).age).toBeLessThan(32); // famous young
  });

  it('nobody starts a career with credits, and credits follow the years worked', () => {
    expect(deriveCareerHistory('Director', 0, 0.5, 0, 0.5).priorCredits).toBe(0);
    const short = deriveCareerHistory('Actor', 0.5, 0.5, 0.2, 0.5);
    const long = deriveCareerHistory('Actor', 0.5, 0.5, 0.9, 0.5);
    expect(long.priorCredits).toBeGreaterThan(short.priorCredits);
  });

  it('experience is years in the role, saturating', () => {
    expect(experienceFromYears(0)).toBe(0);
    expect(experienceFromYears(10)).toBeLessThan(experienceFromYears(20));
    expect(experienceFromYears(60)).toBe(100);
  });
});

describe('a generated talent pool has coherent careers', () => {
  const pool = generateTalentPool(createRng(4242), GENERATED_TALENT_DB);
  const careerOf = (p: Person) => Object.values(p.careers)[0] as { typicalSalary: number; experience: number; priorCredits?: number; careerStartDay?: number; skill?: number };
  const ageOf = (p: Person) => 1 - p.identity.dateOfBirth!.year;
  const correlation = (xs: number[], ys: number[]) => {
    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let sxy = 0, sx = 0, sy = 0;
    for (let i = 0; i < n; i++) {
      sxy += (xs[i] - mx) * (ys[i] - my);
      sx += (xs[i] - mx) ** 2;
      sy += (ys[i] - my) ** 2;
    }
    return sxy / Math.sqrt(sx * sy);
  };
  const feeAndAge = (role: TalentProfession) =>
    correlation(pool[role].map((p) => Math.log(careerOf(p).typicalSalary)), pool[role].map(ageOf));

  it('every career records its start, its prior credits and an experience that matches its length', () => {
    for (const people of Object.values(pool)) {
      for (const person of people) {
        const career = careerOf(person);
        expect(career.careerStartDay).toBeLessThanOrEqual(1);
        expect(career.priorCredits).toBeGreaterThanOrEqual(0);
        const years = (1 - career.careerStartDay!) / 365;
        expect(career.experience).toBe(experienceFromYears(years));
        expect(ageOf(person) - years).toBeGreaterThanOrEqual(18); // nobody started as a child
      }
    }
  });

  it('fee and age are related, loosely for actors and more closely for directors and crew', () => {
    expect(feeAndAge('Actor')).toBeGreaterThan(0.1);
    expect(feeAndAge('Actor')).toBeLessThan(0.45);
    expect(feeAndAge('Director')).toBeGreaterThan(0.4);
    expect(feeAndAge('Cinematographer')).toBeGreaterThan(0.4);
    // Nowhere so close that a fee tells you an age.
    for (const role of ['Director', 'Cinematographer', 'Editor'] as const) expect(feeAndAge(role)).toBeLessThan(0.8);
  });

  it('the most expensive directors are not in their twenties, and plenty of cheap ones are veterans', () => {
    const directors = [...pool.Director].sort((a, b) => careerOf(b).typicalSalary - careerOf(a).typicalSalary);
    const dearest = directors.slice(0, 40);
    const cheapest = directors.slice(-120);
    expect(Math.min(...dearest.map(ageOf))).toBeGreaterThanOrEqual(38);
    expect(cheapest.filter((p) => careerOf(p).experience >= 66).length).toBeGreaterThan(12);
  });

  it('experience is no longer a copy of skill', () => {
    const same = pool.Director.filter((p) => careerOf(p).experience === careerOf(p).skill).length;
    expect(same).toBeLessThan(pool.Director.length / 10);
  });

  it('heat and industry respect are their own values, with the pool average of heat still tracking fame', () => {
    const everyone = Object.values(pool).flat();
    expect(everyone.some((p) => p.reputation.currentHeat !== p.reputation.fame)).toBe(true);
    expect(everyone.some((p) => p.reputation.industryRespect !== p.reputation.reliability)).toBe(true);
    const mean = (f: (p: Person) => number) => everyone.reduce((sum, p) => sum + f(p), 0) / everyone.length;
    expect(Math.abs(mean((p) => p.reputation.currentHeat) - mean((p) => p.reputation.fame))).toBeLessThan(2);
  });

  it('the acting pool is young, with a tail of veterans', () => {
    const ages = pool.Actor.map(ageOf).sort((a, b) => a - b);
    expect(ages[Math.floor(ages.length / 2)]).toBeLessThan(45);
    expect(ages.filter((age) => age < 30).length).toBeGreaterThan(pool.Actor.length / 12);
    expect(ages.filter((age) => age > 60).length).toBeGreaterThan(10);
  });
});
