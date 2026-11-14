import { describe, it, expect } from 'vitest';
import { ageAbility, growFromFilm, learningPace, potentialFor, withAbilities } from './talentAbility';
import { knowledgeAttributes } from './talentKnowledge';
import { generateNewcomer, generateTalentPool } from './talentGenerator';
import { scaleExperienceFactor } from './scoring';
import { actorConsistency } from './actingModel';
import { createRng } from './random';
import { firstDayOfYear } from './calendar';
import { GENERATED_TALENT_DB } from '../data/talentDatabases';
import type { Person, ProductionRole } from '../types';

const pool = generateTalentPool(createRng(41), GENERATED_TALENT_DB);
const DAY = firstDayOfYear(4);

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let a = 0, b = 0, c = 0;
  for (let i = 0; i < n; i++) {
    a += (xs[i] - mx) * (ys[i] - my);
    b += (xs[i] - mx) ** 2;
    c += (ys[i] - my) ** 2;
  }
  return a / Math.sqrt(b * c);
}
const fee = (p: Person) => Math.log((Object.values(p.careers)[0] as { typicalSalary: number }).typicalSalary);
const mean = (p: Person, role: ProductionRole) => {
  const attrs = knowledgeAttributes(p, role);
  return attrs.reduce((s, a) => s + a.value, 0) / attrs.length;
};

describe('ability is untied from fee', () => {
  it('a director\'s fee says a little about their ability, not everything', () => {
    const r = pearson(pool.Director.map(fee), pool.Director.map((p) => mean(p, 'Director')));
    expect(r).toBeGreaterThan(0.1);
    expect(r).toBeLessThan(0.5);
  });

  it('potential is never below ability, and is stored for everyone generated', () => {
    for (const [role, roster] of [['Director', pool.Director], ['Cinematographer', pool.Cinematographer], ['Lead Actor', pool.Actor], ['Production Designer', pool['Production Designer']]] as const) {
      for (const p of roster.slice(0, 40)) {
        const potential = potentialFor(p, role);
        for (const a of knowledgeAttributes(p, role)) expect(potential[a.key]).toBeGreaterThanOrEqual(a.value - 0.01);
      }
    }
  });

  it('a director\'s skill stays the mean of their domains', () => {
    for (const p of pool.Director.slice(0, 20)) {
      const d = p.careers.director!;
      const m = (d.aptitudes!.story + d.aptitudes!.visual + d.aptitudes!.performance + d.aptitudes!.craft) / 4;
      expect(Math.abs(d.skill - m)).toBeLessThanOrEqual(1);
    }
  });

  it('newcomers come from the same spread: a few have real potential, and it barely shows yet', () => {
    const rng = createRng(9);
    const arrivals = Array.from({ length: 400 }, (_, i) => generateNewcomer('Cinematographer', rng, DAY, `n-${i}`));
    const pots = arrivals.map((p) => potentialFor(p, 'Cinematographer').craft);
    const good = pots.filter((v) => v >= 75).length / pots.length;
    expect(good).toBeGreaterThan(0.04);
    expect(good).toBeLessThan(0.25);
    const best = arrivals[pots.indexOf(Math.max(...pots))];
    expect(mean(best, 'Cinematographer')).toBeLessThan(Math.max(...pots) - 10);
  });
});

describe('growth through use', () => {
  const actor: Person = (() => {
    const base = pool.Actor[3];
    return {
      ...base,
      personality: { ...base.personality, ambition: 50, professionalism: 50, adaptability: 50, ego: 50 },
      careers: {
        ...base.careers,
        actor: {
          ...base.careers.actor!,
          actingStyle: { characterTransformation: 40, emotionalPerformance: 40, charisma: 40, comedy: 40, physicalPerformance: 40 },
          potential: { characterTransformation: 80, emotionalPerformance: 80, charisma: 80, comedy: 80, physicalPerformance: 80 },
        },
      },
    };
  })();
  const style = (p: Person) => p.careers.actor!.actingStyle;

  it('grows in what the film tested, and nothing else', () => {
    const after = growFromFilm(actor, 'Lead Actor', { emotionalPerformance: 1, comedy: 0 }, undefined);
    expect(style(after).emotionalPerformance).toBeGreaterThan(40);
    expect(style(after).comedy).toBe(40);
  });

  it('fastest early, and never past their potential', () => {
    let p = actor;
    const steps: number[] = [];
    for (let i = 0; i < 40; i++) {
      const before = style(p).emotionalPerformance;
      p = growFromFilm(p, 'Lead Actor', { emotionalPerformance: 1 }, undefined);
      steps.push(style(p).emotionalPerformance - before);
    }
    expect(steps[0]).toBeGreaterThan(steps[10]);
    expect(style(p).emotionalPerformance).toBeLessThanOrEqual(80);
    expect(style(p).emotionalPerformance).toBeGreaterThan(70);
  });

  it('a director who is strong with actors teaches more; a big ego learns less from them', () => {
    const mentor = { ...pool.Director[0], careers: { ...pool.Director[0].careers, director: { ...pool.Director[0].careers.director!, aptitudes: { story: 70, visual: 70, performance: 98, craft: 70 } } } };
    expect(learningPace(actor, mentor, false)).toBeGreaterThan(learningPace(actor, undefined, false));
    const vain = { ...actor, personality: { ...actor.personality, ego: 100 } };
    const humble = { ...actor, personality: { ...actor.personality, ego: 0 } };
    expect(learningPace(humble, mentor, false)).toBeGreaterThan(learningPace(vain, mentor, false));
  });

  it('the ambitious and the professional grow faster; adaptability counts in a new register', () => {
    const driven = { ...actor, personality: { ...actor.personality, ambition: 95, professionalism: 95 } };
    expect(learningPace(driven, undefined, false)).toBeGreaterThan(learningPace(actor, undefined, false));
    const adaptable = { ...actor, personality: { ...actor.personality, adaptability: 95 } };
    expect(learningPace(adaptable, undefined, true)).toBeGreaterThan(learningPace(adaptable, undefined, false));
  });

  it('a director grows by domain and their skill follows', () => {
    const d = pool.Director[5];
    const after = growFromFilm(d, 'Director', { story: 1, visual: 1, performance: 1, craft: 1 }, undefined);
    expect(after.careers.director!.skill).toBeGreaterThanOrEqual(d.careers.director!.skill);
  });

  it('writing back values keeps the craft careers coherent', () => {
    const w = pool.Writer[2];
    const raised = withAbilities(w, 'Writer', { craft: w.careers.writer!.skill + 5 });
    expect(raised.careers.writer!.skill).toBeCloseTo(w.careers.writer!.skill + 5, 0);
    expect(raised.careers.writer!.craft.structure).toBeGreaterThan(w.careers.writer!.craft.structure);
  });
});

describe('age, experience and scale', () => {
  it('physical performance fades past the forties, and nothing else does', () => {
    const p = pool.Actor[0];
    const old = { ...p, identity: { ...p.identity, dateOfBirth: { year: 4 - 60, month: 1, day: 1 } } };
    const aged = ageAbility(old, DAY);
    expect(aged.careers.actor!.actingStyle.physicalPerformance).toBeLessThan(old.careers.actor!.actingStyle.physicalPerformance);
    expect(aged.careers.actor!.actingStyle.charisma).toBe(old.careers.actor!.actingStyle.charisma);
    const young = { ...p, identity: { ...p.identity, dateOfBirth: { year: 4 - 30, month: 1, day: 1 } } };
    expect(ageAbility(young, DAY)).toBe(young);
  });

  it('experience raises the floor', () => {
    expect(actorConsistency(0)).toBeLessThan(actorConsistency(80));
    expect(actorConsistency(80)).toBe(1);
  });

  it('a first-timer is safe on a small film and a risk on a tentpole', () => {
    expect(scaleExperienceFactor('Intimate', 0)).toBe(1);
    expect(scaleExperienceFactor('Epic', 0)).toBeLessThan(scaleExperienceFactor('Medium', 0));
    expect(scaleExperienceFactor('Epic', 60)).toBe(1);
  });
});
