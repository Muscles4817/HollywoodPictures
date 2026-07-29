// Workstream II, Phase C — compatibility edges. The Director ↔ approach edge:
// a director's practical/digital lean read against the chosen Execution Strategy.
// A relationship read (aligned · mixed · friction), never a quality modifier.
import { describe, it, expect } from 'vitest';
import { deriveDirectorApproachFit, deriveCrewCollaborationReads } from './collaborationEdges';
import type { ExecutionStrategy, ExecutionStrategyAxis } from './executionStrategy';
import type { CrewPhilosophy, DirectorProductionStyle, FilmDraft, Person } from '../types';

function style(effectsDigital: number, envDigital: number): DirectorProductionStyle {
  return {
    effectsStrategy: { practical: 1 - effectsDigital, digital: effectsDigital },
    environmentStrategy: { studio: (1 - envDigital) / 2, location: (1 - envDigital) / 2, digital: envDigital },
  };
}
const AXES: ExecutionStrategyAxis[] = ['creatureMethod', 'environmentMethod'];
const practicalStrategy: ExecutionStrategy = { creatureMethod: 'animatronic', environmentMethod: 'location' };
const digitalStrategy: ExecutionStrategy = { creatureMethod: 'fullyCG', environmentMethod: 'fullyDigital' };

describe('deriveDirectorApproachFit', () => {
  it('a practical director on a practical production reads as aligned', () => {
    const read = deriveDirectorApproachFit(style(0.1, 0.1), practicalStrategy, AXES);
    expect(read.alignment).toBe('aligned');
    expect(read.directorPrefers).toBe('practical');
    expect(read.approachIs).toBe('practical');
  });

  it('a practical director on a fully-CG production reads as friction', () => {
    const read = deriveDirectorApproachFit(style(0.1, 0.1), digitalStrategy, AXES);
    expect(read.alignment).toBe('friction');
    expect(read.directorPrefers).toBe('practical');
    expect(read.approachIs).toBe('digital');
    expect(read.headline).toMatch(/pulling against/i);
  });

  it('a digital director on a fully-CG production reads as aligned', () => {
    const read = deriveDirectorApproachFit(style(0.95, 0.95), digitalStrategy, AXES);
    expect(read.alignment).toBe('aligned');
    expect(read.approachIs).toBe('digital');
  });

  it('a middling gap reads as mixed', () => {
    // director balanced-ish (0.5), approach set-extension/hybrid (~0.5) -> aligned;
    // shift the approach digital enough to open a mixed gap.
    const read = deriveDirectorApproachFit(style(0.2, 0.2), { creatureMethod: 'hybrid', environmentMethod: 'setExtension' }, AXES);
    expect(read.alignment).toBe('mixed');
  });

  it('averages only over the axes the film exposes (creature-less film ignores creature method)', () => {
    // A practical-env director; creature method is digital but the film has no
    // creature, so only environmentMethod counts -> aligned on environment.
    const envOnly: ExecutionStrategyAxis[] = ['environmentMethod'];
    const read = deriveDirectorApproachFit(style(0.9, 0.1), { creatureMethod: 'fullyCG', environmentMethod: 'location' }, envOnly);
    expect(read.approachIs).toBe('practical'); // creature (digital) excluded
    expect(read.alignment).toBe('aligned');
  });

  it('never emits digits in the player-facing copy', () => {
    const read = deriveDirectorApproachFit(style(0.1, 0.1), digitalStrategy, AXES);
    expect(read.headline).not.toMatch(/\d/);
    expect(read.detail).not.toMatch(/\d/);
  });
});

// --- Person↔person collaborator edges -------------------------------------

function pd(id: string, philosophy: CrewPhilosophy): Person {
  return { id, identity: { name: id }, careers: { productionDesigner: { role: 'Production Designer', active: true, experience: 60, roleReputation: 60, minimumSalary: 1, typicalSalary: 1, skill: 60, philosophy } } } as unknown as Person;
}
function vfx(id: string, philosophy: CrewPhilosophy): Person {
  return { id, identity: { name: id }, careers: { vfxSupervisor: { role: 'VFX Supervisor', active: true, experience: 60, roleReputation: 60, minimumSalary: 1, typicalSalary: 1, skill: 60, philosophy } } } as unknown as Person;
}
function directorPerson(id: string, effectsDigital: number, envDigital: number): Person {
  return {
    id, identity: { name: id },
    careers: { director: {
      role: 'Director', active: true, experience: 70, roleReputation: 70, minimumSalary: 1, typicalSalary: 1, skill: 70,
      toneProfile: { action: 40, comedy: 30, romance: 30, suspense: 40, drama: 50, spectacle: 50 },
      productionStyle: { effectsStrategy: { practical: 1 - effectsDigital, digital: effectsDigital }, environmentStrategy: { studio: (1 - envDigital) / 2, location: (1 - envDigital) / 2, digital: envDigital } },
    } },
  } as unknown as Person;
}
const draftWith = (...talent: { role: string; person: Person }[]) => ({ talent } as unknown as FilmDraft);

describe('deriveCrewCollaborationReads', () => {
  it('only reports edges whose both heads are attached', () => {
    const practical = { digitalAffinity: 0.15, stylisation: 0.3 };
    // Only a PD attached -> no edge (needs a partner).
    expect(deriveCrewCollaborationReads(draftWith({ role: 'Production Designer', person: pd('pd', practical) }))).toHaveLength(0);
    // Director + PD -> the Director↔PD edge.
    const reads = deriveCrewCollaborationReads(draftWith(
      { role: 'Director', person: directorPerson('d', 0.1, 0.1) },
      { role: 'Production Designer', person: pd('pd', practical) },
    ));
    expect(reads.map((r) => r.pair)).toEqual(['Director & Production Designer']);
  });

  it('a practical PD and a digital VFX head clash over practical vs digital', () => {
    const reads = deriveCrewCollaborationReads(draftWith(
      { role: 'Production Designer', person: pd('pd', { digitalAffinity: 0.1, stylisation: 0.5 }) },
      { role: 'VFX Supervisor', person: vfx('vfx', { digitalAffinity: 0.95, stylisation: 0.5 }) },
    ));
    const edge = reads.find((r) => r.pair === 'Production Designer & VFX Supervisor')!;
    expect(edge.alignment).toBe('friction');
    expect(edge.topic).toBe('practical vs digital');
    expect(edge.headline).not.toMatch(/\d/);
  });

  it('aligned philosophies read as seeing eye to eye', () => {
    const same = { digitalAffinity: 0.5, stylisation: 0.5 };
    const reads = deriveCrewCollaborationReads(draftWith(
      { role: 'Production Designer', person: pd('pd', same) },
      { role: 'VFX Supervisor', person: vfx('vfx', same) },
    ));
    expect(reads[0].alignment).toBe('aligned');
    expect(reads[0].topic).toBe('aligned');
  });

  it('surfaces all three edges when Director, PD and VFX are all attached', () => {
    const reads = deriveCrewCollaborationReads(draftWith(
      { role: 'Director', person: directorPerson('d', 0.5, 0.5) },
      { role: 'Production Designer', person: pd('pd', { digitalAffinity: 0.5, stylisation: 0.5 }) },
      { role: 'VFX Supervisor', person: vfx('vfx', { digitalAffinity: 0.5, stylisation: 0.5 }) },
    ));
    expect(reads).toHaveLength(3);
  });
});
