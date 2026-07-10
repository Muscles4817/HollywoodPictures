import type {
  Film,
  FilmDraft,
  Genre,
  MarketingChoices,
  PostProductionChoices,
  ProductionChoices,
  Screen,
  Script,
  Studio,
  Talent,
  TalentRole,
  TargetAudience,
  WizardStep,
} from '../types';
import { generateTalentPool } from '../engine/talentGenerator';
import type { RandomFn } from '../engine/random';

export interface GameState {
  studio: Studio;
  screen: Screen;
  draft: FilmDraft | null;
  rngSeed: number;
}

/**
 * A brand new studio, including its talent pool - the whole hireable
 * roster, generated once here and never regenerated for the life of this
 * save (see engine/talentGenerator.ts:generateTalentPool). Needs an RNG
 * because of that, unlike a plain constant.
 */
export function createInitialStudio(rng: RandomFn): Studio {
  return {
    name: 'Silver Reel Pictures',
    cash: 10_000_000,
    reputation: 20,
    totalDays: 1,
    filmsReleased: [],
    talentPool: generateTalentPool(rng),
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
  | { type: 'SET_PRODUCTION_CHOICES'; choices: ProductionChoices }
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
  | { type: 'RESET_SAVE' };

export interface CompletedFilmRecord {
  film: Film;
  cashAfter: number;
  reputationAfter: number;
}
