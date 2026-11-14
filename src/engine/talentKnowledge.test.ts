import { describe, it, expect } from 'vitest';
import {
  buildCreditIndex,
  deriveTalentKnowledge,
  creditsFor,
  CERTAIN_CONFIDENCE,
  ELSEWHERE_CONFIDENCE_CAP,
  FAIR_CONFIDENCE,
  readFor,
  type TalentKnowledge,
} from './talentKnowledge';
import { gateAxesByKnowledge, deriveFitReadFromKnowledge } from './talentCardPresentation';
import { describeDirectorAptitudes } from './creativeAptitudes';
import { chooseRivalHires, knownAbility } from './rivalCasting';
import { generateTalentPool } from './talentGenerator';
import { generateScriptOptions } from './scriptGenerator';
import { createRng } from './random';
import { GENERATED_TALENT_DB } from '../data/talentDatabases';
import type { CharacterTraitProfile, Film, Person, ProductionRole, Project, Script } from '../types';

const pool = generateTalentPool(createRng(91), GENERATED_TALENT_DB);
const baseScript: Script = generateScriptOptions('Drama', createRng(5), 1)[0];

// An actor with no pre-game career, so every read comes from the films below.
const fresh = (p: Person): Person => ({ ...p, careers: { ...p.careers, actor: p.careers.actor ? { ...p.careers.actor, priorCredits: 0 } : undefined } });
const actor = fresh(pool.Actor.find((p) => p.reputation.fame < 30)!);
const otherActor = fresh(pool.Actor.find((p) => p.id !== actor.id && p.reputation.fame < 30)!);
const directors = [...pool.Director].sort((a, b) => (b.careers.director!.skill - a.careers.director!.skill));
const greatDirector = { ...directors[0], careers: { ...directors[0].careers, director: { ...directors[0].careers.director!, aptitudes: { story: 80, visual: 80, performance: 95, craft: 80 } } } };
const plainDirector = { ...directors[directors.length - 1], careers: { ...directors[directors.length - 1].careers, director: { ...directors[directors.length - 1].careers.director!, aptitudes: { story: 40, visual: 40, performance: 40, craft: 40 } } } };

const LOW: CharacterTraitProfile = { ...baseScript.cast[0].traits, charismaDemand: 10, comedyDemand: 5, emotionalDemand: 10, physicalDemand: 10, transformationDemand: 10 };
/** A part that leans on one or two attributes and barely touches the rest. */
function part(demands: Partial<CharacterTraitProfile>): Script {
  const lead = { ...baseScript.cast[0], id: 'c-lead', prominence: 'Lead' as const, traits: { ...LOW, ...demands } };
  return { ...baseScript, scale: 'Medium', cast: [lead] };
}
const ACTION = part({ physicalDemand: 90, charismaDemand: 60 });
const COMEDY = part({ comedyDemand: 90, charismaDemand: 50 });

let filmCounter = 0;
function film(script: Script, talent: Array<{ role: ProductionRole; person: Person }>, opts: { rival?: string; day?: number; outcome?: Film['results']['outcome']; critic?: number } = {}): Project {
  filmCounter += 1;
  const f = {
    id: `film-${filmCounter}`,
    title: `Film ${filmCounter}`,
    genre: script.genre,
    script,
    talent: talent.map((t) => (t.role === 'Lead Actor' ? { ...t, characterId: 'c-lead' } : t)),
    releasedOnDay: opts.day ?? 400 + filmCounter,
    releasedBy: opts.rival,
    results: { outcome: opts.outcome ?? 'Hit', criticScore: opts.critic ?? 60 },
    boxOfficeRun: { status: 'finished' },
  } as unknown as Film;
  return { kind: 'released', film: f };
}

const lead = (person: Person) => ({ role: 'Lead Actor' as const, person });
const directedBy = (person: Person) => ({ role: 'Director' as const, person });
const know = (projects: Project[], person: Person = actor, role: ProductionRole = 'Lead Actor', opts = {}) =>
  deriveTalentKnowledge(person, role, buildCreditIndex(projects), opts);
const conf = (k: TalentKnowledge, key: string) => readFor(k, key)!.confidence;

describe('a read comes from what a film tested', () => {
  it('a newcomer is untested in everything', () => {
    const k = know([]);
    expect(k.reads.every((r) => r.tier === 'untested')).toBe(true);
    expect(k.caveat).toMatch(/gamble/);
  });

  it('three of your own action films make physical performance certain and leave comedy untouched', () => {
    const k = know([film(ACTION, [lead(actor), directedBy(plainDirector)]), film(ACTION, [lead(actor), directedBy(plainDirector)]), film(ACTION, [lead(actor), directedBy(plainDirector)])]);
    expect(conf(k, 'physicalPerformance')).toBeGreaterThanOrEqual(CERTAIN_CONFIDENCE);
    expect(readFor(k, 'physicalPerformance')!.verdict).not.toMatch(/likely|to|Hard|Probably/);
    expect(conf(k, 'comedy')).toBeLessThan(conf(k, 'physicalPerformance') / 2);
    expect(readFor(k, 'physicalPerformance')!.basis).toMatch(/three of your films/);
  });

  it('repetition has diminishing returns: a fourth action film teaches little about comedy', () => {
    const three = know([1, 2, 3].map(() => film(ACTION, [lead(actor)])));
    const four = know([1, 2, 3, 4].map(() => film(ACTION, [lead(actor)])));
    expect(conf(four, 'comedy') - conf(three, 'comedy')).toBeLessThan(0.1);
  });

  it('to learn something new you have to give them a part that needs it', () => {
    const before = know([film(ACTION, [lead(actor)]), film(ACTION, [lead(actor)])]);
    const after = know([film(ACTION, [lead(actor)]), film(ACTION, [lead(actor)]), film(COMEDY, [lead(actor)])]);
    expect(conf(after, 'comedy')).toBeGreaterThan(conf(before, 'comedy') + 0.3);
  });

  it('a read only covers the person it is about', () => {
    const k = know([film(ACTION, [lead(otherActor)])]);
    expect(k.reads.every((r) => r.tier === 'untested')).toBe(true);
  });
});

describe('your own films against other people\'s', () => {
  it('other studios\' films never make a read certain', () => {
    const many = Array.from({ length: 12 }, () => film(ACTION, [lead(actor)], { rival: 'Rival' }));
    const k = know(many);
    expect(conf(k, 'physicalPerformance')).toBeLessThanOrEqual(ELSEWHERE_CONFIDENCE_CAP + 1e-9);
    expect(conf(k, 'physicalPerformance')).toBeGreaterThan(FAIR_CONFIDENCE);
    expect(k.caveat).toMatch(/second-hand/);
  });

  it('one film of your own teaches more than several of someone else\'s', () => {
    const own = know([film(ACTION, [lead(actor)])]);
    const theirs = know([1, 2, 3].map(() => film(ACTION, [lead(actor)], { rival: 'Rival' })));
    expect(conf(own, 'physicalPerformance')).toBeGreaterThan(conf(theirs, 'physicalPerformance'));
  });

  it('second-hand work under a director who gets the best from everyone flatters the read', () => {
    const helped = know([film(ACTION, [lead(actor), directedBy(greatDirector)], { rival: 'Rival' })]);
    const plain = know([film(ACTION, [lead(actor), directedBy(plainDirector)], { rival: 'Rival' })]);
    expect(readFor(helped, 'physicalPerformance')!.centre).toBeGreaterThan(readFor(plain, 'physicalPerformance')!.centre);
  });

  it('names that director in the caveat when their acclaimed film is all you have', () => {
    const k = know([film(ACTION, [lead(actor), directedBy(greatDirector)], { rival: 'Rival', outcome: 'Masterpiece', critic: 85 })]);
    expect(k.caveat).toContain(greatDirector.identity.name);
  });

  it('once you have used them, your own evidence sees through the flattery', () => {
    const projects = [film(ACTION, [lead(actor), directedBy(greatDirector)], { rival: 'Rival' }), film(ACTION, [lead(actor)]), film(ACTION, [lead(actor)]), film(ACTION, [lead(actor)])];
    const read = readFor(know(projects), 'physicalPerformance')!;
    const truth = actor.careers.actor!.actingStyle.physicalPerformance;
    expect(Math.abs(read.centre - truth)).toBeLessThan(5);
  });
});

describe('the career before the game began', () => {
  const veteran = pool.Actor.find((p) => (p.careers.actor?.priorCredits ?? 0) >= 20 && p.reputation.fame > 60)!;

  it('a famous veteran is known second-hand for what they are good at, not for what they never do', () => {
    const k = know([], veteran);
    const style = veteran.careers.actor!.actingStyle;
    const axes = Object.keys(style) as Array<keyof typeof style>;
    const best = axes.reduce((a, b) => (style[b] > style[a] ? b : a));
    const worst = axes.reduce((a, b) => (style[b] < style[a] ? b : a));
    expect(conf(k, best)).toBeGreaterThan(conf(k, worst));
    expect(conf(k, best)).toBeLessThan(CERTAIN_CONFIDENCE);
    expect(k.totalFilms).toBe(veteran.careers.actor!.priorCredits);
  });
});

describe('the studio-side sharpeners', () => {
  it('a casting director sharpens every actor read; a screen test sharpens what the part asks for', () => {
    const none = know([]);
    const cd = know([], actor, 'Lead Actor', { castingDirectorSkill: 80 });
    const tested = know([], actor, 'Lead Actor', { character: COMEDY.cast[0], audited: true });
    expect(conf(cd, 'comedy')).toBeGreaterThan(conf(none, 'comedy'));
    expect(conf(tested, 'comedy')).toBeGreaterThan(conf(cd, 'comedy'));
    expect(conf(tested, 'physicalPerformance')).toBeLessThan(conf(tested, 'comedy'));
  });

  it('the caveat says when the part asks for something nobody has seen, or something you never used them for', () => {
    const untested = know([], actor, 'Lead Actor', { character: COMEDY.cast[0] });
    expect(untested.caveat).toMatch(/be funny/);
    const actionOnly = know([film(ACTION, [lead(actor)]), film(ACTION, [lead(actor)])], actor, 'Lead Actor', { character: part({ emotionalDemand: 95 }).cast[0] });
    expect(actionOnly.caveat).toMatch(/only ever used them for physical parts/);
  });
});

describe('the fit read takes its confidence from evidence', () => {
  it('veils the axes nobody has seen, and is only confident once you have', () => {
    const rows = [
      { key: 'physicalPerformance', label: 'Physical', matchScore: 90, strength: 80, demandWeight: 0.5 },
      { key: 'comedy', label: 'Comedy', matchScore: 70, strength: 60, demandWeight: 0.5 },
    ];
    const weights = { physicalPerformance: 0.5, comedy: 0.5 };
    const stranger = know([]);
    const known = know([film(ACTION, [lead(actor)]), film(ACTION, [lead(actor)]), film(COMEDY, [lead(actor)]), film(COMEDY, [lead(actor)])]);
    expect(gateAxesByKnowledge(rows, stranger).every((r) => !r.known)).toBe(true);
    expect(gateAxesByKnowledge(rows, known).every((r) => r.known)).toBe(true);
    expect(deriveFitReadFromKnowledge(80, actor, stranger, weights).confidence).toBe('low');
    const sure = deriveFitReadFromKnowledge(80, actor, known, weights);
    expect(sure.confidence).toBe('high');
    expect(sure.assistNote).toMatch(/worked together/);
  });
});

describe('directors and crew', () => {
  it('a director\'s demand read reveals only the domains a film has shown', () => {
    const k = know([], plainDirector, 'Director');
    expect(Object.keys(describeDirectorAptitudes(plainDirector, undefined, { reads: k.reads.map((r) => ({ ...r, confidence: 0 })) }).domains)).toHaveLength(0);
    const used = know([film(baseScript, [directedBy(plainDirector)]), film(baseScript, [directedBy(plainDirector)])], plainDirector, 'Director');
    expect(Object.keys(describeDirectorAptitudes(plainDirector, undefined, used).domains).length).toBeGreaterThan(0);
  });

  it('crew credits only count toward the job they were doing', () => {
    const editor = pool.Editor[0];
    const projects = [film(baseScript, [{ role: 'Editor', person: editor }])];
    expect(creditsFor(buildCreditIndex(projects), editor.id, 'Editor')).toHaveLength(1);
    expect(creditsFor(buildCreditIndex(projects), editor.id, 'Lead Actor')).toHaveLength(0);
  });
});

describe('the track record', () => {
  it('lists films newest first, marks your own, and says how they went', () => {
    const k = know([film(ACTION, [lead(actor)], { day: 500, outcome: 'Flop' }), film(COMEDY, [lead(actor)], { day: 900, rival: 'Rival', outcome: 'Blockbuster' })]);
    expect(k.trackRecord.map((r) => r.outcome)).toEqual(['Blockbuster', 'Flop']);
    expect(k.trackRecord.map((r) => r.own)).toEqual([false, true]);
    expect(k.trackRecord[1].outcomeTone).toBe('bad');
    expect(k.ownFilms).toBe(1);
  });
});

describe('rivals know the people they have used', () => {
  it('reads someone it has used by their real ability, without noise', () => {
    const candidates = pool.Actor.slice(0, 40);
    const fee = candidates[0].careers.actor!.typicalSalary;
    const best = [...candidates].sort((a, b) => knownAbility(b, 'Lead Actor') - knownAbility(a, 'Lead Actor'))[0];
    const used = new Set(candidates.map((p) => p.id));
    const a = chooseRivalHires(candidates, 'Lead Actor', fee, 1, createRng(1), used);
    const b = chooseRivalHires(candidates, 'Lead Actor', fee, 1, createRng(2), used);
    expect(a).toEqual(b);
    expect(knownAbility(best, 'Lead Actor')).toBeGreaterThan(0);
  });
});
