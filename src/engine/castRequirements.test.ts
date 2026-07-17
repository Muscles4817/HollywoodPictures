// Character and Setting Foundations milestone
// (docs/CHARACTER_AND_SETTING_FOUNDATIONS.md section 7) - no dedicated test
// coverage existed for this file before characterForRoleSlot was added.
import { describe, it, expect } from 'vitest';
import { characterForRoleSlot, effectiveRoleCapacity } from './castRequirements';
import { generateScriptOptions } from './scriptGenerator';
import { withRng } from './random';
import type { Script, ScriptCharacter } from '../types';

function baseScript(seed: number, overrides: Partial<Script> = {}): Script {
  const { result: script } = withRng(seed, (rng) => generateScriptOptions('Action', rng, 1)[0]);
  return { ...script, ...overrides };
}

function makeCharacter(overrides: Partial<ScriptCharacter> = {}): ScriptCharacter {
  return {
    id: `char-${Math.random()}`,
    name: 'Test Character',
    archetype: 'Other',
    prominence: 'Lead',
    traits: {
      dramaticDepth: 50, charismaDemand: 50, comedyDemand: 50, emotionalDemand: 50, physicalDemand: 50,
      transformationDemand: 50, audienceAccessibility: 50, distinctiveness: 50, merchandisePotential: 50,
    },
    ...overrides,
  };
}

describe('characterForRoleSlot', () => {
  it("maps the Nth Lead Actor hire to script.cast's Nth Lead character, in cast order", () => {
    const leadA = makeCharacter({ id: 'lead-a', name: 'Lead A', prominence: 'Lead' });
    const leadB = makeCharacter({ id: 'lead-b', name: 'Lead B', prominence: 'Lead' });
    const script = baseScript(1, { cast: [leadA, leadB] });
    expect(characterForRoleSlot(script, 'Lead Actor', 0)).toBe(leadA);
    expect(characterForRoleSlot(script, 'Lead Actor', 1)).toBe(leadB);
  });

  it("maps the Nth Supporting Actor hire to script.cast's Nth Supporting character, independent of Lead slots", () => {
    const lead = makeCharacter({ id: 'lead-1', prominence: 'Lead' });
    const supportingA = makeCharacter({ id: 'support-a', name: 'Support A', prominence: 'Supporting' });
    const supportingB = makeCharacter({ id: 'support-b', name: 'Support B', prominence: 'Supporting' });
    const script = baseScript(2, { cast: [lead, supportingA, supportingB] });
    expect(characterForRoleSlot(script, 'Supporting Actor', 0)).toBe(supportingA);
    expect(characterForRoleSlot(script, 'Supporting Actor', 1)).toBe(supportingB);
  });

  it('ignores Minor characters entirely - they never occupy a Lead or Supporting slot', () => {
    const supporting = makeCharacter({ id: 'support-1', prominence: 'Supporting' });
    const minor = makeCharacter({ id: 'minor-1', prominence: 'Minor' });
    const script = baseScript(3, { cast: [minor, supporting] });
    expect(characterForRoleSlot(script, 'Supporting Actor', 0)).toBe(supporting);
  });

  it('returns null once slotIndex runs past every character of that prominence', () => {
    const lead = makeCharacter({ id: 'lead-1', prominence: 'Lead' });
    const script = baseScript(4, { cast: [lead] });
    expect(characterForRoleSlot(script, 'Lead Actor', 1)).toBeNull();
  });

  it('returns null for any role other than Lead Actor/Supporting Actor', () => {
    const script = baseScript(5, { cast: [makeCharacter({ prominence: 'Lead' })] });
    expect(characterForRoleSlot(script, 'Director', 0)).toBeNull();
    expect(characterForRoleSlot(script, 'VFX Supervisor', 0)).toBeNull();
  });
});

describe('effectiveRoleCapacity', () => {
  it("Lead/Supporting Actor capacity comes from the script's own requiredLeads/requiredSupporting once one is picked", () => {
    const script = baseScript(6, { requiredLeads: 3, requiredSupporting: 5 });
    expect(effectiveRoleCapacity('Lead Actor', script)).toEqual({ min: 3, max: 3 });
    expect(effectiveRoleCapacity('Supporting Actor', script)).toEqual({ min: 5, max: 5 });
  });

  it('falls back to the static per-role capacity before a script is picked', () => {
    const withScript = effectiveRoleCapacity('Lead Actor', baseScript(7, { requiredLeads: 4 }));
    const withoutScript = effectiveRoleCapacity('Lead Actor', null);
    expect(withoutScript).not.toEqual(withScript);
  });
});
