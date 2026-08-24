import type {
  CastingGender,
  CharacterAgeBand,
  CharacterArchetype,
  CharacterProminence,
  CharacterTraitProfile,
  Distribution,
  EffectsMethodKey,
  EnvironmentMethodKey,
  Genre,
  IntellectualProperty,
  IpCharacter,
  NormalizedScalar,
  ProductionRequirements,
  Script,
  ScriptCharacter,
  SettingArchetype,
  StoryType,
  TargetAudience,
  Tone,
  ToneProfile,
  WriterCreativeProfile,
} from '../types';
import { GENRE_PROFILES, GENRE_SETTING_AFFINITY, GENRE_TYPICAL_AUDIENCES } from '../data/genres';
import { uniqueTitle } from './titleGenerator';
import { TONES } from '../data/tones';
import { TARGET_AUDIENCES } from '../data/audiences';
import { SCRIPT_ARCHETYPES, SCRIPT_ARCHETYPE_PROFILES, type QualityRange } from '../data/scriptArchetypes';
import { STORY_TYPES, STORY_TYPE_PROFILES, type StoryTypeProfile } from '../data/storyTypes';
import { SETTING_ARCHETYPES, SETTING_ARCHETYPE_PROFILES, type SettingProfile } from '../data/settings';
import { CHARACTER_ARCHETYPES, CHARACTER_ARCHETYPE_PROFILES } from '../data/characterArchetypes';
import { SCRIPT_SCALES, SCRIPT_SCALE_PROFILES, type ScriptScaleProfile } from '../data/scale';
import { drawCoherentName } from './nameGenerator';
import { generatePremise } from './premiseGenerator';
import { deriveCommercialProfile, type CommercialInputs, type CommercialProfile } from './commercialProfile';
import { scriptShapedCast } from './characterDemands';
import { type RandomFn, clamp, combineWeights, hashUnit, normalizeWeights, pick, pickMany, randFloat, randInt, weightedPick } from './random';

// Script ids must be unique across the whole save's lifetime - an Asset, its
// revisions, every Project and Film that froze a snapshot, and the IP layer
// all key off them - yet must NOT be drawn from the seeded generation stream
// (drawing from `rng` here would shift every downstream seeded roll: rival
// scripts, talent, box-office scenarios). A module-level counter satisfied the
// second requirement but reset to 1 on every page reload, so a long-lived save
// could mint a fresh `script-1` that collides with an already-stored one.
// Date.now() plus a little Math.random() satisfies both - it is pure identity,
// not a replay-deterministic gameplay outcome - the same reasoning
// state/gameState.ts:generateDraftId already uses for draft ids.
export function newScriptId(): string {
  return `script-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const TONE_JITTER = 15;

// 0 flavor tones ~25% of the time (a "straight" genre film), 1 ~50%, 2 ~25%.
const FLAVOR_COUNT_WEIGHTS = [0, 1, 1, 2];
const FLAVOR_BOOST_RANGE: [number, number] = [20, 35];

/**
 * A script's tone profile starts as its genre's canonical vector plus
 * jitter, then gets 0-2 "flavor" tones boosted on top of that. This is what
 * produces real sub-genre variety - an action-comedy, an action-romance, a
 * low-budget action-revenge drama - instead of every script in a genre
 * reading as a pure, undiluted version of it. Most real films aren't just
 * their headline genre: buddy-cop action is action-comedy, most romantic
 * comedies are romance-comedy, plenty of horror leans hard into either
 * dark comedy or tragedy alongside the scares. Being "Action" doesn't mean
 * everything except spectacle has to be low.
 */
interface ToneGenerationResult {
  profile: ToneProfile;
  /**
   * Which tone(s), if any, got a flavor boost on top of the genre's
   * canonical vector - what actually produces sub-genre variety (an
   * action-comedy, a horror-comedy). Returned alongside the profile so
   * engine/premiseGenerator.ts can pick a matching synopsis bucket directly,
   * rather than re-deriving "was this flavored" from the final numbers.
   */
  flavorTones: Tone[];
}

function generateToneProfile(genre: Genre, rng: RandomFn): ToneGenerationResult {
  const canonical = GENRE_PROFILES[genre].canonicalTone;
  const profile = {} as ToneProfile;
  for (const tone of TONES) {
    profile[tone] = clamp(Math.round(canonical[tone] + randFloat(rng, -TONE_JITTER, TONE_JITTER)), 1, 100);
  }

  const flavorCount = pick(rng, FLAVOR_COUNT_WEIGHTS);
  const flavorTones = pickMany(rng, TONES, flavorCount);
  for (const tone of flavorTones) {
    profile[tone] = clamp(Math.round(profile[tone] + randFloat(rng, ...FLAVOR_BOOST_RANGE)), 1, 100);
  }

  return { profile, flavorTones };
}

// How far a Strategy/Ambition/intensity base value jitters per script, so
// two scripts with the same story type don't read identically - same role
// TONE_JITTER plays for toneProfile above, just on a 0-1 scale instead of
// 1-100.
const INTENSITY_JITTER = 0.1;
const STRATEGY_JITTER = 0.15;

function jitterIntensity(base: number, rng: RandomFn): NormalizedScalar {
  return clamp(base + randFloat(rng, -INTENSITY_JITTER, INTENSITY_JITTER), 0, 1);
}

function jitterWeight(base: number, rng: RandomFn): number {
  return Math.max(0.02, base + randFloat(rng, -STRATEGY_JITTER, STRATEGY_JITTER));
}

// Derived, not stored - see data/settings.ts:SettingProfile's own doc
// comment on why practicalBias/vfxBias/digitalEnvironmentBias aren't fields
// on the profile itself any more. Kept as small additive biases (roughly
// the same magnitude the old stored fields used to span) rather than letting
// the raw 0-1 pressure readings dominate the story type's own baseline.
function settingPracticalBias(setting: SettingProfile): number {
  return clamp(setting.setConstructionDemand * 0.3 + setting.practicalLogisticsDemand * 0.15, 0, 0.5);
}
function settingVfxBias(setting: SettingProfile): number {
  return setting.vfxEnvironmentDemand * 0.5;
}

/**
 * Step 5 of generation (docs/DESIGN.md - screenplay redesign): "production
 * requirements should emerge naturally from the screenplay rather than
 * being generated independently." Blends the chosen Story Type's own
 * baseline intensities with the chosen Production Scale's floors (an Epic
 * production needs real crowd/location work even for a story type that
 * doesn't usually call for it) and the chosen Setting Archetype's own
 * production-pressure profile (a Futuristic City and a Single Interior
 * Location pull practical/VFX/extras/location intensity very differently),
 * then lifts practical/VFX a little further by Complexity - the one quality
 * attribute that's always been about production difficulty, not craft (see
 * types/index.ts:Script.complexity).
 */
function generateProductionRequirements(
  story: StoryTypeProfile,
  scale: ScriptScaleProfile,
  setting: SettingProfile,
  complexity: number,
  rng: RandomFn,
): ProductionRequirements {
  const complexityLift = (complexity / 100) * 0.15;
  return {
    extras: jitterIntensity(Math.max(story.extras, scale.extrasFloor, setting.extrasDemand * 0.6), rng),
    locations: jitterIntensity(Math.max(story.locations, scale.locationsFloor, setting.locationComplexity * 0.7), rng),
    periodSetting: setting.periodSetting,
    vehicles: rng() < clamp(story.vehiclesLikely + setting.vehiclesLikely, 0, 1),
    animals: rng() < story.animalsLikely,
    practicalEffects: jitterIntensity(clamp(story.practicalEffects + settingPracticalBias(setting) + complexityLift, 0, 1), rng),
    vfx: jitterIntensity(clamp(story.vfx + settingVfxBias(setting) + complexityLift, 0, 1), rng),
    stunts: jitterIntensity(story.stunts, rng),
    choreography: jitterIntensity(story.choreography, rng),
    crowdWork: jitterIntensity(Math.max(story.crowdWork, scale.crowdWorkFloor), rng),
  };
}

/**
 * The screenplay's own implied effects approach - now anchored on its own
 * derived ProductionRequirements (vfx/practicalEffects/stunts) rather than a
 * flat genre-level lookup, so two Action scripts with very different Story
 * Types (a grounded Heist vs. a VFX-heavy Superhero) get genuinely different
 * effects leans instead of the same genre default.
 */
function generateEffectsStrategy(req: ProductionRequirements, rng: RandomFn): Distribution<EffectsMethodKey> {
  return normalizeWeights({
    digital: jitterWeight(Math.max(0.05, req.vfx), rng),
    practical: jitterWeight(Math.max(0.05, req.practicalEffects), rng),
  });
}

/** How demanding the script's effects vision is, independent of the practical/digital split - the stronger of vfx/practicalEffects, lifted by stunt work and script complexity. */
function generateEffectsAmbition(req: ProductionRequirements, complexity: number, rng: RandomFn): NormalizedScalar {
  const base = Math.max(req.vfx, req.practicalEffects) * 0.7 + req.stunts * 0.3;
  const complexityLift = (complexity / 100) * 0.2;
  return clamp(base * 0.8 + complexityLift + randFloat(rng, -0.1, 0.1), 0, 1);
}

/**
 * The screenplay's own implied environment approach - `req.vfx` and the
 * chosen Setting Archetype's own vfxEnvironmentDemand (a Futuristic City or
 * Alien World leans digital far more than a Contemporary City) decide how
 * much of the split goes to "digital"; `req.locations` splits what's left
 * between location and studio - a location-heavy story type (War, Sports)
 * leans location, an intimate/contained one (ComingOfAge, Mystery) leans
 * studio, and a high containedProductionAffinity setting (Single Interior
 * Location, a Spacecraft) pulls the remainder back toward studio too.
 */
function generateEnvironmentStrategy(req: ProductionRequirements, setting: SettingProfile, rng: RandomFn): Distribution<EnvironmentMethodKey> {
  const digitalBase = clamp(req.vfx * 0.5 + setting.vfxEnvironmentDemand * 0.4, 0, 1);
  const locationBase = req.locations * (1 - digitalBase) * (1 - setting.containedProductionAffinity * 0.5);
  const studioBase = Math.max(0.05, 1 - digitalBase - locationBase);
  return normalizeWeights({
    studio: jitterWeight(studioBase, rng),
    location: jitterWeight(locationBase, rng),
    digital: jitterWeight(digitalBase, rng),
  });
}

/** How demanding the script's environment vision is, independent of the studio/location/digital split - locations, extras and crowd work all add up to "how much does this world need to be built out," lifted further by the Setting Archetype's own environmentScale and by complexity. */
function generateEnvironmentAmbition(req: ProductionRequirements, setting: SettingProfile, complexity: number, rng: RandomFn): NormalizedScalar {
  const base = req.locations * 0.35 + req.extras * 0.15 + req.crowdWork * 0.2 + setting.environmentScale * 0.3;
  const complexityLift = (complexity / 100) * 0.2;
  return clamp(base * 0.8 + complexityLift + randFloat(rng, -0.1, 0.1), 0, 1);
}

// --- Script Characters (Character and Setting Foundations milestone) -----
// Genre/story-type/prominence-weighted, the same archetype-first philosophy
// the rest of generation already uses - see data/characterArchetypes.ts's
// own doc comment.

const TRAIT_JITTER = 12;

function jitterTrait(base: number, rng: RandomFn): number {
  return clamp(Math.round(base + randFloat(rng, -TRAIT_JITTER, TRAIT_JITTER)), 1, 100);
}

/** Bounded per-axis variation around an archetype's baseTraits, so two characters sharing an archetype don't read identically (data/characterArchetypes.ts). */
function generateCharacterTraits(base: CharacterTraitProfile, rng: RandomFn): CharacterTraitProfile {
  return {
    dramaticDepth: jitterTrait(base.dramaticDepth, rng),
    charismaDemand: jitterTrait(base.charismaDemand, rng),
    comedyDemand: jitterTrait(base.comedyDemand, rng),
    emotionalDemand: jitterTrait(base.emotionalDemand, rng),
    physicalDemand: jitterTrait(base.physicalDemand, rng),
    transformationDemand: jitterTrait(base.transformationDemand, rng),
    audienceAccessibility: jitterTrait(base.audienceAccessibility, rng),
    distinctiveness: jitterTrait(base.distinctiveness, rng),
    merchandisePotential: jitterTrait(base.merchandisePotential, rng),
  };
}

/** Each character archetype's own genre likelihood (default 1 for a genre it doesn't list) - see data/characterArchetypes.ts:genreAffinity. */
function characterArchetypeWeightsForGenre(genre: Genre): Partial<Record<CharacterArchetype, number>> {
  const weights: Partial<Record<CharacterArchetype, number>> = {};
  for (const archetype of CHARACTER_ARCHETYPES) weights[archetype] = CHARACTER_ARCHETYPE_PROFILES[archetype].genreAffinity[genre] ?? 1;
  return weights;
}

function characterArchetypeWeightsForStoryType(storyType: StoryType): Partial<Record<CharacterArchetype, number>> {
  const weights: Partial<Record<CharacterArchetype, number>> = {};
  for (const archetype of CHARACTER_ARCHETYPES) weights[archetype] = CHARACTER_ARCHETYPE_PROFILES[archetype].storyTypeAffinity[storyType] ?? 1;
  return weights;
}

function characterArchetypeWeightsForProminence(prominence: CharacterProminence): Partial<Record<CharacterArchetype, number>> {
  const weights: Partial<Record<CharacterArchetype, number>> = {};
  for (const archetype of CHARACTER_ARCHETYPES) weights[archetype] = CHARACTER_ARCHETYPE_PROFILES[archetype].prominenceAffinity[prominence] ?? 1;
  return weights;
}

// How often a generated Character is written as gender-open ('Any') rather
// than a specific Male/Female role, keyed by archetype - creatures, ensemble
// bodies and pure "figure" roles are the ones most naturally cast either
// way, while a LoveInterest is almost always written for a specific gender.
// Everything not listed uses DEFAULT_ANY_CHANCE. Non-'Any' roles then split
// Male/Female evenly. Tunable like every other generation constant here.
const CASTING_GENDER_ANY_CHANCE: Partial<Record<CharacterArchetype, number>> = {
  MonsterOrCreature: 0.8,
  Other: 0.65,
  EnsembleMember: 0.6,
  AuthorityFigure: 0.4,
  Villain: 0.35,
  Rival: 0.35,
  Mentor: 0.35,
  Detective: 0.3,
  LoveInterest: 0.05,
};
const DEFAULT_ANY_CHANCE = 0.18;

// Deliberately derived from the character's own (already-generated) name
// rather than a fresh rng() draw: assigning gender must NOT advance the
// shared generation stream, or every seeded sequence downstream (rival
// scripts, talent, box-office scenarios) would shift. Hashing the name gives
// stable, well-distributed, archetype-weighted genders for free - two
// distinct names almost never collide, and the same seed still reproduces
// the same slate exactly.
function castingGenderForCharacter(archetype: CharacterArchetype, name: string): CastingGender {
  if (hashUnit(`${name}|any`) < (CASTING_GENDER_ANY_CHANCE[archetype] ?? DEFAULT_ANY_CHANCE)) return 'Any';
  return hashUnit(`${name}|mf`) < 0.5 ? 'Male' : 'Female';
}

// The order the weighted age-band pick walks - stable, so the same name+
// archetype always resolves to the same band.
const AGE_BANDS: CharacterAgeBand[] = ['Child', 'Teen', 'YoungAdult', 'Adult', 'MiddleAged', 'Senior', 'Any'];

// Default relative likelihood of each band before archetype pulls it around.
// Leads/most roles skew young-to-middle adult; children and seniors are rarer;
// a healthy 'Any' share keeps most roles genuinely age-open.
const DEFAULT_AGE_WEIGHTS: Record<CharacterAgeBand, number> = {
  Child: 0.3,
  Teen: 0.8,
  YoungAdult: 3,
  Adult: 3,
  MiddleAged: 1.4,
  Senior: 0.6,
  Any: 2,
};

// Per-archetype overrides, merged over DEFAULT_AGE_WEIGHTS (only the listed
// bands change; the rest keep their default weight). The tuning surface for
// "what age does this kind of character read as" - edit here, not in logic.
const AGE_BAND_WEIGHTS_BY_ARCHETYPE: Partial<Record<CharacterArchetype, Partial<Record<CharacterAgeBand, number>>>> = {
  Mentor: { YoungAdult: 0.3, Adult: 1, MiddleAged: 3, Senior: 3 },
  AuthorityFigure: { YoungAdult: 0.4, Adult: 1.5, MiddleAged: 3, Senior: 2 },
  ChosenOne: { Child: 0.6, Teen: 2, YoungAdult: 3, MiddleAged: 0.4, Senior: 0.1 },
  IdealisticHero: { Teen: 1.2, YoungAdult: 3, MiddleAged: 0.7, Senior: 0.2 },
  LoveInterest: { Child: 0, Teen: 0.4, YoungAdult: 3, Adult: 2, Senior: 0.2, Any: 0.5 },
  ComicRelief: { YoungAdult: 2.5, Adult: 2 },
  Villain: { YoungAdult: 1, MiddleAged: 2, Senior: 1 },
  TragicVillain: { YoungAdult: 1, MiddleAged: 2, Senior: 1 },
  FamilyMember: { Child: 1.2, Teen: 1.2, Adult: 2, MiddleAged: 1.5, Senior: 1.5, Any: 2 },
  MonsterOrCreature: { Any: 6, Adult: 1, YoungAdult: 0.5, Child: 0, Teen: 0 },
  Other: { Any: 4 },
  EnsembleMember: { Any: 3 },
};

// A stable, well-distributed age band for a character - hash-derived from its
// own name exactly like castingGenderForCharacter, and for the same reason: it
// must NOT draw from the shared RandomFn stream, or every seeded sequence
// downstream would shift.
function castingAgeBandForCharacter(archetype: CharacterArchetype, name: string): CharacterAgeBand {
  const overrides = AGE_BAND_WEIGHTS_BY_ARCHETYPE[archetype] ?? {};
  const weights = AGE_BANDS.map((band) => overrides[band] ?? DEFAULT_AGE_WEIGHTS[band]);
  const total = weights.reduce((sum, w) => sum + w, 0);
  let cursor = hashUnit(`${name}|age`) * total;
  for (let i = 0; i < AGE_BANDS.length; i++) {
    cursor -= weights[i];
    if (cursor < 0) return AGE_BANDS[i];
  }
  return 'Any';
}

// `id` is derived by the caller (generateCast) from the owning script's id plus
// this character's position in the cast - so it's globally unique and stable
// across reloads (no mutable counter), while still only needing to be unique
// *within* its own Script for every consumer that reads it (see
// engine/castRequirements.ts:characterForRoleSlot, TalentAssignment.characterId).
function generateCharacter(id: string, prominence: CharacterProminence, genre: Genre, storyType: StoryType, rng: RandomFn): ScriptCharacter {
  const weights = combineWeights(CHARACTER_ARCHETYPES, [
    characterArchetypeWeightsForGenre(genre),
    characterArchetypeWeightsForStoryType(storyType),
    characterArchetypeWeightsForProminence(prominence),
  ]);
  const archetype = weightedPick(rng, CHARACTER_ARCHETYPES, weights);
  // Coherent, like a person's - a character called "Duke Suzuki" is exactly as
  // wrong as a person called that. Two draws, as this always took.
  //
  // Salted with archetype+prominence, NOT `id`: the id descends from the script
  // id, which is deliberately minted outside the seeded stream (see newScriptId),
  // so salting with it made the same seed produce different names on a second
  // call - which three determinism tests caught. Archetype and prominence are
  // both themselves drawn from this rng, so they are stable within a seeded run.
  const drawn = drawCoherentName(rng, `${archetype}|${prominence}`);
  const name = `${drawn.first} ${drawn.last}`;
  return {
    id,
    name,
    archetype,
    prominence,
    castingGender: castingGenderForCharacter(archetype, name),
    castingAgeBand: castingAgeBandForCharacter(archetype, name),
    traits: generateCharacterTraits(CHARACTER_ARCHETYPE_PROFILES[archetype].baseTraits, rng),
  };
}

// A handful of Minor characters beyond the required Lead/Supporting cast -
// pure flavor (no cast-requirement system consumes Minor characters), so
// kept light: 0 about half the time, rarely more than 2.
const MINOR_CHARACTER_COUNT_WEIGHTS = [0, 0, 0, 1, 1, 2];

/**
 * Exactly `requiredLeads` Lead characters followed by exactly
 * `requiredSupporting` Supporting ones, per types/index.ts:Script.cast's own
 * contract - engine/castRequirements.ts:characterForRoleSlot depends on this
 * ordering to map a specific hired actor to a specific character.
 */
function generateCast(scriptId: string, genre: Genre, storyType: StoryType, requiredLeads: number, requiredSupporting: number, rng: RandomFn): ScriptCharacter[] {
  const cast: ScriptCharacter[] = [];
  // `cast.length` is this character's stable within-script index at push time -
  // `${scriptId}-c<index>` is unique within the script and (since scriptId is
  // globally unique) globally, with no reload-resettable counter.
  const add = (prominence: CharacterProminence) => cast.push(generateCharacter(`${scriptId}-c${cast.length}`, prominence, genre, storyType, rng));
  for (let i = 0; i < requiredLeads; i++) add('Lead');
  for (let i = 0; i < requiredSupporting; i++) add('Supporting');
  const minorCount = pick(rng, MINOR_CHARACTER_COUNT_WEIGHTS);
  for (let i = 0; i < minorCount; i++) add('Minor');
  return cast;
}

// Mostly a single protagonist; occasionally a pair or a true ensemble lead -
// scaled by the chosen Story Type/Production Scale's own castSizeMultiplier/
// castMultiplier below (a Heist wants an ensemble, a Documentary often wants
// none at all), not a flat genre-independent table any more.
const LEAD_COUNT_WEIGHTS = [1, 1, 1, 1, 1, 2, 2, 2, 3];
const SUPPORTING_COUNT_WEIGHTS = [1, 2, 2, 3, 3, 3, 4];

// --- Screenplay acquisition cost -------------------------------------------
//
// A screenplay's price is what the MARKET will pay for it, and a market pays
// for upside. So cost is built ceiling-first: what could this concept plausibly
// earn (engine/commercialProfile.ts), then how well is that concept executed
// (craft), then how demanding a shoot it implies (complexity).
//
// It used to be effort-first - craft average x Production Scale x complexity,
// with commercial reach never consulted at all - which priced a screenplay by
// how good it was rather than by what it could return. That inverted the real
// economics and broke the prestige lane as a strategy: a contained, superbly
// written, narrow-audience piece was charged a premium for the very quality
// (small, intimate, critic-facing) that caps its revenue, so it was strictly
// dominated by a cheaper, broader, worse-written script. The screenplay card
// said both halves out loud in adjacent lines - "Priced for exceptional craft"
// over "Commercially: a narrow, dedicated audience" - and the player was
// correct to decline every time.
//
// Now the two lanes are genuinely different bets: a Prestige Intimate piece is
// the CHEAPEST thing on the market even at the highest craft in the game, and
// buys awards, Brand and Prestige; a Spectacle Epic is the most expensive and
// buys box office. Production Scale still reaches cost, but honestly - through
// its own commercial reach (data/scale.ts:reach feeding accessibility), not
// through a second, separate "big things cost more" multiplier that
// double-counted it.
const BASE_COST = 10_000;
const CEILING_COST_RANGE = 1_300_000;
// Convex on purpose (a market bids hardest for the rare wide-open concept), and
// the single most important number here: it's what puts a masterpiece chamber
// drama an order of magnitude below a tentpole rather than alongside it.
const CEILING_COST_EXPONENT = 2.8;
// accessibility ("how many people is this even for") dominates; hookStrength
// ("can it be sold in a trailer") is the minority partner. crossoverPotential
// is deliberately absent - it's upside a buyer can't bank on at acquisition.
const CEILING_ACCESSIBILITY_SHARE = 0.7;
// Craft is a premium ON the ceiling, never the ceiling itself: a superb draft
// of a small idea is still a small idea. Neutral at craft 50.
const CRAFT_COST_FLOOR = 0.6;
const CRAFT_COST_SPAN = 0.8;
const COMPLEXITY_COST_SHARE = 0.3;

/** "How big could this plausibly get" as one 0-100 number - the accessibility/hook blend the acquisition price is built on. */
export function commercialCeiling(profile: CommercialProfile): number {
  return profile.accessibility * CEILING_ACCESSIBILITY_SHARE + profile.hookStrength * (1 - CEILING_ACCESSIBILITY_SHARE);
}

export type ScriptCostInputs = CommercialInputs & Pick<Script, 'dialogue' | 'complexity'>;

/**
 * What the market charges for this screenplay. Ceiling first (what it could
 * earn), then craft (how well the concept is executed), then complexity (how
 * demanding it is to shoot). Exported so hand-authored reference scripts
 * (data/dev/referenceScripts.ts, data/testScripts.ts) derive a consistent cost
 * from the same formula instead of a guessed number that could drift from it.
 */
export function estimateScriptCost(script: ScriptCostInputs): number {
  const ceiling = commercialCeiling(deriveCommercialProfile(script)) / 100;
  const conceptValue = BASE_COST + CEILING_COST_RANGE * Math.pow(ceiling, CEILING_COST_EXPONENT);
  const avgCraft = (script.originality + script.structure + script.dialogue + script.characters) / 4;
  const craftMultiplier = CRAFT_COST_FLOOR + (avgCraft / 100) * CRAFT_COST_SPAN;
  const complexityMultiplier = 1 + (script.complexity / 100) * COMPLEXITY_COST_SHARE;
  return Math.round((conceptValue * craftMultiplier * complexityMultiplier) / 1000) * 1000;
}

// --- Writer influence (Phase 2: writer-driven screenplay generation) ------
//
// A writer biases a screenplay without dictating it: archetype-first
// generation still sets the territory (the archetype's own quality bands, story
// type, scale, setting), and the author only shifts probabilities *within* it.
// Every influence below is gated on an author actually being supplied - the
// un-authored path stays byte-identical to before, preserving the determinism
// scriptGenerator.test.ts and opportunities.test.ts both lock.

// The author's share of a craft roll's centre - deliberately a minority, so the
// archetype's own band still dominates "what kind of film is this."
const WRITER_CRAFT_INFLUENCE = 0.4;
// How hard the author's tone signature pulls the script's generated tone.
const WRITER_TONE_INFLUENCE = 0.3;
// Consistency maps to how wide a craft roll spreads around its (author-shifted)
// centre: a dependable craftsman clusters tightly, an inconsistent auteur ranges
// from dud to masterpiece.
const CRAFT_SPREAD_AT_LOW_CONSISTENCY = 26;
const CRAFT_SPREAD_AT_HIGH_CONSISTENCY = 8;
// A little overshoot beyond the archetype band, so a great author can rarely
// exceed the usual ceiling and a volatile one can dip below the floor.
const CRAFT_BAND_OVERSHOOT = 8;

/** Multiplicative archetype nudges from a writer's commercial lean (0 = prestige/original, 100 = crowd-pleaser) - never a hard filter, so a prestige writer can still land a CrowdPleaser now and then. */
function commercialArchetypeWeights(commercialLean: number): Partial<Record<(typeof SCRIPT_ARCHETYPES)[number], number>> {
  const c = commercialLean / 100;
  return {
    CrowdPleaser: 0.6 + 0.9 * c,
    GenreFormula: 0.6 + 0.8 * c,
    Spectacle: 0.7 + 0.5 * c,
    Prestige: 1.5 - 0.9 * c,
    OriginalVision: 1.4 - 0.8 * c,
  };
}

/** One craft stat, biased toward the author's own level on that axis and spread by their consistency, but anchored on the archetype's band (with a little overshoot). Draws exactly one rng value, same as the randIntRange it replaces. */
function rollAuthoredCraftStat(rng: RandomFn, band: [number, number], authorAxis: number, consistency: number): number {
  const [lo, hi] = band;
  const bandMid = (lo + hi) / 2;
  const centre = clamp(bandMid + (authorAxis - bandMid) * WRITER_CRAFT_INFLUENCE, lo, hi);
  const spread = CRAFT_SPREAD_AT_HIGH_CONSISTENCY + (CRAFT_SPREAD_AT_LOW_CONSISTENCY - CRAFT_SPREAD_AT_HIGH_CONSISTENCY) * (1 - consistency / 100);
  const value = centre + randFloat(rng, -spread, spread);
  return clamp(Math.round(value), Math.max(1, lo - CRAFT_BAND_OVERSHOOT), Math.min(100, hi + CRAFT_BAND_OVERSHOOT));
}

/** One craft stat: the authored roll when a writer is supplied, else the original uniform band roll (identical rng draw as before). */
function rollCraftStat(rng: RandomFn, band: [number, number], authorAxis: number | undefined, consistency: number | undefined): number {
  return authorAxis !== undefined && consistency !== undefined ? rollAuthoredCraftStat(rng, band, authorAxis, consistency) : randIntRange(rng, band);
}

/** Pulls a generated tone profile a fixed fraction toward the author's tonal signature - no rng, so it never shifts the stream. */
function applyWriterTone(profile: ToneProfile, authorTone: ToneProfile): ToneProfile {
  const pulled = {} as ToneProfile;
  for (const tone of TONES) {
    pulled[tone] = clamp(Math.round(profile[tone] + (authorTone[tone] - profile[tone]) * WRITER_TONE_INFLUENCE), 1, 100);
  }
  return pulled;
}

/** Each archetype's own genre likelihood (default 1 for a genre it doesn't list) - see data/scriptArchetypes.ts:genreAffinity. */
function archetypeWeightsForGenre(genre: Genre): Partial<Record<(typeof SCRIPT_ARCHETYPES)[number], number>> {
  const weights: Partial<Record<(typeof SCRIPT_ARCHETYPES)[number], number>> = {};
  for (const archetype of SCRIPT_ARCHETYPES) {
    weights[archetype] = SCRIPT_ARCHETYPE_PROFILES[archetype].genreAffinity[genre] ?? 1;
  }
  return weights;
}

/** A soft nudge (not a hard filter, unlike the old uniform pick among only these) toward whichever audiences data/genres.ts:GENRE_TYPICAL_AUDIENCES already considers plausible for this genre. */
function genreTypicalAudienceBonus(genre: Genre): Partial<Record<TargetAudience, number>> {
  const bonus: Partial<Record<TargetAudience, number>> = {};
  for (const audience of GENRE_TYPICAL_AUDIENCES[genre]) bonus[audience] = 1.5;
  return bonus;
}

function randIntRange(rng: RandomFn, range: QualityRange[keyof QualityRange]): number {
  return randInt(rng, range[0], range[1]);
}

/**
 * Generates one script option for the given genre - archetype-first
 * (docs/DESIGN.md - screenplay redesign): Archetype decides the quality
 * profile's *shape* and biases Story Type/Scale/Target Audience, rather than
 * every attribute being rolled independently of every other. A commercial
 * sports drama and an arthouse psychological thriller read as different
 * concepts before a single number is shown, because they resolve to
 * different archetype/story-type/scale/setting tags, not because their
 * stat rolls happened to differ.
 */
/**
 * How an acquisition source shapes the screenplay it produces, on top of the
 * archetype bands and the author (docs/DESIGN_REVIEW_source_generation_and_
 * determinants.md - "source as a generation profile"). Two levers:
 *  - conceptSpread: extra symmetric variance on every *concept-quality* axis
 *    (originality/hook/emotional/franchise). This is the market's lottery - a
 *    Spec's wide spread is what occasionally surfaces a powerhouse concept you
 *    could never reliably commission; a neutral profile (commission) leaves the
 *    concept exactly at its archetype band, so commissioning is the reliable
 *    floor and the market is the ceiling you can only *find*.
 *  - executionShift: a flat shift to the *execution craft* axes (structure/
 *    characters/dialogue) - how developed the draft reads overall.
 *  - executionSpread: per-axis symmetric variance on those same craft axes,
 *    rolled INDEPENDENTLY per axis - this is what makes a raw Spec read *uneven*
 *    (a sharp ear for dialogue but a mess of a structure) rather than uniformly
 *    mediocre. A polished Agent draft has near-zero spread (consistent), a Spec a
 *    wide one (spiky). The point of a Spec is that something is special but it's
 *    too rough around the edges to shoot as-is.
 */
export interface GenerationProfile {
  conceptSpread: number;
  executionShift: number;
  executionSpread: number;
}
export const NEUTRAL_GENERATION: GenerationProfile = { conceptSpread: 0, executionShift: 0, executionSpread: 0 };

/**
 * What a sequel inherits from its source IP (docs/DESIGN_REVIEW_sequels_and_
 * franchises.md). A franchise entry keeps the world (setting) and its returning
 * characters, and carries the IP's proven `recognition` as its franchiseRecognition
 * (the pre-sold draw). Everything else - concept originality, execution craft - is
 * rolled fresh: a sequel's audience is inherited, its quality is not.
 */
export interface SequelSeed {
  setting: SettingArchetype;
  /** The returning cast, as creative-identity snapshots (script-local ids are assigned here). */
  returningCharacters: Omit<ScriptCharacter, 'id'>[];
  franchiseRecognition: number;
}

function generateScript(genre: Genre, rng: RandomFn, title: string, usedSynopses: Set<string>, author?: WriterCreativeProfile, profile: GenerationProfile = NEUTRAL_GENERATION, sequelSeed?: SequelSeed): Script {
  // Minted up front (outside the rng stream) so the cast can derive stable,
  // globally-unique ids from it - see newScriptId/generateCast.
  const id = newScriptId();
  // A writer's commercial lean nudges archetype selection (prestige writers
  // toward Prestige/OriginalVision, commercial ones toward CrowdPleaser/
  // GenreFormula) - still a weighted pick inside the same archetype system, so
  // archetype-first generation is unchanged when no author is supplied.
  const archetypeWeights = author
    ? combineWeights(SCRIPT_ARCHETYPES, [archetypeWeightsForGenre(genre), commercialArchetypeWeights(author.commercialLean)])
    : archetypeWeightsForGenre(genre);
  const archetype = weightedPick(rng, SCRIPT_ARCHETYPES, archetypeWeights);
  const archetypeProfile = SCRIPT_ARCHETYPE_PROFILES[archetype];

  // Craft rolls are biased toward the author's own craft shape (and spread by
  // their consistency), but anchored on the archetype's band. Complexity has no
  // writer axis, so it stays a plain band roll.
  // Originality is Concept, not craft: it's biased by the author's conceptAmbition
  // (how bold their ideas run), not their execution craft (SIMULATION_PHILOSOPHY
  // Principle 9). Still anchored on the archetype's own originality band; the
  // source profile's concept spread is applied to it (with the other concept
  // axes) at the end. `originalityBase` is that pre-spread roll.
  const originalityBase = rollCraftStat(rng, archetypeProfile.qualityRange.originality, author?.conceptAmbition, author?.consistency);
  // Execution craft is rolled here (authored) but FINALISED at the end, where the
  // source profile's executionShift + per-axis executionSpread apply - so a raw
  // Spec reads rough and uneven, an Agent draft polished and consistent. These are
  // the pre-profile rolls.
  const structureBase = rollCraftStat(rng, archetypeProfile.qualityRange.structure, author?.craft.structure, author?.consistency);
  const charactersBase = rollCraftStat(rng, archetypeProfile.qualityRange.characters, author?.craft.characters, author?.consistency);
  const dialogueBase = rollCraftStat(rng, archetypeProfile.qualityRange.dialogue, author?.craft.dialogue, author?.consistency);
  const complexity = randIntRange(rng, archetypeProfile.qualityRange.complexity);

  const storyType = weightedPick(rng, STORY_TYPES, archetypeProfile.storyTypeAffinity);
  const storyProfile = STORY_TYPE_PROFILES[storyType];

  const scaleWeights = combineWeights(SCRIPT_SCALES, [archetypeProfile.scaleWeights, storyProfile.scaleAffinity]);
  const scale = weightedPick(rng, SCRIPT_SCALES, scaleWeights);
  const scaleProfile = SCRIPT_SCALE_PROFILES[scale];

  // A sequel keeps its IP's world; an original rolls a fresh setting. Everything
  // downstream (productionRequirements, ambitions) reads settingProfile, so the
  // inherited setting flows through consistently.
  const settingWeights = combineWeights(SETTING_ARCHETYPES, [GENRE_SETTING_AFFINITY[genre], storyProfile.settingAffinity]);
  const primarySetting = sequelSeed ? sequelSeed.setting : weightedPick(rng, SETTING_ARCHETYPES, settingWeights);
  const settingProfile = SETTING_ARCHETYPE_PROFILES[primarySetting];

  const { profile: baseTone, flavorTones } = generateToneProfile(genre, rng);
  // The author's tonal signature pulls the generated tone toward it (a modest
  // fraction, no rng) - flavorTones (which drive the synopsis) stay as rolled.
  const toneProfile = author ? applyWriterTone(baseTone, author.toneProfile) : baseTone;

  const productionRequirements = generateProductionRequirements(storyProfile, scaleProfile, settingProfile, complexity, rng);
  const environmentStrategy = generateEnvironmentStrategy(productionRequirements, settingProfile, rng);
  const environmentAmbition = generateEnvironmentAmbition(productionRequirements, settingProfile, complexity, rng);
  const effectsStrategy = generateEffectsStrategy(productionRequirements, rng);
  const effectsAmbition = generateEffectsAmbition(productionRequirements, complexity, rng);

  // The log-line is chosen HERE, before the cast, rather than at the end where it
  // used to sit - which is the whole point of having made selection cost no draw
  // (engine/premiseGenerator.ts). A concept can now inform the script built from
  // it instead of being decoration applied afterwards.
  //
  // What it informs, for now, is how many people the script is about. That was
  // rolled entirely independently of the log-line, so a screenplay whose own
  // synopsis read "two mismatched cops on their worst partnership yet" shipped
  // with a single Lead role about half the time - 63 log-lines in the banks name
  // a pair or an ensemble, and none of them could say so.
  const selectedPremise = generatePremise(genre, storyType, primarySetting, flavorTones[0] ?? null, title, usedSynopses);

  // A sequel stars its returning characters - inherit the cast rather than roll a
  // fresh one (script-local ids assigned from this script's id, per the cast-id
  // convention). Falls back to a generated cast if the IP lifted no Lead.
  const returning = sequelSeed?.returningCharacters ?? [];
  let requiredLeads: number;
  let requiredSupporting: number;
  let cast: ScriptCharacter[];
  if (returning.length > 0 && returning.some((c) => c.prominence === 'Lead')) {
    // Inherited verbatim, INCLUDING their demand rows: these came off the source
    // film's own script (engine/ip.ts:promoteFilmToIp copies script.cast traits),
    // so they have already been read against a screenplay. Re-running the
    // script-shaped post-pass over them would apply it twice - and it isn't
    // idempotent, so a returning role would drift a little further from its
    // archetype with every sequel until it pinned at the clamp. Leaving them
    // alone also keeps a sequel's role brief agreeing with the one the IP screen
    // shows for the same character.
    cast = returning.map((c, i) => ({ ...c, id: `${id}-c${i}` }));
    requiredLeads = cast.filter((c) => c.prominence === 'Lead').length;
    requiredSupporting = cast.filter((c) => c.prominence === 'Supporting').length;
  } else {
    const castMultiplier = storyProfile.castSizeMultiplier * scaleProfile.castMultiplier;
    // SOFT binding, deliberately: the log-line raises the floor, it does not set
    // the number. Production Scale and Story Type still decide how far above it a
    // script lands, so an Epic ensemble is still an Epic ensemble - the concept
    // only stops the cast contradicting what the synopsis already promised.
    //
    // Two honest caveats, both measured over 24,000 generated scripts rather
    // than estimated. The floor DOMINATES in practice: 86.6% of scripts with a
    // floor of 2 land exactly on it, so "soft" is real but the headroom is
    // narrow. And it overrides a very low castSizeMultiplier rather than scaling
    // with it - Documentary (0.15, "little to no conventional dramatic cast")
    // could only ever produce one Lead before, and now produces two or three for
    // 19.6% of its scripts, because a documentary whose log-line is about two
    // people does need both on screen. That is a deliberate trade, not an
    // oversight: if it ever reads wrong, scale the floor by castMultiplier here.
    const promisedLeads = selectedPremise.premise.leads ?? 1;
    requiredLeads = Math.max(1, promisedLeads, Math.round(pick(rng, LEAD_COUNT_WEIGHTS) * castMultiplier));
    requiredSupporting = Math.max(0, Math.round(pick(rng, SUPPORTING_COUNT_WEIGHTS) * castMultiplier));
    // Re-read every fresh role's performance demands against the screenplay it's
    // actually in, rather than leaving it on its character archetype's fixed
    // baseTraits row (engine/characterDemands.ts). Deliberately rng-free, so a
    // seeded slate is byte-identical to before this existed apart from the three
    // modulated demand axes themselves.
    cast = scriptShapedCast(
      generateCast(id, genre, storyType, requiredLeads, requiredSupporting, rng),
      { toneProfile, productionRequirements },
    );
  }

  const audienceWeights = combineWeights(TARGET_AUDIENCES, [
    storyProfile.targetAudienceWeights,
    archetypeProfile.targetAudienceWeights,
    genreTypicalAudienceBonus(genre),
  ]);
  const intendedAudience = weightedPick(rng, TARGET_AUDIENCES, audienceWeights);

  // Concept-quality inputs (immutable; feed the derived ConceptStrength). Rolled
  // from the archetype's own bands - the archetype owns "what kind of concept
  // this is" (a Spectacle hooks hard and franchises well; a Prestige piece trades
  // that for emotional depth). Not writer-biased beyond originality: hook/
  // emotional/franchise are properties of the concept, not the author's craft.
  // Drawn last, so the rest of the script (including its cast) is byte-identical
  // to before these fields existed - only the trailing rng position advances.
  const hookBase = randIntRange(rng, archetypeProfile.qualityRange.hook);
  const emotionalBase = randIntRange(rng, archetypeProfile.qualityRange.emotionalPremise);
  const franchiseBase = randIntRange(rng, archetypeProfile.qualityRange.franchisePotential);
  // The source's concept spread widens every concept axis symmetrically - the
  // market's lottery. Only draws (and only differs from the base) when there IS
  // spread, so neutral/commissioned generation stays byte-identical to the base
  // rolls above. A wide spread (Spec) raises the ceiling AND lowers the floor:
  // most specs are unremarkable, a rare one is a powerhouse you couldn't commission.
  const spread = profile.conceptSpread;
  const jitter = (base: number) => (spread > 0 ? clamp(Math.round(base + randFloat(rng, -spread, spread)), 1, 100) : base);
  const originality = jitter(originalityBase);
  const hook = jitter(hookBase);
  const emotionalPremise = jitter(emotionalBase);
  const franchisePotential = jitter(franchiseBase);
  // Finalise execution craft: the flat shift (how developed overall) plus an
  // INDEPENDENT per-axis spread (how uneven). A raw Spec's wide spread is what
  // makes it spiky - sharp in one craft, a mess in another - the "special but too
  // rough to shoot" draft. Neutral (0/0) draws nothing and leaves the base intact.
  const execSpread = profile.executionSpread;
  const finishCraft = (base: number) =>
    clamp(Math.round(base + profile.executionShift + (execSpread > 0 ? randFloat(rng, -execSpread, execSpread) : 0)), 1, 100);
  const structure = finishCraft(structureBase);
  const characters = finishCraft(charactersBase);
  const dialogue = finishCraft(dialogueBase);

  return {
    id,
    title,
    genre,
    archetype,
    storyType,
    primarySetting,
    scale,
    originality,
    hook,
    emotionalPremise,
    franchisePotential,
    structure,
    characters,
    dialogue,
    complexity,
    cost: estimateScriptCost({
      originality, structure, dialogue, characters, complexity,
      genre, archetype, storyType, scale, primarySetting, cast,
    }),
    toneProfile,
    environmentStrategy,
    environmentAmbition,
    effectsStrategy,
    effectsAmbition,
    productionRequirements,
    synopsis: selectedPremise.text,
    requiredLeads,
    requiredSupporting,
    intendedAudience,
    franchiseRecognition: sequelSeed?.franchiseRecognition,
    cast,
  };
}

/** Generates a slate of script options for the player to choose from. When `author` is supplied every script in the slate is shaped by that writer (Phase 2); omitted, generation is exactly as before. `profile` biases the concept/execution distributions per acquisition source (Phase 3b); omitted, it's neutral (the reliable commission/baseline shape). */
export function generateScriptOptions(genre: Genre, rng: RandomFn, count = 12, author?: WriterCreativeProfile, profile: GenerationProfile = NEUTRAL_GENERATION): Script[] {
  const usedTitles = new Set<string>();
  const usedSynopses = new Set<string>();
  return Array.from({ length: count }, () => generateScript(genre, rng, uniqueTitle(genre, rng, usedTitles), usedSynopses, author, profile));
}

/** A returning IP character as a creative-identity snapshot for the next film - drops evolving standing and provenance; the sequel's generator assigns a fresh script-local id. */
function ipCharacterToScriptCharacter(c: IpCharacter): Omit<ScriptCharacter, 'id'> {
  return {
    name: c.name,
    archetype: c.archetype,
    prominence: c.prominence,
    castingGender: c.castingGender,
    castingAgeBand: c.castingAgeBand,
    traits: c.traits,
  };
}

/** "{IP} {n}" - the nth entry in the franchise (source film is 1, so the first sequel is 2). */
function sequelTitle(ipName: string, entryNumber: number): string {
  return `${ipName} ${entryNumber}`;
}

/**
 * Generates the screenplay for a new franchise entry (a sequel) from an owned IP
 * (docs/DESIGN_REVIEW_sequels_and_franchises.md). It inherits the IP's world
 * (setting) and returning characters, and carries the IP's proven `recognition`
 * as `franchiseRecognition` - the pre-sold draw that makes a franchise open big.
 * Everything else (concept originality, execution craft) is rolled fresh on the
 * NEUTRAL profile: a sequel's audience is inherited, its quality is not - you can
 * absolutely make a bad one. `genre` comes from the source film (an IP doesn't
 * store it). The nth entry is titled "{IP} {n}".
 */
export function generateSequelScript(ip: IntellectualProperty, genre: Genre, rng: RandomFn): Script {
  const seed: SequelSeed = {
    setting: ip.setting.archetype,
    returningCharacters: ip.characters.map(ipCharacterToScriptCharacter),
    franchiseRecognition: ip.recognition,
  };
  const title = sequelTitle(ip.name, ip.filmIds.length + 1);
  return generateScript(genre, rng, title, new Set<string>(), undefined, NEUTRAL_GENERATION, seed);
}
