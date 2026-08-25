// When will this film actually be ready? (docs/DESIGN_REVIEW_project_clocks_and_script_openness.md
// section 9.)
//
// This is what finally connects the release clock back to DEVELOPMENT. A
// rewrite costs days; days push the shoot; the shoot pushes post; post pushes
// delivery - and if delivery lands past the date a campaign has been booked
// against, the studio is choosing between moving (and writing the campaign off)
// and releasing a film it has not finished.
//
// Without this the two halves of the phase never met: section 4.8 measured that
// waiting cost almost nothing, because the only thing that expired was talent
// and talent is substitutable. A release date with money pointed at it is not.
//
// Every term is the SAME estimator the real pipeline uses
// (engine/production.ts), never a parallel guess - so the projection cannot
// drift from what actually happens.
import type { FilmDraft, GameDay, ProductionChoices, Script } from '../types';
import {
  computeRecommendedPostProductionDays,
  computeRecommendedPreProductionDays,
  computeRecommendedShootDays,
} from './production';
import { logAmount } from './interpolate';
import {
  ENVIRONMENT_BUDGET_RANGE,
  PRACTICAL_EFFECTS_RANGE,
  SHOOTING_BUDGET_RANGE,
  VFX_RANGE,
} from '../data/production';

// Before Production Planning there are no dials to read, but this is exactly
// when "one more rewrite" is most tempting - so refusing to estimate would
// silence the warning in the case that needs it most. Instead assume the plan
// the script implies: ambition scaled to the script's own scale, standard
// runtime. Flagged `provisional` so the UI can say the estimate is a projection
// off an unmade plan rather than a schedule.
const NOMINAL_AMBITION_T: Record<Script['scale'], number> = { Intimate: 0.25, Medium: 0.45, Epic: 0.7 };

function nominalPlan(script: Script): ProductionChoices {
  const t = NOMINAL_AMBITION_T[script.scale];
  return {
    shootingBudgetAmount: logAmount(t, SHOOTING_BUDGET_RANGE),
    setQualityAmount: logAmount(t, ENVIRONMENT_BUDGET_RANGE),
    practicalEffectsAmount: logAmount(t, PRACTICAL_EFFECTS_RANGE),
    vfxAmount: logAmount(t, VFX_RANGE),
    runtimeIntensity: 0.5,
  };
}

export interface DeliveryEstimate {
  /** The day the finished film is expected to be ready to release. */
  readyOnDay: GameDay;
  /** Days between that and the announced date - negative means the film misses its own claim. */
  slackDays: number | null;
  /** What is still ahead, longest-pole first, for the player-facing account. */
  remaining: Array<{ label: string; days: number }>;
  /** True when the project has not been planned yet, so the plan was assumed. */
  provisional: boolean;
}

/**
 * Days still to run before the film could be released, from `today`.
 *
 * Deliberately reads phase by phase off the draft rather than assuming a fresh
 * project: a film already shooting does not owe its prep days again. A pass in
 * flight counts, which is the whole point - that is the rewrite showing up in
 * the release date.
 */
function remainingWork(
  draft: FilmDraft,
  today: GameDay,
  pendingPassReadyOn: GameDay | undefined,
  choices: ProductionChoices,
  script: Script,
): Array<{ label: string; days: number }> {
  const out: Array<{ label: string; days: number }> = [];

  // A development pass still running holds everything behind it.
  if (pendingPassReadyOn !== undefined && pendingPassReadyOn > today) {
    out.push({ label: 'Rewrite in progress', days: pendingPassReadyOn - today });
  }

  const prepDone = draft.preProduction !== null && draft.preProduction.status === 'finished';
  const shootDone = draft.photography !== null && draft.photography.status === 'finished';

  if (!prepDone && !shootDone) {
    const prepTotal = computeRecommendedPreProductionDays(draft.talent, script, choices);
    const prepElapsed = draft.preProduction?.daysElapsed ?? 0;
    out.push({ label: 'Pre-production', days: Math.max(0, prepTotal - prepElapsed) });
  }

  if (!shootDone) {
    const shootTotal = draft.photography?.recommendedDays
      ?? computeRecommendedShootDays(draft.talent, script, choices);
    const shootElapsed = draft.photography?.daysElapsed ?? 0;
    out.push({ label: 'Principal photography', days: Math.max(0, shootTotal - shootElapsed) });
  }

  // Post is only owed until its own clock has been set and run out.
  const postReady = draft.postProductionFinalReadyDay;
  if (postReady === null || postReady === undefined) {
    out.push({
      label: 'Post-production',
      days: computeRecommendedPostProductionDays(draft.talent, script, choices),
    });
  } else if (postReady > today) {
    out.push({ label: 'Post-production', days: postReady - today });
  }

  return out.filter((step) => step.days > 0);
}

/**
 * When this film is expected to be ready, and how that sits against the date it
 * has claimed. `slackDays` is null when nothing has been announced - there is no
 * promise to be early or late for.
 */
export function estimateDelivery(draft: FilmDraft, today: GameDay, pendingPassReadyOn?: GameDay): DeliveryEstimate {
  const script = draft.script;
  const announced = draft.announcedReleaseDay;
  // No script, no pipeline to project: everything downstream is priced off it.
  if (!script) {
    return {
      readyOnDay: today,
      slackDays: announced === undefined ? null : announced - today,
      remaining: [],
      provisional: true,
    };
  }
  const provisional = draft.productionChoices === null || draft.productionChoices === undefined;
  const choices = draft.productionChoices ?? nominalPlan(script);
  const remaining = remainingWork(draft, today, pendingPassReadyOn, choices, script);
  const readyOnDay = today + remaining.reduce((sum, step) => sum + step.days, 0);
  return {
    readyOnDay,
    slackDays: announced === undefined ? null : announced - readyOnDay,
    remaining,
    provisional,
  };
}

/**
 * A player-facing read of whether the film makes its own claim. Qualitative by
 * house rule (CLAUDE.md), and named rather than numeric, so the warning is
 * something to reason about rather than a threshold to game.
 */
export type DeliveryStanding = 'no-claim' | 'comfortable' | 'tight' | 'at-risk' | 'missed';

/** Below this many days of slack the date starts to look tight rather than safe. */
const TIGHT_SLACK_DAYS = 45;
/** And below this, a single bad week of shooting takes the date away. */
const AT_RISK_SLACK_DAYS = 14;

export function deliveryStanding(estimate: DeliveryEstimate): DeliveryStanding {
  if (estimate.slackDays === null) return 'no-claim';
  if (estimate.slackDays < 0) return 'missed';
  if (estimate.slackDays < AT_RISK_SLACK_DAYS) return 'at-risk';
  if (estimate.slackDays < TIGHT_SLACK_DAYS) return 'tight';
  return 'comfortable';
}

const STANDING_LABELS: Record<DeliveryStanding, string> = {
  'no-claim': 'No date claimed',
  comfortable: 'Comfortably ahead of the date',
  tight: 'Tight against the date',
  'at-risk': 'At risk of missing the date',
  missed: 'Will not make the date',
};

export function describeDeliveryStanding(estimate: DeliveryEstimate): string {
  return STANDING_LABELS[deliveryStanding(estimate)];
}

/**
 * Severity ordering, so a caller can ask "did this decision make the date
 * worse?" without re-deriving the ladder. `no-claim` sits at the bottom: with
 * nothing announced there is nothing to lose.
 */
export const DELIVERY_STANDING_SEVERITY: Record<DeliveryStanding, number> = {
  'no-claim': 0,
  comfortable: 1,
  tight: 2,
  'at-risk': 3,
  missed: 4,
};

/** Would taking this decision move the film to a worse footing against its own date? */
export function standingWorsens(before: DeliveryEstimate, after: DeliveryEstimate): boolean {
  return DELIVERY_STANDING_SEVERITY[deliveryStanding(after)] > DELIVERY_STANDING_SEVERITY[deliveryStanding(before)];
}
