import { describe, it, expect } from 'vitest';
import { generatePremise } from './premiseGenerator';
import { PREMISE_BANKS, STORY_TYPE_PREMISES } from '../data/premises';
import { createRng, hashUnit } from './random';

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
      for (let n = 1; n <= 20; n++) {
        const s = generatePremise(genre, 'Heist', 'ContemporaryCity', null, `Title ${n}`, new Set(), createRng(1));
        if (heistLoglines.has(s)) drewFromHeist = true;
        expect(heistLoglines.has(s), `${genre} title ${n}: ${s}`).toBe(true);
      }
      expect(drewFromHeist).toBe(true);
    }
  });

  it("falls back to the genre pool for an 'Original' story type", () => {
    const genrePool = rendered(PREMISE_BANKS.Drama.straight!);
    const s = generatePremise('Drama', 'Original', 'SmallTown', null, 'The Quiet Year', new Set(), createRng(3));
    expect(genrePool.has(s)).toBe(true);
  });

  it('nudges toward setting-tagged log-lines when the setting matches', () => {
    // Sci-Fi straight has entries tagged for SpacecraftOrStation; a Spacecraft
    // script should only ever draw one of those (the setting narrows the pool).
    const spacecraftTagged = rendered(PREMISE_BANKS['Sci-Fi'].straight!.filter((p) => p.settings?.includes('SpacecraftOrStation')));
    expect(spacecraftTagged.size).toBeGreaterThan(0);
    for (let n = 1; n <= 20; n++) {
      const s = generatePremise('Sci-Fi', 'Original', 'SpacecraftOrStation', null, `Orbit ${n}`, new Set(), createRng(1));
      expect(spacecraftTagged.has(s), `title ${n}: ${s}`).toBe(true);
    }
  });

  it('avoids repeats against the used set until the pool is exhausted', () => {
    const used = new Set<string>();
    const poolSize = PREMISE_BANKS.Horror.straight!.length;
    const produced: string[] = [];
    for (let i = 0; i < poolSize; i++) {
      // 'Any' setting won't match any tag, so the whole straight pool is in play.
      produced.push(generatePremise('Horror', 'Original', 'Other', null, `Nightfall ${i}`, used, createRng(1)));
    }
    // No genre-'Other'-tagged horror entries exist, so the full straight pool is
    // available and every draw should be distinct until it's used up.
    expect(new Set(produced).size).toBe(poolSize);
  });
});

describe('generatePremise - hashed selection', () => {
  it('gives the same script the same log-line however the rng has been advanced', () => {
    // The point of hashing: which log-line a script gets is a property of the
    // script, not of where generation happened to be in the stream. A premise
    // that moved when an unrelated draw was added upstream could never be
    // selected any earlier than it is today.
    const drift = createRng(7);
    for (let i = 0; i < 13; i++) drift();
    const a = generatePremise('Action', 'Original', 'ContemporaryCity', null, 'Cold Harbour', new Set(), createRng(1));
    const b = generatePremise('Action', 'Original', 'ContemporaryCity', null, 'Cold Harbour', new Set(), drift);
    expect(b).toBe(a);
  });

  it('gives different scripts different log-lines', () => {
    const titles = Array.from({ length: 25 }, (_, i) => `Feature ${i}`);
    const produced = titles.map((t) => generatePremise('Action', 'Original', 'ContemporaryCity', null, t, new Set(), createRng(1)));
    // Distinct titles must spread across the pool rather than clustering on one
    // entry - a hash that bunched would be worse than the draw it replaced.
    // Measured at 19 of 25 for a pool of 25 (uniform expectation ~16); the floor
    // is set near that rather than at a token value, so a hash that started
    // clustering would actually trip it.
    expect(new Set(produced).size).toBeGreaterThanOrEqual(12);
  });

  it('keys the hash on the pool as well as the title', () => {
    // Asserted against the index the key actually produces, not merely that two
    // pools give different text - two pools with disjoint content differ at ANY
    // index, so a looser check passes even with the pool key removed from the
    // hash entirely (verified: it survives that mutation, which is why this test
    // reconstructs the index instead).
    //
    // A repeat title landing in a different pool must be free to sit at a
    // different offset within it; keying on the pool is what allows that.
    const title = 'The Take';
    const cases = [
      { key: 'story:Heist', entries: STORY_TYPE_PREMISES.Heist!, call: () => generatePremise('Action', 'Heist', 'ContemporaryCity', null, title, new Set(), createRng(1)) },
      { key: 'Action:straight', entries: PREMISE_BANKS.Action.straight!, call: () => generatePremise('Action', 'Original', 'ContemporaryCity', null, title, new Set(), createRng(1)) },
    ];
    for (const { key, entries, call } of cases) {
      const index = Math.floor(hashUnit(`${title}|${key}`) * entries.length);
      expect(call(), `pool ${key}`).toBe([...rendered([entries[index]])][0]);
    }
  });

  it('consumes exactly one draw, so this stage cannot move anything downstream', () => {
    // Pins the deliberately-discarded draw described in generatePremise. When
    // premise selection actually moves, this test is what should be deleted
    // alongside it - not quietly re-baselined.
    const counted = createRng(5);
    let draws = 0;
    const counting = () => { draws += 1; return counted(); };
    generatePremise('Drama', 'Original', 'SmallTown', null, 'Anything', new Set(), counting);
    expect(draws).toBe(1);
  });
});
