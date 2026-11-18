// One scoring model (docs/IMPLEMENTATION_PLAN_market_realism.md Phase 2): a
// rival's film is scored exactly as a player's would be from the same script,
// people, plan and luck. The two release paths build differently-shaped inputs
// (the player's carries producers, a press tour, a campaign runway, creative
// demands; a rival's carries none); with every one of those at its neutral
// value, the reception must match to the last digit.
import { describe, expect, it } from 'vitest';
import { computeReleaseResults, type ReleaseComputationInput } from './releaseFilm';
import { buildReadyDraft } from '../state/testFixtures';
import { generateTalentCandidates } from './talentGenerator';
import { createRng, withRng } from './random';
import { NEUTRAL_PRODUCER_EFFECTS } from './producers';
import { computeScriptScore } from './scoring';
import type { CrewRole, ProductionEvent, TalentAssignment } from '../types';

const draft = withRng(3, (rng) => buildReadyDraft(rng)).result;

const CAREER_KEY: Record<string, string> = { Cinematographer: 'cinematographer', Composer: 'composer', Editor: 'editor' };
function head(role: CrewRole, seed: number, skill: number): TalentAssignment {
  const { result: person } = withRng(seed, (rng) => generateTalentCandidates(role, rng, 1)[0]);
  const key = CAREER_KEY[role];
  return { role, person: { ...person, careers: { ...person.careers, [key]: { ...(person.careers as Record<string, unknown>)[key] as object, role, skill } } } };
}
const withHeads = (skill: number): TalentAssignment[] => [
  ...draft.talent,
  head('Cinematographer', 20, skill),
  head('Composer', 21, skill),
  head('Editor', 22, skill),
];

const events: ProductionEvent[] = [
  { id: 'preprod-table-read-revelation', description: 'A table read lands.', severity: 'medium', costDelta: 0, qualityDelta: 4, buzzDelta: 0, delayDaysDelta: 0, impact: 'script' },
  { id: 'on-set-lighting-failure', description: 'The rig fails.', severity: 'medium', costDelta: 20_000, qualityDelta: -3, buzzDelta: -1, delayDaysDelta: 1, impact: 'visual' },
];

/** The parts both paths share. */
function parts(talent: TalentAssignment[]) {
  return {
    title: draft.script!.title,
    genre: draft.genre!,
    targetAudience: draft.targetAudience!,
    script: draft.script!,
    talent,
    productionChoices: draft.productionChoices!,
    postProductionChoices: draft.postProductionChoices!,
    marketingChoices: draft.marketingChoices!,
    events,
    postProductionEvents: [] as ProductionEvent[],
    photographyCost: 1_000_000,
    shootingRatio: 1.04,
    studioBrand: 55,
    studioGenreIdentity: 20,
    competitiveCrowding: 0.1,
  };
}

/** Shaped as engine/marketSettlement.ts:resolvePlayerRelease builds it, every player-only lever neutral. */
const playerInput = (talent: TalentAssignment[]): ReleaseComputationInput => ({
  ...parts(talent),
  preProductionCost: 0,
  producerEffects: NEUTRAL_PRODUCER_EFFECTS,
  producerFees: 0,
  stuntTeamSkill: undefined,
  stuntTeamFee: 0,
  pressTourMoment: { buzzDelta: 0, storyBeat: null },
  marketingRolloutMultiplier: 1,
  marketingRunwayWeeks: undefined,
  developmentQualityDelta: 0,
  directorToneShift: undefined,
});

/** Shaped as engine/rivalStudios.ts:resolveRivalProduction builds it. */
const rivalInput = (talent: TalentAssignment[]): ReleaseComputationInput => parts(talent);

describe('one scoring model: player and rival films scored alike', () => {
  for (const [label, talent] of [['no craft heads', draft.talent], ['strong craft heads', withHeads(90)], ['weak craft heads', withHeads(20)]] as const) {
    it(`quality, critic and audience scores are equal (${label})`, () => {
      const player = computeReleaseResults(playerInput(talent), createRng(11)).results;
      const rival = computeReleaseResults(rivalInput(talent), createRng(11)).results;
      expect(rival.qualityScore).toBe(player.qualityScore);
      expect(rival.criticScore).toBe(player.criticScore);
      expect(rival.audienceScore).toBe(player.audienceScore);
      expect(rival.postProductionScore).toBe(player.postProductionScore);
      expect(rival.productionScore).toBe(player.productionScore);
    });
  }

  it('a rival film\'s post-production score is higher with a strong Editor and Composer than with weak ones', () => {
    const strong = computeReleaseResults(rivalInput(withHeads(90)), createRng(5)).results;
    const weak = computeReleaseResults(rivalInput(withHeads(20)), createRng(5)).results;
    expect(strong.postProductionScore).toBeGreaterThan(weak.postProductionScore);
    expect(computeScriptScore(draft.script!)).toBeGreaterThan(0); // the fixture is a real script
  });
});
