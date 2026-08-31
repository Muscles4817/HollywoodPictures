import { describe, it, expect } from 'vitest';
import { buildPopulatedStudio } from './renderFixtures';
import { collectFilmStats } from './selectors';
import { playerReleasedFilms } from '../engine/project';

/**
 * A fixture built for looking at is worth nothing if it is quietly as empty as
 * the one it replaced - and "empty by construction" is exactly the failure it
 * exists to fix. So it asserts what it claims to contain.
 */
describe('buildPopulatedStudio', () => {
  const state = buildPopulatedStudio(11);

  it('has a filmography, not one film', () => {
    expect(playerReleasedFilms(state.projects).length).toBeGreaterThanOrEqual(3);
  });

  it('has unfinished work, not just a back catalogue', () => {
    // The Release Calendar and the slate are about what has not happened yet.
    // A fixture of purely finished films renders both as empty states, which is
    // the fault this file exists to stop repeating.
    expect(state.projects.filter((p) => p.kind === 'scheduled').length).toBeGreaterThan(0);
    expect(state.projects.filter((p) => p.kind === 'player-in-progress').length).toBeGreaterThan(0);
  });

  it('has unmade screenplays, so the library shows more than one status', () => {
    const filmed = new Set(
      state.projects.flatMap((p) => (p.kind === 'released' ? [p.film.assetId] : [])),
    );
    expect(state.studio.assets.some((a) => !filmed.has(a.id))).toBe(true);
  });

  it('has a market and a competition to render', () => {
    expect(state.opportunities.length).toBeGreaterThan(0);
    expect(state.projects.some((p) => p.kind === 'rival-in-progress')).toBe(true);
  });

  it('has rival studios, which the unit fixture deliberately does not', () => {
    expect(state.rivalStudios.length).toBeGreaterThan(0);
  });

  it('has an asset library with more than one thing in it', () => {
    expect(state.studio.assets.length).toBeGreaterThanOrEqual(3);
  });

  it('has released films with settled results, so the tables have figures to show', () => {
    const rows = collectFilmStats(state.projects, state.studio.name).filter((r) => r.isPlayer);
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows.some((r) => r.film.results.totalBoxOffice !== null)).toBe(true);
  });

  it('has run far enough for the calendar to have a year behind it', () => {
    expect(state.totalDays).toBeGreaterThan(365);
  });

  it('is deterministic for a seed', () => {
    const a = buildPopulatedStudio(3);
    const b = buildPopulatedStudio(3);
    expect(playerReleasedFilms(a.projects).map((f) => f.title)).toEqual(
      playerReleasedFilms(b.projects).map((f) => f.title),
    );
  });
});
