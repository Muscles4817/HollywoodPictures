import type { GameState } from './gameState';
import { createInitialStudio } from './gameState';
import { randomSeed, withRng } from '../engine/random';

// Bump this whenever a persisted shape changes incompatibly (e.g. v2 -> v3
// moved the talent roster from a per-film draft to a persistent Studio
// field; v3 -> v4 replaced Talent.genreAffinities with Talent/Script
// toneProfile; v4 -> v5 split Talent into a discriminated union - Director
// keeps toneProfile, Actors got actingStyle instead of skill+toneProfile,
// crew roles lost their unused toneProfile; v5 -> v6 added
// requiredLeads/requiredSupporting/intendedAudience to Script; v6 -> v7
// reworked box office - MarketingChoices.marketingSpend became a continuous
// number instead of a named tier, and FilmResults gained studioRevenue;
// v7 -> v8 renamed ProductionChoices.budgetAmount to contingencyAmount;
// v8 -> v9 replaced Studio.year with Studio.totalDays and Film.yearReleased
// with Film.releasedOnDay, dropped ProductionChoices.shootingIntensity, and
// added FilmDraft.photography (principal photography as a live day-by-day
// process, replacing the old batch-computed draft.events)) so old saves are
// cleanly ignored instead of partially loading with missing/mismatched
// fields.
// v9 -> v10 replaced ProductionEvent.delayRiskDelta (decorative) with a real
// delayDaysDelta, and added PhotographyState.pendingChoice for interactive
// on-set events (docs/DESIGN.md 5.x).
// v10 -> v11 made FilmResults.totalBoxOffice/studioRevenue/profit/outcome/
// reputationChange nullable (unknown until a film's run finishes) and added
// Film.boxOfficeRun - box office as a live weekly process instead of a
// single computed total at release (docs/DESIGN.md 5.19).
// v11 -> v12 added a required `severity` field to ProductionEvent and
// PendingEventChoice (docs/DESIGN.md 5.21).
// v12 -> v13 added AI rival studios - Studio gained required rivalStudios/
// rivalProductionsInProgress/rivalFilmsReleased, Talent gained optional
// bookedUntil, and Film gained optional releasedBy (docs/DESIGN.md 5.24).
// v13 -> v14 added GameState.viewingRivalStudioName (which rival studio the
// new 'rival-studio' screen is showing) and made RESET_SAVE take a
// player-chosen starting cash instead of a hardcoded default.
// v14 -> v15 added required environmentStrategy/environmentAmbition/
// effectsStrategy/effectsAmbition to Script and a required productionStyle
// (environmentStrategy/effectsStrategy) to DirectorTalent - the producer-
// recommendation model foundation (docs/DESIGN.md), not yet consumed by any
// screen.
const SAVE_KEY = 'hollywood-pictures-save-v15';

/** Starting cash for a save created with no explicit difficulty choice (first-ever launch). Reset always lets the player pick instead - see Dashboard.tsx:DifficultyPicker. */
const DEFAULT_STARTING_CASH = 10_000_000;

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
    const { result: studio, nextSeed } = withRng(randomSeed(), (rng) => createInitialStudio(rng, DEFAULT_STARTING_CASH));
    return { studio, screen: 'dashboard', draft: null, rngSeed: nextSeed, viewingRivalStudioName: null };
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
