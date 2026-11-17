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
    expect(live(demandsOf(chamber)).length).toBeLessThanOrEqual(4);
    expect(days(chamber)).toBeLessThanOrEqual(42); // 04 §1: micro 3-5 weeks, indie 6-10
    expect(live(demandsOf(epic)).length).toBeGreaterThanOrEqual(6);
    expect(days(epic)).toBeGreaterThanOrEqual(120); // 04 §1: period / heavy build 4-9 months
  });

  it('demand rises with what the script asks for', () => {
    const d = (script: Script, front: string) => demandsOf(script).find((x) => x.front === front)!.demand;
    for (const front of ['design', 'costume', 'locations', 'action', 'breakdown']) expect(d(epic, front)).toBeGreaterThan(d(chamber, front));
    const unsound = { ...chamber, structure: 20, characters: 20 };
    expect(d(unsound, 'breakdown')).toBeGreaterThan(d(chamber, 'breakdown'));
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
  it('is the core plus the slowest chain', () => {
    const ds = demandsOf(epic);
    const slowest = Math.max(...ds.map((d) => (d.front === 'design' ? Math.max(frontChainDays('design', d.demand), 0) : frontChainDays(d.front, d.demand))));
    expect(recommendedPrepDays(ds, 0)).toBe(Math.round(PREP_CORE_DAYS + slowest)); // Medium: factor 1
    expect(recommendedPrepDays(ds, 0, undefined, 'Epic')).toBeGreaterThan(recommendedPrepDays(ds, 0, undefined, 'Medium'));
  });

  it('honours a granted design window, longer or shorter than the designer asked', () => {
    const ds = demandsOf(chamber);
    expect(recommendedPrepDays(ds, 20, 200)).toBe(PREP_CORE_DAYS + 200);
    expect(recommendedPrepDays(ds, 200)).toBeGreaterThanOrEqual(PREP_CORE_DAYS + 200);
  });

  it('lands generated films mostly in the reference ranges (median 8-12 weeks)', () => {
    const rng = createRng(11);
    const all: number[] = [];
    for (const genre of GENRES) for (let i = 0; i < 25; i++) all.push(days(generateScriptOptions(genre, rng, 1)[0]));
    all.sort((a, b) => a - b);
    const median = all[Math.floor(all.length / 2)];
    expect(median).toBeGreaterThanOrEqual(56);
    expect(median).toBeLessThanOrEqual(90);
    expect(all[0]).toBeGreaterThanOrEqual(PREP_CORE_DAYS);
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
