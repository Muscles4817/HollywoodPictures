// IP Viability Assessment (see types/index.ts:IpViabilityAssessment) - the
// "is this film actually worth turning into a franchise?" decision layer.
//
// evaluateIpViability is a pure, deterministic read: it inspects a released Film
// (a historical record that never changes) plus the current world, and reports
// how viable another entry would be. It NEVER creates or mutates an IP, and it
// runs against any released player Film whether or not an IP exists. Everything
// it reads is already in the simulation - it invents no popularity history.
//
// It deliberately separates two different questions:
//  - Inherent potential (mostly static): is this fundamentally franchise
//    material - distinctive characters, an expandable setting, story room?
//  - Current opportunity (dynamic): is *now* a good moment - is awareness still
//    warm, is the genre hot, can the studio afford it, are the leads free?
import type {
  CharacterArchetype,
  Film,
  GameDay,
  IpCharacterViability,
  IpViabilityAssessment,
  Person,
  ScriptArchetype,
  ScriptCharacter,
  Studio,
  StoryType,
  TalentProfession,
} from '../types';
import { clamp } from './random';
import { GENRE_PROFILES } from '../data/genres';
import { SETTING_ARCHETYPE_PROFILES } from '../data/settings';
import { SETTING_LABELS } from '../data/scriptTagLabels';
import { deriveCommercialProfile } from './commercialProfile';
import { deriveBookedUntil } from './person';
import { deriveFilmRecognition, deriveFilmPrestige } from './intellectualProperty';

/** The slice of world state the assessment needs beyond the film and studio - just the live roster, to check whether the original leads/director are free for another production right now. */
export interface IpViabilityWorld {
  talentPool: Record<TalentProfession, Person[]>;
}

// How franchise-friendly each story hook is, 0-100 - serial-friendly hooks
// (a superhero, a heist crew, an ongoing detective) leave obvious room for
// more; a biography or documentary is a closed story. 'Original' (no strong
// subgenre hook) sits neutral.
const STORY_EXPANDABILITY: Record<StoryType, number> = {
  Superhero: 92,
  Heist: 80,
  Crime: 74,
  Mystery: 72,
  War: 60,
  Sports: 55,
  Musical: 48,
  ComingOfAge: 45,
  Biography: 32,
  Documentary: 24,
  Original: 50,
};

// How franchise-friendly each screenplay archetype is, 0-100 - built-to-be-seen
// spectacle and repeatable genre formula extend naturally; a prestige
// character piece or a one-of-a-kind original vision reads as complete.
const ARCHETYPE_EXPANDABILITY: Record<ScriptArchetype, number> = {
  Spectacle: 86,
  GenreFormula: 76,
  CrowdPleaser: 70,
  OriginalVision: 45,
  Prestige: 40,
};

// Archetypes whose whole appeal is being a recurring adversary - a memorable
// one of these is worth bringing back even from a Supporting slot.
const ANTAGONIST_ARCHETYPES: ReadonlySet<CharacterArchetype> = new Set(['Villain', 'TragicVillain', 'Rival', 'MonsterOrCreature']);

const PROMINENCE_POTENTIAL_FACTOR: Record<ScriptCharacter['prominence'], number> = {
  Lead: 1,
  Supporting: 0.8,
  Minor: 0.5,
};

const BREAKOUT_THRESHOLD = 62;

/** How long, in days, audience awareness of a release takes to substantially fade (used only to taper current opportunity, never the inherent read). */
const AWARENESS_FADE_DAYS = 3 * 365;

function clamp100(v: number): number {
  return clamp(v, 0, 100);
}

/** Judges one character's standalone franchise potential from its own trait profile and prominence - never averaged in, so a real breakout stays visible. */
function assessCharacter(character: ScriptCharacter): IpCharacterViability {
  const { distinctiveness, merchandisePotential, audienceAccessibility } = character.traits;
  const base = distinctiveness * 0.4 + merchandisePotential * 0.3 + audienceAccessibility * 0.3;
  const potential = clamp100(base * PROMINENCE_POTENTIAL_FACTOR[character.prominence]);
  const isAntagonist = ANTAGONIST_ARCHETYPES.has(character.archetype);
  // A Lead can carry; a distinctive antagonist can recur even from a supporting slot.
  const breakout = potential >= BREAKOUT_THRESHOLD && (character.prominence === 'Lead' || isAntagonist);

  let note: string;
  if (breakout && character.prominence === 'Lead') {
    note = `${character.name} looks capable of carrying future films.`;
  } else if (breakout && isAntagonist) {
    note = `${character.name} is a memorable antagonist worth bringing back.`;
  } else if (breakout) {
    note = `${character.name} could anchor a spin-off.`;
  } else if (character.prominence === 'Lead') {
    note = `${character.name} is a solid lead but not obviously franchise-defining.`;
  } else {
    note = `${character.name} has little standalone potential.`;
  }
  return { characterId: character.id, name: character.name, prominence: character.prominence, potential, breakout, note };
}

/** How reusable/expandable a setting is, 0-100 - a big, multi-location, non-self-contained world (a fantasy realm, an alien planet) leaves room for more stories; a single contained interior doesn't. Distinct from its cost, which feeds costRisk. */
function assessSetting(setting: Film['script']['primarySetting']): number {
  const p = SETTING_ARCHETYPE_PROFILES[setting];
  const expandable = clamp(p.environmentScale * 0.4 + p.locationComplexity * 0.3 + (1 - p.containedProductionAffinity) * 0.3, 0, 1);
  const distinct = clamp((p.environmentScale + p.vfxEnvironmentDemand) / 2, 0, 1);
  return clamp100((expandable * 0.7 + distinct * 0.3) * 100);
}

/** Whether the film's original Leads and Director are free to make another one right now, 0-100 (fraction available). Reads the *live* roster, since the film's own talent snapshot is historical. */
function talentAvailability(film: Film, world: IpViabilityWorld, currentDay: GameDay): number {
  const byId = new Map<string, Person>();
  for (const people of Object.values(world.talentPool)) for (const p of people) byId.set(p.id, p);
  const key = film.talent.filter((a) => a.role === 'Lead Actor' || a.role === 'Director');
  if (key.length === 0) return 100;
  let free = 0;
  for (const assignment of key) {
    const live = byId.get(assignment.person.id);
    // Not in the current pool (retired/gone) counts as unavailable.
    if (!live) continue;
    const bookedUntil = deriveBookedUntil(live.availability.commitments);
    if (bookedUntil === undefined || bookedUntil <= currentDay) free += 1;
  }
  return clamp100((free / key.length) * 100);
}

/** Commercial goodwill that would carry into another entry, 0-100 - audience approval, buzz, and how profitable the original actually was. */
function commercialCarryover(film: Film): number {
  const { audienceScore, buzzScore, profit, totalCost } = film.results;
  // profit == totalCost -> ratio ~0.67; break-even -> 0.33; total loss -> 0.
  const profitRatio = profit !== null && totalCost > 0 ? clamp((profit / totalCost + 1) / 3, 0, 1) : 0.4;
  return clamp100(audienceScore * 0.45 + buzzScore * 0.2 + profitRatio * 100 * 0.35);
}

const VERDICTS: Array<{ min: number; label: string }> = [
  { min: 78, label: 'Prime Franchise Material' },
  { min: 62, label: 'Strong Franchise Candidate' },
  { min: 46, label: 'Viable, With Reservations' },
  { min: 30, label: 'Marginal Franchise Potential' },
  { min: 0, label: 'Not Franchise Material' },
];

function verdictFor(overall: number): string {
  return VERDICTS.find((v) => overall >= v.min)!.label;
}

/**
 * The full, read-only franchise-viability assessment for a released Film. Pure
 * and deterministic - same inputs always give the same result, and nothing is
 * mutated. See the module header for the inherent-vs-opportunity split.
 */
export function evaluateIpViability(film: Film, studio: Studio, world: IpViabilityWorld, currentDay: GameDay): IpViabilityAssessment {
  const script = film.script;
  const commercial = deriveCommercialProfile(script);

  // --- Character analysis (individual, not averaged) ---
  const characters = script.cast
    .map(assessCharacter)
    .sort((a, b) => b.potential - a.potential);
  const breakouts = characters.filter((c) => c.breakout);
  const bestCharacter = characters[0];
  // Weighted toward the best and toward depth (multiple breakouts), never a flat mean.
  const characterPotential = characters.length === 0
    ? 0
    : clamp100((bestCharacter?.potential ?? 0) + Math.min(Math.max(breakouts.length - 1, 0), 2) * 6);

  // --- Setting analysis ---
  const settingPotential = assessSetting(script.primarySetting);
  const settingProfile = SETTING_ARCHETYPE_PROFILES[script.primarySetting];

  // --- Inherent potential (mostly static) ---
  const storyExpandability = clamp100(
    STORY_EXPANDABILITY[script.storyType] * 0.5 + ARCHETYPE_EXPANDABILITY[script.archetype] * 0.3 + commercial.crossoverPotential * 0.2,
  );
  const inherentPotential = clamp100(characterPotential * 0.4 + settingPotential * 0.3 + storyExpandability * 0.3);

  // --- Carryovers (from the film's own preserved results) ---
  const commercial_ = commercialCarryover(film);
  const prestigeCarryover = deriveFilmPrestige(film);
  const recognition = deriveFilmRecognition(film);

  // --- Cost risk of making another one ---
  const settingCostPressure = clamp(
    (settingProfile.vfxEnvironmentDemand + settingProfile.setConstructionDemand + settingProfile.travelDemand + settingProfile.practicalLogisticsDemand) / 4,
    0,
    1,
  );
  const affordability = clamp100(studio.cash > 0 ? (studio.cash / Math.max(1, film.results.totalCost)) * 100 : 0);
  const costRisk = clamp100(settingCostPressure * 45 + (script.complexity / 100) * 25 + (100 - affordability) * 0.3);

  // --- Current opportunity (dynamic) ---
  const daysSinceRelease = Math.max(0, currentDay - film.releasedOnDay);
  const freshness = clamp(1 - daysSinceRelease / AWARENESS_FADE_DAYS, 0, 1);
  const awareness = clamp100(recognition * (0.35 + 0.65 * freshness));
  const genrePopularity = GENRE_PROFILES[film.genre].popularity;
  const talentAvail = talentAvailability(film, world, currentDay);
  const currentOpportunity = clamp100(
    awareness * 0.3 + genrePopularity * 0.2 + affordability * 0.2 + talentAvail * 0.15 + commercial_ * 0.15,
  );

  // --- Overall ---
  const overallScore = clamp100(
    inherentPotential * 0.5 + currentOpportunity * 0.4 + prestigeCarryover * 0.1 - Math.max(0, costRisk - 65) * 0.3,
  );

  // --- Plain-language, input-derived strengths & concerns (ordered, capped) ---
  const strengths: Array<{ weight: number; text: string }> = [];
  const concerns: Array<{ weight: number; text: string }> = [];

  if (bestCharacter?.breakout && bestCharacter.prominence === 'Lead') {
    strengths.push({ weight: bestCharacter.potential, text: `Exceptional Lead — ${bestCharacter.name} could carry sequels.` });
  }
  const antagonistBreakout = breakouts.find((c) => c.prominence !== 'Lead');
  if (antagonistBreakout) {
    strengths.push({ weight: antagonistBreakout.potential, text: `${antagonistBreakout.name} is a memorable antagonist to bring back.` });
  }
  if (breakouts.length >= 2) strengths.push({ weight: 60 + breakouts.length * 5, text: 'Several characters worth building around.' });
  if (settingPotential >= 62) strengths.push({ weight: settingPotential, text: `Rich, expandable ${SETTING_LABELS[script.primarySetting]} setting.` });
  if (commercial_ >= 65) strengths.push({ weight: commercial_, text: 'Strong commercial performance and audience goodwill.' });
  if (prestigeCarryover >= 70) strengths.push({ weight: prestigeCarryover, text: 'Critically acclaimed — real prestige to build on.' });
  if (genrePopularity >= 68) strengths.push({ weight: genrePopularity, text: `${film.genre} is commercially hot right now.` });

  if (costRisk >= 62) concerns.push({ weight: costRisk, text: 'Expensive, production-heavy to mount again.' });
  if (awareness < 40) concerns.push({ weight: 100 - awareness, text: 'Audience awareness has faded since release.' });
  if (talentAvail < 50) concerns.push({ weight: 100 - talentAvail, text: 'The original leads or director are largely tied up.' });
  if (affordability < 60) concerns.push({ weight: 100 - affordability, text: 'Another production would strain the studio’s finances.' });
  if (storyExpandability < 48 && prestigeCarryover >= 55) concerns.push({ weight: 100 - storyExpandability, text: 'The original story feels self-contained.' });
  if (characterPotential < 45) concerns.push({ weight: 100 - characterPotential, text: 'No character stands out as franchise-defining.' });
  if (genrePopularity < 40) concerns.push({ weight: 100 - genrePopularity, text: `The ${film.genre} genre has cooled.` });

  const top = (list: Array<{ weight: number; text: string }>) =>
    list.sort((a, b) => b.weight - a.weight).slice(0, 4).map((e) => e.text);

  return {
    overallScore,
    verdict: verdictFor(overallScore),
    inherentPotential,
    currentOpportunity,
    characterPotential,
    settingPotential,
    commercialCarryover: commercial_,
    prestigeCarryover,
    costRisk,
    characters,
    strengths: top(strengths),
    concerns: top(concerns),
  };
}
