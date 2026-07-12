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
  /** Days elapsed since day 1 - the single source of truth for the in-game calendar (see engine/calendar.ts), world-level rather than studio-scoped since rival studios and the player share it. */
  totalDays: number;
  /** Which rival studio the 'rival-studio' screen is currently showing, if any - identified by name, same as Film.releasedBy (see types/index.ts:Film). */
  viewingRivalStudioName: string | null;
  // Which Studio.productionsInProgress entry the 'production' screen is
  // showing, if it's not the live draft - set by VIEW_PRODUCTION (Dashboard's
  // Shooting card), read by ProductionRun.tsx. null means "show the live
  // draft" (today's only behavior) - the Dashboard invariant that draft is
  // always null while screen === 'dashboard' means this is only ever
  // non-null while draft is null, so viewing a background production can
  // never shadow or get confused with unrelated in-progress work. Reset to
  // null by every other navigation action so it can't outlive the view that
  // set it (see state/studioReducer.ts).
  viewingProductionId: string | null;
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
    filmsReleased: [],
    talentPool: generateTalentPool(rng),
    rivalStudios: generateRivalStudios(rng),
    rivalProductionsInProgress: [],
    rivalFilmsReleased: [],
    productionsInProgress: [],
  };
}

/**
 * Not cryptographically random on purpose - crypto.randomUUID() only works
 * in a secure context (HTTPS or localhost), which threw on every browser
 * opening the game over plain HTTP from another computer on the LAN. This id
 * is pure identity, not a gameplay outcome, so it doesn't need to be
 * replay-deterministic the way rolled events/results do, or genuinely
 * unguessable - Date.now() plus a bit of Math.random() is unique enough.
 */
function generateDraftId(): string {
  return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyDraft(): FilmDraft {
  return {
    id: generateDraftId(),
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
  // productionId omitted means "the live draft" (ProductionRun.tsx viewing
  // it directly, GameState.viewingProductionId null); present means "this
  // entry of Studio.productionsInProgress" (the Inbox, or ProductionRun.tsx
  // viewing a backgrounded shoot via VIEW_PRODUCTION) - see docs/DESIGN.md 5.x.
  | { type: 'RESOLVE_EVENT_CHOICE'; choiceId: string; productionId?: string }
  | { type: 'FINISH_PHOTOGRAPHY'; productionId?: string }
  | { type: 'SET_POST_PRODUCTION_CHOICES'; choices: PostProductionChoices }
  | { type: 'SET_MARKETING_CHOICES'; choices: MarketingChoices }
  | { type: 'RELEASE_FILM' }
  | { type: 'ACKNOWLEDGE_BOX_OFFICE_RESULTS'; filmId: string }
  | { type: 'RETURN_TO_DASHBOARD' }
  | { type: 'RENAME_STUDIO'; name: string }
  | { type: 'RESET_SAVE'; startingCash: number }
  | { type: 'VIEW_RIVAL_STUDIO'; studioName: string }
  // Dashboard's Shooting card -> "view" a specific backgrounded production
  // on the 'production' screen without disturbing the live draft (which is
  // always null at this point - see GameState.viewingProductionId).
  | { type: 'VIEW_PRODUCTION'; productionId: string }
  // Pulls a wrapped background production (Studio.productionsInProgress,
  // photography.status === 'finished') back into the single draft slot so
  // the player can walk it through post-production/marketing/release - see
  // studioReducer.ts. A no-op while `draft` isn't already null, i.e. the
  // player is mid-wizard on something else; the UI shouldn't offer this
  // action in that case (see components/common/Inbox.tsx).
  | { type: 'RESUME_FOR_POST_PRODUCTION'; productionId: string }
  // Dashboard -> the filterable film-history table (components/StatsPage.tsx).
  // No payload, no calendar cost - a pure detour, same as VIEW_RIVAL_STUDIO.
  | { type: 'VIEW_STATS' };

export interface CompletedFilmRecord {
  film: Film;
  cashAfter: number;
  reputationAfter: number;
}
