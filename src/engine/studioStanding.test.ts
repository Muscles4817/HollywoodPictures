import { describe, it, expect } from 'vitest';
import { synthesizeStudioStanding, studioTier, STUDIO_TIER_LABEL, type StandingFilm } from './studioStanding';

const hit = (title: string, genre: StandingFilm['genre']): StandingFilm => ({ title, genre, profit: 180_000_000, totalCost: 80_000_000, audienceScore: 78 });
const flop = (title: string, genre: StandingFilm['genre']): StandingFilm => ({ title, genre, profit: -60_000_000, totalCost: 80_000_000, audienceScore: 38 });

describe('synthesizeStudioStanding', () => {
  it('a fresh studio reads as fledgling with no signature', () => {
    const s = synthesizeStudioStanding({ brand: 20, prestige: 20, genreIdentity: {}, films: [] });
    expect(s.headline).toBe('Fledgling studio');
    expect(s.body).toContain('little-known newcomer');
    expect(s.body).not.toMatch(/signature genre/); // no films -> no identity claim
  });

  it('an established horror specialist leads with its territory and defining hit', () => {
    const s = synthesizeStudioStanding({
      brand: 70,
      prestige: 40,
      genreIdentity: { Horror: 62, Thriller: 25 },
      films: [hit('The Cellar', 'Horror'), hit('Nightfall', 'Horror'), flop('Costume Drama', 'Drama')],
    });
    expect(s.headline).toBe('Major Horror studio');
    expect(s.body.toLowerCase()).toContain('horror');
    expect(s.body).toContain('signature');
    expect(s.body).toContain('The Cellar'); // biggest hit named
  });

  it('a struggling studio leads honestly on its costly misfire', () => {
    const s = synthesizeStudioStanding({
      brand: 28,
      prestige: 22,
      genreIdentity: {},
      films: [flop('Moonshot', 'Sci-Fi'), { title: 'Small Win', genre: 'Comedy', profit: 5_000_000, totalCost: 30_000_000, audienceScore: 55 }],
    });
    expect(s.body).toContain('Moonshot');
    expect(s.body.toLowerCase()).toMatch(/misfire|hard|recover/);
  });

  it('names an emerging genre before it is a full signature', () => {
    const s = synthesizeStudioStanding({
      brand: 50,
      prestige: 45,
      genreIdentity: { Thriller: 28 }, // above emerging, below established
      films: [{ title: 'Edge', genre: 'Thriller', profit: 40_000_000, totalCost: 50_000_000, audienceScore: 62 }],
    });
    expect(s.body.toLowerCase()).toContain('thriller');
    expect(s.body).toContain('starting to build');
    expect(s.headline).toBe('Established studio'); // not yet a "Thriller studio"
  });
});

describe('studioTier', () => {
  // The value the letterhead's three treatments key off (Dashboard.css,
  // "The letterhead"), so the boundaries are where a player sees their own
  // stationery change - worth pinning rather than re-deriving from a ternary.
  it('steps at four films and at ten', () => {
    expect(studioTier(0)).toBe('independent');
    expect(studioTier(3)).toBe('independent');
    expect(studioTier(4)).toBe('established');
    expect(studioTier(9)).toBe('established');
    expect(studioTier(10)).toBe('major');
    expect(studioTier(40)).toBe('major');
  });

  it('names every tier it can return', () => {
    for (const count of [0, 4, 10]) {
      expect(STUDIO_TIER_LABEL[studioTier(count)]).toBeTruthy();
    }
  });
});
