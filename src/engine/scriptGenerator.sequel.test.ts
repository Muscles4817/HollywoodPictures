import { describe, it, expect } from 'vitest';
import { generateSequelScript } from './scriptGenerator';
import { deriveMarketability } from './commercialProfile';
import { createRng } from './random';
import type { CharacterTraitProfile, IntellectualProperty, IpCharacter } from '../types';

const traits: CharacterTraitProfile = {
  dramaticDepth: 60, charismaDemand: 70, comedyDemand: 30, emotionalDemand: 55,
  physicalDemand: 65, transformationDemand: 40, audienceAccessibility: 70, distinctiveness: 80, merchandisePotential: 75,
};

function ipChar(name: string, prominence: IpCharacter['prominence']): IpCharacter {
  return {
    id: `ipc-${name}`, sourceFilmId: 'film-1', sourceCharacterId: `sc-${name}`,
    name, prominence, archetype: 'ReluctantHero', traits,
    standing: { recognition: 80, popularity: 75 },
  };
}

function ip(recognition = 82, entries = 1): IntellectualProperty {
  return {
    id: 'ip-1', name: 'Nightfall', createdOnDay: 100, sourceFilmId: 'film-1',
    filmIds: Array.from({ length: entries }, (_, i) => `film-${i + 1}`),
    characters: [ipChar('Kade', 'Lead'), ipChar('Rem', 'Supporting')],
    setting: { id: 'ips-1', sourceFilmId: 'film-1', archetype: 'AlienWorld' },
    recognition, prestige: 60,
  };
}

describe('generateSequelScript', () => {
  it('inherits the IP world, the returning characters, and the proven recognition', () => {
    const sequel = generateSequelScript(ip(82), 'Sci-Fi', createRng(1));
    expect(sequel.franchiseRecognition).toBe(82); // the pre-sold draw is inherited
    expect(sequel.primarySetting).toBe('AlienWorld'); // same world
    expect(sequel.cast.map((c) => c.name)).toEqual(['Kade', 'Rem']); // returning cast
    expect(sequel.requiredLeads).toBe(1);
    expect(sequel.requiredSupporting).toBe(1);
    // cast ids are script-local, derived from the new script's id
    for (const c of sequel.cast) expect(c.id.startsWith(`${sequel.id}-c`)).toBe(true);
  });

  it('titles the nth entry "{IP} {n}"', () => {
    expect(generateSequelScript(ip(80, 1), 'Sci-Fi', createRng(2)).title).toBe('Nightfall 2');
    expect(generateSequelScript(ip(80, 2), 'Sci-Fi', createRng(2)).title).toBe('Nightfall 3');
  });

  it('rolls quality fresh - a sequel\'s audience is inherited, its quality is not', () => {
    // Across many rng seeds the execution craft varies (it is rolled, not inherited),
    // so a franchise is no guarantee of a good film.
    const dialogues = Array.from({ length: 30 }, (_, s) => generateSequelScript(ip(80), 'Sci-Fi', createRng(s + 1)).dialogue);
    expect(new Set(dialogues).size).toBeGreaterThan(3);
    for (const d of dialogues) expect(d).toBeGreaterThanOrEqual(1);
  });

  it('reads as high-marketability - far above any original', () => {
    const sequel = generateSequelScript(ip(85), 'Sci-Fi', createRng(3));
    // deriveMarketability is recognition-dominated, so an 85-recognition franchise
    // entry lands high regardless of its rolled concept stats.
    expect(deriveMarketability(sequel)).toBeGreaterThan(60);
  });
});
