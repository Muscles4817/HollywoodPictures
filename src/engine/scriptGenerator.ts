import type {
  CastingGender,
  CharacterArchetype,
  CharacterProminence,
  CharacterTraitProfile,
  Distribution,
  EffectsMethodKey,
  EnvironmentMethodKey,
  Genre,
  NormalizedScalar,
  ProductionRequirements,
  Script,
  ScriptCharacter,
  StoryType,
  TargetAudience,
  Tone,
  ToneProfile,
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
import { TALENT_FIRST_NAMES, TALENT_LAST_NAMES } from '../data/talentNames';
import { generatePremise } from './premiseGenerator';
import { type RandomFn, clamp, combineWeights, normalizeWeights, pick, pickMany, randFloat, randInt, weightedPick } from './random';

let nextScriptId = 1;

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

let nextCharacterId = 1;

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

/** A stable 0-1 hash of a string (FNV-1a) - used to derive castingGender below without drawing from the shared RandomFn stream. */
function hashUnit(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

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

function generateCharacter(prominence: CharacterProminence, genre: Genre, storyType: StoryType, rng: RandomFn): ScriptCharacter {
  const weights = combineWeights(CHARACTER_ARCHETYPES, [
    characterArchetypeWeightsForGenre(genre),
    characterArchetypeWeightsForStoryType(storyType),
    characterArchetypeWeightsForProminence(prominence),
  ]);
  const archetype = weightedPick(rng, CHARACTER_ARCHETYPES, weights);
  const name = `${pick(rng, TALENT_FIRST_NAMES)} ${pick(rng, TALENT_LAST_NAMES)}`;
  return {
    id: `character-${nextCharacterId++}`,
    name,
    archetype,
    prominence,
    castingGender: castingGenderForCharacter(archetype, name),
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
function generateCast(genre: Genre, storyType: StoryType, requiredLeads: number, requiredSupporting: number, rng: RandomFn): ScriptCharacter[] {
  const cast: ScriptCharacter[] = [];
  for (let i = 0; i < requiredLeads; i++) cast.push(generateCharacter('Lead', genre, storyType, rng));
  for (let i = 0; i < requiredSupporting; i++) cast.push(generateCharacter('Supporting', genre, storyType, rng));
  const minorCount = pick(rng, MINOR_CHARACTER_COUNT_WEIGHTS);
  for (let i = 0; i < minorCount; i++) cast.push(generateCharacter('Minor', genre, storyType, rng));
  return cast;
}

// Mostly a single protagonist; occasionally a pair or a true ensemble lead -
// scaled by the chosen Story Type/Production Scale's own castSizeMultiplier/
// castMultiplier below (a Heist wants an ensemble, a Documentary often wants
// none at all), not a flat genre-independent table any more.
const LEAD_COUNT_WEIGHTS = [1, 1, 1, 1, 1, 2, 2, 2, 3];
const SUPPORTING_COUNT_WEIGHTS = [1, 2, 2, 3, 3, 3, 4];

/**
 * Cost scales with the average of the script's craft attributes - a
 * well-structured, well-characterized, original, well-written script costs
 * more to acquire - then scales further with how big a production it
 * implies (Production Scale) and how demanding it is to actually shoot
 * (Complexity), so "why is this script expensive" always has a legible
 * answer: either it's exceptionally well-crafted, or it's an ambitious,
 * complex, large-scale concept, or both. Exported so hand-authored
 * reference scripts (data/dev/referenceScripts.ts) can derive a consistent
 * cost from the same formula instead of a guessed number that could drift
 * from it.
 */
export function estimateScriptCost(script: Pick<Script, 'originality' | 'structure' | 'dialogue' | 'characters' | 'scale' | 'complexity'>): number {
  const avgQuality = (script.originality + script.structure + script.dialogue + script.characters) / 4;
  const baseCost = 50_000;
  const scaledCost = avgQuality * 6_000; // up to ~600k for a top-tier spec script, before scale/complexity
  const scaleMultiplier = SCRIPT_SCALE_PROFILES[script.scale].costMultiplier;
  const complexityMultiplier = 1 + (script.complexity / 100) * 0.3;
  return Math.round(((baseCost + scaledCost) * scaleMultiplier * complexityMultiplier) / 1000) * 1000;
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
function generateScript(genre: Genre, rng: RandomFn, title: string): Script {
  const archetype = weightedPick(rng, SCRIPT_ARCHETYPES, archetypeWeightsForGenre(genre));
  const archetypeProfile = SCRIPT_ARCHETYPE_PROFILES[archetype];

  const originality = randIntRange(rng, archetypeProfile.qualityRange.originality);
  const structure = randIntRange(rng, archetypeProfile.qualityRange.structure);
  const characters = randIntRange(rng, archetypeProfile.qualityRange.characters);
  const dialogue = randIntRange(rng, archetypeProfile.qualityRange.dialogue);
  const complexity = randIntRange(rng, archetypeProfile.qualityRange.complexity);

  const storyType = weightedPick(rng, STORY_TYPES, archetypeProfile.storyTypeAffinity);
  const storyProfile = STORY_TYPE_PROFILES[storyType];

  const scaleWeights = combineWeights(SCRIPT_SCALES, [archetypeProfile.scaleWeights, storyProfile.scaleAffinity]);
  const scale = weightedPick(rng, SCRIPT_SCALES, scaleWeights);
  const scaleProfile = SCRIPT_SCALE_PROFILES[scale];

  const settingWeights = combineWeights(SETTING_ARCHETYPES, [GENRE_SETTING_AFFINITY[genre], storyProfile.settingAffinity]);
  const primarySetting = weightedPick(rng, SETTING_ARCHETYPES, settingWeights);
  const settingProfile = SETTING_ARCHETYPE_PROFILES[primarySetting];

  const { profile: toneProfile, flavorTones } = generateToneProfile(genre, rng);

  const productionRequirements = generateProductionRequirements(storyProfile, scaleProfile, settingProfile, complexity, rng);
  const environmentStrategy = generateEnvironmentStrategy(productionRequirements, settingProfile, rng);
  const environmentAmbition = generateEnvironmentAmbition(productionRequirements, settingProfile, complexity, rng);
  const effectsStrategy = generateEffectsStrategy(productionRequirements, rng);
  const effectsAmbition = generateEffectsAmbition(productionRequirements, complexity, rng);

  const castMultiplier = storyProfile.castSizeMultiplier * scaleProfile.castMultiplier;
  const requiredLeads = Math.max(1, Math.round(pick(rng, LEAD_COUNT_WEIGHTS) * castMultiplier));
  const requiredSupporting = Math.max(0, Math.round(pick(rng, SUPPORTING_COUNT_WEIGHTS) * castMultiplier));
  const cast = generateCast(genre, storyType, requiredLeads, requiredSupporting, rng);

  const audienceWeights = combineWeights(TARGET_AUDIENCES, [
    storyProfile.targetAudienceWeights,
    archetypeProfile.targetAudienceWeights,
    genreTypicalAudienceBonus(genre),
  ]);
  const intendedAudience = weightedPick(rng, TARGET_AUDIENCES, audienceWeights);

  return {
    id: `script-${nextScriptId++}`,
    title,
    genre,
    archetype,
    storyType,
    primarySetting,
    scale,
    originality,
    structure,
    characters,
    dialogue,
    complexity,
    cost: estimateScriptCost({ originality, structure, dialogue, characters, scale, complexity }),
    toneProfile,
    environmentStrategy,
    environmentAmbition,
    effectsStrategy,
    effectsAmbition,
    productionRequirements,
    synopsis: generatePremise(genre, flavorTones[0] ?? null, rng),
    requiredLeads,
    requiredSupporting,
    intendedAudience,
    cast,
  };
}

/** Generates a slate of script options for the player to choose from. */
export function generateScriptOptions(genre: Genre, rng: RandomFn, count = 12): Script[] {
  const usedTitles = new Set<string>();
  return Array.from({ length: count }, () => generateScript(genre, rng, uniqueTitle(genre, rng, usedTitles)));
}
