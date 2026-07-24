import { describe, it, expect } from 'vitest';
import type { FilmResults } from '../types';
import {
  deriveVerdict,
  deriveReceptionRead,
  deriveFilmInsights,
  deriveStudioImpact,
  deriveAchievements,
  type AchievementFacts,
} from './premiereReport';

// A minimal FilmResults with sensible mid values; individual tests override
// only the fields they exercise, so each stays about one behaviour.
function makeResults(overrides: Partial<FilmResults> = {}): FilmResults {
  return {
    productionCost: 20_000_000,
    marketingCost: 5_000_000,
    totalCost: 25_000_000,
    openingWeekend: 10_000_000,
    totalBoxOffice: 60_000_000,
    studioRevenue: 30_000_000,
    profit: 5_000_000,
    outcome: 'Hit',
    brandChange: 0,
    prestigeChange: 0,
    criticScore: 55,
    audienceScore: 55,
    buzzScore: 55,
    qualityScore: 55,
    scriptScore: 55,
    directionScore: 55,
    actingScore: 55,
    productionScore: 55,
    postProductionScore: 55,
    eventsScore: 55,
    reviewBlurbs: [],
    storyReport: '',
    ...overrides,
  };
}

describe('deriveVerdict', () => {
  it('maps positive outcomes to a triumphant tone', () => {
    expect(deriveVerdict('Blockbuster').tone).toBe('triumph');
    expect(deriveVerdict('Phenomenon').tone).toBe('triumph');
    expect(deriveVerdict('Masterpiece').tone).toBe('triumph');
  });

  it('maps weak/flop outcomes to negative tones', () => {
    expect(deriveVerdict('Weak').tone).toBe('poor');
    expect(deriveVerdict('Flop').tone).toBe('disaster');
  });

  it('treats a still-playing film (null outcome) as a neutral opening', () => {
    const v = deriveVerdict(null);
    expect(v.tone).toBe('mixed');
    expect(v.headline).toMatch(/opening/i);
  });
});

describe('deriveReceptionRead', () => {
  it('reads critics and audiences separately', () => {
    const read = deriveReceptionRead(85, 40);
    expect(read.critics).toMatch(/critics/i);
    expect(read.audiences).toMatch(/audiences/i);
  });

  it('flags when audiences run well ahead of critics', () => {
    expect(deriveReceptionRead(50, 85).divergence).toMatch(/audiences embraced/i);
  });

  it('flags when critics run well ahead of audiences', () => {
    expect(deriveReceptionRead(85, 50).divergence).toMatch(/critics rated/i);
  });

  it('reports no divergence when the two voices roughly agree', () => {
    expect(deriveReceptionRead(70, 72).divergence).toBeNull();
  });
});

describe('deriveFilmInsights', () => {
  it('surfaces clear highs as strengths and clear lows as weaknesses, leaving the middle unremarked', () => {
    const results = makeResults({
      scriptScore: 85, // standout strength
      actingScore: 70, // strength
      directionScore: 55, // middle - unremarked
      productionScore: 40, // weakness
      postProductionScore: 20, // poor weakness
    });
    const { strengths, weaknesses } = deriveFilmInsights(results, 'Drama');

    const strengthDepts = strengths.map((s) => s.department);
    expect(strengthDepts).toContain('Screenplay');
    expect(strengthDepts).toContain('Acting');
    expect(strengthDepts).not.toContain('Direction');

    const weaknessDepts = weaknesses.map((w) => w.department);
    expect(weaknessDepts).toContain('Production');
    expect(weaknessDepts).toContain('Post-Production');
  });

  it('never emits a raw number in a note', () => {
    const results = makeResults({ scriptScore: 90, productionScore: 15 });
    const { strengths, weaknesses } = deriveFilmInsights(results, 'Drama');
    for (const insight of [...strengths, ...weaknesses]) {
      expect(insight.note).not.toMatch(/\d/);
    }
  });

  it('sorts the genre-signature department first among strengths', () => {
    // Drama's signature department is script; give acting the higher raw score
    // but expect Screenplay to still lead because it is the signature craft.
    const results = makeResults({ scriptScore: 80, actingScore: 88 });
    const { strengths } = deriveFilmInsights(results, 'Drama');
    expect(strengths[0].department).toBe('Screenplay');
  });

  it('returns empty lists for a uniformly middling film', () => {
    const { strengths, weaknesses } = deriveFilmInsights(makeResults(), 'Drama');
    expect(strengths).toHaveLength(0);
    expect(weaknesses).toHaveLength(0);
  });
});

describe('deriveStudioImpact', () => {
  it('narrates a strong commercial and critical result in terms of the studio', () => {
    const lines = deriveStudioImpact(makeResults({ brandChange: 6, prestigeChange: 3 }), 'Atlas');
    expect(lines.join(' ')).toMatch(/Atlas/);
    expect(lines.length).toBe(2);
  });

  it('narrates a damaging result', () => {
    const lines = deriveStudioImpact(makeResults({ brandChange: -6, prestigeChange: -3 }), 'Atlas');
    expect(lines.join(' ').toLowerCase()).toMatch(/think twice|chip away/);
  });

  it('falls back to a neutral line when nothing moved', () => {
    const lines = deriveStudioImpact(makeResults({ brandChange: 0, prestigeChange: 0 }), 'Atlas');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/unchanged/);
  });
});

describe('deriveAchievements', () => {
  const facts = (overrides: Partial<AchievementFacts> = {}): AchievementFacts => ({
    openingWeekend: 10_000_000,
    audienceScore: 60,
    criticScore: 60,
    profit: 5_000_000,
    totalBoxOffice: 60_000_000,
    legs: 3,
    prestigeChange: 1,
    ...overrides,
  });

  it('celebrates a beaten record only when there is a prior film to beat', () => {
    const current = facts({ openingWeekend: 20_000_000 });
    const prior = [facts({ openingWeekend: 12_000_000 })];
    const ids = deriveAchievements(current, prior, true).map((a) => a.id);
    expect(ids).toContain('biggest-opening');
  });

  it('does not fire max-based records for a debut film with no prior history', () => {
    const ids = deriveAchievements(facts(), [], true).map((a) => a.id);
    expect(ids).not.toContain('biggest-opening');
    expect(ids).not.toContain('biggest-gross');
  });

  it('fires first-ever milestones for a debut on qualification alone', () => {
    const current = facts({ profit: 3_000_000, criticScore: 80 });
    const ids = deriveAchievements(current, [], true).map((a) => a.id);
    expect(ids).toContain('first-profit');
    expect(ids).toContain('first-critical-hit');
  });

  it('withholds money-based milestones until the run has finished', () => {
    const current = facts({ profit: 3_000_000 });
    const ids = deriveAchievements(current, [], false).map((a) => a.id);
    expect(ids).not.toContain('first-profit');
  });

  it('does not re-award a first critical hit once the studio already has one', () => {
    const current = facts({ criticScore: 85 });
    const prior = [facts({ criticScore: 78 })];
    const ids = deriveAchievements(current, prior, true).map((a) => a.id);
    expect(ids).not.toContain('first-critical-hit');
  });
});
