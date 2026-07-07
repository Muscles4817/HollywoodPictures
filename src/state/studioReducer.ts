import type { Film, Genre, Talent, TalentRole } from '../types';
import { type GameAction, type GameState, createEmptyDraft, INITIAL_STUDIO } from './gameState';
import { createRng, randInt, clamp, type RandomFn } from '../engine/random';
import { generateScriptOptions } from '../engine/scriptGenerator';
import { generateTalentCandidates } from '../engine/talentGenerator';
import { logAmount } from '../engine/interpolate';
import { ALL_TALENT_ROLES, MANDATORY_TALENT_ROLES, ROLE_CAPACITY, ROLE_GENERATION_PROFILES } from '../data/talentGeneration';
import { simulateProduction } from '../engine/production';
import { computeReleaseResults } from '../engine/releaseFilm';
import { applyReputationChange } from '../engine/reputation';

function generateAllTalentCandidates(genre: Genre, rng: RandomFn): Partial<Record<TalentRole, Talent[]>> {
  const result: Partial<Record<TalentRole, Talent[]>> = {};
  for (const role of ALL_TALENT_ROLES) {
    result[role] = generateTalentCandidates(role, genre, rng);
  }
  return result;
}

/** Seeds every role's target price at the midpoint of its own salary range. */
function defaultTalentTargetPrices(): Partial<Record<TalentRole, number>> {
  const result: Partial<Record<TalentRole, number>> = {};
  for (const role of ALL_TALENT_ROLES) {
    result[role] = logAmount(0.5, ROLE_GENERATION_PROFILES[role].salaryRange);
  }
  return result;
}

/** Runs `fn` with a deterministic RNG seeded from state, returning the advanced seed to store back. */
function withRng<T>(seed: number, fn: (rng: RandomFn) => T): { result: T; nextSeed: number } {
  const rng = createRng(seed);
  const result = fn(rng);
  const nextSeed = randInt(rng, 1, 2 ** 31 - 1);
  return { result, nextSeed };
}

// Cash is only ever mutated once, at RELEASE_FILM, computed fresh from the
// complete draft. Every earlier screen just previews a projected spend (see
// state/selectors.ts) - this keeps the reducer free of "did I already charge
// for this?" bookkeeping and makes back-navigation in the wizard perfectly safe.
export function studioReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_NEW_FILM':
      return { ...state, screen: 'develop', draft: createEmptyDraft() };

    case 'GO_TO_STEP':
      return { ...state, screen: action.step };

    case 'RENAME_STUDIO':
      return { ...state, studio: { ...state.studio, name: action.name } };

    case 'SET_TITLE': {
      if (!state.draft) return state;
      return { ...state, draft: { ...state.draft, title: action.title } };
    }

    case 'SET_GENRE': {
      if (!state.draft) return state;
      const { result, nextSeed } = withRng(state.rngSeed, (rng) => ({
        scriptOptions: generateScriptOptions(action.genre, rng),
        talentCandidatesByRole: generateAllTalentCandidates(action.genre, rng),
      }));
      return {
        ...state,
        rngSeed: nextSeed,
        draft: {
          ...state.draft,
          genre: action.genre,
          scriptOptions: result.scriptOptions,
          script: null,
          talentCandidatesByRole: result.talentCandidatesByRole,
          talentTargetPriceByRole: defaultTalentTargetPrices(),
        },
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
      return { ...state, draft: { ...state.draft, script: action.script } };
    }

    case 'SET_TALENT_FOR_ROLE': {
      if (!state.draft) return state;
      const withoutRole = state.draft.talent.filter((t) => t.role !== action.role);
      const nextTalent = action.talent ? [...withoutRole, action.talent] : withoutRole;
      return { ...state, draft: { ...state.draft, talent: nextTalent } };
    }

    // For roles that can hold more than one person (Supporting Actor): add
    // this candidate if there's room, or remove them if already hired.
    // Silently no-ops at capacity rather than erroring - the UI disables
    // unhired candidates once a role is full, so this is a defensive guard.
    case 'TOGGLE_TALENT_FOR_ROLE': {
      if (!state.draft) return state;
      const current = state.draft.talent.filter((t) => t.role === action.role);
      const alreadyHired = current.some((t) => t.id === action.talent.id);

      let nextTalent: Talent[];
      if (alreadyHired) {
        nextTalent = state.draft.talent.filter((t) => t.id !== action.talent.id);
      } else if (current.length < ROLE_CAPACITY[action.role].max) {
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
      const perRole = action.totalBudget / MANDATORY_TALENT_ROLES.length;
      const updated = { ...state.draft.talentTargetPriceByRole };
      for (const role of MANDATORY_TALENT_ROLES) {
        const range = ROLE_GENERATION_PROFILES[role].salaryRange;
        updated[role] = clamp(perRole, range.min, range.max);
      }
      return { ...state, draft: { ...state.draft, talentTargetPriceByRole: updated } };
    }

    case 'REROLL_TALENT_CANDIDATES': {
      if (!state.draft || !state.draft.genre) return state;
      const { result: candidates, nextSeed } = withRng(state.rngSeed, (rng) =>
        generateTalentCandidates(action.role, state.draft!.genre!, rng),
      );
      return {
        ...state,
        rngSeed: nextSeed,
        draft: {
          ...state.draft,
          talentCandidatesByRole: { ...state.draft.talentCandidatesByRole, [action.role]: candidates },
          // A fresh slate invalidates any previous pick for this role.
          talent: state.draft.talent.filter((t) => t.role !== action.role),
        },
      };
    }

    case 'SET_PRODUCTION_CHOICES': {
      if (!state.draft) return state;
      return { ...state, draft: { ...state.draft, productionChoices: action.choices } };
    }

    case 'BEGIN_FILMING': {
      if (!state.draft || !state.draft.script || !state.draft.productionChoices) return state;
      const { result: simResult, nextSeed } = withRng(state.rngSeed, (rng) =>
        simulateProduction(state.draft!.talent, state.draft!.script!, state.draft!.productionChoices!, rng),
      );
      return { ...state, rngSeed: nextSeed, draft: { ...state.draft, events: simResult.events } };
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
      if (!d || !d.genre || !d.targetAudience || !d.script || !d.productionChoices || !d.postProductionChoices || !d.marketingChoices) {
        return state;
      }

      const { result: results, nextSeed } = withRng(state.rngSeed, (rng) =>
        computeReleaseResults(
          {
            genre: d.genre!,
            targetAudience: d.targetAudience!,
            script: d.script!,
            talent: d.talent,
            productionChoices: d.productionChoices!,
            postProductionChoices: d.postProductionChoices!,
            marketingChoices: d.marketingChoices!,
            events: d.events,
            studioReputation: state.studio.reputation,
          },
          rng,
        ),
      );

      // Single point of cash mutation for the whole film: spend everything
      // it cost to make and market it, then collect the box office take.
      const cashAfter = state.studio.cash - results.totalCost + results.totalBoxOffice;
      const nextReputation = applyReputationChange(state.studio.reputation, results.reputationChange);

      const film: Film = {
        id: `film-${state.studio.filmsReleased.length + 1}-${state.studio.year}`,
        title: d.title || 'Untitled Film',
        genre: d.genre,
        targetAudience: d.targetAudience,
        script: d.script,
        talent: d.talent,
        productionChoices: d.productionChoices,
        postProductionChoices: d.postProductionChoices,
        marketingChoices: d.marketingChoices,
        events: d.events,
        results,
        yearReleased: state.studio.year,
      };

      return {
        ...state,
        rngSeed: nextSeed,
        screen: 'results',
        studio: {
          ...state.studio,
          cash: cashAfter,
          reputation: nextReputation,
          year: state.studio.year + 1,
          filmsReleased: [...state.studio.filmsReleased, film],
        },
        draft: { ...d, results },
      };
    }

    case 'RETURN_TO_DASHBOARD':
      return { ...state, screen: 'dashboard', draft: null };

    case 'RESET_SAVE':
      return {
        studio: { ...INITIAL_STUDIO, filmsReleased: [] },
        screen: 'dashboard',
        draft: null,
        rngSeed: Date.now(),
      };

    default:
      return state;
  }
}
