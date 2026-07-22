import { describe, it, expect } from 'vitest';
import { describeWriter, writerTierLabel } from './writerPresentation';
import { HANDCRAFTED_WRITERS } from '../data/handcraftedTalents';
import { withRng } from './random';
import { generateTalentPool } from './talentGenerator';

describe('describeWriter', () => {
  it('gives a handcrafted writer a tier and a genre/craft-aware "known for"', () => {
    const sorkin = HANDCRAFTED_WRITERS.find((w) => w.identity.name === 'Aaron Sorkin')!;
    const d = describeWriter(sorkin)!;
    expect(d.tier).toBe('Elite writer'); // high skill + fame
    expect(d.knownFor).toContain('dialogue-driven'); // his standout craft axis
    expect(d.knownFor).toContain('dramas'); // his top genre affinity
  });

  it("reflects an auteur's low-standing/originality differently from a commercial craftsman", () => {
    const kaufman = HANDCRAFTED_WRITERS.find((w) => w.identity.name === 'Charlie Kaufman')!;
    const d = describeWriter(kaufman)!;
    expect(d.knownFor).toContain('boldly original'); // originality 100 is his top craft
  });

  it('returns null for a person with no writer career', () => {
    const pool = withRng(1, (rng) => generateTalentPool(rng)).result;
    expect(describeWriter(pool.Actor[0])).toBeNull();
  });

  it('tier labels escalate with standing', () => {
    expect(writerTierLabel(90)).toBe('Elite');
    expect(writerTierLabel(70)).toBe('Acclaimed');
    expect(writerTierLabel(10)).toBe('Emerging');
  });

  it('never leaks a raw number into the copy', () => {
    const writers = withRng(2, (rng) => generateTalentPool(rng)).result.Writer.slice(0, 30);
    for (const w of writers) {
      const d = describeWriter(w)!;
      expect(`${d.tier} ${d.knownFor}`).not.toMatch(/\d/);
    }
  });
});
