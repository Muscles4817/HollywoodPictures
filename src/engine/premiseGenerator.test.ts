import { describe, it, expect } from 'vitest';
import { generatePremise, selectPool, startIndex } from './premiseGenerator';
import { PREMISE_BANKS, STORY_TYPE_PREMISES, type Premise } from '../data/premises';
import { GENRES } from '../data/genres';
import { STORY_TYPES } from '../data/storyTypes';
import { SETTING_ARCHETYPES } from '../data/settings';
import { TONES } from '../data/tones';
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
    const heist = selectPool('Action', 'Heist', 'ContemporaryCity', null);
    const drama = selectPool('Drama', 'Heist', 'ContemporaryCity', null);
    // Same specific tier, different bank behind it - the key must separate them,
    // or one recurring title would drag the same offset through both.
    expect(heist.key).not.toBe(drama.key);
    expect(heist.key).toContain('story:Heist');
    expect(drama.key).toContain('story:Heist');
  });

  it('actually feeds that key into the hash', () => {
    // Comparing two keys proves the key is well-formed, not that anything reads
    // it - that version of this test stays green with `|${key}` deleted from the
    // hash entirely. This reconstructs the index the key produces and asserts
    // the entry at it, which does not.
    const title = 'The Take';
    for (const pool of [selectPool('Action', 'Heist', 'ContemporaryCity', null), selectPool('Sci-Fi', 'Original', 'SpacecraftOrStation', null)]) {
      const index = startIndex(hashUnit(`${title}|${pool.key}`), pool.entries.length, pool.preferredCount);
      const expected = [...rendered([pool.entries[index]])][0];
      const actual = pool.key.startsWith('story:Heist')
        ? generatePremise('Action', 'Heist', 'ContemporaryCity', null, title, new Set(), createRng(1))
        : generatePremise('Sci-Fi', 'Original', 'SpacecraftOrStation', null, title, new Set(), createRng(1));
      expect(actual, `pool ${pool.key}`).toBe(expected);
    }
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

describe('selectPool - reachability', () => {
  it('puts every authored log-line into some pool, so nothing is written and never reachable', () => {
    // The quiet failure of a tiered pool is an entry that exists, sits in a bank,
    // and can never be selected because the tier in front always wins. Checked
    // here at the pool level rather than by sampling generated scripts: sampling
    // passes even under strict priority, because a slate's collision walk
    // eventually mops up entries the hash never points at.
    const authored = new Set<Premise>();
    for (const bank of Object.values(PREMISE_BANKS)) {
      for (const entries of Object.values(bank)) for (const p of entries as Premise[]) authored.add(p);
    }
    for (const entries of Object.values(STORY_TYPE_PREMISES)) for (const p of entries as Premise[]) authored.add(p);

    const reachable = new Set<Premise>();
    for (const genre of GENRES) {
      for (const storyType of STORY_TYPES) {
        for (const setting of SETTING_ARCHETYPES) {
          for (const tone of [...TONES, null]) {
            const pool = selectPool(genre, storyType, setting, tone);
            for (const p of pool.entries) reachable.add(p);
            // A pool must also never repeat an entry, or one log-line would hold
            // two slots of the hash space and read as the pool's favourite.
            expect(new Set(pool.entries).size, `duplicate in ${pool.key}`).toBe(pool.entries.length);
            expect(pool.entries.length, `empty pool ${pool.key}`).toBeGreaterThan(0);
            expect(pool.preferredCount).toBeLessThanOrEqual(pool.entries.length);
          }
        }
      }
    }
    expect(reachable.size).toBe(authored.size);
  });
});

describe('startIndex - the two-tier hash split', () => {
  // The statistical brackets above pass a mutation that makes the tail of every
  // tiered pool unreachable (returning `0 + ...` instead of `preferredCount + ...`
  // still lands inside the bracket while killing the wide tier's front). These
  // pin the boundaries directly, so that class of slip fails the normal suite
  // rather than only the opt-in diagnostic.
  const SHARE = 0.6; // premiseGenerator.ts:PREFERRED_SHARE
  const EPS = 1e-9;

  it('spends exactly the preferred share on the preferred tier', () => {
    expect(startIndex(0, 30, 5)).toBe(0);
    expect(startIndex(SHARE - EPS, 30, 5)).toBe(4); // last preferred entry
    expect(startIndex(SHARE, 30, 5)).toBe(5); // first wide entry
    expect(startIndex(1 - EPS, 30, 5)).toBe(29); // last wide entry
  });

  it('never returns an index outside the pool, at either boundary or either extreme', () => {
    for (const [total, preferredCount] of [[1, 0], [1, 1], [25, 0], [25, 25], [30, 1], [30, 29], [6, 5]] as const) {
      for (const hash of [0, SHARE - EPS, SHARE, 1 - EPS]) {
        const index = startIndex(hash, total, preferredCount);
        expect(index, `total=${total} pc=${preferredCount} hash=${hash}`).toBeGreaterThanOrEqual(0);
        expect(index, `total=${total} pc=${preferredCount} hash=${hash}`).toBeLessThan(total);
      }
    }
  });

  it('falls back to a flat spread when there is no tier split to make', () => {
    // No specific tier, or a specific tier that is the whole pool: the split has
    // nothing to say and the hash should scale across everything evenly.
    expect(startIndex(0.5, 10, 0)).toBe(5);
    expect(startIndex(0.5, 10, 10)).toBe(5);
  });
});
