// Core domain types for the studio management game.
// Kept in one file for MVP; split by domain (film.ts, talent.ts, ...) if it grows.

// The only cross-file import in this file - safe in this one direction only.
// engine/audienceSimulation.ts is deliberately isolated (docs/DESIGN.md 5.34):
// it imports nothing from here or anywhere else in the live game, so this
// file depending on its two domain types (BoxOfficeRun below) can never
// become circular.
import type { AudienceSimulationFixedState, AudienceSimulationWeekState } from '../engine/audienceSimulation';

export type Genre =
  | 'Action'
  | 'Comedy'
  | 'Drama'
  | 'Horror'
  | 'Romance'
  | 'Sci-Fi'
  | 'Fantasy'
  | 'Thriller';

export type TargetAudience =
  | 'Mass Market'
  | 'Critics'
  | 'Teens'
  | 'Families'
  | 'Adults'
  | 'Niche';

export type TalentProfession =
  | 'Director'
  | 'Actor'
  | 'Writer'
  | 'Cinematographer'
  | 'Composer'
  | 'Editor'
  | 'VFX Supervisor';

export type ProductionRole =
  | 'Director'
  | 'Lead Actor'
  | 'Supporting Actor'
  | 'Writer'
  | 'Cinematographer'
  | 'Composer'
  | 'Editor'
  | 'VFX Supervisor';

// The emotional/tonal axes every script and every Director are scored on -
// a compatibility question instead of a flat per-genre lookup (see
// engine/compatibility.ts). Only Director shares this space directly with
// Script; Actors have their own vocabulary (see ActingStyle below) that
// gets translated into tone-space rather than natively living in it.
export type Tone = 'action' | 'comedy' | 'romance' | 'suspense' | 'drama' | 'spectacle';
export type ToneProfile = Record<Tone, number>; // 1-100 per tone

// An actor's own performance vocabulary - deliberately not the same shape
// as ToneProfile. Physical Performance and Comedy are clean specialists;
// Character Transformation and Emotional Performance both lean into the
// "serious" cluster (drama/suspense/romance) but in different proportions;
// Charisma is the one generalist, contributing a little to every tone
// rather than owning one (engine/compatibility.ts:deriveToneFromActingStyle,
// data/actingStyle.ts:ACTING_STYLE_TONE_WEIGHTS). There's no separate
// "skill" stat for actors - these five numbers are both their skill and
// their fit, together.
export interface ActingStyle {
  characterTransformation: number; // 1-100
  emotionalPerformance: number; // 1-100
  charisma: number; // 1-100
  comedy: number; // 1-100
  physicalPerformance: number; // 1-100
}

// --- Producer recommendations (docs/DESIGN.md - Plan Production redesign) ---
// The vocabulary a future recommendation engine will use to suggest how a
// production should be made, derived from its script/director/cast, before
// the player (as producer) follows or overrides it. Deliberately just the
// generic shapes - which concrete recommendations exist (environment
// strategy, effects strategy, ...) and what produces them is later work;
// these six types are what's actually agreed so far, and are what Script's
// and DirectorTalent's own Strategy/Ambition fields below are typed against.

// A suggestion with its own justification - not a UI type, what a
// recommendation IS regardless of how any screen renders it. Generic over
// `T` rather than one bespoke type per dial, since every dial so far needs
// one of only two value shapes - see Distribution and NormalizedScalar below.
export interface Recommendation<T> {
  value: T;
  // Ordered by how much each factor actually influenced `value`, strongest
  // first. Each entry is a complete, already-phrased sentence - including
  // ones that read as a conflict ("Director strongly prefers studio
  // shooting despite the script's location demands") - not a fragment a
  // renderer has to assemble or tag with polarity.
  reasons: string[];
}

// A recommendation that might not exist for this production at all - e.g. a
// future costume-related recommendation would have nothing to say about a
// contemporary-set indie drama. `null` means "this system doesn't activate
// for this film," not "no opinion, default to a neutral value" - a screen
// showing these should omit the card entirely rather than render an empty
// or default one.
export type OptionalRecommendation<T> = Recommendation<T> | null;

// How something is divided across a fixed, named set of options - always
// sums to 1. The value shape for any "which of these ways are we doing
// this" recommendation (e.g. environment strategy: studio/location/digital;
// effects strategy: practical/digital) - one generic shape rather than a
// bespoke type per dial, same generic-over-named-keys pattern
// engine/interpolate.ts:ScaleAnchor already uses for anchor values.
export type Distribution<K extends string> = Record<K, number>;

// A 0-1 "how much is invested in this, relative to what's possible"
// reading - deliberately not a currency amount. Recommendation time only
// knows relative ambition (this production wants to be effects-heavy or
// effects-light); turning that into an actual pound figure depends on the
// script's own scale and the studio's production budget, which only later
// work translating a followed-or-overridden recommendation into real
// ProductionChoices numbers has enough context to do.
export type NormalizedScalar = number;

// The two concrete Distribution key sets the model currently has an actual
// consumer for - Environment Strategy (where the shoot physically happens)
// and Effects Strategy (how a given effect gets achieved). Kept here, not
// invented separately by Script and Director, so both sides' Strategy
// fields are structurally the same shape and can be blended directly once a
// recommendation engine exists to do it.
export type EnvironmentMethodKey = 'studio' | 'location' | 'digital';
export type EffectsMethodKey = 'practical' | 'digital';

// --- Person model (PERSON_MODEL_REDESIGN.md) --------------------------
//
// The canonical entity is a Person, not a single-role Talent record - a
// person may hold any combination of role-specific careers (an actor who
// also directs, a writer/director, ...) rather than being permanently
// locked to the one role they were first generated as. Shared identity,
// personality and reputation live on Person; everything role-specific
// (skill, ActingStyle, ToneProfile, salary, ...) lives one level down, in a
// career record under Person.careers. See engine/person.ts for the helper
// API (career access/guards, salary/reputation lookups, availability).

export type PersonId = string;
export type GameDay = number;
export type Money = number;
export type NormalizedStat = number; // 1-100

export type Gender = 'Male' | 'Female' | 'NonBinary';

// Every role a person's career data can be filed under - reuses
// TalentProfession rather than introducing a differently-named but
// identical concept (the redesign doc calls this TalentRole; this codebase
// already has the same 7-value union under this name, used pervasively -
// see data/talentGeneration.ts, data/helpers.ts:professionForProductionRole).
export type CrewRole = Exclude<TalentProfession, 'Actor' | 'Director'>;

// The in-fiction calendar as an actual year/month/day, for facts (like a
// birth date) that need to be compared across people rather than just
// displayed - distinct from GameState.totalDays (engine/calendar.ts), which
// is the single running day counter everything else is driven by. Nothing
// currently anchors this to totalDays' own year-1-is-day-1 origin, so
// PersonIdentity.dateOfBirth stays optional (see below) rather than forcing
// every migrated/generated person to carry a fabricated birth date.
export interface GameDate {
  year: number;
  month: number;
  day: number;
}

// Subjective/casting-relevant physical qualities, as tags rather than a
// numeric "attractiveness" score - see PERSON_MODEL_REDESIGN.md for why.
// Purely descriptive for now; no current system reads these.
export type AppearanceTag =
  | 'ConventionallyAttractive'
  | 'Striking'
  | 'Intimidating'
  | 'Approachable'
  | 'Elegant'
  | 'Rugged'
  | 'Youthful'
  | 'Mature'
  | 'PhysicallyImposing'
  | 'Athletic'
  | 'DistinctiveVoice';

export interface PersonIdentity {
  name: string;
  // Optional, deliberately - deviates from the redesign doc's non-optional
  // fields. Every existing handcrafted/generated person predates this
  // model, and neither is real, verified public data for ~500 real people;
  // fabricating either would be a data-quality regression for a roster this
  // session hand-authored specifically to be realistic. Left unset on
  // migrated data rather than guessed; a future data-entry pass can fill
  // these in for real people without any further architecture change.
  gender?: Gender;
  dateOfBirth?: GameDate;
  nationality?: string;
  heightCm?: number;
  appearanceTags: AppearanceTag[];
}

/** currentDate.year/month/day compared against dateOfBirth - undefined if dateOfBirth isn't known (see PersonIdentity's own comment on why that's common right now). */
export function getPersonAge(dateOfBirth: GameDate | undefined, currentDate: GameDate): number | undefined {
  if (!dateOfBirth) return undefined;
  let age = currentDate.year - dateOfBirth.year;
  const birthdayHasPassed =
    currentDate.month > dateOfBirth.month ||
    (currentDate.month === dateOfBirth.month && currentDate.day >= dateOfBirth.day);
  if (!birthdayHasPassed) age -= 1;
  return age;
}

// A focused set of behavioural attributes - the architecture for
// personality-driven behaviour, connected to systems incrementally rather
// than all at once (see PERSON_MODEL_REDESIGN.md Phase 5). No current
// formula reads these yet; each is carried on every Person as a genuine
// simulation input waiting for a consumer, not decoration.
export interface PersonPersonality {
  professionalism: NormalizedStat;
  ambition: NormalizedStat;
  loyalty: NormalizedStat;
  ego: NormalizedStat;
  temperament: NormalizedStat;
  pressureHandling: NormalizedStat;
  controversy: NormalizedStat;
  adaptability: NormalizedStat;
}

export interface PersonReputation {
  fame: NormalizedStat;
  prestige: NormalizedStat;
  industryRespect: NormalizedStat;
  reliability: NormalizedStat;
  currentHeat: NormalizedStat;
}

// Fields every role-specific career shares - salary and reputation are
// role-specific on purpose (a famous actor making a directing debut
// shouldn't command their acting salary as a director, or be treated as an
// equally proven one) - see PERSON_MODEL_REDESIGN.md.
export interface RoleCareerCommon<TRole extends TalentProfession> {
  role: TRole;
  active: boolean;
  experience: NormalizedStat;
  roleReputation: NormalizedStat;
  minimumSalary: Money;
  typicalSalary: Money;
  careerStartDay?: GameDay;
  lastWorkedDay?: GameDay;
}

// A director's own leanings on *how* a production gets made - orthogonal to
// ToneProfile (which is about narrative/emotional flavor, not production
// method) and deliberately not "how ambitious" (already covered by
// ToneProfile's spectacle axis) - see docs/DESIGN.md. Same two Distribution
// keys Script's own Strategy fields below use, so a future recommendation
// can blend the two directly without a conversion step.
export interface DirectorProductionStyle {
  environmentStrategy: Distribution<EnvironmentMethodKey>;
  effectsStrategy: Distribution<EffectsMethodKey>;
}

export interface DirectorCareer extends RoleCareerCommon<'Director'> {
  skill: number; // 1-100
  toneProfile: ToneProfile;
  productionStyle: DirectorProductionStyle;
}

// Retains the existing acting model verbatim - actors still have no
// separate stored skill value, these five numbers are both their skill and
// their fit together (see ActingStyle above).
export interface ActorCareer extends RoleCareerCommon<'Actor'> {
  actingStyle: ActingStyle;
}

/** Derived aggregate actor ability, for anywhere a single number is genuinely needed - ActingStyle itself stays the stored, five-dimensional source of truth (see ActorCareer). */
export function computeActorAbility(style: ActingStyle): number {
  return (
    style.characterTransformation +
    style.emotionalPerformance +
    style.charisma +
    style.comedy +
    style.physicalPerformance
  ) / 5;
}

// Writer, Cinematographer, Composer, Editor, VFX Supervisor - a plain skill
// number, no tone-comparable stat. Doesn't feed Script Score directly
// (that's still purely the Script's own stats - see
// engine/scoring.ts:computeScriptScore), but does drive skillSensitive
// outcomes on any on-set event that involvesRole them (see docs/DESIGN.md
// 5.18). Cinematographer shares this same shape rather than a bespoke one -
// see docs/DESIGN.md 5.32 for why. Kept flat rather than given a bespoke
// per-role skill profile until the simulation has mechanics that would
// actually consume one (see PERSON_MODEL_REDESIGN.md).
export interface CrewCareer<TRole extends CrewRole> extends RoleCareerCommon<TRole> {
  skill: number; // 1-100
}

export interface PersonCareers {
  actor?: ActorCareer;
  director?: DirectorCareer;
  writer?: CrewCareer<'Writer'>;
  cinematographer?: CrewCareer<'Cinematographer'>;
  composer?: CrewCareer<'Composer'>;
  editor?: CrewCareer<'Editor'>;
  vfxSupervisor?: CrewCareer<'VFX Supervisor'>;
}

// Replaces the old single bookedUntil?: number - a person can hold more
// than one overlapping-in-time obligation once multiple careers are in play
// (booked as an actor on one production, separately attached as a writer on
// another), which one flat "committed through" day can't represent. See
// engine/person.ts:deriveBookedUntil for the derived single-value reading
// existing display code still wants.
export interface PersonCommitment {
  projectId: string;
  role: ProductionRole;
  startDay: GameDay;
  endDay: GameDay;
}

export interface PersonAvailability {
  commitments: PersonCommitment[];
}

// Notable behaviours/identities/modifiers, distinct from the continuous
// PersonPersonality values above - a visible, narratively legible shorthand
// (e.g. ego: 89 + temperament: 31 reads as "DifficultToWorkWith") rather
// than a replacement for them. May remain empty until a system consumes it
// - see PERSON_MODEL_REDESIGN.md.
export type PersonTrait =
  | 'Perfectionist'
  | 'Workaholic'
  | 'MethodPerformer'
  | 'NaturalImproviser'
  | 'DifficultToWorkWith'
  | 'MediaDarling'
  | 'HighlyPrivate'
  | 'PrestigeFocused'
  | 'PaychequeDriven'
  | 'RiskTaker'
  | 'Mentor'
  | 'ScandalProne'
  | 'MultiHyphenate';

export interface Person {
  id: PersonId;
  identity: PersonIdentity;
  personality: PersonPersonality;
  reputation: PersonReputation;
  // For UI display, filtering, and default categorisation only - never a
  // substitute for checking the relevant career record. A person's other
  // careers remain fully real and hireable regardless of which role this
  // says (see engine/person.ts:personCanPerformRole).
  primaryRole: TalentProfession;
  careers: PersonCareers;
  availability: PersonAvailability;
  traits: PersonTrait[];
}

// --- Screenplay identity (docs/DESIGN.md - screenplay redesign) -----------
//
// A screenplay used to be a bag of independently-rolled numbers with a genre
// and a tone profile glued on. These four tags are what make a generated
// script represent a coherent *concept* before any quality number is even
// shown - "a commercial sports drama" and "an arthouse psychological
// thriller" read as different films because they resolve to different tags,
// not because their stat rolls happened to land differently.

// The shape of the screenplay's ambition and market orientation - what kind
// of film this fundamentally is, independent of genre. Chosen first during
// generation (engine/scriptGenerator.ts) and everything else (quality
// profile, story tags, production requirements, commercial appeal) is
// generated to cohere with it, rather than every attribute being rolled
// independently. Deliberately cross-genre (a Spectacle archetype Comedy and
// a Spectacle archetype Action film are shaped the same way, just flavored
// differently) rather than a separate catalog per genre.
export type ScriptArchetype =
  | 'Prestige' // character/dialogue-driven, built for critical acclaim over broad reach
  | 'CrowdPleaser' // dependable, structurally sound, broad mainstream appeal
  | 'Spectacle' // event-scale, effects/stunts-heavy, built to be seen big
  | 'OriginalVision' // a genuinely novel premise - the biggest swing, the least predictable outcome
  | 'GenreFormula'; // safe, familiar, cheap to make and reliable to sell

// The story hook, independent of genre - a Sports Drama and a Crime Drama
// are both Drama, but call for very different casts, locations and
// commercial pitches. 'Original' (no strong subgenre hook) is deliberately
// the most common outcome - most scripts aren't built around one of these
// ten specific hooks.
export type StoryType =
  | 'Original'
  | 'Sports'
  | 'Musical'
  | 'Biography'
  | 'Documentary'
  | 'Crime'
  | 'Mystery'
  | 'Superhero'
  | 'War'
  | 'ComingOfAge'
  | 'Heist';

// When and where the story takes place - independent of genre and story
// type (a Historical War film and a Historical Romance both need period
// costuming; a Sci-Fi Heist and a Space Heist both need very different
// production requirements from a Modern one).
export type Setting = 'Modern' | 'Historical' | 'Fantasy' | 'SciFi' | 'Space';

// How big the production this screenplay implies actually is - cast size,
// location count, crowd work, cost. Named ScriptScale (not just `Scale`) to
// stay unambiguous next to Tone's own numeric scale and the unrelated
// rival-studio budget-tier ProductionScale below ('Small'/'Medium'/'Big').
export type ScriptScale = 'Intimate' | 'Medium' | 'Epic';

// What a screenplay concretely calls for on set - derived from archetype +
// story type + setting + scale (see engine/scriptGenerator.ts), never rolled
// independently, so "why is this script expensive" always has a legible
// answer in these fields rather than being implicit in a single cost number.
// Everything except the two boolean flags is a 0-1 intensity, same
// NormalizedScalar convention Environment/Effects Ambition already use.
export interface ProductionRequirements {
  extras: NormalizedScalar; // background/day-player cast need
  locations: NormalizedScalar; // how location-heavy vs contained to a handful of sets
  periodSetting: boolean; // costume/production design has to recreate an era
  vehicles: boolean; // meaningfully features cars, aircraft, ships, etc.
  animals: boolean; // meaningfully features trained animals
  practicalEffects: NormalizedScalar;
  vfx: NormalizedScalar;
  stunts: NormalizedScalar;
  choreography: NormalizedScalar; // dance/musical staging, not fight choreography (see stunts)
  crowdWork: NormalizedScalar; // large coordinated crowd/battle/riot scenes, distinct from ordinary extras
}

export interface Script {
  id: string;
  title: string;
  genre: Genre;
  archetype: ScriptArchetype;
  storyType: StoryType;
  setting: Setting;
  scale: ScriptScale;
  // The five intrinsic screenplay-craft attributes - deliberately kept
  // small, and each with exactly one job (docs/DESIGN.md): what the
  // screenplay itself *is*, not how commercially attractive it is (see
  // engine/commercialProfile.ts for that, computed from the fields above
  // rather than stored as its own rolled stat).
  originality: number; // 1-100
  structure: number; // 1-100
  characters: number; // 1-100 - depth/arcs, distinct from Dialogue's craft
  dialogue: number; // 1-100
  complexity: number; // 1-100, drives production difficulty/risk
  cost: number;
  toneProfile: ToneProfile;
  // The screenplay's own implied production approach - not a requirement,
  // a lean (see docs/DESIGN.md). Same Distribution/NormalizedScalar shapes
  // DirectorTalent.productionStyle uses, feeding the same two pairs of
  // recommendations (Environment Strategy/Ambition, Effects
  // Strategy/Ambition) a future recommendation engine will produce. Derived
  // from `productionRequirements` below, not generated independently of it.
  environmentStrategy: Distribution<EnvironmentMethodKey>;
  environmentAmbition: NormalizedScalar;
  effectsStrategy: Distribution<EffectsMethodKey>;
  effectsAmbition: NormalizedScalar;
  productionRequirements: ProductionRequirements;
  // A one-sentence log-line generated from genre + tone flavor
  // (engine/premiseGenerator.ts, data/premises.ts) - presentation only,
  // doesn't feed any scoring, same as title.
  synopsis: string;
  // How many named Lead/Supporting roles this script actually has - a
  // buddy-cop script calls for two leads, an ensemble drama might want a
  // bigger supporting cast. Drives Hire Talent's capacity for those two
  // roles directly (see engine/castRequirements.ts) rather than every film
  // offering the same fixed slots.
  requiredLeads: number;
  requiredSupporting: number;
  // The audience this script was written for - pre-fills Target Audience
  // when the script is picked, but stays fully overridable.
  intendedAudience: TargetAudience;
}

// Every production dial is continuous rather than a fixed tier: the four
// spend dials are plain currency amounts (interpreted on a log scale - see
// engine/productionDials.ts), and runtimeIntensity is a 0-1 intensity from
// its low extreme (Short) to its high extreme (Long). There's no shooting-
// pace dial any more - how long the shoot actually takes is something the
// player lives through, not a slider they set in advance (see
// engine/production.ts:computeRecommendedShootDays and PhotographyState
// below).
export interface ProductionChoices {
  // Crew size, equipment, insurance, general overhead - and the safety
  // margin that offsets risk from ambitious practical/VFX spend elsewhere.
  // Not "the total budget" (that's the sum of every dial, shown on the Plan
  // Production screen) - see docs/DESIGN.md 5.9 for why this dial
  // specifically doubles as risk mitigation rather than just another
  // quality lever. Spent as a daily burn rate during principal photography
  // (PhotographyState.runningCost), not a flat lump sum - see 5.16.
  contingencyAmount: number;
  setQualityAmount: number;
  practicalEffectsAmount: number;
  vfxAmount: number;
  runtimeIntensity: number; // 0 = Short, 1 = Long
}

// How big a deal an event actually is - low-stakes texture vs a genuine
// turning point. Drives how often each tier fires (see
// engine/production.ts:rollDayEvent) - `low` is deliberately the common
// case, `high` deliberately rare. See docs/DESIGN.md 5.21.
export type EventSeverity = 'low' | 'medium' | 'high';

export interface ProductionEvent {
  id: string;
  description: string;
  severity: EventSeverity;
  costDelta: number; // absolute currency change
  qualityDelta: number; // -100..100 scale applied to production score
  buzzDelta: number; // -100..100
  delayDaysDelta: number; // extra shoot days this event actually cost, on top of the day it happened on - always >= 0
}

// One option the player can pick when an interactive event pauses
// photography (see PhotographyState.pendingChoice below) - each choice rolls
// its own outcome independently, so a "pay to fix it" option and a "push
// through and accept the risk" option for the same situation can land in
// completely different places on cost/quality/buzz/delay. Which of those a
// choice actually touches is whatever the situation logically implies, not
// forced to a single one for its own sake.
export interface EventChoiceTemplate {
  id: string;
  label: string; // short button text, e.g. "Pay for a reshoot"
  description: string; // what picking this actually involves
  costRange: [number, number];
  qualityRange: [number, number];
  buzzRange: [number, number];
  delayDaysRange: [number, number];
  // If true, this choice's qualityRange/delayDaysRange shift based on the
  // involved talent's skill (see PendingEventChoice.involvedTalentId) before
  // being rolled - a stronger writer/director/actor genuinely handles this
  // specific choice better. Only meaningful on a template with
  // `involvesRole` set (see data/productionEvents.ts); computed once at
  // roll time (engine/production.ts:rollDayEvent), not at resolve time.
  skillSensitive?: boolean;
  // Present only on a choice generated dynamically at roll time for a
  // replacement decision (data/productionEvents.ts:offersReplacementFor) -
  // which specific talent-pool candidate this option actually hires, so
  // RESOLVE_EVENT_CHOICE can swap them into FilmDraft.talent alongside
  // applying the normal cost/quality/buzz/delay roll.
  replacementCandidateId?: string;
  replacementCandidateName?: string;
  replacementCandidateSalary?: number;
}

// An interactive event that's paused photography, waiting on the player to
// pick one of `choices` - see PhotographyState.pendingChoice and
// state/studioReducer.ts:RESOLVE_EVENT_CHOICE.
export interface PendingEventChoice {
  templateId: string;
  situation: string; // the dilemma being presented, before a choice is made
  polarity: 'positive' | 'negative';
  severity: EventSeverity;
  choices: EventChoiceTemplate[];
  // The specific hired talent this event is actually about, if the template
  // set `involvesRole` (data/productionEvents.ts) - resolved once at roll
  // time from FilmDraft.talent, so the UI can show who's involved and
  // RESOLVE_EVENT_CHOICE knows who to remove from the cast on a replacement.
  involvedTalentId?: string;
  involvedTalentName?: string;
  involvedRole?: ProductionRole;
  // Set alongside involvedRole when this event offers a real recast
  // decision - which role any replacementCandidateId choices are hiring for.
  replacementRole?: ProductionRole;
}

// The four risk dimensions knowable *before* a day of filming has happened -
// each 0-100 (higher = more risk), computed from planning choices, cast,
// and script (engine/production.ts:computeStaticProductionRisk). Drives
// which on-set events are reachable each day during photography
// (data/productionEvents.ts), same as the schedule-pressure dimension used
// to. Schedule Pressure itself isn't here any more - it can't be known
// until the player has actually decided how many days to shoot (see
// PhotographyState below and docs/DESIGN.md 5.16), so it's computed
// separately, live, once photography is under way.
export interface StaticProductionRisk {
  moraleRisk: number; // cast/crew reliability and ego - interpersonal friction
  safetyRisk: number; // practical-effects ambition vs. contingency margin
  technicalComplexity: number; // VFX ambition and script complexity vs. contingency margin
  budgetRisk: number; // overall spend relative to what the genre/script actually demands
}

// Principal photography as a live, day-by-day process the player watches
// and can end at any time, rather than a single computed batch of events
// (docs/DESIGN.md 5.16). `recommendedDays` is computed once, when filming
// begins, from script/cast/choices (engine/production.ts:computeRecommendedShootDays);
// `daysElapsed` and `events` grow one day at a time via ADVANCE_SHOOTING_DAY,
// and each day also advances GameState.totalDays, so the persistent calendar
// ticks forward in step with the shoot. FilmDraft.photography is `null`
// before the player clicks "Begin Principal Photography" - `status` also
// covers 'awaiting-choice', when a rolled event is interactive and the timer
// is paused on pendingChoice until RESOLVE_EVENT_CHOICE is dispatched; the
// reducer only accepts ADVANCE_SHOOTING_DAY while 'in-progress'.
export interface PhotographyState {
  status: 'in-progress' | 'awaiting-choice' | 'finished';
  recommendedDays: number;
  daysElapsed: number;
  events: ProductionEvent[];
  runningCost: number;
  pendingChoice: PendingEventChoice | null;
}

export type EditStyle = 'Commercial' | 'Artistic' | 'Balanced';
export type MusicFocus = 'Minimal' | 'Standard' | 'Heavy';
export type TestScreeningResponse = 'Ignore' | 'Minor Changes' | 'Major Changes';
export type FinalCutFocus = 'Trailer-focused' | 'Critic-focused' | 'Star-focused' | 'Mystery-focused';

export interface PostProductionChoices {
  editStyle: EditStyle;
  musicFocus: MusicFocus;
  testScreeningResponse: TestScreeningResponse;
  finalCutFocus: FinalCutFocus;
}

// Streaming was removed as a release option (docs/DESIGN.md 5.34, Milestone
// 5) - the audience simulation that now settles every release has no honest
// theatrical-admissions model for it (see engine/audienceSimulationInputs.ts's
// module header, Milestone 3), and keeping a second, unmaintained fixed-legs
// path alive just for one release type would mean two production sources of
// truth instead of one. A save with an old Film.marketingChoices.releaseType
// of 'Streaming' can't exist any more (see state/persistence.ts's SAVE_KEY
// bump) - old saves are simply superseded by a fresh studio, not migrated.
export type ReleaseType = 'Limited' | 'Wide' | 'Festival First';
export type ReleaseWindow = 'Quiet Month' | 'Summer' | 'Awards Season' | 'Halloween' | 'Christmas';

export interface MarketingChoices {
  // A continuous currency amount, not a fixed tier - what a given level of
  // exposure costs doesn't change based on how cheap or expensive the film
  // itself was (see data/release.ts:MARKETING_SPEND_RANGE). Flat, absolute
  // cost is what makes the top of the range naturally unreachable for a
  // small studio, rather than needing an artificial rule to lock it out.
  marketingSpend: number;
  releaseType: ReleaseType;
  releaseWindow: ReleaseWindow;
}

export type OutcomeLabel =
  | 'Flop'
  | 'Weak'
  | 'Modest Success'
  | 'Hit'
  | 'Blockbuster'
  | 'Phenomenon'
  | 'Cult Hit'
  | 'Masterpiece';

export interface FilmResults {
  productionCost: number;
  marketingCost: number;
  totalCost: number;
  openingWeekend: number;
  // These six are only knowable once the film's BoxOfficeRun finishes
  // (see BoxOfficeRun below and docs/DESIGN.md 5.19) - total gross isn't a
  // single computed figure any more, it's whatever the weekly run actually
  // adds up to, so profit/outcome/brand/prestige have to wait for it the
  // same way a real studio doesn't know a film's final numbers on opening
  // night. null while BoxOfficeRun.status === 'running'.
  totalBoxOffice: number | null; // the big headline gross - not what the studio actually keeps, see studioRevenue
  studioRevenue: number | null; // totalBoxOffice after the theatrical revenue split - what profit is actually computed from
  profit: number | null;
  outcome: OutcomeLabel | null;
  // Milestone: Brand Recognition and Prestige (engine/reputation.ts) replaced
  // the single Reputation stat - commercial performance (profit relative to
  // cost, plus a modest audience-approval nudge) moves brandChange; critical
  // reception alone moves prestigeChange, deliberately independent of profit
  // (a beloved flop still builds Prestige; a profitable but panned film does
  // not - see computeBrandChange/computePrestigeChange for the full reasoning).
  brandChange: number | null;
  prestigeChange: number | null;
  criticScore: number; // 0-100
  audienceScore: number; // 0-100
  buzzScore: number; // 0-100
  qualityScore: number; // 0-100, internal weighted quality
  // Per-department breakdown behind qualityScore, surfaced on the results
  // screen so the player can see WHY the film scored the way it did instead
  // of just a single number.
  scriptScore: number;
  directionScore: number;
  actingScore: number;
  productionScore: number;
  postProductionScore: number;
  eventsScore: number;
  reviewBlurbs: string[];
  // A narrated trade-press-style summary of the release, distinct from the
  // in-world critic-quote blurbs above - see engine/storyReport.ts.
  storyReport: string;
}

/** One settled week of a film's theatrical run - see BoxOfficeRun. */
export interface BoxOfficeWeek {
  week: number; // 1-indexed; week 1 is always exactly FilmResults.openingWeekend
  gross: number;
}

/**
 * A film's box office as a live, week-by-week process instead of a single
 * computed total - mirrors how Principal Photography (PhotographyState)
 * became a lived process instead of a batch roll. Settled by the weekly
 * audience simulation (docs/DESIGN.md 5.34, Milestones 1-5) instead of the
 * retired fixed-legs formula - `fixed` is computed once, at release, from
 * the reviews/release-type/marketing known that day
 * (engine/audienceSimulationInputs.ts:deriveAudienceSimulationFixedState)
 * and never recomputed; `simWeeks` is the actual weekly admissions history
 * (people, not money) that drives everything else - the single source of
 * truth for continuing this run. `weeks`/`cumulativeGross` are the money
 * view, derived from `simWeeks` at the boundary
 * (engine/boxOfficeRun.ts:AVERAGE_TICKET_PRICE) and stored alongside it so
 * every existing display (BoxOfficeChart, Dashboard, FilmDetailModal, ...)
 * keeps reading the exact same shape it always has - "legs" is deliberately
 * *not* a field here any more, it's a derived reported statistic computed
 * on demand from `results.totalBoxOffice`/`results.openingWeekend`
 * (state/selectors.ts:computeLegs), never something stored or fed back into
 * the simulation. Settled lazily off the existing calendar (GameState.totalDays)
 * whenever it advances for any reason, not a dedicated ticking screen - see
 * engine/boxOfficeRun.ts:settleBoxOfficeForAllFilms and docs/DESIGN.md 5.19.
 */
export interface BoxOfficeRun {
  status: 'running' | 'finished';
  fixed: AudienceSimulationFixedState;
  simWeeks: AudienceSimulationWeekState[];
  weeks: BoxOfficeWeek[];
  cumulativeGross: number;
  // Whether the player has seen the "final breakdown" popup for this run -
  // set true by ACKNOWLEDGE_BOX_OFFICE_RESULTS once status is 'finished', so
  // the popup doesn't reappear every time the player revisits the Dashboard.
  acknowledged: boolean;
}

// A film record that has been fully cast/produced/released and lives in studio history.
export interface Film {
  id: string;
  title: string;
  genre: Genre;
  targetAudience: TargetAudience;
  script: Script;
  talent: TalentAssignment[];
  productionChoices: ProductionChoices;
  postProductionChoices: PostProductionChoices;
  marketingChoices: MarketingChoices;
  events: ProductionEvent[];
  results: FilmResults;
  boxOfficeRun: BoxOfficeRun;
  /** GameState.totalDays at the moment this film was released - see engine/calendar.ts:formatGameDate. */
  releasedOnDay: number;
  // Which rival studio made this, if any - absent means it's the player's
  // own (see GameState.rivalFilmsReleased below and docs/DESIGN.md 5.24). Kept
  // as a plain name rather than an id lookup since a rival studio's own
  // record never needs to change after the fact.
  releasedBy?: string;
  // Which owned Asset this film was developed from, if any - absent for a
  // rival's film (rivals don't go through the Opportunity/Asset pipeline in
  // this MVP, see docs/DESIGN_REVIEW_development_pipeline.md) or a save
  // from before it existed. Lets the Asset Library tell "used" assets apart
  // from ones with no released history yet (engine/project.ts:deriveAssetStatus).
  assetId?: string;
}

// --- Development Pipeline: Opportunity -> Asset -> Project ---------------
//
// docs/DESIGN_REVIEW_development_pipeline.md. A studio doesn't create films
// out of nothing any more - it acquires an Opportunity (something it
// doesn't yet own, generated and expiring on the same lazy,
// calendar-settlement pattern RivalProductionInProgress.releaseDay already
// uses), which becomes a permanently-owned Asset, which a Project can then
// be started from. Source is mostly flavor riding on three real levers
// (acquisition cost, expiry window, and - via those - how urgently it's
// worth acting on), not eight parallel generation systems.
export type OpportunitySource = 'Spec Screenplay' | 'Agent Package' | 'Publisher Rights' | 'Studio Original';

/**
 * Something the studio does not yet own - visible to the player and every
 * rival studio (engine/rivalStudios.ts) until it's acquired or its own
 * `expiresOnDay` passes, whichever comes first. Carries a full `Script`
 * wholesale (engine/scriptGenerator.ts is untouched - this just gives an
 * already-generated script a real, shared, time-bound existence instead of
 * living only inside one draft's ephemeral `scriptOptions`).
 */
export interface Opportunity {
  id: string;
  source: OpportunitySource;
  script: Script;
  /** The instant-buy price while uncontested (`bids` empty) - also the floor the first bid on a contested opportunity must clear. */
  acquisitionCost: number;
  /** GameState.totalDays - past this, the opportunity is gone (someone else took it, the rights lapsed, the pitch fell through) whether or not the player ever saw it. */
  expiresOnDay: number;
  /** GameState.totalDays this opportunity's weekly batch was generated on - drives the Opportunity Market's "New This Week" badge (engine/opportunities.ts:WEEK_LENGTH_DAYS). */
  postedOnDay: number;
  /**
   * Milestone: Opportunity Market bidding. Empty for the common case - an
   * uncontested opportunity stays an instant Acquire-at-`acquisitionCost`
   * purchase, exactly as before. The moment any rival studio wants it too
   * (engine/rivalStudios.ts:considerBiddingOnOpportunity), a bid lands here
   * instead of an instant sale, and the player's own "Acquire" becomes
   * "Place Bid" - see engine/opportunities.ts:placeBid/settleOpportunities
   * for how this resolves at the next weekly tick. English-auction style:
   * always the full, visible list, never sealed.
   */
  bids: OpportunityBid[];
}

/** One studio's current offer on a contested Opportunity - `bidderId` is the literal `'player'` sentinel or a `RivalStudio.id`, `bidderName` is duplicated for display so the UI never has to cross-reference `state.rivalStudios` just to render a bid. */
export interface OpportunityBid {
  bidderId: string;
  bidderName: string;
  amount: number;
  /** Set only for a rival's own bid (engine/rivalStudios.ts:considerBiddingOnOpportunity) - which ProductionScale it intends to make this into if it wins, carried through to the weekly resolution step (startRivalProductionFromWonScript) since a scale's production-budget level can't be re-derived from the script alone. Always absent on the player's own bid. */
  scale?: ProductionScale;
}

/**
 * An acquired Opportunity, now permanently owned by the studio
 * (Studio.assets below) - may sit in the library indefinitely, may never
 * become a film at all. A Project references an Asset by id; it does not
 * replace or consume it, so the same Asset can generate more than one
 * Project attempt over its life (a stalled Project returns to a plain,
 * still-owned Asset with nothing further to do - see
 * engine/project.ts:deriveAssetStatus).
 */
export interface Asset {
  id: string;
  script: Script;
  source: OpportunitySource;
  acquisitionCost: number;
  /** GameState.totalDays this was acquired on - display only (Asset Library "owned since"). */
  acquiredOnDay: number;
}

// A rival studio's overall scale - governs both how big the films it makes
// tend to be and how many it can have in production at once (see
// engine/rivalStudios.ts:canStartNewProduction, docs/DESIGN.md 5.24).
export type StudioTier = 'Indie' | 'Mid-Size' | 'Major';

// A single production's own scale, independent of quality - a Small film
// can still turn out great, a Big one can still flop. Drives the target
// price band used to cast it (see engine/rivalStudios.ts).
export type ProductionScale = 'Small' | 'Medium' | 'Big';

export interface RivalStudio {
  id: string;
  name: string;
  tier: StudioTier;
  /** GameState.totalDays threshold - once reached, this studio attempts a new production if it has spare capacity (see engine/rivalStudios.ts). */
  nextSpawnCheckDay: number;
  // Milestone: AI Studios 2.0 (engine/rivalStudios.ts) - a rival now has the
  // same real financial stake in its own productions the player's own
  // Studio does, instead of an unlimited, untracked production pipeline.
  /** Real, spendable cash - a production is only ever started if its full total commitment (script + talent + production budget + contingency + marketing + test screening) fits under this, same affordability gate GREENLIGHT_PROJECT applies to the player. */
  cash: number;
  /** Same Brand Recognition stat the player's Studio has (engine/reputation.ts) - grows/falls from this studio's own films' commercial performance, and feeds this studio's own future Buzz (see resolveRivalProduction), the same feedback loop the player already has. */
  brand: number;
  /** Same Prestige stat the player's Studio has - grows/falls from this studio's own films' critical reception alone. Not yet consumed by any formula here either, same documented gap as the player's own Prestige (docs/DESIGN.md 5.39). */
  prestige: number;
  /** Cumulative studioRevenue this studio has ever been credited from box office - debugging/display only (components/dev/RivalFinancesInspector.tsx), never itself read by any formula. */
  lifetimeRevenue: number;
  /** Cumulative amount this studio has ever committed to starting productions - debugging/display only, same as lifetimeRevenue. */
  lifetimeExpenditure: number;
}

/**
 * A rival production between casting and release - no live day-by-day
 * simulation, just enough to (a) hold real talent-pool candidates
 * unavailable to the player for a believable window and (b) synthesize a
 * full Film via the same scoring/box-office math the player's own films use,
 * once `releaseDay` arrives (engine/rivalStudios.ts:resolveRivalProduction).
 */
export interface RivalProductionInProgress {
  id: string;
  rivalStudioId: string;
  scale: ProductionScale;
  genre: Genre;
  script: Script;
  talent: TalentAssignment[];
  productionChoices: ProductionChoices;
  postProductionChoices: PostProductionChoices;
  marketingChoices: MarketingChoices;
  targetAudience: TargetAudience;
  releaseDay: number;
}

// Architecture roadmap Phase 5: filmsReleased/productionsInProgress moved to
// GameState.projects (see Project below) - one flat, world-level store
// instead of a per-studio one, since it's what fixed the id-churn/storage
// fragmentation Project exists to solve. Studio itself is now just identity,
// the two numbers a film actually spends/earns against, and the one thing
// that's genuinely private, exclusive studio property: its owned Asset
// library (development-pipeline doc) - unlike Talent/Opportunity, which are
// shared/world-level, nobody else's Studio can reach into this list.
export interface Studio {
  name: string;
  cash: number;
  // Milestone: replaces the old single `reputation` stat with two
  // independent long-term progression stats (engine/reputation.ts) -
  // avoids one number quietly deciding both "how commercially bankable is
  // this studio" and "how respected is this studio creatively," which a
  // real studio's reputation isn't one thing (Disney/Blumhouse are high
  // Brand, lower Prestige; A24 is the reverse; a new indie studio starts
  // low in both).
  /** How well known and commercially bankable the studio is with general audiences - drives pre-release Buzz and marketing efficiency (how far a marketing pound goes), never critic-facing mechanics. */
  brand: number; // 0-100
  /** How respected the studio is within the industry and by critics - grows from critical reception alone, independent of a film's commercial outcome. Not yet consumed by any formula (no critic-facing mechanic exists yet) - tracked now so a future system (e.g. awards) has real history to read, the same "compute and track now, wire in later" precedent commercialProfile.crossoverPotential set. */
  prestige: number; // 0-100
  assets: Asset[];
}

export interface TalentAssignment {
  role: ProductionRole;
  person: Person;
}


// The film currently being built in the wizard; fields fill in progressively.
export interface FilmDraft {
  // Stable identity, needed once a draft can be sent to
  // Studio.productionsInProgress alongside others of its kind - actions
  // that used to implicitly mean "the draft" (RESOLVE_EVENT_CHOICE,
  // FINISH_PHOTOGRAPHY) target one of those by id instead. Assigned once,
  // at CREATE_PROJECT_FROM_ASSET.
  id: string;
  // Which owned Asset (Studio.assets) this draft was created from - always
  // set (every draft now originates from an Asset, never from nothing -
  // development-pipeline doc). Lets the Asset Library find "is there
  // already an active Project against this Asset" without Asset itself
  // needing to store a status flag (engine/project.ts:deriveAssetStatus).
  assetId: string;
  title: string;
  genre: Genre | null;
  targetAudience: TargetAudience | null;
  // The script is inherited wholesale from the originating Asset the
  // moment this draft is created - never null in practice, never
  // regenerated or re-picked inside the wizard any more (development-pipeline
  // doc). Kept nullable rather than widened to `Script` outright so every
  // existing consumer's null-narrowing keeps working unchanged - a
  // deliberately minimal-diff choice, not an oversight.
  script: Script | null;
  talent: TalentAssignment[];
  /** The price the player is currently targeting for each casting slot - filters GameState.talentPool (once mapped to the underlying TalentProfession) down to who's shown. Keyed by ProductionRole, not TalentProfession, since Lead Actor and Supporting Actor need independent target prices even though both hire from the same Actor pool. */
  talentTargetPriceByRole: Partial<Record<ProductionRole, number>>;
  // The player's own Strategy/Ambition choices from the redesigned Plan
  // Production screen - null until that screen has been visited at least
  // once. `productionChoices` below is still what every downstream system
  // (shoot-day estimate, static risk, cost) actually reads - it's derived
  // from these via engine/productionChoicesAdapter.ts every time any of
  // them changes, not edited directly any more. See docs/DESIGN.md.
  environmentStrategy: Distribution<EnvironmentMethodKey> | null;
  environmentAmbition: NormalizedScalar | null;
  effectsStrategy: Distribution<EffectsMethodKey> | null;
  effectsAmbition: NormalizedScalar | null;
  productionChoices: ProductionChoices | null;
  // GameState.totalDays the studio actually committed to this project - the
  // point talent selection stopped being provisional and production/talent
  // cash left the studio (GREENLIGHT_PROJECT, state/studioReducer.ts). null
  // before that: freely abandonable, nothing spent yet beyond the asset's
  // own acquisition cost. Deliberately not a new Project `kind` - see
  // Project's own comment below for why.
  greenlitOnDay: number | null;
  photography: PhotographyState | null;
  // Index into the wizard's canonical step order (state/studioReducer.ts:WIZARD_STEP_ORDER)
  // of the furthest stage whose fixed day cost (data/schedule.ts:STAGE_DURATIONS)
  // has already been charged - -1 means nothing charged yet. Stops a
  // Back-then-forward round trip from paying the same stage's duration
  // twice; only genuinely new forward progress advances the calendar.
  furthestStepIndexCharged: number;
  postProductionChoices: PostProductionChoices | null;
  marketingChoices: MarketingChoices | null;
  results: FilmResults | null;
}

// --- Project: one entity, one id, across a film's entire life ------------
//
// Architecture roadmap Phase 3. Today a film's identity is fragmented
// across three storage locations with two id schemes: the live
// GameState.draft, Studio.productionsInProgress (background shoots,
// same FilmDraft type), and Studio.filmsReleased (a different type, with a
// freshly-generated id unrelated to the FilmDraft.id it carried its whole
// life up to that point). Project is a single discriminated union, tagged
// by `kind`, so every one of the three keeps one stable identity
// (projectId below) from greenlight through release.
//
// Deliberately NOT a full merge of FilmDraft/Film/RivalProductionInProgress
// into new flattened payload shapes - each variant just nests the existing
// type wholesale. `RivalProductionInProgress` stays structurally distinct
// from `FilmDraft` (a synthesized production isn't a lived one - see
// docs/DESIGN.md, architecture audit Identity #4) rather than being forced
// into false parity with it; unifying those two deeply is its own,
// separate, deferrable undertaking. What Project actually fixes is
// *storage fragmentation* - one flat, world-level array instead of three
// separate ones - not the type-level distinction between how the player's
// own films and a rival's are made.
// Roadmap Phase 7.1/7.2: a fourth variant, 'scheduled' - a player's own
// project that's made every creative/production decision it's going to
// (post-production and marketing choices are both locked in) and is now
// just waiting for its own `releaseDay` to arrive, the same lazy,
// catch-up-safe settlement pattern RivalProductionInProgress.releaseDay
// already uses (see engine/rivalStudios.ts) - now the player gets the same
// real scheduling capability instead of always releasing same-day.
// Deliberately not a fifth 'completed' variant on top of this: a
// post-production-done-but-not-yet-scheduled project doesn't need its own
// kind - it's already fully representable as an ordinary backgrounded
// 'player-in-progress' project (photography.status === 'finished',
// postProductionChoices set), the same way a mid-shoot backgrounded draft
// already is. "Parked" is a UI affordance (Dashboard/Inbox surfacing it
// distinctly), not a storage-level distinction that needs its own type.
export type Project =
  | { kind: 'player-in-progress'; draft: FilmDraft }
  | { kind: 'scheduled'; draft: FilmDraft; releaseDay: number }
  | { kind: 'rival-in-progress'; production: RivalProductionInProgress }
  | { kind: 'released'; film: Film };

// Post-greenlight only, now that Develop/Hire Talent/Plan Production/
// Greenlight have been replaced by the free-navigation Producer Workspace
// (see ProjectWorkspaceSection below, and 'workspace' on Screen) - those
// four used to sit ahead of 'production' here, each with a fixed forward
// order STAGE_DURATIONS/WIZARD_STEP_ORDER (state/studioReducer.ts) charged
// calendar time against. That fixed-order premise doesn't hold once the
// player can move between workspace sections freely, so pre-production
// time is now charged as one lump sum at Greenlight instead
// (engine/production.ts:computeRecommendedPreProductionDays) - this type
// only needs to describe what's still genuinely sequential.
export type WizardStep =
  | 'production'
  | 'post-production'
  | 'marketing'
  | 'results';

// The pre-greenlight areas of a project (Producer Workspace redesign,
// PRODUCER_WORKSPACE_DESIGN.md) - freely navigable via
// OPEN_PROJECT_WORKSPACE_SECTION (state/studioReducer.ts), not a fixed
// forward sequence like WizardStep above. 'director'/'cast'/'crew' don't
// exist as independent sections yet (Phase 1 keeps them combined under
// 'cast-and-crew', reusing components/wizard/HireTalent.tsx wholesale) -
// deferred to a later phase per PRODUCER_WORKSPACE_DESIGN.md's own phasing.
export type ProjectWorkspaceSection = 'overview' | 'cast-and-crew' | 'production' | 'finance';

// 'workspace' is the single screen a pre-greenlight project lives on now -
// which of its sections is showing is GameState.projectWorkspaceSection,
// not a family of Screen values the way the old wizard steps were.
// 'release-calendar'/'opportunity-market'/'asset-library'/'projects' are
// Dashboard detours (roadmap Phase 7.3; development-pipeline doc), not
// WizardSteps - reachable and leavable from the Dashboard like
// 'rival-studio'/'stats', not part of the develop-to-release sequence.
export type Screen =
  | 'dashboard'
  | 'workspace'
  | WizardStep
  | 'rival-studio'
  | 'stats'
  | 'release-calendar'
  | 'opportunity-market'
  | 'asset-library'
  | 'projects';
