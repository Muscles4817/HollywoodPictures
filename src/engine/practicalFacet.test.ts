// Practical Effects facet (docs/DESIGN_REVIEW_production_redesign.md, step 4).
// The shared model math is covered in facetModel.test.ts; this file covers only
// the Practical-specific wiring: the ambition source and the fact that this
// facet's TIME axis is the finished shoot's shootingRatio — a rushed shoot
// leaves less time to get stunts and rigs right.
import { describe, it, expect } from 'vitest';
import { computePracticalAmbition, computePracticalFacet } from './practicalFacet';
import { PRACTICAL_EFFECTS_RANGE } from '../data/production';
import type { Genre, Script } from '../types';

const script = (primarySetting: string, scale: Script['scale']) => ({ primarySetting, scale }) as unknown as Script;

describe('computePracticalAmbition', () => {
  it('a warzone-scale action/horror shoot is far more demanding than a single-room drama', () => {
    const spectacle = computePracticalAmbition('Horror', script('ModernWarzone', 'Epic'));
    const drama = computePracticalAmbition('Drama', script('SingleInteriorLocation', 'Intimate'));
    expect(spectacle).toBeGreaterThan(55);
    expect(drama).toBeLessThan(20);
  });
});

describe('the Practical money and time axes', () => {
  const g: Genre = 'Horror';
  const sc = script('ModernWarzone', 'Epic');

  it('a fully-funded practical shoot beats a starved one, at the same schedule', () => {
    const funded = computePracticalFacet(PRACTICAL_EFFECTS_RANGE.max, g, sc, 1).quality;
    const starved = computePracticalFacet(PRACTICAL_EFFECTS_RANGE.min, g, sc, 1).quality;
    expect(funded).toBeGreaterThan(starved + 20);
  });

  it("a rushed shoot dulls even a fully-funded effects unit — shootingRatio is the facet's time axis", () => {
    const onSchedule = computePracticalFacet(PRACTICAL_EFFECTS_RANGE.max, g, sc, 1).quality;
    const rushed = computePracticalFacet(PRACTICAL_EFFECTS_RANGE.max, g, sc, 0.3).quality;
    expect(onSchedule).toBeGreaterThan(rushed + 8);
  });
});
