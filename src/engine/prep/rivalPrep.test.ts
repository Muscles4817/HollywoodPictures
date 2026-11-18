// Rivals on the same prep model (docs/IMPLEMENTATION_PLAN_preproduction_realism.md Phase 6).
import { describe, expect, it } from 'vitest';
import type { Film } from '../../types';
import { RIVAL_CONTINGENCY_SHARE, RIVAL_PREP_MEMORY, RIVAL_TEAM_FEE_SHARE } from '../../data/prep';
import { chooseRivalProductionTeam, filmPrepLosses, rivalPrepPolicy } from './rivalPrep';
import { synthesizeRivalPrep, type RivalExecutionInput } from '../rivalExecution';
import { buildPrepContext } from './context';
import { derivePrepDemands } from './demands';
import { createPreProduction, runPrepHeadless } from './run';
import { computeDailyPrepBurn, computeDailyShootBurn } from '../cost';
import { computeRecommendedPreProductionDays, computeRecommendedShootDays } from '../production';
import { generateProductionTeamPool } from '../productionTeams';
import { createRng, forkSeed, withRng } from '../random';
import { buildReadyDraft } from '../../state/testFixtures';
import { NO_PRODUCTION_TEAM_SKILL } from '../../data/productionTeams';

const draft = withRng(31, (r) => buildReadyDraft(r)).result;
const input: RivalExecutionInput = { talent: draft.talent, script: draft.script!, productionChoices: { ...draft.productionChoices!, contingencyReserveAmount: 2_000_000 }, genre: draft.genre! };

function filmWithIncidents(day: number, lostDays: number, name = 'Rival A'): Film {
  return {
    ...(draft as unknown as Film),
    id: `f-${day}`,
    releasedBy: name,
    releasedOnDay: day,
    events: lostDays > 0 ? [{ id: 'prep-incident-action-unready-0', description: 'x', severity: 'high', costDelta: 100_000, qualityDelta: -3, buzzDelta: 0, delayDaysDelta: lostDays }] : [],
  };
}

describe('a rival prep and a player prep are the same engine', () => {
  it('the same parts, prep and decider give the same problems, findings and decisions', () => {
    const rival = synthesizeRivalPrep(input, createRng(5)).prep;
    // Rebuild the player's side by hand from the same inputs.
    const seed = forkSeed(createRng(5));
    const { talent, script, productionChoices, genre } = input;
    const shootDays = computeRecommendedShootDays(talent, script, productionChoices);
    const shootBurn = computeDailyShootBurn(productionChoices.shootingBudgetAmount, shootDays);
    const ctx = buildPrepContext({ talent, genre, team: null, dailyShootBurn: shootBurn, dailyPrepBurn: computeDailyPrepBurn(shootBurn), shootDays, contingencyAvailable: 2_000_000, cashPressure: 0.3, datedRelease: true });
    const start = createPreProduction({ demands: derivePrepDemands({ script, talent, choices: productionChoices }), plan: { lengthFactor: 1, activities: null, delegated: true }, prepDays: computeRecommendedPreProductionDays(talent, script, productionChoices), seed, team: null, status: 'in-progress', difficultLead: rival.problems.some((p) => p.kind === 'difficult-star') });
    const player = runPrepHeadless(start, ctx, { skill: NO_PRODUCTION_TEAM_SKILL, seed }).prep;
    expect(player.problems).toEqual(rival.problems);
    expect(player.events).toEqual(rival.events);
  });

  it('a rival with a stronger team carries less', () => {
    const pool = generateProductionTeamPool(createRng(1));
    const best = [...pool].sort((a, b) => b.skill - a.skill)[0];
    let weak = 0;
    let strong = 0;
    for (let seed = 1; seed <= 40; seed++) {
      weak += synthesizeRivalPrep(input, createRng(seed)).prep.problems.filter((p) => p.severity > 0.05).length;
      strong += synthesizeRivalPrep({ ...input, productionTeam: best }, createRng(seed)).prep.problems.filter((p) => p.severity > 0.05).length;
    }
    expect(strong).toBeLessThan(weak);
  });
});

describe('a rival remembers its recent shoots', () => {
  it('preps longer and holds more contingency after losing days to carried problems', () => {
    const fresh = rivalPrepPolicy('Rival A', 'Mid-Size', []);
    expect(fresh).toEqual({ lengthFactor: 1, contingencyShare: RIVAL_CONTINGENCY_SHARE['Mid-Size'], mainCause: null });
    const burned = rivalPrepPolicy('Rival A', 'Mid-Size', [1, 2, 3].map((d) => filmWithIncidents(d, 4)));
    expect(burned.lengthFactor).toBeGreaterThan(1);
    expect(burned.contingencyShare).toBeGreaterThan(fresh.contingencyShare);
    expect(burned.mainCause).toBe('action');
  });

  it('learns to prep leaner after a run of clean shoots, and stays bounded both ways', () => {
    const clean = rivalPrepPolicy('Rival A', 'Major', Array.from({ length: RIVAL_PREP_MEMORY.films }, (_, i) => filmWithIncidents(i, 0)));
    expect(clean.lengthFactor).toBeLessThan(1);
    const disaster = rivalPrepPolicy('Rival A', 'Major', Array.from({ length: 5 }, (_, i) => filmWithIncidents(i, 200)));
    expect(disaster.lengthFactor).toBe(RIVAL_PREP_MEMORY.lengthRange[1]);
    expect(disaster.contingencyShare).toBeLessThanOrEqual(RIVAL_CONTINGENCY_SHARE.Major + RIVAL_PREP_MEMORY.contingencyRange[1]);
    expect(clean.lengthFactor).toBeGreaterThanOrEqual(RIVAL_PREP_MEMORY.lengthRange[0]);
  });

  it('reads only its own films, its latest few', () => {
    const others = rivalPrepPolicy('Rival A', 'Indie', [1, 2, 3].map((d) => filmWithIncidents(d, 9, 'Rival B')));
    expect(others.lengthFactor).toBe(1);
    // Old trouble ages out behind newer clean films.
    const old = [filmWithIncidents(1, 9), ...Array.from({ length: RIVAL_PREP_MEMORY.films }, (_, i) => filmWithIncidents(10 + i, 0))];
    expect(rivalPrepPolicy('Rival A', 'Indie', old).lengthFactor).toBeLessThan(1);
    expect(filmPrepLosses(filmWithIncidents(1, 4)).lostShare).toBeGreaterThan(0);
  });
});

describe('a rival hires a production team it can afford', () => {
  it('the most skilled whose fee fits its share of the negative', () => {
    const pool = generateProductionTeamPool(createRng(2));
    const negative = 20_000_000;
    const team = chooseRivalProductionTeam(pool, negative)!;
    expect(team.typicalSalary).toBeLessThanOrEqual(negative * RIVAL_TEAM_FEE_SHARE);
    for (const t of pool) if (t.typicalSalary <= negative * RIVAL_TEAM_FEE_SHARE) expect(t.skill).toBeLessThanOrEqual(team.skill);
    expect(chooseRivalProductionTeam(pool, 100)).toBeNull();
  });
});
