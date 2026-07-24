import type { Film, FilmDraft, Person, RivalProductionInProgress, RivalStudio } from '../types';
import type { RandomFn } from './random';
import { computeReleaseResults } from './releaseFilm';
import { rollPressTourMoments, pressTourReputationDeltas, windowOutcomeToMoments, type PressTourMomentsOutcome, type TalentReputationDelta } from './pressTourMoments';
import { computeProducerEffects, producersByIds, totalAttachedPerFilmFees } from './producers';
import { computeTalentCost, computeProductionBudgetCost, computeEventsCostDelta } from './cost';
import { computeCompetitiveCrowding, runningFilmAsUpcomingRelease, type UpcomingRelease } from './releaseCrowding';
import { marketingRolloutMultiplier } from './marketing';
import { resolveRivalProduction, rivalAsUpcomingRelease } from './rivalStudios';
import { nextDueFilm, advanceEarliestDueFilmByOneWeek } from './boxOfficeRun';
import { asUpcomingRelease, type ScheduledRelease } from './scheduledReleases';

export interface RivalBoxOfficeDelta {
  cashCredit: number;
  brandDelta: number;
  prestigeDelta: number;
}

export interface TheatricalMarketSettlement {
  /**
   * Every film settled this pass, any owner (the player and every rival)
   * combined, whether still running or newly finished - the same "every
   * film that's actually part of this batch" role
   * engine/boxOfficeRun.ts:settleBoxOfficeForAllFilms's own output used to
   * play for one owner at a time. Split back out by Film.releasedBy
   * (undefined = player, otherwise the rival studio name) for
   * state/studioReducer.ts's own assembleProjects.
   */
  settledFilms: Film[];
  stillScheduled: ScheduledRelease[];
  stillInProgress: RivalProductionInProgress[];
  playerCashCredit: number;
  playerBrandDelta: number;
  playerPrestigeDelta: number;
  /** The remainder of a newly-released player film's own results.totalCost not already deducted at BEGIN_PHOTOGRAPHY/FINISH_PHOTOGRAPHY - subtract from Studio.cash alongside playerCashCredit, the same accounting engine/scheduledReleases.ts's retired settleScheduledReleases always did. */
  playerCostCharged: number;
  /** Keyed by rival studio name (the same Film.releasedBy discriminator) - apply cashCredit to that studio's cash and brandDelta/prestigeDelta via applyStatChange, the same crediting engine/rivalStudios.ts's retired settleRivalBoxOffice used to do per studio. */
  rivalDeltas: Map<string, RivalBoxOfficeDelta>;
  /** Post-tour standing changes for player tourers (engine/pressTourMoments.ts), one per tourer across every player film settled this pass - applied to GameState.talentPool by id (state/studioReducer.ts). Empty when no settled player film ran a press tour. */
  playerTalentReputationDeltas: TalentReputationDelta[];
}

function creditRival(deltas: Map<string, RivalBoxOfficeDelta>, name: string, delta: RivalBoxOfficeDelta): void {
  const existing = deltas.get(name) ?? { cashCredit: 0, brandDelta: 0, prestigeDelta: 0 };
  deltas.set(name, {
    cashCredit: existing.cashCredit + delta.cashCredit,
    brandDelta: existing.brandDelta + delta.brandDelta,
    prestigeDelta: existing.prestigeDelta + delta.prestigeDelta,
  });
}

/** Everyone else still on the shared theatrical calendar from `excludeId`'s own point of view, right now - every other still-pending release (pre-release strength proxy, unchanged) plus every currently-active running film (live strength, engine/releaseCrowding.ts:runningFilmAsUpcomingRelease) - rebuilt fresh every time this is called, never cached, so it always reflects exactly what's known as of the step that's asking. */
function knownCompetitorsExcluding(
  excludeId: string,
  scheduled: ScheduledRelease[],
  inProgress: RivalProductionInProgress[],
  filmsById: ReadonlyMap<string, Film>,
): UpcomingRelease[] {
  const fromScheduled = scheduled.filter((s) => s.draft.id !== excludeId).map(asUpcomingRelease);
  const fromRivals = inProgress.filter((p) => p.id !== excludeId).map(rivalAsUpcomingRelease);
  const fromRunning = [...filmsById.values()]
    .filter((f) => f.id !== excludeId && f.boxOfficeRun.status === 'running')
    .map(runningFilmAsUpcomingRelease)
    .filter((u): u is UpcomingRelease => u !== null);
  return [...fromScheduled, ...fromRivals, ...fromRunning];
}

/** Resolves a due player draft into a real Film - mirrors engine/scheduledReleases.ts's retired settleScheduledReleases body exactly (same computeReleaseResults call, same cost-charged accounting), just fed a richer `known` list that now includes currently-running films alongside other pending releases. */
const NO_MOMENTS: PressTourMomentsOutcome = { buzzDelta: 0, storyBeat: null, moments: [] };

/**
 * The press-tour outcome the interactive window already decided for this film,
 * or null when the window never rolled (so settlement should roll instead). If
 * the window rolled: the player's resolved moment wins; failing that, an
 * unanswered incident applies its base outcome (it still happened); failing
 * that, the window stayed quiet and nothing applies. Pure - no rng, so it can't
 * perturb any stream.
 */
function windowPressTourOutcome(draft: FilmDraft): PressTourMomentsOutcome | null {
  if (draft.pressTourResolvedMoment) return windowOutcomeToMoments(draft.pressTourResolvedMoment);
  if (draft.pressTourIncident) return windowOutcomeToMoments(draft.pressTourIncident.base);
  if (draft.pressTourWindowRolled) return NO_MOMENTS;
  return null;
}

function resolvePlayerRelease(draft: FilmDraft, releaseDay: number, studioBrand: number, known: UpcomingRelease[], producerPool: Person[], rng: RandomFn): { film: Film; costCharged: number; reputationDeltas: TalentReputationDelta[] } {
  const photographyEvents = draft.photography!.events;
  const postProductionEvents = draft.postProductionEvents;
  const shootingRatio = draft.photography!.recommendedDays > 0 ? draft.photography!.daysElapsed / draft.photography!.recommendedDays : 1;
  const competitiveCrowding = computeCompetitiveCrowding({ releaseDay, genre: draft.genre!, targetAudience: draft.targetAudience! }, known);

  // Attached producers were locked in pre-greenlight; resolve them against the
  // world pool now to apply their combined boost and fold in their fees.
  const attachedIds = draft.attachedProducerIds ?? [];
  const producerEffects = computeProducerEffects(producersByIds(producerPool, attachedIds), draft.genre!);
  const producerFees = totalAttachedPerFilmFees(producerPool, attachedIds);

  // Press-tour moment. Two paths, mutually exclusive per tour:
  //  - Interactive: if the moment already fired during the release window
  //    (pressTourWindowRolled), the window owns the outcome - use the player's
  //    resolved moment, or the base moment if they never answered, or nothing
  //    if the window stayed quiet. No settlement roll (and no rng draw), so it
  //    can't double-dip.
  //  - Lean: otherwise (same-day release, or a save predating the interactive
  //    layer), roll here at settlement exactly as before. A film with no tour
  //    roster draws nothing, leaving the rng stream untouched (behaviour-
  //    preserving). Never rolled in computeReleaseResults, which the Marketing
  //    projection calls - the surprise must not leak into the forecast.
  const tourMoments = windowPressTourOutcome(draft) ?? rollPressTourMoments(draft.talent, draft.marketingChoices!.pressTourCast, rng);

  // Marketing rollout (docs/DESIGN_REVIEW_marketing_rollout.md): how much
  // momentum the campaign built over its runway - the frozen campaignStartDay
  // (SCHEDULE_RELEASE) to this releaseDay. Absent start day (pre-rollout saves)
  // resolves to the neutral 1.
  const rolloutMultiplier = marketingRolloutMultiplier(draft.marketingChoices!.campaignStartDay, releaseDay);

  const { results, fixed } = computeReleaseResults(
    {
      title: draft.title || 'Untitled Film',
      genre: draft.genre!,
      targetAudience: draft.targetAudience!,
      script: draft.script!,
      talent: draft.talent,
      productionChoices: draft.productionChoices!,
      postProductionChoices: draft.postProductionChoices!,
      marketingChoices: draft.marketingChoices!,
      events: photographyEvents,
      postProductionEvents,
      photographyCost: draft.photography!.runningCost,
      shootingRatio,
      studioBrand,
      competitiveCrowding,
      producerEffects,
      producerFees,
      pressTourMoment: { buzzDelta: tourMoments.buzzDelta, storyBeat: tourMoments.storyBeat },
      marketingRolloutMultiplier: rolloutMultiplier,
    },
    rng,
  );

  // Talent salary, the non-contingency production budget, and the
  // contingency reserve were already deducted (and, for contingency,
  // settled) back when photography actually happened; a resolved
  // post-production intervention's cost was already deducted too, at
  // RESOLVE_TEST_SCREENING_CHOICE - all four are included here so the
  // remainder (script cost, on-set event cost swings, and marketing) is all
  // that's newly charged at release. results.totalCost folds the
  // intervention cost in too (engine/releaseFilm.ts), purely for reporting -
  // including it in both places is what makes it cancel out below instead
  // of being charged a second time.
  const alreadyCharged =
    computeTalentCost(draft.talent) +
    computeProductionBudgetCost(draft.productionChoices!) +
    draft.photography!.runningCost +
    computeEventsCostDelta(postProductionEvents);
  const costCharged = results.totalCost - alreadyCharged;

  const film: Film = {
    id: draft.id,
    title: draft.title || 'Untitled Film',
    genre: draft.genre!,
    targetAudience: draft.targetAudience!,
    script: draft.script!,
    talent: draft.talent,
    productionChoices: draft.productionChoices!,
    postProductionChoices: draft.postProductionChoices!,
    marketingChoices: draft.marketingChoices!,
    events: photographyEvents,
    postProductionEvents,
    results,
    boxOfficeRun: { status: 'running', fixed, simWeeks: [], weeks: [], cumulativeGross: 0, acknowledged: false, premiereSeen: false },
    releasedOnDay: releaseDay,
    assetId: draft.assetId,
  };
  // Post-tour standing changes for the tourers (baseline exposure heat + any
  // fired moment's effect) - applied to the talent pool by the reducer.
  const reputationDeltas = pressTourReputationDeltas(draft.talent, draft.marketingChoices!.pressTourCast, tourMoments.moments);
  return { film, costCharged, reputationDeltas };
}

/**
 * The single unified theatrical-market tick. Interleaves three kinds of
 * pending event, always processing whichever is due soonest by real
 * calendar day rather than resolving everything for a whole multi-week
 * jump up front: a player's scheduled release becoming due, a rival
 * production's own releaseDay arriving, or an already-running film's next
 * settled week (engine/boxOfficeRun.ts:nextDueFilm/advanceEarliestDueFilmByOneWeek).
 * This ordering is what makes a new release feel (and be felt by) exactly
 * the films that are genuinely still on screens the week it actually
 * opens, and what keeps a big calendar jump identical to the same span
 * done as several smaller ones - every step only ever reads state already
 * settled before it runs, never anything produced later in the same call.
 *
 * Replaces the box-office-and-release-resolution portions of
 * engine/scheduledReleases.ts:settleScheduledReleases and
 * engine/rivalStudios.ts:settleRivalMarket (that file's own bidding/
 * Opportunity-market logic is unrelated and stays there, now taking this
 * function's already-settled rivalDeltas as an input instead of computing
 * its own - see state/studioReducer.ts).
 */
export function settleTheatricalMarket(
  runningFilms: Film[],
  playerScheduled: ScheduledRelease[],
  rivalInProgress: RivalProductionInProgress[],
  rivalStudios: RivalStudio[],
  totalDays: number,
  playerStudioBrand: number,
  rng: RandomFn,
  // Trailing + defaulted so every existing caller (and the whole test suite)
  // that predates producers keeps working unchanged - an empty pool means no
  // film has any producers attached, which is exactly their world.
  producerPool: Person[] = [],
): TheatricalMarketSettlement {
  let filmsById: Map<string, Film> = new Map(runningFilms.map((f) => [f.id, f]));
  let scheduled = playerScheduled;
  let inProgress = rivalInProgress;

  let playerCashCredit = 0;
  let playerBrandDelta = 0;
  let playerPrestigeDelta = 0;
  let playerCostCharged = 0;
  const rivalDeltas = new Map<string, RivalBoxOfficeDelta>();
  const playerTalentReputationDeltas: TalentReputationDelta[] = [];

  for (;;) {
    const nextScheduled = scheduled
      .filter((s) => s.releaseDay <= totalDays)
      .reduce<ScheduledRelease | null>((earliest, s) => (!earliest || s.releaseDay < earliest.releaseDay ? s : earliest), null);
    const nextRival = inProgress
      .filter((p) => p.releaseDay <= totalDays)
      .reduce<RivalProductionInProgress | null>((earliest, p) => (!earliest || p.releaseDay < earliest.releaseDay ? p : earliest), null);
    const nextFilm = nextDueFilm(filmsById, totalDays);

    const scheduledDay = nextScheduled ? nextScheduled.releaseDay : Infinity;
    const rivalDay = nextRival ? nextRival.releaseDay : Infinity;
    const filmDay = nextFilm ? nextFilm.startDay : Infinity;

    if (scheduledDay === Infinity && rivalDay === Infinity && filmDay === Infinity) break;

    if (scheduledDay <= rivalDay && scheduledDay <= filmDay) {
      const draft = nextScheduled!.draft;
      const known = knownCompetitorsExcluding(draft.id, scheduled, inProgress, filmsById);
      const { film, costCharged, reputationDeltas } = resolvePlayerRelease(draft, nextScheduled!.releaseDay, playerStudioBrand, known, producerPool, rng);
      filmsById.set(film.id, film);
      scheduled = scheduled.filter((s) => s.draft.id !== draft.id);
      playerCostCharged += costCharged;
      playerTalentReputationDeltas.push(...reputationDeltas);
      continue;
    }

    if (rivalDay <= filmDay) {
      const production = nextRival!;
      const rival = rivalStudios.find((r) => r.id === production.rivalStudioId);
      const known = knownCompetitorsExcluding(production.id, scheduled, inProgress, filmsById);
      const film = resolveRivalProduction(production, rival?.name ?? 'A Rival Studio', rival?.brand ?? 50, known, rng);
      filmsById.set(film.id, film);
      inProgress = inProgress.filter((p) => p.id !== production.id);
      continue;
    }

    const step = advanceEarliestDueFilmByOneWeek(filmsById, totalDays);
    filmsById = step.filmsById;
    const advancedFilm = step.advancedFilmId ? filmsById.get(step.advancedFilmId) : undefined;
    const owner = advancedFilm?.releasedBy;
    if (owner === undefined) {
      playerCashCredit += step.cashCredit;
      playerBrandDelta += step.brandDelta;
      playerPrestigeDelta += step.prestigeDelta;
    } else {
      creditRival(rivalDeltas, owner, { cashCredit: step.cashCredit, brandDelta: step.brandDelta, prestigeDelta: step.prestigeDelta });
    }
  }

  return {
    settledFilms: [...filmsById.values()],
    stillScheduled: scheduled,
    stillInProgress: inProgress,
    playerCashCredit,
    playerBrandDelta,
    playerPrestigeDelta,
    playerCostCharged,
    rivalDeltas,
    playerTalentReputationDeltas,
  };
}
