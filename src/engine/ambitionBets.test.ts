// Ambition bets: reach x delivery (data/ambitionBets.ts,
// docs/DESIGN_REVIEW_ambition_and_delivery.md).
import { describe, it, expect } from 'vitest';
import { computeAudienceScore, computeCriticScore, computeQualityBreakdown, computeStructureBet, type QualityBreakdown } from './scoring';
import { computeExecutionProfile, type ExecutionProfile } from './productionExecution';
import { buildReadyDraft } from '../state/testFixtures';
import { withRng } from './random';
import { STRUCTURE_PERFORMANCE_MEDIAN, STRUCTURE_POST_MEDIAN } from '../data/ambitionBets';

const neutral = computeExecutionProfile({ events: [], shootingRatio: 1, talent: [], productionChoices: { shootingBudgetAmount: 0, setQualityAmount: 0, practicalEffectsAmount: 0, vfxAmount: 0, runtimeIntensity: 0.5 } });
const shoot = (performanceCapture: number, postExecution: number): ExecutionProfile => ({ ...neutral, performanceCapture, postExecution });

describe('structure bet', () => {
  const script = { complexity: 80 } as Parameters<typeof computeStructureBet>[0];
  it('a simple script reaches for nothing, so execution cannot move this term', () => {
    expect(computeStructureBet({ ...script, complexity: 20 }, shoot(0.7, 0.6)).reach).toBe(0);
  });
  it('the median shoot is neutral', () => {
    expect(computeStructureBet(script, shoot(STRUCTURE_PERFORMANCE_MEDIAN, STRUCTURE_POST_MEDIAN)).delivery).toBeCloseTo(0);
  });
  it('delivery reads the performances and the cut, both ways, bounded', () => {
    expect(computeStructureBet(script, shoot(1.3, 1.3)).delivery).toBe(1);
    expect(computeStructureBet(script, shoot(0.6, 0.5)).delivery).toBe(-1);
  });
});

describe('the bets in reception', () => {
  const { result: draft } = withRng(77, (rng) => buildReadyDraft(rng));
  const base = computeQualityBreakdown(draft.script!, draft.talent, draft.genre!, draft.productionChoices!, draft.postProductionChoices!, [], 1);
  const critic = (q: QualityBreakdown) => computeCriticScore(q, draft.script!, draft.postProductionChoices!, draft.genre!);
  const audience = (q: QualityBreakdown) =>
    computeAudienceScore(q, draft.script!, draft.talent, draft.genre!, draft.productionChoices!, draft.postProductionChoices!, draft.targetAudience!);
  const withBets = (b: Partial<QualityBreakdown>): QualityBreakdown => ({ ...base, structureReach: 0, structureDelivery: 0, spectacleReach: 0, spectacleDelivery: 0, ...b });

  it('no reach, no bet: delivery alone moves nothing', () => {
    expect(critic(withBets({ structureDelivery: 1, spectacleDelivery: 1 }))).toBe(critic(withBets({})));
  });

  it('an intricate film that holds together: critics reward it; audiences merely do not punish it', () => {
    const held = withBets({ structureReach: 1, structureDelivery: 1 });
    expect(critic(held)).toBeGreaterThan(critic(withBets({})));
    expect(audience(held)).toBe(audience(withBets({})));
  });

  it('an intricate film that confuses: both voices mark it down', () => {
    const confused = withBets({ structureReach: 1, structureDelivery: -1 });
    expect(critic(confused)).toBeLessThan(critic(withBets({})));
    expect(audience(confused)).toBeLessThan(audience(withBets({})));
  });

  it('spectacle that lands draws audiences; spectacle that looks cheap costs them - more than it moves critics', () => {
    const landed = withBets({ spectacleReach: 1, spectacleDelivery: 1 });
    const cheap = withBets({ spectacleReach: 1, spectacleDelivery: -1 });
    expect(audience(landed)).toBeGreaterThan(audience(withBets({})));
    expect(audience(cheap)).toBeLessThan(audience(withBets({})));
    expect(audience(landed) - audience(cheap)).toBeGreaterThan(critic(landed) - critic(cheap));
  });

  it('a hand-built breakdown without bet fields scores exactly as before', () => {
    const { structureReach: _a, structureDelivery: _b, spectacleReach: _c, spectacleDelivery: _d, ...legacy } = base;
    expect(critic(legacy as QualityBreakdown)).toBe(critic(withBets({})));
  });
});
