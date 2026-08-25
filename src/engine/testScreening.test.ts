import { describe, it, expect } from 'vitest';
import { generateTestScreeningPendingChoice } from './testScreening';
import { buildReadyDraft } from '../state/testFixtures';
import { generateTalentCandidates } from './talentGenerator';
import { withRng } from './random';
import { DEFAULT_POST_PRODUCTION_CHOICES } from '../data/postProduction';
import type { CrewCareer, FilmDraft } from '../types';

// buildReadyDraft only casts Director/Lead Actor/Supporting Actor (it's
// meant for release-flow tests, where Editor doesn't matter) - the test
// screening is specifically Editor-skill-sensitive, so these tests need one
// on the draft.
function draftWithEditor(seed: number, editorSkillOverride?: number): FilmDraft {
  const base = withRng(seed, (rng) => buildReadyDraft(rng)).result;
  const editor = withRng(seed + 500, (rng) => generateTalentCandidates('Editor', rng, 1)).result[0];
  const withSkill = editorSkillOverride !== undefined
    ? { ...editor, careers: { ...editor.careers, editor: { ...(editor.careers.editor as CrewCareer<'Editor'>), skill: editorSkillOverride } } }
    : editor;
  return { ...base, talent: [...base.talent, { role: 'Editor', person: withSkill }] };
}

describe('generateTestScreeningPendingChoice', () => {
  it('always offers exactly the four Phase B choices, in order', () => {
    const draft = draftWithEditor(1);
    const pending = withRng(2, (rng) => generateTestScreeningPendingChoice(draft, rng)).result;
    expect(pending.choices.map((c) => c.id)).toEqual(['release-as-is', 're-edit', 'pickups', 'major-reshoots']);
  });

  it('Release As-Is always rolls to exactly zero cost, quality, buzz, and delay', () => {
    const draft = draftWithEditor(3);
    const pending = withRng(4, (rng) => generateTestScreeningPendingChoice(draft, rng)).result;
    const releaseAsIs = pending.choices.find((c) => c.id === 'release-as-is')!;
    expect(releaseAsIs.costRange).toEqual([0, 0]);
    expect(releaseAsIs.qualityRange).toEqual([0, 0]);
    expect(releaseAsIs.buzzRange).toEqual([0, 0]);
    expect(releaseAsIs.delayDaysRange).toEqual([0, 0]);
  });

  it('Major Reshoots costs and can delay more than Pickups, which costs and can delay more than Re-edit', () => {
    // No budget pinning: the ordering now holds BY CONSTRUCTION, because each
    // option is strictly the previous one plus more work (engine/testScreening.ts:
    // reshootCostRange). It used to depend on the fixture being a big enough
    // film, since re-edit was flat while the others scaled with the shoot.
    const draft = draftWithEditor(5, 50);
    const pending = withRng(6, (rng) => generateTestScreeningPendingChoice(draft, rng)).result;
    const reEdit = pending.choices.find((c) => c.id === 're-edit')!;
    const pickups = pending.choices.find((c) => c.id === 'pickups')!;
    const reshoots = pending.choices.find((c) => c.id === 'major-reshoots')!;
    expect(reEdit.costRange[1]).toBeLessThan(pickups.costRange[0]);
    expect(pickups.costRange[1]).toBeLessThan(reshoots.costRange[0]);
    expect(reEdit.delayDaysRange[1]).toBeLessThan(pickups.delayDaysRange[0]);
    expect(pickups.delayDaysRange[1]).toBeLessThan(reshoots.delayDaysRange[0]);
  });

  it('keeps that cost ordering at every budget level, including the small films that used to invert it', () => {
    for (const shootingBudgetAmount of [200_000, 1_000_000, 8_000_000, 40_000_000, 75_000_000]) {
      const base = draftWithEditor(11, 50);
      const draft = { ...base, productionChoices: { ...base.productionChoices!, shootingBudgetAmount } };
      const pending = withRng(12, (rng) => generateTestScreeningPendingChoice(draft, rng)).result;
      const cost = (id: string) => pending.choices.find((c) => c.id === id)!.costRange;
      expect(cost('re-edit')[1]).toBeLessThan(cost('pickups')[0]);
      expect(cost('pickups')[1]).toBeLessThan(cost('major-reshoots')[0]);
    }
  });

  it('prices a recut off the cutting room and the VFX it disturbs, not the shooting budget', () => {
    const base = draftWithEditor(13, 50);
    const lean = { ...base, productionChoices: { ...base.productionChoices!, vfxAmount: 5_000 } };
    const effectsLed = { ...base, productionChoices: { ...base.productionChoices!, vfxAmount: 60_000_000 } };
    const reEditCostOf = (draft: FilmDraft) =>
      withRng(14, (rng) => generateTestScreeningPendingChoice(draft, rng)).result.choices.find((c) => c.id === 're-edit')!.costRange[0];

    // A recut on an effects-led film puts finished shots back in play; on a
    // VFX-free one it is pure editorial. Same shoot, very different recut.
    expect(reEditCostOf(effectsLed)).toBeGreaterThan(reEditCostOf(lean) * 5);

    // ...and the shooting budget alone does not move it at all.
    const richShoot = { ...lean, productionChoices: { ...lean.productionChoices, shootingBudgetAmount: 70_000_000 } };
    expect(reEditCostOf(richShoot)).toBe(reEditCostOf(lean));
  });

  it('costs more to recut the later you leave it, as more of the finish is locked', () => {
    // Integration debt in another department: the price of a change is set by
    // how much already-committed work it destroys.
    const base = draftWithEditor(15, 50);
    const draft = { ...base, productionChoices: { ...base.productionChoices!, vfxAmount: 30_000_000 } };
    const at = (round: number) =>
      withRng(16, (rng) => generateTestScreeningPendingChoice(draft, rng, round)).result.choices.find((c) => c.id === 're-edit')!.costRange[0];
    expect(at(1)).toBeGreaterThan(at(0));
    expect(at(2)).toBeGreaterThan(at(1));
  });

  it('reshoot cost tracks the film: a bigger shooting budget (pricier shoot days) costs more to reshoot', () => {
    const base = draftWithEditor(5, 50);
    const lean: FilmDraft = { ...base, productionChoices: { ...base.productionChoices!, shootingBudgetAmount: 500_000 } };
    const lavish: FilmDraft = { ...base, productionChoices: { ...base.productionChoices!, shootingBudgetAmount: 40_000_000 } };
    const pickupsCost = (d: FilmDraft) => withRng(6, (rng) => generateTestScreeningPendingChoice(d, rng)).result.choices.find((c) => c.id === 'pickups')!.costRange[0];
    // Same talent, same reshoot scope - only the shoot-day burn differs, so the
    // lavish production's pickups cost strictly more.
    expect(pickupsCost(lavish)).toBeGreaterThan(pickupsCost(lean));
  });

  it('Major Reshoots is the only choice with real downside risk (a negative floor) at neutral skill', () => {
    const draft = draftWithEditor(7, 50);
    const pending = withRng(8, (rng) => generateTestScreeningPendingChoice(draft, rng)).result;
    expect(pending.choices.find((c) => c.id === 'major-reshoots')!.qualityRange[0]).toBeLessThan(0);
    expect(pending.choices.find((c) => c.id === 're-edit')!.qualityRange[0]).toBeGreaterThanOrEqual(0);
    expect(pending.choices.find((c) => c.id === 'pickups')!.qualityRange[0]).toBeGreaterThanOrEqual(0);
  });

  it('is skill-sensitive to the Editor - a stronger Editor shifts the risky choices toward better outcomes', () => {
    const weakEditorDraft = draftWithEditor(9, 5);
    const strongEditorDraft = draftWithEditor(9, 95);

    const weakPending = withRng(10, (rng) => generateTestScreeningPendingChoice(weakEditorDraft, rng)).result;
    const strongPending = withRng(10, (rng) => generateTestScreeningPendingChoice(strongEditorDraft, rng)).result;

    const weakReshoots = weakPending.choices.find((c) => c.id === 'major-reshoots')!;
    const strongReshoots = strongPending.choices.find((c) => c.id === 'major-reshoots')!;
    expect(strongReshoots.qualityRange[0]).toBeGreaterThan(weakReshoots.qualityRange[0]);
    expect(strongReshoots.qualityRange[1]).toBeGreaterThan(weakReshoots.qualityRange[1]);
  });

  it('reuses the shared DEFAULT_POST_PRODUCTION_CHOICES provisional baseline, not a locally duplicated default', () => {
    const draft = draftWithEditor(11);
    // Sanity that the fixture itself already matches the shared default -
    // this is really asserting generateTestScreeningPendingChoice doesn't
    // throw or misbehave when fed the same shared constant every other
    // provisional read (PostProduction.tsx, this function) also uses.
    expect(draft.postProductionChoices).toEqual(DEFAULT_POST_PRODUCTION_CHOICES);
    const pending = withRng(12, (rng) => generateTestScreeningPendingChoice(draft, rng)).result;
    expect(pending.situation.length).toBeGreaterThan(0);
  });

  it('names the Editor as the involved talent', () => {
    const draft = draftWithEditor(13);
    const editor = draft.talent.find((a) => a.role === 'Editor')!.person;
    const pending = withRng(14, (rng) => generateTestScreeningPendingChoice(draft, rng)).result;
    expect(pending.involvedTalentId).toBe(editor.id);
    expect(pending.involvedRole).toBe('Editor');
  });

  // Phase C - iterative screenings. A follow-up screening (round >= 1, once at
  // least one recut has happened) adds the "use the original cut" escape hatch
  // and reports how the last recut tested.
  function withPriorRound(draft: FilmDraft, qualityDelta: number): FilmDraft {
    return {
      ...draft,
      postProductionEvents: [
        { id: 'test-screening', description: 'a prior recut', severity: 'medium', costDelta: 250_000, qualityDelta, buzzDelta: 1, delayDaysDelta: 6 },
      ],
    };
  }

  it('the first screening (round 0) never offers reverting to the original', () => {
    const draft = draftWithEditor(20);
    const pending = withRng(21, (rng) => generateTestScreeningPendingChoice(draft, rng, 0)).result;
    expect(pending.choices.some((c) => c.id === 'revert-to-original')).toBe(false);
  });

  it('a follow-up screening (round >= 1) also offers reverting to the original cut, at zero cost and delay', () => {
    const draft = withPriorRound(draftWithEditor(22), 6);
    const pending = withRng(23, (rng) => generateTestScreeningPendingChoice(draft, rng, 1)).result;
    expect(pending.choices.map((c) => c.id)).toEqual(['release-as-is', 're-edit', 'pickups', 'major-reshoots', 'revert-to-original']);
    const revert = pending.choices.find((c) => c.id === 'revert-to-original')!;
    expect(revert.costRange).toEqual([0, 0]);
    expect(revert.delayDaysRange).toEqual([0, 0]);
  });

  it('the follow-up intro reflects whether the last recut tested better or worse', () => {
    const better = withPriorRound(draftWithEditor(24), 12);
    const worse = withPriorRound(draftWithEditor(24), -12);
    const betterPending = withRng(25, (rng) => generateTestScreeningPendingChoice(better, rng, 1)).result;
    const worsePending = withRng(25, (rng) => generateTestScreeningPendingChoice(worse, rng, 1)).result;
    expect(betterPending.situation).toContain('better than before');
    expect(worsePending.situation).toContain('worse than before');
  });
});
