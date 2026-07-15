import type { WizardStep } from '../types';

// Fixed in-game days spent leaving each remaining wizard stage - editing,
// running up to release, etc. Deliberately not modeled as anything the
// player watches happen (that's what Principal Photography is for, see
// engine/production.ts:computeRecommendedShootDays and PhotographyState) -
// these are flat costs applied once, when the player moves on to the next
// stage. No entry for 'production' or 'results': photography's days accrue
// one at a time as they're actually lived through
// (state/studioReducer.ts:ADVANCE_SHOOTING_DAY), and there's nothing after
// 'results' to advance away from.
//
// Producer Workspace redesign (PRODUCER_WORKSPACE_DESIGN.md): used to also
// have develop/talent/production-planning entries, charged one at a time as
// the player left each wizard stage going forward (GO_TO_STEP,
// state/studioReducer.ts) - that only worked because the pre-greenlight
// wizard had a fixed forward order. Free navigation between Producer
// Workspace sections breaks that premise, so all of pre-production's
// calendar cost is now charged as a single lump sum at Greenlight instead
// (engine/production.ts:computeRecommendedPreProductionDays), scaled to the
// project's own scope rather than a flat total for every film.
export const STAGE_DURATIONS: Partial<Record<WizardStep, number>> = {
  'post-production': 45,
  marketing: 30,
};
