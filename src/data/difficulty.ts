// The starting-stature ladder a new studio picks from (components/common/
// DifficultyPicker.tsx) - data, so the player-economy harness (state/playerBot.ts)
// can start its scripted studios from the same tiers a player does.

export interface DifficultyTier {
  id: string;
  label: string;
  cash: number;
  brand: number;
  prestige: number;
  description: string;
}

// Ordered hardest -> easiest. Calibrated against the game's own economics
// rather than picked out of the air: a single Big/tentpole film's total
// commitment runs up to ~£200M (engine/rivalStudios.ts's own diagnostic:
// Big averages ~£70M, tops out near £172M), and the AI Major rival starts on
// £260M cash with Brand 70 / Prestige 55. So the player's own tiers ladder up
// to genuine studio scale - the old flat £25M "Major" couldn't fund even one
// blockbuster. Brand/Prestige climb with the label too (mirroring
// STARTING_BRAND/PRESTIGE_BY_TIER for rivals, extended below Indie and above
// Major), and the mid tiers lean prestige-forward the way a real boutique
// (an A24) trades on critical standing ahead of its balance sheet.
export const DIFFICULTY_TIERS: DifficultyTier[] = [
  { id: 'garage', label: 'Garage Outfit', cash: 500_000, brand: 3, prestige: 4, description: 'An unknown name and pocket change - one microbudget film is all you can risk. Brutal.' },
  { id: 'grassroots', label: 'Grassroots Indie', cash: 2_000_000, brand: 10, prestige: 14, description: 'Barely enough for one small film at a time. High risk, high reward.' },
  { id: 'indie', label: 'Established Indie', cash: 8_000_000, brand: 24, prestige: 30, description: 'A modest catalogue and a cult following - room for a few missteps.' },
  { id: 'boutique', label: 'Boutique Studio', cash: 25_000_000, brand: 34, prestige: 48, description: 'A tastemaker\'s name ahead of its balance sheet - critics already respect you.' },
  { id: 'midmajor', label: 'Mid-Major Studio', cash: 80_000_000, brand: 52, prestige: 50, description: 'A recognised name with real resources - you can mount an ambitious film from the off.' },
  { id: 'major', label: 'Major Studio', cash: 200_000_000, brand: 72, prestige: 60, description: 'A household name with deep pockets - a genuine tentpole is within reach on day one.' },
  { id: 'legacy', label: 'Legacy Powerhouse', cash: 500_000_000, brand: 92, prestige: 80, description: 'A century of hits and awards behind you - fund blockbusters and prestige plays at will.' },
];

