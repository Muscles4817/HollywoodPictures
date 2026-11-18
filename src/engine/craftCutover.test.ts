// Coverage-unification cutover (docs/DESIGN_production_requirements_model.md).
// The facet math is covered in cinematographyFacet/scoreFacet/editFacet tests;
// this file covers the SCORING WIRING: person-driven Cinematography/Score/Edit
// quality reaches productionScore/postProductionScore for every film (player's
// and rival's - one scoring model since docs/IMPLEMENTATION_PLAN_market_realism.md
// Phase 2), and is zero when the heads aren't attached (so an unstaffed film
// scores what the old flat model gave it).
import { describe, it, expect } from 'vitest';
import { computeQualityBreakdown } from './scoring';
import { buildReadyDraft } from '../state/testFixtures';
import { generateTalentCandidates } from './talentGenerator';
import { withRng } from './random';
import type { CrewRole, TalentAssignment } from '../types';

const draft = withRng(1, (rng) => buildReadyDraft(rng)).result;
const base = draft.talent; // Director + Lead + Supporting, no craft heads

const CAREER_KEY: Record<string, string> = { Cinematographer: 'cinematographer', Composer: 'composer', Editor: 'editor' };
function head(role: CrewRole, seed: number, skill: number): TalentAssignment {
  const { result: person } = withRng(seed, (rng) => generateTalentCandidates(role, rng, 1)[0]);
  const key = CAREER_KEY[role];
  return { role, person: { ...person, careers: { ...person.careers, [key]: { ...(person.careers as Record<string, unknown>)[key] as object, role, skill } } } };
}

const craftHeads = (skill: number): TalentAssignment[] => [
  head('Cinematographer', 10, skill),
  head('Composer', 11, skill),
  head('Editor', 12, skill),
];

function breakdown(talent: TalentAssignment[]) {
  return computeQualityBreakdown(
    draft.script!,
    talent,
    draft.genre!,
    draft.productionChoices!,
    draft.postProductionChoices!,
    [], // no events
    1, // shot to schedule
    0, // no producer bonus
    undefined, // execution derived
    undefined, // stunt fallback
  );
}

describe('person-driven craft cutover — the scoring wiring', () => {
  it('a strong DP/Composer/Editor lifts productionScore and postProductionScore (player path)', () => {
    const none = breakdown(base);
    const strong = breakdown([...base, ...craftHeads(95)]);
    // Cinematography flows into productionScore; Score+Edit into postProductionScore.
    expect(strong.productionScore).toBeGreaterThan(none.productionScore);
    expect(strong.postProductionScore).toBeGreaterThan(none.postProductionScore);
  });

  it('is monotonic in craft skill (a stronger craft team never scores lower)', () => {
    const weak = breakdown([...base, ...craftHeads(25)]);
    const strong = breakdown([...base, ...craftHeads(95)]);
    expect(strong.productionScore).toBeGreaterThanOrEqual(weak.productionScore);
    expect(strong.postProductionScore).toBeGreaterThan(weak.postProductionScore);
  });

  it('an unstaffed film scores exactly what the old flat model gave it (deviation is zero at no-head)', () => {
    // Pinned from the flat model (personDrivenCraft false) before the flag was
    // deleted: the no-head deviation is zero, so nothing moved.
    const none = breakdown(base);
    expect(none.productionScore).toBe(53.20531577634462);
    expect(none.postProductionScore).toBe(65);
    expect(none.qualityScore).toBe(40.49055511048697);
  });
});
