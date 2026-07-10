// Core domain types for the studio management game.
// Kept in one file for MVP; split by domain (film.ts, talent.ts, ...) if it grows.

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

export type TalentRole =
  | 'Director'
  | 'Lead Actor'
  | 'Supporting Actor'
  | 'Writer'
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

interface TalentCommon {
  id: string;
  name: string;
  fame: number; // 1-100
  reliability: number; // 1-100
  ego: number; // 1-100
  salary: number;
  // Studio.totalDays this person is committed through - a rival studio
  // production currently has them cast (see engine/rivalStudios.ts). Absent
  // or <= the current day means available. Never set by the player's own
  // hires - only one of the player's own films is ever in production at a
  // time, so there's nothing for that to conflict with (see docs/DESIGN.md
  // 5.24 and Known Limitations).
  bookedUntil?: number;
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

export interface DirectorTalent extends TalentCommon {
  role: 'Director';
  skill: number; // 1-100
  toneProfile: ToneProfile;
  productionStyle: DirectorProductionStyle;
}

export interface ActorTalent extends TalentCommon {
  role: 'Lead Actor' | 'Supporting Actor';
  actingStyle: ActingStyle;
}

// Writer, Composer, Editor, VFX Supervisor - a plain skill number, no
// tone-comparable stat. Doesn't feed Script Score directly (that's still
// purely the Script's own stats - see engine/scoring.ts:computeScriptScore),
// but does drive skillSensitive outcomes on any on-set event that
// involvesRole them (see docs/DESIGN.md 5.18).
export interface CrewTalent extends TalentCommon {
  role: 'Writer' | 'Composer' | 'Editor' | 'VFX Supervisor';
  skill: number; // 1-100
}

export type Talent = DirectorTalent | ActorTalent | CrewTalent;

export interface Script {
  id: string;
  title: string;
  genre: Genre;
  genreFit: number; // 1-100, how well the script suits the chosen genre
  originality: number; // 1-100
  structure: number; // 1-100
  dialogue: number; // 1-100
  marketability: number; // 1-100
  complexity: number; // 1-100, drives production difficulty/risk
  cost: number;
  toneProfile: ToneProfile;
  // The screenplay's own implied production approach - not a requirement,
  // a lean (see docs/DESIGN.md). Same Distribution/NormalizedScalar shapes
  // DirectorTalent.productionStyle uses, feeding the same two pairs of
  // recommendations (Environment Strategy/Ambition, Effects
  // Strategy/Ambition) a future recommendation engine will produce.
  environmentStrategy: Distribution<EnvironmentMethodKey>;
  environmentAmbition: NormalizedScalar;
  effectsStrategy: Distribution<EffectsMethodKey>;
  effectsAmbition: NormalizedScalar;
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
  involvedRole?: TalentRole;
  // Set alongside involvedRole when this event offers a real recast
  // decision - which role any replacementCandidateId choices are hiring for.
  replacementRole?: TalentRole;
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
// and each day also advances Studio.totalDays, so the persistent calendar
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

export type ReleaseType = 'Limited' | 'Wide' | 'Streaming' | 'Festival First';
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
  | 'Cult Hit'
  | 'Modest Success'
  | 'Hit'
  | 'Blockbuster'
  | 'Masterpiece';

export interface FilmResults {
  productionCost: number;
  marketingCost: number;
  totalCost: number;
  openingWeekend: number;
  // These five are only knowable once the film's BoxOfficeRun finishes
  // (see BoxOfficeRun below and docs/DESIGN.md 5.19) - total gross isn't a
  // single computed figure any more, it's whatever the weekly run actually
  // adds up to, so profit/outcome/reputation have to wait for it the same
  // way a real studio doesn't know a film's final numbers on opening night.
  // null while BoxOfficeRun.status === 'running'.
  totalBoxOffice: number | null; // the big headline gross - not what the studio actually keeps, see studioRevenue
  studioRevenue: number | null; // totalBoxOffice after the theatrical revenue split - what profit is actually computed from
  profit: number | null;
  outcome: OutcomeLabel | null;
  reputationChange: number | null;
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
 * became a lived process instead of a batch roll. `legs` and `retention`
 * are fixed once, from the reviews/release-type known at release
 * (engine/boxOffice.ts:computeLegs/computeWeeklyRetention) - critic reaction
 * doesn't change after the fact, so neither does how fast the film's run
 * decays. Settled lazily off the existing calendar (Studio.totalDays)
 * whenever it advances for any reason, not a dedicated ticking screen - see
 * engine/boxOfficeRun.ts:settleBoxOfficeForAllFilms and docs/DESIGN.md 5.19.
 */
export interface BoxOfficeRun {
  status: 'running' | 'finished';
  legs: number;
  retention: number; // 0-1, week-over-week gross retention derived from legs
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
  talent: Talent[];
  productionChoices: ProductionChoices;
  postProductionChoices: PostProductionChoices;
  marketingChoices: MarketingChoices;
  events: ProductionEvent[];
  results: FilmResults;
  boxOfficeRun: BoxOfficeRun;
  /** Studio.totalDays at the moment this film was released - see engine/calendar.ts:formatGameDate. */
  releasedOnDay: number;
  // Which rival studio made this, if any - absent means it's the player's
  // own (see Studio.rivalFilmsReleased below and docs/DESIGN.md 5.24). Kept
  // as a plain name rather than an id lookup since a rival studio's own
  // record never needs to change after the fact.
  releasedBy?: string;
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
  /** Studio.totalDays threshold - once reached, this studio attempts a new production if it has spare capacity (see engine/rivalStudios.ts). */
  nextSpawnCheckDay: number;
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
  talent: Talent[];
  productionChoices: ProductionChoices;
  postProductionChoices: PostProductionChoices;
  marketingChoices: MarketingChoices;
  targetAudience: TargetAudience;
  releaseDay: number;
}

export interface Studio {
  name: string;
  cash: number;
  reputation: number; // 0-100
  /** Days elapsed since the studio's first day (day 1) - the single source of truth for the in-game calendar, see engine/calendar.ts. */
  totalDays: number;
  filmsReleased: Film[];
  /** The whole hireable roster, generated once at game start - see state/gameState.ts:createInitialStudio. */
  talentPool: Record<TalentRole, Talent[]>;
  /** A small persistent roster of AI competitors, generated once at game start alongside the player's own studio - see docs/DESIGN.md 5.24. */
  rivalStudios: RivalStudio[];
  rivalProductionsInProgress: RivalProductionInProgress[];
  /** Parallel to filmsReleased, but never touches the player's own cash/reputation - purely for the market (Top 10 chart, talent contention history). */
  rivalFilmsReleased: Film[];
}

// The film currently being built in the wizard; fields fill in progressively.
export interface FilmDraft {
  title: string;
  genre: Genre | null;
  targetAudience: TargetAudience | null;
  scriptOptions: Script[];
  script: Script | null;
  talent: Talent[];
  /** The price the player is currently targeting for each role - filters studio.talentPool down to who's shown. */
  talentTargetPriceByRole: Partial<Record<TalentRole, number>>;
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

export type WizardStep =
  | 'develop'
  | 'talent'
  | 'production-planning'
  | 'production'
  | 'post-production'
  | 'marketing'
  | 'results';

export type Screen = 'dashboard' | WizardStep | 'rival-studio';
