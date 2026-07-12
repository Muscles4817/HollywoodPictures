// Pure, non-React derivations from a Script's own concept, shared between
// every screen that needs to describe it in prose rather than raw numbers
// (docs/DESIGN.md - screenplay redesign). Extracted out of
// components/wizard/DevelopFilm.tsx (the first place these existed) once a
// second consumer (components/common/ScriptSummaryCard.tsx) needed the same
// logic - kept here, not in a component file, since neither function
// touches JSX.
import { deriveCommercialProfile } from './commercialProfile';
import type { Script } from '../types';

// Threshold-to-tag mapping - drawn from the screenplay's own concept
// (ProductionRequirements plus Setting/Story Type/Scale, never randomly),
// answering "why is this production difficult or expensive" in concrete,
// actionable terms instead of an abstract lean summary.
//
// A couple of the illustrative tags from the original design brief (child
// actors, underwater filming) don't have an honest source in the current
// model - nothing about a screenplay signals "shoots underwater," and
// Coming of Age implies a young cast in general, not specifically child
// actors - so they're approximated (`Young Cast`) or left out entirely
// rather than fabricated. See docs/DESIGN.md for the full list of what
// maps to what.
const HEAVY = 0.5;
const NOTABLE = 0.4;
export function productionRequirementTags(script: Script): string[] {
  const req = script.productionRequirements;
  const tags: string[] = [];

  if (req.periodSetting) tags.push('Period Costumes', 'Period Sets');
  if (script.setting === 'Space') tags.push('Spacecraft Sets');
  else if (script.setting === 'Fantasy') tags.push('Constructed Worlds');
  else if (script.setting === 'SciFi' && req.locations >= HEAVY) tags.push('Remote Locations');

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

  if (!req.periodSetting && script.setting !== 'Space' && script.setting !== 'Fantasy' && req.locations >= HEAVY) {
    tags.push('Large Locations');
  }

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
