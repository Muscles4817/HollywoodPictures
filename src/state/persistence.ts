import type { GameState } from './gameState';
import { INITIAL_STUDIO } from './gameState';
import { randomSeed } from '../engine/random';

// Bump this whenever a persisted shape changes incompatibly (e.g. the v1 -> v2
// move from enum-tier production choices to continuous ones) so old saves are
// cleanly ignored instead of partially loading with missing/mismatched fields.
const SAVE_KEY = 'hollywood-pictures-save-v2';

export function loadState(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) throw new Error('no save');
    const parsed = JSON.parse(raw) as GameState;
    if (!parsed.studio) throw new Error('malformed save');
    return parsed;
  } catch {
    return { studio: INITIAL_STUDIO, screen: 'dashboard', draft: null, rngSeed: randomSeed() };
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
