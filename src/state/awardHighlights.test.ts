import { describe, it, expect } from 'vitest';
import { deriveRecentAwardHighlights } from './selectors';
import type { AwardsCeremony, Film, Project } from '../types';
import type { GameState } from './gameState';

// Minimal cast fixtures - deriveRecentAwardHighlights only reads a film's id /
// releasedBy / results.studioRevenue and a ceremony's show/year/ceremonyDay/
// categories, so we build just those rather than whole valid objects.
// A platform release that has been earning for eight weeks and is still in
// cinemas on ceremony day (100) - the film awards attention does most for
// (engine/awards.ts:computeBoxOfficeBump reads the stored weeks, not
// results.studioRevenue).
function playerFilm(id: string, studioRevenue: number): Project {
  const weeklyGross = studioRevenue / 8 / 0.5;
  return {
    kind: 'released',
    film: {
      id,
      releasedBy: undefined,
      releasedOnDay: 100 - 8 * 7,
      marketingChoices: { releaseType: 'Limited' },
      results: { studioRevenue: null },
      boxOfficeRun: {
        status: 'running',
        weeks: Array.from({ length: 8 }, (_, i) => ({ week: i + 1, gross: weeklyGross, domesticGross: weeklyGross, internationalGross: 0 })),
      },
    } as unknown as Film,
  };
}

function ceremony(overrides: Partial<AwardsCeremony> = {}): AwardsCeremony {
  return {
    show: 'academy',
    year: 1,
    ceremonyDay: 100,
    categories: { 'best-picture': [{ filmId: 'f1', awardScore: 90, won: true }] },
    ...overrides,
  } as unknown as AwardsCeremony;
}

function stateWith(ceremonies: AwardsCeremony[], totalDays: number, films: Project[] = [playerFilm('f1', 10_000_000)]): GameState {
  return { projects: films, awards: { history: ceremonies, season: null, nextSeasonDay: 0 }, totalDays } as unknown as GameState;
}

describe('deriveRecentAwardHighlights', () => {
  it('reports a recent win with its box-office lift', () => {
    const highlights = deriveRecentAwardHighlights(stateWith([ceremony()], 105), 14);
    expect(highlights).toHaveLength(1);
    expect(highlights[0].wins).toBe(1);
    expect(highlights[0].nominations).toBe(1);
    expect(highlights[0].payout).toBeGreaterThan(0); // a win lifts a film still in cinemas - the money the player sees arrive
  });

  it('drops a ceremony older than the window', () => {
    expect(deriveRecentAwardHighlights(stateWith([ceremony()], 100 + 20), 14)).toHaveLength(0);
  });

  it('ignores a ceremony the player was not nominated in', () => {
    const notMine = ceremony({ categories: { 'best-picture': [{ filmId: 'someone-else', awardScore: 90, won: true }] } } as Partial<AwardsCeremony>);
    expect(deriveRecentAwardHighlights(stateWith([notMine], 105), 14)).toHaveLength(0);
  });

  it('reports a nomination-only ceremony (still with any bump)', () => {
    const nominatedOnly = ceremony({ categories: { 'best-picture': [{ filmId: 'f1', awardScore: 70, won: false }] } } as Partial<AwardsCeremony>);
    const highlights = deriveRecentAwardHighlights(stateWith([nominatedOnly], 103), 14);
    expect(highlights).toHaveLength(1);
    expect(highlights[0].wins).toBe(0);
    expect(highlights[0].nominations).toBe(1);
  });
});
