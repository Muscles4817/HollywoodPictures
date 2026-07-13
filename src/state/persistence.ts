import type { GameState } from './gameState';
import { createInitialStudio } from './gameState';
import { generateRivalStudios } from '../engine/rivalStudios';
import { generateTalentPool } from '../engine/talentGenerator';
import { randomSeed, withRng } from '../engine/random';

// Bump this whenever a persisted shape changes incompatibly (e.g. v2 -> v3
// moved the talent roster from a per-film draft to a persistent Studio
// field; v3 -> v4 replaced Talent.genreAffinities with Talent/Script
// toneProfile; v4 -> v5 split Talent into a discriminated union - Director
// keeps toneProfile, Actors got actingStyle instead of skill+toneProfile,
// crew roles lost their unused toneProfile; v5 -> v6 added
// requiredLeads/requiredSupporting/intendedAudience to Script; v6 -> v7
// reworked box office - MarketingChoices.marketingSpend became a continuous
// number instead of a named tier, and FilmResults gained studioRevenue;
// v7 -> v8 renamed ProductionChoices.budgetAmount to contingencyAmount;
// v8 -> v9 replaced Studio.year with Studio.totalDays and Film.yearReleased
// with Film.releasedOnDay, dropped ProductionChoices.shootingIntensity, and
// added FilmDraft.photography (principal photography as a live day-by-day
// process, replacing the old batch-computed draft.events)) so old saves are
// cleanly ignored instead of partially loading with missing/mismatched
// fields.
// v9 -> v10 replaced ProductionEvent.delayRiskDelta (decorative) with a real
// delayDaysDelta, and added PhotographyState.pendingChoice for interactive
// on-set events (docs/DESIGN.md 5.x).
// v10 -> v11 made FilmResults.totalBoxOffice/studioRevenue/profit/outcome/
// reputationChange nullable (unknown until a film's run finishes) and added
// Film.boxOfficeRun - box office as a live weekly process instead of a
// single computed total at release (docs/DESIGN.md 5.19).
// v11 -> v12 added a required `severity` field to ProductionEvent and
// PendingEventChoice (docs/DESIGN.md 5.21).
// v12 -> v13 added AI rival studios - Studio gained required rivalStudios/
// rivalProductionsInProgress/rivalFilmsReleased, Talent gained optional
// bookedUntil, and Film gained optional releasedBy (docs/DESIGN.md 5.24).
// v13 -> v14 added GameState.viewingRivalStudioName (which rival studio the
// new 'rival-studio' screen is showing) and made RESET_SAVE take a
// player-chosen starting cash instead of a hardcoded default.
// v14 -> v15 added required environmentStrategy/environmentAmbition/
// effectsStrategy/effectsAmbition to Script and a required productionStyle
// (environmentStrategy/effectsStrategy) to DirectorTalent - the producer-
// recommendation model foundation (docs/DESIGN.md), not yet consumed by any
// screen.
// v15 -> v16 redesigned Plan Production around that model - FilmDraft
// gained environmentStrategy/environmentAmbition/effectsStrategy/
// effectsAmbition, and SET_PRODUCTION_CHOICES was replaced by
// SET_PRODUCTION_PLAN (docs/DESIGN.md).
// v16 -> v17 added Cinematographer as a new mandatory TalentRole/CrewTalent
// - an existing save's talentPool has no candidates for it, and old Film
// records never cast one (docs/DESIGN.md 5.32).
// v17 -> v18 added Studio.productionsInProgress (the player's own shoots
// running in the background, FilmDraft.id) - background photography
// (docs/DESIGN.md 5.x); old saves have neither field.
// v18 -> v19 replaced the fixed Opening Weekend/Legs box office model with
// the weekly audience simulation (docs/DESIGN.md 5.34, Milestone 5):
// BoxOfficeRun.legs/retention were removed in favor of fixed
// (AudienceSimulationFixedState) and simWeeks (AudienceSimulationWeekState[]);
// ReleaseType dropped 'Streaming' (no honest audience-simulation model for
// it exists yet - docs/DESIGN.md 5.34 Milestone 3). No migration code, same
// as every past shape-break here - an old save's key simply isn't found
// under the new one, so loadState() falls back to a fresh studio.
// v19 -> v20 added availability modeling to the audience simulation
// (docs/DESIGN.md 5.34, Milestone 9): AudienceSimulationFixedState gained
// required initialAvailabilityFraction/availabilityBaseWeeklyDecay/
// criticLedExpansionWeight, and AudienceSimulationWeekState gained a
// required availabilityFraction. A v19 save's Film.boxOfficeRun.fixed/
// simWeeks predate all four fields (undefined, not just a different
// value) - the *first* time settleBoxOfficeForAllFilms advanced such a
// film's week (any GO_TO_STEP/ADVANCE_DAY with a film still running),
// audienceSimulationStep.ts read those as undefined, produced NaN, and
// createAudienceSimulationWeekState's own finite-number validation threw
// - uncaught, with no ErrorBoundary anywhere in the app, which blanked
// the entire page. Bumping the key is the actual fix - an old save
// simply isn't found under the new one, exactly like every past
// shape-break here.
// v20 -> v21 redesigned the screenplay model (docs/DESIGN.md - "screenplay
// redesign"): Script.genreFit and Script.marketability were removed
// entirely (genre fit is now derived from toneProfile-vs-canonical-tone
// distance at score time; marketability was split into several hidden
// derived commercial values - see engine/commercialProfile.ts - rather than
// staying a single stored stat), and Script gained required archetype/
// storyType/setting/scale/characters/productionRequirements fields driving
// archetype-first generation (engine/scriptGenerator.ts). A v20 save's
// embedded Script objects (Film.script, FilmDraft.script/scriptOptions,
// RivalProductionInProgress.script) have neither the new required fields
// nor the shape any current formula expects - no migration code, same as
// every past shape-break here.
// v21 -> v22 (docs/DESIGN.md - "commercial believability calibration",
// Milestone 12): AudienceSimulationWeekState gained a required
// cumulativeCrossoverRealized field, fixing a documented Milestone 10 gap
// where crossover's own weekly headroom had nothing to bound itself
// against except the combined natural+crossover ceiling. A v21 save's
// Film.boxOfficeRun.simWeeks entries predate this field (undefined, not
// just a different value) - the same class of break Milestone 9's v18->v19
// bump fixed the same way, no migration code, an old save simply isn't
// found under the new key.
// v22 -> v23 (architecture roadmap Phase 1.1): Studio.totalDays moved to
// GameState.totalDays - the calendar is world-level (shared by the player
// and every rival studio), not the player's studio's own business. A v22
// save's studio object still carries totalDays nested inside it and has no
// top-level totalDays at all - same class of break as every past shape
// change here, no migration code.
// v23 -> v24 (architecture roadmap Phase 1.2): Studio.rivalStudios/
// rivalProductionsInProgress/rivalFilmsReleased moved to GameState - the
// competitive field is world-level, not the player's own studio's data
// (it was only ever nested there because Studio was the only object that
// existed yet when AI rivals shipped, docs/DESIGN.md 5.24). A v23 save's
// studio object still carries all three nested inside it and has none of
// them at the top level - same class of break as every past shape change
// here, no migration code.
// v24 -> v25 (architecture roadmap Phase 1.3): Studio.talentPool moved to
// GameState.talentPool - the shared hireable roster is world-level (every
// rival studio casts from the same pool, engine/rivalStudios.ts), not the
// player's own studio's data. A v24 save's studio object still carries
// talentPool nested inside it and has none at the top level - same class
// of break as every past shape change here, no migration code.
// v25 -> v26 (architecture roadmap Phase 5): GameState.draft/Studio.filmsReleased/
// Studio.productionsInProgress/GameState.rivalProductionsInProgress/
// GameState.rivalFilmsReleased all collapsed into one flat GameState.projects
// array plus GameState.focusedProjectId (see types/index.ts:Project) - the
// storage-fragmentation fix the whole roadmap was building toward, and it
// also fixes a real id-churn bug along the way: RELEASE_FILM used to hand a
// released Film a freshly-generated id unrelated to the FilmDraft.id it
// carried its whole life up to that point; a project's id is now stable
// from greenlight to release. A v25 save has none of these fields in their
// new shape - no migration code, same as every past shape change here.
// v26 -> v27 (architecture roadmap Phase 7.1/7.2): real release scheduling.
// The old always-immediate RELEASE_FILM action is gone, replaced by
// SCHEDULE_RELEASE - Project gained a fourth 'scheduled' kind (a draft plus
// the releaseDay it's waiting on, see types/index.ts:Project), resolved by
// the new engine/scheduledReleases.ts the same way RivalProductionInProgress.releaseDay
// already resolves through engine/rivalStudios.ts. A v26 save can't contain
// a 'scheduled' project (the kind didn't exist yet), and nothing in this
// version's loadState() needs to handle one anyway - no migration code, same
// as every past shape change here.
// v27 -> v28 (docs/DESIGN_REVIEW_development_pipeline.md): the development
// pipeline - Opportunity -> Asset -> Project. GameState gained required
// opportunities/nextOpportunityCheckDay, Studio gained required assets, and
// FilmDraft replaced its old scriptOptions/START_NEW_FILM-created shape with
// assetId (always set) and greenlitOnDay - a draft is only ever created from
// an already-owned Asset now (CREATE_PROJECT_FROM_ASSET), never from nothing
// (see gameState.ts:createDraftFromAsset). A v27 save has none of these
// fields in their new shape - no migration code, same as every past shape
// change here.
const SAVE_KEY = 'hollywood-pictures-save-v28';

/** Starting cash for a save created with no explicit difficulty choice (first-ever launch). Reset always lets the player pick instead - see Dashboard.tsx:DifficultyPicker. */
const DEFAULT_STARTING_CASH = 10_000_000;

export function loadState(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) throw new Error('no save');
    const parsed = JSON.parse(raw) as GameState;
    if (!parsed.studio) throw new Error('malformed save');
    return parsed;
  } catch {
    // No save (or an incompatible one) - generate a fresh studio, including
    // its talent pool and rival roster, from a genuinely random seed.
    const { result, nextSeed } = withRng(randomSeed(), (rng) => ({
      talentPool: generateTalentPool(rng),
      rivalStudios: generateRivalStudios(rng),
    }));
    return {
      studio: createInitialStudio(DEFAULT_STARTING_CASH),
      screen: 'dashboard',
      projects: [],
      focusedProjectId: null,
      rngSeed: nextSeed,
      totalDays: 1,
      talentPool: result.talentPool,
      rivalStudios: result.rivalStudios,
      opportunities: [],
      nextOpportunityCheckDay: 1,
      viewingRivalStudioName: null,
      viewingProductionId: null,
    };
  }
}

export function saveState(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable (private mode, quota, etc.) - fail silently, game still works in-memory.
  }
}

export function clearSavedState(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
