// Workstream II, Phase C — the crew fit-read floor. A head's capability read
// against a department's derived workload, qualitatively. Calibration-safe: no
// cost or scoring, just the read.
import { describe, it, expect } from 'vitest';
import { deriveCrewFitRead, unloadedDepartmentRead, type CrewCapability } from './crewFitRead';
import type { DepartmentWorkload } from './departmentWorkload';

function workload(over: Partial<DepartmentWorkload> = {}): DepartmentWorkload {
  return {
    department: 'vfx', label: 'Visual Effects',
    magnitude: 0.8, complexity: 0.7, criticality: 0.7,
    contributions: [], dominantRequirements: [],
    ...over,
  };
}
const cap = (over: Partial<CrewCapability> = {}): CrewCapability => ({ skill: 60, experience: 60, hired: true, ...over });

describe('deriveCrewFitRead — demand banding', () => {
  it('reads a heavy, complex workload as a severe demand and a light one as light', () => {
    const severe = deriveCrewFitRead(cap(), workload({ magnitude: 0.9, complexity: 0.8 }));
    expect(severe.demand).toBe('severe');
    const light = deriveCrewFitRead(cap(), workload({ magnitude: 0.15, complexity: 0.2 }));
    expect(light.demand).toBe('light');
  });
});

describe('deriveCrewFitRead — suitability from the capability/demand margin', () => {
  const demanding = workload({ magnitude: 0.8, complexity: 0.7 }); // demandScore = 0.6*.8+0.4*.7 = 0.76

  it('a top head comfortably clears a demanding film', () => {
    const read = deriveCrewFitRead(cap({ skill: 100 }), demanding);
    expect(read.suitability).toBe('overqualified');
    expect(read.margin).toBeGreaterThan(0);
  });

  it('a middling head is a stretch on a demanding film', () => {
    const read = deriveCrewFitRead(cap({ skill: 60 }), demanding); // 0.60 - 0.76 = -0.16
    expect(read.suitability).toBe('stretch');
  });

  it('a weak head is outmatched by a demanding film', () => {
    const read = deriveCrewFitRead(cap({ skill: 35 }), demanding); // -0.41
    expect(read.suitability).toBe('outmatched');
  });

  it('the same head is a solid/strong fit once the film is easier', () => {
    const easy = workload({ magnitude: 0.5, complexity: 0.5 }); // demandScore 0.5
    const read = deriveCrewFitRead(cap({ skill: 60 }), easy); // +0.10 -> strong
    expect(['solid', 'strong']).toContain(read.suitability);
    expect(read.suitability).not.toBe('stretch');
  });
});

describe('deriveCrewFitRead — stakes and confidence', () => {
  it('flags a make-or-break department (high criticality) as critical', () => {
    expect(deriveCrewFitRead(cap(), workload({ criticality: 0.8 })).critical).toBe(true);
    expect(deriveCrewFitRead(cap(), workload({ criticality: 0.3 })).critical).toBe(false);
  });

  it('reads experience into a confidence band, and notes an unproven head in the prose', () => {
    expect(deriveCrewFitRead(cap({ experience: 80 }), workload()).confidence).toBe('proven');
    expect(deriveCrewFitRead(cap({ experience: 40 }), workload()).confidence).toBe('established');
    const green = deriveCrewFitRead(cap({ skill: 90, experience: 10 }), workload());
    expect(green.confidence).toBe('unproven');
    expect(green.detail).toMatch(/unproven/i);
  });

  it('treats a team with no career track (no experience) as established', () => {
    expect(deriveCrewFitRead(cap({ experience: undefined }), workload()).confidence).toBe('established');
  });
});

describe('deriveCrewFitRead — hired vs unstaffed prose', () => {
  it('an attached head gets a fit headline; the raw score is never in the copy', () => {
    const read = deriveCrewFitRead(cap({ skill: 85 }), workload({ magnitude: 0.6, complexity: 0.6 }));
    expect(read.hired).toBe(true);
    expect(read.headline).not.toMatch(/\d/);
    expect(read.detail).not.toMatch(/\d/);
  });

  it('an unstaffed department reads as a demand-to-fill prompt, not a person verdict', () => {
    const read = deriveCrewFitRead({ skill: 35, hired: false }, workload({ magnitude: 0.9, complexity: 0.8 }));
    expect(read.hired).toBe(false);
    expect(read.headline).toMatch(/Unstaffed/);
    expect(read.headline.toLowerCase()).toContain('severe');
  });
});

describe('unloadedDepartmentRead', () => {
  it('reports a department the film barely loads as a non-factor, not a false stretch', () => {
    const read = unloadedDepartmentRead('stunts', false);
    expect(read.demand).toBe('light');
    expect(read.suitability).toBe('overqualified');
    expect(read.headline).toMatch(/Barely a factor/);
  });
});
