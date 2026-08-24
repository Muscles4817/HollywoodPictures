import { describe, it, expect } from 'vitest';
import { generateSequelScript, generateScriptOptions } from './scriptGenerator';
import { render } from './premiseGenerator';
import { PREMISE_BANKS, STORY_TYPE_PREMISES, type Premise } from '../data/premises';
import { GENRES } from '../data/genres';
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

  it('inherits a returning role\'s demand row verbatim, rather than re-shaping an already-shaped row', () => {
    // engine/characterDemands.ts:scriptShapedCast is NOT idempotent - it scales a
    // demand toward how much of that thing the script contains. IP characters
    // carry traits copied off the source film's script, which were already shaped
    // there, so re-shaping them here would compound once per sequel and eventually
    // pin at the clamp. A returning character's brief must match the one the IP
    // screen shows for them.
    const sequel = generateSequelScript(ip(82), 'Sci-Fi', createRng(1));
    for (const c of sequel.cast) {
      expect(c.traits.physicalDemand).toBe(traits.physicalDemand);
      expect(c.traits.comedyDemand).toBe(traits.comedyDemand);
      expect(c.traits.emotionalDemand).toBe(traits.emotionalDemand);
    }
  });

  it('does not drift a returning role further from itself with each successive sequel', () => {
    const first = generateSequelScript(ip(82, 1), 'Sci-Fi', createRng(1));
    const asIp = { ...ip(82, 2), characters: ip().characters.map((c, i) => ({ ...c, traits: first.cast[i].traits })) };
    const second = generateSequelScript(asIp, 'Sci-Fi', createRng(2));
    for (const [i, c] of second.cast.entries()) {
      expect(c.traits.physicalDemand).toBe(first.cast[i].traits.physicalDemand);
      expect(c.traits.emotionalDemand).toBe(first.cast[i].traits.emotionalDemand);
    }
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

describe('a sequel never contradicts its own inherited cast', () => {
  // The reverse of the constraint everywhere else. A normal script grows its cast
  // to fit its concept; a sequel cannot, because its Leads are specific returning
  // characters. So the log-line has to give way instead - ensemble entries are
  // filtered out of the pool before selection rather than picked and ignored.
  const promised = new Map<string, number>();
  const collect = (entries: Premise[]) => { for (const p of entries) if (p.leads) promised.set(render(p), p.leads); };
  for (const bank of Object.values(PREMISE_BANKS)) for (const entries of Object.values(bank)) collect(entries as Premise[]);
  for (const entries of Object.values(STORY_TYPE_PREMISES)) collect(entries as Premise[]);

  /** An IP whose cast holds exactly `leadCount` Leads plus one Supporting. */
  function ipWith(leadCount: number): IntellectualProperty {
    const characters = Array.from({ length: leadCount + 1 }, (_, i) => ({
      ...ipChar(`Char ${i}`, i < leadCount ? 'Lead' : 'Supporting'),
      id: `ipc-${i}`,
    }));
    return { ...ip(80, 1), characters };
  }

  it('is never handed a log-line about more people than it has Leads', () => {
    for (const leadCount of [1, 2]) {
      let checked = 0;
      for (const genre of GENRES) {
        for (let seed = 1; seed <= 60; seed++) {
          const sequel = generateSequelScript(ipWith(leadCount), genre, createRng(seed));
          expect(sequel.requiredLeads).toBe(leadCount);
          const names = promised.get(sequel.synopsis);
          if (names !== undefined) {
            checked += 1;
            expect(names, `${genre} seed ${seed}: "${sequel.synopsis.slice(0, 50)}" needs ${names} leads, cast has ${leadCount}`)
              .toBeLessThanOrEqual(leadCount);
          }
        }
      }
      // A two-Lead sequel should still REACH two-person log-lines - the ceiling
      // filters what is too big, it does not ban ensembles outright. If this ever
      // reads zero for leadCount 2 the filter has become a blanket exclusion.
      if (leadCount === 2) expect(checked).toBeGreaterThan(0);
    }
  });

  it('leaves ordinary generation unfiltered - the ceiling is a sequel-only constraint', () => {
    // Same IP shape, but generated as a normal script: ensemble log-lines must
    // still be reachable, or the sequel fix has leaked into the general path.
    const ensembleSeen = GENRES.some((genre) =>
      Array.from({ length: 40 }, (_, i) => generateScriptOptions(genre, createRng(i + 1), 12))
        .flat()
        .some((s) => (promised.get(s.synopsis) ?? 1) > 1));
    expect(ensembleSeen).toBe(true);
  });
});
