import type { Asset, Film, FilmDraft, Opportunity, PendingEventChoice, Person, ProductionEvent, ProductionRole, Project, ProjectWorkspaceSection, RivalProductionInProgress, RivalStudio, Studio, TalentAssignment, TalentProfession, WizardStep } from '../types';
import { type GameAction, type GameState, createDraftFromAsset, createInitialStudio } from './gameState';
import { randomSeed, withRng, clamp, type RandomFn } from '../engine/random';
import { logAmount } from '../engine/interpolate';
import { ALL_TALENT_ROLES, MANDATORY_TALENT_ROLES, ROLE_GENERATION_PROFILES } from '../data/talentGeneration';
import { professionForProductionRole } from '../data/helpers';
import { effectiveRoleCapacity } from '../engine/castRequirements';
import { computeRecommendedPostProductionDays, computeRecommendedPreProductionDays, computeRecommendedShootDays, computeStaticProductionRisk, rollDayEvent, resolveEventChoice } from '../engine/production';
import { generateTestScreeningPendingChoice } from '../engine/testScreening';
import { computeDailyContingencyBurn, computeProductionBudgetCost, computeTalentCost } from '../engine/cost';
import { getTypicalSalaryForRole, withCommitment } from '../engine/person';
import { adaptRecommendationsToProductionChoices } from '../engine/productionChoicesAdapter';
import { deriveProjectReadiness } from '../engine/projectReadiness';
import { STAGE_DURATIONS } from '../data/schedule';
import { settleTheatricalMarket } from '../engine/marketSettlement';
import { settleRivalMarket, generateRivalStudios } from '../engine/rivalStudios';
import { settleProductionsInProgress } from '../engine/productionsInProgress';
import { asUpcomingRelease, type ScheduledRelease } from '../engine/scheduledReleases';
import { deriveReleaseWindowFromDay } from '../engine/calendar';
import { settleOpportunities, reopenForfeitedOpportunity, highestBid, placeBid, type ResolvedBid } from '../engine/opportunities';
import { openCastingCall, tickCastingCalls } from '../engine/castingCalls';
import { generateTalentPool } from '../engine/talentGenerator';
import { applyStatChange } from '../engine/reputation';
import { TEST_SCRIPT_ASSETS } from '../data/testScripts';
import { currentScreenFor } from './selectors';
import {
  projectId,
  findProject,
  asPlayerDraft,
  playerDraftToProject,
  scheduledDraftToProject,
  rivalProductionToProject,
  filmToProject,
  playerReleasedFilms,
  rivalReleasedFilms,
  rivalProductionsInProgress as rivalProductionsOf,
  backgroundedPlayerDrafts,
  scheduledPlayerReleases,
  deriveAssetStatus,
} from '../engine/project';

// The canonical forward order of what's left of the wizard, post-greenlight
// only - used only to tell a forward GO_TO_STEP (advance the calendar by
// that stage's fixed duration, see data/schedule.ts) apart from a backward
// one (Back buttons; no time cost for revisiting a screen you're still
// deciding on). Used to also list develop/talent/production-planning/
// greenlight ahead of 'production' - those are gone now that the
// Producer Workspace (PRODUCER_WORKSPACE_DESIGN.md) replaced them with free
// navigation; GREENLIGHT_PROJECT below charges pre-production's calendar
// cost as its own lump sum instead of relying on this fixed order.
const WIZARD_STEP_ORDER: WizardStep[] = [
  'production',
  'post-production',
  'marketing',
  'results',
];

/**
 * Clears the transient "which read-only detour am I looking at" fields
 * (GameState.viewingRivalStudioName/viewingProductionId) - the default for
 * every action, since most leave neither detour behind. VIEW_RIVAL_STUDIO/
 * VIEW_PRODUCTION pass an override for the one they're actually setting.
 * Previously repeated as inline `null` literals at every one of these call
 * sites, inconsistently (some cleared only viewingProductionId;
 * VIEW_PRODUCTION didn't clear viewingRivalStudioName at all) - safe to
 * unify into always-clear-both-unless-overridden, since viewingRivalStudioName
 * is only ever non-null while screen === 'rival-studio', and none of the
 * actions reachable from that screen's own UI (RivalStudioPage.tsx) are
 * among the ones that used to leave it untouched.
 */
function clearTransientView(
  overrides: Partial<Pick<GameState, 'viewingRivalStudioName' | 'viewingProductionId'>> = {},
): Pick<GameState, 'viewingRivalStudioName' | 'viewingProductionId'> {
  return { viewingRivalStudioName: null, viewingProductionId: null, ...overrides };
}

/** Seeds every role's target price at the midpoint of its own salary range. */
function defaultTalentTargetPrices(): Partial<Record<ProductionRole, number>> {
  const result: Partial<Record<ProductionRole, number>> = {};
  for (const role of ALL_TALENT_ROLES) {
    result[role] = logAmount(0.5, ROLE_GENERATION_PROFILES[professionForProductionRole(role)].salaryRange);
  }
  return result;
}

/**
 * Milestone: Opportunity Market bidding. Applies every resolved bid the
 * player themselves won this weekly tick (engine/opportunities.ts:settleOpportunities's
 * `resolvedBids`, already present in `opportunities` having been removed
 * from the pool by that same call) - same charge-cash/create-Asset shape
 * ACQUIRE_OPPORTUNITY's own instant-buy path already has, since a won bid
 * should always look identical to an instant purchase from the Asset
 * Library's own point of view, whichever path got there. Re-validates
 * affordability here too (not just at PLACE_BID time) since the player's
 * cash can move between placing a bid and the weekly tick that resolves it
 * (a GREENLIGHT_PROJECT in between, for instance) - a win that's no longer
 * affordable is forfeited the same way an unaffordable rival win is
 * (engine/rivalStudios.ts:settleRivalMarket), not silently allowed to go
 * negative. Rival wins are a separate, later concern - see
 * engine/rivalStudios.ts:settleRivalMarket, which is what actually turns
 * those into a production once this function has had first pass at the
 * shared `opportunities` array.
 */
function applyOpportunityWins(
  studio: Studio,
  resolvedBids: ResolvedBid[],
  opportunities: Opportunity[],
  totalDays: number,
): { studio: Studio; opportunities: Opportunity[] } {
  let nextStudio = studio;
  let nextOpportunities = opportunities;
  for (const resolved of resolvedBids) {
    if (resolved.winnerId !== 'player') continue;
    if (resolved.amount > nextStudio.cash) {
      nextOpportunities = reopenForfeitedOpportunity(nextOpportunities, resolved.opportunity);
      continue;
    }
    const asset: Asset = {
      id: resolved.opportunity.id,
      script: resolved.opportunity.script,
      source: resolved.opportunity.source,
      acquisitionCost: resolved.amount,
      acquiredOnDay: totalDays,
    };
    nextStudio = { ...nextStudio, cash: nextStudio.cash - resolved.amount, assets: [...nextStudio.assets, asset] };
  }
  return { studio: nextStudio, opportunities: nextOpportunities };
}

export interface CalendarSettlementResult {
  studio: Studio;
  rivalStudios: RivalStudio[];
  talentPool: Record<TalentProfession, Person[]>;
  opportunities: Opportunity[];
  nextOpportunityCheckDay: number;
  stillScheduled: ScheduledRelease[];
  rivalProductionsInProgress: RivalProductionInProgress[];
  /** Every player film settled this call (already-running and newly-released alike) - feed straight into assembleProjects' playerFilms. */
  playerFilms: Film[];
  /** Every rival film settled this call, any studio - feed straight into assembleProjects' rivalFilms. */
  rivalFilms: Film[];
}

/**
 * The one shared settlement sequence every calendar-advancing reducer case
 * runs (ADVANCE_DAY, GO_TO_STEP, GREENLIGHT_PROJECT, ADVANCE_SHOOTING_DAY,
 * RESOLVE_EVENT_CHOICE, SCHEDULE_RELEASE) - previously duplicated at each of
 * those 7 call sites by hand; extracted so the "Live screen competition"
 * unification (engine/marketSettlement.ts:settleTheatricalMarket) only has
 * one place to land, not seven. In order: settle every currently-running
 * film's box office *and* resolve any release (player or rival) whose day
 * has arrived - the player's own and every rival's combined into one pass,
 * so a film can genuinely compete for screens against any of them, not just
 * its own owner's other films (see settleTheatricalMarket's own doc
 * comment); settle this week's Opportunity Market tick and apply the
 * player's own bid wins; credit each rival studio's own box-office
 * cash/brand/prestige (settleTheatricalMarket only returns *deltas*,
 * grouped by studio name - Film.releasedBy's own discriminator - crediting
 * them onto the actual RivalStudio records is this function's job); then
 * run the rival market's own remaining bidding/spawning tick
 * (engine/rivalStudios.ts:settleRivalMarket, narrowed to bidding-only now
 * that release resolution and box office moved out of it).
 *
 * `scheduledOverride` exists for SCHEDULE_RELEASE alone, which needs to
 * settle against a `scheduled` list that includes the very release it's
 * about to create - not yet reflected in `state.projects` at dispatch time.
 * Every other call site passes nothing and gets the real
 * scheduledPlayerReleases(state.projects).
 */
function runCalendarSettlement(
  state: GameState,
  totalDaysAfter: number,
  rng: RandomFn,
  scheduledOverride?: ScheduledRelease[],
): CalendarSettlementResult {
  const scheduled = scheduledOverride ?? scheduledPlayerReleases(state.projects);
  const runningFilms = [...playerReleasedFilms(state.projects), ...rivalReleasedFilms(state.projects)];

  const marketSettlement = settleTheatricalMarket(
    runningFilms,
    scheduled,
    rivalProductionsOf(state.projects),
    state.rivalStudios,
    totalDaysAfter,
    state.studio.brand,
    rng,
  );

  const opportunitySettlement = settleOpportunities(state.opportunities, state.nextOpportunityCheckDay, totalDaysAfter, rng);
  const opportunityWins = applyOpportunityWins(state.studio, opportunitySettlement.resolvedBids, opportunitySettlement.opportunities, totalDaysAfter);

  const studioAfterBoxOffice: Studio = {
    ...opportunityWins.studio,
    cash: opportunityWins.studio.cash + marketSettlement.playerCashCredit - marketSettlement.playerCostCharged,
    brand: applyStatChange(opportunityWins.studio.brand, marketSettlement.playerBrandDelta),
    prestige: applyStatChange(opportunityWins.studio.prestige, marketSettlement.playerPrestigeDelta),
  };

  const rivalStudiosAfterBoxOffice = state.rivalStudios.map((rival) => {
    const delta = marketSettlement.rivalDeltas.get(rival.name);
    if (!delta) return rival;
    return {
      ...rival,
      cash: rival.cash + delta.cashCredit,
      brand: applyStatChange(rival.brand, delta.brandDelta),
      prestige: applyStatChange(rival.prestige, delta.prestigeDelta),
      lifetimeRevenue: rival.lifetimeRevenue + delta.cashCredit,
    };
  });

  const rivalMarket = settleRivalMarket(
    {
      rivalStudios: rivalStudiosAfterBoxOffice,
      rivalProductionsInProgress: marketSettlement.stillInProgress,
      rivalFilmsReleased: marketSettlement.settledFilms.filter((f) => f.releasedBy !== undefined),
      talentPool: state.talentPool,
      opportunities: opportunityWins.opportunities,
    },
    opportunitySettlement.resolvedBids.filter((b) => b.winnerId !== 'player'),
    totalDaysAfter,
    scheduled.map(asUpcomingRelease),
    rng,
  );

  return {
    studio: studioAfterBoxOffice,
    rivalStudios: rivalMarket.rivalStudios,
    talentPool: rivalMarket.talentPool,
    opportunities: rivalMarket.opportunities,
    nextOpportunityCheckDay: opportunitySettlement.nextGenerationCheckDay,
    stillScheduled: marketSettlement.stillScheduled,
    rivalProductionsInProgress: rivalMarket.rivalProductionsInProgress,
    playerFilms: marketSettlement.settledFilms.filter((f) => f.releasedBy === undefined),
    rivalFilms: rivalMarket.rivalFilmsReleased,
  };
}

/**
 * Rebuilds the whole GameState.projects array from its constituent parts -
 * the same [player-in-progress, scheduled, rival-in-progress, released]
 * shape deriveProjectsView used to compute on every read (Phase 4), now the
 * real assignment at the end of every reducer case that touches more than
 * one project. `playerDrafts` includes the currently-focused draft too,
 * when there is one and this action didn't just release or discard it -
 * callers are responsible for including or omitting it correctly (see each
 * case below), since only they know which is true.
 */
function assembleProjects(parts: {
  playerDrafts: FilmDraft[];
  scheduled: ScheduledRelease[];
  rivalProductions: RivalProductionInProgress[];
  playerFilms: Film[];
  rivalFilms: Film[];
}): Project[] {
  return [
    ...parts.playerDrafts.map(playerDraftToProject),
    ...parts.scheduled.map((s) => scheduledDraftToProject(s.draft, s.releaseDay)),
    ...parts.rivalProductions.map(rivalProductionToProject),
    ...parts.playerFilms.map(filmToProject),
    ...parts.rivalFilms.map(filmToProject),
  ];
}

/** Replaces whichever `projects` entry is the player-in-progress draft with this id - the single-project update every simple wizard-field-edit case below uses. */
function replaceDraft(projects: Project[], draft: FilmDraft): Project[] {
  return projects.map((p) => (p.kind === 'player-in-progress' && p.draft.id === draft.id ? playerDraftToProject(draft) : p));
}

/**
 * Applies a resolved on-set event choice's outcome to whichever FilmDraft it
 * belongs to - the focused project or one of the backgrounded ones, see
 * RESOLVE_EVENT_CHOICE below. Same body either way: swap in a replacement
 * hire if the choice offered one, fold the event into the log/cost, and
 * unpause (`status: 'in-progress'`). Also returns `cashDelta` - talent
 * salary was already charged in full at BEGIN_PHOTOGRAPHY (see that case
 * below), so a recast here needs to settle the difference against
 * studio.cash immediately (old salary was already paid for; the new one
 * wasn't) rather than silently drifting out of sync with what RELEASE_FILM
 * later assumes has already been charged.
 */
function resolveChoiceOnDraft(
  d: FilmDraft,
  pendingChoice: PendingEventChoice,
  chosenChoiceId: string,
  event: ProductionEvent,
  talentPool: Record<TalentProfession, Person[]>,
): { draft: FilmDraft; cashDelta: number } {
  const photography = d.photography!;
  const chosen = pendingChoice.choices.find((c) => c.id === chosenChoiceId);
  const extraDays = event.delayDaysDelta;
  const dailyBurn = computeDailyContingencyBurn(d.productionChoices!.contingencyAmount, photography.recommendedDays);

  let talent = d.talent;
  let cashDelta = 0;
  if (chosen?.replacementCandidateId && pendingChoice.replacementRole) {
    const pool = talentPool[professionForProductionRole(pendingChoice.replacementRole)];
    const candidate = pool?.find((t) => t.id === chosen.replacementCandidateId);
    const outgoing = d.talent.find((a) => a.person.id === pendingChoice.involvedTalentId);
    if (candidate && outgoing) {
      const role = pendingChoice.replacementRole;
      cashDelta = -(getTypicalSalaryForRole(candidate, role) - getTypicalSalaryForRole(outgoing.person, role));
      talent = [...d.talent.filter((a) => a.person.id !== pendingChoice.involvedTalentId), { role: outgoing.role, person: candidate }];
    }
  }

  return {
    cashDelta,
    draft: {
      ...d,
      talent,
      photography: {
        ...photography,
        status: 'in-progress',
        daysElapsed: photography.daysElapsed + extraDays,
        events: [...photography.events, event],
        runningCost: photography.runningCost + dailyBurn * extraDays,
        pendingChoice: null,
      },
    },
  };
}

/**
 * Fires the one test screening a film ever gets, the moment totalDaysAfter
 * reaches its postProductionScreeningReadyDay - the same "PendingEventChoice
 * surfaces through the calendar tick" shape PhotographyState.pendingChoice
 * already uses for on-set events (see engine/testScreening.ts), just
 * checked here instead of rolled from data/productionEvents.ts, since this
 * fires after photography is already 'finished' rather than during a shoot
 * day. Applied to the focused draft and every backgrounded one at every
 * calendar-advancing reducer case below (docs/DESIGN_REVIEW_post_production_redesign.md
 * section 2) - a no-op for anything not finished shooting, not yet at its
 * ready day, or already resolved/pending (testScreeningResolved is what
 * stops this from re-firing once the same field, now advanced past its
 * post-screening meaning, happens to reach totalDaysAfter a second time).
 */
function checkTestScreeningReadiness(draft: FilmDraft, totalDaysAfter: number, rng: RandomFn): FilmDraft {
  if (
    !draft.photography ||
    draft.photography.status !== 'finished' ||
    draft.postProductionScreeningReadyDay === null ||
    totalDaysAfter < draft.postProductionScreeningReadyDay ||
    draft.testScreeningResolved ||
    draft.testScreeningPendingChoice
  ) {
    return draft;
  }
  return { ...draft, testScreeningPendingChoice: generateTestScreeningPendingChoice(draft, rng) };
}

// Talent salary, the non-contingency production budget, and the contingency
// reserve are charged/settled as production actually happens (BEGIN_PHOTOGRAPHY,
// resolveChoiceOnDraft, FINISH_PHOTOGRAPHY, below) - only script cost, event
// cost swings, the test screening fee, and marketing are still charged once,
// at RELEASE_FILM, computed fresh from the complete draft - see
// state/selectors.ts for the live preview shown before
// then. Box office revenue is the one thing that now lands gradually
// instead, credited week by week as a film's run actually plays out (see
// runCalendarSettlement above and docs/DESIGN.md 5.19).
export function studioReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    // A real-time background tick (App.tsx), separate from every other
    // calendar advance - those are all tied to a specific player action
    // (leaving a wizard stage, a shoot day). This one just passes a day on
    // its own, so the studio's history/box office keeps moving even while
    // the player is sitting on the Dashboard or a results screen not
    // clicking anything - see docs/DESIGN.md 5.20 for which screens this
    // runs on.
    case 'ADVANCE_DAY': {
      const totalDaysAfter = state.totalDays + 1;
      const focusedDraft = asPlayerDraft(findProject(state.projects, state.focusedProjectId));
      const { result, nextSeed } = withRng(state.rngSeed, (rng) => {
        const settlement = runCalendarSettlement(state, totalDaysAfter, rng);
        const productionsInProgress = settleProductionsInProgress(backgroundedPlayerDrafts(state.projects, state.focusedProjectId), 1, state.talentPool, rng);
        // Casting Redesign, Phase B - Open Casting calls tick on the same
        // real-time beat, for the focused draft and every backgrounded one.
        // This is the one calendar-advancing action casting calls are wired
        // into for now (docs/DESIGN_REVIEW_casting_redesign.md's own note on
        // this being a scoped Phase B limitation) - ADVANCE_DAY is the
        // dominant, continuous path a still-being-cast draft actually
        // experiences time through, unlike the occasional multi-day jumps
        // GREENLIGHT_PROJECT/SCHEDULE_RELEASE/etc cause.
        const tickedFocusedDraft = focusedDraft
          ? checkTestScreeningReadiness(
              tickCastingCalls(focusedDraft, totalDaysAfter, settlement.studio, settlement.talentPool.Actor, rng),
              totalDaysAfter,
              rng,
            )
          : null;
        const tickedProductionsInProgress = productionsInProgress.map((d) =>
          checkTestScreeningReadiness(
            tickCastingCalls(d, totalDaysAfter, settlement.studio, settlement.talentPool.Actor, rng),
            totalDaysAfter,
            rng,
          ),
        );
        return { settlement, productionsInProgress: tickedProductionsInProgress, focusedDraft: tickedFocusedDraft };
      });
      return {
        ...state,
        rngSeed: nextSeed,
        totalDays: totalDaysAfter,
        rivalStudios: result.settlement.rivalStudios,
        talentPool: result.settlement.talentPool,
        opportunities: result.settlement.opportunities,
        nextOpportunityCheckDay: result.settlement.nextOpportunityCheckDay,
        studio: result.settlement.studio,
        projects: assembleProjects({
          playerDrafts: [...(result.focusedDraft ? [result.focusedDraft] : []), ...result.productionsInProgress],
          scheduled: result.settlement.stillScheduled,
          rivalProductions: result.settlement.rivalProductionsInProgress,
          playerFilms: result.settlement.playerFilms,
          rivalFilms: result.settlement.rivalFilms,
        }),
      };
    }

    // Development pipeline (docs/DESIGN_REVIEW_development_pipeline.md).
    // Charges the opportunity's acquisitionCost immediately (never charged
    // again downstream - see engine/releaseFilm.ts's productionCost comment)
    // and turns it into a permanently-owned Asset, reusing the same id so an
    // Asset's identity traces back to the Opportunity it came from. Fails
    // safely (no-op) if the opportunity already expired/was already
    // acquired by the time this dispatches, or the studio can't afford it -
    // both are real races once VIEW_OPPORTUNITY_MARKET's list can go stale
    // between a render and a click. Milestone: Opportunity Market bidding -
    // also a no-op once `bids.length > 0` (a rival has expressed interest
    // too, so it's no longer an instant sale - see PLACE_BID below).
    case 'ACQUIRE_OPPORTUNITY': {
      const opportunity = state.opportunities.find((o) => o.id === action.opportunityId);
      if (
        !opportunity ||
        opportunity.expiresOnDay <= state.totalDays ||
        opportunity.bids.length > 0 ||
        state.studio.cash < opportunity.acquisitionCost
      ) {
        return state;
      }
      const asset: Asset = {
        id: opportunity.id,
        script: opportunity.script,
        source: opportunity.source,
        acquisitionCost: opportunity.acquisitionCost,
        acquiredOnDay: state.totalDays,
      };
      return {
        ...state,
        opportunities: state.opportunities.filter((o) => o.id !== opportunity.id),
        studio: {
          ...state.studio,
          cash: state.studio.cash - opportunity.acquisitionCost,
          assets: [...state.studio.assets, asset],
        },
      };
    }

    // Milestone: Opportunity Market bidding. Places or raises the player's
    // own bid on a contested Opportunity - upserts (engine/opportunities.ts:placeBid),
    // so re-dispatching with a higher amount is how the player raises. Fails
    // safely (no-op) if the opportunity is gone/expired, the amount doesn't
    // actually clear the current highest bid (or the listed acquisitionCost,
    // if somehow still uncontested by the time this dispatches), or the
    // player can't cover it - cash only actually moves later, if/when this
    // bid turns out to be the winner at the next weekly tick (see
    // applyOpportunityWins above), same deferred-charge shape a real auction
    // has.
    case 'PLACE_BID': {
      const opportunity = state.opportunities.find((o) => o.id === action.opportunityId);
      if (!opportunity || opportunity.expiresOnDay <= state.totalDays) return state;
      const floor = highestBid(opportunity)?.amount ?? opportunity.acquisitionCost;
      if (action.amount <= floor || action.amount > state.studio.cash) return state;
      return {
        ...state,
        opportunities: placeBid(state.opportunities, opportunity.id, { bidderId: 'player', bidderName: state.studio.name, amount: action.amount }),
      };
    }

    // Replaces the old START_NEW_FILM - a FilmDraft is only ever created
    // from an already-owned Asset now (see gameState.ts:createDraftFromAsset).
    // No-ops if the asset doesn't exist or already has an active attempt
    // (deriveAssetStatus) - the Asset Library shouldn't offer this action in
    // that case, but this is the authoritative guard, same pattern as
    // RESUME_PROJECT's own focusedProjectId guard below.
    case 'CREATE_PROJECT_FROM_ASSET': {
      const asset = state.studio.assets.find((a) => a.id === action.assetId);
      if (!asset || deriveAssetStatus(asset, state.projects).status === 'in-development') return state;
      const draft = createDraftFromAsset(asset, defaultTalentTargetPrices());
      return {
        ...state,
        screen: 'workspace',
        projectWorkspaceSection: 'overview',
        projects: [...state.projects, playerDraftToProject(draft)],
        focusedProjectId: draft.id,
        ...clearTransientView(),
      };
    }

    // Producer Workspace free navigation (PRODUCER_WORKSPACE_DESIGN.md) -
    // unlike GO_TO_STEP, never advances the calendar and never touches
    // STAGE_DURATIONS; moving between workspace sections is meant to cost
    // nothing. A no-op if nothing's focused or the focused project is past
    // Greenlight (already has `photography` - the workspace only exists for
    // pre-greenlight projects; a greenlit one lives on 'production'/
    // 'post-production'/'marketing'/'results' instead, reached via
    // GO_TO_STEP as before).
    case 'OPEN_PROJECT_WORKSPACE_SECTION': {
      const focusedDraft = asPlayerDraft(findProject(state.projects, state.focusedProjectId));
      if (!focusedDraft || focusedDraft.photography) return state;
      return { ...state, screen: 'workspace', projectWorkspaceSection: action.section, ...clearTransientView() };
    }

    // The one explicit "delete this for real" action for a still-owned
    // Asset's Project attempt (see GameAction's own doc comment). Whatever's
    // already been spent (the asset's own acquisition cost, and - if
    // GREENLIGHT_PROJECT already fired - talent/production/contingency) is
    // never refunded; the Asset itself is untouched, so it simply goes back
    // to 'available' (engine/project.ts:deriveAssetStatus) the moment this
    // project is gone.
    case 'ABANDON_PROJECT': {
      const d = asPlayerDraft(findProject(state.projects, state.focusedProjectId));
      if (!d) return state;
      return {
        ...state,
        screen: 'dashboard',
        focusedProjectId: null,
        projects: state.projects.filter((p) => projectId(p) !== d.id),
        ...clearTransientView(),
      };
    }

    case 'GO_TO_STEP': {
      // Any normal wizard navigation stops "viewing" a backgrounded
      // production (see GameState.viewingProductionId) - otherwise a stale
      // view could shadow the focused project the next time screen becomes
      // 'production' the ordinary way (GREENLIGHT_PROJECT, below, sets
      // screen: 'production' directly - GO_TO_STEP itself is never the
      // action that first reaches 'production').
      const focusedDraft = asPlayerDraft(findProject(state.projects, state.focusedProjectId));
      if (!focusedDraft) return { ...state, screen: action.step, ...clearTransientView() };
      const fromIdx = WIZARD_STEP_ORDER.indexOf(state.screen as WizardStep);
      const toIdx = WIZARD_STEP_ORDER.indexOf(action.step);
      // Only charge a stage's fixed duration the first time it's genuinely
      // left going forward - a Back-then-forward round trip (fromIdx no
      // further than what's already been charged) doesn't pay it twice.
      const isNewForwardProgress = fromIdx >= 0 && toIdx > fromIdx && fromIdx > focusedDraft.furthestStepIndexCharged;
      const leavingStage = isNewForwardProgress ? (state.screen as WizardStep) : null;
      const stageDuration = leavingStage ? STAGE_DURATIONS[leavingStage] : undefined;
      if (!stageDuration) return { ...state, screen: action.step, ...clearTransientView() };

      const totalDaysAfter = state.totalDays + stageDuration;
      const { result, nextSeed } = withRng(state.rngSeed, (rng) => {
        const settlement = runCalendarSettlement(state, totalDaysAfter, rng);
        const productionsInProgress = settleProductionsInProgress(backgroundedPlayerDrafts(state.projects, state.focusedProjectId), stageDuration, state.talentPool, rng);
        const checkedFocusedDraft = checkTestScreeningReadiness({ ...focusedDraft, furthestStepIndexCharged: fromIdx }, totalDaysAfter, rng);
        const checkedProductionsInProgress = productionsInProgress.map((d) => checkTestScreeningReadiness(d, totalDaysAfter, rng));
        return { settlement, productionsInProgress: checkedProductionsInProgress, focusedDraft: checkedFocusedDraft };
      });
      return {
        ...state,
        rngSeed: nextSeed,
        screen: action.step,
        totalDays: totalDaysAfter,
        rivalStudios: result.settlement.rivalStudios,
        talentPool: result.settlement.talentPool,
        opportunities: result.settlement.opportunities,
        nextOpportunityCheckDay: result.settlement.nextOpportunityCheckDay,
        ...clearTransientView(),
        studio: result.settlement.studio,
        projects: assembleProjects({
          playerDrafts: [result.focusedDraft, ...result.productionsInProgress],
          scheduled: result.settlement.stillScheduled,
          rivalProductions: result.settlement.rivalProductionsInProgress,
          playerFilms: result.settlement.playerFilms,
          rivalFilms: result.settlement.rivalFilms,
        }),
      };
    }

    case 'RENAME_STUDIO':
      return { ...state, studio: { ...state.studio, name: action.name } };

    case 'SET_TITLE': {
      const focusedDraft = asPlayerDraft(findProject(state.projects, state.focusedProjectId));
      if (!focusedDraft) return state;
      return { ...state, projects: replaceDraft(state.projects, { ...focusedDraft, title: action.title }) };
    }

    case 'SET_TARGET_AUDIENCE': {
      const focusedDraft = asPlayerDraft(findProject(state.projects, state.focusedProjectId));
      if (!focusedDraft) return state;
      return { ...state, projects: replaceDraft(state.projects, { ...focusedDraft, targetAudience: action.targetAudience }) };
    }

    case 'SET_TALENT_FOR_ROLE': {
      const focusedDraft = asPlayerDraft(findProject(state.projects, state.focusedProjectId));
      if (!focusedDraft) return state;
      // Defensive guard against double-casting the same real person into two
      // different roles on the same draft - only possible now that Lead
      // Actor and Supporting Actor share one Actor pool (used to be
      // structurally impossible, disjoint pools). The UI (RoleHiringDrawer)
      // already excludes these candidates; this mirrors TOGGLE_TALENT_FOR_ROLE's
      // own defensive shape below.
      if (action.person && focusedDraft.talent.some((a) => a.role !== action.role && a.person.id === action.person!.id)) {
        return state;
      }
      const withoutRole = focusedDraft.talent.filter((a) => a.role !== action.role);
      const nextTalent = action.person ? [...withoutRole, { role: action.role, person: action.person }] : withoutRole;
      return { ...state, projects: replaceDraft(state.projects, { ...focusedDraft, talent: nextTalent }) };
    }

    // For roles that can hold more than one person (Lead Actor and
    // Supporting Actor, capacity driven by the script - see
    // engine/castRequirements.ts): add this candidate if there's room, or
    // remove them if already hired. Silently no-ops at capacity rather than
    // erroring - the UI disables unhired candidates once a role is full, so
    // this is a defensive guard. Also no-ops if this person is already cast
    // in a *different* role on this draft, same reasoning as SET_TALENT_FOR_ROLE above.
    case 'TOGGLE_TALENT_FOR_ROLE': {
      const focusedDraft = asPlayerDraft(findProject(state.projects, state.focusedProjectId));
      if (!focusedDraft) return state;
      const current = focusedDraft.talent.filter((a) => a.role === action.role);
      const alreadyHired = current.some((a) => a.person.id === action.person.id);
      if (!alreadyHired && focusedDraft.talent.some((a) => a.role !== action.role && a.person.id === action.person.id)) {
        return state;
      }
      const capacity = effectiveRoleCapacity(action.role, focusedDraft.script);

      let nextTalent: TalentAssignment[];
      if (alreadyHired) {
        nextTalent = focusedDraft.talent.filter((a) => a.person.id !== action.person.id);
      } else if (current.length < capacity.max) {
        nextTalent = [...focusedDraft.talent, { role: action.role, person: action.person }];
      } else {
        return state;
      }
      return { ...state, projects: replaceDraft(state.projects, { ...focusedDraft, talent: nextTalent }) };
    }

    // Casting Redesign, Phase B - opens a new Open Casting call for one
    // Character, defensively no-op if one already exists (e.g. a stale
    // double-click) rather than opening a second, redundant call for the
    // same character.
    case 'OPEN_CASTING_CALL': {
      const focusedDraft = asPlayerDraft(findProject(state.projects, state.focusedProjectId));
      if (!focusedDraft || focusedDraft.castingCalls.some((c) => c.characterId === action.characterId)) return state;
      const call = openCastingCall(action.characterId, action.role, state.totalDays);
      return {
        ...state,
        projects: replaceDraft(state.projects, { ...focusedDraft, castingCalls: [...focusedDraft.castingCalls, call] }),
      };
    }

    // Casting Redesign, Phase C - find-or-open this Character's call and
    // bump its rejectionCount by one. The UI has already resolved the
    // offer as rejected (engine/castingAppeal.ts:resolveOfferResponse) by
    // the time this dispatches - this action only ever records the
    // outcome, never decides it.
    case 'RECORD_CASTING_REJECTION': {
      const focusedDraft = asPlayerDraft(findProject(state.projects, state.focusedProjectId));
      if (!focusedDraft) return state;
      const existing = focusedDraft.castingCalls.find((c) => c.characterId === action.characterId);
      const nextCalls = existing
        ? focusedDraft.castingCalls.map((c) => (c.characterId === action.characterId ? { ...c, rejectionCount: c.rejectionCount + 1 } : c))
        : [...focusedDraft.castingCalls, { ...openCastingCall(action.characterId, action.role, state.totalDays), rejectionCount: 1 }];
      return { ...state, projects: replaceDraft(state.projects, { ...focusedDraft, castingCalls: nextCalls }) };
    }

    case 'SET_TALENT_TARGET_PRICE': {
      const focusedDraft = asPlayerDraft(findProject(state.projects, state.focusedProjectId));
      if (!focusedDraft) return state;
      return {
        ...state,
        projects: replaceDraft(state.projects, {
          ...focusedDraft,
          talentTargetPriceByRole: { ...focusedDraft.talentTargetPriceByRole, [action.role]: action.price },
        }),
      };
    }

    case 'SET_TALENT_BUDGET_SPLIT': {
      const focusedDraft = asPlayerDraft(findProject(state.projects, state.focusedProjectId));
      if (!focusedDraft) return state;
      // Split per *head*, not per role - Lead Actor and Supporting Actor can
      // each require more than one hire (script.requiredLeads/requiredSupporting),
      // so a script needing 3 leads and 3 supporting actors has 8 mandatory
      // heads to cast, not 6. Splitting the budget across a flat 6 roles
      // understated the target price for every multi-hire role by however
      // many extra people it actually needs.
      const totalHeads = MANDATORY_TALENT_ROLES.reduce(
        (sum, role) => sum + effectiveRoleCapacity(role, focusedDraft.script).max,
        0,
      );
      const perHead = action.totalBudget / totalHeads;
      const updated = { ...focusedDraft.talentTargetPriceByRole };
      for (const role of MANDATORY_TALENT_ROLES) {
        const range = ROLE_GENERATION_PROFILES[professionForProductionRole(role)].salaryRange;
        updated[role] = clamp(perHead, range.min, range.max);
      }
      return { ...state, projects: replaceDraft(state.projects, { ...focusedDraft, talentTargetPriceByRole: updated }) };
    }

    case 'SET_PRODUCTION_PLAN': {
      const focusedDraft = asPlayerDraft(findProject(state.projects, state.focusedProjectId));
      if (!focusedDraft) return state;
      const productionChoices = adaptRecommendationsToProductionChoices(
        action.environmentAmbition,
        action.effectsStrategy,
        action.effectsAmbition,
        action.contingencyAmount,
        action.runtimeIntensity,
      );
      return {
        ...state,
        projects: replaceDraft(state.projects, {
          ...focusedDraft,
          environmentStrategy: action.environmentStrategy,
          environmentAmbition: action.environmentAmbition,
          effectsStrategy: action.effectsStrategy,
          effectsAmbition: action.effectsAmbition,
          productionChoices,
        }),
      };
    }

    // Replaces the old BEGIN_PHOTOGRAPHY - the explicit business decision
    // the development-pipeline doc is about (see GameAction's own doc
    // comment above). Talent salary, the non-contingency production budget
    // (set/practical/VFX), and the full contingency reserve all leave
    // studio.cash right here, rather than waiting for RELEASE_FILM - that's
    // what makes a production a real, ongoing cash commitment instead of a
    // promise to pay later, especially now that a shoot can run in the
    // background for a long time (see docs/DESIGN.md 5.x). Talent salary is
    // kept in sync afterward by any recast (resolveChoiceOnDraft's
    // cashDelta, below); the production budget is fixed once photography
    // begins (nothing after this point edits productionChoices). Contingency
    // is the only one of the three that's refundable - settled against what
    // was actually burned at FINISH_PHOTOGRAPHY. RELEASE_FILM's own cash
    // deduction is adjusted to not charge these three a second time. Also
    // reserves the cast's bookedUntil for real (moved here from the old
    // RETURN_TO_DASHBOARD, see that case below), the same way a rival
    // studio's own casting does (engine/rivalStudios.ts:startRivalProduction's
    // bookedIds/updatedPool) - talent selection up to this point
    // (SET_TALENT_FOR_ROLE) has never deducted cash or booked anyone, so
    // this is the one place both become real at once. Fails safely (returns
    // state unchanged) if the studio can't afford the full commitment right
    // now - the first reducer-level affordability gate in this codebase for
    // a wizard commitment.
    case 'GREENLIGHT_PROJECT': {
      const focusedDraft = asPlayerDraft(findProject(state.projects, state.focusedProjectId));
      if (!focusedDraft?.script || !focusedDraft.productionChoices) return state;
      // The reducer-level readiness gate (engine/projectReadiness.ts) -
      // defensive, since the Greenlight button is already disabled in the
      // UI until this is true, but the Producer Workspace's free navigation
      // means there's no fixed forward order forcing the player through
      // every prerequisite screen first any more, so this is now the only
      // real guard. Covers affordability too (cannot-afford-greenlight), so
      // no separate cash check is needed below.
      if (!deriveProjectReadiness(focusedDraft, state.studio.cash).ready) return state;

      const recommendedDays = computeRecommendedShootDays(focusedDraft.talent, focusedDraft.script, focusedDraft.productionChoices);
      // How long pre-production itself takes, scaled to this project's own
      // scope (engine/production.ts) - charged as a single lump sum here,
      // replacing the old per-wizard-stage STAGE_DURATIONS charges GO_TO_STEP
      // used to apply one at a time on the way to this point (data/schedule.ts).
      const preProductionDays = computeRecommendedPreProductionDays(focusedDraft.talent, focusedDraft.script, focusedDraft.productionChoices);
      const upfrontCharge =
        computeTalentCost(focusedDraft.talent) +
        computeProductionBudgetCost(focusedDraft.productionChoices) +
        focusedDraft.productionChoices.contingencyAmount;

      // Greenlight now advances the calendar for real (by preProductionDays),
      // so it has to run the same settlement machinery every other
      // calendar-advancing action does (GO_TO_STEP above) - scheduled
      // releases, box office, the opportunity market, rival studios, and
      // every other backgrounded production all keep moving during
      // pre-production exactly as they would during any other multi-day
      // stage transition.
      const totalDaysAfter = state.totalDays + preProductionDays;
      const { result, nextSeed } = withRng(state.rngSeed, (rng) => {
        const settlement = runCalendarSettlement(state, totalDaysAfter, rng);
        const productionsInProgress = settleProductionsInProgress(backgroundedPlayerDrafts(state.projects, state.focusedProjectId), preProductionDays, state.talentPool, rng)
          .map((d) => checkTestScreeningReadiness(d, totalDaysAfter, rng));
        return { settlement, productionsInProgress };
      });

      // Per-assignment, not per-role-then-profession: Lead Actor and
      // Supporting Actor share one Actor pool, so looping over pool keys and
      // re-filtering by id would visit that pool once per role and double up
      // an actor's commitment (see the identical fix in rivalStudios.ts).
      const bookedUntil = totalDaysAfter + recommendedDays;
      const talentPool = { ...result.settlement.talentPool };
      for (const assignment of focusedDraft.talent) {
        const profession = professionForProductionRole(assignment.role);
        const commitment = { projectId: focusedDraft.id, role: assignment.role, startDay: state.totalDays, endDay: bookedUntil };
        talentPool[profession] = talentPool[profession].map((t) =>
          t.id === assignment.person.id ? withCommitment(t, commitment) : t,
        );
      }

      return {
        ...state,
        rngSeed: nextSeed,
        screen: 'production',
        totalDays: totalDaysAfter,
        rivalStudios: result.settlement.rivalStudios,
        talentPool,
        opportunities: result.settlement.opportunities,
        nextOpportunityCheckDay: result.settlement.nextOpportunityCheckDay,
        ...clearTransientView(),
        studio: { ...result.settlement.studio, cash: result.settlement.studio.cash - upfrontCharge },
        projects: assembleProjects({
          playerDrafts: [
            {
              ...focusedDraft,
              greenlitOnDay: totalDaysAfter,
              photography: { status: 'in-progress', recommendedDays, daysElapsed: 0, events: [], runningCost: 0, pendingChoice: null },
            },
            ...result.productionsInProgress,
          ],
          scheduled: result.settlement.stillScheduled,
          rivalProductions: result.settlement.rivalProductionsInProgress,
          playerFilms: result.settlement.playerFilms,
          rivalFilms: result.settlement.rivalFilms,
        }),
      };
    }

    // One day of principal photography: rolls whether anything notable
    // happens (engine/production.ts:rollDayEvent), burns a day of
    // contingency per calendar day actually spent, and advances both the
    // shoot's own day counter and the studio's persistent calendar in
    // lockstep - the player watches the date on screen move forward in real
    // time while filming happens. An interactive event still consumes the
    // day it happened on (the situation itself is that day's event) but
    // pauses here rather than resolving - see RESOLVE_EVENT_CHOICE below for
    // where its own delayDaysDelta gets applied on top. A no-op while
    // status isn't 'in-progress', which is what actually stops the ticking
    // interval (ProductionRun.tsx) and a Fast Forward loop mid-flight once a
    // choice interrupts it. Always the *focused* project's own shoot - a
    // backgrounded production only ever advances the "chunky" way, via the
    // shared calendar (settleProductionsInProgress), never day-by-day.
    case 'ADVANCE_SHOOTING_DAY': {
      const d = asPlayerDraft(findProject(state.projects, state.focusedProjectId));
      if (!d?.photography || d.photography.status !== 'in-progress' || !d.script || !d.productionChoices || !d.genre) {
        return state;
      }
      const staticRisk = computeStaticProductionRisk(d.talent, d.script, d.productionChoices, d.genre);
      const usedIds = new Set(d.photography.events.map((e) => e.id));
      const backgrounded = backgroundedPlayerDrafts(state.projects, state.focusedProjectId);

      const { result, nextSeed } = withRng(state.rngSeed, (rng) => {
        const rolled = rollDayEvent(
          staticRisk,
          d.photography!.daysElapsed + 1,
          d.photography!.recommendedDays,
          d.genre!,
          usedIds,
          d.talent,
          d.script,
          state.talentPool,
          rng,
        );
        if (rolled && 'pendingChoice' in rolled) {
          const totalDaysAfter = state.totalDays + 1;
          const settlement = runCalendarSettlement(state, totalDaysAfter, rng);
          const productionsInProgress = settleProductionsInProgress(backgrounded, 1, state.talentPool, rng)
            .map((p) => checkTestScreeningReadiness(p, totalDaysAfter, rng));
          return { kind: 'pendingChoice' as const, pendingChoice: rolled.pendingChoice, totalDaysAfter, settlement, productionsInProgress };
        }
        const event = rolled?.event ?? null;
        const daysAdvanced = 1 + (event?.delayDaysDelta ?? 0);
        const totalDaysAfter = state.totalDays + daysAdvanced;
        const settlement = runCalendarSettlement(state, totalDaysAfter, rng);
        const productionsInProgress = settleProductionsInProgress(backgrounded, daysAdvanced, state.talentPool, rng)
          .map((p) => checkTestScreeningReadiness(p, totalDaysAfter, rng));
        return { kind: 'event' as const, event, daysAdvanced, totalDaysAfter, settlement, productionsInProgress };
      });

      const dailyBurn = computeDailyContingencyBurn(d.productionChoices.contingencyAmount, d.photography.recommendedDays);

      if (result.kind === 'pendingChoice') {
        const updatedFocused: FilmDraft = {
          ...d,
          photography: {
            ...d.photography,
            status: 'awaiting-choice',
            daysElapsed: d.photography.daysElapsed + 1,
            runningCost: d.photography.runningCost + dailyBurn,
            pendingChoice: result.pendingChoice,
          },
        };
        return {
          ...state,
          rngSeed: nextSeed,
          totalDays: result.totalDaysAfter,
          rivalStudios: result.settlement.rivalStudios,
          talentPool: result.settlement.talentPool,
          opportunities: result.settlement.opportunities,
          nextOpportunityCheckDay: result.settlement.nextOpportunityCheckDay,
          studio: result.settlement.studio,
          projects: assembleProjects({
            playerDrafts: [updatedFocused, ...result.productionsInProgress],
            scheduled: result.settlement.stillScheduled,
            rivalProductions: result.settlement.rivalProductionsInProgress,
            playerFilms: result.settlement.playerFilms,
            rivalFilms: result.settlement.rivalFilms,
          }),
        };
      }

      const { event, daysAdvanced, totalDaysAfter, settlement, productionsInProgress } = result;
      const updatedFocused: FilmDraft = {
        ...d,
        photography: {
          ...d.photography,
          daysElapsed: d.photography.daysElapsed + daysAdvanced,
          events: event ? [...d.photography.events, event] : d.photography.events,
          runningCost: d.photography.runningCost + dailyBurn * daysAdvanced,
        },
      };
      return {
        ...state,
        rngSeed: nextSeed,
        totalDays: totalDaysAfter,
        rivalStudios: settlement.rivalStudios,
        talentPool: settlement.talentPool,
        opportunities: settlement.opportunities,
        nextOpportunityCheckDay: settlement.nextOpportunityCheckDay,
        studio: settlement.studio,
        projects: assembleProjects({
          playerDrafts: [updatedFocused, ...productionsInProgress],
          scheduled: settlement.stillScheduled,
          rivalProductions: settlement.rivalProductionsInProgress,
          playerFilms: settlement.playerFilms,
          rivalFilms: settlement.rivalFilms,
        }),
      };
    }

    // Applies the outcome of whichever choice the player picked for a
    // pending interactive event, then unpauses the shoot. The choice's own
    // delayDaysDelta (if any) advances the calendar here, separately from
    // the day the situation itself happened on (already charged in
    // ADVANCE_SHOOTING_DAY above) - see engine/production.ts:resolveEventChoice.
    // A choice built by buildReplacementChoices (offersReplacementFor) also
    // swaps FilmDraft.talent for real - the departing hire is removed and
    // the picked candidate takes their place for the rest of the film, on
    // top of the one-time disruption cost/quality/delay already rolled.
    case 'RESOLVE_EVENT_CHOICE': {
      const target = asPlayerDraft(findProject(state.projects, action.productionId));
      if (!target?.photography || target.photography.status !== 'awaiting-choice' || !target.photography.pendingChoice || !target.productionChoices) {
        return state;
      }
      const isFocused = action.productionId === state.focusedProjectId;
      const focusedDraft = asPlayerDraft(findProject(state.projects, state.focusedProjectId));
      const pendingChoice = target.photography.pendingChoice;
      // The production being resolved right here is handled below via
      // resolveChoiceOnDraft, not by the generic day-loop - every *other*
      // backgrounded production still advances by the same number of days
      // this choice's delay cost (the focused one, if this isn't it, passes
      // through untouched either way - see playerDraftsAfter below).
      const otherBackgrounded = backgroundedPlayerDrafts(state.projects, state.focusedProjectId).filter((p) => p.id !== action.productionId);

      const { result, nextSeed } = withRng(state.rngSeed, (rng) => {
        const event = resolveEventChoice(pendingChoice, action.choiceId, rng);
        const totalDaysAfter = state.totalDays + event.delayDaysDelta;
        const settlement = runCalendarSettlement(state, totalDaysAfter, rng);
        const productionsInProgress = settleProductionsInProgress(otherBackgrounded, event.delayDaysDelta, state.talentPool, rng)
          .map((p) => checkTestScreeningReadiness(p, totalDaysAfter, rng));
        const checkedFocusedDraft = focusedDraft ? checkTestScreeningReadiness(focusedDraft, totalDaysAfter, rng) : null;
        return { event, totalDaysAfter, settlement, productionsInProgress, checkedFocusedDraft };
      });
      const { event, totalDaysAfter, settlement, productionsInProgress, checkedFocusedDraft } = result;

      const { draft: resolvedTarget, cashDelta } = resolveChoiceOnDraft(target, pendingChoice, action.choiceId, event, state.talentPool);

      const studioAfter: Studio = { ...settlement.studio, cash: settlement.studio.cash + cashDelta };

      const playerDraftsAfter = isFocused
        ? [resolvedTarget, ...productionsInProgress]
        : [...(checkedFocusedDraft ? [checkedFocusedDraft] : []), ...productionsInProgress, resolvedTarget];

      return {
        ...state,
        rngSeed: nextSeed,
        totalDays: totalDaysAfter,
        rivalStudios: settlement.rivalStudios,
        talentPool: settlement.talentPool,
        opportunities: settlement.opportunities,
        nextOpportunityCheckDay: settlement.nextOpportunityCheckDay,
        studio: studioAfter,
        projects: assembleProjects({
          playerDrafts: playerDraftsAfter,
          scheduled: settlement.stillScheduled,
          rivalProductions: settlement.rivalProductionsInProgress,
          playerFilms: settlement.playerFilms,
          rivalFilms: settlement.rivalFilms,
        }),
      };
    }

    // Settles the contingency reserve against what was actually burned
    // (PhotographyState.runningCost) - the full reserve was already
    // deducted from cash at BEGIN_PHOTOGRAPHY, so whatever's left over
    // (positive) comes back, and running over the reserve (negative) is
    // charged the rest of the way here rather than being silently absorbed.
    // Works identically whether `productionId` names the focused project or
    // a backgrounded one - either way it's just one `projects` entry being
    // updated in place, nothing to move between arrays any more.
    case 'FINISH_PHOTOGRAPHY': {
      const target = asPlayerDraft(findProject(state.projects, action.productionId));
      if (!target?.photography || target.photography.status !== 'in-progress' || !target.productionChoices) return state;
      const contingencySettlement = target.productionChoices.contingencyAmount - target.photography.runningCost;
      // Post-Production Redesign, Phase A/B (docs/DESIGN_REVIEW_post_production_redesign.md
      // sections 1-2) - computed exactly once, here, same "at the moment
      // this stage's clock actually starts" timing PhotographyState.recommendedDays
      // itself uses at BEGIN_PHOTOGRAPHY. Not recomputed anywhere else -
      // FilmDraft.postProductionScreeningReadyDay is a snapshot, not a live
      // reading, until RESOLVE_TEST_SCREENING_CHOICE advances it once.
      const postProductionScreeningReadyDay =
        state.totalDays + computeRecommendedPostProductionDays(target.talent, target.productionChoices);
      return {
        ...state,
        studio: { ...state.studio, cash: state.studio.cash + contingencySettlement },
        projects: replaceDraft(state.projects, {
          ...target,
          photography: { ...target.photography, status: 'finished' },
          postProductionScreeningReadyDay,
        }),
      };
    }

    // Resolves FilmDraft.testScreeningPendingChoice - the one test screening
    // a film ever gets (docs/DESIGN_REVIEW_post_production_redesign.md
    // section 2). Unlike RESOLVE_EVENT_CHOICE, the resolved cost is charged
    // immediately, right here, against studio.cash (gated by affordability,
    // same "cannot-afford" shape GREENLIGHT_PROJECT already uses) rather than
    // deferred to RELEASE_FILM the way on-set event costs and the old
    // testScreeningResponse fee both were - see state/selectors.ts's
    // computeProjectSpendSoFar for the corresponding display note. The
    // resolved ProductionEvent is still appended to photography.events (with
    // costDelta zeroed, since it was just charged directly above) purely so
    // its quality/buzz swing flows through the existing
    // computeQualityBreakdown/eventsQualityDelta pipeline exactly like any
    // other on-set event - no parallel scoring path. delayDaysDelta advances
    // postProductionScreeningReadyDay itself, which is safe to reuse for a
    // second meaning ("revised completion estimate") specifically because
    // testScreeningResolved guarantees only one screening ever fires per
    // film (see checkTestScreeningReadiness above). Never reopens
    // `photography` (stays 'finished') - Pickups/Major Reshoots are
    // deliberately abstract outcomes this phase, not a live second shoot.
    case 'RESOLVE_TEST_SCREENING_CHOICE': {
      const target = asPlayerDraft(findProject(state.projects, action.productionId));
      if (!target?.photography || !target.testScreeningPendingChoice || target.postProductionScreeningReadyDay === null) {
        return state;
      }
      const pendingChoice = target.testScreeningPendingChoice;
      const { result: rolled, nextSeed } = withRng(state.rngSeed, (rng) => resolveEventChoice(pendingChoice, action.choiceId, rng));

      if (state.studio.cash < rolled.costDelta) return state;

      return {
        ...state,
        rngSeed: nextSeed,
        studio: { ...state.studio, cash: state.studio.cash - rolled.costDelta },
        projects: replaceDraft(state.projects, {
          ...target,
          photography: { ...target.photography, events: [...target.photography.events, { ...rolled, costDelta: 0 }] },
          postProductionScreeningReadyDay: target.postProductionScreeningReadyDay + rolled.delayDaysDelta,
          testScreeningPendingChoice: null,
          testScreeningResolved: true,
        }),
      };
    }

    // Makes a backgrounded project the focused one again (see
    // docs/DESIGN.md 5.x) - only while nothing else is already focused, so
    // this can never silently discard unrelated in-progress work. The Inbox
    // and Asset Library are expected to only offer this action while
    // focusedProjectId is null; this guard is the authoritative one.
    // Nothing moves between arrays any more (roadmap Phase 5) - the project
    // was already sitting in `projects` as 'player-in-progress'; only which
    // id is focused, and which screen shows it, change. A pre-Greenlight
    // project (photography still null) always re-enters at 'develop' -
    // every field it's already had chosen (title, talent, plan) is
    // preserved on the draft regardless of which screen re-shows it first,
    // so there's no need to reconstruct exactly which step the player left
    // on. A finished shoot with post-production already done (roadmap Phase
    // 7.1/7.3 - a "parked, needs a release day" project the Inbox surfaces
    // distinctly) picks up straight at Marketing & Release instead of
    // revisiting post-production choices that are already locked in.
    case 'RESUME_PROJECT': {
      if (state.focusedProjectId) return state;
      const project = asPlayerDraft(findProject(state.projects, action.projectId));
      if (!project) return state;
      const screen = currentScreenFor(project);
      return {
        ...state,
        screen,
        focusedProjectId: action.projectId,
        ...(screen === 'workspace' ? { projectWorkspaceSection: 'overview' as ProjectWorkspaceSection } : {}),
        ...clearTransientView(),
      };
    }

    case 'SET_POST_PRODUCTION_CHOICES': {
      const focusedDraft = asPlayerDraft(findProject(state.projects, state.focusedProjectId));
      if (!focusedDraft) return state;
      return { ...state, projects: replaceDraft(state.projects, { ...focusedDraft, postProductionChoices: action.choices }) };
    }

    case 'SET_MARKETING_CHOICES': {
      const focusedDraft = asPlayerDraft(findProject(state.projects, state.focusedProjectId));
      if (!focusedDraft) return state;
      return { ...state, projects: replaceDraft(state.projects, { ...focusedDraft, marketingChoices: action.choices }) };
    }

    // Roadmap Phase 7.2 - replaces the old always-immediate RELEASE_FILM.
    // Marketing's fixed run-up (data/schedule.ts) still always elapses
    // first, same as RELEASE_FILM always charged it; the player's own
    // releaseDay pick is clamped to no earlier than that. The focused
    // project becomes 'scheduled' and is folded into the very same
    // settleScheduledReleases pass every other calendar-advancing action
    // uses - so a same-day pick (releaseDay <= totalDaysAfter) resolves
    // into 'released' within this one dispatch, landing on 'results'
    // exactly like RELEASE_FILM always did; a later pick just parks it,
    // unfocused, back on the Dashboard, where the shared settlement
    // machinery picks it up whenever totalDays actually reaches it.
    case 'SCHEDULE_RELEASE': {
      const d = asPlayerDraft(findProject(state.projects, state.focusedProjectId));
      if (
        !d ||
        !d.genre ||
        !d.targetAudience ||
        !d.script ||
        !d.productionChoices ||
        !d.photography ||
        !d.postProductionChoices ||
        !d.marketingChoices
      ) {
        return state;
      }
      const totalDaysAfter = state.totalDays + (STAGE_DURATIONS.marketing ?? 0);
      // releaseDay is a discrete calendar day everywhere else in this
      // codebase (GameState.totalDays, RivalProductionInProgress.releaseDay)
      // - rounding here is defensive against a UI slider's genuinely
      // continuous drag value (components/wizard/MarketingRelease.tsx
      // rounds too, but a fractional day stored here would silently throw
      // off every `releaseDay <= totalDays` comparison downstream).
      const releaseDay = Math.max(Math.round(action.releaseDay), totalDaysAfter);
      const resolvedNow = releaseDay <= totalDaysAfter;
      const backgrounded = backgroundedPlayerDrafts(state.projects, state.focusedProjectId);
      const otherScheduled = scheduledPlayerReleases(state.projects);
      // Overrides whatever releaseWindow the wizard step last set
      // (MarketingRelease.tsx no longer lets the player pick one
      // independently, but this is the actual choke point that makes it
      // impossible regardless of what got the draft here) - the one place
      // a draft's marketingChoices becomes immutable, since asPlayerDraft
      // returns null for a 'scheduled' project from this point on.
      const scheduledDraft: FilmDraft = { ...d, marketingChoices: { ...d.marketingChoices, releaseWindow: deriveReleaseWindowFromDay(releaseDay) } };

      const { result, nextSeed } = withRng(state.rngSeed, (rng) => {
        // scheduledOverride includes the release being created right here -
        // not yet reflected in state.projects at dispatch time, so
        // runCalendarSettlement can't derive it the normal way.
        const settlement = runCalendarSettlement(state, totalDaysAfter, rng, [...otherScheduled, { draft: scheduledDraft, releaseDay }]);
        const productionsInProgress = settleProductionsInProgress(backgrounded, STAGE_DURATIONS.marketing ?? 0, state.talentPool, rng)
          .map((p) => checkTestScreeningReadiness(p, totalDaysAfter, rng));
        return { settlement, productionsInProgress };
      });

      return {
        ...state,
        rngSeed: nextSeed,
        screen: resolvedNow ? 'results' : 'dashboard',
        focusedProjectId: resolvedNow ? state.focusedProjectId : null,
        totalDays: totalDaysAfter,
        rivalStudios: result.settlement.rivalStudios,
        talentPool: result.settlement.talentPool,
        opportunities: result.settlement.opportunities,
        nextOpportunityCheckDay: result.settlement.nextOpportunityCheckDay,
        ...clearTransientView(),
        studio: result.settlement.studio,
        projects: assembleProjects({
          playerDrafts: result.productionsInProgress,
          scheduled: result.settlement.stillScheduled,
          rivalProductions: result.settlement.rivalProductionsInProgress,
          playerFilms: result.settlement.playerFilms,
          rivalFilms: result.settlement.rivalFilms,
        }),
      };
    }

    case 'ACKNOWLEDGE_BOX_OFFICE_RESULTS': {
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.kind === 'released' && p.film.id === action.filmId
            ? filmToProject({ ...p.film, boxOfficeRun: { ...p.film.boxOfficeRun, acknowledged: true } })
            : p,
        ),
      };
    }

    // Every pre-Greenlight draft now has real content (a full script,
    // inherited from its Asset - development-pipeline doc), so the old
    // "discard a possibly-empty draft" rationale for this action no longer
    // applies - it's always just an unfocus now, never a delete, and never
    // touches talent booking (that moved to GREENLIGHT_PROJECT above). The
    // project - whatever stage it's at - is already sitting in `projects`
    // either way, so there's nothing to move to or from the background;
    // resuming it later (from the Dashboard/Asset Library/Inbox) picks up
    // exactly where it was left. ABANDON_PROJECT above is the only action
    // that actually discards a project.
    case 'RETURN_TO_DASHBOARD':
      return { ...state, screen: 'dashboard', focusedProjectId: null, ...clearTransientView() };

    case 'RESET_SAVE': {
      // A fresh studio gets a brand new talent pool and rival roster too -
      // reusing the old ones would defeat the point of resetting. No
      // Opportunities exist yet either - the next calendar-advancing action
      // generates the first batch immediately (nextOpportunityCheckDay: 1
      // is already due at totalDays: 1).
      const { result, nextSeed } = withRng(randomSeed(), (rng) => ({
        talentPool: generateTalentPool(rng),
        rivalStudios: generateRivalStudios(rng),
      }));
      return {
        studio: { ...createInitialStudio(action.startingCash), assets: TEST_SCRIPT_ASSETS },
        screen: 'dashboard',
        projects: [],
        focusedProjectId: null,
        projectWorkspaceSection: 'overview',
        rngSeed: nextSeed,
        totalDays: 1,
        talentPool: result.talentPool,
        rivalStudios: result.rivalStudios,
        opportunities: [],
        nextOpportunityCheckDay: 1,
        ...clearTransientView(),
      };
    }

    // Navigates to a rival's own read-only page (Dashboard's "Rival
    // Studios" list or a Top 10 row's studio name) - identified by name,
    // same as Film.releasedBy, so no id lookup is needed either place it's
    // triggered from. Doesn't touch the calendar; it's just a detour, same
    // as opening the Dashboard's Studio History table.
    case 'VIEW_RIVAL_STUDIO':
      return { ...state, screen: 'rival-studio', ...clearTransientView({ viewingRivalStudioName: action.studioName }) };

    // Dashboard's Shooting card -> lets the player check in on a specific
    // background production (events so far, current status) without
    // disturbing anything else - see GameState.viewingProductionId.
    // Reachable only from the Dashboard, where `focusedProjectId` is always
    // already null, so this never competes with unrelated in-progress work.
    case 'VIEW_PRODUCTION':
      return { ...state, screen: 'production', ...clearTransientView({ viewingProductionId: action.productionId }) };

    // Dashboard -> the filterable film-history table. Pure detour, same as
    // VIEW_RIVAL_STUDIO - doesn't touch the calendar.
    case 'VIEW_STATS':
      return { ...state, screen: 'stats', ...clearTransientView() };

    // Dashboard -> the release calendar (roadmap Phase 7.3). Pure detour,
    // same as VIEW_STATS/VIEW_RIVAL_STUDIO - doesn't touch the calendar.
    case 'VIEW_RELEASE_CALENDAR':
      return { ...state, screen: 'release-calendar', ...clearTransientView() };

    // Dashboard -> the shared Opportunity pool (development-pipeline doc).
    // Pure detour, same as VIEW_STATS.
    case 'VIEW_OPPORTUNITY_MARKET':
      return { ...state, screen: 'opportunity-market', ...clearTransientView() };

    // Dashboard -> the studio's owned Assets. Pure detour, same as VIEW_STATS.
    case 'VIEW_ASSET_LIBRARY':
      return { ...state, screen: 'asset-library', ...clearTransientView() };

    // Dashboard -> every current project, one card each. Pure detour, same as VIEW_STATS.
    case 'VIEW_PROJECTS':
      return { ...state, screen: 'projects', ...clearTransientView() };

    // Restores an exact prior "page" - see GameAction's own comment on why
    // this one, unlike every other navigation action, can't just trust its
    // payload: the project or rival a browser history entry points at may
    // have been abandoned or otherwise stopped existing since the player was
    // last there. Falls back to the Dashboard, exactly like
    // RETURN_TO_DASHBOARD, rather than restoring a reference to something
    // that's gone.
    case 'RESTORE_NAVIGATION': {
      const focusedStillExists = action.focusedProjectId === null || findProject(state.projects, action.focusedProjectId) !== null;
      const viewedProductionStillExists = action.viewingProductionId === null || findProject(state.projects, action.viewingProductionId) !== null;
      const viewedRivalStillExists =
        action.viewingRivalStudioName === null || state.rivalStudios.some((r) => r.name === action.viewingRivalStudioName);
      if (!focusedStillExists || !viewedProductionStillExists || !viewedRivalStillExists) {
        return { ...state, screen: 'dashboard', focusedProjectId: null, projectWorkspaceSection: 'overview', ...clearTransientView() };
      }
      return {
        ...state,
        screen: action.screen,
        focusedProjectId: action.focusedProjectId,
        projectWorkspaceSection: action.projectWorkspaceSection,
        viewingRivalStudioName: action.viewingRivalStudioName,
        viewingProductionId: action.viewingProductionId,
      };
    }

    default:
      return state;
  }
}
