// Coverage-unification cutover (docs/DESIGN_production_requirements_model.md).
// The facet math is covered in cinematographyFacet/scoreFacet/editFacet tests;
// this file covers the SCORING WIRING: person-driven Cinematography/Score/Edit
// quality reaches productionScore/postProductionScore for player films
// (personDrivenCraft true), does NOT for rivals/base model (false), and is
// zero when the heads aren't attached (so an unstaffed film is byte-identical).
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

function breakdown(talent: TalentAssignment[], personDrivenCraft: boolean) {
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
    personDrivenCraft,
  );
}

describe('person-driven craft cutover — the scoring wiring', () => {
  it('a strong DP/Composer/Editor lifts productionScore and postProductionScore (player path)', () => {
    const none = breakdown(base, true);
    const strong = breakdown([...base, ...craftHeads(95)], true);
    // Cinematography flows into productionScore; Score+Edit into postProductionScore.
    expect(strong.productionScore).toBeGreaterThan(none.productionScore);
    expect(strong.postProductionScore).toBeGreaterThan(none.postProductionScore);
  });

  it('is monotonic in craft skill (a stronger craft team never scores lower)', () => {
    const weak = breakdown([...base, ...craftHeads(25)], true);
    const strong = breakdown([...base, ...craftHeads(95)], true);
    expect(strong.productionScore).toBeGreaterThanOrEqual(weak.productionScore);
    expect(strong.postProductionScore).toBeGreaterThan(weak.postProductionScore);
  });

  it('rivals / base model (personDrivenCraft false) ignore craft heads entirely', () => {
    const none = breakdown(base, false);
    const strong = breakdown([...base, ...craftHeads(95)], false);
    expect(strong.productionScore).toBe(none.productionScore);
    expect(strong.postProductionScore).toBe(none.postProductionScore);
  });

  it('an unstaffed player film is byte-identical whether the flag is on or off (deviation is zero at no-head)', () => {
    const off = breakdown(base, false);
    const on = breakdown(base, true);
    expect(on.productionScore).toBe(off.productionScore);
    expect(on.postProductionScore).toBe(off.postProductionScore);
    expect(on.qualityScore).toBe(off.qualityScore);
  });
});
