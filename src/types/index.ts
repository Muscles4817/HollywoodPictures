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
  | 'VFX Supervisor'
  | 'Casting Director';

export type ProductionRole =
  | 'Director'
  | 'Lead Actor'
  | 'Supporting Actor'
  | 'Writer'
  | 'Cinematographer'
  | 'Composer'
  | 'Editor'
  | 'VFX Supervisor'
  | 'Casting Director';

// Producer (docs/DESIGN_REVIEW_production_office.md) is deliberately NOT a
// TalentProfession or a ProductionRole: producers are employed at the studio
// level and attached on the Producer Workspace, never cast via the Hire
// Talent wizard. Keeping them out of those unions keeps them out of the
// profession-keyed talentPool (Record<TalentProfession, Person[]>) and every
// casting flow by construction rather than by filtering. `primaryRole` is
// widened to carry the label for display/categorisation only - nothing
// indexes a Record<TalentProfession, ...> by it or switches exhaustively on
// it (verified at introduction), so widening it is safe.
export type PersonPrimaryRole = TalentProfession | 'Producer';

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

// What gender a written Character calls for when casting - distinct from a
// real Person's own Gender above. 'Any' is a genuinely open role that any
// actor can play (many villains, mentors, ensemble parts), not a fourth
// gender. A Character with no castingGender at all (older saves, scripts
// authored before this field existed) is read as 'Any' everywhere, so the
// constraint is strictly additive and never retroactively blocks an
// existing cast. See engine/casting.ts:actorMeetsCharacterGender for the
// single match rule every consumer shares.
export type CastingGender = 'Male' | 'Female' | 'Any';

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
  // Optional, not required - deviates from the redesign doc's non-optional
  // fields. Now populated for everyone: the handcrafted, real-named roster
  // (data/handcraftedTalents.ts) carries real, hand-entered public data
  // (each real person's actual gender and birth year, re-expressed relative
  // to GameState.totalDays' own Year-1-is-day-1 origin - see GameDate's own
  // comment above), and every procedurally generated person gets a rolled
  // gender/dateOfBirth (engine/talentGenerator.ts). Stays optional on the
  // type regardless - not every consumer of this shape (an older save, a
  // future migration) is guaranteed to carry it.
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

// A producer's specialty - which single engine system their boost pulls.
// Chosen so all four are non-overlapping (each hits a different system), so
// a producing team's boosts add up honestly (docs/DESIGN_REVIEW_production_office.md §4/§7):
//   Line      -> production budget cost   (engine/cost.ts)
//   Creative  -> a craft sub-score        (engine/scoring.ts)
//   Executive -> marketing efficiency/Buzz (box-office chain)
//   Fixer     -> on-set event impact       (data/productionEvents.ts)
export type ProducerSpecialty = 'Line' | 'Creative' | 'Executive' | 'Fixer';

// A Producer career on the shared Person - the base layers (identity,
// personality.ego, reputation.fame/reliability, traits, availability) are
// reused from Person; only these fields are producer-specific. Deliberately a
// standalone shape rather than extending RoleCareerCommon<'Producer'>, since
// that common shape is bound to TalentProfession (which producers are not -
// see PersonPrimaryRole above) and carries cast/crew concepts producers don't
// use. The per-film fee is `typicalSalary`; the one-time hiring fee derives as
// a multiple of it (engine/producers.ts), so it isn't stored.
export interface ProducerCareer {
  specialty: ProducerSpecialty;
  skill: number; // 1-100, scales the boost magnitude via lerp (engine/producers.ts)
  genreAffinity: Genre[]; // genres where this producer's boost is amplified (amplify-only, never a penalty)
  typicalSalary: Money; // the per-film fee
}

export interface PersonCareers {
  actor?: ActorCareer;
  director?: DirectorCareer;
  writer?: CrewCareer<'Writer'>;
  cinematographer?: CrewCareer<'Cinematographer'>;
  composer?: CrewCareer<'Composer'>;
  editor?: CrewCareer<'Editor'>;
  vfxSupervisor?: CrewCareer<'VFX Supervisor'>;
  /** Casting Redesign, Phase D (docs/DESIGN_REVIEW_casting_redesign.md section 11) - optional, same "doesn't block Greenlight, materially improves an existing mechanic when present" shape as vfxSupervisor above. Biases engine/castingCalls.ts:generateCastingApplicants's volume/curation and unlocks a small "discovery" chance. */
  castingDirector?: CrewCareer<'Casting Director'>;
  /** Production Office (docs/DESIGN_REVIEW_production_office.md) - present on producer-Persons only; never cast via the wizard, attached on the Producer Workspace instead. */
  producer?: ProducerCareer;
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
  primaryRole: PersonPrimaryRole;
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
// production requirements from a Modern one). Character and Setting
// Foundations milestone: replaces the old, much coarser five-value Setting
// ('Modern'/'Historical'/'Fantasy'/'SciFi'/'Space') with a richer, more
// legible archetype - the old values were really "which broad reality does
// this story occupy," not "what does the shoot actually look like" (a
// Modern-setting film could be a Contemporary City chase or a Single
// Interior Location two-hander, with very different production needs). See
// data/settings.ts:SettingProfile for the production-pressure profile each
// archetype carries.
export type SettingArchetype =
  | 'ContemporaryCity'
  | 'SmallTown'
  | 'SuburbanCommunity'
  | 'RuralWilderness'
  | 'SingleInteriorLocation'
  | 'HauntedLocation'
  | 'SchoolOrUniversity'
  | 'Workplace'
  | 'HistoricalCity'
  | 'HistoricalBattlefield'
  | 'MedievalKingdom'
  | 'FantasyRealm'
  | 'ModernWarzone'
  | 'FuturisticCity'
  | 'SpacecraftOrStation'
  | 'AlienWorld'
  | 'PostApocalypticWasteland'
  | 'UnderwaterEnvironment'
  | 'GlobalMultiLocation'
  | 'Other';

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

// --- Script Characters (Character and Setting Foundations milestone) -----
//
// Script-local value objects, not persistent world-level entities yet - see
// docs/CHARACTER_AND_SETTING_FOUNDATIONS.md. They live and travel entirely
// inside their own Script (Opportunity -> Asset -> Project -> Film all just
// carry the Script wholesale already, so no separate copy-through logic is
// needed), and their own `id` is only ever unique *within* that Script, not
// globally - a future IP-promotion system may later lift a specific
// ScriptCharacter/setting out into a persistent, globally-identified entity,
// but nothing here assumes that will happen.

export type CharacterProminence = 'Lead' | 'Supporting' | 'Minor';

export type CharacterArchetype =
  | 'ReluctantHero'
  | 'IdealisticHero'
  | 'Antihero'
  | 'ChosenOne'
  | 'Outsider'
  | 'Detective'
  | 'Survivor'
  | 'Mentor'
  | 'Rival'
  | 'Villain'
  | 'TragicVillain'
  | 'AuthorityFigure'
  | 'LoveInterest'
  | 'ComicRelief'
  | 'BestFriend'
  | 'FamilyMember'
  | 'EnsembleMember'
  | 'MonsterOrCreature'
  | 'Other';

// What this role demands from whoever plays it, and what kind of audience
// potential the character itself has - not actor stats (see ActorCareer/
// ActingStyle). Deliberately the same 1-100 scale ActingStyle already uses
// for the five dimensions they overlap on (transformationDemand vs.
// characterTransformation, etc. - see engine/compatibility.ts:
// computeCharacterCompatibility) so they're directly comparable without a
// conversion step; the remaining four (dramaticDepth, audienceAccessibility,
// distinctiveness, merchandisePotential) have no actor-stat equivalent and
// deliberately don't map to casting compatibility yet (see
// engine/commercialProfile.ts for where distinctiveness/accessibility do
// feed in, modestly, and CHARACTER_AND_SETTING_FOUNDATIONS.md section 7 for
// why merchandisePotential stays inert until a future IP system consumes it).
export interface CharacterTraitProfile {
  dramaticDepth: number; // 1-100
  charismaDemand: number; // 1-100
  comedyDemand: number; // 1-100
  emotionalDemand: number; // 1-100
  physicalDemand: number; // 1-100
  transformationDemand: number; // 1-100
  audienceAccessibility: number; // 1-100
  distinctiveness: number; // 1-100
  merchandisePotential: number; // 1-100 - stored for a future IP system, no direct effect yet
}

export interface ScriptCharacter {
  /** Stable only within this Script - see this section's own header comment on why these aren't globally identified yet. */
  id: string;
  name: string;
  archetype: CharacterArchetype;
  prominence: CharacterProminence;
  /**
   * Which gender this role is written for. Enforced when casting: only an
   * actor whose own identity.gender matches can be hired into the slot (see
   * engine/casting.ts). Optional so older saved scripts and any code that
   * builds a Character without it keep working - absent is read as 'Any',
   * i.e. no constraint.
   */
  castingGender?: CastingGender;
  traits: CharacterTraitProfile;
}

export interface Script {
  id: string;
  title: string;
  genre: Genre;
  archetype: ScriptArchetype;
  storyType: StoryType;
  primarySetting: SettingArchetype;
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
  // Exactly requiredLeads Lead-prominence characters followed by exactly
  // requiredSupporting Supporting-prominence ones (plus, occasionally, a
  // handful of Minor ones) - see ScriptCharacter's own header comment.
  // Casting evaluates a specific hired actor against the character at the
  // same position within this array as their hire is within their own role
  // group (engine/castRequirements.ts:characterForRoleSlot), not against the
  // script as one undifferentiated whole.
  cast: ScriptCharacter[];
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
export type FinalCutFocus = 'Trailer-focused' | 'Critic-focused' | 'Star-focused' | 'Mystery-focused';

// Post-Production Redesign, Phase B (docs/DESIGN_REVIEW_post_production_redesign.md
// section 2) - the old TestScreeningResponse dropdown ('Ignore'/'Minor
// Changes'/'Major Changes', picked blind, before any screening happened) is
// retired. A real test screening now happens - see
// FilmDraft.testScreeningPendingChoice/testScreeningResolved below - and its
// resolved quality/buzz outcome reaches the final film the same way an
// on-set event already does (folded into PhotographyState.events, read by
// engine/scoring.ts:computeQualityBreakdown's existing eventsQualityDelta
// term), not through a PostProductionChoices field at all.
export interface PostProductionChoices {
  editStyle: EditStyle;
  musicFocus: MusicFocus;
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

// --- Marketing campaign channels & angle (docs/DESIGN_REVIEW_marketing_campaign.md) ---
// Introduced ahead of the MarketingChoices reshape (increment 2) so the pure
// engine (engine/marketing.ts) and its tunables can land additively first,
// without yet touching the live marketingSpend field or its consumers.
export type MarketingChannel = 'trailers' | 'tv' | 'digital' | 'press';
export type CampaignAngle = 'spectacle' | 'story' | 'mystery' | 'starPower' | 'faithful';

export interface MarketingChoices {
  // A continuous currency amount, not a fixed tier - what a given level of
  // exposure costs doesn't change based on how cheap or expensive the film
  // itself was (see data/release.ts:MARKETING_SPEND_RANGE). Flat, absolute
  // cost is what makes the top of the range naturally unreachable for a
  // small studio, rather than needing an artificial rule to lock it out.
  //
  // The *total* marketing budget. Still the canonical figure the cost, rival
  // generation, and release-crowding systems read. For the player, once a
  // campaign is built (channelSpend below), the UI keeps this equal to the sum
  // of the channels; rivals set it directly and leave channelSpend/campaignAngle
  // unset (they campaign on a single spend - engine/rivalStudios.ts).
  marketingSpend: number;
  releaseType: ReleaseType;
  releaseWindow: ReleaseWindow;
  /**
   * How a Wide release reaches theaters (engine/distribution.ts): 'self'
   * (self-distributed, requires an owned Distribution Arm) or 'rented' (a
   * major's distribution, always available but takes a cut). Only meaningful
   * for Wide; absent means the default for the studio's capability. The
   * `distributionBreadth`/`distributionKeepShare` below are the resolved deal
   * terms, frozen onto the film at SCHEDULE_RELEASE so the later settlement
   * (engine/marketSettlement.ts) reads exactly what was agreed at scheduling.
   */
  distributionMethod?: 'self' | 'rented';
  /** Frozen Wide availability ceiling for this release's deal (before releaseStrength scaling); absent for non-Wide. */
  distributionBreadth?: number;
  /** Frozen *domestic* studio keep share for this deal; absent = the default DOMESTIC_KEEP_SHARE. A rented Wide takes a cut of this half only. */
  distributionKeepShare?: number;
  /**
   * Frozen international distribution reach for this release (engine/distribution.ts),
   * 0..1 - how much of the film's overseas box office the studio realises. Frozen
   * at SCHEDULE_RELEASE from the studio's International Distribution tier so a later
   * upgrade never retroactively lifts a film already in cinemas. Absent = 0 (the
   * hard gate: domestic only).
   */
  internationalReachFraction?: number;
  /**
   * How the budget is split across channels (docs/DESIGN_REVIEW_marketing_campaign.md).
   * Optional: absent on rival films and on saves predating the campaign
   * overhaul, in which case the awareness/Buzz pipeline falls back to the flat
   * `marketingSpend`. When present, an audience-weighted effective reach
   * (engine/marketing.ts) drives awareness instead.
   */
  channelSpend?: Record<MarketingChannel, number>;
  /**
   * What the campaign sells (docs/DESIGN_REVIEW_marketing_campaign.md). Optional
   * for the same reason as channelSpend; absent (or `faithful`) means no
   * opening boost and no legs risk.
   */
  campaignAngle?: CampaignAngle;
  /**
   * Cast (and/or director) sent on a press tour (docs/DESIGN_REVIEW_marketing_campaign.md,
   * "press tours"), by PersonId - a subset of the film's assigned talent. Each
   * tourer trades fame (pre-release Buzz upside) against their own media risk
   * (a discount that can flip a famous loose cannon net-negative) and a
   * fame-scaled cash cost. Optional/absent - rivals and pre-tour saves simply
   * don't tour, so Buzz and cost are unchanged (engine/pressTour.ts reads it
   * defensively as none).
   */
  pressTourCast?: PersonId[];
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

// --- Awards Season (docs/DESIGN_REVIEW_awards_season.md) --------------------
// The flagship Academy Awards. Categories map onto the roles the sim tracks;
// acting is gender-split. Scoring/eligibility live in engine/awards.ts.

/** The tentpole shows resolved each awards season, earliest ceremony first. The Academy Awards is the flagship the precursors build momentum toward. */
export type AwardShowId = 'golden-globes' | 'sag' | 'bafta' | 'academy';

export type AwardCategory =
  | 'best-picture'
  | 'best-director'
  | 'best-screenplay'
  | 'best-actor'
  | 'best-actress'
  | 'best-supporting-actor'
  | 'best-supporting-actress'
  | 'best-cinematography'
  | 'best-film-editing'
  | 'best-original-score'
  | 'best-visual-effects'
  // Golden Globes split Best Picture and lead acting into Drama vs
  // Musical/Comedy. These only ever appear on a Globes ceremony; momentum and
  // payoffs fold them back onto their unsplit Academy equivalents.
  | 'best-picture-drama'
  | 'best-picture-comedy'
  | 'best-actor-drama'
  | 'best-actor-comedy'
  | 'best-actress-drama'
  | 'best-actress-comedy';

export interface AwardNomination {
  filmId: string;
  /** The nominated person, for person categories (director, acting, the crafts); absent for Best Picture. */
  personId?: PersonId;
  /** The resolved award score, kept for display/ordering. */
  awardScore: number;
  won: boolean;
}

/** A resolved ceremony - one show's results for one year, stored permanently in studio history. */
export interface AwardsCeremony {
  /** Which show this was (Globes, SAG, BAFTA, Academy). */
  show: AwardShowId;
  /** The 1-indexed calendar year honoured (films released in this year). */
  year: number;
  /** GameState.totalDays the ceremony resolved on. */
  ceremonyDay: number;
  /** Only the categories this show actually awards are present. */
  categories: Partial<Record<AwardCategory, AwardNomination[]>>;
}

/** An open awards season between the year boundary (when it opens) and its final ceremony - the campaign phase, spanning every show. */
export interface AwardsSeasonInProgress {
  /** The 1-indexed year being honoured (the year just completed). */
  year: number;
  /** Every eligible film's id (player and rival) - the field every ceremony resolves over. */
  eligibleFilmIds: string[];
  /** Player film id -> campaign cash committed so far. Extensible to per-category/talent later. */
  campaignByFilm: Record<string, number>;
  /** Shows not yet resolved this season, in chronological order. Shrinks as each ceremony lands; the season closes when empty. */
  pendingShows: AwardShowId[];
  /** GameState.totalDays each show resolves on. */
  ceremonyDayByShow: Record<AwardShowId, number>;
  /** Accumulated precursor momentum, keyed `${oscarCategory}|${filmId}|${personId}` - raises a contender's odds at every later ceremony (engine/awards.ts). */
  momentum: Record<string, number>;
}

/** All awards state on the studio's world - resolved history, the open season (if any), and when the next opens. */
export interface AwardsState {
  history: AwardsCeremony[];
  season: AwardsSeasonInProgress | null;
  /** GameState.totalDays the next season opens on (a year boundary). */
  nextSeasonDay: number;
}

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
  /**
   * The studio's *domestic* box-office keep share for this film
   * (engine/boxOfficeRun.ts). Absent means the default DOMESTIC_KEEP_SHARE; a Wide
   * release distributed by a rented major keeps less - the distributor's fee off
   * the top (engine/distribution.ts). Frozen at release from the distribution deal.
   */
  distributionKeepShare?: number;
  /** Frozen international distribution reach for this film (0..1), copied from marketingChoices at release. Absent = 0 (domestic only). Box-office settlement reads this, never the studio's live tier. */
  internationalReachFraction?: number;
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
  // Individually-rated critic/audience quotes (engine/reviews.ts:pickScoredReviews)
  // for the Premiere Reveal (components/wizard/PremiereReveal.tsx) - distinct
  // from reviewBlurbs above (that shared-pool, ungraded flavor text keeps
  // serving the historical dossier, FilmDetailModal.tsx, unchanged). Optional
  // rather than always-populated, same "new field on an existing persisted
  // type, no migration pass" convention as producerPool/bidNotifications/
  // awards elsewhere on this type - every newly-computed result has them,
  // but a save from before this field existed won't.
  criticReviews?: ReviewQuote[];
  audienceReviews?: ReviewQuote[];
}

/** One individually-rated review quote - engine/reviews.ts:pickScoredReviews. */
export interface ReviewQuote {
  text: string;
  score: number; // 0-100
}

/** One settled week of a film's theatrical run - see BoxOfficeRun. */
export interface BoxOfficeWeek {
  week: number; // 1-indexed; week 1 is always exactly FilmResults.openingWeekend
  gross: number; // headline (reported) gross this week = domesticGross + internationalGross
  /** This week's domestic (home-market) gross. Optional only for weeks settled before the split existed; new weeks always set it. */
  domesticGross?: number;
  /** This week's realised international gross (0 when the studio has no international distribution). See domesticGross. */
  internationalGross?: number;
  /**
   * The `competitivePressure` this week's transition was actually settled
   * with (engine/boxOfficeRun.ts:advanceEarliestDueFilmByOneWeek,
   * engine/audienceSimulationStep.ts:WeekDiagnostics) - historical fact
   * about what every *other* concurrently-running film was doing that week,
   * not something derivable later from this film's own stored data alone
   * (unlike word-of-mouth activity, which genuinely can be re-derived from
   * a film's own history - see engine/audienceSimulation.ts's own "derived,
   * not stored" reasoning). Optional/absent on weeks settled before this
   * field existed - no migration pass (see state/persistence.ts) -
   * components/dev/OutcomeInspector.tsx reads it defensively.
   */
  competitivePressure?: number;
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
  /** Producers attached to this film, by PersonId (docs/DESIGN_REVIEW_production_office.md). Optional/absent on saves predating the Production Office; read as `[]`. */
  attachedProducerIds?: PersonId[];
  productionChoices: ProductionChoices;
  postProductionChoices: PostProductionChoices;
  marketingChoices: MarketingChoices;
  events: ProductionEvent[];
  // Architecture cleanup (post-Phase-B post-production redesign) - the
  // resolved test-screening outcome, carried over from
  // FilmDraft.postProductionEvents at release, kept separate from `events`
  // (on-set only) for the same reason it's separate on FilmDraft - see that
  // field's own doc comment.
  postProductionEvents: ProductionEvent[];
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

// --- Intellectual Property (first IP-layer milestone) --------------------
//
// A persistent creative asset the studio *deliberately* promotes a released
// Film into (never automatically - most Films stay ordinary catalogue Films
// indefinitely). An IP is built around recognisable Characters and a Setting
// lifted out of the source Film as persistent, globally-identified components,
// and it *references* the Films it's drawn from by id - it never contains,
// copies, replaces, or wraps the Film itself. The Film is unchanged and lives
// on in the catalogue exactly as before; the IP just points at it. A Film
// already preserves everything needed to evaluate it as source material (its
// whole Script - cast + primarySetting - plus results/box office), so nothing
// has to be added to Film for this.
//
// Future work (sequels, spin-offs, reboots, merchandise, licensing, actor
// continuity, IP-driven box-office bonuses) will reference an IntellectualProperty
// - none of it exists yet, and this milestone deliberately doesn't build for it
// beyond the reference-not-contain shape below.

/**
 * A character's evolving standing as IP - the part that changes over a
 * franchise's life, kept separate from the immutable creative identity below.
 * Only *initialised* at promotion (from the source film's historical reach);
 * nothing evolves it yet (returning-character selection, franchise history,
 * merchandise and decay are all deliberately future work).
 */
export interface IpCharacterStanding {
  /** How known this character is to audiences, 0-100 - seeded from the source film's reach at promotion. */
  recognition: number;
  /** How much audiences actively like/want more of this character, 0-100 - seeded from the character's own appeal and the film's reach. */
  popularity: number;
}

/**
 * A Character lifted out of a source Film into a persistent, globally-identified
 * IP component. Its *creative identity* (archetype + trait profile, plus the
 * name/prominence it was written with) is an immutable snapshot from the source
 * script and never changes; its `standing` is the separate, evolving part.
 * `sourceCharacterId`/`sourceFilmId` are provenance references.
 */
export interface IpCharacter {
  /** Globally unique and persistent - distinct from the script-local ScriptCharacter.id it was promoted from (which is only unique within its own Script). */
  id: string;
  sourceFilmId: string;
  sourceCharacterId: string;
  // --- Immutable creative identity (snapshot of the source ScriptCharacter) ---
  name: string;
  prominence: CharacterProminence;
  castingGender?: CastingGender;
  archetype: CharacterArchetype;
  traits: CharacterTraitProfile;
  // --- Evolving standing (initialised at promotion; no evolution mechanic yet) ---
  standing: IpCharacterStanding;
}

/** The Setting lifted from a source Film's primarySetting into a persistent, globally-identified IP component. */
export interface IpSetting {
  id: string;
  sourceFilmId: string;
  archetype: SettingArchetype;
}

export interface IntellectualProperty {
  /** Globally unique and persistent. */
  id: string;
  /** Player-facing name - defaults to the source Film's title at promotion, editable there. */
  name: string;
  /** GameState.totalDays the IP was promoted on. */
  createdOnDay: GameDay;
  /** The Film this IP was first promoted from - a reference, never a copy. */
  sourceFilmId: string;
  /** Every Film that is part of this IP. Just [sourceFilmId] for now; a future sequel/spin-off would append its own Film id here. References only - the Films live in GameState.projects, never duplicated here. */
  filmIds: string[];
  /** The Characters the player chose to lift into this IP as persistent components. */
  characters: IpCharacter[];
  /** The Setting lifted from the source Film's primarySetting. */
  setting: IpSetting;
  /**
   * Audience awareness the IP starts with, 0-100 - inherited at promotion from
   * the source Film's own historical reach (audience response, buzz, box
   * office). Recognition doesn't exist independently before an IP does: the
   * Film owns its historical success, and the IP inherits it once established.
   * Not evolved yet (no sequels/decay this milestone).
   */
  recognition: number;
  /** Critical standing the IP starts with, 0-100 - inherited at promotion from the source Film's critical/quality reception. */
  prestige: number;
}

// --- IP Viability Assessment (the "is this worth a franchise?" decision layer) --
//
// A read-only producer's-eye analysis of a released Film as long-term franchise
// material (engine/ipViability.ts:evaluateIpViability). It never creates or
// mutates an IP - it just inspects the Film (which never changes) and the
// current world, and explains how viable another entry would be. Runs against
// any released player Film whether or not an IP exists, so the player can decide
// *whether* to promote before they do. Deliberately reusable: a future Franchise
// Development Office, AI studio decisions, and a "Develop Follow-Up" flow will
// all read the same assessment.

/** One important character's standalone franchise potential, judged individually (never just averaged into the whole) so genuine breakouts are visible. */
export interface IpCharacterViability {
  /** The script-local ScriptCharacter.id this judges. */
  characterId: string;
  name: string;
  prominence: CharacterProminence;
  /** Standalone franchise potential, 0-100. */
  potential: number;
  /** Whether this character could plausibly carry or recur across future entries (a Lead who anchors sequels, a memorable antagonist), rather than being scenery. */
  breakout: boolean;
  /** A one-line, input-derived read on this character specifically. */
  note: string;
}

export interface IpViabilityAssessment {
  /** Headline 0-100 summary. */
  overallScore: number;
  /** A short verdict label derived from overallScore (e.g. "Strong Franchise Candidate"). */
  verdict: string;

  // The two deliberately-separate halves - a film can be high on one and low on
  // the other (great material, bad timing; thin material, hot commercial moment).
  /** Mostly-static: is this fundamentally franchise material (characters, setting, story room)? 0-100. */
  inherentPotential: number;
  /** Dynamic: is *now* a good moment to exploit it (awareness, genre heat, affordability, talent availability)? 0-100. */
  currentOpportunity: number;

  /** Aggregate character strength, weighted toward the best/breakouts rather than a flat mean. 0-100. */
  characterPotential: number;
  /** Whether the setting supports further stories, 0-100. */
  settingPotential: number;

  /** How much commercial goodwill (audience response, box office) carries into another entry. 0-100. */
  commercialCarryover: number;
  /** How much critical standing carries over. 0-100. */
  prestigeCarryover: number;

  /** How expensive/risky another production would be, 0-100 (higher = riskier). */
  costRisk: number;

  /** Per-character breakdown, most promising first. */
  characters: IpCharacterViability[];

  /** Plain-language, input-derived positives (already ordered, capped). */
  strengths: string[];
  /** Plain-language, input-derived reservations (already ordered, capped). */
  concerns: string[];
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
 * A persistent notification about the player's own bidding activity on the
 * Opportunity Market (engine/bidNotifications.ts) - a small, stored "inbox
 * email" store on GameState. Unlike the project-derived Inbox categories
 * (engine/project.ts:deriveInboxItems), these can't be recomputed from
 * current state: the moment a bid resolves the opportunity leaves the pool,
 * so the outcome ("you won", "you were outbid") has to be recorded when it
 * happens. Drives the Inbox's "Bid updates" section, the header badge, and
 * the auto-pause / resume-guard on the real-time clock (App.tsx).
 */
export type BidNotificationKind = 'outbid' | 'won' | 'lost';

export interface BidNotification {
  id: string;
  kind: BidNotificationKind;
  /** The Opportunity this is about - lets the Inbox check whether it's still live (and so whether "Raise your bid" is still possible) for an 'outbid'. */
  opportunityId: string;
  scriptTitle: string;
  /** The relevant figure in £: the player's own winning bid ('won'), or the rival bid that beat/overtook them ('lost'/'outbid'). */
  amount: number;
  /** Who overtook or beat the player - present on 'outbid'/'lost', absent on 'won'. */
  rivalName?: string;
  /** GameState.totalDays this event happened on. */
  day: number;
  read: boolean;
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
  /** Persistent creative assets the studio has deliberately promoted a released Film into (see IntellectualProperty). Empty until the player promotes their first Film; never populated automatically. References Films by id - it doesn't contain them. */
  intellectualProperties: IntellectualProperty[];
  /**
   * The Production Office facility (docs/DESIGN_REVIEW_production_office.md).
   * `null`/absent means not yet unlocked (the initial state, and every save
   * predating this feature - read defensively, there is no migration pass,
   * see state/persistence.ts). The object's presence == unlocked; `tier`
   * governs bench capacity (data/producers.ts:OFFICE_BENCH_CAPACITY_BY_TIER).
   * Hired producers are referenced by id; the Person records live in
   * GameState.producerPool, never duplicated here.
   */
  productionOffice?: ProductionOffice | null;
  /**
   * The Distribution Arm facility (the studio's own theatrical distribution
   * operation). `null`/absent means not yet unlocked - a studio without one
   * can't self-distribute a Wide release (it must rent a major's distribution
   * at a cut) - see engine/distribution.ts. Same unlock-milestone + tiered
   * shape as productionOffice above; read defensively (no migration pass).
   */
  distributionArm?: DistributionArm | null;
}

export interface DistributionArm {
  tier: number; // 1..DISTRIBUTION_ARM_MAX_TIER - governs the Wide-release screen ceiling self-distribution can command
  /**
   * International Distribution track, 0..INTERNATIONAL_DISTRIBUTION_MAX_TIER
   * (engine/distribution.ts) - an independent upgrade track on the arm, like the
   * Production Office's marketResearchTier. Governs how much of a film's overseas
   * box office the studio can realise. Absent/0 = no international distribution =
   * the hard gate (domestic box office only).
   */
  internationalTier?: number;
}

export interface ProductionOffice {
  tier: number; // 1..OFFICE_MAX_TIER
  /** Hired producers, by PersonId - the Persons themselves live in GameState.producerPool. */
  benchProducerIds: PersonId[];
  /**
   * Market Research department level, 0..MARKET_RESEARCH_MAX_TIER
   * (docs/DESIGN_REVIEW_marketing_campaign.md, tracking-as-a-service). A
   * separate upgrade track from `tier` (which governs the producer bench) -
   * bought and upgraded independently. Absent/0 means no research purchased:
   * the film's Projected Opening readout still shows, but as the widest
   * (baseline) band; each level tightens it toward the true number. Optional,
   * read defensively as 0 (older offices/saves predate it, no migration pass).
   */
  marketResearchTier?: number;
}

export interface TalentAssignment {
  role: ProductionRole;
  person: Person;
  // Which specific ScriptCharacter this actor plays (ScriptCharacter.id).
  // Present for Lead/Supporting Actor hires; absent for crew (no character)
  // and for legacy/rival assignments that predate slot binding - readers fall
  // back to the positional characterForRoleSlot mapping when it's absent (see
  // docs/DESIGN_REVIEW_casting_slot_binding.md). Making the actor<->character
  // link explicit is what lets a player cast characters in any order and
  // recast one without disturbing the others.
  characterId?: string;
}

// --- Casting Redesign, Phase B (docs/DESIGN_REVIEW_casting_redesign.md
// sections 1-2) - Open Casting: a persistent, per-Character call that
// accumulates applicants over real calendar time instead of the whole
// Actor talent pool being instantly browsable. Deliberately no fixed
// duration (see the design review's own pushback on that) - a call just
// stays open, ticking weekly, until the role is cast or the player stops
// checking it.

/** How a specific applicant found their way to this call - a per-applicant field (not per-call - Phase D's Interested Talent means one call can host both organic and inbound applicants side by side) so a later search-method addition (Agency Outreach, Personal Network, ...) is a variant addition, not a redesign (design review section 10). */
export type CastingChannel = 'OpenCasting' | 'InterestedTalent';

/** A specific Person who has applied - who, when, and how they found this call. Suitability/Interest/salary read/Availability are always derived fresh from `person` + the live script/studio/draft state (engine/castingAppeal.ts), never frozen here - only *who showed up, when, and via which channel* needs remembering. */
export interface CastingApplicant {
  person: Person;
  appliedOnDay: GameDay;
  channel: CastingChannel;
}

export interface CastingCall {
  id: string;
  /** ScriptCharacter.id - one call per Character, not per role slot. */
  characterId: string;
  role: 'Lead Actor' | 'Supporting Actor';
  openedOnDay: GameDay;
  /** Mirrors engine/opportunities.ts's own nextGenerationCheckDay pattern - the next weekly beat a fresh batch of applicants is due. */
  nextApplicantCheckDay: GameDay;
  applicants: CastingApplicant[];
  /** Casting Redesign, Phase C - how many offers (Direct Approach or an Open Casting "Cast" click) this Character has had turned down. Drives engine/castingAppeal.ts's no-softlock widening (a lower acceptance bar, a wider/less selective applicant pool) so a run of bad luck can never make a role permanently uncastable. */
  rejectionCount: number;
  /** Person ids the player has dismissed from this call's Open Casting list - removed from `applicants` and kept out of every future weekly batch (engine/castingCalls.ts:tickCastingCalls), so the list stays uncluttered. Dismissal is Open-Casting-only housekeeping, not a rejection: it never touches rejectionCount, and Direct Approach can still target a dismissed actor deliberately. */
  dismissedApplicantIds: string[];
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
  /** Producers attached to this in-progress film, by PersonId (docs/DESIGN_REVIEW_production_office.md). Charged (per-film fee) only at RELEASE_FILM, like every other production cost. Optional/absent on older drafts; read as `[]`. */
  attachedProducerIds?: PersonId[];
  /** The price the player is currently targeting for each casting slot - filters GameState.talentPool (once mapped to the underlying TalentProfession) down to who's shown. Keyed by ProductionRole, not TalentProfession, since Lead Actor and Supporting Actor need independent target prices even though both hire from the same Actor pool. */
  talentTargetPriceByRole: Partial<Record<ProductionRole, number>>;
  /** Casting Redesign, Phase B - every Open Casting call in progress for this draft's Lead/Supporting characters, at most one per Character. Empty until the player opens one; ticks weekly via engine/castingCalls.ts:tickCastingCalls. */
  castingCalls: CastingCall[];
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
  // Post-Production Redesign, Phase A/B (docs/DESIGN_REVIEW_post_production_redesign.md
  // sections 1-2). Renamed from Phase A's postProductionEstimatedCompletionDay
  // once Phase B gave it a second life: it does NOT mean "the film is ready
  // for release" - it means "the initial cut is ready for a test screening."
  // Computed once, at FINISH_PHOTOGRAPHY, from
  // engine/production.ts:computeRecommendedPostProductionDays (same
  // "estimate computed once and stored" shape PhotographyState.recommendedDays
  // already uses); null before photography finishes.
  //
  // Architecture cleanup (post-Phase-B): this field used to also get bumped
  // forward once the screening resolved, doubling as "the revised completion
  // estimate" - a single date field whose meaning silently depended on
  // whether testScreeningResolved was true. That's gone: this field is now a
  // fixed historical milestone ("when the screening happened"), set once and
  // never touched again. postProductionFinalReadyDay below is the separate,
  // explicit field for "when post-production as a whole wraps."
  postProductionScreeningReadyDay: GameDay | null;
  // Architecture cleanup (post-Phase-B) - the explicit final-readiness date
  // postProductionScreeningReadyDay used to double as after the screening
  // resolved. Null until RESOLVE_TEST_SCREENING_CHOICE sets it: Release
  // As-Is sets it to postProductionScreeningReadyDay with no additional
  // delay; Re-edit/Pickups/Major Reshoots set it to
  // postProductionScreeningReadyDay plus their resolved delayDaysDelta.
  // Future release-readiness checks (Phase C) should read this field, not
  // postProductionScreeningReadyDay, for "is post-production actually done."
  // Set the moment the player locks a cut (RESOLVE_TEST_SCREENING_CHOICE's
  // accept/revert branches) to the day they locked it - by then every editing
  // round's delay has already ticked away in real time (see
  // postProductionEditingUntilDay), so there's no further wait to add.
  postProductionFinalReadyDay: GameDay | null;
  // Post-Production Redesign, Phase C (iterative test screenings) - when the
  // player picks an editing option (Re-edit/Pickups/Major Reshoots) at a
  // screening, the recut takes real time: this is the day it finishes and the
  // next test screening surfaces (RESOLVE_TEST_SCREENING_CHOICE sets it to
  // totalDays + the rolled delay; the ADVANCE_DAY tick generates the follow-up
  // screening once totalDays reaches it, then clears it back to null). Null
  // whenever no recut is underway - before the first screening, while a
  // screening decision is pending, and once a cut is finally locked.
  postProductionEditingUntilDay: GameDay | null;
  // Post-Production Redesign, Phase B (docs/DESIGN_REVIEW_post_production_redesign.md
  // section 2) - set once totalDays reaches postProductionScreeningReadyDay
  // (runCalendarSettlement, state/studioReducer.ts), the same
  // "PendingEventChoice surfaces through the calendar tick, resolved via its
  // own dedicated action" shape PhotographyState.pendingChoice already uses
  // for on-set events - reuses the identical PendingEventChoice/
  // EventChoiceTemplate types and resolveEventChoice's roll math, but
  // resolved through RESOLVE_TEST_SCREENING_CHOICE rather than
  // RESOLVE_EVENT_CHOICE (which stays hard-scoped to `photography`, since
  // this fires after photography is already 'finished' and never restarts
  // it - see engine/testScreening.ts).
  testScreeningPendingChoice: PendingEventChoice | null;
  // True once the player has locked a final cut - either accepting the cut a
  // screening presented (Release As-Is / Keep This Cut) or reverting to the
  // original (see RESOLVE_TEST_SCREENING_CHOICE). This is the explicit state
  // that ends the screening loop and lets the film be scheduled; while it's
  // false the film either has a screening decision pending, or a recut in
  // progress (postProductionEditingUntilDay set), or is still waiting for its
  // first screening. Phase C (iterative screenings) replaced Phase B's single
  // mandatory screening: a film can now go through as many editing rounds as
  // the studio can afford before this flips true.
  testScreeningResolved: boolean;
  // Architecture cleanup (post-Phase-B) - the resolved test-screening
  // outcome's own ProductionEvent (real costDelta/qualityDelta/buzzDelta/
  // delayDaysDelta from resolveEventChoice), set once at
  // RESOLVE_TEST_SCREENING_CHOICE. Deliberately NOT folded into
  // photography.events any more - that array is "what happened during the
  // shoot," and a test screening happens after photography has already
  // finished, so appending to it was a misleading reuse (it required
  // zeroing costDelta there to avoid double-charging, since this cost is
  // charged immediately rather than deferred like an on-set event's). Reuses
  // the same ProductionEvent shape - see
  // engine/scoring.ts:combineProductionEvents for how quality/buzz reads
  // still combine this with photography.events without a second scoring
  // system, and engine/releaseFilm.ts/state/selectors.ts for how its cost
  // (already charged) is reported without being charged again. Empty until the
  // first editing round resolves; one entry per round (Phase C, iterative
  // screenings - a film can be recut several times), each charged immediately
  // when its round is chosen. Reverting to the original cut empties this back
  // out (the edits are discarded; the cash already spent on them is not
  // refunded - see RESOLVE_TEST_SCREENING_CHOICE's revert branch).
  postProductionEvents: ProductionEvent[];
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
export type ProjectWorkspaceSection = 'overview' | 'cast-and-crew' | 'production' | 'producers' | 'finance';

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
  | 'projects'
  | 'awards'
  | 'talent-database'
  | 'ip-library';
