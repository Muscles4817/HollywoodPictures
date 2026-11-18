// Finding prep's problems (docs/DESIGN_REVIEW_preproduction_realism.md §4.3).
//
// A problem is found during its window of prep, if anyone is doing the work
// that would reveal it: a location's weak points only show on a scout, a flat
// pairing only in rehearsal, a split vision only in the tests (04 §5.2, §8.3,
// §9.7). Within that, a skilled, reliable owner finds more of them, and the
// severe and obvious ones are found by anyone. One that is never found is
// carried into the shoot unseen.
//
// Each day's roll is a hash of the film's seed, the problem and the day: it
// takes nothing from any shared stream, and the same prep replays exactly.
import type { PrepProblem, PreProductionState } from '../../types';
import { PREP_FIND_SHARE, PREP_PROBLEMS, PREP_FRONT_LABEL } from '../../data/prep';
import type { PrepContext } from './context';
import { clamp } from '../random';
import { keyedRoll } from './roll';

/** The chance, over its whole window, that this problem is found. 0 when its revealing work is not being done. */
export function findShare(problem: PrepProblem, prep: Pick<PreProductionState, 'activities'>, ctx: PrepContext): number {
  const spec = PREP_PROBLEMS[problem.kind];
  if (spec.revealedBy !== 'always' && !prep.activities[spec.revealedBy]) return 0;
  const skill = ctx.ownerSkill[problem.front] / 100;
  const share =
    PREP_FIND_SHARE.atSkill0 +
    (PREP_FIND_SHARE.atSkill100 - PREP_FIND_SHARE.atSkill0) * skill +
    PREP_FIND_SHARE.severityBonus * problem.severity +
    PREP_FIND_SHARE.reliabilityBonus * ((ctx.reliability - 50) / 50) +
    (spec.revealedBy === 'always' ? PREP_FIND_SHARE.alwaysBonus : 0);
  return clamp(share, 0, 0.98);
}

/** The prep-day span (1-based, inclusive) in which a problem can be found. */
export function findWindow(problem: PrepProblem, prepDays: number): [number, number] {
  const [a, b] = PREP_PROBLEMS[problem.kind].window;
  const first = Math.max(1, Math.floor(a * prepDays) + 1);
  return [first, Math.max(first, Math.round(b * prepDays))];
}

/** Today's chance, spread so the window as a whole finds it with findShare. */
export function dailyFindChance(problem: PrepProblem, prep: PreProductionState, ctx: PrepContext, day: number): number {
  const [first, last] = findWindow(problem, prep.recommendedDays);
  if (day < first || day > last) return 0;
  const share = findShare(problem, prep, ctx);
  if (share <= 0) return 0;
  return 1 - Math.pow(1 - share, 1 / (last - first + 1));
}

/** Runs one prep day's discovery: problems found today are marked and logged. */
export function discoverOnDay(prep: PreProductionState, ctx: PrepContext, day: number): PreProductionState {
  let changed = false;
  const log = [...prep.log];
  const problems = prep.problems.map((p) => {
    if (p.foundOnDay !== null) return p;
    const chance = dailyFindChance(p, prep, ctx, day);
    if (chance <= 0 || keyedRoll(`${prep.seed}|${p.id}|${day}`) >= chance) return p;
    changed = true;
    log.push({ day, kind: 'found', text: `${PREP_FRONT_LABEL[p.front]}: ${PREP_PROBLEMS[p.kind].found}` });
    return { ...p, foundOnDay: day };
  });
  return changed ? { ...prep, problems, log } : prep;
}
