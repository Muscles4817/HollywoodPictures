import type { WizardStep } from '../types';

// Fixed in-game days spent leaving a wizard stage, charged once when the
// player moves on to the next one (state/studioReducer.ts:GO_TO_STEP) -
// deliberately not modeled as anything the player watches happen (that's
// what Principal Photography is for, see
// engine/production.ts:computeRecommendedShootDays and PhotographyState).
//
// Producer Workspace redesign (PRODUCER_WORKSPACE_DESIGN.md) already
// retired this pattern for develop/talent/production-planning: free
// navigation between Producer Workspace sections has no fixed forward order
// left to charge a per-stage lump sum against, so all of pre-production's
// calendar cost moved to a single scaled charge at Greenlight instead
// (engine/production.ts:computeRecommendedPreProductionDays).
//
// Post-Production Redesign, Phase C (docs/DESIGN_REVIEW_post_production_redesign.md
// section 3) retires the last two entries here for the identical reason -
// once Marketing is reachable independently of post-production completion,
// there's no `GO_TO_STEP` "leaving this stage" transition left to hang a
// flat 45/30-day charge off of. The real calendar cost of getting a film
// ready now comes from `computeRecommendedPostProductionDays` (the
// estimate `FINISH_PHOTOGRAPHY` computes, read as SCHEDULE_RELEASE's own
// floor - state/studioReducer.ts) instead of a fixed post-hoc charge for
// leaving a screen. Kept as an empty, still-typed constant rather than
// deleted outright - `GO_TO_STEP`'s own `STAGE_DURATIONS[leavingStage]`
// lookup stays generically correct (every step now costs nothing to leave,
// which is the whole point) without needing its own rewrite; a future
// phase that retires the WizardStep screens entirely (§5's Post-Wrap
// Workspace) is the natural point to remove this file for good.
export const STAGE_DURATIONS: Partial<Record<WizardStep, number>> = {};
