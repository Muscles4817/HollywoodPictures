import type {
  Distribution,
  EffectsMethodKey,
  EnvironmentMethodKey,
  Film,
  FilmDraft,
  Genre,
  MarketingChoices,
  NormalizedScalar,
  PostProductionChoices,
  Screen,
  Script,
  Studio,
  Talent,
  TalentRole,
  TargetAudience,
  WizardStep,
} from '../types';
import { generateTalentPool } from '../engine/talentGenerator';
import { generateRivalStudios } from '../engine/rivalStudios';
import type { RandomFn } from '../engine/random';

export interface GameState {
  studio: Studio;
  screen: Screen;
  draft: FilmDraft | null;
  rngSeed: number;
  /** Which rival studio the 'rival-studio' screen is currently showing, if any - identified by name, same as Film.releasedBy (see types/index.ts:Film). */
  viewingRivalStudioName: string | null;
}

/**
 * A brand new studio, including its talent pool - the whole hireable
 * roster, generated once here and never regenerated for the life of this
 * save (see engine/talentGenerator.ts:generateTalentPool). Needs an RNG
 * because of that, unlike a plain constant.
 */
export function createInitialStudio(rng: RandomFn, startingCash: number): Studio {
  return {
    name: 'Silver Reel Pictures',
    cash: startingCash,
    reputation: 20,
    totalDays: 1,
    filmsReleased: [],
    talentPool: generateTalentPool(rng),
    rivalStudios: generateRivalStudios(rng),
    rivalProductionsInProgress: [],
    rivalFilmsReleased: [],
  };
}

export function createEmptyDraft(): FilmDraft {
  return {
    title: '',
    genre: null,
    targetAudience: null,
    scriptOptions: [],
    script: null,
    talent: [],
    talentTargetPriceByRole: {},
    environmentStrategy: null,
    environmentAmbition: null,
    effectsStrategy: null,
    effectsAmbition: null,
    productionChoices: null,
    photography: null,
    furthestStepIndexCharged: -1,
    postProductionChoices: null,
    marketingChoices: null,
    results: null,
  };
}

export type GameAction =
  | { type: 'ADVANCE_DAY' }
  | { type: 'START_NEW_FILM' }
  | { type: 'GO_TO_STEP'; step: WizardStep }
  | { type: 'SET_TITLE'; title: string }
  | { type: 'SET_GENRE'; genre: Genre }
  | { type: 'SET_TARGET_AUDIENCE'; targetAudience: TargetAudience }
  | { type: 'REROLL_SCRIPTS' }
  | { type: 'SELECT_SCRIPT'; script: Script }
  | { type: 'SET_TALENT_FOR_ROLE'; role: TalentRole; talent: Talent | null }
  | { type: 'TOGGLE_TALENT_FOR_ROLE'; role: TalentRole; talent: Talent }
  | { type: 'SET_TALENT_TARGET_PRICE'; role: TalentRole; price: number }
  | { type: 'SET_TALENT_BUDGET_SPLIT'; totalBudget: number }
  // Replaces the old SET_PRODUCTION_CHOICES - the player now edits Strategy/
  // Ambition values directly (Plan Production, docs/DESIGN.md), and the
  // reducer derives ProductionChoices from them via
  // engine/productionChoicesAdapter.ts rather than the screen setting that
  // legacy shape by hand. contingencyAmount/runtimeIntensity are the two
  // fields nothing in the new model replaced, so they're still passed
  // through as-is.
  | {
      type: 'SET_PRODUCTION_PLAN';
      environmentStrategy: Distribution<EnvironmentMethodKey>;
      environmentAmbition: NormalizedScalar;
      effectsStrategy: Distribution<EffectsMethodKey>;
      effectsAmbition: NormalizedScalar;
      contingencyAmount: number;
      runtimeIntensity: number;
    }
  | { type: 'BEGIN_PHOTOGRAPHY' }
  | { type: 'ADVANCE_SHOOTING_DAY' }
  | { type: 'RESOLVE_EVENT_CHOICE'; choiceId: string }
  | { type: 'FINISH_PHOTOGRAPHY' }
  | { type: 'SET_POST_PRODUCTION_CHOICES'; choices: PostProductionChoices }
  | { type: 'SET_MARKETING_CHOICES'; choices: MarketingChoices }
  | { type: 'RELEASE_FILM' }
  | { type: 'ACKNOWLEDGE_BOX_OFFICE_RESULTS'; filmId: string }
  | { type: 'RETURN_TO_DASHBOARD' }
  | { type: 'RENAME_STUDIO'; name: string }
  | { type: 'RESET_SAVE'; startingCash: number }
  | { type: 'VIEW_RIVAL_STUDIO'; studioName: string }
  // Dashboard -> the filterable film-history table (components/StatsPage.tsx).
  // No payload, no calendar cost - a pure detour, same as VIEW_RIVAL_STUDIO.
  | { type: 'VIEW_STATS' };

export interface CompletedFilmRecord {
  film: Film;
  cashAfter: number;
  reputationAfter: number;
}
