import type { Asset, Film, FilmDraft, Opportunity, PendingEventChoice, ProductionEvent, ProductionRole, Project, RivalProductionInProgress, Studio, Talent, TalentAssignment, TalentProfession, WizardStep } from '../types';
import { type GameAction, type GameState, createDraftFromAsset, createInitialStudio } from './gameState';
import { randomSeed, withRng, clamp } from '../engine/random';
import { logAmount } from '../engine/interpolate';
import { ALL_TALENT_ROLES, MANDATORY_TALENT_ROLES, ROLE_GENERATION_PROFILES } from '../data/talentGeneration';
import { professionForProductionRole } from '../data/helpers';
import { effectiveRoleCapacity } from '../engine/castRequirements';
import { computeRecommendedShootDays, computeStaticProductionRisk, rollDayEvent, resolveEventChoice } from '../engine/production';
import { computeDailyContingencyBurn, computeProductionBudgetCost, computeTalentCost } from '../engine/cost';
import { adaptRecommendationsToProductionChoices } from '../engine/productionChoicesAdapter';
import { STAGE_DURATIONS } from '../data/schedule';
import { settleBoxOfficeForAllFilms, type BoxOfficeSettlement } from '../engine/boxOfficeRun';
import { settleRivalMarket, generateRivalStudios } from '../engine/rivalStudios';
import { settleProductionsInProgress } from '../engine/productionsInProgress';
import { settleScheduledReleases, type ScheduledRelease } from '../engine/scheduledReleases';
import { settleOpportunities, reopenForfeitedOpportunity, highestBid, placeBid, type ResolvedBid } from '../engine/opportunities';
import { generateTalentPool } from '../engine/talentGenerator';
import { applyStatChange } from '../engine/reputation';
import { TEST_SCRIPT_ASSETS } from '../data/testScripts';
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

// The canonical forward order of the wizard - used only to tell a forward
// GO_TO_STEP (advance the calendar by that stage's fixed duration, see
// data/schedule.ts) apart from a backward one (Back buttons; no time cost
// for revisiting a screen you're still deciding on).
const WIZARD_STEP_ORDER: WizardStep[] = [
  'develop',
  'talent',
  'production-planning',
  'greenlight',
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
 * Folds a settlement's cash/brand/prestige into a Studio object - shared by
 * every reducer case that advances totalDays (GO_TO_STEP,
 * ADVANCE_SHOOTING_DAY, RESOLVE_EVENT_CHOICE, SCHEDULE_RELEASE), since any
 * of them can cross a weekly boundary for a film still in theaters.
 * `scheduledReleaseCharge` (roadmap Phase 7.2) is whatever
 * settleScheduledReleases.costCharged came back as this same call - a
 * second, independent cash movement (what newly-released scheduled films
 * owe) folded in here too so every calendar-advancing case only has one
 * cash line to write instead of two. The settled Film records themselves
 * (settlement.filmsReleased) are folded into GameState.projects by the
 * caller instead - see assembleProjects below (roadmap Phase 5: Studio no
 * longer carries filmsReleased at all).
 */
function applyBoxOfficeSettlement(studio: Studio, settlement: BoxOfficeSettlement, scheduledReleaseCharge = 0): Studio {
  return {
    ...studio,
    cash: studio.cash + settlement.cashCredit - scheduledReleaseCharge,
    brand: applyStatChange(studio.brand, settlement.brandDelta),
    prestige: applyStatChange(studio.prestige, settlement.prestigeDelta),
  };
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
  talentPool: Record<TalentProfession, Talent[]>,
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
    const outgoing = d.talent.find((a) => a.talent.id === pendingChoice.involvedTalentId);
    if (candidate && outgoing) {
      cashDelta = -(candidate.salary - outgoing.talent.salary);
      talent = [...d.talent.filter((a) => a.talent.id !== pendingChoice.involvedTalentId), { role: outgoing.role, talent: candidate }];
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

// Talent salary, the non-contingency production budget, and the contingency
// reserve are charged/settled as production actually happens (BEGIN_PHOTOGRAPHY,
// resolveChoiceOnDraft, FINISH_PHOTOGRAPHY, below) - only script cost, event
// cost swings, the test screening fee, and marketing are still charged once,
// at RELEASE_FILM, computed fresh from the complete draft - see
// state/selectors.ts for the live preview shown before
// then. Box office revenue is the one thing that now lands gradually
// instead, credited week by week as a film's run actually plays out (see
// applyBoxOfficeSettlement above and docs/DESIGN.md 5.19).
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
      const scheduled = scheduledPlayerReleases(state.projects);
      const { result, nextSeed } = withRng(state.rngSeed, (rng) => {
        const scheduledSettlement = settleScheduledReleases(scheduled, totalDaysAfter, state.studio.brand, rng);
        const settlement = settleBoxOfficeForAllFilms(
          [...playerReleasedFilms(state.projects), ...scheduledSettlement.newlyReleased],
          totalDaysAfter,
        );
        const opportunitySettlement = settleOpportunities(state.opportunities, state.nextOpportunityCheckDay, totalDaysAfter, rng);
        const opportunityWins = applyOpportunityWins(state.studio, opportunitySettlement.resolvedBids, opportunitySettlement.opportunities, totalDaysAfter);
        const rivalMarket = settleRivalMarket(
          {
            rivalStudios: state.rivalStudios,
            rivalProductionsInProgress: rivalProductionsOf(state.projects),
            rivalFilmsReleased: rivalReleasedFilms(state.projects),
            talentPool: state.talentPool,
            opportunities: opportunityWins.opportunities,
          },
          opportunitySettlement.resolvedBids.filter((b) => b.winnerId !== 'player'),
          totalDaysAfter,
          scheduled.map((s) => s.releaseDay),
          rng,
        );
        const productionsInProgress = settleProductionsInProgress(backgroundedPlayerDrafts(state.projects, state.focusedProjectId), 1, state.talentPool, rng);
        return { settlement, rivalMarket, productionsInProgress, scheduledSettlement, opportunitySettlement, opportunityWins };
      });
      return {
        ...state,
        rngSeed: nextSeed,
        totalDays: totalDaysAfter,
        rivalStudios: result.rivalMarket.rivalStudios,
        talentPool: result.rivalMarket.talentPool,
        opportunities: result.rivalMarket.opportunities,
        nextOpportunityCheckDay: result.opportunitySettlement.nextGenerationCheckDay,
        studio: applyBoxOfficeSettlement(result.opportunityWins.studio, result.settlement, result.scheduledSettlement.costCharged),
        projects: assembleProjects({
          playerDrafts: [...(focusedDraft ? [focusedDraft] : []), ...result.productionsInProgress],
          scheduled: result.scheduledSettlement.stillScheduled,
          rivalProductions: result.rivalMarket.rivalProductionsInProgress,
          playerFilms: result.settlement.filmsReleased,
          rivalFilms: result.rivalMarket.rivalFilmsReleased,
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
        screen: 'develop',
        projects: [...state.projects, playerDraftToProject(draft)],
        focusedProjectId: draft.id,
        ...clearTransientView(),
      };
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
      const scheduled = scheduledPlayerReleases(state.projects);
      const { result, nextSeed } = withRng(state.rngSeed, (rng) => {
        const scheduledSettlement = settleScheduledReleases(scheduled, totalDaysAfter, state.studio.brand, rng);
        const settlement = settleBoxOfficeForAllFilms(
          [...playerReleasedFilms(state.projects), ...scheduledSettlement.newlyReleased],
          totalDaysAfter,
        );
        const opportunitySettlement = settleOpportunities(state.opportunities, state.nextOpportunityCheckDay, totalDaysAfter, rng);
        const opportunityWins = applyOpportunityWins(state.studio, opportunitySettlement.resolvedBids, opportunitySettlement.opportunities, totalDaysAfter);
        const rivalMarket = settleRivalMarket(
          {
            rivalStudios: state.rivalStudios,
            rivalProductionsInProgress: rivalProductionsOf(state.projects),
            rivalFilmsReleased: rivalReleasedFilms(state.projects),
            talentPool: state.talentPool,
            opportunities: opportunityWins.opportunities,
          },
          opportunitySettlement.resolvedBids.filter((b) => b.winnerId !== 'player'),
          totalDaysAfter,
          scheduled.map((s) => s.releaseDay),
          rng,
        );
        const productionsInProgress = settleProductionsInProgress(backgroundedPlayerDrafts(state.projects, state.focusedProjectId), stageDuration, state.talentPool, rng);
        return { settlement, rivalMarket, productionsInProgress, scheduledSettlement, opportunitySettlement, opportunityWins };
      });
      return {
        ...state,
        rngSeed: nextSeed,
        screen: action.step,
        totalDays: totalDaysAfter,
        rivalStudios: result.rivalMarket.rivalStudios,
        talentPool: result.rivalMarket.talentPool,
        opportunities: result.rivalMarket.opportunities,
        nextOpportunityCheckDay: result.opportunitySettlement.nextGenerationCheckDay,
        ...clearTransientView(),
        studio: applyBoxOfficeSettlement(result.opportunityWins.studio, result.settlement, result.scheduledSettlement.costCharged),
        projects: assembleProjects({
          playerDrafts: [{ ...focusedDraft, furthestStepIndexCharged: fromIdx }, ...result.productionsInProgress],
          scheduled: result.scheduledSettlement.stillScheduled,
          rivalProductions: result.rivalMarket.rivalProductionsInProgress,
          playerFilms: result.settlement.filmsReleased,
          rivalFilms: result.rivalMarket.rivalFilmsReleased,
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
      if (action.talent && focusedDraft.talent.some((a) => a.role !== action.role && a.talent.id === action.talent!.id)) {
        return state;
      }
      const withoutRole = focusedDraft.talent.filter((a) => a.role !== action.role);
      const nextTalent = action.talent ? [...withoutRole, { role: action.role, talent: action.talent }] : withoutRole;
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
      const alreadyHired = current.some((a) => a.talent.id === action.talent.id);
      if (!alreadyHired && focusedDraft.talent.some((a) => a.role !== action.role && a.talent.id === action.talent.id)) {
        return state;
      }
      const capacity = effectiveRoleCapacity(action.role, focusedDraft.script);

      let nextTalent: TalentAssignment[];
      if (alreadyHired) {
        nextTalent = focusedDraft.talent.filter((a) => a.talent.id !== action.talent.id);
      } else if (current.length < capacity.max) {
        nextTalent = [...focusedDraft.talent, { role: action.role, talent: action.talent }];
      } else {
        return state;
      }
      return { ...state, projects: replaceDraft(state.projects, { ...focusedDraft, talent: nextTalent }) };
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
      const recommendedDays = computeRecommendedShootDays(focusedDraft.talent, focusedDraft.script, focusedDraft.productionChoices);
      const upfrontCharge =
        computeTalentCost(focusedDraft.talent.map((a) => a.talent)) +
        computeProductionBudgetCost(focusedDraft.productionChoices) +
        focusedDraft.productionChoices.contingencyAmount;
      if (upfrontCharge > state.studio.cash) return state;

      const bookedUntil = state.totalDays + recommendedDays;
      const bookedIds = new Set(focusedDraft.talent.map((a) => a.talent.id));
      const talentPool = { ...state.talentPool };
      for (const role of Object.keys(talentPool) as TalentProfession[]) {
        talentPool[role] = talentPool[role].map((t) => (bookedIds.has(t.id) ? { ...t, bookedUntil } : t));
      }

      return {
        ...state,
        screen: 'production',
        talentPool,
        studio: { ...state.studio, cash: state.studio.cash - upfrontCharge },
        projects: replaceDraft(state.projects, {
          ...focusedDraft,
          greenlitOnDay: state.totalDays,
          photography: { status: 'in-progress', recommendedDays, daysElapsed: 0, events: [], runningCost: 0, pendingChoice: null },
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
      const playerFilms = playerReleasedFilms(state.projects);
      const scheduled = scheduledPlayerReleases(state.projects);
      const rProductions = rivalProductionsOf(state.projects);
      const rFilms = rivalReleasedFilms(state.projects);

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
          const scheduledSettlement = settleScheduledReleases(scheduled, totalDaysAfter, state.studio.brand, rng);
          const settlement = settleBoxOfficeForAllFilms([...playerFilms, ...scheduledSettlement.newlyReleased], totalDaysAfter);
          const opportunitySettlement = settleOpportunities(state.opportunities, state.nextOpportunityCheckDay, totalDaysAfter, rng);
          const opportunityWins = applyOpportunityWins(state.studio, opportunitySettlement.resolvedBids, opportunitySettlement.opportunities, totalDaysAfter);
          const rivalMarket = settleRivalMarket(
            {
              rivalStudios: state.rivalStudios,
              rivalProductionsInProgress: rProductions,
              rivalFilmsReleased: rFilms,
              talentPool: state.talentPool,
              opportunities: opportunityWins.opportunities,
            },
            opportunitySettlement.resolvedBids.filter((b) => b.winnerId !== 'player'),
            totalDaysAfter,
            scheduled.map((s) => s.releaseDay),
            rng,
          );
          const productionsInProgress = settleProductionsInProgress(backgrounded, 1, state.talentPool, rng);
          return { kind: 'pendingChoice' as const, pendingChoice: rolled.pendingChoice, totalDaysAfter, settlement, rivalMarket, productionsInProgress, scheduledSettlement, opportunitySettlement, opportunityWins };
        }
        const event = rolled?.event ?? null;
        const daysAdvanced = 1 + (event?.delayDaysDelta ?? 0);
        const totalDaysAfter = state.totalDays + daysAdvanced;
        const scheduledSettlement = settleScheduledReleases(scheduled, totalDaysAfter, state.studio.brand, rng);
        const settlement = settleBoxOfficeForAllFilms([...playerFilms, ...scheduledSettlement.newlyReleased], totalDaysAfter);
        const opportunitySettlement = settleOpportunities(state.opportunities, state.nextOpportunityCheckDay, totalDaysAfter, rng);
        const opportunityWins = applyOpportunityWins(state.studio, opportunitySettlement.resolvedBids, opportunitySettlement.opportunities, totalDaysAfter);
        const rivalMarket = settleRivalMarket(
          {
            rivalStudios: state.rivalStudios,
            rivalProductionsInProgress: rProductions,
            rivalFilmsReleased: rFilms,
            talentPool: state.talentPool,
            opportunities: opportunityWins.opportunities,
          },
          opportunitySettlement.resolvedBids.filter((b) => b.winnerId !== 'player'),
          totalDaysAfter,
          scheduled.map((s) => s.releaseDay),
          rng,
        );
        const productionsInProgress = settleProductionsInProgress(backgrounded, daysAdvanced, state.talentPool, rng);
        return { kind: 'event' as const, event, daysAdvanced, totalDaysAfter, settlement, rivalMarket, productionsInProgress, scheduledSettlement, opportunitySettlement, opportunityWins };
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
          rivalStudios: result.rivalMarket.rivalStudios,
          talentPool: result.rivalMarket.talentPool,
          opportunities: result.rivalMarket.opportunities,
          nextOpportunityCheckDay: result.opportunitySettlement.nextGenerationCheckDay,
          studio: applyBoxOfficeSettlement(result.opportunityWins.studio, result.settlement, result.scheduledSettlement.costCharged),
          projects: assembleProjects({
            playerDrafts: [updatedFocused, ...result.productionsInProgress],
            scheduled: result.scheduledSettlement.stillScheduled,
            rivalProductions: result.rivalMarket.rivalProductionsInProgress,
            playerFilms: result.settlement.filmsReleased,
            rivalFilms: result.rivalMarket.rivalFilmsReleased,
          }),
        };
      }

      const { event, daysAdvanced, totalDaysAfter, settlement, rivalMarket, productionsInProgress, scheduledSettlement, opportunitySettlement, opportunityWins } = result;
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
        rivalStudios: rivalMarket.rivalStudios,
        talentPool: rivalMarket.talentPool,
        opportunities: rivalMarket.opportunities,
        nextOpportunityCheckDay: opportunitySettlement.nextGenerationCheckDay,
        studio: applyBoxOfficeSettlement(opportunityWins.studio, settlement, scheduledSettlement.costCharged),
        projects: assembleProjects({
          playerDrafts: [updatedFocused, ...productionsInProgress],
          scheduled: scheduledSettlement.stillScheduled,
          rivalProductions: rivalMarket.rivalProductionsInProgress,
          playerFilms: settlement.filmsReleased,
          rivalFilms: rivalMarket.rivalFilmsReleased,
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
      const playerFilms = playerReleasedFilms(state.projects);
      const scheduled = scheduledPlayerReleases(state.projects);
      const rProductions = rivalProductionsOf(state.projects);
      const rFilms = rivalReleasedFilms(state.projects);

      const { result, nextSeed } = withRng(state.rngSeed, (rng) => {
        const event = resolveEventChoice(pendingChoice, action.choiceId, rng);
        const totalDaysAfter = state.totalDays + event.delayDaysDelta;
        const scheduledSettlement = settleScheduledReleases(scheduled, totalDaysAfter, state.studio.brand, rng);
        const settlement = settleBoxOfficeForAllFilms([...playerFilms, ...scheduledSettlement.newlyReleased], totalDaysAfter);
        const opportunitySettlement = settleOpportunities(state.opportunities, state.nextOpportunityCheckDay, totalDaysAfter, rng);
        const opportunityWins = applyOpportunityWins(state.studio, opportunitySettlement.resolvedBids, opportunitySettlement.opportunities, totalDaysAfter);
        const rivalMarket = settleRivalMarket(
          {
            rivalStudios: state.rivalStudios,
            rivalProductionsInProgress: rProductions,
            rivalFilmsReleased: rFilms,
            talentPool: state.talentPool,
            opportunities: opportunityWins.opportunities,
          },
          opportunitySettlement.resolvedBids.filter((b) => b.winnerId !== 'player'),
          totalDaysAfter,
          scheduled.map((s) => s.releaseDay),
          rng,
        );
        const productionsInProgress = settleProductionsInProgress(otherBackgrounded, event.delayDaysDelta, state.talentPool, rng);
        return { event, totalDaysAfter, settlement, rivalMarket, productionsInProgress, scheduledSettlement, opportunitySettlement, opportunityWins };
      });
      const { event, totalDaysAfter, settlement, rivalMarket, productionsInProgress, scheduledSettlement, opportunityWins } = result;

      const { draft: resolvedTarget, cashDelta } = resolveChoiceOnDraft(target, pendingChoice, action.choiceId, event, state.talentPool);

      const studioAfter: Studio = {
        ...applyBoxOfficeSettlement(opportunityWins.studio, settlement, scheduledSettlement.costCharged),
        cash: opportunityWins.studio.cash + settlement.cashCredit - scheduledSettlement.costCharged + cashDelta,
      };

      const playerDraftsAfter = isFocused
        ? [resolvedTarget, ...productionsInProgress]
        : [...(focusedDraft ? [focusedDraft] : []), ...productionsInProgress, resolvedTarget];

      return {
        ...state,
        rngSeed: nextSeed,
        totalDays: totalDaysAfter,
        rivalStudios: rivalMarket.rivalStudios,
        talentPool: rivalMarket.talentPool,
        opportunities: rivalMarket.opportunities,
        nextOpportunityCheckDay: result.opportunitySettlement.nextGenerationCheckDay,
        studio: studioAfter,
        projects: assembleProjects({
          playerDrafts: playerDraftsAfter,
          scheduled: scheduledSettlement.stillScheduled,
          rivalProductions: rivalMarket.rivalProductionsInProgress,
          playerFilms: settlement.filmsReleased,
          rivalFilms: rivalMarket.rivalFilmsReleased,
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
      return {
        ...state,
        studio: { ...state.studio, cash: state.studio.cash + contingencySettlement },
        projects: replaceDraft(state.projects, { ...target, photography: { ...target.photography, status: 'finished' } }),
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
      const screen: WizardStep = !project.photography
        ? 'develop'
        : project.photography.status === 'finished'
          ? (project.postProductionChoices ? 'marketing' : 'post-production')
          : 'production';
      return {
        ...state,
        screen,
        focusedProjectId: action.projectId,
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
      const playerFilms = playerReleasedFilms(state.projects);
      const rProductions = rivalProductionsOf(state.projects);
      const rFilms = rivalReleasedFilms(state.projects);

      const { result, nextSeed } = withRng(state.rngSeed, (rng) => {
        const scheduledSettlement = settleScheduledReleases(
          [...otherScheduled, { draft: d, releaseDay }],
          totalDaysAfter,
          state.studio.brand,
          rng,
        );
        const settlement = settleBoxOfficeForAllFilms([...playerFilms, ...scheduledSettlement.newlyReleased], totalDaysAfter);
        const opportunitySettlement = settleOpportunities(state.opportunities, state.nextOpportunityCheckDay, totalDaysAfter, rng);
        const opportunityWins = applyOpportunityWins(state.studio, opportunitySettlement.resolvedBids, opportunitySettlement.opportunities, totalDaysAfter);
        const rivalMarket = settleRivalMarket(
          {
            rivalStudios: state.rivalStudios,
            rivalProductionsInProgress: rProductions,
            rivalFilmsReleased: rFilms,
            talentPool: state.talentPool,
            opportunities: opportunityWins.opportunities,
          },
          opportunitySettlement.resolvedBids.filter((b) => b.winnerId !== 'player'),
          totalDaysAfter,
          [...otherScheduled.map((s) => s.releaseDay), releaseDay],
          rng,
        );
        const productionsInProgress = settleProductionsInProgress(backgrounded, STAGE_DURATIONS.marketing ?? 0, state.talentPool, rng);
        return { settlement, rivalMarket, productionsInProgress, scheduledSettlement, opportunitySettlement, opportunityWins };
      });

      const studioAfter = applyBoxOfficeSettlement(result.opportunityWins.studio, result.settlement, result.scheduledSettlement.costCharged);

      return {
        ...state,
        rngSeed: nextSeed,
        screen: resolvedNow ? 'results' : 'dashboard',
        focusedProjectId: resolvedNow ? state.focusedProjectId : null,
        totalDays: totalDaysAfter,
        rivalStudios: result.rivalMarket.rivalStudios,
        talentPool: result.rivalMarket.talentPool,
        opportunities: result.rivalMarket.opportunities,
        nextOpportunityCheckDay: result.opportunitySettlement.nextGenerationCheckDay,
        ...clearTransientView(),
        studio: studioAfter,
        projects: assembleProjects({
          playerDrafts: result.productionsInProgress,
          scheduled: result.scheduledSettlement.stillScheduled,
          rivalProductions: result.rivalMarket.rivalProductionsInProgress,
          playerFilms: result.settlement.filmsReleased,
          rivalFilms: result.rivalMarket.rivalFilmsReleased,
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

    default:
      return state;
  }
}
