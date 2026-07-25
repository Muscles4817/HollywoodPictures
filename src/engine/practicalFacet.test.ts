// Practical Effects facet (docs/DESIGN_REVIEW_production_redesign.md, step 4).
// The shared model math is covered in facetModel.test.ts; this file covers only
// the Practical-specific wiring: the ambition source and the fact that this
// facet's TIME axis is the finished shoot's shootingRatio — a rushed shoot
// leaves less time to get stunts and rigs right.
import { describe, it, expect } from 'vitest';
import { computePracticalAmbition, computePracticalFacet, realisePracticalQuality, practicalOutlook, NO_STUNT_TEAM_SKILL } from './practicalFacet';
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

  it('a stronger Stunt Team (teamSkill) beats the no-team fallback, all else equal', () => {
    // Mid-money, on-schedule — the regime where skill decides rather than the
    // money floor pinning both to the same starved value.
    const mid = (PRACTICAL_EFFECTS_RANGE.min + PRACTICAL_EFFECTS_RANGE.max) / 2;
    const elite = computePracticalFacet(mid, g, sc, 1, 90).quality;
    const noTeam = computePracticalFacet(mid, g, sc, 1, NO_STUNT_TEAM_SKILL).quality;
    expect(elite).toBeGreaterThan(noTeam + 5);
  });
});

describe('the Practical execution swing (spec §3.3)', () => {
  const g: Genre = 'Horror';
  const sc = script('ModernWarzone', 'Epic');
  // A stretched practical build (lean money, rushed shoot) vs a comfortable one.
  const stretched = () => computePracticalFacet(PRACTICAL_EFFECTS_RANGE.min, g, sc, 0.4, 70);
  const comfortable = () => computePracticalFacet(PRACTICAL_EFFECTS_RANGE.max, g, sc, 1, 90);

  it('a stretched build swings hard with the stunt work; a comfortable one barely moves', () => {
    const stretchedSwing = Math.abs(realisePracticalQuality(stretched(), 70, 10) - realisePracticalQuality(stretched(), 70, -10));
    const comfortableSwing = Math.abs(realisePracticalQuality(comfortable(), 90, 10) - realisePracticalQuality(comfortable(), 90, -10));
    expect(stretchedSwing).toBeGreaterThan(comfortableSwing + 8);
  });

  it('a forecast (no practical events) delivers the deterministic base', () => {
    const s = stretched();
    expect(realisePracticalQuality(s, 50, 0)).toBe(s.quality);
  });

  it('practicalOutlook reads lean from the Stunt Team skill', () => {
    expect(practicalOutlook(stretched(), 90).lean).toBe('promising');
    expect(practicalOutlook(stretched(), 30).lean).toBe('precarious');
  });
});
