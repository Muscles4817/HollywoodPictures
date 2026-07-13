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
  Project,
  RivalStudio,
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
  // Architecture roadmap Phase 5: the single, flat, world-level store for
  // every film across its whole life - the player's live draft, every
  // backgrounded shoot, every rival production, and every release, player's
  // or a rival's. See types/index.ts:Project for why this replaced the old
  // draft/Studio.productionsInProgress/Studio.filmsReleased/
  // rivalProductionsInProgress/rivalFilmsReleased five-way split.
  projects: Project[];
  // Which entry of `projects` the live wizard/ProductionRun screen is
  // currently driving, if any - replaces the old `draft !== null` check.
  // Stays pointed at the same id across BEGIN_PHOTOGRAPHY and RELEASE_FILM
  // (a project's id is stable for its whole life - see engine/project.ts),
  // so a released film reached via this screen is still "focused" on the
  // results screen without needing a second, separate representation of it.
  // null means nothing is currently focused (Dashboard, a detour screen).
  focusedProjectId: string | null;
  rngSeed: number;
  /** Days elapsed since day 1 - the single source of truth for the in-game calendar (see engine/calendar.ts), world-level rather than studio-scoped since rival studios and the player share it. */
  totalDays: number;
  /** A small persistent roster of AI competitors, generated once at game start - world-level rather than nested inside the player's own Studio, since it's not the player's data (see docs/DESIGN.md 5.24). */
  rivalStudios: RivalStudio[];
  /** The whole hireable roster, generated once at game start - world-level (shared by the player and every rival's own casting, see engine/rivalStudios.ts) rather than nested inside the player's own Studio. */
  talentPool: Record<TalentRole, Talent[]>;
  /** Which rival studio the 'rival-studio' screen is currently showing, if any - identified by name, same as Film.releasedBy (see types/index.ts:Film). */
  viewingRivalStudioName: string | null;
  // Which `projects` entry the 'production' screen is showing, if it's not
  // the focused one - set by VIEW_PRODUCTION (Dashboard's Shooting card),
  // read by ProductionRun.tsx. null means "show the focused project" (today's
  // only behavior) - reachable only from the Dashboard, where focusedProjectId
  // is always already null, so viewing a background production can never
  // shadow or get confused with unrelated in-progress work. Reset to null by
  // every other navigation action so it can't outlive the view that set it
  // (see state/studioReducer.ts).
  viewingProductionId: string | null;
}

/**
 * A brand new studio - no randomness needed for its own fields (the talent
 * pool is generated alongside this, via engine/talentGenerator.ts's
 * generateTalentPool, but lives on GameState, not here - it's world-level,
 * shared by the player and every rival's own casting, not this one studio's
 * business).
 */
export function createInitialStudio(startingCash: number): Studio {
  return {
    name: 'Silver Reel Pictures',
    cash: startingCash,
    reputation: 20,
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
  // Every project - focused or backgrounded - now lives in the same
  // GameState.projects array (roadmap Phase 5), so there's no more implicit
  // "no id means the live draft" case - the dispatcher always names which
  // one (ProductionRun.tsx passes viewingProductionId ?? focusedProjectId;
  // the Inbox passes the backgrounded production's own id).
  | { type: 'RESOLVE_EVENT_CHOICE'; choiceId: string; productionId: string }
  | { type: 'FINISH_PHOTOGRAPHY'; productionId: string }
  | { type: 'SET_POST_PRODUCTION_CHOICES'; choices: PostProductionChoices }
  | { type: 'SET_MARKETING_CHOICES'; choices: MarketingChoices }
  | { type: 'RELEASE_FILM' }
  | { type: 'ACKNOWLEDGE_BOX_OFFICE_RESULTS'; filmId: string }
  | { type: 'RETURN_TO_DASHBOARD' }
  | { type: 'RENAME_STUDIO'; name: string }
  | { type: 'RESET_SAVE'; startingCash: number }
  | { type: 'VIEW_RIVAL_STUDIO'; studioName: string }
  // Dashboard's Shooting card -> "view" a specific backgrounded production
  // on the 'production' screen without disturbing the focused one (which is
  // always null at this point - see GameState.viewingProductionId).
  | { type: 'VIEW_PRODUCTION'; productionId: string }
  // Makes a wrapped background production (photography.status === 'finished')
  // the focused project so the player can walk it through post-production/
  // marketing/release - see studioReducer.ts. Its kind stays
  // 'player-in-progress' throughout; nothing moves between arrays any more,
  // only which id is focused changes. A no-op while something else is
  // already focused, i.e. the player is mid-wizard on something else; the UI
  // shouldn't offer this action in that case (see components/common/Inbox.tsx).
  | { type: 'RESUME_FOR_POST_PRODUCTION'; productionId: string }
  // Dashboard -> the filterable film-history table (components/StatsPage.tsx).
  // No payload, no calendar cost - a pure detour, same as VIEW_RIVAL_STUDIO.
  | { type: 'VIEW_STATS' };

export interface CompletedFilmRecord {
  film: Film;
  cashAfter: number;
  reputationAfter: number;
}
