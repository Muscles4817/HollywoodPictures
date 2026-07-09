import type { WizardStep } from '../types';

// Fixed in-game days spent leaving each wizard stage - negotiating cast
// deals, editing, running up to release, etc. Deliberately not modeled as
// anything the player watches happen (that's what Principal Photography is
// for, see engine/production.ts:computeRecommendedShootDays and
// PhotographyState) - these are flat costs applied once, when the player
// moves on to the next stage. No entry for 'production' or 'results':
// photography's days accrue one at a time as they're actually lived through
// (state/studioReducer.ts:ADVANCE_SHOOTING_DAY), and there's nothing after
// 'results' to advance away from.
export const STAGE_DURATIONS: Partial<Record<WizardStep, number>> = {
  develop: 7,
  talent: 14,
  'production-planning': 5,
  'post-production': 45,
  marketing: 30,
};
