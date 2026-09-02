import type { StudioTier } from '../types';

// The AI rival studios are named after real Hollywood studios, drawn once at
// game start (engine/rivalStudios.ts:generateRivalStudios) - flavor only,
// same spirit as data/scriptWords.ts for script titles. Each tier has its own
// pool of real-world studios whose real market standing matches that tier, so
// a Major rival reads like a real major (Warner Bros., Universal), a Mid-Size
// like a real mini-major (Lionsgate, New Line), and an Indie like a real
// independent (A24, Neon).
//
// Each pool holds eight names. The roster is 8 Indie / 6 Mid-Size / 5 Major
// (INITIAL_ROSTER_TIERS), so Mid-Size and Major still vary from game to game
// while Indie now draws its whole pool - every specialty name is used every
// game. That is the deliberate trade for a field the right size; if Indie
// variety is wanted back, this pool is where to add names, not the roster.
export const RIVAL_STUDIO_NAMES_BY_TIER: Record<StudioTier, string[]> = {
  Indie: [
    'A24',
    'Neon',
    'Focus Features',
    'Blumhouse Productions',
    'Searchlight Pictures',
    'Annapurna Pictures',
    'IFC Films',
    'STX Entertainment',
  ],
  'Mid-Size': [
    'Lionsgate',
    'New Line Cinema',
    'DreamWorks Pictures',
    'TriStar Pictures',
    'Amblin Entertainment',
    'Orion Pictures',
    'Summit Entertainment',
    'Castle Rock Entertainment',
  ],
  Major: [
    'Warner Bros. Pictures',
    'Universal Pictures',
    'Paramount Pictures',
    'Walt Disney Pictures',
    'Columbia Pictures',
    '20th Century Studios',
    'Sony Pictures',
    'Metro-Goldwyn-Mayer',
  ],
};
