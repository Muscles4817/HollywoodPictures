import type { Film, Talent, TalentRole, WizardStep } from '../types';
import { type GameAction, type GameState, createEmptyDraft, createInitialStudio } from './gameState';
import { randomSeed, withRng, clamp } from '../engine/random';
import { generateScriptOptions } from '../engine/scriptGenerator';
import { logAmount } from '../engine/interpolate';
import { ALL_TALENT_ROLES, MANDATORY_TALENT_ROLES, ROLE_GENERATION_PROFILES } from '../data/talentGeneration';
import { effectiveRoleCapacity } from '../engine/castRequirements';
import { computeRecommendedShootDays, computeStaticProductionRisk, rollDayEvent, resolveEventChoice } from '../engine/production';
import { computeDailyContingencyBurn } from '../engine/cost';
import { STAGE_DURATIONS } from '../data/schedule';
import { computeReleaseResults } from '../engine/releaseFilm';
import { applyReputationChange } from '../engine/reputation';

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

// Cash is only ever mutated once, at RELEASE_FILM, computed fresh from the
// complete draft. Every earlier screen just previews a projected spend (see
// state/selectors.ts) - this keeps the reducer free of "did I already charge
// for this?" bookkeeping and makes back-navigation in the wizard perfectly safe.
export function studioReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
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
      return {
        ...state,
        screen: action.step,
        studio: { ...state.studio, totalDays: state.studio.totalDays + stageDuration },
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

    case 'SET_PRODUCTION_CHOICES': {
      if (!state.draft) return state;
      return { ...state, draft: { ...state.draft, productionChoices: action.choices } };
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
      const { result, nextSeed } = withRng(state.rngSeed, (rng) =>
        rollDayEvent(staticRisk, d.photography!.daysElapsed + 1, d.photography!.recommendedDays, d.genre!, usedIds, rng),
      );

      if (result && 'pendingChoice' in result) {
        const dailyBurn = computeDailyContingencyBurn(d.productionChoices.contingencyAmount, d.photography.recommendedDays);
        return {
          ...state,
          rngSeed: nextSeed,
          studio: { ...state.studio, totalDays: state.studio.totalDays + 1 },
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

      const event = result?.event ?? null;
      const daysAdvanced = 1 + (event?.delayDaysDelta ?? 0);
      const dailyBurn = computeDailyContingencyBurn(d.productionChoices.contingencyAmount, d.photography.recommendedDays);

      return {
        ...state,
        rngSeed: nextSeed,
        studio: { ...state.studio, totalDays: state.studio.totalDays + daysAdvanced },
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
    case 'RESOLVE_EVENT_CHOICE': {
      const d = state.draft;
      if (!d?.photography || d.photography.status !== 'awaiting-choice' || !d.photography.pendingChoice || !d.productionChoices) {
        return state;
      }
      const pendingChoice = d.photography.pendingChoice;
      const { result: event, nextSeed } = withRng(state.rngSeed, (rng) =>
        resolveEventChoice(pendingChoice, action.choiceId, rng),
      );
      const extraDays = event.delayDaysDelta;
      const dailyBurn = computeDailyContingencyBurn(d.productionChoices.contingencyAmount, d.photography.recommendedDays);

      return {
        ...state,
        rngSeed: nextSeed,
        studio: { ...state.studio, totalDays: state.studio.totalDays + extraDays },
        draft: {
          ...d,
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

      const { result: results, nextSeed } = withRng(state.rngSeed, (rng) =>
        computeReleaseResults(
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
        ),
      );

      // Single point of cash mutation for the whole film: spend everything
      // it cost to make and market it, then collect the studio's actual cut
      // of the box office - not the flashier totalBoxOffice headline figure,
      // which is what `profit` is computed from too (see boxOffice.ts).
      const cashAfter = state.studio.cash - results.totalCost + results.studioRevenue;
      const nextReputation = applyReputationChange(state.studio.reputation, results.reputationChange);
      // Marketing's fixed run-up to release (data/schedule.ts) - the one
      // stage duration not applied via GO_TO_STEP, since RELEASE_FILM jumps
      // straight to 'results' rather than going through it.
      const totalDaysAfter = state.studio.totalDays + (STAGE_DURATIONS.marketing ?? 0);

      const film: Film = {
        id: `film-${state.studio.filmsReleased.length + 1}-${totalDaysAfter}`,
        title: d.title || 'Untitled Film',
        genre: d.genre,
        targetAudience: d.targetAudience,
        script: d.script,
        talent: d.talent,
        productionChoices: d.productionChoices,
        postProductionChoices: d.postProductionChoices,
        marketingChoices: d.marketingChoices,
        events: photographyEvents,
        results,
        releasedOnDay: totalDaysAfter,
      };

      return {
        ...state,
        rngSeed: nextSeed,
        screen: 'results',
        studio: {
          ...state.studio,
          cash: cashAfter,
          reputation: nextReputation,
          totalDays: totalDaysAfter,
          filmsReleased: [...state.studio.filmsReleased, film],
        },
        draft: { ...d, results },
      };
    }

    case 'RETURN_TO_DASHBOARD':
      return { ...state, screen: 'dashboard', draft: null };

    case 'RESET_SAVE': {
      // A fresh studio gets a brand new talent pool too - reusing the old
      // one would defeat the point of resetting.
      const { result: studio, nextSeed } = withRng(randomSeed(), (rng) => createInitialStudio(rng));
      return { studio, screen: 'dashboard', draft: null, rngSeed: nextSeed };
    }

    default:
      return state;
  }
}
