import type { Film, Talent, TalentRole, WizardStep } from '../types';
import { type GameAction, type GameState, createEmptyDraft, createInitialStudio } from './gameState';
import { randomSeed, withRng, clamp } from '../engine/random';
import { generateScriptOptions } from '../engine/scriptGenerator';
import { logAmount } from '../engine/interpolate';
import { ALL_TALENT_ROLES, MANDATORY_TALENT_ROLES, ROLE_GENERATION_PROFILES } from '../data/talentGeneration';
import { effectiveRoleCapacity } from '../engine/castRequirements';
import { computeRecommendedShootDays, computeStaticProductionRisk, rollDayEvent, resolveEventChoice } from '../engine/production';
import { computeDailyContingencyBurn } from '../engine/cost';
import { adaptRecommendationsToProductionChoices } from '../engine/productionChoicesAdapter';
import { STAGE_DURATIONS } from '../data/schedule';
import { computeReleaseResults } from '../engine/releaseFilm';
import { computeWeeklyRetention } from '../engine/boxOffice';
import { settleBoxOfficeForAllFilms, type BoxOfficeSettlement } from '../engine/boxOfficeRun';
import { settleRivalMarket, type RivalMarketUpdate } from '../engine/rivalStudios';
import { applyReputationChange } from '../engine/reputation';
import type { Studio } from '../types';

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

/** Seeds every role's target price at the midpoint of its own salary range. */
function defaultTalentTargetPrices(): Partial<Record<TalentRole, number>> {
  const result: Partial<Record<TalentRole, number>> = {};
  for (const role of ALL_TALENT_ROLES) {
    result[role] = logAmount(0.5, ROLE_GENERATION_PROFILES[role].salaryRange);
  }
  return result;
}

/**
 * Folds a settlement's cash/reputation/film updates into a Studio object -
 * shared by every reducer case that advances totalDays (GO_TO_STEP,
 * ADVANCE_SHOOTING_DAY, RESOLVE_EVENT_CHOICE, RELEASE_FILM), since any of
 * them can cross a weekly boundary for a film still in theaters. See
 * engine/boxOfficeRun.ts:settleBoxOfficeForAllFilms.
 */
function applyBoxOfficeSettlement<S extends { cash: number; reputation: number; filmsReleased: Film[] }>(
  studio: S,
  settlement: BoxOfficeSettlement,
): S {
  return {
    ...studio,
    cash: studio.cash + settlement.cashCredit,
    reputation: applyReputationChange(studio.reputation, settlement.reputationDelta),
    filmsReleased: settlement.filmsReleased,
  };
}

/**
 * Folds a rival-market tick into a Studio object - called alongside
 * applyBoxOfficeSettlement at every one of the same call sites, since a
 * rival's production/release/weekly box office all move on the same
 * calendar the player's own films do. Never touches cash/reputation - none
 * of it is the player's. See engine/rivalStudios.ts:settleRivalMarket.
 */
function applyRivalMarketSettlement(studio: Studio, update: RivalMarketUpdate): Studio {
  return {
    ...studio,
    rivalStudios: update.rivalStudios,
    rivalProductionsInProgress: update.rivalProductionsInProgress,
    rivalFilmsReleased: update.rivalFilmsReleased,
    talentPool: update.talentPool,
  };
}

// Non-release cash mutations (talent salaries, production spend, marketing)
// are still only ever charged once, at RELEASE_FILM, computed fresh from the
// complete draft - see state/selectors.ts for the live preview shown before
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
      const totalDaysAfter = state.studio.totalDays + 1;
      const { result, nextSeed } = withRng(state.rngSeed, (rng) => {
        const settlement = settleBoxOfficeForAllFilms(state.studio.filmsReleased, totalDaysAfter, rng);
        const rivalMarket = settleRivalMarket({ ...state.studio, totalDays: totalDaysAfter }, rng);
        return { settlement, rivalMarket };
      });
      return {
        ...state,
        rngSeed: nextSeed,
        studio: applyRivalMarketSettlement(
          applyBoxOfficeSettlement({ ...state.studio, totalDays: totalDaysAfter }, result.settlement),
          result.rivalMarket,
        ),
      };
    }

    case 'START_NEW_FILM':
      return {
        ...state,
        screen: 'develop',
        draft: { ...createEmptyDraft(), talentTargetPriceByRole: defaultTalentTargetPrices() },
      };

    case 'GO_TO_STEP': {
      if (!state.draft) return { ...state, screen: action.step };
      const fromIdx = WIZARD_STEP_ORDER.indexOf(state.screen as WizardStep);
      const toIdx = WIZARD_STEP_ORDER.indexOf(action.step);
      // Only charge a stage's fixed duration the first time it's genuinely
      // left going forward - a Back-then-forward round trip (fromIdx no
      // further than what's already been charged) doesn't pay it twice.
      const isNewForwardProgress = fromIdx >= 0 && toIdx > fromIdx && fromIdx > state.draft.furthestStepIndexCharged;
      const leavingStage = isNewForwardProgress ? (state.screen as WizardStep) : null;
      const stageDuration = leavingStage ? STAGE_DURATIONS[leavingStage] : undefined;
      if (!stageDuration) return { ...state, screen: action.step };

      const totalDaysAfter = state.studio.totalDays + stageDuration;
      const { result, nextSeed } = withRng(state.rngSeed, (rng) => {
        const settlement = settleBoxOfficeForAllFilms(state.studio.filmsReleased, totalDaysAfter, rng);
        const rivalMarket = settleRivalMarket({ ...state.studio, totalDays: totalDaysAfter }, rng);
        return { settlement, rivalMarket };
      });
      return {
        ...state,
        rngSeed: nextSeed,
        screen: action.step,
        studio: applyRivalMarketSettlement(
          applyBoxOfficeSettlement({ ...state.studio, totalDays: totalDaysAfter }, result.settlement),
          result.rivalMarket,
        ),
        draft: { ...state.draft, furthestStepIndexCharged: fromIdx },
      };
    }

    case 'RENAME_STUDIO':
      return { ...state, studio: { ...state.studio, name: action.name } };

    case 'SET_TITLE': {
      if (!state.draft) return state;
      return { ...state, draft: { ...state.draft, title: action.title } };
    }

    case 'SET_GENRE': {
      if (!state.draft) return state;
      // Talent is a persistent studio-wide roster (generated once, see
      // createInitialStudio) with affinity for every genre already baked
      // in, so changing genre only needs to regenerate the script slate.
      const { result: scriptOptions, nextSeed } = withRng(state.rngSeed, (rng) =>
        generateScriptOptions(action.genre, rng),
      );
      return {
        ...state,
        rngSeed: nextSeed,
        draft: { ...state.draft, genre: action.genre, scriptOptions, script: null },
      };
    }

    case 'SET_TARGET_AUDIENCE': {
      if (!state.draft) return state;
      return { ...state, draft: { ...state.draft, targetAudience: action.targetAudience } };
    }

    case 'REROLL_SCRIPTS': {
      if (!state.draft || !state.draft.genre) return state;
      const { result: scriptOptions, nextSeed } = withRng(state.rngSeed, (rng) =>
        generateScriptOptions(state.draft!.genre!, rng),
      );
      return { ...state, rngSeed: nextSeed, draft: { ...state.draft, scriptOptions, script: null } };
    }

    case 'SELECT_SCRIPT': {
      if (!state.draft) return state;
      // Pre-fill Target Audience from the script's own intended audience -
      // it was written with someone in mind, so that's a better default
      // than making the player pick blind. Still fully overridable
      // afterward via SET_TARGET_AUDIENCE.
      return {
        ...state,
        draft: { ...state.draft, script: action.script, targetAudience: action.script.intendedAudience },
      };
    }

    case 'SET_TALENT_FOR_ROLE': {
      if (!state.draft) return state;
      const withoutRole = state.draft.talent.filter((t) => t.role !== action.role);
      const nextTalent = action.talent ? [...withoutRole, action.talent] : withoutRole;
      return { ...state, draft: { ...state.draft, talent: nextTalent } };
    }

    // For roles that can hold more than one person (Lead Actor and
    // Supporting Actor, capacity driven by the script - see
    // engine/castRequirements.ts): add this candidate if there's room, or
    // remove them if already hired. Silently no-ops at capacity rather than
    // erroring - the UI disables unhired candidates once a role is full, so
    // this is a defensive guard.
    case 'TOGGLE_TALENT_FOR_ROLE': {
      if (!state.draft) return state;
      const current = state.draft.talent.filter((t) => t.role === action.role);
      const alreadyHired = current.some((t) => t.id === action.talent.id);
      const capacity = effectiveRoleCapacity(action.role, state.draft.script);

      let nextTalent: Talent[];
      if (alreadyHired) {
        nextTalent = state.draft.talent.filter((t) => t.id !== action.talent.id);
      } else if (current.length < capacity.max) {
        nextTalent = [...state.draft.talent, action.talent];
      } else {
        return state;
      }
      return { ...state, draft: { ...state.draft, talent: nextTalent } };
    }

    case 'SET_TALENT_TARGET_PRICE': {
      if (!state.draft) return state;
      return {
        ...state,
        draft: {
          ...state.draft,
          talentTargetPriceByRole: { ...state.draft.talentTargetPriceByRole, [action.role]: action.price },
        },
      };
    }

    case 'SET_TALENT_BUDGET_SPLIT': {
      if (!state.draft) return state;
      // Split per *head*, not per role - Lead Actor and Supporting Actor can
      // each require more than one hire (script.requiredLeads/requiredSupporting),
      // so a script needing 3 leads and 3 supporting actors has 8 mandatory
      // heads to cast, not 6. Splitting the budget across a flat 6 roles
      // understated the target price for every multi-hire role by however
      // many extra people it actually needs.
      const totalHeads = MANDATORY_TALENT_ROLES.reduce(
        (sum, role) => sum + effectiveRoleCapacity(role, state.draft!.script).max,
        0,
      );
      const perHead = action.totalBudget / totalHeads;
      const updated = { ...state.draft.talentTargetPriceByRole };
      for (const role of MANDATORY_TALENT_ROLES) {
        const range = ROLE_GENERATION_PROFILES[role].salaryRange;
        updated[role] = clamp(perHead, range.min, range.max);
      }
      return { ...state, draft: { ...state.draft, talentTargetPriceByRole: updated } };
    }

    case 'SET_PRODUCTION_PLAN': {
      if (!state.draft) return state;
      const productionChoices = adaptRecommendationsToProductionChoices(
        action.environmentAmbition,
        action.effectsStrategy,
        action.effectsAmbition,
        action.contingencyAmount,
        action.runtimeIntensity,
      );
      return {
        ...state,
        draft: {
          ...state.draft,
          environmentStrategy: action.environmentStrategy,
          environmentAmbition: action.environmentAmbition,
          effectsStrategy: action.effectsStrategy,
          effectsAmbition: action.effectsAmbition,
          productionChoices,
        },
      };
    }

    case 'BEGIN_PHOTOGRAPHY': {
      if (!state.draft || !state.draft.script || !state.draft.productionChoices) return state;
      const recommendedDays = computeRecommendedShootDays(state.draft.talent, state.draft.script, state.draft.productionChoices);
      return {
        ...state,
        draft: {
          ...state.draft,
          photography: { status: 'in-progress', recommendedDays, daysElapsed: 0, events: [], runningCost: 0, pendingChoice: null },
        },
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
    // choice interrupts it.
    case 'ADVANCE_SHOOTING_DAY': {
      const d = state.draft;
      if (!d?.photography || d.photography.status !== 'in-progress' || !d.script || !d.productionChoices || !d.genre) {
        return state;
      }
      const staticRisk = computeStaticProductionRisk(d.talent, d.script, d.productionChoices, d.genre);
      const usedIds = new Set(d.photography.events.map((e) => e.id));

      const { result, nextSeed } = withRng(state.rngSeed, (rng) => {
        const rolled = rollDayEvent(
          staticRisk,
          d.photography!.daysElapsed + 1,
          d.photography!.recommendedDays,
          d.genre!,
          usedIds,
          d.talent,
          d.script,
          state.studio.talentPool,
          rng,
        );
        if (rolled && 'pendingChoice' in rolled) {
          const totalDaysAfter = state.studio.totalDays + 1;
          const settlement = settleBoxOfficeForAllFilms(state.studio.filmsReleased, totalDaysAfter, rng);
          const rivalMarket = settleRivalMarket({ ...state.studio, totalDays: totalDaysAfter }, rng);
          return { kind: 'pendingChoice' as const, pendingChoice: rolled.pendingChoice, totalDaysAfter, settlement, rivalMarket };
        }
        const event = rolled?.event ?? null;
        const daysAdvanced = 1 + (event?.delayDaysDelta ?? 0);
        const totalDaysAfter = state.studio.totalDays + daysAdvanced;
        const settlement = settleBoxOfficeForAllFilms(state.studio.filmsReleased, totalDaysAfter, rng);
        const rivalMarket = settleRivalMarket({ ...state.studio, totalDays: totalDaysAfter }, rng);
        return { kind: 'event' as const, event, daysAdvanced, totalDaysAfter, settlement, rivalMarket };
      });

      const dailyBurn = computeDailyContingencyBurn(d.productionChoices.contingencyAmount, d.photography.recommendedDays);

      if (result.kind === 'pendingChoice') {
        return {
          ...state,
          rngSeed: nextSeed,
          studio: applyRivalMarketSettlement(
            applyBoxOfficeSettlement({ ...state.studio, totalDays: result.totalDaysAfter }, result.settlement),
            result.rivalMarket,
          ),
          draft: {
            ...d,
            photography: {
              ...d.photography,
              status: 'awaiting-choice',
              daysElapsed: d.photography.daysElapsed + 1,
              runningCost: d.photography.runningCost + dailyBurn,
              pendingChoice: result.pendingChoice,
            },
          },
        };
      }

      const { event, daysAdvanced, totalDaysAfter, settlement, rivalMarket } = result;

      return {
        ...state,
        rngSeed: nextSeed,
        studio: applyRivalMarketSettlement(
          applyBoxOfficeSettlement({ ...state.studio, totalDays: totalDaysAfter }, settlement),
          rivalMarket,
        ),
        draft: {
          ...d,
          photography: {
            ...d.photography,
            daysElapsed: d.photography.daysElapsed + daysAdvanced,
            events: event ? [...d.photography.events, event] : d.photography.events,
            runningCost: d.photography.runningCost + dailyBurn * daysAdvanced,
          },
        },
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
      const d = state.draft;
      if (!d?.photography || d.photography.status !== 'awaiting-choice' || !d.photography.pendingChoice || !d.productionChoices) {
        return state;
      }
      const pendingChoice = d.photography.pendingChoice;
      const chosen = pendingChoice.choices.find((c) => c.id === action.choiceId);
      const { result, nextSeed } = withRng(state.rngSeed, (rng) => {
        const event = resolveEventChoice(pendingChoice, action.choiceId, rng);
        const totalDaysAfter = state.studio.totalDays + event.delayDaysDelta;
        const settlement = settleBoxOfficeForAllFilms(state.studio.filmsReleased, totalDaysAfter, rng);
        const rivalMarket = settleRivalMarket({ ...state.studio, totalDays: totalDaysAfter }, rng);
        return { event, totalDaysAfter, settlement, rivalMarket };
      });
      const { event, totalDaysAfter, settlement, rivalMarket } = result;
      const extraDays = event.delayDaysDelta;
      const dailyBurn = computeDailyContingencyBurn(d.productionChoices.contingencyAmount, d.photography.recommendedDays);

      let talent = d.talent;
      if (chosen?.replacementCandidateId && pendingChoice.replacementRole) {
        const candidate = state.studio.talentPool[pendingChoice.replacementRole]?.find((t) => t.id === chosen.replacementCandidateId);
        if (candidate) {
          talent = [...d.talent.filter((t) => t.id !== pendingChoice.involvedTalentId), candidate];
        }
      }

      return {
        ...state,
        rngSeed: nextSeed,
        studio: applyRivalMarketSettlement(
          applyBoxOfficeSettlement({ ...state.studio, totalDays: totalDaysAfter }, settlement),
          rivalMarket,
        ),
        draft: {
          ...d,
          talent,
          photography: {
            ...d.photography,
            status: 'in-progress',
            daysElapsed: d.photography.daysElapsed + extraDays,
            events: [...d.photography.events, event],
            runningCost: d.photography.runningCost + dailyBurn * extraDays,
            pendingChoice: null,
          },
        },
      };
    }

    case 'FINISH_PHOTOGRAPHY': {
      if (!state.draft?.photography || state.draft.photography.status !== 'in-progress') return state;
      return {
        ...state,
        draft: { ...state.draft, photography: { ...state.draft.photography, status: 'finished' } },
      };
    }

    case 'SET_POST_PRODUCTION_CHOICES': {
      if (!state.draft) return state;
      return { ...state, draft: { ...state.draft, postProductionChoices: action.choices } };
    }

    case 'SET_MARKETING_CHOICES': {
      if (!state.draft) return state;
      return { ...state, draft: { ...state.draft, marketingChoices: action.choices } };
    }

    case 'RELEASE_FILM': {
      const d = state.draft;
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
      const photographyEvents = d.photography.events;
      const shootingRatio = d.photography.recommendedDays > 0 ? d.photography.daysElapsed / d.photography.recommendedDays : 1;
      // Marketing's fixed run-up to release (data/schedule.ts) - the one
      // stage duration not applied via GO_TO_STEP, since RELEASE_FILM jumps
      // straight to 'results' rather than going through it.
      const totalDaysAfter = state.studio.totalDays + (STAGE_DURATIONS.marketing ?? 0);

      // Everything happens inside one rng chain: the release-day-knowable
      // results (critic/audience/buzz score, opening weekend, legs - see
      // engine/releaseFilm.ts), then an immediate settlement pass that seeds
      // this film's first box office week (week 1 is always due the moment
      // it releases - see engine/boxOfficeRun.ts:weeksDueByNow) and, while
      // it's at it, catches up any other film still running from before.
      const { result, nextSeed } = withRng(state.rngSeed, (rng) => {
        const { results, legs } = computeReleaseResults(
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
            studioReputation: state.studio.reputation,
          },
          rng,
        );
        const film: Film = {
          id: `film-${state.studio.filmsReleased.length + 1}-${totalDaysAfter}`,
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
            legs,
            retention: computeWeeklyRetention(legs),
            weeks: [],
            cumulativeGross: 0,
            acknowledged: false,
          },
          releasedOnDay: totalDaysAfter,
        };
        const filmsReleased = [...state.studio.filmsReleased, film];
        const settlement = settleBoxOfficeForAllFilms(filmsReleased, totalDaysAfter, rng);
        const rivalMarket = settleRivalMarket({ ...state.studio, totalDays: totalDaysAfter }, rng);
        return { totalCost: results.totalCost, filmId: film.id, settlement, rivalMarket };
      });

      const cashAfterCosts = state.studio.cash - result.totalCost;
      const studioAfter = applyRivalMarketSettlement(
        applyBoxOfficeSettlement({ ...state.studio, cash: cashAfterCosts, totalDays: totalDaysAfter }, result.settlement),
        result.rivalMarket,
      );
      const releasedFilm = studioAfter.filmsReleased.find((f) => f.id === result.filmId)!;

      return {
        ...state,
        rngSeed: nextSeed,
        screen: 'results',
        studio: studioAfter,
        draft: { ...d, results: releasedFilm.results },
      };
    }

    case 'ACKNOWLEDGE_BOX_OFFICE_RESULTS': {
      return {
        ...state,
        studio: {
          ...state.studio,
          filmsReleased: state.studio.filmsReleased.map((f) =>
            f.id === action.filmId ? { ...f, boxOfficeRun: { ...f.boxOfficeRun, acknowledged: true } } : f,
          ),
        },
      };
    }

    case 'RETURN_TO_DASHBOARD':
      return { ...state, screen: 'dashboard', draft: null, viewingRivalStudioName: null };

    case 'RESET_SAVE': {
      // A fresh studio gets a brand new talent pool too - reusing the old
      // one would defeat the point of resetting.
      const { result: studio, nextSeed } = withRng(randomSeed(), (rng) => createInitialStudio(rng, action.startingCash));
      return { studio, screen: 'dashboard', draft: null, rngSeed: nextSeed, viewingRivalStudioName: null };
    }

    // Navigates to a rival's own read-only page (Dashboard's "Rival
    // Studios" list or a Top 10 row's studio name) - identified by name,
    // same as Film.releasedBy, so no id lookup is needed either place it's
    // triggered from. Doesn't touch the calendar; it's just a detour, same
    // as opening the Dashboard's Studio History table.
    case 'VIEW_RIVAL_STUDIO':
      return { ...state, screen: 'rival-studio', viewingRivalStudioName: action.studioName };

    // Dashboard -> the filterable film-history table. Pure detour, same as
    // VIEW_RIVAL_STUDIO - doesn't touch the calendar.
    case 'VIEW_STATS':
      return { ...state, screen: 'stats', viewingRivalStudioName: null };

    default:
      return state;
  }
}
