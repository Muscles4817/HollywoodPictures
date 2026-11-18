// Prep's four decision points and what each fix costs
// (docs/DESIGN_REVIEW_preproduction_realism.md §4.4, §1.5).
//
// A producer faces prep's problems at real milestones - the first budget and
// board, design and locations lock, tests and rehearsal, the production meeting
// (04 §1.2) - not one at a time as they surface. At each, every found and
// unanswered problem is on the table with the fixes still open to it, each
// priced in the film's own currency: money (in the film's shooting days), prep
// days (which move the shoot), or a smaller, chosen loss in a named department
// (the reference's "taking a pass"). Carrying it is always an option; it becomes
// a shoot incident (handoff.ts).
import type { PreProductionState, PrepProblem, ProductionEvent } from '../../types';
import { PREP_CHECKPOINTS, PREP_FIX_LABEL, PREP_PROBLEMS, PREP_SOLVED_SEVERITY, type PrepFixKind, type ShootImpact } from '../../data/prep';
import type { PrepContext } from './context';

export interface PricedFix {
  kind: PrepFixKind;
  label: string;
  /** Cash now. */
  money: number;
  /** Drawn from the contingency reserve instead of cash. */
  contingency: number;
  /** Prep days added. */
  prepDays: number;
  /** A chosen scope loss (<= 0, shoot-event quality units) in `impact`. */
  qualityLoss: number;
  impact?: ShootImpact;
  /** Severity left after it. */
  residual: number;
  /** Plain words: what this option is, for this problem. */
  text: string;
}

/** What carrying a problem of this severity would cost on the shoot (shoot days lost, money over, quality). */
export function carriedCost(problem: PrepProblem, ctx: PrepContext): { delayDays: number; overrunMoney: number; quality: number } {
  const inc = PREP_PROBLEMS[problem.kind].incident;
  return {
    delayDays: Math.round(inc.delayDays * problem.severity),
    overrunMoney: Math.round((inc.overrunShootDays ?? 0) * problem.severity * ctx.dailyShootBurn),
    quality: Math.round(inc.quality * problem.severity * 10) / 10,
  };
}

/** The four checkpoints' prep days for a prep of this length. */
export function checkpointDaysFor(prepDays: number): number[] {
  return PREP_CHECKPOINTS.map((c) => Math.max(1, Math.round(c.at * prepDays)));
}

/** Found problems nobody has answered yet. */
export function openProblems(prep: PreProductionState): PrepProblem[] {
  return prep.problems.filter((p) => p.foundOnDay !== null && p.resolution === null);
}

/** The fixes open to a problem at this point in prep (0..1 of it), priced; "carry it" last and always present. */
export function fixOptions(problem: PrepProblem, ctx: PrepContext, atShare: number): PricedFix[] {
  const spec = PREP_PROBLEMS[problem.kind];
  const sev = problem.severity;
  const options: PricedFix[] = [];
  for (const fix of spec.fixes) {
    if (fix.deadline !== undefined && atShare > fix.deadline) continue;
    const money = Math.round((fix.shootDaysOfMoney ?? 0) * sev * ctx.dailyShootBurn);
    const isContingency = fix.kind === 'contingency';
    if (isContingency && money > ctx.contingencyAvailable) continue;
    options.push({
      kind: fix.kind,
      label: PREP_FIX_LABEL[fix.kind],
      money: isContingency ? 0 : money,
      contingency: isContingency ? money : 0,
      prepDays: fix.prepDays ? Math.max(1, Math.round(fix.prepDays * sev)) : 0,
      qualityLoss: fix.scope ? Math.round(fix.scope.quality * sev * 10) / 10 : 0,
      impact: fix.scope?.impact,
      residual: sev * (1 - fix.remedy) <= PREP_SOLVED_SEVERITY ? 0 : sev * (1 - fix.remedy),
      text: fix.text,
    });
  }
  options.push({ kind: 'carry', label: PREP_FIX_LABEL.carry, money: 0, contingency: 0, prepDays: 0, qualityLoss: 0, residual: sev, text: spec.incident.text });
  return options;
}

export interface FixApplied {
  prep: PreProductionState;
  /** Cash to charge now. */
  cash: number;
  /** Drawn from the contingency reserve. */
  contingency: number;
}

/** Applies one fix. Prep grows by its days (and its checkpoints move with it); a cut leaves a typed event on the film. */
export function applyFix(prep: PreProductionState, problemId: string, fix: PricedFix, day: number, decidedBy: 'player' | 'team'): FixApplied {
  const problem = prep.problems.find((p) => p.id === problemId);
  if (!problem || problem.resolution) return { prep, cash: 0, contingency: 0 };
  const spec = PREP_PROBLEMS[problem.kind];
  const problems = prep.problems.map((p) =>
    p.id === problemId
      ? { ...p, severity: fix.residual, resolution: { option: fix.kind, day, costPaid: fix.money, daysAdded: fix.prepDays, contingencyUsed: fix.contingency, decidedBy } }
      : p,
  );
  const recommendedDays = prep.recommendedDays + fix.prepDays;
  const cut: ProductionEvent[] =
    fix.qualityLoss < 0 && fix.impact
      ? [{ id: `prep-cut-${problem.id}`, description: `In prep: ${fix.text} (${spec.found})`, severity: 'low', costDelta: 0, qualityDelta: fix.qualityLoss, buzzDelta: 0, delayDaysDelta: 0, impact: fix.impact }]
      : [];
  const who = decidedBy === 'team' ? 'The production team' : 'You';
  const verb = fix.kind === 'carry' ? 'chose to carry it into the shoot' : `chose: ${fix.label.toLowerCase()}`;
  return {
    prep: {
      ...prep,
      problems,
      recommendedDays,
      checkpointDays: fix.prepDays > 0 ? checkpointDaysFor(recommendedDays) : prep.checkpointDays,
      daysAdded: prep.daysAdded + fix.prepDays,
      fixSpend: prep.fixSpend + fix.money,
      // A contingency draw is a cost of the film too; its cash effect is the smaller refund at wrap.
      runningCost: prep.runningCost + fix.money + fix.contingency,
      events: [...prep.events, ...cut],
      log: [...prep.log, { day, kind: 'decided', text: `${spec.found} ${who} ${verb}.` }],
    },
    cash: fix.money,
    contingency: fix.contingency,
  };
}

/** Contingency the prep's fixes have drawn so far. */
export function prepContingencyUsed(prep: PreProductionState | null | undefined): number {
  return prep?.problems?.reduce((s, p) => s + (p.resolution?.contingencyUsed ?? 0), 0) ?? 0;
}

export function checkpointTitle(index: number): string {
  return PREP_CHECKPOINTS[index]?.title ?? 'Prep check';
}

/** Share of prep at which a checkpoint falls. */
export function checkpointShare(index: number): number {
  return PREP_CHECKPOINTS[index]?.at ?? 1;
}
