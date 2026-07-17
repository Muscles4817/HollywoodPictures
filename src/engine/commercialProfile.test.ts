// Screenplay redesign (docs/DESIGN.md, "split marketability") - Script no
// longer stores a single marketability stat; these three hidden values are
// derived on demand instead. Tested directly (not just through whatever
// happens to call it) since nothing else in this codebase exercises every
// input combination.
import { describe, it, expect } from 'vitest';
import { deriveCommercialProfile } from './commercialProfile';

const base = {
  genre: 'Action' as const,
  archetype: 'GenreFormula' as const,
  storyType: 'Original' as const,
  scale: 'Medium' as const,
  structure: 50,
  characters: 50,
  originality: 50,
  primarySetting: 'ContemporaryCity' as const,
  cast: [],
};

describe('deriveCommercialProfile', () => {
  it('every value stays within [0, 100]', () => {
    const profile = deriveCommercialProfile(base);
    for (const value of [profile.accessibility, profile.hookStrength, profile.crossoverPotential]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });

  it('a Spectacle/Epic/Mass-Market-genre concept has higher accessibility than a Prestige/Intimate/Niche-genre concept', () => {
    const broad = deriveCommercialProfile({ ...base, archetype: 'Spectacle', scale: 'Epic', genre: 'Action' });
    const narrow = deriveCommercialProfile({ ...base, archetype: 'Prestige', scale: 'Intimate', genre: 'Drama' });
    expect(broad.accessibility).toBeGreaterThan(narrow.accessibility + 20);
  });

  it('higher originality increases crossoverPotential, holding everything else fixed', () => {
    const low = deriveCommercialProfile({ ...base, originality: 10 });
    const high = deriveCommercialProfile({ ...base, originality: 95 });
    expect(high.crossoverPotential).toBeGreaterThan(low.crossoverPotential);
  });

  it('higher structure/characters increases hookStrength, holding everything else fixed', () => {
    const low = deriveCommercialProfile({ ...base, structure: 10, characters: 10 });
    const high = deriveCommercialProfile({ ...base, structure: 95, characters: 95 });
    expect(high.hookStrength).toBeGreaterThan(low.hookStrength);
  });

  it('a Documentary has meaningfully lower accessibility than a Superhero story of the same genre/scale/archetype', () => {
    const documentary = deriveCommercialProfile({ ...base, storyType: 'Documentary' });
    const superhero = deriveCommercialProfile({ ...base, storyType: 'Superhero' });
    expect(superhero.accessibility).toBeGreaterThan(documentary.accessibility + 15);
  });

  it("archetype commercial bias moves the numbers in its declared direction - Prestige lowers accessibility/hookiness relative to CrowdPleaser, all else equal", () => {
    const prestige = deriveCommercialProfile({ ...base, archetype: 'Prestige' });
    const crowdPleaser = deriveCommercialProfile({ ...base, archetype: 'CrowdPleaser' });
    expect(crowdPleaser.accessibility).toBeGreaterThan(prestige.accessibility);
    expect(crowdPleaser.hookStrength).toBeGreaterThan(prestige.hookStrength);
  });
});
