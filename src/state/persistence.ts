import type { GameState } from './gameState';
import { createInitialStudio } from './gameState';
import { randomSeed, withRng } from '../engine/random';

// Bump this whenever a persisted shape changes incompatibly (e.g. v2 -> v3
// moved the talent roster from a per-film draft to a persistent Studio
// field; v3 -> v4 replaced Talent.genreAffinities with Talent/Script
// toneProfile; v4 -> v5 split Talent into a discriminated union - Director
// keeps toneProfile, Actors got actingStyle instead of skill+toneProfile,
// crew roles lost their unused toneProfile) so old saves are cleanly
// ignored instead of partially loading with missing/mismatched fields.
const SAVE_KEY = 'hollywood-pictures-save-v5';

export function loadState(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) throw new Error('no save');
    const parsed = JSON.parse(raw) as GameState;
    if (!parsed.studio) throw new Error('malformed save');
    return parsed;
  } catch {
    // No save (or an incompatible one) - generate a fresh studio, including
    // its talent pool, from a genuinely random seed.
    const { result: studio, nextSeed } = withRng(randomSeed(), (rng) => createInitialStudio(rng));
    return { studio, screen: 'dashboard', draft: null, rngSeed: nextSeed };
  }
}

export function saveState(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable (private mode, quota, etc.) - fail silently, game still works in-memory.
  }
}

export function clearSavedState(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
