// The line producer & 1st AD team (docs/IMPLEMENTATION_PLAN_preproduction_realism.md Phase 3).
import { describe, expect, it } from 'vitest';
import { generateProductionTeamPool, productionTeamById, productionTeamFee, productionTeamFrontSkill } from './productionTeams';
import { createRng } from './random';
import { withReplayableIds } from './identity';
import { NO_PRODUCTION_TEAM_SKILL, PRODUCTION_TEAM_POOL_SIZE, PRODUCTION_TEAM_SPECIALTY_BONUS } from '../data/productionTeams';
import { studioReducer } from '../state/studioReducer';
import { buildStateReadyToGreenlight, buildStateWithReadyDraft } from '../state/testFixtures';
import { asPlayerDraft } from './project';
import { computeCommittedSpend } from '../state/selectors';
import { deriveProjectReadiness } from './projectReadiness';

describe('the production team roster', () => {
  it('is deterministic for a seed and spans cheap to expensive, weak to strong', () => {
    const a = withReplayableIds(() => generateProductionTeamPool(createRng(4)));
    const b = withReplayableIds(() => generateProductionTeamPool(createRng(4)));
    expect(a).toEqual(b);
    expect(a).toHaveLength(PRODUCTION_TEAM_POOL_SIZE);
    const bySalary = [...a].sort((x, y) => x.typicalSalary - y.typicalSalary);
    expect(bySalary.at(-1)!.typicalSalary).toBeGreaterThan(bySalary[0].typicalSalary * 10);
    const meanSkill = (xs: typeof a) => xs.reduce((s, t) => s + t.skill, 0) / xs.length;
    expect(meanSkill(bySalary.slice(-5))).toBeGreaterThan(meanSkill(bySalary.slice(0, 5)));
    for (const t of a) expect(t.name).toContain(' & ');
  });

  it('works a matching front as if it were better, and the studio office is ordinary', () => {
    const team = { ...generateProductionTeamPool(createRng(5))[0], skill: 50, specialties: ['Locations' as const] };
    expect(productionTeamFrontSkill(team, 'locations')).toBe(50 + PRODUCTION_TEAM_SPECIALTY_BONUS);
    expect(productionTeamFrontSkill(team, 'design')).toBe(50);
    expect(productionTeamFrontSkill(undefined, 'locations')).toBe(NO_PRODUCTION_TEAM_SKILL);
    expect(productionTeamFee(undefined)).toBe(0);
  });
});

describe('hiring a production team', () => {
  const state = () => {
    const s = buildStateReadyToGreenlight(6);
    return { ...s, productionTeamPool: generateProductionTeamPool(createRng(6)) };
  };

  it('attaches a team from the roster, clears it, and refuses one that does not exist', () => {
    const s = state();
    const team = s.productionTeamPool[3];
    const hired = studioReducer(s, { type: 'SET_PRODUCTION_TEAM', productionTeamId: team.id });
    expect(asPlayerDraft(hired.projects[0])!.productionTeamId).toBe(team.id);
    expect(asPlayerDraft(studioReducer(hired, { type: 'SET_PRODUCTION_TEAM', productionTeamId: null }).projects[0])!.productionTeamId).toBeNull();
    expect(studioReducer(s, { type: 'SET_PRODUCTION_TEAM', productionTeamId: 'nobody' })).toBe(s);
    expect(productionTeamById(s.productionTeamPool, team.id)).toBe(team);
  });

  it("counts the team's fee in the studio's committed spend", () => {
    const s = state();
    const team = s.productionTeamPool[10];
    const hired = studioReducer(s, { type: 'SET_PRODUCTION_TEAM', productionTeamId: team.id });
    const draft = asPlayerDraft(hired.projects[0])!;
    expect(computeCommittedSpend(draft, [], [], hired.productionTeamPool) - computeCommittedSpend(draft, [], [], [])).toBe(team.typicalSalary);
  });
});

describe('the deal at greenlight', () => {
  const state = () => ({ ...buildStateReadyToGreenlight(8), productionTeamPool: generateProductionTeamPool(createRng(8)) });

  it('is not required: a film greenlights with the studio office', () => {
    const s = state();
    expect(deriveProjectReadiness(asPlayerDraft(s.projects[0])!, s.studio.cash).ready).toBe(true);
    const lit = studioReducer(s, { type: 'GREENLIGHT_PROJECT' });
    const d = asPlayerDraft(lit.projects[0])!;
    expect(d.preProduction).not.toBeNull();
    expect(d.preProduction!.team).toBeNull();
  });

  it('freezes the team chosen, which can no longer be swapped', () => {
    const s = state();
    const team = s.productionTeamPool[12];
    const lit = studioReducer(studioReducer(s, { type: 'SET_PRODUCTION_TEAM', productionTeamId: team.id }), { type: 'GREENLIGHT_PROJECT' });
    const d = asPlayerDraft(lit.projects[0])!;
    expect(d.preProduction!.team).toEqual(team);
    const swapped = studioReducer(lit, { type: 'SET_PRODUCTION_TEAM', productionTeamId: s.productionTeamPool[0].id });
    expect(swapped).toBe(lit);
    // The committed spend reads the contracted team, not the roster.
    expect(computeCommittedSpend(d, [], [], []) - computeCommittedSpend({ ...d, preProduction: { ...d.preProduction!, team: null } }, [], [], [])).toBe(team.typicalSalary);
  });
});

describe("the team's fee at release", () => {
  it('is folded into the film\'s cost', async () => {
    const { computeReleaseResults } = await import('./releaseFilm');
    const d = asPlayerDraft(buildStateWithReadyDraft(7).projects[0])!;
    const input = {
      title: 'T', genre: d.genre!, targetAudience: d.targetAudience!, script: d.script!, talent: d.talent,
      productionChoices: d.productionChoices!, postProductionChoices: d.postProductionChoices!, marketingChoices: d.marketingChoices!,
      events: [], postProductionEvents: [], photographyCost: 1_000_000, shootingRatio: 1, studioBrand: 50, studioGenreIdentity: 0, competitiveCrowding: 0,
    };
    const without = computeReleaseResults(input, createRng(1)).results;
    const withTeam = computeReleaseResults({ ...input, productionTeamFee: 250_000 }, createRng(1)).results;
    expect(withTeam.productionCost - without.productionCost).toBe(250_000);
  });
});
