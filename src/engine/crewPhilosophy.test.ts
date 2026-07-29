// Workstream II, Addition #1 — crew creative-philosophy vectors.
import { describe, it, expect } from 'vitest';
import { crewPhilosophy, directorPhilosophy } from './crewPhilosophy';
import type { CrewPhilosophy, DirectorCareer, Person } from '../types';

function pdPerson(id: string, philosophy?: CrewPhilosophy): Person {
  return {
    id,
    identity: { name: id },
    careers: { productionDesigner: { role: 'Production Designer', active: true, experience: 60, roleReputation: 60, minimumSalary: 1, typicalSalary: 1, skill: 60, philosophy } },
  } as unknown as Person;
}

function director(effectsDigital: number, envDigital: number, spectacle: number, drama: number): DirectorCareer {
  return {
    role: 'Director', active: true, experience: 70, roleReputation: 70, minimumSalary: 1, typicalSalary: 1, skill: 70,
    toneProfile: { action: 40, comedy: 30, romance: 30, suspense: 40, drama, spectacle },
    productionStyle: {
      effectsStrategy: { practical: 1 - effectsDigital, digital: effectsDigital },
      environmentStrategy: { studio: (1 - envDigital) / 2, location: (1 - envDigital) / 2, digital: envDigital },
    },
  } as DirectorCareer;
}

describe('crewPhilosophy', () => {
  it('is stable per person and in range', () => {
    const p = pdPerson('pd-1');
    const a = crewPhilosophy(p, 'Production Designer');
    const b = crewPhilosophy(p, 'Production Designer');
    expect(a).toEqual(b); // deterministic
    for (const v of [a.digitalAffinity, a.stylisation]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('differs across people (not a constant)', () => {
    const vectors = ['a', 'b', 'c', 'd', 'e'].map((id) => crewPhilosophy(pdPerson(id), 'Production Designer'));
    const distinct = new Set(vectors.map((v) => `${v.digitalAffinity.toFixed(3)},${v.stylisation.toFixed(3)}`));
    expect(distinct.size).toBeGreaterThan(1);
  });

  it('respects an authored philosophy override', () => {
    const authored = { digitalAffinity: 0.9, stylisation: 0.1 };
    expect(crewPhilosophy(pdPerson('pd-x', authored), 'Production Designer')).toEqual(authored);
  });
});

describe('directorPhilosophy', () => {
  it('maps a digital, spectacle-leaning director to high digitalAffinity and stylisation', () => {
    const v = directorPhilosophy(director(0.9, 0.9, 90, 20));
    expect(v.digitalAffinity).toBeGreaterThan(0.7);
    expect(v.stylisation).toBeGreaterThan(0.6);
  });

  it('maps a practical, grounded-drama director to low digitalAffinity and stylisation', () => {
    const v = directorPhilosophy(director(0.1, 0.1, 15, 90));
    expect(v.digitalAffinity).toBeLessThan(0.3);
    expect(v.stylisation).toBeLessThan(0.4);
  });
});
