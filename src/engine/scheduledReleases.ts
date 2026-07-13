import type { Film, FilmDraft } from '../types';
import { computeReleaseResults } from './releaseFilm';
import { computeTalentCost, computeProductionBudgetCost } from './cost';
import type { RandomFn } from './random';

export interface ScheduledRelease {
  draft: FilmDraft;
  releaseDay: number;
}

export interface ScheduledReleaseSettlement {
  stillScheduled: ScheduledRelease[];
  newlyReleased: Film[];
  // Sum of results.totalCost minus what was already charged at
  // BEGIN_PHOTOGRAPHY/FINISH_PHOTOGRAPHY for every film newly released this
  // pass - the caller subtracts this from studio.cash, the same accounting
  // RELEASE_FILM always did, just now potentially resolving more than one
  // release in a single settlement pass (a big ADVANCE_DAY jump catching up
  // several scheduled releases at once).
  costCharged: number;
}

/**
 * Resolves every player project whose own `releaseDay` has arrived into a
 * real Film - the same lazy, catch-up-safe pattern
 * engine/rivalStudios.ts:settleRivalMarket already uses for
 * RivalProductionInProgress.releaseDay (resolveRivalProduction), now doing
 * the equivalent for the player's own scheduled releases (roadmap Phase
 * 7.2). Called from the same reducer sites settleBoxOfficeForAllFilms/
 * settleRivalMarket/settleProductionsInProgress already are - every action
 * that can advance GameState.totalDays. A scheduled project has already
 * made every creative decision it's going to (post-production and
 * marketing choices are both locked in by SCHEDULE_RELEASE) - nothing here
 * re-derives or re-prompts for any of that, it just waits for `releaseDay`.
 */
export function settleScheduledReleases(
  scheduled: ScheduledRelease[],
  totalDays: number,
  studioBrand: number,
  rng: RandomFn,
): ScheduledReleaseSettlement {
  const due = scheduled.filter((s) => s.releaseDay <= totalDays);
  const stillScheduled = scheduled.filter((s) => s.releaseDay > totalDays);

  let costCharged = 0;
  const newlyReleased = due.map(({ draft: d, releaseDay }) => {
    const photographyEvents = d.photography!.events;
    const shootingRatio = d.photography!.recommendedDays > 0 ? d.photography!.daysElapsed / d.photography!.recommendedDays : 1;
    const { results, fixed } = computeReleaseResults(
      {
        title: d.title || 'Untitled Film',
        genre: d.genre!,
        targetAudience: d.targetAudience!,
        script: d.script!,
        talent: d.talent,
        productionChoices: d.productionChoices!,
        postProductionChoices: d.postProductionChoices!,
        marketingChoices: d.marketingChoices!,
        events: photographyEvents,
        photographyCost: d.photography!.runningCost,
        shootingRatio,
        studioBrand,
      },
      rng,
    );

    // Talent salary, the non-contingency production budget, and the
    // contingency reserve were already deducted (and, for contingency,
    // settled) back when photography actually happened - only the
    // remainder of results.totalCost (script cost, event cost swings, the
    // test screening fee, and marketing) is newly charged at release.
    const alreadyCharged = computeTalentCost(d.talent) + computeProductionBudgetCost(d.productionChoices!) + d.photography!.runningCost;
    costCharged += results.totalCost - alreadyCharged;

    const film: Film = {
      // Roadmap Phase 5's id-churn fix carries forward here too: the
      // released Film keeps the exact id this draft has had since
      // START_NEW_FILM (see engine/project.ts), not a freshly-generated one.
      id: d.id,
      title: d.title || 'Untitled Film',
      genre: d.genre!,
      targetAudience: d.targetAudience!,
      script: d.script!,
      talent: d.talent,
      productionChoices: d.productionChoices!,
      postProductionChoices: d.postProductionChoices!,
      marketingChoices: d.marketingChoices!,
      events: photographyEvents,
      results,
      boxOfficeRun: {
        status: 'running',
        fixed,
        simWeeks: [],
        weeks: [],
        cumulativeGross: 0,
        acknowledged: false,
      },
      // The day it was actually scheduled for, not whatever `totalDays`
      // happens to be when a big ADVANCE_DAY jump catches up to it - same
      // convention resolveRivalProduction already uses for
      // Film.releasedOnDay (engine/rivalStudios.ts).
      releasedOnDay: releaseDay,
    };
    return film;
  });

  return { stillScheduled, newlyReleased, costCharged };
}
