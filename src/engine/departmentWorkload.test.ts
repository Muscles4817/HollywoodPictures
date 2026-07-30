// Workstream II, Phase B — Layer 3, Department Workload. The load-bearing
// property: the SAME effects ambition loads DIFFERENT departments depending on
// how the film realises its requirements. A practical creature loads Stunts +
// Production Design; a CG creature loads VFX — that routing is what makes "two
// scripts, identical ambition, entirely different ideal crew" fall out.
import { describe, it, expect } from 'vitest';
import {
  deriveDepartmentWorkloadsForScript,
  workloadFor,
  summarizeDepartmentWorkloads,
  DEPARTMENT_WORKLOAD_FLOOR,
  type DepartmentId,
  type DepartmentWorkload,
} from './departmentWorkload';
import { deriveRequirementProfile } from './requirementProfile';
import type {
  Script,
  ScriptCharacter,
  CharacterArchetype,
  ProductionRequirements,
  ToneProfile,
} from '../types';

// Same minimal, fully-controlled fixtures as the Layer 1 tests.
const FLAT_TONE: ToneProfile = { action: 30, comedy: 30, romance: 30, suspense: 30, drama: 30, spectacle: 30 };
const FLAT_REQ: ProductionRequirements = {
  extras: 0, locations: 0.2, periodSetting: false, vehicles: false, animals: false,
  practicalEffects: 0, vfx: 0, stunts: 0, choreography: 0, crowdWork: 0,
};

function char(name: string, archetype: CharacterArchetype, physical = 20, transform = 20): ScriptCharacter {
  return {
    id: name.toLowerCase().replace(/\s+/g, '-'), name, archetype, prominence: 'Lead',
    traits: {
      dramaticDepth: 50, charismaDemand: 50, comedyDemand: 30, emotionalDemand: 50,
      physicalDemand: physical, transformationDemand: transform,
      audienceAccessibility: 50, distinctiveness: 50, merchandisePotential: 30,
    },
  };
}

function makeScript(overrides: Partial<Script>): Script {
  return {
    id: 'fx', title: 'Fixture', genre: 'Drama', archetype: 'Prestige', storyType: 'Original',
    primarySetting: 'ContemporaryCity', scale: 'Medium',
    originality: 60, hook: 50, emotionalPremise: 50, franchisePotential: 50, structure: 60, characters: 60, dialogue: 60, complexity: 50, cost: 10_000_000,
    toneProfile: FLAT_TONE,
    environmentStrategy: { studio: 0.34, location: 0.33, digital: 0.33 }, environmentAmbition: 0.4,
    effectsStrategy: { practical: 0.5, digital: 0.5 }, effectsAmbition: 0.4,
    productionRequirements: FLAT_REQ,
    synopsis: 'x', requiredLeads: 1, requiredSupporting: 0, intendedAudience: 'Mass Market',
    cast: [char('Lead', 'ReluctantHero')],
    ...overrides,
  };
}

const groundedDrama = makeScript({
  genre: 'Drama', storyType: 'Original', primarySetting: 'SingleInteriorLocation', scale: 'Intimate',
  complexity: 30, toneProfile: { ...FLAT_TONE, drama: 85, action: 10, spectacle: 10 },
});

const periodDrama = makeScript({
  genre: 'Drama', storyType: 'Biography', primarySetting: 'HistoricalCity', scale: 'Medium',
  toneProfile: { ...FLAT_TONE, drama: 80, spectacle: 30 },
  productionRequirements: { ...FLAT_REQ, periodSetting: true, locations: 0.4, extras: 0.35 },
});

const actionFilm = makeScript({
  genre: 'Action', archetype: 'CrowdPleaser', primarySetting: 'ContemporaryCity', scale: 'Medium',
  complexity: 65, toneProfile: { ...FLAT_TONE, action: 90, spectacle: 70 },
  effectsStrategy: { practical: 0.6, digital: 0.4 },
  productionRequirements: { ...FLAT_REQ, stunts: 0.85, vehicles: true, practicalEffects: 0.6, vfx: 0.4, extras: 0.3 },
  cast: [char('Operative', 'Antihero', 90, 20)],
});

const sciFi = makeScript({
  genre: 'Sci-Fi', archetype: 'Spectacle', primarySetting: 'SpacecraftOrStation', scale: 'Epic',
  complexity: 85, toneProfile: { ...FLAT_TONE, spectacle: 90, action: 60, suspense: 60 },
  effectsStrategy: { practical: 0.25, digital: 0.75 },
  environmentStrategy: { studio: 0.4, location: 0.1, digital: 0.5 },
  productionRequirements: { ...FLAT_REQ, vfx: 0.9, stunts: 0.5, practicalEffects: 0.3, extras: 0.3 },
  cast: [char('Commander', 'ReluctantHero', 70, 20)],
});

const warFilm = makeScript({
  genre: 'Drama', archetype: 'Spectacle', storyType: 'War', primarySetting: 'HistoricalBattlefield', scale: 'Epic',
  complexity: 80, toneProfile: { ...FLAT_TONE, drama: 70, action: 75, spectacle: 80 },
  effectsStrategy: { practical: 0.6, digital: 0.4 },
  productionRequirements: {
    ...FLAT_REQ, periodSetting: true, vehicles: true, crowdWork: 0.8, extras: 0.7,
    practicalEffects: 0.65, stunts: 0.6, locations: 0.55, vfx: 0.4,
  },
  cast: [char('Sergeant', 'ReluctantHero', 65, 25)],
});

// A creature written once, realised two ways — identical but for the lean.
const creatureBase = makeScript({
  genre: 'Horror', storyType: 'Original', primarySetting: 'RuralWilderness', scale: 'Medium',
  complexity: 55, toneProfile: { ...FLAT_TONE, suspense: 85, spectacle: 45 },
  productionRequirements: { ...FLAT_REQ, practicalEffects: 0.7, vfx: 0.6, stunts: 0.4, locations: 0.4 },
  cast: [char('Final Girl', 'Survivor', 55, 30), char('The Thing', 'MonsterOrCreature', 60, 80)],
});
const practicalCreature = makeScript({ ...creatureBase, effectsStrategy: { practical: 0.85, digital: 0.15 } });
const digitalCreature = makeScript({ ...creatureBase, effectsStrategy: { practical: 0.15, digital: 0.85 } });

const byId = (ws: DepartmentWorkload[]) => new Map<DepartmentId, DepartmentWorkload>(ws.map((w) => [w.department, w]));
const mag = (ws: DepartmentWorkload[], id: DepartmentId) => byId(ws).get(id)?.magnitude ?? 0;

describe('deriveDepartmentWorkloads — invariants', () => {
  it('reports only loaded departments, most-loaded first, all scalars in [0,1]', () => {
    const ws = deriveDepartmentWorkloadsForScript(warFilm);
    expect(ws.length).toBeGreaterThan(0);
    for (const w of ws) {
      for (const v of [w.magnitude, w.complexity, w.criticality]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
      expect(w.contributions.length).toBeGreaterThan(0);
    }
    for (let i = 1; i < ws.length; i++) {
      expect(ws[i - 1].magnitude).toBeGreaterThanOrEqual(ws[i].magnitude - 1e-9);
    }
  });

  it('a contained drama barely loads any modelled department', () => {
    const ws = deriveDepartmentWorkloadsForScript(groundedDrama);
    // No stunts/VFX at all; at most a small Production Design load from location dressing.
    expect(mag(ws, 'stunts')).toBe(0);
    expect(mag(ws, 'vfx')).toBe(0);
    expect(mag(ws, 'productionDesign')).toBeLessThan(0.4);
  });

  it('contributions never fall below the floor once a department is reported', () => {
    const ws = deriveDepartmentWorkloadsForScript(actionFilm);
    for (const w of ws) {
      const rawLoad = w.contributions.reduce((s, c) => s + c.load, 0);
      expect(rawLoad).toBeGreaterThanOrEqual(DEPARTMENT_WORKLOAD_FLOOR);
    }
  });
});

describe('routing — the right department carries the film', () => {
  it('period drama loads Production Design above VFX and Stunts', () => {
    const ws = deriveDepartmentWorkloadsForScript(periodDrama);
    expect(mag(ws, 'productionDesign')).toBeGreaterThan(mag(ws, 'vfx'));
    expect(mag(ws, 'productionDesign')).toBeGreaterThan(mag(ws, 'stunts'));
  });

  it('an action film loads Stunts above VFX', () => {
    const ws = deriveDepartmentWorkloadsForScript(actionFilm);
    expect(mag(ws, 'stunts')).toBeGreaterThan(mag(ws, 'vfx'));
    expect(byId(ws).get('stunts')!.dominantRequirements).toContain('Combat & stunts');
  });

  it('effects-heavy sci-fi loads VFX above Stunts and Production Design', () => {
    const ws = deriveDepartmentWorkloadsForScript(sciFi);
    expect(mag(ws, 'vfx')).toBeGreaterThan(mag(ws, 'stunts'));
    expect(mag(ws, 'vfx')).toBeGreaterThan(mag(ws, 'productionDesign'));
  });

  it('a war epic loads all three departments heavily', () => {
    const ws = deriveDepartmentWorkloadsForScript(warFilm);
    expect(mag(ws, 'stunts')).toBeGreaterThan(0.4);
    expect(mag(ws, 'productionDesign')).toBeGreaterThan(0.3);
    expect(mag(ws, 'vfx')).toBeGreaterThan(0.1);
  });
});

describe('the crux — same creature, different departments by approach', () => {
  it('a practical creature loads Stunts + Production Design, not VFX; a CG creature loads VFX', () => {
    const practical = deriveDepartmentWorkloadsForScript(practicalCreature);
    const digital = deriveDepartmentWorkloadsForScript(digitalCreature);

    // The creature's own routed work: embodiment (Stunts/PD) vs animation (VFX).
    const practicalProfile = deriveRequirementProfile(practicalCreature);
    const digitalProfile = deriveRequirementProfile(digitalCreature);
    expect(workloadFor(practicalProfile, 'stunts')!.dominantRequirements).toContain('Practical creature');
    expect(workloadFor(digitalProfile, 'vfx')!.dominantRequirements).toContain('CG creatures');

    // VFX load is markedly higher for the digital realisation; Stunts markedly
    // higher for the practical one — same script but for the lean.
    expect(mag(digital, 'vfx')).toBeGreaterThan(mag(practical, 'vfx'));
    expect(mag(practical, 'stunts')).toBeGreaterThan(mag(digital, 'stunts'));
  });
});

describe('summarizeDepartmentWorkloads — dev read', () => {
  it('summarises loaded departments and handles the empty case', () => {
    expect(summarizeDepartmentWorkloads([])).toMatch(/No modelled department/);
    const text = summarizeDepartmentWorkloads(deriveDepartmentWorkloadsForScript(warFilm));
    expect(text).toMatch(/Stunts & Practical|Production Design|Visual Effects/);
    expect(text).toMatch(/load \d+%/);
  });
});
