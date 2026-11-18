// Prep's problems, finding them, checkpoints, delegation and the shoot
// (docs/IMPLEMENTATION_PLAN_preproduction_realism.md Phase 4, tests list).
import { describe, expect, it } from 'vitest';
import type { PreProductionState, PrepProblem, StaticProductionRisk } from '../../types';
import { PREP_ACTIVITIES, PREP_PROBLEMS, PREP_SACRIFICE_ORDER, type PrepFront } from '../../data/prep';
import { buildPrepContext, type PrepContext } from './context';
import { generatePrepProblems } from './problems';
import { discoverOnDay, findShare } from './discovery';
import { keyedRoll } from './roll';
import { checkpointDaysFor, fixOptions } from './checkpoints';
import { decideProblem, optionCostInShootDays } from './delegation';
import { carriedIncidentsFor, fireCarriedIncidents, incidentEvent } from './handoff';
import { activitiesDropped, applyPrepRiskAdjustments, createPreProduction, effectiveActivities, prepRiskAdjustments, runPrepHeadless } from './run';
import { derivePrepDemands, type FrontDemand } from './demands';
import { applyPrepRiskDelta, prepQualityEvents } from '../production';
import { computeExecutionProfile } from '../productionExecution';
import { buildReadyDraft, makePrep } from '../../state/testFixtures';
import { withRng } from '../random';

const draft = withRng(3, (r) => buildReadyDraft(r)).result;
const allFronts = (demand: number): FrontDemand[] =>
  (['breakdown', 'design', 'costume', 'locations', 'casting', 'action', 'effects', 'visual'] as PrepFront[]).map((front) => ({ front, demand, reasons: [] }));

function ctxWith(skill: number, over: Partial<PrepContext> = {}): PrepContext {
  const base = buildPrepContext({ talent: [], genre: null, team: null, dailyShootBurn: 100_000, dailyPrepBurn: 10_000, shootDays: 40, contingencyAvailable: 1_000_000 });
  const ownerSkill = Object.fromEntries(Object.keys(base.ownerSkill).map((k) => [k, skill])) as PrepContext['ownerSkill'];
  return { ...base, ownerSkill, reliability: skill, ...over };
}

function start(seed: number, over: { demand?: number; lengthFactor?: number; activities?: PreProductionState['activities'] } = {}): PreProductionState {
  return createPreProduction({
    demands: allFronts(over.demand ?? 0.7),
    plan: { lengthFactor: over.lengthFactor ?? 1, activities: over.activities ?? null, delegated: true },
    prepDays: 80,
    seed,
    team: null,
    status: 'in-progress',
    difficultLead: false,
  });
}

describe('problems', () => {
  it('are drawn once and replay exactly from the seed', () => {
    expect(generatePrepProblems({ demands: allFronts(0.7), lengthFactor: 1, difficultLead: false }, 9)).toEqual(
      generatePrepProblems({ demands: allFronts(0.7), lengthFactor: 1, difficultLead: false }, 9),
    );
    const a = runPrepHeadless(start(9), ctxWith(60), { skill: 60, seed: 9 });
    const b = runPrepHeadless(start(9), ctxWith(60), { skill: 60, seed: 9 });
    expect(a).toEqual(b);
  });

  it('a heavier front has more and worse problems; a dead front none', () => {
    const count = (demand: number) => {
      let n = 0;
      for (let seed = 1; seed <= 60; seed++) n += generatePrepProblems({ demands: allFronts(demand), lengthFactor: 1, difficultLead: false }, seed).length;
      return n;
    };
    expect(count(0.9)).toBeGreaterThan(count(0.4));
    expect(count(0.1)).toBe(0);
  });

  it('a short prep worsens long-lead problems, a long one eases them', () => {
    const lead = (lengthFactor: number) =>
      generatePrepProblems({ demands: allFronts(0.8), lengthFactor, difficultLead: false }, 4).filter((p) => PREP_PROBLEMS[p.kind].leadTime).reduce((s, p) => s + p.severity, 0);
    expect(lead(0.75)).toBeGreaterThan(lead(1));
    expect(lead(1.25)).toBeLessThan(lead(1));
  });

  it("a difficult lead brings the casting problem the old prep bank's clash stood for", () => {
    expect(generatePrepProblems({ demands: allFronts(0.5), lengthFactor: 1, difficultLead: true }, 2).some((p) => p.kind === 'difficult-star')).toBe(true);
    expect(generatePrepProblems({ demands: allFronts(0.5), lengthFactor: 1, difficultLead: false }, 2).some((p) => p.kind === 'difficult-star')).toBe(false);
  });
});

describe('finding problems', () => {
  const problem = (kind: PrepProblem['kind']): PrepProblem => ({ id: `${kind}-0`, kind, front: PREP_PROBLEMS[kind].front, severity: 0.6, foundOnDay: null, resolution: null });

  it('a problem only its activity reveals is never found without that work', () => {
    const off = makePrep({ activities: { scouting: false, tests: true, rehearsal: true, previs: true } });
    expect(findShare(problem('location-at-risk'), off, ctxWith(100))).toBe(0);
    expect(findShare(problem('location-at-risk'), makePrep(), ctxWith(100))).toBeGreaterThan(0);
    // ...and over a whole prep, nothing of that kind is ever found.
    for (let seed = 1; seed <= 20; seed++) {
      const ran = runPrepHeadless(start(seed, { activities: { scouting: false, tests: false, rehearsal: false, previs: false } }), ctxWith(90), { skill: 90, seed });
      for (const p of ran.prep.problems) if (PREP_PROBLEMS[p.kind].revealedBy !== 'always') expect(p.foundOnDay).toBeNull();
    }
  });

  it('a skilled owner finds more of them, and sooner', () => {
    const tally = (skill: number) => {
      let found = 0;
      let days = 0;
      for (let seed = 1; seed <= 40; seed++) {
        const ran = runPrepHeadless(start(seed), ctxWith(skill), { skill: 50, seed });
        for (const p of ran.prep.problems) if (p.foundOnDay !== null) { found++; days += p.foundOnDay; }
      }
      return { found, meanDay: days / Math.max(1, found) };
    };
    const weak = tally(10);
    const strong = tally(95);
    expect(strong.found).toBeGreaterThan(weak.found);
    expect(findShare(problem('visions-differ'), makePrep(), ctxWith(95))).toBeGreaterThan(findShare(problem('visions-differ'), makePrep(), ctxWith(10)));
  });
});

describe('a short prep', () => {
  it('drops rehearsal first, in the reference sacrifice order', () => {
    expect(activitiesDropped(1)).toEqual([]);
    expect(activitiesDropped(0.875)[0]).toBe('rehearsal');
    expect(activitiesDropped(0.75)).toEqual(PREP_SACRIFICE_ORDER.slice(0, 2));
    const all = Object.fromEntries(PREP_ACTIVITIES.map((a) => [a, true])) as PreProductionState['activities'];
    expect(effectiveActivities(all, 0.75).rehearsal).toBe(false);
    expect(effectiveActivities(all, 0.75).scouting).toBe(true);
  });
});

describe('checkpoints and fixes', () => {
  it('fall at the four real milestones', () => {
    expect(checkpointDaysFor(100)).toEqual([25, 55, 80, 95]);
  });

  it('always offer carrying it; a rush order closes once it is too late', () => {
    const p: PrepProblem = { id: 'b', kind: 'long-lead-build', front: 'design', severity: 0.8, foundOnDay: 5, resolution: null };
    expect(fixOptions(p, ctxWith(50), 0.25).map((o) => o.kind)).toContain('pay');
    expect(fixOptions(p, ctxWith(50), 0.95).map((o) => o.kind)).not.toContain('pay');
    expect(fixOptions(p, ctxWith(50), 0.95).at(-1)!.kind).toBe('carry');
  });

  it('price money in the film\'s own shooting days', () => {
    const p: PrepProblem = { id: 'g', kind: 'budget-gap', front: 'breakdown', severity: 1, foundOnDay: 5, resolution: null };
    const pay = fixOptions(p, ctxWith(50, { dailyShootBurn: 200_000 }), 0.25).find((o) => o.kind === 'pay')!;
    expect(pay.money).toBe(3 * 200_000);
  });
});

describe('delegation', () => {
  it('decides every checkpoint of a delegated prep', () => {
    const ran = runPrepHeadless(start(5), ctxWith(60), { skill: 60, seed: 5 });
    expect(ran.prep.status).toBe('finished');
    expect(ran.prep.nextCheckpoint).toBe(4);
    const lastCheckpoint = ran.prep.checkpointDays[3];
    for (const p of ran.prep.problems) if (p.foundOnDay !== null && p.foundOnDay <= lastCheckpoint) expect(p.resolution?.decidedBy).toBe('team');
  });

  it('a better team pays less, in true shoot-day cost, for the same problems', () => {
    const cost = (skill: number) => {
      let total = 0;
      for (let seed = 1; seed <= 200; seed++) {
        for (const kind of Object.keys(PREP_PROBLEMS) as PrepProblem['kind'][]) {
          const p: PrepProblem = { id: `${kind}-${seed}`, kind, front: PREP_PROBLEMS[kind].front, severity: 0.7, foundOnDay: 1, resolution: null };
          const ctx = ctxWith(50);
          total += optionCostInShootDays(p, decideProblem(p, ctx, 0.25, { skill, seed }), ctx);
        }
      }
      return total;
    };
    expect(cost(90)).toBeLessThan(cost(20));
  });

  it('a strong team keeps the contingency for the shoot', () => {
    const p: PrepProblem = { id: 'g', kind: 'budget-gap', front: 'breakdown', severity: 1, foundOnDay: 5, resolution: null };
    for (let seed = 1; seed <= 50; seed++) expect(decideProblem(p, ctxWith(50, { cashPressure: 1 }), 0.25, { skill: 80, seed }).kind).not.toBe('contingency');
  });
});

describe('carried problems on the shoot', () => {
  it('every problem left standing becomes an incident on a shoot day, fired before that day\'s roll', () => {
    const prep = makePrep({
      status: 'finished',
      problems: [
        { id: 'a', kind: 'action-unready', front: 'action', severity: 0.8, foundOnDay: null, resolution: null },
        { id: 'b', kind: 'implied-element', front: 'breakdown', severity: 0, foundOnDay: 3, resolution: { option: 'pay', day: 8, costPaid: 1, daysAdded: 0, contingencyUsed: 0, decidedBy: 'team' } },
      ],
    });
    const incidents = carriedIncidentsFor(prep, 40);
    expect(incidents.map((i) => i.problemId)).toEqual(['a']);
    const photo = { status: 'in-progress' as const, recommendedDays: 40, daysElapsed: incidents[0].day - 1, events: [], runningCost: 0, pendingChoice: null, carriedIncidents: incidents };
    const fired = fireCarriedIncidents(photo, 100_000)!;
    expect(fired.events[0].id).toBe('prep-incident-a');
    expect(fired.events[0].impact).toBe('practical');
    expect(fired.daysElapsed).toBe(photo.daysElapsed + 1 + fired.events[0].delayDaysDelta);
    expect(fired.carriedIncidents).toEqual([]);
    // Nothing fires before its day.
    if (incidents[0].day > 1) expect(fireCarriedIncidents({ ...photo, daysElapsed: 0 }, 100_000)).toBeNull();
  });

  it('reaches the film through its typed department', () => {
    const ev = incidentEvent({ day: 5, problemId: 'x', kind: 'visions-differ', severity: 1 }, 100_000);
    const talent = draft.talent;
    const choices = draft.productionChoices!;
    const hit = computeExecutionProfile({ events: [ev], shootingRatio: 1, talent, productionChoices: choices });
    const clean = computeExecutionProfile({ events: [], shootingRatio: 1, talent, productionChoices: choices });
    expect(hit.overall).toBeLessThan(clean.overall);
  });
});

describe('prep never adds quality', () => {
  it('every event prep leaves on a film is a loss, and its cost is not charged twice', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const ran = runPrepHeadless(start(seed, { demand: 0.9 }), ctxWith(40), { skill: 30, seed });
      for (const e of prepQualityEvents(ran.prep)) {
        expect(e.qualityDelta).toBeLessThan(0);
        expect(e.costDelta).toBe(0);
      }
    }
  });

  it("prep's risk adjustments move each dimension within a bounded swing", () => {
    const base: StaticProductionRisk = { moraleRisk: 50, safetyRisk: 50, technicalComplexity: 50, budgetRisk: 50 };
    const messy = makePrep({ problems: Array.from({ length: 10 }, (_, i) => ({ id: `a${i}`, kind: 'action-unready' as const, front: 'action' as const, severity: 1, foundOnDay: null, resolution: null })) });
    const adj = prepRiskAdjustments(messy);
    expect(adj.safetyRisk).toBe(15); // ten unready sequences, capped at the swing
    expect(applyPrepRiskAdjustments(base, adj).moraleRisk).toBe(47);
    expect(applyPrepRiskDelta(base, 0)).toBe(base);
  });
});

describe('the demands the player film actually has', () => {
  it('start a real prep from the fixture film', () => {
    const demands = derivePrepDemands({ script: draft.script!, talent: draft.talent, choices: draft.productionChoices! });
    const prep = createPreProduction({ demands, plan: undefined, prepDays: 60, seed: 3, team: null, status: 'in-progress', difficultLead: false });
    expect(prep.problems.length).toBeGreaterThan(0);
    expect(prep.delegated).toBe(true);
    expect(prep.checkpointDays).toEqual(checkpointDaysFor(60));
  });
});

describe('the keyed roll', () => {
  it("is uniform even when keys differ only in the last characters (a problem's days)", () => {
    const xs = Array.from({ length: 2000 }, (_, d) => keyedRoll(`123|implied-element-0|${d}`));
    expect(Math.abs(xs.reduce((a, b) => a + b, 0) / xs.length - 0.5)).toBeLessThan(0.03);
    // Neighbouring days are not near-equal.
    const steps = xs.slice(1).map((x, i) => Math.abs(x - xs[i]));
    expect(steps.reduce((a, b) => a + b, 0) / steps.length).toBeGreaterThan(0.25);
  });

  it('a window finds a problem about as often as its find share says', () => {
    const p: PrepProblem = { id: 'visions-differ-0', kind: 'visions-differ', front: 'visual', severity: 0.6, foundOnDay: null, resolution: null };
    const ctx = ctxWith(80);
    let found = 0;
    const n = 600;
    for (let seed = 1; seed <= n; seed++) {
      let prep = makePrep({ seed, recommendedDays: 80, problems: [p] });
      for (let day = 1; day <= 80; day++) prep = discoverOnDay(prep, ctx, day);
      if (prep.problems[0].foundOnDay !== null) found++;
    }
    expect(found / n).toBeGreaterThan(findShare(p, makePrep(), ctx) - 0.06);
    expect(found / n).toBeLessThan(findShare(p, makePrep(), ctx) + 0.06);
  });
});
