// Originally Milestone 4 of the audience-based box office redesign
// (docs/DESIGN.md 5.34) - "Outcome Inspector and model comparison." Since
// Milestone 5 wired the audience simulation into live settlement and
// retired the old fixed-legs model entirely (engine/boxOffice.ts is gone),
// this file's job narrowed to one thing: dev-only weekly reporting for
// components/dev/OutcomeInspector.tsx - a plain-language "why did this run
// do that" (diagnoseRunShape) plus a representative scenario matrix for
// spot-checking the live model's shape without needing a real save. The
// people -> money boundary conversion itself (AVERAGE_TICKET_PRICE) now
// lives in engine/boxOfficeRun.ts, since live settlement needs it too -
// this file imports it from there rather than defining its own, so there's
// one ticket price, not two.
//
// The Milestone 4 old-vs-new comparison this file used to run
// (runOldModel/compareModels against engine/boxOffice.ts) served its
// purpose - the actual comparison and analysis are preserved permanently in
// docs/DESIGN.md's Milestone 4 note, which is the "useful diagnostic
// fixture" Milestone 5's brief asked to keep. The *code* that produced it
// depended entirely on the old model's functions, which no longer exist -
// removed alongside them rather than kept around unable to run.

import { advanceToWeekWithDiagnostics, MAX_SIMULATION_WEEKS, type WeekDiagnostics } from './audienceSimulationStep';
import { deriveAudienceSimulationFixedState, type ReleaseSimulationInputs } from './audienceSimulationInputs';
import { AVERAGE_TICKET_PRICE } from './boxOfficeRun';

export { AVERAGE_TICKET_PRICE };

export interface WeekReport extends WeekDiagnostics {
  weeklyGross: number;
  cumulativeGross: number;
}

/** WeekDiagnostics (people/probabilities) -> WeekReport (adds gross), one multiplication, nothing else recomputed. */
export function buildWeeklyReport(diagnostics: WeekDiagnostics[]): WeekReport[] {
  return diagnostics.map((d) => ({
    ...d,
    weeklyGross: d.weeklyAdmissions * AVERAGE_TICKET_PRICE,
    cumulativeGross: d.cumulativeTicketsSold * AVERAGE_TICKET_PRICE,
  }));
}

// --- "Why did this film do that" - a plain-language shape diagnosis --------
//
// The Milestone 4 brief: the inspector should make it obvious why a film
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

// --- A representative scenario matrix ---------------------------------------
//
// Five named archetypes (a blockbuster, a prestige/arthouse release, a
// mid-tier film, a flop, an indie sleeper) spanning the range the live
// model needs to handle - useful for spot-checking behavior in the Outcome
// Inspector without needing a real save on hand. Originally built for
// Milestone 4's old-vs-new comparison; kept for that reason alone now that
// there's only one model to run it against.
export interface ReportingScenario extends ReleaseSimulationInputs {
  name: string;
  description: string;
}

export interface ModelRunResult {
  openingGross: number;
  /** Gross per week, week 1 first - whatever admissions the simulation actually produced that week, converted at AVERAGE_TICKET_PRICE. */
  weeklyTrajectory: number[];
  totalGross: number;
  /** Total gross / opening gross - computed after the fact, exactly how DESIGN.md 5.34 defines legs ("never an input... computed after a run finishes"). */
  legs: number;
  runWeeks: number;
}

/** Runs the live audience simulation against a scenario, converting admissions to gross only at the very end (see buildWeeklyReport above). */
export function runModel(scenario: ReportingScenario): ModelRunResult {
  const { name: _name, description: _description, ...inputs } = scenario;
  const fixed = deriveAudienceSimulationFixedState(inputs);
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

export const REPRESENTATIVE_SCENARIO_MATRIX: ReportingScenario[] = [
  {
    name: 'Summer blockbuster',
    description: 'Mass Market, Wide, huge Buzz and marketing, strong reception.',
    buzzScore: 90,
    marketingSpend: 100_000_000,
    directorFame: 80,
    leadFame: 85,
    studioReputation: 75,
    scriptAccessibility: 80,
    scriptHookStrength: 75,
    scriptOriginality: 40,
    scriptSpectacle: 85,
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
    directorFame: 60,
    leadFame: 55,
    studioReputation: 60,
    scriptAccessibility: 55,
    scriptHookStrength: 40,
    scriptOriginality: 65,
    scriptSpectacle: 20,
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
    directorFame: 45,
    leadFame: 50,
    studioReputation: 45,
    scriptAccessibility: 50,
    scriptHookStrength: 50,
    scriptOriginality: 35,
    scriptSpectacle: 35,
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
    directorFame: 70,
    leadFame: 75,
    studioReputation: 65,
    scriptAccessibility: 60,
    scriptHookStrength: 65,
    scriptOriginality: 30,
    scriptSpectacle: 70,
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
    directorFame: 20,
    leadFame: 15,
    studioReputation: 25,
    scriptAccessibility: 30,
    scriptHookStrength: 45,
    scriptOriginality: 75,
    scriptSpectacle: 30,
    scriptIntendedAudience: 'Niche',
    targetAudience: 'Niche',
    genre: 'Horror',
    releaseWindow: 'Halloween',
    releaseType: 'Limited',
    criticScore: 88,
    audienceScore: 90,
  },
];
