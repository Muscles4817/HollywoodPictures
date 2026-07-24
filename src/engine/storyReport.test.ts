import { describe, it, expect } from 'vitest';
import { generateStoryReport, type StoryReportInput } from './storyReport';
import { DEPARTMENT_HIGHLIGHTS, DIVERGENCE_BEATS } from '../data/storyBeats';
import { createRng } from './random';

const balanced = {
  scriptScore: 60,
  directionScore: 60,
  actingScore: 60,
  productionScore: 60,
  postProductionScore: 60,
};

function input(overrides: Partial<StoryReportInput> = {}): StoryReportInput {
  return { title: 'The Long Take', buzzScore: 55, criticScore: 60, audienceScore: 60, departments: balanced, ...overrides };
}

describe('generateStoryReport', () => {
  it('is deterministic given the same rng seed and substitutes the title', () => {
    const a = generateStoryReport(input(), createRng(5));
    const b = generateStoryReport(input(), createRng(5));
    expect(a).toBe(b);
    expect(a).toContain('The Long Take');
  });

  it('names the standout department when one clearly leads', () => {
    const report = generateStoryReport(
      input({ departments: { ...balanced, actingScore: 90 } }),
      createRng(3),
    );
    expect(DEPARTMENT_HIGHLIGHTS.acting.praise.some((line) => report.includes(line))).toBe(true);
  });

  it('calls out a clearly weak department', () => {
    const report = generateStoryReport(
      input({ departments: { ...balanced, scriptScore: 25 } }),
      createRng(3),
    );
    expect(DEPARTMENT_HIGHLIGHTS.script.criticism.some((line) => report.includes(line))).toBe(true);
  });

  it('adds a divergence beat when audiences and critics clearly split', () => {
    const report = generateStoryReport(input({ criticScore: 45, audienceScore: 80 }), createRng(2));
    expect(DIVERGENCE_BEATS.audienceAhead.some((line) => report.includes(line))).toBe(true);
  });

  it('stays a single trajectory sentence for an evenly-balanced, consensus film', () => {
    const report = generateStoryReport(input(), createRng(1));
    const anyDeptLine = Object.values(DEPARTMENT_HIGHLIGHTS).flatMap((d) => [...d.praise, ...d.criticism]);
    expect(anyDeptLine.some((line) => report.includes(line))).toBe(false);
    expect(Object.values(DIVERGENCE_BEATS).flat().some((line) => report.includes(line))).toBe(false);
  });
});
