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

export interface GameState {
  studio: Studio;
  screen: Screen;
  draft: FilmDraft | null;
  rngSeed: number;
}

export const INITIAL_STUDIO: Studio = {
  name: 'Silver Reel Pictures',
  cash: 10_000_000,
  reputation: 20,
  year: 1,
  filmsReleased: [],
};

export function createEmptyDraft(): FilmDraft {
  return {
    title: '',
    genre: null,
    targetAudience: null,
    scriptOptions: [],
    script: null,
    talent: [],
    talentCandidatesByRole: {},
    talentTargetPriceByRole: {},
    productionChoices: null,
    events: [],
    postProductionChoices: null,
    marketingChoices: null,
    results: null,
  };
}

export type GameAction =
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
  | { type: 'REROLL_TALENT_CANDIDATES'; role: TalentRole }
  | { type: 'SET_PRODUCTION_CHOICES'; choices: ProductionChoices }
  | { type: 'BEGIN_FILMING' }
  | { type: 'SET_POST_PRODUCTION_CHOICES'; choices: PostProductionChoices }
  | { type: 'SET_MARKETING_CHOICES'; choices: MarketingChoices }
  | { type: 'RELEASE_FILM' }
  | { type: 'RETURN_TO_DASHBOARD' }
  | { type: 'RENAME_STUDIO'; name: string }
  | { type: 'RESET_SAVE' };

export interface CompletedFilmRecord {
  film: Film;
  cashAfter: number;
  reputationAfter: number;
}
