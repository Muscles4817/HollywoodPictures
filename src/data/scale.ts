import type { NormalizedScalar, ScriptScale } from '../types';

// How big a production this screenplay implies - cast size, location count,
// crowd work, cost. Orthogonal to genre and story type: an Intimate Sports
// story (a small two-hander about one athlete) and an Epic Sports story (a
// full tournament, packed stadiums) are both "Sports," just very different
// productions.
export interface ScriptScaleProfile {
  description: string;
  castMultiplier: number; // multiplies the base Lead/Supporting weighted-pick result
  extrasFloor: NormalizedScalar; // minimum extras intensity regardless of story type
  locationsFloor: NormalizedScalar;
  crowdWorkFloor: NormalizedScalar;
  // Script acquisition cost is deliberately NOT a field here any more. A bigger
  // concept does cost more to option, but it does so because it can EARN more -
  // which `reach` below already says, and which
  // engine/scriptGenerator.ts:estimateScriptCost now prices off directly. A
  // separate costMultiplier alongside it charged for scale twice.
  reach: number; // 0-100, commercial-accessibility contribution (engine/commercialProfile.ts) - and, through it, acquisition cost
}

export const SCRIPT_SCALES: ScriptScale[] = ['Intimate', 'Medium', 'Epic'];

export const SCRIPT_SCALE_PROFILES: Record<ScriptScale, ScriptScaleProfile> = {
  Intimate: {
    description: 'A small, contained production - a handful of characters and locations.',
    castMultiplier: 0.8, extrasFloor: 0, locationsFloor: 0, crowdWorkFloor: 0, reach: 35,
  },
  Medium: {
    description: 'A conventional, moderately-scoped production.',
    castMultiplier: 1.0, extrasFloor: 0.15, locationsFloor: 0.2, crowdWorkFloor: 0.05, reach: 55,
  },
  Epic: {
    description: 'A large-scale, ambitious production - big cast, many locations, real crowd coordination.',
    castMultiplier: 1.25, extrasFloor: 0.5, locationsFloor: 0.55, crowdWorkFloor: 0.35, reach: 80,
  },
};
