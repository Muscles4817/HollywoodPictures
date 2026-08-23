import { describe, it, expect } from 'vitest';
import { scriptShapedTraits, scriptShapedCast, type DemandContext } from './characterDemands';
import { describeCharacterDemands } from './scriptPresentation';
import { CHARACTER_ARCHETYPE_PROFILES } from '../data/characterArchetypes';
import { REFERENCE_SCRIPTS } from '../data/dev/referenceScripts';
import type { ProductionRequirements, ScriptCharacter, ToneProfile } from '../types';

const QUIET_TONE: ToneProfile = { action: 5, comedy: 10, romance: 2, suspense: 55, drama: 85, spectacle: 3 };
const LOUD_TONE: ToneProfile = { action: 85, comedy: 15, romance: 20, suspense: 70, drama: 40, spectacle: 85 };
const NEUTRAL_TONE: ToneProfile = { action: 50, comedy: 50, romance: 50, suspense: 50, drama: 50, spectacle: 50 };

const CONTAINED: ProductionRequirements = {
  extras: 0.05, locations: 0.05, periodSetting: false, vehicles: false, animals: false,
  practicalEffects: 0.05, vfx: 0.02, stunts: 0, choreography: 0, crowdWork: 0,
};
const STUNT_HEAVY: ProductionRequirements = { ...CONTAINED, stunts: 0.85, vehicles: true };

const jury: DemandContext = { toneProfile: QUIET_TONE, productionRequirements: CONTAINED };
const chase: DemandContext = { toneProfile: LOUD_TONE, productionRequirements: STUNT_HEAVY };

const hero = CHARACTER_ARCHETYPE_PROFILES.IdealisticHero.baseTraits;

describe('scriptShapedTraits', () => {
  it('strips physical demand out of a role in a talking, contained film', () => {
    expect(scriptShapedTraits(hero, jury).physicalDemand).toBeLessThan(hero.physicalDemand / 2);
  });

  it('raises physical demand for the same archetype in an action film', () => {
    expect(scriptShapedTraits(hero, chase).physicalDemand).toBeGreaterThan(hero.physicalDemand);
  });

  it('leaves a middling script exactly on the archetype row - the archetype is still the starting point', () => {
    const neutral: DemandContext = {
      toneProfile: NEUTRAL_TONE,
      productionRequirements: { ...CONTAINED, stunts: 0.5, choreography: 0.5 },
    };
    const shaped = scriptShapedTraits(hero, neutral);
    expect(shaped.physicalDemand).toBe(hero.physicalDemand);
    expect(shaped.comedyDemand).toBe(hero.comedyDemand);
    expect(shaped.emotionalDemand).toBe(hero.emotionalDemand);
  });

  it('leans on emotional performance in a heavy drama and comic timing only in a comedy', () => {
    expect(scriptShapedTraits(hero, jury).emotionalDemand).toBeGreaterThan(hero.emotionalDemand);
    expect(scriptShapedTraits(hero, jury).comedyDemand).toBeLessThan(hero.comedyDemand);
    const farce: DemandContext = { toneProfile: { ...QUIET_TONE, comedy: 90 }, productionRequirements: CONTAINED };
    expect(scriptShapedTraits(hero, farce).comedyDemand).toBeGreaterThan(hero.comedyDemand);
  });

  it('never touches charisma or transformation - screen presence and distance-from-self are the archetype\'s own', () => {
    for (const context of [jury, chase]) {
      expect(scriptShapedTraits(hero, context).charismaDemand).toBe(hero.charismaDemand);
      expect(scriptShapedTraits(hero, context).transformationDemand).toBe(hero.transformationDemand);
    }
  });

  it('keeps every demand inside the 1-100 range at both extremes', () => {
    const maxed = { ...hero, physicalDemand: 100, comedyDemand: 100, emotionalDemand: 100 };
    const shaped = scriptShapedTraits(maxed, chase);
    for (const value of [shaped.physicalDemand, shaped.comedyDemand, shaped.emotionalDemand]) {
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(100);
    }
  });
});

describe('scriptShapedCast', () => {
  it('re-reads every role and preserves everything about them except their demands', () => {
    const cast: ScriptCharacter[] = [
      { id: 'c0', name: 'Juror 8', archetype: 'IdealisticHero', prominence: 'Lead', traits: { ...hero } },
    ];
    const [shaped] = scriptShapedCast(cast, jury);
    expect(shaped.id).toBe('c0');
    expect(shaped.name).toBe('Juror 8');
    expect(shaped.archetype).toBe('IdealisticHero');
    expect(shaped.traits.dramaticDepth).toBe(hero.dramaticDepth);
    expect(shaped.traits.physicalDemand).not.toBe(hero.physicalDemand);
  });
});

describe('the jury-room case this exists for', () => {
  it('no longer briefs a single-interior-location courtroom drama for physical performance', () => {
    const jurors = REFERENCE_SCRIPTS.find((s) => s.title === '12 Angry Men')!;
    for (const juror of jurors.cast) {
      expect(describeCharacterDemands(juror)).not.toContain('physical performance');
    }
  });

  it('still briefs an action tentpole for it', () => {
    const matrix = REFERENCE_SCRIPTS.find((s) => s.title === 'The Matrix')!;
    const briefs = matrix.cast.map((c) => describeCharacterDemands(c));
    expect(briefs.some((b) => b.includes('physical performance'))).toBe(true);
  });
});
