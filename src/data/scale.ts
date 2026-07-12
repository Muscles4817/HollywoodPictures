import type { NormalizedScalar, ScriptScale } from '../types';

// How big a production this screenplay implies - cast size, location count,
// crowd work, cost. Orthogonal to genre and story type: an Intimate Sports
// story (a small two-hander about one athlete) and an Epic Sports story (a
// full tournament, packed stadiums) are both "Sports," just very different
// productions.
export interface ScriptScaleProfile {
  description: string;
  costMultiplier: number; // applied to script acquisition cost - a bigger-scoped concept costs more to option
  castMultiplier: number; // multiplies the base Lead/Supporting weighted-pick result
  extrasFloor: NormalizedScalar; // minimum extras intensity regardless of story type
  locationsFloor: NormalizedScalar;
  crowdWorkFloor: NormalizedScalar;
  reach: number; // 0-100, commercial-accessibility contribution (engine/commercialProfile.ts)
}

export const SCRIPT_SCALES: ScriptScale[] = ['Intimate', 'Medium', 'Epic'];

export const SCRIPT_SCALE_PROFILES: Record<ScriptScale, ScriptScaleProfile> = {
  Intimate: {
    description: 'A small, contained production - a handful of characters and locations.',
    costMultiplier: 0.55, castMultiplier: 0.8, extrasFloor: 0, locationsFloor: 0, crowdWorkFloor: 0, reach: 35,
  },
  Medium: {
    description: 'A conventional, moderately-scoped production.',
    costMultiplier: 1.0, castMultiplier: 1.0, extrasFloor: 0.15, locationsFloor: 0.2, crowdWorkFloor: 0.05, reach: 55,
  },
  Epic: {
    description: 'A large-scale, ambitious production - big cast, many locations, real crowd coordination.',
    costMultiplier: 1.9, castMultiplier: 1.25, extrasFloor: 0.5, locationsFloor: 0.55, crowdWorkFloor: 0.35, reach: 80,
  },
};
