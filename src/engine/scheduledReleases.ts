import type { Film, FilmDraft, RivalProductionInProgress } from '../types';
import { computeReleaseResults } from './releaseFilm';
import { computeTalentCost, computeProductionBudgetCost } from './cost';
import { computeCompetitiveCrowding, computePlayerReleaseStrength, computeRivalReleaseStrength, type UpcomingRelease } from './releaseCrowding';
import type { RandomFn } from './random';

export interface ScheduledRelease {
  draft: FilmDraft;
  releaseDay: number;
}

/** A ScheduledRelease reduced to what computeCompetitiveCrowding needs - see engine/releaseCrowding.ts:UpcomingRelease. Exported for state/studioReducer.ts, which needs the same conversion to build settleRivalMarket's playerScheduled argument - one formula, not two independent implementations. */
export function asUpcomingRelease(s: ScheduledRelease): UpcomingRelease {
  return {
    releaseDay: s.releaseDay,
    genre: s.draft.genre!,
    targetAudience: s.draft.targetAudience!,
    strength: computePlayerReleaseStrength(s.draft.marketingChoices!.marketingSpend, computeProductionBudgetCost(s.draft.productionChoices!)),
  };
}

function rivalAsUpcomingRelease(p: RivalProductionInProgress): UpcomingRelease {
  return {
    releaseDay: p.releaseDay,
    genre: p.genre,
    targetAudience: p.targetAudience,
    strength: computeRivalReleaseStrength(p.marketingChoices.marketingSpend, p.scale),
  };
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
  rivalUpcoming: RivalProductionInProgress[],
  totalDays: number,
  studioBrand: number,
  rng: RandomFn,
): ScheduledReleaseSettlement {
  const due = scheduled.filter((s) => s.releaseDay <= totalDays);
  const stillScheduled = scheduled.filter((s) => s.releaseDay > totalDays);
  const rivalKnown = rivalUpcoming.map(rivalAsUpcomingRelease);

  let costCharged = 0;
  const newlyReleased = due.map(({ draft: d, releaseDay }) => {
    const photographyEvents = d.photography!.events;
    const shootingRatio = d.photography!.recommendedDays > 0 ? d.photography!.daysElapsed / d.photography!.recommendedDays : 1;
    // Everyone else still on the shared calendar from this settlement's own
    // point of view - every other scheduled player project (whether due
    // this same pass or still waiting) plus every rival production in
    // progress, excluding this film itself. Computed once, here, at
    // settlement time and never revisited - same "frozen once, at release"
    // semantic every other field of `fixed` already has (see
    // engine/releaseCrowding.ts's own doc comment).
    const otherPlayerKnown = scheduled.filter((s) => s.draft.id !== d.id).map(asUpcomingRelease);
    const competitiveCrowding = computeCompetitiveCrowding(
      { releaseDay, genre: d.genre!, targetAudience: d.targetAudience! },
      [...otherPlayerKnown, ...rivalKnown],
    );
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
        competitiveCrowding,
      },
      rng,
    );

    // Talent salary, the non-contingency production budget, and the
    // contingency reserve were already deducted (and, for contingency,
    // settled) back when photography actually happened - only the
    // remainder of results.totalCost (script cost, event cost swings, the
    // test screening fee, and marketing) is newly charged at release.
    const alreadyCharged = computeTalentCost(d.talent.map((a) => a.talent)) + computeProductionBudgetCost(d.productionChoices!) + d.photography!.runningCost;
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
      // Carried forward from the draft so engine/project.ts:deriveAssetStatus
      // can actually find this release once it's done - previously omitted
      // here, which silently meant no released player film ever counted as
      // "used" for its originating Asset (state/selectors.ts:computeProjectSpendSoFar's
      // own tests caught this while adding the Projects page).
      assetId: d.assetId,
    };
    return film;
  });

  return { stillScheduled, newlyReleased, costCharged };
}
