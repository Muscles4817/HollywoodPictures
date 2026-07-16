import type { FilmDraft } from '../types';
import { computeProductionBudgetCost } from './cost';
import { computePlayerReleaseStrength, type UpcomingRelease } from './releaseCrowding';

export interface ScheduledRelease {
  draft: FilmDraft;
  releaseDay: number;
}

/**
 * A ScheduledRelease reduced to what computeCompetitiveCrowding needs - see
 * engine/releaseCrowding.ts:UpcomingRelease. Release resolution itself
 * (turning a due ScheduledRelease into a real Film) lives in
 * engine/marketSettlement.ts:settleTheatricalMarket now, unified with rival
 * release resolution and ongoing box office settlement so every film can
 * genuinely compete for screens against every other, not just its own
 * owner's - this conversion is what's left here: the one place a
 * ScheduledRelease's own competitive strength is computed, reused by
 * marketSettlement.ts and by engine/rivalStudios.ts (which needs the same
 * conversion to build startRivalProductionFromWonScript's own crowding
 * check) - one formula, not two independent implementations.
 */
export function asUpcomingRelease(s: ScheduledRelease): UpcomingRelease {
  return {
    releaseDay: s.releaseDay,
    genre: s.draft.genre!,
    targetAudience: s.draft.targetAudience!,
    strength: computePlayerReleaseStrength(s.draft.marketingChoices!.marketingSpend, computeProductionBudgetCost(s.draft.productionChoices!)),
  };
}
