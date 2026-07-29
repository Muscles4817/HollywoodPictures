// Workstream II, Phase B — Layer 2, Execution Strategy. The load-bearing
// property: a PRODUCER CHOICE (not the script's lean) decides how a requirement
// is realised, and that choice re-routes the requirement to different
// departments. Choosing an animatronic vs a fully-CG creature moves the same
// written creature between the practical shop and the VFX house.
import { describe, it, expect } from 'vitest';
import {
  deriveDefaultStrategy,
  relevantStrategyAxes,
  strategyRoutes,
  type ExecutionStrategy,
} from './executionStrategy';
import { deriveRequirementProfile, type RequirementLeafKey, type RequirementProfile } from './requirementProfile';
import { deriveDepartmentWorkloadsForScript, type DepartmentId } from './departmentWorkload';
import type {
  Script, ScriptCharacter, CharacterArchetype, ProductionRequirements, ToneProfile,
} from '../types';

const FLAT_TONE: ToneProfile = { action: 30, comedy: 30, romance: 30, suspense: 30, drama: 30, spectacle: 30 };
const FLAT_REQ: ProductionRequirements = {
  extras: 0, locations: 0.2, periodSetting: false, vehicles: false, animals: false,
  practicalEffects: 0, vfx: 0, stunts: 0, choreography: 0, crowdWork: 0,
};
function char(name: string, archetype: CharacterArchetype, physical = 20, transform = 20): ScriptCharacter {
  return {
    id: name.toLowerCase(), name, archetype, prominence: 'Lead',
    traits: {
      dramaticDepth: 50, charismaDemand: 50, comedyDemand: 30, emotionalDemand: 50,
      physicalDemand: physical, transformationDemand: transform,
      audienceAccessibility: 50, distinctiveness: 50, merchandisePotential: 30,
    },
  };
}
function makeScript(over: Partial<Script>): Script {
  return {
    id: 'fx', title: 'Fixture', genre: 'Horror', archetype: 'GenreFormula', storyType: 'Original',
    primarySetting: 'RuralWilderness', scale: 'Medium',
    originality: 60, structure: 60, characters: 60, dialogue: 60, complexity: 55, cost: 10_000_000,
    toneProfile: { ...FLAT_TONE, suspense: 85, spectacle: 45 },
    environmentStrategy: { studio: 0.34, location: 0.33, digital: 0.33 }, environmentAmbition: 0.4,
    effectsStrategy: { practical: 0.5, digital: 0.5 }, effectsAmbition: 0.5,
    productionRequirements: { ...FLAT_REQ, practicalEffects: 0.7, vfx: 0.6, stunts: 0.4, locations: 0.4 },
    synopsis: 'x', requiredLeads: 1, requiredSupporting: 0, intendedAudience: 'Mass Market',
    cast: [char('Final Girl', 'Survivor', 55, 30), char('The Thing', 'MonsterOrCreature', 60, 80)],
    ...over,
  };
}
const creatureScript = makeScript({});

const keys = (p: RequirementProfile): RequirementLeafKey[] => p.map((l) => l.key);
const has = (p: RequirementProfile, k: RequirementLeafKey) => keys(p).includes(k);
const wl = (script: Script, s: ExecutionStrategy, d: DepartmentId) =>
  deriveDepartmentWorkloadsForScript(script, s).find((w) => w.department === d)?.magnitude ?? 0;

describe('deriveDefaultStrategy — closest method to the script lean', () => {
  it('reads a digital-leaning script as CG methods and a practical one as practical methods', () => {
    const digital = deriveDefaultStrategy(makeScript({
      effectsStrategy: { practical: 0.1, digital: 0.9 }, environmentStrategy: { studio: 0.2, location: 0.1, digital: 0.7 },
    }));
    expect(digital.creatureMethod).toBe('fullyCG');
    expect(digital.environmentMethod).toBe('fullyDigital');

    const practical = deriveDefaultStrategy(makeScript({
      effectsStrategy: { practical: 0.9, digital: 0.1 }, environmentStrategy: { studio: 0.2, location: 0.7, digital: 0.1 },
    }));
    expect(practical.creatureMethod).toBe('animatronic');
    expect(practical.environmentMethod).toBe('location');
  });
});

describe('relevantStrategyAxes — only offer decisions the film contains', () => {
  it('exposes the creature axis only when a creature is written', () => {
    expect(relevantStrategyAxes(creatureScript)).toContain('creatureMethod');
    const noCreature = makeScript({ cast: [char('Detective', 'Detective')] });
    expect(relevantStrategyAxes(noCreature)).not.toContain('creatureMethod');
    expect(relevantStrategyAxes(noCreature)).toContain('environmentMethod');
  });
});

describe('strategyRoutes — a method commits the routing', () => {
  it('routes an animatronic creature practical, a fully-CG one digital, and a hybrid both', () => {
    const ani = strategyRoutes({ creatureMethod: 'animatronic', environmentMethod: 'studioBuild' });
    expect(ani.practicalRoute).toBeGreaterThan(0.8);
    expect(ani.digitalRoute).toBe(0);

    const cg = strategyRoutes({ creatureMethod: 'fullyCG', environmentMethod: 'studioBuild' });
    expect(cg.digitalRoute).toBeGreaterThan(0.8);
    expect(cg.practicalRoute).toBe(0);

    const hybrid = strategyRoutes({ creatureMethod: 'hybrid', environmentMethod: 'studioBuild' });
    expect(hybrid.practicalRoute).toBeGreaterThan(0.4);
    expect(hybrid.digitalRoute).toBeGreaterThan(0.4);
  });
});

describe('the crux — a producer choice re-routes the same written creature', () => {
  const animatronic: ExecutionStrategy = { creatureMethod: 'animatronic', environmentMethod: 'studioBuild' };
  const fullyCG: ExecutionStrategy = { creatureMethod: 'fullyCG', environmentMethod: 'studioBuild' };

  it('animatronic yields a practical creature; fully-CG yields a digital one — same script', () => {
    const ani = deriveRequirementProfile(creatureScript, animatronic);
    const cg = deriveRequirementProfile(creatureScript, fullyCG);
    expect(has(ani, 'creatureEmbodiment')).toBe(true);
    expect(has(ani, 'creatureAnimation')).toBe(false);
    expect(has(cg, 'creatureAnimation')).toBe(true);
    expect(has(cg, 'creatureEmbodiment')).toBe(false);
  });

  it('the choice moves the workload between departments: CG loads VFX, animatronic loads Stunts', () => {
    const ani = { creatureMethod: 'animatronic', environmentMethod: 'studioBuild' } as const;
    const cg = { creatureMethod: 'fullyCG', environmentMethod: 'studioBuild' } as const;
    expect(wl(creatureScript, cg, 'vfx')).toBeGreaterThan(wl(creatureScript, ani, 'vfx'));
    expect(wl(creatureScript, ani, 'stunts')).toBeGreaterThan(wl(creatureScript, cg, 'stunts'));
  });

  it('environment method drives digital environments: fully-digital adds them, on-location does not', () => {
    const sciFi = makeScript({
      genre: 'Sci-Fi', primarySetting: 'FuturisticCity', scale: 'Epic',
      productionRequirements: { ...FLAT_REQ, vfx: 0.8 }, cast: [char('Lead', 'ReluctantHero')],
    });
    const digital = deriveRequirementProfile(sciFi, { creatureMethod: 'fullyCG', environmentMethod: 'fullyDigital' });
    const onLocation = deriveRequirementProfile(sciFi, { creatureMethod: 'fullyCG', environmentMethod: 'location' });
    expect(has(digital, 'digitalEnvironments')).toBe(true);
    expect(has(onLocation, 'digitalEnvironments')).toBe(false);
  });
});

describe('backward compatibility — no strategy reproduces lean-derived behaviour', () => {
  it('omitting the strategy is unchanged from before Layer 2', () => {
    // A practical-leaning creature script with no strategy still routes practical.
    const practicalLean = makeScript({ effectsStrategy: { practical: 0.85, digital: 0.15 } });
    const p = deriveRequirementProfile(practicalLean);
    expect(has(p, 'creatureEmbodiment')).toBe(true);
    expect(has(p, 'creatureAnimation')).toBe(false);
  });
});
