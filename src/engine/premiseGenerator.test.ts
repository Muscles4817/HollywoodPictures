import { describe, it, expect } from 'vitest';
import { generatePremise } from './premiseGenerator';
import { PREMISE_BANKS, STORY_TYPE_PREMISES } from '../data/premises';
import { createRng } from './random';

function rendered(premises: { protagonist: string; synopsis: string; antagonist: string | null }[]): Set<string> {
  return new Set(
    premises.map((p) =>
      p.synopsis
        .replaceAll('{protagonist}', p.protagonist.charAt(0).toUpperCase() + p.protagonist.slice(1))
        .replaceAll('{antagonist}', p.antagonist ?? ''),
    ),
  );
}

describe('generatePremise - concept-aware selection', () => {
  it("draws from the Story Type's own pool when the script has a real hook (a heist reads like a heist)", () => {
    const heistLoglines = rendered(STORY_TYPE_PREMISES.Heist!);
    // Every genre pairs with a Heist here; the log-line must come from the
    // Heist pool regardless of genre, not the genre's own bank.
    for (const genre of ['Action', 'Comedy', 'Thriller', 'Drama'] as const) {
      let drewFromHeist = false;
      for (let seed = 1; seed <= 20; seed++) {
        const s = generatePremise(genre, 'Heist', 'ContemporaryCity', null, new Set(), createRng(seed));
        if (heistLoglines.has(s)) drewFromHeist = true;
        expect(heistLoglines.has(s), `${genre} seed ${seed}: ${s}`).toBe(true);
      }
      expect(drewFromHeist).toBe(true);
    }
  });

  it("falls back to the genre pool for an 'Original' story type", () => {
    const genrePool = rendered(PREMISE_BANKS.Drama.straight!);
    const s = generatePremise('Drama', 'Original', 'SmallTown', null, new Set(), createRng(3));
    expect(genrePool.has(s)).toBe(true);
  });

  it('nudges toward setting-tagged log-lines when the setting matches', () => {
    // Sci-Fi straight has entries tagged for SpacecraftOrStation; a Spacecraft
    // script should only ever draw one of those (the setting narrows the pool).
    const spacecraftTagged = rendered(PREMISE_BANKS['Sci-Fi'].straight!.filter((p) => p.settings?.includes('SpacecraftOrStation')));
    expect(spacecraftTagged.size).toBeGreaterThan(0);
    for (let seed = 1; seed <= 20; seed++) {
      const s = generatePremise('Sci-Fi', 'Original', 'SpacecraftOrStation', null, new Set(), createRng(seed));
      expect(spacecraftTagged.has(s), `seed ${seed}: ${s}`).toBe(true);
    }
  });

  it('avoids repeats against the used set until the pool is exhausted', () => {
    const used = new Set<string>();
    const poolSize = PREMISE_BANKS.Horror.straight!.length;
    const produced: string[] = [];
    for (let i = 0; i < poolSize; i++) {
      // 'Any' setting won't match any tag, so the whole straight pool is in play.
      produced.push(generatePremise('Horror', 'Original', 'Other', null, used, createRng(100 + i)));
    }
    // No genre-'Other'-tagged horror entries exist, so the full straight pool is
    // available and every draw should be distinct until it's used up.
    expect(new Set(produced).size).toBe(poolSize);
  });
});
