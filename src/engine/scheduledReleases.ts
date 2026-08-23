import type { FilmDraft, Genre } from '../types';
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
    // The frozen genre-identity snapshot (types/index.ts:MarketingChoices.studioGenreIdentity,
    // set at SCHEDULE_RELEASE) lifts an on-brand release's presence so rivals steer around
    // the player's home turf - the player-side mirror of rivalAsUpcomingRelease reading a
    // rival production's own frozen genreIdentity. Absent => 0 => the pre-identity behaviour.
    strength: computePlayerReleaseStrength(
      s.draft.marketingChoices!.marketingSpend,
      computeProductionBudgetCost(s.draft.productionChoices!),
      s.draft.marketingChoices!.studioGenreIdentity ?? 0,
    ),
  };
}

/**
 * An ANNOUNCED-but-unfinished project as it appears on rivals' calendars - the
 * claim they can see and steer around (section 9.1 of the project-clocks doc).
 * Null when the project has announced nothing, or is too early to read.
 *
 * Its strength deliberately carries NO marketing term: a studio that has merely
 * named a date has not bought a campaign yet, and rivals can only weigh what is
 * actually visible - the production's scale and the studio's standing in that
 * genre. So a bare announcement is a weak claim that a confident rival will
 * happily open against.
 *
 * That is the intended staging rather than a gap. Once a campaign is committed
 * against the date, the same film reads far stronger and the claim starts
 * genuinely deterring - which is what makes committing marketing early a real
 * decision rather than bookkeeping.
 */
export function announcedAsUpcomingRelease(draft: FilmDraft, genreIdentity: number): UpcomingRelease | null {
  if (draft.announcedReleaseDay === undefined || !draft.genre || !draft.targetAudience || !draft.productionChoices) return null;
  return {
    releaseDay: draft.announcedReleaseDay,
    genre: draft.genre,
    targetAudience: draft.targetAudience,
    strength: computePlayerReleaseStrength(
      draft.marketingChoices?.marketingSpend ?? 0,
      computeProductionBudgetCost(draft.productionChoices),
      genreIdentity,
    ),
  };
}

/**
 * Everything of the player's that rivals can see on the calendar: locked
 * releases plus outstanding announcements. Deliberately separate from the
 * `scheduled` list settlement resolves against - an announced film is not due
 * for release and must never be settled as one; it is only a presence rivals
 * weigh when picking their own day.
 */
export function playerCalendarPresence(
  scheduled: ScheduledRelease[],
  announcedDrafts: FilmDraft[],
  genreIdentityFor: (genre: Genre) => number,
): UpcomingRelease[] {
  const announced = announcedDrafts
    .map((draft) => announcedAsUpcomingRelease(draft, draft.genre ? genreIdentityFor(draft.genre) : 0))
    .filter((u): u is UpcomingRelease => u !== null);
  return [...scheduled.map(asUpcomingRelease), ...announced];
}
