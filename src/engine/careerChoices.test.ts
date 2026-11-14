import { describe, it, expect } from 'vitest';
import {
  actorType,
  careerPhase,
  careerPull,
  decideBreak,
  describeCareerStatus,
  isOnBreak,
  offerLure,
  recordWork,
  slowdownAge,
  unwillingToWork,
  SEMI_RETIRE_AFTER,
} from './careerChoices';
import { careerNews, withCareerNews, leavingChance } from './careerTurnover';
import { wouldTakeRivalOffer } from './rivalStudios';
import { generateTalentPool } from './talentGenerator';
import { createRng } from './random';
import { firstDayOfYear } from './calendar';
import { GENERATED_TALENT_DB } from '../data/talentDatabases';
import type { Person, TalentProfession } from '../types';

const pool = generateTalentPool(createRng(23), GENERATED_TALENT_DB);
const DAY = firstDayOfYear(3);
const thisYear = 3;

/** An actor with the given temperament and standing, born to be a given age now. */
function actor(opts: { ambition?: number; ego?: number; fame?: number; heat?: number; age?: number; prior?: number } = {}): Person {
  const base = pool.Actor.find((p) => p.careers.actor)!;
  return {
    ...base,
    id: `t-${JSON.stringify(opts)}`,
    identity: { ...base.identity, dateOfBirth: { year: thisYear - (opts.age ?? 35), month: 1, day: 1 } },
    personality: { ...base.personality, ambition: opts.ambition ?? 50, ego: opts.ego ?? 50, professionalism: 50 },
    reputation: { ...base.reputation, fame: opts.fame ?? 30, currentHeat: opts.heat ?? 30 },
    careers: { ...base.careers, actor: { ...base.careers.actor!, priorCredits: opts.prior ?? 0, actingStyle: { characterTransformation: 50, emotionalPerformance: 50, charisma: 50, comedy: 40, physicalPerformance: 80 } } },
    recentWork: undefined,
    breakUntilDay: undefined,
  };
}

const actionRun = (person: Person, n: number) => {
  let p = person;
  for (let i = 0; i < n; i++) p = recordWork(p, { day: DAY - 100 * (n - i), part: 'physicalPerformance' });
  return p;
};

describe('type, and what an offer does for someone', () => {
  it('a type is read from the record, with the current run counted', () => {
    const p = recordWork(actionRun(actor(), 3), { day: DAY, part: 'comedy' });
    expect(actorType(p)).toMatchObject({ axis: 'physicalPerformance', run: 0, fromRecord: true });
    expect(actorType(actionRun(actor(), 3))).toMatchObject({ axis: 'physicalPerformance', run: 3 });
  });

  it('with no record, a type is their strongest suit', () => {
    expect(actorType(actor()).axis).toBe('physicalPerformance');
  });

  it('an ambitious, established actor tires of the fourth action part and wants the stretch', () => {
    const star = actionRun(actor({ ambition: 85, fame: 70 }), 3);
    const same = careerPull(star, { axis: 'physicalPerformance', scale: 'Medium', lead: true }, DAY);
    const stretch = careerPull(star, { axis: 'emotionalPerformance', scale: 'Medium', lead: true }, DAY);
    expect(same.delta).toBeLessThan(0);
    expect(same.reason).toBe('typecast');
    expect(same.note).toMatch(/three action parts running/);
    expect(stretch.delta).toBeGreaterThan(0);
    expect(stretch.stretch).toBe(true);
  });

  it('a content actor is glad of more of the same', () => {
    const steady = actionRun(actor({ ambition: 20, fame: 70 }), 3);
    expect(careerPull(steady, { axis: 'physicalPerformance', scale: 'Medium', lead: true }, DAY).delta).toBeGreaterThan(0);
  });

  it('an ambitious unknown takes what comes', () => {
    const hungry = actionRun(actor({ ambition: 85, fame: 10, heat: 10 }), 3);
    expect(careerPull(hungry, { axis: 'physicalPerformance', scale: 'Medium', lead: true }, DAY).delta).toBe(0);
  });

  it('a big name with an ego thinks a small part in a small film beneath them', () => {
    const big = actor({ ego: 90, fame: 90, ambition: 30 });
    const small = careerPull(big, { axis: 'charisma', scale: 'Intimate', lead: false }, DAY);
    expect(small.reason).toBe('beneath');
    expect(small.delta).toBeLessThan(careerPull(big, { axis: 'charisma', scale: 'Epic', lead: true }, DAY).delta);
  });
});

describe('slowing down and leaving', () => {
  it('people slow down at their own age, and the ambitious later', () => {
    const ages = pool.Actor.slice(0, 200).map(slowdownAge);
    expect(Math.max(...ages) - Math.min(...ages)).toBeGreaterThan(8);
    expect(slowdownAge(actor({ ambition: 95 }))).toBeGreaterThan(slowdownAge(actor({ ambition: 5 })));
  });

  it('phases follow: working, selective, semi-retired', () => {
    const p = actor({ age: 30 });
    const at = Math.ceil(slowdownAge(p));
    const aged = (age: number) => ({ ...p, identity: { ...p.identity, dateOfBirth: { year: thisYear - age, month: 1, day: 1 } } });
    expect(careerPhase(aged(at - 1), DAY)).toBe('working');
    expect(careerPhase(aged(at + 1), DAY)).toBe('selective');
    expect(careerPhase(aged(at + SEMI_RETIRE_AFTER + 1), DAY)).toBe('semi-retired');
    expect(describeCareerStatus(aged(at + SEMI_RETIRE_AFTER + 1), DAY)).toMatch(/retired/);
  });

  it('it is the semi-retired who leave, not the working', () => {
    const p = actor();
    const at = Math.ceil(slowdownAge(p));
    const aged = (age: number) => ({ ...p, identity: { ...p.identity, dateOfBirth: { year: thisYear - age, month: 1, day: 1 } } });
    expect(leavingChance(aged(at - 1), DAY).chance).toBe(0);
    expect(leavingChance(aged(at + SEMI_RETIRE_AFTER + 1), DAY).chance).toBeGreaterThan(leavingChance(aged(at + 1), DAY).chance);
  });

  it('the semi-retired turn everyone down except a director they revere or a studio they are close to', () => {
    const p = actor();
    const old = { ...p, identity: { ...p.identity, dateOfBirth: { year: thisYear - Math.ceil(slowdownAge(p) + SEMI_RETIRE_AFTER + 1), month: 1, day: 1 } } };
    expect(unwillingToWork(old, DAY)?.reason).toBe('retired');
    const revered = { ...pool.Director[0], reputation: { ...pool.Director[0].reputation, industryRespect: 95 } };
    expect(unwillingToWork(old, DAY, offerLure(revered, 0))).toBeNull();
    expect(unwillingToWork(old, DAY, offerLure(undefined, 60))).toBeNull();
  });
});

describe('breaks', () => {
  it('more films back to back make a break likelier; the driven keep going', () => {
    const rate = (person: Person, films: number) => {
      let n = 0;
      for (let i = 0; i < 400; i++) {
        const p = { ...person, id: `${person.id}-${i}` };
        let busy = p;
        for (let f = 0; f < films; f++) busy = recordWork(busy, { day: DAY - 60 * f });
        if (decideBreak(busy, `film-${i}`, DAY) !== undefined) n += 1;
      }
      return n / 400;
    };
    const easy = actor();
    const driven = { ...actor(), personality: { ...actor().personality, ambition: 95, professionalism: 95 } };
    expect(rate(easy, 5)).toBeGreaterThan(rate(easy, 1) + 0.1);
    expect(rate(driven, 5)).toBeLessThan(rate(easy, 5));
  });

  it('a bomb pinned on them can prompt one', () => {
    let after = 0;
    let before = 0;
    for (let i = 0; i < 400; i++) {
      const p = { ...actor(), id: `b-${i}` };
      if (decideBreak(recordWork(p, { day: DAY, blamed: true }), 'f', DAY) !== undefined) after += 1;
      if (decideBreak(recordWork(p, { day: DAY }), 'f', DAY) !== undefined) before += 1;
    }
    expect(after).toBeGreaterThan(before);
  });

  it('on a break they turn down offers until it ends', () => {
    const resting = { ...actor(), breakUntilDay: DAY + 200 };
    expect(isOnBreak(resting, DAY)).toBe(true);
    expect(unwillingToWork(resting, DAY)?.reason).toBe('on-break');
    expect(unwillingToWork(resting, DAY + 201)).toBeNull();
  });
});

describe('rivals are turned down too', () => {
  it('nobody on a break takes a rival film', () => {
    const resting = { ...actor(), breakUntilDay: DAY + 200 };
    expect(wouldTakeRivalOffer(resting, { scale: 'Epic', lead: true }, DAY, 'p1')).toBe(false);
    expect(wouldTakeRivalOffer(actor(), { scale: 'Epic', lead: true }, DAY, 'p1')).toBe(true);
  });
});

describe('the player hears about the people they know', () => {
  it('news of a collaborator starting a break, gathered into one notice', () => {
    const p = actor();
    const before = { ...pool, Actor: [p] } as Record<TalentProfession, Person[]>;
    const after = { ...pool, Actor: [{ ...p, breakUntilDay: DAY + 300 }] } as Record<TalentProfession, Person[]>;
    const news = careerNews(before, after, DAY, DAY, new Set([p.id]));
    expect(news).toHaveLength(1);
    expect(news[0]).toMatch(/taking time away/);
    expect(careerNews(before, after, DAY, DAY, new Set())).toHaveLength(0);
    const once = withCareerNews(undefined, news, DAY)!;
    const twice = withCareerNews(once, ['Someone else is slowing down.'], DAY + 5)!;
    expect(twice).toHaveLength(1);
    expect(twice[0].news).toHaveLength(2);
  });
});
