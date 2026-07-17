import { describe, it, expect } from 'vitest';
import { deriveProjectReadiness } from './projectReadiness';
import { createDraftFromAsset } from '../state/gameState';
import { buildReadyAsset } from '../state/testFixtures';
import { generateTalentCandidates } from './talentGenerator';
import { withRng } from './random';
import { effectiveRoleCapacity } from './castRequirements';
import { MANDATORY_TALENT_ROLES } from '../data/talentGeneration';
import { professionForProductionRole } from '../data/helpers';
import { PRACTICAL_EFFECTS_RANGE, VFX_RANGE } from '../data/production';
import { computeTalentCost } from './cost';
import type { FilmDraft, ProductionChoices, ProductionRole, TalentAssignment } from '../types';

const CHEAP_CHOICES: ProductionChoices = {
  contingencyAmount: 200_000,
  setQualityAmount: 200_000,
  practicalEffectsAmount: PRACTICAL_EFFECTS_RANGE.min,
  vfxAmount: VFX_RANGE.min,
  runtimeIntensity: 0.5,
};

/** A fresh, empty draft (an owned Asset, no hires, no plan) - the starting point for every test below. */
function emptyDraft(seed: number): FilmDraft {
  const { result: asset } = withRng(seed, (rng) => buildReadyAsset(rng));
  return createDraftFromAsset(asset, {});
}

/** Hires enough distinct candidates to satisfy every MANDATORY_TALENT_ROLES slot's own effectiveRoleCapacity.min. */
function fullCast(seed: number, draft: FilmDraft): TalentAssignment[] {
  const assignments: TalentAssignment[] = [];
  let drawSeed = seed;
  for (const role of MANDATORY_TALENT_ROLES) {
    const profession = professionForProductionRole(role);
    const need = Math.max(1, effectiveRoleCapacity(role, draft.script).min);
    const { result: candidates } = withRng(drawSeed, (rng) => generateTalentCandidates(profession, rng, need));
    drawSeed += 1;
    for (const person of candidates) assignments.push({ role, person });
  }
  return assignments;
}

function readyDraft(seed: number): FilmDraft {
  const draft = emptyDraft(seed);
  return { ...draft, talent: fullCast(seed, draft), productionChoices: CHEAP_CHOICES };
}

describe('deriveProjectReadiness - the core ready/not-ready split', () => {
  it('a fully-cast, planned, affordable draft is ready with no blockers', () => {
    const draft = readyDraft(1);
    const readiness = deriveProjectReadiness(draft, 50_000_000);
    expect(readiness.ready).toBe(true);
    expect(readiness.blockers).toEqual([]);
    expect(readiness.recommendedNextSection).toBeNull();
  });

  it('a completely empty draft is not ready and blocks on every missing prerequisite', () => {
    const draft = emptyDraft(2);
    const readiness = deriveProjectReadiness(draft, 50_000_000);
    expect(readiness.ready).toBe(false);
    const codes = readiness.blockers.map((b) => b.code);
    expect(codes).toContain('missing-director');
    expect(codes).toContain('missing-mandatory-crew');
    expect(codes).toContain('production-plan-incomplete');
    expect(readiness.recommendedNextSection).toBe('cast-and-crew');
  });
});

describe('deriveProjectReadiness - individual cast blockers', () => {
  function withoutRole(draft: FilmDraft, role: ProductionRole): FilmDraft {
    return { ...draft, talent: draft.talent.filter((a) => a.role !== role) };
  }

  it('missing-director fires only when no Director is hired', () => {
    const draft = readyDraft(10);
    const readiness = deriveProjectReadiness(withoutRole(draft, 'Director'), 50_000_000);
    expect(readiness.blockers.map((b) => b.code)).toContain('missing-director');
    expect(readiness.sections.castAndCrew.status).toBe('incomplete');
  });

  it('missing-lead-cast fires only when Lead Actor capacity is unmet', () => {
    const draft = readyDraft(11);
    const readiness = deriveProjectReadiness(withoutRole(draft, 'Lead Actor'), 50_000_000);
    expect(readiness.blockers.map((b) => b.code)).toContain('missing-lead-cast');
  });

  it('missing-supporting-cast fires only when Supporting Actor capacity is unmet', () => {
    const draft = readyDraft(12);
    const readiness = deriveProjectReadiness(withoutRole(draft, 'Supporting Actor'), 50_000_000);
    expect(readiness.blockers.map((b) => b.code)).toContain('missing-supporting-cast');
  });

  it('missing-mandatory-crew names every still-missing crew role', () => {
    const draft = readyDraft(13);
    const withoutCrew = { ...draft, talent: draft.talent.filter((a) => a.role !== 'Writer' && a.role !== 'Editor') };
    const readiness = deriveProjectReadiness(withoutCrew, 50_000_000);
    const crewBlocker = readiness.blockers.find((b) => b.code === 'missing-mandatory-crew');
    expect(crewBlocker?.message).toContain('Writer');
    expect(crewBlocker?.message).toContain('Editor');
  });
});

describe('deriveProjectReadiness - production plan and affordability', () => {
  it('production-plan-incomplete fires whenever productionChoices is null, regardless of cast', () => {
    const draft = { ...readyDraft(20), productionChoices: null };
    const readiness = deriveProjectReadiness(draft, 50_000_000);
    expect(readiness.blockers.map((b) => b.code)).toContain('production-plan-incomplete');
    expect(readiness.sections.production.status).toBe('incomplete');
    expect(readiness.recommendedNextSection).toBe('production');
  });

  it('cannot-afford-greenlight fires when studio cash is short of the full commitment', () => {
    const draft = readyDraft(21);
    const readiness = deriveProjectReadiness(draft, 1);
    expect(readiness.ready).toBe(false);
    expect(readiness.blockers.map((b) => b.code)).toContain('cannot-afford-greenlight');
    expect(readiness.sections.finance.status).toBe('incomplete');
    expect(readiness.recommendedNextSection).toBe('finance');
  });

  it('low-cash-reserve is a warning, not a blocker, when cash after greenlighting is thin but non-negative', () => {
    const draft = readyDraft(22);
    const talentCost = computeTalentCost(draft.talent);
    const totalCommitment = talentCost + draft.productionChoices!.contingencyAmount + draft.productionChoices!.setQualityAmount + PRACTICAL_EFFECTS_RANGE.min + VFX_RANGE.min;
    const readiness = deriveProjectReadiness(draft, totalCommitment + 50_000);
    expect(readiness.ready).toBe(true);
    expect(readiness.warnings.map((w) => w.code)).toContain('low-cash-reserve');
    expect(readiness.sections.finance.status).toBe('warning');
  });
});

describe('deriveProjectReadiness - warnings never block readiness', () => {
  it('a ready draft missing only the optional VFX Supervisor is still ready, with a warning', () => {
    const draft = readyDraft(30);
    expect(draft.talent.some((a) => a.role === 'VFX Supervisor')).toBe(false);
    const readiness = deriveProjectReadiness(draft, 50_000_000);
    expect(readiness.ready).toBe(true);
    expect(readiness.warnings.map((w) => w.code)).toContain('optional-vfx-supervisor-missing');
  });
});

// Character and Setting Foundations milestone
// (docs/CHARACTER_AND_SETTING_FOUNDATIONS.md section 8) - underfunding an
// ambitious Setting Archetype should surface a visible, non-blocking warning
// rather than silently degrading quality with no explanation.
describe('deriveProjectReadiness - setting-underfunded warning', () => {
  it('fires, without blocking readiness, for an ambitious setting at a minimal (CHEAP_CHOICES) spend', () => {
    const draft = readyDraft(31);
    const ambitious = { ...draft, script: { ...draft.script!, primarySetting: 'FuturisticCity' as const } };
    const readiness = deriveProjectReadiness(ambitious, 50_000_000);
    expect(readiness.ready).toBe(true);
    expect(readiness.warnings.map((w) => w.code)).toContain('setting-underfunded');
  });

  it('does not fire for a modest, low-ambition setting at the same minimal spend', () => {
    const draft = readyDraft(32);
    const modest = { ...draft, script: { ...draft.script!, primarySetting: 'SuburbanCommunity' as const } };
    const readiness = deriveProjectReadiness(modest, 50_000_000);
    expect(readiness.warnings.map((w) => w.code)).not.toContain('setting-underfunded');
  });
});

// Casting Redesign, Phase A (docs/DESIGN_REVIEW_casting_redesign.md
// section 8) - a soft nudge, never a blocker, once there's still real
// casting to do and no Director attached yet.
describe('deriveProjectReadiness - cast-before-director warning', () => {
  it('fires when a Lead/Supporting role still needs casting and no Director is hired', () => {
    const draft = readyDraft(33);
    const withoutDirector = { ...draft, talent: draft.talent.filter((a) => a.role !== 'Director' && a.role !== 'Lead Actor') };
    const readiness = deriveProjectReadiness(withoutDirector, 50_000_000);
    expect(readiness.warnings.map((w) => w.code)).toContain('cast-before-director');
    expect(readiness.blockers.map((b) => b.code)).toContain('missing-director');
  });

  it('does not fire once every Lead/Supporting role is cast, even with no Director', () => {
    const draft = readyDraft(34);
    const withoutDirector = { ...draft, talent: draft.talent.filter((a) => a.role !== 'Director') };
    const readiness = deriveProjectReadiness(withoutDirector, 50_000_000);
    expect(readiness.warnings.map((w) => w.code)).not.toContain('cast-before-director');
  });

  it('does not fire once a Director is hired, regardless of remaining cast', () => {
    const draft = readyDraft(35);
    const withoutLead = { ...draft, talent: draft.talent.filter((a) => a.role !== 'Lead Actor') };
    const readiness = deriveProjectReadiness(withoutLead, 50_000_000);
    expect(readiness.warnings.map((w) => w.code)).not.toContain('cast-before-director');
  });
});
