// Workstream II, Phase B — the narrative requirement profile (Layer 1).
// The load-bearing property is SEPARATION: the six mid-grained archetypes named
// in the design (grounded drama · period drama · action · creature horror ·
// effects-heavy sci-fi · large-scale war) must yield recognisably different
// profiles, since the whole point is that "two scripts, identical effects
// ambition, entirely different ideal personnel" falls out of the requirements,
// not the genre label.
import { describe, it, expect } from 'vitest';
import {
  deriveRequirementProfile,
  requirementsInCategory,
  categoryPressure,
  summarizeRequirementProfile,
  REQUIREMENT_PRESENCE_FLOOR,
  type RequirementLeafKey,
  type RequirementProfile,
} from './requirementProfile';
import type {
  Script,
  ScriptCharacter,
  CharacterArchetype,
  ProductionRequirements,
  ToneProfile,
} from '../types';

// --- Minimal, fully-controlled fixtures -----------------------------------
// Hand-built so the test pins the DERIVATION, not the script generator's rolls.
const FLAT_TONE: ToneProfile = { action: 30, comedy: 30, romance: 30, suspense: 30, drama: 30, spectacle: 30 };
const FLAT_REQ: ProductionRequirements = {
  extras: 0, locations: 0.2, periodSetting: false, vehicles: false, animals: false,
  practicalEffects: 0, vfx: 0, stunts: 0, choreography: 0, crowdWork: 0,
};

function char(name: string, archetype: CharacterArchetype, physical = 20, transform = 20): ScriptCharacter {
  return {
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    archetype,
    prominence: 'Lead',
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
    environmentStrategy: { studio: 0.34, location: 0.33, digital: 0.33 },
    environmentAmbition: 0.4,
    effectsStrategy: { practical: 0.5, digital: 0.5 },
    effectsAmbition: 0.4,
    productionRequirements: FLAT_REQ,
    synopsis: 'x', requiredLeads: 1, requiredSupporting: 0, intendedAudience: 'Mass Market',
    cast: [char('Lead', 'ReluctantHero')],
    ...overrides,
  };
}

// Representative scripts for the six archetypes.
const groundedDrama = makeScript({
  genre: 'Drama', archetype: 'Prestige', storyType: 'Original', primarySetting: 'ContemporaryCity', scale: 'Intimate',
  complexity: 35, toneProfile: { ...FLAT_TONE, drama: 85, action: 10, spectacle: 10 },
  productionRequirements: { ...FLAT_REQ, locations: 0.35, extras: 0.1 },
});

const periodDrama = makeScript({
  genre: 'Drama', archetype: 'Prestige', storyType: 'Biography', primarySetting: 'HistoricalCity', scale: 'Medium',
  complexity: 55, toneProfile: { ...FLAT_TONE, drama: 80, spectacle: 30 },
  productionRequirements: { ...FLAT_REQ, periodSetting: true, locations: 0.4, extras: 0.35, crowdWork: 0.1 },
  cast: [char('Statesman', 'AuthorityFigure', 20, 45)],
});

const actionFilm = makeScript({
  genre: 'Action', archetype: 'CrowdPleaser', storyType: 'Original', primarySetting: 'ContemporaryCity', scale: 'Medium',
  complexity: 65, toneProfile: { ...FLAT_TONE, action: 90, spectacle: 70 },
  effectsStrategy: { practical: 0.6, digital: 0.4 },
  productionRequirements: { ...FLAT_REQ, stunts: 0.85, vehicles: true, practicalEffects: 0.6, vfx: 0.4, extras: 0.3 },
  cast: [char('Operative', 'Antihero', 90, 20)],
});

const creatureHorror = makeScript({
  genre: 'Horror', archetype: 'GenreFormula', storyType: 'Original', primarySetting: 'RuralWilderness', scale: 'Medium',
  complexity: 55, toneProfile: { ...FLAT_TONE, suspense: 85, spectacle: 45 },
  effectsStrategy: { practical: 0.8, digital: 0.2 }, // suits & animatronics, not CG
  productionRequirements: { ...FLAT_REQ, practicalEffects: 0.7, vfx: 0.3, stunts: 0.4, locations: 0.4 },
  cast: [char('Final Girl', 'Survivor', 55, 30), char('The Thing', 'MonsterOrCreature', 60, 80)],
});

const sciFi = makeScript({
  genre: 'Sci-Fi', archetype: 'Spectacle', storyType: 'Original', primarySetting: 'SpacecraftOrStation', scale: 'Epic',
  complexity: 85, toneProfile: { ...FLAT_TONE, spectacle: 90, action: 60, suspense: 60 },
  effectsStrategy: { practical: 0.25, digital: 0.75 }, // digital-first
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

const keys = (p: RequirementProfile): RequirementLeafKey[] => p.map((l) => l.key);
const has = (p: RequirementProfile, k: RequirementLeafKey) => keys(p).includes(k);

describe('deriveRequirementProfile — invariants', () => {
  it('returns only present leaves, all above the floor, most critical first', () => {
    const p = deriveRequirementProfile(warFilm);
    expect(p.length).toBeGreaterThan(0);
    for (const leaf of p) {
      expect(leaf.magnitude).toBeGreaterThanOrEqual(REQUIREMENT_PRESENCE_FLOOR);
      for (const v of [leaf.magnitude, leaf.frequency, leaf.complexity, leaf.criticality]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
    // sorted by criticality descending
    for (let i = 1; i < p.length; i++) {
      expect(p[i - 1].criticality).toBeGreaterThanOrEqual(p[i].criticality - 1e-9);
    }
  });

  it('a bare, contained drama produces a short profile (no action/digital/transformation)', () => {
    const p = deriveRequirementProfile(groundedDrama);
    expect(requirementsInCategory(p, 'action')).toHaveLength(0);
    expect(requirementsInCategory(p, 'digital')).toHaveLength(0);
    expect(requirementsInCategory(p, 'transformation')).toHaveLength(0);
    expect(has(p, 'creatureEmbodiment')).toBe(false);
    expect(has(p, 'periodArchitecture')).toBe(false);
    // it is short relative to a war epic
    expect(p.length).toBeLessThan(deriveRequirementProfile(warFilm).length);
  });
});

describe('archetype fingerprints — the six separate', () => {
  it('period drama carries period build + costume, not action or heavy digital', () => {
    const p = deriveRequirementProfile(periodDrama);
    expect(has(p, 'periodArchitecture')).toBe(true);
    expect(has(p, 'periodCostume')).toBe(true);
    expect(requirementsInCategory(p, 'action')).toHaveLength(0);
    expect(has(p, 'digitalEnvironments')).toBe(false);
  });

  it('action carries combat + vehicles + practical destruction, little transformation', () => {
    const p = deriveRequirementProfile(actionFilm);
    expect(has(p, 'combatStunts')).toBe(true);
    expect(has(p, 'vehicleAction')).toBe(true);
    expect(has(p, 'practicalDestruction')).toBe(true);
    expect(has(p, 'periodCostume')).toBe(false);
  });

  it('creature horror routes the creature to PRACTICAL embodiment, not CG animation', () => {
    const p = deriveRequirementProfile(creatureHorror);
    expect(has(p, 'creatureEmbodiment')).toBe(true);
    expect(has(p, 'prostheticsMakeup')).toBe(true);
    expect(has(p, 'creatureAnimation')).toBe(false); // practical-leaning strategy
    expect(categoryPressure(p, 'transformation')).toBeGreaterThan(categoryPressure(p, 'digital'));
  });

  it('effects-heavy sci-fi routes to DIGITAL environments/compositing, not practical creatures', () => {
    const p = deriveRequirementProfile(sciFi);
    expect(has(p, 'digitalEnvironments')).toBe(true);
    expect(has(p, 'compositingVfx')).toBe(true);
    expect(has(p, 'creatureEmbodiment')).toBe(false);
    expect(categoryPressure(p, 'digital')).toBeGreaterThan(categoryPressure(p, 'action'));
  });

  it('war film is logistics-dominant: crowds + extras + vehicles + destruction', () => {
    const p = deriveRequirementProfile(warFilm);
    expect(has(p, 'crowdWork')).toBe(true);
    expect(has(p, 'extras')).toBe(true);
    expect(has(p, 'vehicleAction')).toBe(true);
    expect(has(p, 'practicalDestruction')).toBe(true);
    expect(categoryPressure(p, 'logistics')).toBeGreaterThan(categoryPressure(p, 'digital'));
  });

  it('the same creature routes to different departments purely by execution strategy', () => {
    // Identical script except the practical/digital lean — the design's crux.
    const practical = makeScript({
      ...creatureHorror, effectsStrategy: { practical: 0.85, digital: 0.15 },
    });
    const digital = makeScript({
      ...creatureHorror, effectsStrategy: { practical: 0.15, digital: 0.85 },
    });
    const pp = deriveRequirementProfile(practical);
    const dp = deriveRequirementProfile(digital);
    expect(has(pp, 'creatureEmbodiment')).toBe(true);
    expect(has(dp, 'creatureAnimation')).toBe(true);
    // and they flip
    expect(has(pp, 'creatureAnimation')).toBe(false);
    expect(has(dp, 'creatureEmbodiment')).toBe(false);
  });

  it('every archetype yields a distinct present-leaf signature', () => {
    const sigs = [groundedDrama, periodDrama, actionFilm, creatureHorror, sciFi, warFilm]
      .map((s) => keys(deriveRequirementProfile(s)).slice().sort().join(','));
    expect(new Set(sigs).size).toBe(sigs.length);
  });
});

describe('summarizeRequirementProfile — dev read', () => {
  it('summarises a profile and handles the empty case', () => {
    expect(summarizeRequirementProfile([])).toMatch(/No significant/);
    const text = summarizeRequirementProfile(deriveRequirementProfile(warFilm));
    expect(text).toMatch(/Logistical Scale/);
    expect(text).toMatch(/mag \d+/);
  });
});
