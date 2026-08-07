// Phase B3b: a selected bold pitch raises the shoot's STARTING production risk,
// composed into the same applyPrepRiskDelta call both shoot paths use
// (studioReducer:ADVANCE_SHOOTING_DAY and productionsInProgress.ts). Higher
// starting risk feeds the existing event -> execution pipeline, widening the
// outcome distribution - it's not a release-time roll.
import { describe, it, expect } from 'vitest';
import { computeStaticProductionRisk, applyPrepRiskDelta } from './production';
import { computePitchExecutionRiskDelta } from './directorPitch';
import { buildReadyDraft } from '../state/testFixtures';
import { withRng } from './random';
import type { DirectorPitch } from '../types';

const boldPitch: DirectorPitch = {
  directorId: 'd', scriptId: 's',
  toneShift: { action: 50, comedy: 0, romance: 0, suspense: 40, drama: -40, spectacle: 50 },
  productionStyle: { environmentStrategy: { studio: 0.34, location: 0.33, digital: 0.33 }, effectsStrategy: { practical: 0.5, digital: 0.5 } },
  previewedDemands: Array.from({ length: 6 }, (_, i) => ({ id: `d${i}`, demanderId: 'd', domain: 'Script' as const, strength: 0.7, blocking: false })),
  conviction: 0.95,
};

// The exact starting-risk assembly the shoot runs (both paths).
function startingRisk(draft: ReturnType<typeof buildReadyDraft>, pitch: DirectorPitch | undefined) {
  return applyPrepRiskDelta(
    computeStaticProductionRisk(draft.talent, draft.script!, draft.productionChoices!, draft.genre!),
    computePitchExecutionRiskDelta(pitch),
  );
}

describe('a bold selected pitch raises the shoot starting risk', () => {
  it('every risk dimension is >= the no-pitch baseline, and strictly higher where not clamped', () => {
    const { result: draft } = withRng(2024, (rng) => buildReadyDraft(rng));
    const base = startingRisk(draft, undefined);
    const bold = startingRisk(draft, boldPitch);
    let anyStrictlyHigher = false;
    for (const k of ['moraleRisk', 'safetyRisk', 'technicalComplexity', 'budgetRisk'] as const) {
      expect(bold[k]).toBeGreaterThanOrEqual(base[k]);
      if (bold[k] > base[k]) anyStrictlyHigher = true;
    }
    expect(anyStrictlyHigher).toBe(true);
  });

  it('a directly-hired director (no pitch) leaves the shoot risk untouched', () => {
    const { result: draft } = withRng(7, (rng) => buildReadyDraft(rng));
    expect(startingRisk(draft, undefined)).toEqual(
      applyPrepRiskDelta(computeStaticProductionRisk(draft.talent, draft.script!, draft.productionChoices!, draft.genre!), 0),
    );
  });
});
