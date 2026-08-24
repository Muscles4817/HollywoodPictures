import { describe, it, expect } from 'vitest';
import { generatePremise, selectPool } from './premiseGenerator';
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
  it("usually draws from the Story Type's own pool, and from the genre's wider bank when it doesn't", () => {
    const heistLoglines = rendered(STORY_TYPE_PREMISES.Heist!);
    // The contract changed deliberately: a Heist bank holds five log-lines, and
    // under the old "most specific wins outright" those five were the ONLY ones
    // a heist could ever get. It now leads a wider pool rather than being the
    // whole of it - so a heist still mostly reads like a heist, but a player
    // commissioning heists all game is no longer shown the same five sentences.
    for (const genre of ['Action', 'Comedy', 'Thriller', 'Drama'] as const) {
      const genreLoglines = rendered(PREMISE_BANKS[genre].straight!);
      const draws = 200;
      let fromHeist = 0;
      for (let n = 1; n <= draws; n++) {
        const s = generatePremise(genre, 'Heist', 'ContemporaryCity', null, `Title ${n}`, new Set(), createRng(1));
        if (heistLoglines.has(s)) fromHeist += 1;
        else expect(genreLoglines.has(s), `${genre} title ${n} came from neither bank: ${s}`).toBe(true);
      }
      // Bracketed either side of PREFERRED_SHARE: too low and the Story Type has
      // stopped mattering, too high and the widening has stopped working.
      expect(fromHeist / draws, `${genre} heist share`).toBeGreaterThan(0.45);
      expect(fromHeist / draws, `${genre} heist share`).toBeLessThan(0.8);
    }
  });

  it("falls back to the genre pool for an 'Original' story type", () => {
    const genrePool = rendered(PREMISE_BANKS.Drama.straight!);
    const s = generatePremise('Drama', 'Original', 'SmallTown', null, 'The Quiet Year', new Set(), createRng(3));
    expect(genrePool.has(s)).toBe(true);
  });

  it('leans toward setting-tagged log-lines when the setting matches', () => {
    const spacecraftTagged = rendered(PREMISE_BANKS['Sci-Fi'].straight!.filter((p) => p.settings?.includes('SpacecraftOrStation')));
    expect(spacecraftTagged.size).toBeGreaterThan(0);
    const draws = 200;
    let tagged = 0;
    for (let n = 1; n <= draws; n++) {
      const s = generatePremise('Sci-Fi', 'Original', 'SpacecraftOrStation', null, `Orbit ${n}`, new Set(), createRng(1));
      if (spacecraftTagged.has(s)) tagged += 1;
    }
    // Same reason as the Heist case: a setting-narrowed bank can hold a single
    // entry, and gating on it meant every Spacecraft sci-fi in a playthrough
    // shared one sentence.
    expect(tagged / draws).toBeGreaterThan(0.45);
    expect(tagged / draws).toBeLessThan(0.8);
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

  it('keys the hash on both tiers of the pool, not just the specific one', () => {
    // Asserted on the pool itself rather than inferred from rendered text: two
    // pools with disjoint content differ at ANY index, so a text-level check
    // passes even with the key removed from the hash entirely.
    const heist = selectPool('Action', 'Heist', 'ContemporaryCity', null);
    const drama = selectPool('Drama', 'Heist', 'ContemporaryCity', null);
    // Same specific tier, different bank behind it - the key must separate them,
    // or one recurring title would drag the same offset through both.
    expect(heist.key).not.toBe(drama.key);
    expect(heist.key).toContain('story:Heist');
    expect(drama.key).toContain('story:Heist');
  });

  it('puts the specific tier first and counts it, so selection can bias toward it', () => {
    const pool = selectPool('Action', 'Heist', 'ContemporaryCity', null);
    const heistLoglines = rendered(STORY_TYPE_PREMISES.Heist!);
    expect(pool.preferredCount).toBe(STORY_TYPE_PREMISES.Heist!.length);
    expect(pool.entries.length).toBeGreaterThan(pool.preferredCount);
    for (const entry of pool.entries.slice(0, pool.preferredCount)) {
      expect(heistLoglines.has([...rendered([entry])][0])).toBe(true);
    }
  });

  it('has no specific tier when the concept has nothing specific about it', () => {
    // An Original story type in a setting nothing is tagged for: the genre's
    // bank simply is the pool, and selection falls back to a flat hash.
    const pool = selectPool('Horror', 'Original', 'Other', null);
    expect(pool.preferredCount).toBe(0);
    expect(pool.entries).toHaveLength(PREMISE_BANKS.Horror.straight!.length);
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
