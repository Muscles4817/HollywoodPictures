import type { GameState } from './gameState';
import { createInitialStudio } from './gameState';
import { generateRivalStudios } from '../engine/rivalStudios';
import { generateProducerPool, generateTalentPool } from '../engine/talentGenerator';
import { randomSeed, withRng } from '../engine/random';
import { firstDayOfYear } from '../engine/calendar';
import { TEST_SCRIPT_ASSETS } from '../data/testScripts';

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
// v28 -> v29 (docs/DESIGN.md - "Brand Recognition and Prestige"): the single
// Studio.reputation stat was replaced by two independent long-term stats,
// Studio.brand and Studio.prestige (engine/reputation.ts), and
// FilmResults.reputationChange was likewise split into brandChange/
// prestigeChange. A v28 save has neither field in their new shape - no
// migration code, same as every past shape change here.
// v29 -> v30 (docs/DESIGN.md - "AI Studios 2.0"): RivalStudio gained
// required cash/brand/prestige/lifetimeRevenue/lifetimeExpenditure -
// rivals now obey the same real financial constraints and carry the same
// Brand/Prestige stats the player's own Studio does, instead of an
// unlimited, untracked production pipeline. A v29 save's rivalStudios
// entries have none of these fields - no migration code, same as every
// past shape change here.
// v30 -> v31 (docs/DESIGN.md - "Opportunity Market: weekly cadence and
// bidding"): Opportunity gained required postedOnDay/bids - the market now
// generates on a fixed weekly beat (was a randomized [8, 16]-day timer) and
// supports bidding, with AI rival studios buying scripts from this same
// pool instead of generating their own. A v30 save's opportunities entries
// have neither field - no migration code, same as every past shape change
// here.
// v31 -> v32 (finished the Lead Actor/Supporting Actor -> unified Actor
// refactor): Film.talent and FilmDraft.talent moved from Talent[] to
// TalentAssignment[] - the per-film Lead/Supporting slot is now carried
// explicitly on the cast list itself (RivalProductionInProgress.talent
// already worked this way) instead of being inferred from a Talent.role
// that can no longer express it (every Actor is now just 'Actor'; Lead vs
// Supporting only exists as a ProductionRole assignment). GameState.talentPool
// and FilmDraft.talentTargetPriceByRole's key types changed to match
// (TalentProfession and ProductionRole respectively, no longer the same
// key set). A v31 save's talent/talentPool/talentTargetPriceByRole entries
// are all the old shape - no migration code, same as every past shape
// change here.
// v32 -> v33 (PRODUCER_WORKSPACE_DESIGN.md, Phase 1): replaced the linear
// pre-greenlight wizard (Develop -> Hire Talent -> Plan Production ->
// Greenlight) with a freely-navigable Producer Workspace. WizardStep
// dropped 'develop'/'talent'/'production-planning'/'greenlight' (only
// post-greenlight steps remain); Screen gained 'workspace'; GameState
// gained a required projectWorkspaceSection. Pre-production's fixed
// per-stage calendar cost (data/schedule.ts:STAGE_DURATIONS) was replaced
// by a single lump sum charged at Greenlight (engine/production.ts:
// computeRecommendedPreProductionDays). A v32 save's `screen` can be one of
// the four retired WizardStep values and has no projectWorkspaceSection at
// all - no migration code, same as every past shape change here.
// v33 -> v34 (PERSON_MODEL_REDESIGN.md): the single-role Talent union
// (DirectorTalent/ActorTalent/CrewTalent) was replaced by Person - shared
// identity/personality/reputation plus one or more role-specific careers
// (Person.careers.director/actor/writer/...). TalentAssignment.talent
// (a Talent) became TalentAssignment.person (a Person); GameState.talentPool
// and every HANDCRAFTED_* roster are now Person[]. bookedUntil was replaced
// by PersonAvailability.commitments (a list of {projectId, role, startDay,
// endDay} spans, supporting more than one simultaneous commitment once a
// person can hold more than one career). A v33 save's talent/talentPool
// entries are all the old flat Talent shape - no migration code, same as
// every past shape change here.
// v34 -> v35 (docs/CHARACTER_AND_SETTING_FOUNDATIONS.md): Script.setting (a
// 5-value Setting) was replaced by Script.primarySetting (a 20-value
// SettingArchetype), and Script gained a required cast: ScriptCharacter[] -
// every screenplay now carries its own concrete Lead/Supporting/Minor
// characters and a specific production-pressure-bearing setting, both
// generated alongside it rather than left implicit. A v34 save's scripts
// (on every Asset, FilmDraft, Film, and RivalProductionInProgress) have the
// old `setting` field and no `cast` at all - no migration code, same as
// every past shape change here.
// v35 -> v36 (docs/DESIGN_REVIEW_casting_redesign.md, Phase B): FilmDraft
// gained a required castingCalls: CastingCall[] - Open Casting calls for a
// script's Lead/Supporting characters now live on the draft itself, ticking
// weekly (engine/castingCalls.ts). A v35 save's FilmDraft entries have no
// `castingCalls` at all - no migration code, same as every past shape
// change here.
// v36 -> v37 (docs/DESIGN_REVIEW_casting_redesign.md, Phase C): CastingCall
// gained a required rejectionCount: number - Direct Approach and Open
// Casting "Cast" attempts can now actually be turned down
// (engine/castingAppeal.ts:resolveOfferResponse), and this is what the
// no-softlock widening formula reads. A v36 save's castingCalls entries
// have no `rejectionCount` at all - no migration code, same as every past
// shape change here.
// v37 -> v38 (docs/DESIGN_REVIEW_casting_redesign.md, Phase D): CastingCall
// lost its old `channel` field (each call could only ever be one channel) -
// it moved onto CastingApplicant instead, since a single call can now host
// both Open Casting and InterestedTalent arrivals at once
// (engine/castingCalls.ts:tickCastingCalls). Person also gained an optional
// `careers.castingDirector` (the new Casting Director role). A v37 save's
// CastingCall entries still carry the old top-level `channel` and their
// applicants have none - no migration code, same as every past shape
// change here.
// v38 -> v39 (docs/DESIGN_REVIEW_post_production_redesign.md, Phase A):
// FilmDraft gained a required postProductionEstimatedCompletionDay:
// GameDay | null, computed once at FINISH_PHOTOGRAPHY
// (engine/production.ts:computeRecommendedPostProductionDays). A v38 save's
// FilmDraft entries have no such field at all - no migration code, same as
// every past shape change here.
// v39 -> v40 (docs/DESIGN_REVIEW_post_production_redesign.md, Phase B):
// FilmDraft's postProductionEstimatedCompletionDay was renamed to
// postProductionScreeningReadyDay (see that field's own doc comment,
// types/index.ts, for why), and FilmDraft gained two required new fields -
// testScreeningPendingChoice: PendingEventChoice | null and
// testScreeningResolved: boolean - for the new test-screening pending
// decision (engine/testScreening.ts). PostProductionChoices also lost its
// old testScreeningResponse field, retired in favor of the new decision. A
// v39 save's FilmDraft entries have the old field name and neither new
// field, and postProductionChoices (if already set) still carries the old
// testScreeningResponse key - no migration code, same as every past shape
// change here.
// v40 -> v41 (docs/DESIGN_REVIEW_post_production_redesign.md, Phase B
// architecture cleanup): postProductionScreeningReadyDay is now a fixed
// historical milestone, never advanced after being set - FilmDraft/Film
// both gained postProductionFinalReadyDay: GameDay | null (FilmDraft only)
// and postProductionEvents: ProductionEvent[] (both), the resolved
// test-screening outcome's new, honest home (previously smuggled into
// photography.events with a zeroed costDelta). A v40 save's FilmDraft/Film
// entries have none of these fields, and any resolved screening's
// event is still sitting inside photography.events/events with its real
// quality/buzz but a lying costDelta: 0 - no migration code, same as every
// past shape change here.
// v41 -> v42 (docs/DESIGN_REVIEW_casting_slot_binding.md): TalentAssignment
// gained an optional characterId (ScriptCharacter.id) binding each actor to
// the specific Character they play, instead of inferring it from array
// position. A v41 save's assignments have no characterId; readers fall back to
// the positional mapping for those, so an un-bumped save would technically
// still work - the bump is the honest signal that the stored shape changed,
// same convention as every entry above. No migration code.
// v42 -> v43 (docs/DESIGN_REVIEW_post_production_redesign.md, Phase C -
// iterative test screenings): FilmDraft gained postProductionEditingUntilDay:
// GameDay | null (the day an in-progress recut finishes and the next screening
// surfaces), and testScreeningResolved/postProductionEvents changed meaning -
// a film can now go through several editing rounds (postProductionEvents holds
// one entry per round instead of at most one), and testScreeningResolved now
// means "a final cut is locked" rather than "the one screening was answered." A
// v42 save's FilmDraft entries have no postProductionEditingUntilDay field - no
// migration code, same as every past shape change here.
// v43 -> v44 (docs/DESIGN_REVIEW_casting_redesign.md): CastingCall gained a
// required dismissedApplicantIds: string[] - the person ids the player has
// dismissed from an Open Casting list, kept out of future weekly batches
// (engine/castingCalls.ts). A v43 save's casting calls have no such field - no
// migration code, same as every past shape change here.
// v44 -> v45 (first IP-layer milestone): Studio gained a required
// intellectualProperties: IntellectualProperty[] - the persistent IP the
// player has promoted released Films into (empty until they do). A v44 save's
// studio has no such field - no migration code, same as every past shape
// change here.
// v45 -> v46 (IP viability milestone): IpCharacter split its evolving standing
// (recognition/popularity) out of its immutable creative identity into a nested
// `standing`, and IntellectualProperty gained recognition/prestige inherited
// from the source Film's results at promotion. A v45 save's IPs (if any) lack
// all three - no migration code, same as every past shape change here.
// v46 -> v47 (screenplay/development foundation): the Asset↔Script boundary was
// formalised and Asset gained three optional development seams - writerIds,
// revisions (prior head Script snapshots) and developmentHistory (an append-only
// DevelopmentEvent[], now populated with an 'acquired' event at every
// Asset's birth). Separately, generated Script ids (and their cast character
// ids) moved off reload-resettable module counters onto save-stable ids
// (engine/scriptGenerator.ts:newScriptId), so a long-lived save can no longer
// mint a fresh script id that collides with a stored one. The Asset fields are
// additive/optional (an un-bumped v46 save would technically still load), but
// the id-scheme change plus the honest "the stored shape changed" convention
// warrant the bump - a v46 save's Assets simply lack the new fields and its
// generated scripts use the old id format; no migration code, same as every
// past shape change here.
// v47 -> v48 (Phase 2: writers become authors): the Writer career gained a
// bespoke creative profile - WriterCareer extends CrewCareer<'Writer'> with
// required craft/toneProfile/genreAffinity/commercialLean/consistency
// (engine/talentGenerator.ts populates them; the 10 handcrafted writers are
// hand-authored). Opportunity gained an optional writerIds, carried to
// Asset.writerIds at acquisition, and a fresh opportunity's screenplay is now
// shaped by a source-appropriate author (engine/writers.ts + scriptGenerator's
// optional author bias). A v47 save's writer careers lack the creative fields
// and its opportunities have no author - no migration code, same as every past
// shape change here.
// v48 -> v49 (Phase 3: Development Department MVP): Asset gained an optional
// pendingRewrite (a freelance Rewrite/Polish pass in flight - writerId, kind,
// startedOnDay, readyOnDay, the rolled craftChanges, and the fee), and a new
// REWRITE_ASSET action. A v48 save's Assets simply have no pass in flight - the
// field is absent and read defensively - so this is additive; the bump is the
// honest "the stored shape changed" signal, same convention as every entry
// above. No migration code.
// v49 -> v50 (Phase 4: original screenplay commissions): Studio gained an
// optional pendingCommissions (a PendingCommission[] of screenplays a specific
// writer is writing but hasn't delivered - id/writerId/writerName/genre/
// startedOnDay/readyOnDay/the generated script/fee), a new COMMISSION_SCREENPLAY
// action, and a 'commissioned' DevelopmentEventKind. A v49 save's studio has no
// commissions in flight - the field is absent and read defensively as [] - so
// this is additive; the bump is the honest "the stored shape changed" signal.
// No migration code.
// Pre-launch: save compatibility is out of scope (see CLAUDE.md). Bump the key
// as the honest "stored shape changed" signal; no migration code.
// v50 -> v51 (Recent budget activity): Studio gained an optional cashLedger
//   (engine/cashLedger.ts), shown on the Dashboard cash tile.
// v51 -> v52 (Production Execution, docs/DESIGN_REVIEW_production_execution.md):
//   ProductionEvent gained impact + escalates (typed consequences + failure
//   chains) and FilmResults gained productionExecution (stars + causal summary
//   + mitigation + numeric modifiers).
const SAVE_KEY = 'hollywood-pictures-save-v54';

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
      producerPool: generateProducerPool(rng),
    }));
    return {
      studio: { ...createInitialStudio(DEFAULT_STARTING_CASH), assets: TEST_SCRIPT_ASSETS },
      screen: 'dashboard',
      projects: [],
      focusedProjectId: null,
      projectWorkspaceSection: 'overview',
      rngSeed: nextSeed,
      totalDays: 1,
      talentPool: result.talentPool,
      rivalStudios: result.rivalStudios,
      producerPool: result.producerPool,
      opportunities: [],
      nextOpportunityCheckDay: 1,
      awards: { history: [], season: null, nextSeasonDay: firstDayOfYear(2) },
      bidNotifications: [],
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
