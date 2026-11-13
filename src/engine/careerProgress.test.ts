import { describe, it, expect } from 'vitest';
import {
  applyAwardsToCareers,
  applyFilmResultsToCareers,
  commercialScore,
  crossedStandingFade,
  fadeStanding,
  impliedQuote,
  missCushion,
  nextQuote,
  standingDeltaFor,
  STANDING_FADE_INTERVAL_DAYS,
} from './careerProgress';
import { generateTalentPool } from './talentGenerator';
import { createRng } from './random';
import { GENERATED_TALENT_DB } from '../data/talentDatabases';
import type { AwardsCeremony, Film, Person, TalentProfession } from '../types';

const pool = generateTalentPool(createRng(77), GENERATED_TALENT_DB);
const feeOf = (p: Person) => (Object.values(p.careers)[0] as { typicalSalary: number }).typicalSalary;
const find = (profession: TalentProfession, test: (p: Person) => boolean) => pool[profession].find(test)!;
const inPool = (next: typeof pool, person: Person) => Object.values(next).flat().find((p) => p.id === person.id)!;

/** A finished film with the given people, cost, cinema profit, gross and reviews. */
function film(talent: Array<{ role: string; person: Person }>, results: { totalCost: number; profit: number; totalBoxOffice: number; criticScore?: number }): Film {
  return {
    id: 'f',
    talent,
    script: { cast: [], toneProfile: { action: 50, comedy: 50, romance: 50, suspense: 50, drama: 50, spectacle: 50 } },
    results: { criticScore: 55, ...results },
  } as unknown as Film;
}
const HIT = { totalCost: 40_000_000, profit: 60_000_000, totalBoxOffice: 220_000_000 };
const BOMB = { totalCost: 40_000_000, profit: -30_000_000, totalBoxOffice: 25_000_000 };
const DISAPPOINTMENT = { totalCost: 40_000_000, profit: -6_000_000, totalBoxOffice: 70_000_000 };

const newcomer = find('Actor', (p) => p.reputation.fame < 25 && p.reputation.currentHeat < 40);
// An established star: famous, in form, and decades into the job.
const star = find('Actor', (p) => p.reputation.fame > 85 && p.reputation.currentHeat > 75 && (Object.values(p.careers)[0] as { experience: number }).experience > 70);
const director = find('Director', (p) => p.reputation.fame > 40 && p.reputation.fame < 60);
const editor = pool.Editor[20];

describe('what a film does to the people in it', () => {
  it('a hit raises the heat and fame of its lead, and so their quote', () => {
    const after = applyFilmResultsToCareers(pool, [film([{ role: 'Lead Actor', person: newcomer }], HIT)], 400);
    const now = inPool(after, newcomer);
    expect(now.reputation.currentHeat).toBeGreaterThan(newcomer.reputation.currentHeat + 10);
    expect(now.reputation.fame).toBeGreaterThan(newcomer.reputation.fame);
    // A breakout sharply raises what an unknown can ask.
    expect(feeOf(now)).toBeGreaterThanOrEqual(feeOf(newcomer) * 1.7);
  });

  it('a bomb hurts more than a disappointment', () => {
    const heatAfter = (results: typeof HIT) => inPool(applyFilmResultsToCareers(pool, [film([{ role: 'Director', person: director }], results)], 400), director).reputation.currentHeat;
    expect(heatAfter(BOMB)).toBeLessThan(heatAfter(DISAPPOINTMENT));
    expect(heatAfter(DISAPPOINTMENT)).toBeLessThan(director.reputation.currentHeat);
    expect(commercialScore(film([], BOMB))).toBe(-1);
  });

  it('lands on whoever the film was sold on: the lead and director far more than a supporting player or the editor', () => {
    const delta = (role: 'Lead Actor' | 'Director' | 'Supporting Actor' | 'Editor', person: Person) => standingDeltaFor(person, role, 50, film([], BOMB), 0).heat;
    expect(delta('Lead Actor', newcomer)).toBeLessThan(delta('Supporting Actor', newcomer) * 2);
    expect(Math.abs(delta('Director', director))).toBeGreaterThan(Math.abs(delta('Editor', editor)) * 3);
  });

  it('an established star absorbs a bomb that would flatten a newcomer', () => {
    const starCareer = Object.values(star.careers)[0] as { experience: number };
    expect(missCushion(star, starCareer.experience)).toBeGreaterThan(missCushion(newcomer, 5) + 0.3);
    const lost = (person: Person, experience: number) => -standingDeltaFor(person, 'Lead Actor', experience, film([], BOMB), 0).heat;
    expect(lost(star, starCareer.experience)).toBeLessThan(lost(newcomer, 5) / 2);
  });

  it('but the cushion wears thin as the bombs keep coming', () => {
    let current = pool;
    const losses: number[] = [];
    for (let i = 0; i < 4; i++) {
      const before = inPool(current, star).reputation.currentHeat;
      current = applyFilmResultsToCareers(current, [film([{ role: 'Lead Actor', person: star }], BOMB)], 400 + i * 200);
      losses.push(before - inPool(current, star).reputation.currentHeat);
    }
    expect(losses[3]).toBeGreaterThan(losses[0]);
  });

  it('an actor singled out as the weak part is hurt a little even when the film did fine', () => {
    const fine = { totalCost: 40_000_000, profit: 4_000_000, totalBoxOffice: 100_000_000 };
    const praised = standingDeltaFor(newcomer, 'Lead Actor', 5, film([], fine), 1).heat;
    const panned = standingDeltaFor(newcomer, 'Lead Actor', 5, film([], fine), -1).heat;
    expect(panned).toBeLessThan(0);
    expect(praised).toBeGreaterThan(0);
    // Smaller than what the film itself does: a bomb costs more than bad notices.
    expect(Math.abs(panned)).toBeLessThan(Math.abs(standingDeltaFor(newcomer, 'Lead Actor', 5, film([], BOMB), 0).heat));
  });

  it('a bomb does not make anyone less famous, and a film nobody saw makes nobody famous', () => {
    expect(standingDeltaFor(star, 'Lead Actor', 80, film([], BOMB), 0).fame).toBeGreaterThanOrEqual(0);
    const unseen = { totalCost: 1_000_000, profit: 2_000_000, totalBoxOffice: 2_500_000 };
    expect(standingDeltaFor(newcomer, 'Lead Actor', 5, film([], unseen), 0).fame).toBeLessThan(0.5);
  });

  it('good reviews earn the respect of colleagues', () => {
    const rave = standingDeltaFor(director, 'Director', 50, film([], { ...DISAPPOINTMENT, criticScore: 92 }), 0).respect;
    const pan = standingDeltaFor(director, 'Director', 50, film([], { ...HIT, criticScore: 25 }), 0).respect;
    expect(rave).toBeGreaterThan(0);
    expect(pan).toBeLessThan(0);
  });

  it('gives a credit: the day they last worked, and experience that keeps up with the years', () => {
    const after = inPool(applyFilmResultsToCareers(pool, [film([{ role: 'Lead Actor', person: newcomer }], HIT)], 4000), newcomer);
    const career = Object.values(after.careers)[0] as { lastWorkedDay: number; experience: number };
    expect(career.lastWorkedDay).toBe(4000);
    expect(career.experience).toBeGreaterThan((Object.values(newcomer.careers)[0] as { experience: number }).experience);
  });

  it('leaves everyone else, and every untouched roster, the very same objects', () => {
    const after = applyFilmResultsToCareers(pool, [film([{ role: 'Lead Actor', person: newcomer }], HIT)], 400);
    expect(after.Director).toBe(pool.Director);
    expect(after.Actor).not.toBe(pool.Actor);
    expect(inPool(after, star)).toBe(star);
    expect(applyFilmResultsToCareers(pool, [], 400)).toBe(pool);
  });
});

describe('quotes follow standing: up at once, down slowly, and all the way', () => {
  it('rises immediately to what standing implies', () => {
    expect(nextQuote(1_000_000, 2_500_000, 0.3)).toBe(2_500_000);
  });

  it('falls by only part of the gap each time, but gets there', () => {
    let quote = 2_000_000;
    const first = nextQuote(quote, 1_000_000, 0.12);
    expect(first).toBeLessThan(quote);
    expect(first).toBeGreaterThan(1_700_000);
    for (let quarter = 0; quarter < 60; quarter++) quote = nextQuote(quote, 1_000_000, 0.12);
    expect(quote).toBeLessThan(1_010_000);
  });

  it('the same standing implies the same quote however it was reached', () => {
    const anchor = { salary: 1_000_000, value: 50 };
    expect(impliedQuote('Actor', anchor, 50)).toBeCloseTo(1_000_000, 0);
    expect(impliedQuote('Actor', anchor, 60)).toBeGreaterThan(1_000_000);
    expect(impliedQuote('Actor', anchor, 40) * impliedQuote('Actor', anchor, 60)).toBeCloseTo(1_000_000 ** 2, -6);
  });

  it('a hit followed by cooling off leaves the quote where it started, in time', () => {
    let current = applyFilmResultsToCareers(pool, [film([{ role: 'Lead Actor', person: newcomer }], HIT)], 400);
    const peak = feeOf(inPool(current, newcomer));
    for (let quarter = 0; quarter < 2; quarter++) current = fadeStanding(current);
    const soonAfter = feeOf(inPool(current, newcomer));
    // Heat has cooled but the quote has barely moved: the ratchet.
    expect(soonAfter).toBeGreaterThan(peak * 0.75);
    for (let quarter = 0; quarter < 80; quarter++) current = fadeStanding(current);
    // Decades on it has come part of the way back - not all, because the fame a hit that size left behind is real.
    const settled = feeOf(inPool(current, newcomer));
    expect(settled).toBeLessThan(peak);
    expect(settled).toBeGreaterThanOrEqual(feeOf(newcomer));
  });
});

describe('between films', () => {
  it('heat eases back toward fame', () => {
    const hot = find('Actor', (p) => p.reputation.currentHeat > p.reputation.fame + 8);
    const cold = find('Actor', (p) => p.reputation.currentHeat < p.reputation.fame - 8);
    const after = fadeStanding(pool);
    expect(inPool(after, hot).reputation.currentHeat).toBeLessThan(hot.reputation.currentHeat);
    expect(inPool(after, cold).reputation.currentHeat).toBeGreaterThan(cold.reputation.currentHeat);
  });

  it('runs once a quarter', () => {
    expect(crossedStandingFade(10, 11)).toBe(false);
    expect(crossedStandingFade(STANDING_FADE_INTERVAL_DAYS - 1, STANDING_FADE_INTERVAL_DAYS)).toBe(true);
    expect(crossedStandingFade(1, STANDING_FADE_INTERVAL_DAYS * 3)).toBe(true);
  });
});

describe('awards', () => {
  it('a win lifts the heat and respect of the person named, more than a nomination', () => {
    const ceremony = (won: boolean): AwardsCeremony =>
      ({ show: 'academy', year: 1, ceremonyDay: 400, categories: { 'best-director': [{ filmId: 'f', personId: director.id, awardScore: 80, won }] } }) as unknown as AwardsCeremony;
    const nominated = inPool(applyAwardsToCareers(pool, [ceremony(false)], () => 1), director);
    const won = inPool(applyAwardsToCareers(pool, [ceremony(true)], () => 1), director);
    expect(nominated.reputation.currentHeat).toBeGreaterThan(director.reputation.currentHeat);
    expect(won.reputation.currentHeat).toBeGreaterThan(nominated.reputation.currentHeat);
    expect(won.reputation.industryRespect).toBeGreaterThan(director.reputation.industryRespect);
    expect(applyAwardsToCareers(pool, [], () => 1)).toBe(pool);
  });
});
