import { describe, it, expect } from 'vitest';
import { promoteFilmToIp, ipForSourceFilm, ipIdForFilm } from './intellectualProperty';
import { generateScriptOptions } from './scriptGenerator';
import { createRng } from './random';
import { createInitialStudio } from '../state/gameState';
import type { Film, Script } from '../types';

// promoteFilmToIp only reads id/title/script.cast/script.primarySetting, so a
// minimal Film built around a real generated Script is enough here.
function filmFrom(id: string, script: Script): Film {
  return { id, title: `The ${id}`, script } as unknown as Film;
}

function actionScript(): Script {
  return generateScriptOptions('Action', createRng(7), 1)[0];
}

describe('promoteFilmToIp', () => {
  it('lifts the selected characters and the film setting into persistent components with stable global ids', () => {
    const script = actionScript();
    const film = filmFrom('film-1', script);
    const chosen = script.cast.slice(0, 2).map((c) => c.id);

    const ip = promoteFilmToIp(film, chosen, 'My Franchise', 100);

    expect(ip.id).toBe(ipIdForFilm('film-1'));
    expect(ip.name).toBe('My Franchise');
    expect(ip.createdOnDay).toBe(100);
    // References the source film, doesn't copy it.
    expect(ip.sourceFilmId).toBe('film-1');
    expect(ip.filmIds).toEqual(['film-1']);
    // The chosen characters became components, each with a global id distinct
    // from its script-local one and provenance back to the source.
    expect(ip.characters.map((c) => c.sourceCharacterId)).toEqual(chosen);
    for (const c of ip.characters) {
      expect(c.id).not.toBe(c.sourceCharacterId);
      expect(c.sourceFilmId).toBe('film-1');
    }
    // The setting comes from the film's own primarySetting.
    expect(ip.setting.archetype).toBe(script.primarySetting);
    expect(ip.setting.sourceFilmId).toBe('film-1');
  });

  it('preserves each promoted character\'s creative profile as a snapshot', () => {
    const script = actionScript();
    const source = script.cast[0];
    const ip = promoteFilmToIp(filmFrom('film-2', script), [source.id], 'IP', 1);
    const promoted = ip.characters[0];
    expect(promoted.name).toBe(source.name);
    expect(promoted.archetype).toBe(source.archetype);
    expect(promoted.prominence).toBe(source.prominence);
    expect(promoted.traits).toEqual(source.traits);
  });

  it('ignores character ids that are not on the film', () => {
    const script = actionScript();
    const ip = promoteFilmToIp(filmFrom('film-3', script), ['not-a-real-character'], '', 1);
    expect(ip.characters).toEqual([]);
    // A setting-only IP is still valid.
    expect(ip.setting.archetype).toBe(script.primarySetting);
  });

  it('falls back to the film title when no name is given', () => {
    const script = actionScript();
    const film = filmFrom('film-4', script);
    expect(promoteFilmToIp(film, [], '   ', 1).name).toBe(film.title);
  });

  it('gives every source film its own IP id', () => {
    expect(ipIdForFilm('a')).not.toBe(ipIdForFilm('b'));
  });
});

describe('ipForSourceFilm', () => {
  it('finds an IP by its source film, and returns undefined otherwise', () => {
    const script = actionScript();
    const ip = promoteFilmToIp(filmFrom('film-5', script), [], 'IP', 1);
    const studio = { ...createInitialStudio(1_000_000), intellectualProperties: [ip] };
    expect(ipForSourceFilm(studio, 'film-5')).toBe(ip);
    expect(ipForSourceFilm(studio, 'film-nope')).toBeUndefined();
  });
});
