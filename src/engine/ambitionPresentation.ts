// How much a film is betting, and how its bets landed, in words
// (docs/DESIGN_REVIEW_ambition_and_delivery.md §2.4; SIMULATION_PHILOSOPHY.md
// Principles 3 and 4). Qualitative only - the player never sees the exposure
// number or a bet's signed value, the same rule every other readout follows.
//
// Before the shoot it reads scoring.ts:computeBetExposure - the same value the
// variance gate asserts against, so the readout and the outcome can't disagree.
// After release it reads FilmResults.ambitionBets, the signed reach x delivery
// each bet actually came to.

import type { FilmResults } from '../types';

export interface BetExposureRead {
  headline: string;
  /** The dimensions doing the betting, as short phrases ("a bold concept"). Empty for a safe plan. */
  drivers: string[];
}

/** Exposure (reception points in play) at which a plan stops reading as safe / moderate / ambitious. */
const SAFE_BELOW = 4;
const MODERATE_BELOW = 12;
const AMBITIOUS_BELOW = 22;
/** A dimension is named as a driver once it carries at least this much reach (0..1). */
const DRIVER_REACH = 0.25;

export function describeBetExposure(exposure: { concept: number; structure: number; spectacle: number; total: number }): BetExposureRead {
  const drivers: string[] = [];
  if (exposure.concept >= DRIVER_REACH) drivers.push('a bold, original concept');
  if (exposure.structure >= DRIVER_REACH) drivers.push('an intricate structure');
  if (exposure.spectacle >= DRIVER_REACH) drivers.push('spectacle beyond what its budget comfortably covers');
  const headline =
    exposure.total < SAFE_BELOW
      ? 'A safe, dependable package - it should come out much as planned, for better or worse.'
      : exposure.total < MODERATE_BELOW
        ? 'Some creative risk - how the shoot goes will move it a little either way.'
        : exposure.total < AMBITIOUS_BELOW
          ? 'An ambitious swing - this could land well above or well below the plan.'
          : 'A high-wire act - this could be remarkable or a mess, and the shoot will decide which.';
  return { headline, drivers };
}

/** How a bet has to come out before it's worth naming - small outcomes stay unremarked. */
const NOTABLE = 0.3;

/** One sentence per bet that clearly paid off or clearly didn't; empty when nothing was really at stake or everything landed about as planned. */
export function describeBetOutcomes(results: Pick<FilmResults, 'ambitionBets'>): string[] {
  const bets = results.ambitionBets;
  if (!bets) return [];
  const notes: string[] = [];
  if (bets.concept >= NOTABLE) notes.push('The bold concept came off - critics are calling it a genuine original.');
  else if (bets.concept <= -NOTABLE) notes.push("The bold concept didn't come off - more pretension than vision, in the reviews.");
  if (bets.structure >= NOTABLE) notes.push('Its intricate structure held together, and critics noticed.');
  else if (bets.structure <= -NOTABLE) notes.push('Its intricate structure never quite came together - audiences got lost.');
  if (bets.spectacle >= NOTABLE) notes.push('The spectacle was the draw - the effects work landed.');
  else if (bets.spectacle <= -NOTABLE) notes.push('The spectacle looked unfinished, and audiences noticed.');
  return notes;
}
