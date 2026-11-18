// How a production team decides prep's checkpoints when the film's prep is
// handed to it (docs/DESIGN_REVIEW_preproduction_realism.md §4.7). Also how a
// rival studio's productions and the harness bot decide - one rule for everyone.
//
// A producer weighs each option in the currency that matters on a film: the
// shooting day (04 §1.4 - prep exists to protect it). Money is days of the
// film's own shoot burn, weighted up when cash is tight; prep days cost their
// own burn and push the schedule, more so against a fixed release date; a cut
// costs what it takes off the screen; carrying costs what the incident will.
// A good team reads those costs well and keeps the contingency for the shoot
// (04 §4.5: "contingency is for the shoot"); a weak one misjudges, and
// underrates what carrying will cost - so it carries more, and overpays.
import type { PrepProblem } from '../../types';
import { PREP_QUALITY_POINT_SHOOT_DAYS, type PrepFixKind } from '../../data/prep';
import type { PrepContext } from './context';
import { carriedCost, fixOptions, type PricedFix } from './checkpoints';
import { keyedRoll } from './roll';

/** Teams at or above this skill never take a fix out of the contingency in prep. */
const KEEPS_CONTINGENCY_SKILL = 60;
/** How far a weak decider's estimates stray (share, at skill 0). */
const MISJUDGEMENT = 0.6;
/** A skill-0 decider sees this share of what carrying a problem really costs. */
const CARRY_BLINDNESS = 0.45;
/** What one prep day costs the schedule beyond its burn, in shooting days (a dated release makes it dearer). */
const PREP_DAY_SCHEDULE_COST = { open: 0.1, dated: 0.4 } as const;

export interface Decider {
  /** 0..100. */
  skill: number;
  seed: number;
}

/** The true cost of an option, in the film's shooting days. */
export function optionCostInShootDays(problem: PrepProblem, fix: PricedFix, ctx: PrepContext): number {
  const moneyWeight = 1 + ctx.cashPressure;
  const prepDay = ctx.dailyPrepBurn / ctx.dailyShootBurn + (ctx.datedRelease ? PREP_DAY_SCHEDULE_COST.dated : PREP_DAY_SCHEDULE_COST.open);
  const residual = { ...problem, severity: fix.residual };
  const carried = carriedCost(residual, ctx);
  const carryDays = carried.delayDays + carried.overrunMoney / ctx.dailyShootBurn + Math.abs(carried.quality) * PREP_QUALITY_POINT_SHOOT_DAYS;
  return (
    (fix.money / ctx.dailyShootBurn) * moneyWeight +
    (fix.contingency / ctx.dailyShootBurn) * 0.5 * moneyWeight +
    fix.prepDays * prepDay +
    Math.abs(fix.qualityLoss) * PREP_QUALITY_POINT_SHOOT_DAYS +
    carryDays
  );
}

/** The option this decider takes for one problem at this point in prep. */
export function decideProblem(problem: PrepProblem, ctx: PrepContext, atShare: number, decider: Decider): PricedFix {
  const s = decider.skill / 100;
  const options = fixOptions(problem, ctx, atShare).filter((o) => !(o.kind === 'contingency' && decider.skill >= KEEPS_CONTINGENCY_SKILL));
  let best = options[options.length - 1];
  let bestCost = Infinity;
  for (const option of options) {
    const truth = optionCostInShootDays(problem, option, ctx);
    const noise = 1 + MISJUDGEMENT * (1 - s) * (keyedRoll(`${decider.seed}|${problem.id}|${option.kind}`) * 2 - 1);
    // A weak team underrates what carrying will cost - it is the cheapest-looking option.
    const seen = option.kind === 'carry' ? truth * (CARRY_BLINDNESS + (1 - CARRY_BLINDNESS) * s) : truth * noise;
    if (seen < bestCost) {
      best = option;
      bestCost = seen;
    }
  }
  return best;
}

/** Every open problem's decision at a checkpoint. */
export function decideCheckpoint(problems: PrepProblem[], ctx: PrepContext, atShare: number, decider: Decider): Record<string, PrepFixKind> {
  return Object.fromEntries(problems.map((p) => [p.id, decideProblem(p, ctx, atShare, decider).kind]));
}
