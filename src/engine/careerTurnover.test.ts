import { describe, it, expect } from 'vitest';
import {
  buildIndustryNotice,
  crossedIntoNewYear,
  leavingChance,
  MAX_YEARLY_TURNOVER,
  turnOverTalent,
  unreadIndustryNoticeCount,
} from './careerTurnover';
import { generateTalentPool } from './talentGenerator';
import { createRng } from './random';
import { firstDayOfYear } from './calendar';
import { withCommitment } from './person';
import { GENERATED_TALENT_DB } from '../data/talentDatabases';
import { studioReducer } from '../state/studioReducer';
import { createBotStudio } from '../state/playerBot';
import { attentionBadgeCount } from '../state/selectors';
import { DIFFICULTY_TIERS } from '../data/difficulty';
import type { Person } from '../types';

const pool = generateTalentPool(createRng(909), GENERATED_TALENT_DB);
const day = firstDayOfYear(2);
const turn = (overrides: Partial<Parameters<typeof turnOverTalent>[1]> = {}) => turnOverTalent(pool, { day, seed: 12345, protectedIds: new Set(), ...overrides });
const ageOf = (p: Person, onDay = day) => Math.floor((onDay - 1) / 365) + 1 - p.identity.dateOfBirth!.year;
const careerOf = (p: Person) => Object.values(p.careers)[0] as { experience: number; priorCredits: number; careerStartDay: number; typicalSalary: number };

describe('a year of turnover', () => {
  const result = turn();

  it('keeps every profession the same size: as many arrive as leave', () => {
    expect(result.departures.length).toBeGreaterThan(0);
    expect(result.arrivals).toHaveLength(result.departures.length);
    for (const profession of Object.keys(pool) as Array<keyof typeof pool>) {
      expect(result.pool[profession]).toHaveLength(pool[profession].length);
    }
  });

  it('nobody young leaves for age, and the old are the likeliest to go', () => {
    const retired = result.departures.filter((d) => d.reason === 'retired');
    expect(retired.length).toBeGreaterThan(0);
    for (const departure of retired) expect(departure.age).toBeGreaterThanOrEqual(55);
    const young = pool.Actor.find((p) => ageOf(p) < 40)!;
    const old = pool.Actor.find((p) => ageOf(p) > 70)!;
    expect(leavingChance(young, day).chance).toBe(0);
    expect(leavingChance(old, day).chance).toBeGreaterThan(0.1);
  });

  it('never takes more than a small share of a profession in one year', () => {
    for (const profession of Object.keys(pool) as Array<keyof typeof pool>) {
      const left = result.departures.filter((d) => d.profession === profession).length;
      expect(left).toBeLessThanOrEqual(Math.floor(pool[profession].length * MAX_YEARLY_TURNOVER));
    }
  });

  it('the newcomers are young, cheap and barely credited, with ids that cannot collide with the original pool', () => {
    const existingIds = new Set(Object.values(pool).flat().map((p) => p.id));
    const medianFee = [...pool.Actor].map((p) => careerOf(p).typicalSalary).sort((a, b) => a - b)[Math.floor(pool.Actor.length / 2)];
    for (const newcomer of result.arrivals) {
      expect(existingIds.has(newcomer.id)).toBe(false);
      expect(ageOf(newcomer)).toBeLessThan(45);
      expect(careerOf(newcomer).experience).toBeLessThanOrEqual(12);
      expect(careerOf(newcomer).priorCredits).toBeLessThan(8);
      expect(careerOf(newcomer).careerStartDay).toBeLessThanOrEqual(day);
    }
    const newActors = result.arrivals.filter((p) => p.primaryRole === 'Actor');
    expect(newActors.every((p) => careerOf(p).typicalSalary < medianFee)).toBe(true);
    expect(new Set(result.arrivals.map((p) => p.id)).size).toBe(result.arrivals.length);
  });

  it('is the same every time for the same save and year, and different for a different save', () => {
    expect(turn().arrivals.map((p) => p.identity.name)).toEqual(result.arrivals.map((p) => p.identity.name));
    expect(turn().departures.map((d) => d.person.id)).toEqual(result.departures.map((d) => d.person.id));
    expect(turn({ seed: 999 }).arrivals.map((p) => p.identity.name)).not.toEqual(result.arrivals.map((p) => p.identity.name));
  });

  it('leaves alone anyone attached to an unreleased film of the player\'s', () => {
    const wouldLeave = result.departures[0].person;
    const spared = turn({ protectedIds: new Set([wouldLeave.id]) });
    expect(spared.departures.some((d) => d.person.id === wouldLeave.id)).toBe(false);
  });

  it('being booked by a rival does not keep someone from retiring', () => {
    // Otherwise nobody who is working ever leaves: the film they are on keeps
    // its own record of them and finishes without the pool.
    const other = result.departures[1].person;
    const booked = withCommitment(other, { projectId: 'x', role: 'Lead Actor', startDay: day - 10, endDay: day + 100 });
    const bookedPool = Object.fromEntries(Object.entries(pool).map(([k, roster]) => [k, roster.map((p) => (p.id === other.id ? booked : p))])) as typeof pool;
    expect(turnOverTalent(bookedPool, { day, seed: 12345, protectedIds: new Set() }).departures.some((d) => d.person.id === other.id)).toBe(true);
  });

  it('someone cold who has not worked in years may drift out before retirement age', () => {
    const young = pool.Director.find((p) => ageOf(p) < 50)!;
    const cold = { ...young, reputation: { ...young.reputation, currentHeat: 10 } };
    expect(leavingChance(cold, firstDayOfYear(3)).chance).toBe(0);
    const later = leavingChance(cold, firstDayOfYear(9));
    expect(later.chance).toBeGreaterThan(0);
    expect(later.reason).toBe('left the business');
  });
});

describe('the note to the player', () => {
  const result = turn();

  it('counts everyone and names only the best known, and anyone the studio had worked with', () => {
    const collaborator = result.departures[result.departures.length - 1].person;
    const notice = buildIndustryNotice(result, day, new Set([collaborator.id]))!;
    expect(notice.arrivals).toBe(result.arrivals.length);
    expect(notice.departures).toBe(result.departures.length);
    expect(notice.notable.length).toBeLessThanOrEqual(4);
    expect(notice.collaborators).toEqual([collaborator.identity.name]);
    expect(notice.read).toBe(false);
    expect(unreadIndustryNoticeCount([notice])).toBe(1);
    expect(buildIndustryNotice({ pool, arrivals: [], departures: [] }, day, new Set())).toBeNull();
  });
});

describe('through the reducer', () => {
  it('happens once, as the calendar moves into a new year, and reaches the Inbox badge until read', () => {
    expect(crossedIntoNewYear(364, 365)).toBe(false);
    expect(crossedIntoNewYear(365, 366)).toBe(true);

    let state = createBotStudio(3, DIFFICULTY_TIERS.find((t) => t.id === 'indie')!);
    const sizeBefore = state.talentPool.Actor.length;
    const idsBefore = new Set(state.talentPool.Actor.map((p) => p.id));
    for (let i = 0; i < 364; i++) state = studioReducer(state, { type: 'ADVANCE_DAY' });
    expect(state.industryNotices ?? []).toHaveLength(0);
    const badgeBefore = attentionBadgeCount(state);

    state = studioReducer(state, { type: 'ADVANCE_DAY' });
    expect(state.totalDays).toBe(366);
    expect(state.industryNotices).toHaveLength(1);
    expect(state.talentPool.Actor).toHaveLength(sizeBefore);
    expect(state.talentPool.Actor.some((p) => !idsBefore.has(p.id))).toBe(true);
    expect(attentionBadgeCount(state)).toBe(badgeBefore + 1);

    const next = studioReducer(state, { type: 'ADVANCE_DAY' });
    expect(next.industryNotices).toHaveLength(1); // not again the day after

    // Opening the Inbox reads it: the badge stops counting it, and it stays until dismissed.
    const read = studioReducer(state, { type: 'MARK_BID_NOTIFICATIONS_READ' });
    expect(attentionBadgeCount(read)).toBe(badgeBefore);
    expect(read.industryNotices).toHaveLength(1);
    const dismissed = studioReducer(read, { type: 'DISMISS_INDUSTRY_NOTICE', id: read.industryNotices![0].id });
    expect(dismissed.industryNotices).toHaveLength(0);
  });
});
