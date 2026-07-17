// Pure, non-React derivations from a Script's own concept, shared between
// every screen that needs to describe it in prose rather than raw numbers
// (docs/DESIGN.md - screenplay redesign). Extracted out of
// components/wizard/DevelopFilm.tsx (the first place these existed) once a
// second consumer (components/common/ScriptSummaryCard.tsx) needed the same
// logic - kept here, not in a component file, since neither function
// touches JSX.
import { deriveCommercialProfile } from './commercialProfile';
import { SETTING_ARCHETYPE_PROFILES, type SettingProfile } from '../data/settings';
import type { Script, ScriptCharacter, SettingArchetype } from '../types';

// Threshold-to-tag mapping - drawn from the screenplay's own concept
// (ProductionRequirements plus the chosen Setting Archetype's own
// production-pressure profile, Story Type, never randomly), answering "why
// is this production difficult or expensive" in concrete, actionable terms
// instead of an abstract lean summary. Reads SettingProfile's numeric
// fields rather than checking specific archetype names, so adding a new
// Setting Archetype later never means touching this function (Character and
// Setting Foundations milestone).
const HEAVY = 0.5;
const NOTABLE = 0.4;
export function productionRequirementTags(script: Script): string[] {
  const req = script.productionRequirements;
  const setting = SETTING_ARCHETYPE_PROFILES[script.primarySetting];
  const tags: string[] = [];

  if (req.periodSetting) tags.push('Period Costumes', 'Period Sets');
  if (setting.vfxEnvironmentDemand >= HEAVY) tags.push('Constructed Worlds');
  if (setting.containedProductionAffinity < NOTABLE && req.locations >= HEAVY) tags.push('Remote Locations');

  if (req.extras >= NOTABLE) tags.push('Large Ensemble');
  if (req.crowdWork >= NOTABLE) tags.push('Crowd Scenes');
  if (script.storyType === 'ComingOfAge') tags.push('Young Cast');
  if (script.storyType === 'Documentary') tags.push('Nonfiction Format');

  if (req.stunts >= HEAVY) tags.push('Stunts');
  if (req.vehicles) tags.push('Vehicles');
  if (req.animals) tags.push('Animals');
  if (req.practicalEffects >= HEAVY) tags.push('Practical Effects');
  if (req.vfx >= HEAVY) tags.push('Heavy VFX');

  if (script.storyType === 'Musical') tags.push('Musical Numbers');
  if (req.choreography >= NOTABLE) tags.push('Choreography');

  if (setting.containedProductionAffinity < NOTABLE && req.locations >= HEAVY && !tags.includes('Remote Locations')) {
    tags.push('Large Locations');
  }
  if (setting.travelDemand >= HEAVY) tags.push('Extensive Travel');

  return tags.length > 0 ? tags : ['Contained, straightforward production'];
}

/** "Why is it commercially attractive" - one sentence derived from the screenplay's hidden commercial profile (engine/commercialProfile.ts), never a raw number. */
export function describeCommercialAppeal(script: Script): string {
  const profile = deriveCommercialProfile(script);
  const traits: string[] = [];
  if (profile.accessibility >= 65) traits.push('broad mainstream appeal');
  else if (profile.accessibility <= 35) traits.push('a narrow, dedicated audience');
  if (profile.hookStrength >= 65) traits.push('an easy pitch to market');
  else if (profile.hookStrength <= 35) traits.push('a tough concept to sell in a trailer');
  if (profile.crossoverPotential >= 65) traits.push('real potential to break out beyond its natural audience');
  if (traits.length === 0) return 'Middling, unremarkable commercial potential.';
  return `Commercially: ${traits.join(', ')}.`;
}

/** "Why is this script expensive" - the concrete drivers behind Screenplay Cost, rather than leaving the number to speak for itself. */
export function describeCostDrivers(script: Script): string {
  const drivers: string[] = [];
  if (script.scale === 'Epic') drivers.push('its epic scale');
  if (script.complexity >= 65) drivers.push('a demanding production');
  const avgCraft = (script.originality + script.structure + script.characters + script.dialogue) / 4;
  if (avgCraft >= 70) drivers.push('exceptional craft');
  if (drivers.length === 0) return 'A modest, straightforward production.';
  return `Priced for ${drivers.join(' and ')}.`;
}

const SETTING_IMPLICATION_HEAVY = 0.55;
const SETTING_IMPLICATION_MAX_NOTES = 3;

/**
 * "What does this Setting Archetype actually imply for the shoot" - one
 * short, plain-English sentence built from SettingProfile's own numeric
 * pressure fields, e.g. "High environmental ambition, heavy digital
 * environment work, and substantial production-design pressure." (Character
 * and Setting Foundations milestone, section 6). Capped at three notes so a
 * setting with several high readings doesn't turn into an unreadable list.
 */
export function describeSettingImplication(setting: SettingArchetype): string {
  const profile: SettingProfile = SETTING_ARCHETYPE_PROFILES[setting];
  const notes: string[] = [];
  if (profile.environmentScale >= SETTING_IMPLICATION_HEAVY) notes.push('high environmental ambition');
  else if (profile.containedProductionAffinity >= SETTING_IMPLICATION_HEAVY) notes.push('a contained, easily controlled shoot');
  if (profile.vfxEnvironmentDemand >= SETTING_IMPLICATION_HEAVY) notes.push('heavy digital environment work');
  if (profile.setConstructionDemand >= SETTING_IMPLICATION_HEAVY) notes.push('substantial production-design pressure');
  if (profile.practicalLogisticsDemand >= SETTING_IMPLICATION_HEAVY) notes.push('significant real-world logistics');
  if (profile.travelDemand >= SETTING_IMPLICATION_HEAVY) notes.push('a travel-heavy shoot');
  if (profile.extrasDemand >= SETTING_IMPLICATION_HEAVY) notes.push('a large background cast');
  if (notes.length === 0) return 'A moderate, unremarkable production footprint.';
  const chosen = notes.slice(0, SETTING_IMPLICATION_MAX_NOTES);
  const sentence = chosen.join(', ');
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}

const CHARACTER_DEMAND_NOTABLE = 45;
const CHARACTER_DEMAND_MAX_NOTES = 3;

/**
 * "What does this role actually demand from whoever plays it" - the two or
 * three highest CharacterTraitProfile readings among the five that map onto
 * ActingStyle (see engine/compatibility.ts:computeCharacterCompatibility),
 * e.g. "High charisma, emotional performance, and physical-performance
 * demands." (section 6). dramaticDepth/audienceAccessibility/
 * distinctiveness/merchandisePotential deliberately aren't shown here -
 * they're not things an actor's own stats can satisfy.
 */
export function describeCharacterDemands(character: ScriptCharacter): string {
  const { traits } = character;
  const entries: Array<[label: string, value: number]> = [
    ['charisma', traits.charismaDemand],
    ['emotional performance', traits.emotionalDemand],
    ['comedy', traits.comedyDemand],
    ['physical performance', traits.physicalDemand],
    ['transformation', traits.transformationDemand],
  ];
  const top = entries
    .filter(([, value]) => value >= CHARACTER_DEMAND_NOTABLE)
    .sort((a, b) => b[1] - a[1])
    .slice(0, CHARACTER_DEMAND_MAX_NOTES);
  if (top.length === 0) return 'No standout role demands.';
  return `High ${top.map(([label]) => label).join(', ')} demand${top.length > 1 ? 's' : ''}.`;
}
