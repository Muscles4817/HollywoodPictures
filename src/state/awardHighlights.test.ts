import { describe, it, expect } from 'vitest';
import { deriveRecentAwardHighlights } from './selectors';
import type { AwardsCeremony, Film, GameState, Project } from '../types';

// Minimal cast fixtures - deriveRecentAwardHighlights only reads a film's id /
// releasedBy / results.studioRevenue and a ceremony's show/year/ceremonyDay/
// categories, so we build just those rather than whole valid objects.
function playerFilm(id: string, studioRevenue: number): Project {
  return { kind: 'released', film: { id, releasedBy: undefined, results: { studioRevenue } } as unknown as Film };
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
  it('reports a recent win with its cash prize', () => {
    const highlights = deriveRecentAwardHighlights(stateWith([ceremony()], 105), 14);
    expect(highlights).toHaveLength(1);
    expect(highlights[0].wins).toBe(1);
    expect(highlights[0].nominations).toBe(1);
    expect(highlights[0].payout).toBeGreaterThan(0); // awards DO pay money - the whole point
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
