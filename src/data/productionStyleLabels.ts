import type { EffectsMethodKey, EnvironmentMethodKey } from '../types';

// Compact labels for a dominant lean (dominantLean, engine/recommendation.ts)
// - "Leans {env}, {effects}." Shared between a director candidate's card
// (RoleHiringDrawer) and a screenplay's own implied approach (DevelopFilm),
// so the same wording describes both sides of the comparison a player is
// implicitly making: does this director's lean actually suit this script's.
export const ENV_LEAN_SHORT: Record<EnvironmentMethodKey, string> = { studio: 'studio', location: 'location', digital: 'digital worldbuilding' };
export const EFFECTS_LEAN_SHORT: Record<EffectsMethodKey, string> = { practical: 'practical effects', digital: 'digital effects' };
