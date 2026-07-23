import type {
  Asset,
  AwardsState,
  BidNotification,
  Distribution,
  EffectsMethodKey,
  EnvironmentMethodKey,
  FilmDraft,
  MarketingChoices,
  NormalizedScalar,
  Opportunity,
  PostProductionChoices,
  Person,
  Project,
  ProjectWorkspaceSection,
  RivalStudio,
  Screen,
  Studio,
  TalentProfession,
  ProductionRole,
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
  // Which Producer Workspace tab is showing while `screen` is 'workspace'
  // (PRODUCER_WORKSPACE_DESIGN.md) - non-nullable, defaults to 'overview'.
  // Set only by OPEN_PROJECT_WORKSPACE_SECTION, which - unlike GO_TO_STEP -
  // charges no calendar time, making navigation between sections genuinely
  // free. Meaningless while `screen` isn't 'workspace', same as
  // viewingRivalStudioName/viewingProductionId below are meaningless outside
  // their own screens - just stale rather than actively read.
  projectWorkspaceSection: ProjectWorkspaceSection;
  rngSeed: number;
  /** Days elapsed since day 1 - the single source of truth for the in-game calendar (see engine/calendar.ts), world-level rather than studio-scoped since rival studios and the player share it. */
  totalDays: number;
  /** A small persistent roster of AI competitors, generated once at game start - world-level rather than nested inside the player's own Studio, since it's not the player's data (see docs/DESIGN.md 5.24). */
  rivalStudios: RivalStudio[];
  /** The whole hireable roster, generated once at game start - world-level (shared by the player and every rival's own casting, see engine/rivalStudios.ts) rather than nested inside the player's own Studio. */
  talentPool: Record<TalentProfession, Person[]>;
  /**
   * The hireable Producer roster (docs/DESIGN_REVIEW_production_office.md) -
   * kept separate from `talentPool` (which is profession-keyed and feeds
   * casting) so producers can never leak into the Hire Talent wizard.
   * Optional/absent on saves predating the Production Office; read as `[]`
   * (there is no migration pass - see state/persistence.ts).
   */
  producerPool?: Person[];
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
  /**
   * Awards Season (docs/DESIGN_REVIEW_awards_season.md) - resolved history, the
   * open season (campaign phase), and when the next opens. Optional/absent on
   * saves predating awards; read defensively via awardsStateOrDefault (there is
   * no migration pass - see state/persistence.ts).
   */
  awards?: AwardsState;
  /**
   * Persistent "inbox emails" about the player's own Opportunity-Market
   * bidding (engine/bidNotifications.ts) - won/lost/outbid events, recorded
   * as they happen since a resolved bid leaves the pool and can't be
   * recomputed. Optional/absent on saves predating the feature; read as `[]`
   * (there is no migration pass - see state/persistence.ts).
   */
  bidNotifications?: BidNotification[];
}

/**
 * A brand new studio - no randomness needed for its own fields (the talent
 * pool is generated alongside this, via engine/talentGenerator.ts's
 * generateTalentPool, but lives on GameState, not here - it's world-level,
 * shared by the player and every rival's own casting, not this one studio's
 * business).
 */
export function createInitialStudio(startingCash: number, brand = 20, prestige = 20): Studio {
  return {
    name: 'Silver Reel Pictures',
    cash: startingCash,
    brand,
    prestige,
    assets: [],
    intellectualProperties: [], // never populated automatically - the player promotes a Film into IP on demand
    productionOffice: null, // locked until the unlock milestone (docs/DESIGN_REVIEW_production_office.md)
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
export function createDraftFromAsset(asset: Asset, talentTargetPriceByRole: Partial<Record<ProductionRole, number>>): FilmDraft {
  return {
    id: generateDraftId(),
    assetId: asset.id,
    title: asset.script.title,
    genre: asset.script.genre,
    targetAudience: asset.script.intendedAudience,
    script: asset.script,
    talent: [],
    attachedProducerIds: [],
    talentTargetPriceByRole,
    castingCalls: [],
    environmentStrategy: null,
    environmentAmbition: null,
    effectsStrategy: null,
    effectsAmbition: null,
    productionChoices: null,
    greenlitOnDay: null,
    photography: null,
    furthestStepIndexCharged: -1,
    postProductionScreeningReadyDay: null,
    postProductionFinalReadyDay: null,
    postProductionEditingUntilDay: null,
    testScreeningPendingChoice: null,
    testScreeningResolved: false,
    postProductionEvents: [],
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
  // Development Department MVP (docs/DESIGN_REVIEW_writer_authors.md, Phase 3):
  // commission a freelance writer to Rewrite or Polish an owned Asset's
  // screenplay. Charges the fee immediately (studio-level, like HIRE_PRODUCER),
  // books the writer busy, rolls the craft outcome once, and stores it on
  // Asset.pendingRewrite to land on a future day (engine/rewrite.ts). A no-op
  // if the asset is missing/in-development/already being rewritten, the writer
  // is unknown or unavailable, or the studio can't afford the fee.
  | { type: 'REWRITE_ASSET'; assetId: string; kind: 'rewrite' | 'polish'; writerId: string }
  // Production Office & Producers (docs/DESIGN_REVIEW_production_office.md).
  // UNLOCK is milestone-gated (films shipped OR Brand), not bought - no-op
  // until the milestone is met. UPGRADE/HIRE deduct cash immediately at the
  // studio level (the same immediate path ACQUIRE_OPPORTUNITY uses), gated on
  // affordability. ATTACH/DETACH only mutate the focused draft's
  // attachedProducerIds - no cash moves until RELEASE_FILM, like every other
  // production cost. All six fail safely (no-op) when their preconditions
  // aren't met. Invariant: a draft's attached producers are always a subset
  // of the bench (ATTACH requires bench membership; FIRE detaches).
  // Awards Season (docs/DESIGN_REVIEW_awards_season.md) - set (replace) the
  // campaign budget for one of the player's eligible films during an open
  // season. Delta cash moves immediately (refunds on a decrease); a no-op if
  // no season is open, the film isn't the player's, isn't eligible, or the
  // increase is unaffordable.
  | { type: 'SET_AWARDS_CAMPAIGN'; filmId: string; amount: number }
  | { type: 'UNLOCK_PRODUCTION_OFFICE' }
  | { type: 'UPGRADE_PRODUCTION_OFFICE' }
  | { type: 'UPGRADE_MARKET_RESEARCH' }
  | { type: 'UNLOCK_DISTRIBUTION_ARM' }
  | { type: 'UPGRADE_DISTRIBUTION_ARM' }
  | { type: 'UPGRADE_INTERNATIONAL_DISTRIBUTION' }
  | { type: 'HIRE_PRODUCER'; producerId: string }
  | { type: 'FIRE_PRODUCER'; producerId: string }
  | { type: 'ATTACH_PRODUCER'; producerId: string }
  | { type: 'DETACH_PRODUCER'; producerId: string }
  // Producer Workspace free navigation (PRODUCER_WORKSPACE_DESIGN.md) - the
  // only way GameState.projectWorkspaceSection changes. Unlike GO_TO_STEP,
  // charges no calendar time and never touches STAGE_DURATIONS: moving
  // between Overview/Cast & Crew/Production/Finance is meant to cost
  // nothing, since none of them commit anything on their own. A no-op if
  // nothing's focused or the focused project is past Greenlight (already
  // has `photography`) - see state/studioReducer.ts.
  | { type: 'OPEN_PROJECT_WORKSPACE_SECTION'; section: ProjectWorkspaceSection }
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
  | { type: 'SET_TALENT_FOR_ROLE'; role: ProductionRole; person: Person | null }
  | { type: 'TOGGLE_TALENT_FOR_ROLE'; role: ProductionRole; person: Person; characterId?: string }
  | { type: 'SET_TALENT_TARGET_PRICE'; role: ProductionRole; price: number }
  | { type: 'SET_TALENT_BUDGET_SPLIT'; totalBudget: number }
  // Casting Redesign, Phase B (docs/DESIGN_REVIEW_casting_redesign.md
  // section 1) - opens a new Open Casting call for one Lead/Supporting
  // Character. No-ops if one's already open for this character (see the
  // reducer case) - there's only ever at most one call per character.
  | { type: 'OPEN_CASTING_CALL'; characterId: string; role: 'Lead Actor' | 'Supporting Actor' }
  // Casting Redesign, Phase C (docs/DESIGN_REVIEW_casting_redesign.md
  // section 5/9) - an offer (Direct Approach or an Open Casting "Cast"
  // click) that engine/castingAppeal.ts:resolveOfferResponse already
  // determined was rejected, client-side, before this ever dispatches.
  // Bumps this Character's own rejectionCount for the no-softlock
  // widening formula - opens a call first if Direct Approach reached this
  // Character before Open Casting ever did.
  | { type: 'RECORD_CASTING_REJECTION'; characterId: string; role: 'Lead Actor' | 'Supporting Actor' }
  // Casting Redesign (docs/DESIGN_REVIEW_casting_redesign.md) - the player
  // dismisses one Open Casting applicant they're not interested in: removes
  // them from this Character's applicant list and keeps them out of future
  // weekly batches (CastingCall.dismissedApplicantIds). Pure housekeeping to
  // keep the list uncluttered - not a rejection (rejectionCount is untouched),
  // and Direct Approach can still target them deliberately.
  | { type: 'DISMISS_CASTING_APPLICANT'; characterId: string; personId: string }
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
  // Post-Production Redesign, Phase B (docs/DESIGN_REVIEW_post_production_redesign.md
  // section 2) - resolves FilmDraft.testScreeningPendingChoice, same
  // "productionId names whichever draft this is about" shape RESOLVE_EVENT_CHOICE
  // uses above, since a screening can just as easily be resolved from the
  // Inbox for a backgrounded production as from the focused Post-Production
  // screen. Deliberately its own action rather than broadening
  // RESOLVE_EVENT_CHOICE - that one stays hard-scoped to `photography`
  // in-progress/awaiting-choice semantics; this fires *after* photography is
  // already 'finished' and never reopens it.
  | { type: 'RESOLVE_TEST_SCREENING_CHOICE'; choiceId: string; productionId: string }
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
  | { type: 'RESET_SAVE'; startingCash: number; brand?: number; prestige?: number }
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
  // Marks every bid notification (GameState.bidNotifications) read - dispatched
  // when the player opens the Inbox (engine/bidNotifications.ts). Clears the
  // header badge's bid contribution and the real-time clock's resume-guard.
  | { type: 'MARK_BID_NOTIFICATIONS_READ' }
  // Dashboard -> the studio's owned Assets. Pure detour, same as VIEW_STATS.
  | { type: 'VIEW_ASSET_LIBRARY' }
  // Dashboard -> every one of the player's own current projects, one card
  // each, grouped by stage (components/ProjectsPage.tsx). Pure detour, same
  // as VIEW_STATS - doesn't touch the calendar or focusedProjectId.
  | { type: 'VIEW_PROJECTS' }
  // Dashboard -> the Academy Awards screen (campaign + history). Pure detour, same as VIEW_STATS.
  | { type: 'VIEW_AWARDS' }
  // Dashboard -> the searchable talent database (all actors + their stats). Pure detour, same as VIEW_STATS.
  | { type: 'VIEW_TALENT_DATABASE' }
  // Dashboard -> the studio's owned Intellectual Property library. Pure detour, same as VIEW_STATS.
  | { type: 'VIEW_IP_LIBRARY' }
  // First IP-layer milestone - promote one of the player's own released Films
  // into a persistent IntellectualProperty on demand, lifting the chosen
  // Characters (by their script-local ids) and the Film's Setting into
  // persistent components. Never happens automatically; guarded against rival
  // films, unknown ids, and re-promoting a Film that's already an IP source.
  | { type: 'PROMOTE_FILM_TO_IP'; filmId: string; characterIds: string[]; name: string }
  // Driven by the browser's own Back/Forward buttons (App.tsx), never
  // dispatched directly by the UI - restores an exact prior screen/focus/
  // detour snapshot rather than deriving it from the current one, since
  // Back/Forward can jump more than one step in either direction. See
  // studioReducer.ts's own case for why this is the one navigation action
  // that has to tolerate a stale project/rival reference.
  | {
      type: 'RESTORE_NAVIGATION';
      screen: Screen;
      focusedProjectId: string | null;
      projectWorkspaceSection: ProjectWorkspaceSection;
      viewingRivalStudioName: string | null;
      viewingProductionId: string | null;
    };
