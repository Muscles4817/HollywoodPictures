// The breakdown: what a film demands of its prep
// (docs/IMPLEMENTATION_PLAN_preproduction_realism.md Phase 2).
import { describe, expect, it } from 'vitest';
import { buildReadyDraft } from '../../state/testFixtures';
import { createRng, withRng } from '../random';
import { generateScriptOptions } from '../scriptGenerator';
import { derivePrepDemands, designAskDays, directorDecisiveness, frontChainDays, prepOutlook, recommendedPrepDays, type FrontDemand } from './demands';
import { PREP_CORE_DAYS, PREP_FRONTS } from '../../data/prep';
import { GENRES } from '../../data/genres';
import type { Script, ScriptCharacter } from '../../types';

const draft = withRng(1, (r) => buildReadyDraft(r)).result;
const base = draft.script!;

/** A one-room, two-person drama with nothing physical in it. */
const chamber: Script = {
  ...base,
  genre: 'Drama',
  scale: 'Intimate',
  primarySetting: 'SingleInteriorLocation',
  structure: 80,
  characters: 80,
  environmentStrategy: { studio: 0, location: 1, digital: 0 },
  toneProfile: { ...base.toneProfile, action: 5, spectacle: 5, suspense: 20 },
  productionRequirements: { extras: 0, locations: 0.05, periodSetting: false, vehicles: false, animals: false, practicalEffects: 0, vfx: 0, stunts: 0, choreography: 0, crowdWork: 0 },
  cast: base.cast.slice(0, 2).map((c): ScriptCharacter => ({ ...c, traits: { ...c.traits, physicalDemand: 5, transformationDemand: 5 } })),
};

/** A period war epic: battles, crowds, builds, a big cast. */
const epic: Script = {
  ...base,
  genre: 'Action',
  scale: 'Epic',
  primarySetting: 'HistoricalBattlefield',
  environmentStrategy: { studio: 0.5, location: 0.5, digital: 0 },
  productionRequirements: { extras: 1, locations: 0.9, periodSetting: true, vehicles: true, animals: true, practicalEffects: 1, vfx: 0.8, stunts: 1, choreography: 0.3, crowdWork: 1 },
  cast: Array.from({ length: 30 }, (_, i): ScriptCharacter => ({ ...base.cast[i % base.cast.length], name: `Part ${i}`, traits: { ...base.cast[i % base.cast.length].traits, physicalDemand: 90, transformationDemand: 70 } })),
};

const demandsOf = (script: Script) => derivePrepDemands({ script, talent: draft.talent, choices: draft.productionChoices! });
const live = (ds: FrontDemand[]) => ds.filter((d) => frontChainDays(d.front, d.demand) > 0).map((d) => d.front);
const days = (script: Script) => recommendedPrepDays(demandsOf(script), designAskDays(script, draft.talent), undefined, script.scale);

describe('derivePrepDemands', () => {
  it('returns every front, in order, each between 0 and 1', () => {
    const ds = demandsOf(base);
    expect(ds.map((d) => d.front)).toEqual([...PREP_FRONTS]);
    for (const d of ds) {
      expect(d.demand).toBeGreaterThanOrEqual(0);
      expect(d.demand).toBeLessThanOrEqual(1);
    }
  });

  it('a chamber drama has few live fronts and a short prep; a period war epic has nearly all and months', () => {
    expect(live(demandsOf(chamber)).length).toBeLessThanOrEqual(3);
    expect(days(chamber)).toBeLessThanOrEqual(35); // 04 §1: micro 3-5 weeks
    expect(live(demandsOf(epic)).length).toBeGreaterThanOrEqual(7);
    expect(days(epic)).toBeGreaterThanOrEqual(120); // 04 §1: period / heavy build 4-9 months
  });

  it('demand rises with what the script asks for', () => {
    const d = (script: Script, front: string) => demandsOf(script).find((x) => x.front === front)!.demand;
    for (const front of ['design', 'costume', 'locations', 'action', 'breakdown']) expect(d(epic, front)).toBeGreaterThan(d(chamber, front));
    const unsound = { ...chamber, structure: 20, characters: 20 };
    expect(d(unsound, 'breakdown')).toBeGreaterThan(d(chamber, 'breakdown'));
  });

  it('each source raises its own front', () => {
    const d = (script: Script, front: string, talent = draft.talent) => derivePrepDemands({ script, talent, choices: draft.productionChoices! }).find((x) => x.front === front)!.demand;
    const bigCast = { ...chamber, cast: Array.from({ length: 20 }, (_, i) => ({ ...chamber.cast[0], name: `P${i}`, prominence: 'Minor' as const })) };
    expect(d(bigCast, 'casting')).toBeGreaterThan(d(chamber, 'casting'));
    const creature = { ...chamber, genre: 'Horror' as const, cast: [...chamber.cast, { ...chamber.cast[0], archetype: 'MonsterOrCreature' as const, traits: { ...chamber.cast[0].traits, transformationDemand: 95 } }] };
    expect(d(creature, 'costume')).toBeGreaterThan(d(chamber, 'costume'));
    const travelling = { ...chamber, primarySetting: 'HistoricalBattlefield' as const };
    expect(d(travelling, 'locations')).toBeGreaterThan(d(chamber, 'locations'));
    const stunts = { ...chamber, toneProfile: { ...chamber.toneProfile, action: 90 }, productionRequirements: { ...chamber.productionRequirements, stunts: 1 } };
    expect(d(stunts, 'action')).toBeGreaterThan(d(chamber, 'action'));
    const vfx = { ...chamber, productionRequirements: { ...chamber.productionRequirements, vfx: 1 }, toneProfile: { ...chamber.toneProfile, spectacle: 90 } };
    expect(d(vfx, 'effects')).toBeGreaterThan(d(chamber, 'effects'));
  });

  it("a character's arc alone does not put prosthetics on a drama", () => {
    const d = (script: Script) => demandsOf(script).find((x) => x.front === 'costume')!.demand;
    const arc = { ...chamber, cast: chamber.cast.map((c) => ({ ...c, traits: { ...c.traits, transformationDemand: 90 } })) };
    expect(d(arc)).toBe(d(chamber));
  });

  it('a decisive director lowers the visual front', () => {
    const director = draft.talent.find((a) => a.role === 'Director')!;
    const decisive = { ...director, person: { ...director.person, personality: { ...director.person.personality, professionalism: 95, pressureHandling: 95 } } };
    const dithering = { ...director, person: { ...director.person, personality: { ...director.person.personality, professionalism: 10, pressureHandling: 10 } } };
    const visual = (talent: typeof draft.talent) => derivePrepDemands({ script: base, talent, choices: draft.productionChoices! }).find((x) => x.front === 'visual')!.demand;
    expect(directorDecisiveness(decisive.person)).toBeGreaterThan(directorDecisiveness(dithering.person));
    expect(visual([decisive, ...draft.talent.slice(1)])).toBeLessThan(visual([dithering, ...draft.talent.slice(1)]));
  });
});

describe('recommendedPrepDays', () => {
  it('runs as long as its slowest department: only the slowest chain moves it', () => {
    const ds = demandsOf(epic);
    const ranked = [...ds].sort((a, b) => frontChainDays(b.front, b.demand) - frontChainDays(a.front, a.demand));
    const bump = (front: string, by: number) => ds.map((d) => (d.front === front ? { ...d, demand: Math.min(1, d.demand + by) } : d));
    const lowered = ds.map((d) => (d.front === ranked[1].front ? { ...d, demand: 0 } : d));
    expect(recommendedPrepDays(lowered, 0)).toBe(recommendedPrepDays(ds, 0));
    const slowestDown = ds.map((d) => (d.front === ranked[0].front ? { ...d, demand: d.demand * 0.5 } : d));
    expect(recommendedPrepDays(slowestDown, 0)).toBeLessThan(recommendedPrepDays(ds, 0));
    void bump;
    expect(recommendedPrepDays(ds, 0)).toBeGreaterThan(PREP_CORE_DAYS);
    expect(recommendedPrepDays(ds, 0, undefined, 'Epic')).toBeGreaterThan(recommendedPrepDays(ds, 0, undefined, 'Medium'));
  });

  it('reads a granted design window as a share of the designer\'s ask', () => {
    // A film whose design chain is its slowest, so the window shows.
    const ds = demandsOf(epic).map((d) => (d.front === 'design' ? { ...d, demand: 1 } : { ...d, demand: Math.min(d.demand, 0.3) }));
    const asked = recommendedPrepDays(ds, 20);
    expect(recommendedPrepDays(ds, 20, 20)).toBe(asked); // granting the ask changes nothing
    expect(recommendedPrepDays(ds, 20, 10)).toBeLessThan(asked); // a rushed window shortens the chain
    expect(recommendedPrepDays(ds, 20, 40)).toBeGreaterThan(asked);
  });

  it('lands generated films in the reference ranges by scale (04 §1)', () => {
    const rng = createRng(11);
    const byScale: Record<string, number[]> = {};
    for (const genre of GENRES) for (const s of generateScriptOptions(genre, rng, 30)) (byScale[s.scale] ??= []).push(days(s));
    const median = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)] / 7;
    // indie 6-10 weeks; studio mid-budget 8-12 weeks; tentpole 4-12 months.
    expect(median(byScale.Intimate)).toBeGreaterThanOrEqual(5);
    expect(median(byScale.Intimate)).toBeLessThanOrEqual(10);
    expect(median(byScale.Medium)).toBeGreaterThanOrEqual(8);
    expect(median(byScale.Medium)).toBeLessThanOrEqual(13);
    expect(median(byScale.Epic)).toBeGreaterThanOrEqual(17);
    for (const v of Object.values(byScale)) expect(Math.min(...v)).toBeGreaterThanOrEqual(PREP_CORE_DAYS * 0.85);
  });
});

describe('prepOutlook', () => {
  it('lists live fronts heaviest first, in words, never numbers', () => {
    const outlook = prepOutlook(demandsOf(epic));
    expect(outlook.length).toBeGreaterThan(3);
    for (const line of outlook) expect(line.line).not.toMatch(/\d/);
    const order = { heavy: 2, moderate: 1, light: 0 };
    for (let i = 1; i < outlook.length; i++) expect(order[outlook[i].weight]).toBeLessThanOrEqual(order[outlook[i - 1].weight]);
  });
});
