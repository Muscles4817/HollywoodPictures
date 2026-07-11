// Milestone 4 of the audience-based box office redesign (docs/DESIGN.md
// 5.34) - "Outcome Inspector and model comparison." Two things live here,
// both dev-only reporting concerns that deliberately sit *outside*
// Milestones 1-3's isolated engine files rather than inside them:
//
//   1. The people -> money boundary conversion (AVERAGE_TICKET_PRICE,
//      buildWeeklyReport) - engine/audienceSimulationStep.ts's own header
//      says it best: "model people, not money... until the very last
//      step, where tickets sold x price = revenue converts the
//      simulation's output into money once, at the boundary." This file
//      is that boundary. Milestones 1-3 never needed it (their tests
//      reason entirely in admissions); Milestone 4's Outcome Inspector
//      explicitly wants weekly/cumulative *gross*, so it has to exist
//      somewhere - here, not inside the step module, keeps that module's
//      "no money" promise intact.
//   2. Running the old (engine/boxOffice.ts) and new (Milestones 1-3)
//      models against the same representative scenario matrix, so the two
//      can be compared side by side before anything about the old model
//      is removed (see docs/DESIGN.md's Milestone 4 note for the actual
//      comparison and which differences are intentional).
//
// Neither model is wired into the live game any differently by this file
// - state/studioReducer.ts still runs engine/boxOffice.ts unchanged, and
// nothing here is called from anywhere except components/dev/OutcomeInspector.tsx.

import type { Genre, ReleaseWindow, TargetAudience } from '../types';
import {
  computeOpeningWeekend,
  computeLegs,
  computeWeeklyRetention,
  projectTotalGross,
  MAX_WEEKS,
  MIN_WEEKLY_GROSS_RATIO,
} from './boxOffice';
import { createRng } from './random';
import { deriveAudienceSimulationFixedState, type ReleaseSimulationInputs, type SupportedReleaseType } from './audienceSimulationInputs';
import { advanceToWeekWithDiagnostics, MAX_SIMULATION_WEEKS, type WeekDiagnostics } from './audienceSimulationStep';

// --- The people -> money boundary -------------------------------------------

// A single flat average ticket price, deliberately simple - real-world
// average ticket prices vary by market/format/time, but this model has no
// per-market or per-format breakdown yet (see DESIGN.md 5.34's "where
// international markets slot in later"), so one constant is honest about
// what's actually being modeled. Picked so a maxed-out "genuine global
// phenomenon" scenario (Milestone 3's own top-of-range diagnostic - tens
// of millions of admissions inside a ~40M-person addressable audience)
// lands in a broadly comparable pounds range to the old model's own
// maxed-out OPENING_BASE_POTENTIAL (engine/boxOffice.ts, £24,000,000)
// once summed across a full run - not tuned further than that.
export const AVERAGE_TICKET_PRICE = 11;

export interface WeekReport extends WeekDiagnostics {
  weeklyGross: number;
  cumulativeGross: number;
}

/** Milestone 4's only money-touching step: WeekDiagnostics (people/probabilities) -> WeekReport (adds gross), one multiplication, nothing else recomputed. */
export function buildWeeklyReport(diagnostics: WeekDiagnostics[]): WeekReport[] {
  return diagnostics.map((d) => ({
    ...d,
    weeklyGross: d.weeklyAdmissions * AVERAGE_TICKET_PRICE,
    cumulativeGross: d.cumulativeTicketsSold * AVERAGE_TICKET_PRICE,
  }));
}

// --- "Why did this film do that" - a plain-language shape diagnosis --------
//
// The milestone brief: the inspector should make it obvious why a film
// opened strongly, collapsed, grew, plateaued, or remained niche. Reasons
// entirely in admissions (people), not gross - the shape a run took is a
// property of the simulation itself, not of whatever ticket price happens
// to be assumed on top of it. Labels aren't mutually exclusive (a film can
// open strongly *and* collapse; a niche film can also grow slowly) -
// returns every label that applies, each with the concrete numbers behind
// it so a look at the table below can verify the claim, not just take the
// label's word for it.
export interface ShapeDiagnosis {
  label: 'Opened strongly' | 'Collapsed' | 'Grew' | 'Plateaued' | 'Remained niche';
  detail: string;
}

const STRONG_OPENING_CEILING_SHARE = 0.05; // week 1 admissions >= 5% of the realistic (natural + crossover) ceiling
const COLLAPSE_RETENTION_THRESHOLD = 0.6; // by the comparison week, admissions have fallen below 60% of the opening - checked against actual front-loaded/poor-reception diagnostics (~15%/week decline compounds to ~52% by week 5, not the much steeper single-week cliffs a fixed-legs model produces)
const COLLAPSE_CHECK_WEEK = 5;
const PLATEAU_BAND = 0.15; // the last few weeks stay within +/-15% of each other
const PLATEAU_MIN_WEEKS = 4;
const NICHE_AUDIENCE_SHARE = 0.05; // total admissions never exceeds 5% of the whole addressable audience

export function diagnoseRunShape(fixed: { totalAddressableAudience: number }, ceiling: number, diagnostics: WeekDiagnostics[]): ShapeDiagnosis[] {
  if (diagnostics.length === 0) return [];
  const admissions = diagnostics.map((d) => d.weeklyAdmissions);
  const opening = admissions[0];
  const total = diagnostics[diagnostics.length - 1].cumulativeTicketsSold;
  const results: ShapeDiagnosis[] = [];

  if (ceiling > 0 && opening / ceiling >= STRONG_OPENING_CEILING_SHARE) {
    results.push({ label: 'Opened strongly', detail: `Week 1 sold ${Math.round(opening).toLocaleString()} admissions - ${((opening / ceiling) * 100).toFixed(1)}% of this film's realistic ceiling in a single week.` });
  }

  const collapseWeek = Math.min(COLLAPSE_CHECK_WEEK, admissions.length) - 1;
  if (collapseWeek > 0 && opening > 0 && admissions[collapseWeek] < opening * COLLAPSE_RETENTION_THRESHOLD) {
    results.push({
      label: 'Collapsed',
      detail: `By week ${collapseWeek + 1}, admissions had fallen to ${((admissions[collapseWeek] / opening) * 100).toFixed(1)}% of the opening week, with no word-of-mouth replenishment strong enough to offset it.`,
    });
  }

  const peakIndex = admissions.reduce((best, v, i) => (v > admissions[best] ? i : best), 0);
  if (peakIndex > 0 && admissions[peakIndex] > opening) {
    results.push({
      label: 'Grew',
      detail: `Week ${peakIndex + 1} (${Math.round(admissions[peakIndex]).toLocaleString()} admissions) sold more than the opening week (${Math.round(opening).toLocaleString()}) - word of mouth pulled in more people than the release-day push alone reached.`,
    });
  }

  if (admissions.length >= PLATEAU_MIN_WEEKS) {
    const tail = admissions.slice(-PLATEAU_MIN_WEEKS);
    const tailMax = Math.max(...tail);
    const tailMin = Math.min(...tail);
    if (tailMax > 0 && (tailMax - tailMin) / tailMax <= PLATEAU_BAND && tailMax < admissions[peakIndex]) {
      results.push({ label: 'Plateaued', detail: `Its final ${PLATEAU_MIN_WEEKS} weeks stayed within ${(PLATEAU_BAND * 100).toFixed(0)}% of each other, well past its peak - neither still growing nor collapsing.` });
    }
  }

  if (fixed.totalAddressableAudience > 0 && total / fixed.totalAddressableAudience < NICHE_AUDIENCE_SHARE) {
    results.push({
      label: 'Remained niche',
      detail: `Total admissions (${Math.round(total).toLocaleString()}) never reached ${(NICHE_AUDIENCE_SHARE * 100).toFixed(0)}% of this film's whole addressable audience (${Math.round(fixed.totalAddressableAudience).toLocaleString()}), regardless of how well it was received.`,
    });
  }

  return results;
}

// --- Old-versus-new comparison -----------------------------------------------

/**
 * Everything both models need for one scenario, as a single input bundle -
 * the old model (engine/boxOffice.ts) only reads a subset of these fields
 * (see toOldModelInput below); the new model (engine/audienceSimulationInputs.ts)
 * reads all of them. Kept as one bundle rather than two separate scenario
 * shapes so a comparison can never accidentally compare the two models
 * against subtly different releases.
 */
export interface ComparisonScenario {
  name: string;
  description: string;
  buzzScore: number;
  marketingSpend: number;
  scriptMarketability: number;
  scriptOriginality: number;
  scriptIntendedAudience: TargetAudience;
  targetAudience: TargetAudience;
  genre: Genre;
  releaseWindow: ReleaseWindow;
  releaseType: SupportedReleaseType;
  criticScore: number;
  audienceScore: number;
}

function toNewModelInput(scenario: ComparisonScenario): ReleaseSimulationInputs {
  const { name: _name, description: _description, ...inputs } = scenario;
  return inputs;
}

export interface ModelRunResult {
  openingGross: number;
  /** Gross per week, week 1 first - the old model's is a smooth geometric decay by construction (computeWeeklyRetention); the new model's is whatever admissions the simulation actually produced that week, converted at AVERAGE_TICKET_PRICE. */
  weeklyTrajectory: number[];
  totalGross: number;
  /** Total gross / opening gross - computed after the fact from the trajectory above for both models, exactly how DESIGN.md 5.34 defines legs for the new model ("never an input... computed after a run finishes"); for the old model this is engine/boxOffice.ts:computeLegs's own value, restated the same way for a fair side-by-side. */
  legs: number;
  runWeeks: number;
}

/**
 * Runs engine/boxOffice.ts's Opening Weekend/Legs model against a
 * scenario, using a fixed rng seed - the same deterministic-comparison
 * need components/dev/OutcomeInspector.tsx's existing variance-seed
 * pattern already established, so a comparison run is reproducible rather
 * than jittering on every call. Kept as its own temporary diagnostic path
 * (per this milestone's brief) - not touched, not removed, only read from.
 */
export function runOldModel(scenario: ComparisonScenario, rngSeed = 1): ModelRunResult {
  const rng = createRng(rngSeed);
  const openingWeekend = computeOpeningWeekend(
    {
      buzzScore: scenario.buzzScore,
      targetAudience: scenario.targetAudience,
      genre: scenario.genre,
      releaseWindow: scenario.releaseWindow,
      releaseType: scenario.releaseType,
    },
    rng,
  );
  const legs = computeLegs(scenario.criticScore, scenario.audienceScore, scenario.releaseType);
  const retention = computeWeeklyRetention(legs);

  // Mirrors projectTotalGross's own loop (engine/boxOffice.ts) exactly -
  // same MAX_WEEKS/MIN_WEEKLY_GROSS_RATIO cutoff - but also keeps the
  // per-week figures projectTotalGross itself discards, since the
  // trajectory is what this milestone's comparison needs. Verified in
  // audienceSimulationReporting.test.ts to sum to the same total
  // projectTotalGross computes independently, so this can never silently
  // drift from the real model's own total.
  const weeklyTrajectory = [openingWeekend];
  let weekGross = openingWeekend;
  let week = 1;
  while (week < MAX_WEEKS && weekGross * retention >= openingWeekend * MIN_WEEKLY_GROSS_RATIO) {
    weekGross *= retention;
    weeklyTrajectory.push(weekGross);
    week++;
  }

  const totalGross = projectTotalGross(openingWeekend, retention);
  return {
    openingGross: openingWeekend,
    weeklyTrajectory,
    totalGross,
    legs: openingWeekend > 0 ? totalGross / openingWeekend : 0,
    runWeeks: weeklyTrajectory.length,
  };
}

/** Runs Milestones 1-3's audience simulation against the same scenario, converting admissions to gross only at the very end (see buildWeeklyReport above). */
export function runNewModel(scenario: ComparisonScenario): ModelRunResult {
  const fixed = deriveAudienceSimulationFixedState(toNewModelInput(scenario));
  const { diagnostics } = advanceToWeekWithDiagnostics(fixed, [], MAX_SIMULATION_WEEKS);
  const report = buildWeeklyReport(diagnostics);
  const weeklyTrajectory = report.map((r) => r.weeklyGross);
  const openingGross = weeklyTrajectory[0] ?? 0;
  const totalGross = report.length > 0 ? report[report.length - 1].cumulativeGross : 0;
  return {
    openingGross,
    weeklyTrajectory,
    totalGross,
    legs: openingGross > 0 ? totalGross / openingGross : 0,
    runWeeks: report.length,
  };
}

export interface ModelComparison {
  scenario: ComparisonScenario;
  old: ModelRunResult;
  new: ModelRunResult;
}

/** Runs both models against every scenario in a matrix and returns them paired up, ready for a side-by-side table - no interpretation here, that's docs/DESIGN.md's Milestone 4 note and the Outcome Inspector's job. */
export function compareModels(scenarios: ComparisonScenario[], rngSeed = 1): ModelComparison[] {
  return scenarios.map((scenario) => ({
    scenario,
    old: runOldModel(scenario, rngSeed),
    new: runNewModel(scenario),
  }));
}

// --- The representative scenario matrix -------------------------------------
//
// Deliberately reuses the same named-archetype spirit as Milestone 3's own
// test scenarios (audienceSimulationInputs.test.ts) - not identical inputs
// (this milestone needs old-model-compatible fields too: targetAudience/
// genre/releaseWindow/releaseType/buzzScore/criticScore/audienceScore),
// but the same handful of shapes: a blockbuster, a prestige/arthouse
// release, a mid-tier film, and a flop, so the comparison spans the range
// both models are meant to handle.
export const REPRESENTATIVE_SCENARIO_MATRIX: ComparisonScenario[] = [
  {
    name: 'Summer blockbuster',
    description: 'Mass Market, Wide, huge Buzz and marketing, strong reception.',
    buzzScore: 90,
    marketingSpend: 100_000_000,
    scriptMarketability: 80,
    scriptOriginality: 40,
    scriptIntendedAudience: 'Mass Market',
    targetAudience: 'Mass Market',
    genre: 'Action',
    releaseWindow: 'Summer',
    releaseType: 'Wide',
    criticScore: 78,
    audienceScore: 85,
  },
  {
    name: 'Prestige awards play',
    description: 'Critics audience, Festival First, modest marketing, exceptional reception.',
    buzzScore: 25,
    marketingSpend: 2_000_000,
    scriptMarketability: 55,
    scriptOriginality: 65,
    scriptIntendedAudience: 'Critics',
    targetAudience: 'Critics',
    genre: 'Drama',
    releaseWindow: 'Awards Season',
    releaseType: 'Festival First',
    criticScore: 92,
    audienceScore: 84,
  },
  {
    name: 'Mid-tier ordinary film',
    description: 'Adults audience, Wide, moderate everything.',
    buzzScore: 45,
    marketingSpend: 15_000_000,
    scriptMarketability: 50,
    scriptOriginality: 35,
    scriptIntendedAudience: 'Adults',
    targetAudience: 'Adults',
    genre: 'Thriller',
    releaseWindow: 'Quiet Month',
    releaseType: 'Wide',
    criticScore: 55,
    audienceScore: 58,
  },
  {
    name: 'Overhyped flop',
    description: 'Wide, large marketing spend and Buzz, but the film itself is poorly received.',
    buzzScore: 80,
    marketingSpend: 80_000_000,
    scriptMarketability: 60,
    scriptOriginality: 30,
    scriptIntendedAudience: 'Mass Market',
    targetAudience: 'Mass Market',
    genre: 'Sci-Fi',
    releaseWindow: 'Quiet Month',
    releaseType: 'Wide',
    criticScore: 22,
    audienceScore: 18,
  },
  {
    name: 'Small indie sleeper',
    description: 'Niche audience, Limited release, tiny marketing spend, real originality and strong reception.',
    buzzScore: 12,
    marketingSpend: 300_000,
    scriptMarketability: 30,
    scriptOriginality: 75,
    scriptIntendedAudience: 'Niche',
    targetAudience: 'Niche',
    genre: 'Horror',
    releaseWindow: 'Halloween',
    releaseType: 'Limited',
    criticScore: 88,
    audienceScore: 90,
  },
];
