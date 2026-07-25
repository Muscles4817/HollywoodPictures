// Studio identity - what a studio becomes *known for* (docs/DESIGN_box_office_
// calibration_targets.md §9, "studio identity via intermediate systems, emergent
// from history"). A studio's per-genre affinity is not chosen; it is earned by
// repeatedly shipping successful films in a genre and eroded by costly failures
// there. It is deliberately NOT a flat revenue multiplier - the affinity value
// produced here feeds intermediate systems (marketing efficiency, awareness
// spread, exhibitor confidence, and the competitor-territory matchup - see the
// wiring in engine/audienceSimulationInputs.ts and engine/releaseCrowding.ts),
// each of which an on-brand film gets a modest edge in.
//
// Pure data-in/data-out, like the rest of engine/ - no React, no state. The
// accumulator itself (Studio.genreIdentity / RivalStudio.genreIdentity) is a
// Partial<Record<Genre, number>> in [0, 100]; an absent genre reads as 0.

import type { Genre } from '../types';

/** A studio's current identity in a genre, 0-100. Absent (never made a hit there) reads as 0. */
export function genreIdentityFor(identity: Partial<Record<Genre, number>> | undefined, genre: Genre): number {
  return identity?.[genre] ?? 0;
}

// How commercial success in a genre translates into an identity move. Mirrors
// the profit-ratio bands of engine/reputation.ts:computeBrandChange, but gentler
// - identity is a slow, cumulative reputation, built over several films rather
// than swung by any single one - and per-genre rather than studio-wide.
const IDENTITY_PROFIT_BANDS: { max: number; change: number }[] = [
  { max: -0.5, change: -6 }, // a ruinous flop erodes the studio's name in the genre
  { max: 0.0, change: -3 }, // lost money
  { max: 0.5, change: 1 }, // thin profit - barely moves it
  { max: 1.25, change: 3 }, // a solid hit
  { max: 3.0, change: 5 }, // a big hit
  { max: Infinity, change: 7 }, // a genre-defining blockbuster
];

// How much audience love (not just money) nudges identity on top of the profit
// band - a beloved on-brand film cements the studio's name a little more, a
// hated one a little less, centred on an ordinary ~55 reception.
const IDENTITY_RECEPTION_WEIGHT = 0.05;
const IDENTITY_RECEPTION_CENTRE = 55;

export interface GenreIdentityChangeInputs {
  profit: number;
  totalCost: number;
  audienceScore: number;
}

/**
 * How much one finished film moves its studio's identity in its own genre. A
 * commercial success builds the studio's name there; a costly failure erodes it.
 * Deliberately genre-agnostic in shape (every genre earns identity the same way)
 * - which genres a studio ends up known for emerges purely from which ones it
 * keeps succeeding in, never from a hand-authored per-genre bias.
 */
export function computeGenreIdentityChange({ profit, totalCost, audienceScore }: GenreIdentityChangeInputs): number {
  const profitRatio = totalCost > 0 ? profit / totalCost : 0;
  const band = IDENTITY_PROFIT_BANDS.find((b) => profitRatio < b.max) ?? IDENTITY_PROFIT_BANDS[IDENTITY_PROFIT_BANDS.length - 1];
  const receptionNudge = (audienceScore - IDENTITY_RECEPTION_CENTRE) * IDENTITY_RECEPTION_WEIGHT;
  return band.change + receptionNudge;
}

/** Fold a finished film's identity change into a studio's accumulator for that genre, clamped to [0, 100]. Returns a new map (never mutates). */
export function applyGenreIdentityChange(
  identity: Partial<Record<Genre, number>> | undefined,
  genre: Genre,
  change: number,
): Partial<Record<Genre, number>> {
  const next = { ...(identity ?? {}) };
  next[genre] = Math.max(0, Math.min(100, genreIdentityFor(identity, genre) + change));
  return next;
}

/** Apply a whole batch of per-genre identity changes (a settlement pass's worth) to a studio's accumulator. Returns a new map; a no-op for an empty batch. */
export function applyGenreIdentityDeltas(
  identity: Partial<Record<Genre, number>> | undefined,
  deltas: Partial<Record<Genre, number>>,
): Partial<Record<Genre, number>> {
  let next: Partial<Record<Genre, number>> = { ...(identity ?? {}) };
  for (const [g, v] of Object.entries(deltas) as [Genre, number][]) {
    if (v !== 0) next = applyGenreIdentityChange(next, g, v);
  }
  return next;
}

// How strongly a studio must have invested in a genre before it reads as a real
// identity (used by presentation and the competitor-territory effect). Below the
// floor a studio is still "finding its footing" there; a genuine home genre sits
// well above it.
export const IDENTITY_ESTABLISHED_THRESHOLD = 40;

/** The genre a studio is most known for (its identity's peak), or null if nothing has crossed the established threshold. */
export function primaryGenre(identity: Partial<Record<Genre, number>> | undefined): { genre: Genre; strength: number } | null {
  if (!identity) return null;
  let best: { genre: Genre; strength: number } | null = null;
  for (const [g, v] of Object.entries(identity) as [Genre, number][]) {
    if (v >= IDENTITY_ESTABLISHED_THRESHOLD && (!best || v > best.strength)) best = { genre: g, strength: v };
  }
  return best;
}
