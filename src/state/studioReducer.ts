import type { Film, FilmDraft, PendingEventChoice, ProductionEvent, Project, RivalProductionInProgress, Studio, Talent, TalentRole, WizardStep } from '../types';
import { type GameAction, type GameState, createEmptyDraft, createInitialStudio } from './gameState';
import { randomSeed, withRng, clamp } from '../engine/random';
import { generateScriptOptions } from '../engine/scriptGenerator';
import { logAmount } from '../engine/interpolate';
import { ALL_TALENT_ROLES, MANDATORY_TALENT_ROLES, ROLE_GENERATION_PROFILES } from '../data/talentGeneration';
import { effectiveRoleCapacity } from '../engine/castRequirements';
import { computeRecommendedShootDays, computeStaticProductionRisk, rollDayEvent, resolveEventChoice } from '../engine/production';
import { computeDailyContingencyBurn, computeProductionBudgetCost, computeTalentCost } from '../engine/cost';
import { adaptRecommendationsToProductionChoices } from '../engine/productionChoicesAdapter';
import { STAGE_DURATIONS } from '../data/schedule';
import { settleBoxOfficeForAllFilms, type BoxOfficeSettlement } from '../engine/boxOfficeRun';
import { settleRivalMarket, generateRivalStudios } from '../engine/rivalStudios';
import { settleProductionsInProgress } from '../engine/productionsInProgress';
import { settleScheduledReleases, type ScheduledRelease } from '../engine/scheduledReleases';
import { generateTalentPool } from '../engine/talentGenerator';
import { applyReputationChange } from '../engine/reputation';
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
} from '../engine/project';

// The canonical forward order of the wizard - used only to tell a forward
// GO_TO_STEP (advance the calendar by that stage's fixed duration, see
// data/schedule.ts) apart from a backward one (Back buttons; no time cost
// for revisiting a screen you're still deciding on).
const WIZARD_STEP_ORDER: WizardStep[] = [
  'develop',
  'talent',
  'production-planning',
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
function defaultTalentTargetPrices(): Partial<Record<TalentRole, number>> {
  const result: Partial<Record<TalentRole, number>> = {};
  for (const role of ALL_TALENT_ROLES) {
    result[role] = logAmount(0.5, ROLE_GENERATION_PROFILES[role].salaryRange);
  }
  return result;
}

/**
 * Folds a settlement's cash/reputation into a Studio object - shared by
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
    reputation: applyReputationChange(studio.reputation, settlement.reputationDelta),
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
  talentPool: Record<TalentRole, Talent[]>,
): { draft: FilmDraft; cashDelta: number } {
  const photography = d.photography!;
  const chosen = pendingChoice.choices.find((c) => c.id === chosenChoiceId);
  const extraDays = event.delayDaysDelta;
  const dailyBurn = computeDailyContingencyBurn(d.productionChoices!.contingencyAmount, photography.recommendedDays);

  let talent = d.talent;
  let cashDelta = 0;
  if (chosen?.replacementCandidateId && pendingChoice.replacementRole) {
    const candidate = talentPool[pendingChoice.replacementRole]?.find((t) => t.id === chosen.replacementCandidateId);
    if (candidate) {
      const outgoing = d.talent.find((t) => t.id === pendingChoice.involvedTalentId);
      cashDelta = -(candidate.salary - (outgoing?.salary ?? 0));
      talent = [...d.talent.filter((t) => t.id !== pendingChoice.involvedTalentId), candidate];
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
        const scheduledSettlement = settleScheduledReleases(scheduled, totalDaysAfter, state.studio.reputation, rng);
        const settlement = settleBoxOfficeForAllFilms(
          [...playerReleasedFilms(state.projects), ...scheduledSettlement.newlyReleased],
          totalDaysAfter,
        );
        const rivalMarket = settleRivalMarket(
          {
            rivalStudios: state.rivalStudios,
            rivalProductionsInProgress: rivalProductionsOf(state.projects),
            rivalFilmsReleased: rivalReleasedFilms(state.projects),
            talentPool: state.talentPool,
          },
          totalDaysAfter,
          scheduled.map((s) => s.releaseDay),
          rng,
        );
        const productionsInProgress = settleProductionsInProgress(backgroundedPlayerDrafts(state.projects, state.focusedProjectId), 1, state.talentPool, rng);
        return { settlement, rivalMarket, productionsInProgress, scheduledSettlement };
      });
      return {
        ...state,
        rngSeed: nextSeed,
        totalDays: totalDaysAfter,
        rivalStudios: result.rivalMarket.rivalStudios,
        talentPool: result.rivalMarket.talentPool,
        studio: applyBoxOfficeSettlement(state.studio, result.settlement, result.scheduledSettlement.costCharged),
        projects: assembleProjects({
          playerDrafts: [...(focusedDraft ? [focusedDraft] : []), ...result.productionsInProgress],
          scheduled: result.scheduledSettlement.stillScheduled,
          rivalProductions: result.rivalMarket.rivalProductionsInProgress,
          playerFilms: result.settlement.filmsReleased,
          rivalFilms: result.rivalMarket.rivalFilmsReleased,
        }),
      };
    }

    case 'START_NEW_FILM': {
      const draft: FilmDraft = { ...createEmptyDraft(), talentTargetPriceByRole: defaultTalentTargetPrices() };
      return {
        ...state,
        screen: 'develop',
        projects: [...state.projects, playerDraftToProject(draft)],
        focusedProjectId: draft.id,
        ...clearTransientView(),
      };
    }

    case 'GO_TO_STEP': {
      // Any normal wizard navigation stops "viewing" a backgrounded
      // production (see GameState.viewingProductionId) - otherwise a stale
      // view could shadow the focused project the next time screen becomes
      // 'production' the ordinary way (BEGIN_PHOTOGRAPHY doesn't change
      // screen itself; it's already 'production' by the time it fires).
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
        const scheduledSettlement = settleScheduledReleases(scheduled, totalDaysAfter, state.studio.reputation, rng);
        const settlement = settleBoxOfficeForAllFilms(
          [...playerReleasedFilms(state.projects), ...scheduledSettlement.newlyReleased],
          totalDaysAfter,
        );
        const rivalMarket = settleRivalMarket(
          {
            rivalStudios: state.rivalStudios,
            rivalProductionsInProgress: rivalProductionsOf(state.projects),
            rivalFilmsReleased: rivalReleasedFilms(state.projects),
            talentPool: state.talentPool,
          },
          totalDaysAfter,
          scheduled.map((s) => s.releaseDay),
          rng,
        );
        const productionsInProgress = settleProductionsInProgress(backgroundedPlayerDrafts(state.projects, state.focusedProjectId), stageDuration, state.talentPool, rng);
        return { settlement, rivalMarket, productionsInProgress, scheduledSettlement };
      });
      return {
        ...state,
        rngSeed: nextSeed,
        screen: action.step,
        totalDays: totalDaysAfter,
        rivalStudios: result.rivalMarket.rivalStudios,
        talentPool: result.rivalMarket.talentPool,
        ...clearTransientView(),
        studio: applyBoxOfficeSettlement(state.studio, result.settlement, result.scheduledSettlement.costCharged),
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

    case 'SET_GENRE': {
      const focusedDraft = asPlayerDraft(findProject(state.projects, state.focusedProjectId));
      if (!focusedDraft) return state;
      // Talent is a persistent studio-wide roster (generated once, see
      // createInitialStudio) with affinity for every genre already baked
      // in, so changing genre only needs to regenerate the script slate.
      const { result: scriptOptions, nextSeed } = withRng(state.rngSeed, (rng) =>
        generateScriptOptions(action.genre, rng),
      );
      return {
        ...state,
        rngSeed: nextSeed,
        projects: replaceDraft(state.projects, { ...focusedDraft, genre: action.genre, scriptOptions, script: null }),
      };
    }

    case 'SET_TARGET_AUDIENCE': {
      const focusedDraft = asPlayerDraft(findProject(state.projects, state.focusedProjectId));
      if (!focusedDraft) return state;
      return { ...state, projects: replaceDraft(state.projects, { ...focusedDraft, targetAudience: action.targetAudience }) };
    }

    case 'REROLL_SCRIPTS': {
      const focusedDraft = asPlayerDraft(findProject(state.projects, state.focusedProjectId));
      if (!focusedDraft?.genre) return state;
      const { result: scriptOptions, nextSeed } = withRng(state.rngSeed, (rng) =>
        generateScriptOptions(focusedDraft.genre!, rng),
      );
      return { ...state, rngSeed: nextSeed, projects: replaceDraft(state.projects, { ...focusedDraft, scriptOptions, script: null }) };
    }

    case 'SELECT_SCRIPT': {
      const focusedDraft = asPlayerDraft(findProject(state.projects, state.focusedProjectId));
      if (!focusedDraft) return state;
      // Pre-fill Target Audience from the script's own intended audience -
      // it was written with someone in mind, so that's a better default
      // than making the player pick blind. Still fully overridable
      // afterward via SET_TARGET_AUDIENCE. Title only pre-fills from the
      // script's own title when the player hasn't typed a working title of
      // their own yet - unlike Target Audience, a title the player already
      // chose is never something a script pick should clobber.
      return {
        ...state,
        projects: replaceDraft(state.projects, {
          ...focusedDraft,
          script: action.script,
          targetAudience: action.script.intendedAudience,
          title: focusedDraft.title.trim() ? focusedDraft.title : action.script.title,
        }),
      };
    }

    case 'SET_TALENT_FOR_ROLE': {
      const focusedDraft = asPlayerDraft(findProject(state.projects, state.focusedProjectId));
      if (!focusedDraft) return state;
      const withoutRole = focusedDraft.talent.filter((t) => t.role !== action.role);
      const nextTalent = action.talent ? [...withoutRole, action.talent] : withoutRole;
      return { ...state, projects: replaceDraft(state.projects, { ...focusedDraft, talent: nextTalent }) };
    }

    // For roles that can hold more than one person (Lead Actor and
    // Supporting Actor, capacity driven by the script - see
    // engine/castRequirements.ts): add this candidate if there's room, or
    // remove them if already hired. Silently no-ops at capacity rather than
    // erroring - the UI disables unhired candidates once a role is full, so
    // this is a defensive guard.
    case 'TOGGLE_TALENT_FOR_ROLE': {
      const focusedDraft = asPlayerDraft(findProject(state.projects, state.focusedProjectId));
      if (!focusedDraft) return state;
      const current = focusedDraft.talent.filter((t) => t.role === action.role);
      const alreadyHired = current.some((t) => t.id === action.talent.id);
      const capacity = effectiveRoleCapacity(action.role, focusedDraft.script);

      let nextTalent: Talent[];
      if (alreadyHired) {
        nextTalent = focusedDraft.talent.filter((t) => t.id !== action.talent.id);
      } else if (current.length < capacity.max) {
        nextTalent = [...focusedDraft.talent, action.talent];
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
        const range = ROLE_GENERATION_PROFILES[role].salaryRange;
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

    // Talent salaries, the non-contingency production budget (set/practical/
    // VFX), and the full contingency reserve all leave studio.cash right
    // here, rather than waiting for RELEASE_FILM - that's what makes a
    // production a real, ongoing cash commitment instead of a promise to
    // pay later, especially now that a shoot can run in the background for
    // a long time (see docs/DESIGN.md 5.x). Talent salary is kept in sync
    // afterward by any recast (resolveChoiceOnDraft's cashDelta, below);
    // the production budget is fixed once photography begins (nothing
    // after this point edits productionChoices). Contingency is the only
    // one of the three that's refundable - settled against what was
    // actually burned at FINISH_PHOTOGRAPHY. RELEASE_FILM's own cash
    // deduction is adjusted to not charge these three a second time.
    case 'BEGIN_PHOTOGRAPHY': {
      const focusedDraft = asPlayerDraft(findProject(state.projects, state.focusedProjectId));
      if (!focusedDraft?.script || !focusedDraft.productionChoices) return state;
      const recommendedDays = computeRecommendedShootDays(focusedDraft.talent, focusedDraft.script, focusedDraft.productionChoices);
      const upfrontCharge =
        computeTalentCost(focusedDraft.talent) +
        computeProductionBudgetCost(focusedDraft.productionChoices) +
        focusedDraft.productionChoices.contingencyAmount;
      return {
        ...state,
        studio: { ...state.studio, cash: state.studio.cash - upfrontCharge },
        projects: replaceDraft(state.projects, {
          ...focusedDraft,
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
          const scheduledSettlement = settleScheduledReleases(scheduled, totalDaysAfter, state.studio.reputation, rng);
          const settlement = settleBoxOfficeForAllFilms([...playerFilms, ...scheduledSettlement.newlyReleased], totalDaysAfter);
          const rivalMarket = settleRivalMarket(
            {
              rivalStudios: state.rivalStudios,
              rivalProductionsInProgress: rProductions,
              rivalFilmsReleased: rFilms,
              talentPool: state.talentPool,
            },
            totalDaysAfter,
            scheduled.map((s) => s.releaseDay),
            rng,
          );
          const productionsInProgress = settleProductionsInProgress(backgrounded, 1, state.talentPool, rng);
          return { kind: 'pendingChoice' as const, pendingChoice: rolled.pendingChoice, totalDaysAfter, settlement, rivalMarket, productionsInProgress, scheduledSettlement };
        }
        const event = rolled?.event ?? null;
        const daysAdvanced = 1 + (event?.delayDaysDelta ?? 0);
        const totalDaysAfter = state.totalDays + daysAdvanced;
        const scheduledSettlement = settleScheduledReleases(scheduled, totalDaysAfter, state.studio.reputation, rng);
        const settlement = settleBoxOfficeForAllFilms([...playerFilms, ...scheduledSettlement.newlyReleased], totalDaysAfter);
        const rivalMarket = settleRivalMarket(
          {
            rivalStudios: state.rivalStudios,
            rivalProductionsInProgress: rProductions,
            rivalFilmsReleased: rFilms,
            talentPool: state.talentPool,
          },
          totalDaysAfter,
          scheduled.map((s) => s.releaseDay),
          rng,
        );
        const productionsInProgress = settleProductionsInProgress(backgrounded, daysAdvanced, state.talentPool, rng);
        return { kind: 'event' as const, event, daysAdvanced, totalDaysAfter, settlement, rivalMarket, productionsInProgress, scheduledSettlement };
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
          studio: applyBoxOfficeSettlement(state.studio, result.settlement, result.scheduledSettlement.costCharged),
          projects: assembleProjects({
            playerDrafts: [updatedFocused, ...result.productionsInProgress],
            scheduled: result.scheduledSettlement.stillScheduled,
            rivalProductions: result.rivalMarket.rivalProductionsInProgress,
            playerFilms: result.settlement.filmsReleased,
            rivalFilms: result.rivalMarket.rivalFilmsReleased,
          }),
        };
      }

      const { event, daysAdvanced, totalDaysAfter, settlement, rivalMarket, productionsInProgress, scheduledSettlement } = result;
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
        studio: applyBoxOfficeSettlement(state.studio, settlement, scheduledSettlement.costCharged),
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
        const scheduledSettlement = settleScheduledReleases(scheduled, totalDaysAfter, state.studio.reputation, rng);
        const settlement = settleBoxOfficeForAllFilms([...playerFilms, ...scheduledSettlement.newlyReleased], totalDaysAfter);
        const rivalMarket = settleRivalMarket(
          {
            rivalStudios: state.rivalStudios,
            rivalProductionsInProgress: rProductions,
            rivalFilmsReleased: rFilms,
            talentPool: state.talentPool,
          },
          totalDaysAfter,
          scheduled.map((s) => s.releaseDay),
          rng,
        );
        const productionsInProgress = settleProductionsInProgress(otherBackgrounded, event.delayDaysDelta, state.talentPool, rng);
        return { event, totalDaysAfter, settlement, rivalMarket, productionsInProgress, scheduledSettlement };
      });
      const { event, totalDaysAfter, settlement, rivalMarket, productionsInProgress, scheduledSettlement } = result;

      const { draft: resolvedTarget, cashDelta } = resolveChoiceOnDraft(target, pendingChoice, action.choiceId, event, state.talentPool);

      const studioAfter: Studio = {
        ...applyBoxOfficeSettlement(state.studio, settlement, scheduledSettlement.costCharged),
        cash: state.studio.cash + settlement.cashCredit - scheduledSettlement.costCharged + cashDelta,
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

    // Makes a wrapped background production the focused project (see
    // docs/DESIGN.md 5.x) - only while nothing else is already focused, so
    // this can never silently discard unrelated in-progress work. The Inbox
    // is expected to only offer this action while focusedProjectId is null;
    // this guard is the authoritative one. Nothing moves between arrays any
    // more (roadmap Phase 5) - the production was already sitting in
    // `projects` as 'player-in-progress'; only which id is focused changes.
    case 'RESUME_FOR_POST_PRODUCTION': {
      if (state.focusedProjectId) return state;
      const production = asPlayerDraft(findProject(state.projects, action.productionId));
      if (!production?.photography || production.photography.status !== 'finished') return state;
      // Post-production already done (roadmap Phase 7.1/7.3 - a "parked,
      // needs a release day" project the Inbox surfaces distinctly, see
      // components/common/Inbox.tsx) picks up straight at Marketing &
      // Release instead of revisiting post-production choices that are
      // already locked in.
      return {
        ...state,
        screen: production.postProductionChoices ? 'marketing' : 'post-production',
        focusedProjectId: action.productionId,
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
          state.studio.reputation,
          rng,
        );
        const settlement = settleBoxOfficeForAllFilms([...playerFilms, ...scheduledSettlement.newlyReleased], totalDaysAfter);
        const rivalMarket = settleRivalMarket(
          {
            rivalStudios: state.rivalStudios,
            rivalProductionsInProgress: rProductions,
            rivalFilmsReleased: rFilms,
            talentPool: state.talentPool,
          },
          totalDaysAfter,
          [...otherScheduled.map((s) => s.releaseDay), releaseDay],
          rng,
        );
        const productionsInProgress = settleProductionsInProgress(backgrounded, STAGE_DURATIONS.marketing ?? 0, state.talentPool, rng);
        return { settlement, rivalMarket, productionsInProgress, scheduledSettlement };
      });

      const studioAfter = applyBoxOfficeSettlement(state.studio, result.settlement, result.scheduledSettlement.costCharged);

      return {
        ...state,
        rngSeed: nextSeed,
        screen: resolvedNow ? 'results' : 'dashboard',
        focusedProjectId: resolvedNow ? state.focusedProjectId : null,
        totalDays: totalDaysAfter,
        rivalStudios: result.rivalMarket.rivalStudios,
        talentPool: result.rivalMarket.talentPool,
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

    case 'RETURN_TO_DASHBOARD': {
      const d = asPlayerDraft(findProject(state.projects, state.focusedProjectId));
      if (!d) {
        // Nothing focused, or the focused project already transitioned to
        // 'released' (RELEASE_FILM keeps the same id, see engine/project.ts)
        // - either way there's nothing here to discard or background, just
        // stop focusing it.
        return { ...state, screen: 'dashboard', focusedProjectId: null, ...clearTransientView() };
      }
      if (!d.photography) {
        // Nothing committed yet (still develop/talent/planning) - discard
        // for real: this project never existed as far as studio history is
        // concerned, so it's removed from `projects` outright rather than
        // left behind as an abandoned draft with no photography.
        return {
          ...state,
          screen: 'dashboard',
          focusedProjectId: null,
          projects: state.projects.filter((p) => projectId(p) !== d.id),
          ...clearTransientView(),
        };
      }
      // Photography has started - it's already sitting in `projects` as
      // 'player-in-progress', so there's nothing to move to the background;
      // just stop focusing it, and reserve its cast/crew the same way a
      // rival studio's own casting does (engine/rivalStudios.ts:startRivalProduction's
      // bookedIds/updatedPool), so the same actor can't get hired into a
      // second concurrent production - the player's own or a rival's -
      // while genuinely on this one's set. A rough estimate (recommendedDays
      // from today) is fine here, same as rivals already use, since
      // overrunning has no hard cap.
      const bookedUntil = state.totalDays + d.photography.recommendedDays;
      const bookedIds = new Set(d.talent.map((t) => t.id));
      const talentPool = { ...state.talentPool };
      for (const role of Object.keys(talentPool) as TalentRole[]) {
        talentPool[role] = talentPool[role].map((t) => (bookedIds.has(t.id) ? { ...t, bookedUntil } : t));
      }
      return {
        ...state,
        screen: 'dashboard',
        focusedProjectId: null,
        ...clearTransientView(),
        talentPool,
      };
    }

    case 'RESET_SAVE': {
      // A fresh studio gets a brand new talent pool and rival roster too -
      // reusing the old ones would defeat the point of resetting.
      const { result, nextSeed } = withRng(randomSeed(), (rng) => ({
        talentPool: generateTalentPool(rng),
        rivalStudios: generateRivalStudios(rng),
      }));
      return {
        studio: createInitialStudio(action.startingCash),
        screen: 'dashboard',
        projects: [],
        focusedProjectId: null,
        rngSeed: nextSeed,
        totalDays: 1,
        talentPool: result.talentPool,
        rivalStudios: result.rivalStudios,
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

    default:
      return state;
  }
}
