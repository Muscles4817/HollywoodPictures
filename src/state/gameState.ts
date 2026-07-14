import type {
  Asset,
  Distribution,
  EffectsMethodKey,
  EnvironmentMethodKey,
  FilmDraft,
  MarketingChoices,
  NormalizedScalar,
  Opportunity,
  PostProductionChoices,
  Project,
  RivalStudio,
  Screen,
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
  // Stays pointed at the same id across GREENLIGHT_PROJECT and SCHEDULE_RELEASE
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
  // Development pipeline (docs/DESIGN_REVIEW_development_pipeline.md) -
  // world-level and shared, same reasoning as talentPool: an Opportunity
  // isn't anyone's property yet, so it can't live inside one Studio. Not
  // yet contested by rival studios in this MVP (they keep their existing
  // simplified production-generation path), but shaped this way from the
  // start so unifying them later is additive, not a re-plumb.
  opportunities: Opportunity[];
  /** GameState.totalDays threshold - once reached, the next settlement pass generates a fresh batch of Opportunities (engine/opportunities.ts), the same per-timer pattern RivalStudio.nextSpawnCheckDay already uses. */
  nextOpportunityCheckDay: number;
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
    brand: 20,
    prestige: 20,
    assets: [],
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

/**
 * The one place a FilmDraft is ever created (development-pipeline doc,
 * roadmap Phase 8 in spirit though not numbered as such) - always from an
 * already-owned Asset, never from nothing. Inherits the Asset's script
 * wholesale (never regenerated or re-picked inside the wizard again) and
 * pre-fills title/genre/targetAudience from it exactly the way SELECT_SCRIPT
 * used to pre-fill them from a freshly-picked script, since here that
 * "pick" already happened back at Opportunity acquisition.
 */
export function createDraftFromAsset(asset: Asset, talentTargetPriceByRole: Partial<Record<TalentRole, number>>): FilmDraft {
  return {
    id: generateDraftId(),
    assetId: asset.id,
    title: asset.script.title,
    genre: asset.script.genre,
    targetAudience: asset.script.intendedAudience,
    script: asset.script,
    talent: [],
    talentTargetPriceByRole,
    environmentStrategy: null,
    environmentAmbition: null,
    effectsStrategy: null,
    effectsAmbition: null,
    productionChoices: null,
    greenlitOnDay: null,
    photography: null,
    furthestStepIndexCharged: -1,
    postProductionChoices: null,
    marketingChoices: null,
    results: null,
  };
}

export type GameAction =
  | { type: 'ADVANCE_DAY' }
  // Development pipeline (docs/DESIGN_REVIEW_development_pipeline.md).
  // ACQUIRE_OPPORTUNITY charges the opportunity's acquisitionCost
  // immediately and turns it into a permanently-owned Asset - script cost
  // is never charged again downstream (see engine/releaseFilm.ts). Only
  // works on an uncontested opportunity (no bids yet, see
  // types/index.ts:Opportunity.bids) - a contested one is no longer an
  // instant sale, PLACE_BID is what competes for it instead.
  // CREATE_PROJECT_FROM_ASSET replaces the old START_NEW_FILM - a FilmDraft
  // is only ever created from an already-owned Asset now, never from
  // nothing, and inherits that Asset's script wholesale (no more in-wizard
  // script generation/picking - see gameState.ts:createDraftFromAsset).
  | { type: 'ACQUIRE_OPPORTUNITY'; opportunityId: string }
  // Milestone: Opportunity Market bidding. Places (or raises) the player's
  // own bid on a contested Opportunity - resolved, along with every other
  // rival's own current bid, at the next weekly market tick
  // (engine/opportunities.ts:settleOpportunities). Charges nothing now;
  // cash only actually moves if/when the player's bid turns out to be the
  // winner (state/studioReducer.ts's shared applyOpportunityWin).
  | { type: 'PLACE_BID'; opportunityId: string; amount: number }
  | { type: 'CREATE_PROJECT_FROM_ASSET'; assetId: string }
  // The one explicit "delete this for real" action for a still-owned
  // Asset's Project attempt - the Asset itself is never touched (see
  // engine/project.ts:deriveAssetStatus, which derives "available again"
  // purely from no Project referencing it any more, nothing to reset here).
  // Works whether or not GREENLIGHT_PROJECT has already fired; either way
  // whatever's already been spent is gone, never refunded. RETURN_TO_DASHBOARD
  // is the *other* way to leave a Project screen, and deliberately does the
  // opposite - unfocus only, keep it resumable later.
  | { type: 'ABANDON_PROJECT' }
  | { type: 'GO_TO_STEP'; step: WizardStep }
  | { type: 'SET_TITLE'; title: string }
  | { type: 'SET_TARGET_AUDIENCE'; targetAudience: TargetAudience }
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
  // Replaces the old BEGIN_PHOTOGRAPHY - the explicit business decision the
  // development-pipeline doc is about. Talent selection up to this point is
  // provisional (SET_TALENT_FOR_ROLE has never deducted cash or booked
  // anyone - unchanged); this is the one action that runs a reducer-level
  // affordability check, then commits talent salary, the production
  // budget, and the contingency reserve in one shot (same math
  // BEGIN_PHOTOGRAPHY always used), reserves the cast's bookedUntil for
  // real, stamps FilmDraft.greenlitOnDay, and moves straight to the
  // 'production' screen with photography already under way - see
  // state/studioReducer.ts. Fails safely (returns state unchanged) if the
  // studio can't afford the full commitment right now.
  | { type: 'GREENLIGHT_PROJECT' }
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
  // Roadmap Phase 7.2 - replaces the old always-immediate RELEASE_FILM.
  // `releaseDay` is the player's pick; the reducer clamps it up to at least
  // "today plus the fixed marketing lead time" (same STAGE_DURATIONS.marketing
  // run-up RELEASE_FILM always charged), so picking today is still the exact
  // same-day-release behavior the old action had - the new capability is
  // being able to pick a day further out instead. The focused project
  // transitions to 'scheduled' and, if its own releaseDay is already due by
  // the time that marketing lead time elapses, resolves into 'released'
  // within this same dispatch (see state/studioReducer.ts).
  | { type: 'SCHEDULE_RELEASE'; releaseDay: number }
  | { type: 'ACKNOWLEDGE_BOX_OFFICE_RESULTS'; filmId: string }
  | { type: 'RETURN_TO_DASHBOARD' }
  | { type: 'RENAME_STUDIO'; name: string }
  | { type: 'RESET_SAVE'; startingCash: number }
  | { type: 'VIEW_RIVAL_STUDIO'; studioName: string }
  // Dashboard's Shooting card -> "view" a specific backgrounded production
  // on the 'production' screen without disturbing the focused one (which is
  // always null at this point - see GameState.viewingProductionId).
  | { type: 'VIEW_PRODUCTION'; productionId: string }
  // Makes a backgrounded project the focused one and sends it to wherever
  // it's ready to pick up next - the earliest wizard step (develop) for
  // anything pre-Greenlight, still-in-progress photography ('production'),
  // or post-production/marketing (photography.status === 'finished',
  // same split RESUME_FOR_POST_PRODUCTION used to make) - see
  // studioReducer.ts. Its kind stays 'player-in-progress' throughout;
  // nothing moves between arrays any more, only which id is focused and
  // which screen is showing change. A no-op while something else is already
  // focused, i.e. the player is mid-wizard on something else; the UI
  // shouldn't offer this action in that case (see
  // components/common/Inbox.tsx, components/AssetLibrary.tsx). Also what
  // lets a pre-Greenlight Project be left (RETURN_TO_DASHBOARD) and resumed
  // later (development-pipeline doc acceptance criteria) - resuming always
  // re-enters at 'develop' rather than trying to reconstruct exactly which
  // screen the player was on, since every field already chosen (title,
  // talent, plan) is preserved on the draft regardless of which screen
  // re-shows it first.
  | { type: 'RESUME_PROJECT'; projectId: string }
  // Dashboard -> the filterable film-history table (components/StatsPage.tsx).
  // No payload, no calendar cost - a pure detour, same as VIEW_RIVAL_STUDIO.
  | { type: 'VIEW_STATS' }
  // Dashboard -> the release calendar (roadmap Phase 7.3): every upcoming
  // release, the player's own scheduled projects and every rival's
  // in-progress production, sorted by day. Pure detour, same as VIEW_STATS.
  | { type: 'VIEW_RELEASE_CALENDAR' }
  // Dashboard -> the shared, time-limited Opportunity pool
  // (development-pipeline doc). Pure detour, same as VIEW_STATS.
  | { type: 'VIEW_OPPORTUNITY_MARKET' }
  // Dashboard -> the studio's owned Assets. Pure detour, same as VIEW_STATS.
  | { type: 'VIEW_ASSET_LIBRARY' }
  // Dashboard -> every one of the player's own current projects, one card
  // each, grouped by stage (components/ProjectsPage.tsx). Pure detour, same
  // as VIEW_STATS - doesn't touch the calendar or focusedProjectId.
  | { type: 'VIEW_PROJECTS' };
