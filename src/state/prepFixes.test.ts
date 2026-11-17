// Regression tests for the pre-production fixes
// (docs/IMPLEMENTATION_PLAN_preproduction_realism.md Phase 1).
import { describe, it, expect } from 'vitest';
import { studioReducer, expectedShootEndDay } from './studioReducer';
import { buildStateWithReadyDraft } from './testFixtures';
import { asPlayerDraft, deriveInboxItems, findProject, inboxBadgeCount, playerDraftToProject } from '../engine/project';
import { deriveProjectReadiness } from '../engine/projectReadiness';
import { computeProductionBudgetCost, computeTalentCost } from '../engine/cost';
import { computeRecommendedPreProductionDays, computeRecommendedShootDays } from '../engine/production';
import { effectivePreProductionDays } from '../engine/prepLength';
import { deriveRequirementProfile } from '../engine/requirementProfile';
import { SETTING_ARCHETYPE_PROFILES } from '../data/settings';
import { PREP_CORE_DAYS } from '../data/prep';
import { generateTalentCandidates } from '../engine/talentGenerator';
import { withRng } from '../engine/random';
import { professionForProductionRole } from '../data/helpers';
import type { GameState } from './gameState';
import type { FilmDraft, PendingEventChoice, PreProductionState, TalentAssignment } from '../types';

const prep = (overrides: Partial<PreProductionState> = {}): PreProductionState => ({
  status: 'in-progress', recommendedDays: 40, daysElapsed: 0, events: [], runningCost: 0, pendingChoice: null, ...overrides,
});

/** One film in prep (not focused), plus the ready draft re-identified as a second film. */
function twoFilmState(first: Partial<FilmDraft>, second?: Partial<FilmDraft>): GameState {
  const base = buildStateWithReadyDraft(1);
  const draft = asPlayerDraft(base.projects[0])!;
  const a: FilmDraft = { ...draft, id: 'film-a', photography: null, postProductionScreeningReadyDay: null, preProduction: prep(), ...first };
  const projects = [playerDraftToProject(a)];
  if (second) projects.push(playerDraftToProject({ ...draft, id: 'film-b', photography: null, postProductionScreeningReadyDay: null, preProduction: prep(), ...second }));
  return { ...base, screen: 'dashboard', projects, focusedProjectId: null };
}
const draftOf = (s: GameState, id: string) => asPlayerDraft(findProject(s.projects, id))!;

const choice: PendingEventChoice = {
  templateId: 'preprod-int-rewrite-window', situation: 'A narrow window for one more pass.', polarity: 'positive', severity: 'low',
  choices: [
    { id: 'lock', label: 'Lock it', description: 'Keep the schedule.', costRange: [0, 0], qualityRange: [0, 0], buzzRange: [0, 0], delayDaysRange: [0, 0] },
  ],
};

describe('prep decisions reach the Inbox', () => {
  it('lists a backgrounded prep paused on a decision, and the badge counts it', () => {
    const s = twoFilmState({ preProduction: prep({ status: 'awaiting-choice', pendingChoice: choice }) });
    const items = deriveInboxItems(s.projects, null, s.totalDays);
    expect(items.prepAwaitingChoice.map((d) => d.id)).toEqual(['film-a']);
    const without = twoFilmState({});
    expect(inboxBadgeCount(s.projects, null, s.totalDays)).toBe(inboxBadgeCount(without.projects, null, without.totalDays) + 1);
  });

  it('leaves the focused film out (its own screen shows the decision)', () => {
    const s = twoFilmState({ preProduction: prep({ status: 'awaiting-choice', pendingChoice: choice }) });
    expect(deriveInboxItems(s.projects, 'film-a', s.totalDays).prepAwaitingChoice).toEqual([]);
  });

  it('is answered from the Inbox by production id and resumes prep', () => {
    const s = twoFilmState({ preProduction: prep({ status: 'awaiting-choice', pendingChoice: choice }) });
    const after = studioReducer(s, { type: 'RESOLVE_PREPRODUCTION_CHOICE', choiceId: 'lock', productionId: 'film-a' });
    expect(draftOf(after, 'film-a').preProduction!.status).toBe('in-progress');
    expect(deriveInboxItems(after.projects, null, after.totalDays).prepAwaitingChoice).toEqual([]);
  });
});

describe('one prep length everywhere', () => {
  it('the shared helper honours a long design window, as the reducer does', () => {
    const draft = asPlayerDraft(buildStateWithReadyDraft(2).projects[0])!;
    const choices = { ...draft.productionChoices!, designPrepDays: 300 };
    // The design window is the slowest chain, so prep is the core plus it.
    expect(effectivePreProductionDays(draft.talent, draft.script!, choices)).toBe(PREP_CORE_DAYS + 300);
    expect(computeRecommendedPreProductionDays(draft.talent, draft.script!, choices)).toBe(PREP_CORE_DAYS + 300);
  });
});

describe('the greenlight gate counts the contingency reserve', () => {
  it('blocks a studio that can cover everything but the reserve', () => {
    const s = buildStateWithReadyDraft(3);
    const draft: FilmDraft = { ...asPlayerDraft(s.projects[0])!, photography: null, preProduction: null };
    const reserve = 5_000_000;
    const withReserve: FilmDraft = { ...draft, productionChoices: { ...draft.productionChoices!, contingencyReserveAmount: reserve } };
    const committed = computeTalentCost(draft.talent) + computeProductionBudgetCost(draft.productionChoices!) + draft.productionChoices!.shootingBudgetAmount;
    expect(deriveProjectReadiness(withReserve, committed + reserve / 2).blockers.some((b) => b.code === 'cannot-afford-greenlight')).toBe(true);
    expect(deriveProjectReadiness(withReserve, committed + reserve * 2).blockers.some((b) => b.code === 'cannot-afford-greenlight')).toBe(false);
  });
});

describe('cast size counts actors, not crew', () => {
  it('hiring a production designer does not lengthen prep or the shoot, even on a fully crewed film', () => {
    const draft = asPlayerDraft(buildStateWithReadyDraft(4).projects[0])!;
    // A full package - well past the old count's baseline of six hires - so the
    // old talent.length reading would have charged the designer as a seventh.
    const crew: TalentAssignment[] = (['Writer', 'Cinematographer', 'Composer', 'Editor'] as const).map((role, i) => ({
      role,
      person: withRng(30 + i, (rng) => generateTalentCandidates(role, rng, 1)[0]).result,
    }));
    const crewed = [...draft.talent, ...crew];
    const designer = withRng(9, (rng) => generateTalentCandidates('Production Designer', rng, 1)[0]).result;
    const withDesigner: TalentAssignment[] = [...crewed, { role: 'Production Designer', person: designer }];
    expect(crewed.length).toBeGreaterThanOrEqual(7);
    expect(computeRecommendedShootDays(withDesigner, draft.script!, draft.productionChoices!)).toBe(computeRecommendedShootDays(crewed, draft.script!, draft.productionChoices!));
  });

  it('another actor still does', () => {
    const draft = asPlayerDraft(buildStateWithReadyDraft(4).projects[0])!;
    const extra = withRng(10, (rng) => generateTalentCandidates('Actor', rng, 1)[0]).result;
    const withActors: TalentAssignment[] = [...draft.talent, { role: 'Supporting Actor', person: extra }];
    expect(computeRecommendedShootDays(withActors, draft.script!, draft.productionChoices!)).toBeGreaterThan(computeRecommendedShootDays(draft.talent, draft.script!, draft.productionChoices!));
  });
});

describe('one period flag', () => {
  it('the requirement profile reads the setting archetype, whatever the coarse copy says', () => {
    const draft = asPlayerDraft(buildStateWithReadyDraft(5).projects[0])!;
    const period = { ...draft.script!, primarySetting: 'MedievalKingdom' as const, productionRequirements: { ...draft.script!.productionRequirements, periodSetting: false } };
    expect(SETTING_ARCHETYPE_PROFILES.MedievalKingdom.periodSetting).toBe(true);
    expect(deriveRequirementProfile(period).some((leaf) => leaf.key === 'periodCostume')).toBe(true);
  });
});

describe('prep keeps pace with the calendar', () => {
  it('a held film starts by itself once its start day arrives, with no prep credited for the days it waited', () => {
    const s = { ...twoFilmState({ shootStartsOnDay: 3, preProduction: prep({ status: 'scheduled' }) }), totalDays: 1 };
    let after = studioReducer(s, { type: 'ADVANCE_DAY' });
    expect(draftOf(after, 'film-a').preProduction!.status).toBe('scheduled');
    after = studioReducer(after, { type: 'ADVANCE_DAY' });
    const started = draftOf(after, 'film-a').preProduction!;
    expect(started.status).not.toBe('scheduled');
    // Arriving on the start day itself credits nothing, as ADVANCE_TO_SHOOT_START does.
    expect(started.daysElapsed).toBe(0);
    expect(started.runningCost).toBe(0);
  });

  it('a long jump past the start day credits only the days since the start', () => {
    const s: GameState = { ...twoFilmState({ shootStartsOnDay: 3, preProduction: prep({ status: 'scheduled' }) }, { preProduction: prep({ status: 'awaiting-choice', pendingChoice: { ...choice, choices: [{ ...choice.choices[0], delayDaysRange: [9, 9] }] } }) }), totalDays: 1 };
    const after = studioReducer(s, { type: 'RESOLVE_PREPRODUCTION_CHOICE', choiceId: 'lock', productionId: 'film-b' });
    expect(after.totalDays).toBe(10);
    const a = draftOf(after, 'film-a').preProduction!;
    // Seven days since day 3, plus any delay days its own prep events added.
    expect(a.daysElapsed).toBe(7 + a.events.reduce((sum, e) => sum + e.delayDaysDelta, 0));
  });

  it('does not advance a film through the very jump that started it (advance to the shoot start)', () => {
    const s: GameState = { ...twoFilmState({ shootStartsOnDay: 8, preProduction: prep({ status: 'scheduled' }) }), totalDays: 1, focusedProjectId: 'film-a' };
    const after = studioReducer(s, { type: 'ADVANCE_TO_SHOOT_START' });
    expect(after.totalDays).toBe(8);
    expect(draftOf(after, 'film-a').preProduction!.daysElapsed).toBe(0);
  });

  it("another film's prep advances while the focused film preps", () => {
    const s: GameState = { ...twoFilmState({}, {}), focusedProjectId: 'film-b', screen: 'pre-production' };
    const after = studioReducer(s, { type: 'ADVANCE_PREPRODUCTION_DAY' });
    expect(after.totalDays).toBeGreaterThan(s.totalDays);
    expect(draftOf(after, 'film-a').preProduction!.daysElapsed).toBeGreaterThan(0);
  });

  it('advances each prep exactly once on the daily tick', () => {
    const s = twoFilmState({}, {});
    const after = studioReducer(s, { type: 'ADVANCE_DAY' });
    for (const id of ['film-a', 'film-b']) {
      const p = draftOf(after, id).preProduction!;
      // One day, plus any delay days a prep event added - never two separate advances.
      expect(p.daysElapsed).toBeLessThanOrEqual(1 + p.events.reduce((sum, e) => sum + e.delayDaysDelta, 0));
    }
  });
});

describe('bookings follow the film', () => {
  it("extends a hire's booking when the film's expected end moves past it", () => {
    const base = twoFilmState({});
    const director = draftOf(base, 'film-a').talent.find((a) => a.role === 'Director')!.person;
    const profession = professionForProductionRole('Director');
    const booked = { ...director, availability: { commitments: [{ projectId: 'film-a', role: 'Director' as const, startDay: 1, endDay: 2 }] } };
    const s: GameState = { ...base, talentPool: { ...base.talentPool, [profession]: [booked, ...base.talentPool[profession]] } };
    const after = studioReducer(s, { type: 'ADVANCE_DAY' });
    const end = expectedShootEndDay(draftOf(after, 'film-a'), after.totalDays)!;
    const commitment = after.talentPool[profession].find((p) => p.id === director.id)!.availability.commitments.find((c) => c.projectId === 'film-a')!;
    expect(end).toBeGreaterThan(2);
    expect(commitment.endDay).toBe(end);
  });

  it('extends bookings for a shoot running past its schedule', () => {
    const base = twoFilmState({ preProduction: prep({ status: 'finished' }), photography: { status: 'in-progress', recommendedDays: 10, daysElapsed: 14, events: [], runningCost: 0, pendingChoice: null } });
    const lead = draftOf(base, 'film-a').talent.find((a) => a.role === 'Lead Actor')!.person;
    const profession = professionForProductionRole('Lead Actor');
    const booked = { ...lead, availability: { commitments: [{ projectId: 'film-a', role: 'Lead Actor' as const, startDay: 1, endDay: 1 }] } };
    const s: GameState = { ...base, talentPool: { ...base.talentPool, [profession]: [booked, ...base.talentPool[profession]] } };
    const after = studioReducer(s, { type: 'ADVANCE_DAY' });
    const commitment = after.talentPool[profession].find((p) => p.id === lead.id)!.availability.commitments.find((c) => c.projectId === 'film-a')!;
    expect(commitment.endDay).toBeGreaterThan(after.totalDays);
  });
});
