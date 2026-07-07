import type { ProductionChoices, ProductionEvent, Script, Talent } from '../types';
import { POSITIVE_EVENT_TEMPLATES, NEGATIVE_EVENT_TEMPLATES, type ProductionEventTemplate } from '../data/productionEvents';
import { shootingRisk, budgetRisk as budgetRiskScore } from './productionDials';
import { clamp, randFloat, randInt, type RandomFn } from './random';

/**
 * Production risk (0-100): higher means production events skew negative and
 * more severe. Driven by talent reliability/ego, script complexity, and the
 * shooting style/budget choices the player made.
 */
export function computeProductionRiskScore(talent: Talent[], script: Script, choices: ProductionChoices): number {
  const avgReliability = talent.length
    ? talent.reduce((sum, t) => sum + t.reliability, 0) / talent.length
    : 70;
  const avgEgo = talent.length ? talent.reduce((sum, t) => sum + t.ego, 0) / talent.length : 50;

  const unreliabilityRisk = 100 - avgReliability; // low reliability -> high risk
  const egoRisk = avgEgo; // high ego -> high risk (drama on set)
  const complexityRisk = script.complexity;
  const styleRisk = shootingRisk(choices.shootingIntensity);
  const budgetRiskValue = budgetRiskScore(choices.budgetAmount);

  const weighted =
    unreliabilityRisk * 0.3 + egoRisk * 0.2 + complexityRisk * 0.2 + styleRisk * 0.2 + budgetRiskValue * 0.1;

  return clamp(Math.round(weighted), 5, 95);
}

function rollEvent(template: ProductionEventTemplate, rng: RandomFn): ProductionEvent {
  const [costMin, costMax] = template.costRange;
  const [qMin, qMax] = template.qualityRange;
  const [bMin, bMax] = template.buzzRange;
  const [dMin, dMax] = template.delayRiskRange;
  return {
    id: template.id,
    description: template.description,
    costDelta: Math.round(randFloat(rng, costMin, costMax)),
    qualityDelta: randFloat(rng, qMin, qMax),
    buzzDelta: randFloat(rng, bMin, bMax),
    delayRiskDelta: randFloat(rng, dMin, dMax),
  };
}

/**
 * Simulates a shoot: picks 3-5 events, each rolled positive or negative based
 * on the overall risk score, without repeating the same template twice.
 */
export function simulateProduction(
  talent: Talent[],
  script: Script,
  choices: ProductionChoices,
  rng: RandomFn,
): { events: ProductionEvent[]; riskScore: number } {
  const riskScore = computeProductionRiskScore(talent, script, choices);
  const eventCount = randInt(rng, 3, 5);

  const usedIds = new Set<string>();
  const events: ProductionEvent[] = [];

  for (let i = 0; i < eventCount; i++) {
    const rollNegative = rng() * 100 < riskScore;
    const pool = (rollNegative ? NEGATIVE_EVENT_TEMPLATES : POSITIVE_EVENT_TEMPLATES).filter(
      (t) => !usedIds.has(t.id),
    );
    const fallbackPool = (rollNegative ? POSITIVE_EVENT_TEMPLATES : NEGATIVE_EVENT_TEMPLATES).filter(
      (t) => !usedIds.has(t.id),
    );
    const candidates = pool.length > 0 ? pool : fallbackPool;
    if (candidates.length === 0) break; // exhausted all templates

    const template = candidates[randInt(rng, 0, candidates.length - 1)];
    usedIds.add(template.id);
    events.push(rollEvent(template, rng));
  }

  return { events, riskScore };
}
