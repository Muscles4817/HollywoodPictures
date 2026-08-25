// Post-Production Redesign, Phase B
// (docs/DESIGN_REVIEW_post_production_redesign.md section 2). Builds the
// one PendingEventChoice a film gets when its
// FilmDraft.postProductionScreeningReadyDay is reached - reusing the exact
// same PendingEventChoice/EventChoiceTemplate shape and roll math
// (engine/production.ts:resolveEventChoice) on-set events already use, so
// state/studioReducer.ts:RESOLVE_TEST_SCREENING_CHOICE and
// components/common/OnSetDecisionCard.tsx need no test-screening-specific
// branching at all.
import type { EventChoiceTemplate, EventSeverity, FilmDraft, PendingEventChoice, ProductionRole } from '../types';
import { computeQualityBreakdown, combineProductionEvents } from './scoring';
import { pickDepartmentBlurb } from './reviews';
import { DEFAULT_POST_PRODUCTION_CHOICES } from '../data/postProduction';
import { findAssignedPerson, filterAssignedPeople } from '../data/helpers';
import { getTypicalSalaryForRole } from './person';
import { computeDailyShootBurn } from './cost';
import { talentSkillScore, prepareChoicesForInvolvedTalent } from './production';
import { RESHOOT_REQUIREMENTS } from './reshootAvailability';
import type { RandomFn } from './random';

// Mirrors engine/reviews.ts's own CRITICISM_THRESHOLD - "the weakest
// department is genuinely a problem" - reused here only to color the
// screening's severity/polarity metadata, not to re-derive any new scoring.
const NEGATIVE_POLARITY_THRESHOLD = 45;
const MEDIUM_SEVERITY_FLOOR = 60;

// The id every "accept the cut in front of you" choice carries, whichever
// round it's offered in - the reducer keys its "lock this cut, stop editing"
// branch off it (state/studioReducer.ts:RESOLVE_TEST_SCREENING_CHOICE).
export const ACCEPT_CUT_CHOICE_ID = 'release-as-is';
// The id of the "throw the recuts away, go back to the original" choice, only
// offered once at least one editing round has happened. Its own reducer branch
// discards postProductionEvents rather than adding one.
export const REVERT_TO_ORIGINAL_CHOICE_ID = 'revert-to-original';

/** The "accept the current cut" option, worded for whether the player has recut yet. */
function acceptCutChoice(round: number): EventChoiceTemplate {
  return {
    id: ACCEPT_CUT_CHOICE_ID,
    label: round === 0 ? 'Release As-Is' : 'Keep This Cut',
    description:
      round === 0
        ? 'Accept the current cut and move forward - no further cost, delay, or quality change.'
        : 'Lock this recut as the final version and move forward - no further cost or delay.',
    costRange: [0, 0],
    qualityRange: [0, 0],
    buzzRange: [0, 0],
    delayDaysRange: [0, 0],
  };
}

// Offered only from the second screening on (once there's a recut to abandon) -
// discards every editing change and restores the cut as it first screened. The
// cash already spent editing is gone; only the quality/buzz the edits added
// come back off (handled in the reducer's revert branch, not by a roll here).
const REVERT_TO_ORIGINAL_CHOICE: EventChoiceTemplate = {
  id: REVERT_TO_ORIGINAL_CHOICE_ID,
  label: 'Use the Original Cut',
  description: 'Throw out every change from the editing bay and release the film exactly as it first tested - no further cost or delay. The money already spent editing is gone, but the original cut is restored.',
  costRange: [0, 0],
  qualityRange: [0, 0],
  buzzRange: [0, 0],
  delayDaysRange: [0, 0],
};

// --- What a recut actually costs -------------------------------------------
// See docs/domain/07-postproduction.md for how post money really behaves; this
// follows. In short, a re-edit is priced as two things, and neither of them is
// a share of the shooting budget:
//
//   1. KEEPING THE CUTTING ROOM OPEN. The unit is editorial weeks - the editor,
//      one to three assistants, the suite, storage and post-supervisor time. The
//      editor's own fee is the honest anchor for all of it, since the room's
//      cost is essentially the cost of the people in it.
//   2. WHAT THE NEW CUT INVALIDATES. A recut puts finished downstream work back
//      in play: VFX shots get re-timed, recut, dropped or newly ordered (and
//      vendors bill per shot, per version), music re-conforms, sound re-conforms
//      and re-mixes, the DI re-grades. On a VFX-led film this dwarfs the
//      editorial cost; on a Drama it rounds to nothing.
//
// The second term is integration debt in another department
// (docs/DESIGN_REVIEW_project_clocks_and_script_openness.md section 3.6): the
// price of a change is set by how much already-committed work it destroys. That
// is also why it grows with each screening round - the later you recut, the more
// of the finish is already locked.
//
// This replaces a flat 150k-350k, which was cheap for a tentpole and ruinous for
// a small film, and which could make the "cheap option" cost MORE than pickups.

/** The editorial crew and room for the extra weeks, as a share of the Editor's own per-film fee. */
const RE_EDIT_EDITORIAL_SHARE = 0.22;
/** Assistants, suite, storage and post-supervisor time, as a multiple of the editor's own share. */
const CUTTING_ROOM_MULTIPLIER = 2.2;
/** There is always a room and a crew, however small the film. */
const MIN_CUTTING_ROOM_COST = 20_000;
/** Share of the VFX budget a recut puts back in play at the first screening. */
const VFX_REWORK_SHARE = 0.025;
/** Each further round finds more of the finish locked, so the same recut invalidates more. */
const REWORK_LATENESS_PER_ROUND = 0.35;
const MAX_REWORK_LATENESS = 2;

/** A +/-15% range around a derived estimate - what every option here is quoted as. */
function costRange(estimate: number): [number, number] {
  return [Math.round(estimate * 0.85), Math.round(estimate * 1.15)];
}

/**
 * The cost of reopening the cutting room and re-finishing what the new cut
 * disturbs. EVERY option on this screening pays it - see reshootCostRange:
 * you cannot shoot pickups and then not cut them in.
 */
function reEditCost(draft: FilmDraft, round: number): number {
  const editor = findAssignedPerson(draft.talent, 'Editor');
  const editorFee = editor ? getTypicalSalaryForRole(editor, 'Editor') : 0;
  const cuttingRoom = Math.max(MIN_CUTTING_ROOM_COST, editorFee * RE_EDIT_EDITORIAL_SHARE * CUTTING_ROOM_MULTIPLIER);
  const lateness = Math.min(MAX_REWORK_LATENESS, 1 + round * REWORK_LATENESS_PER_ROUND);
  const rework = (draft.productionChoices?.vfxAmount ?? 0) * VFX_REWORK_SHARE * lateness;
  return cuttingRoom + rework;
}

// A focused editorial pass chasing the audience's specific notes - the
// cheap, fast, reliable option. Narrow ranges (little downside, modest
// upside) so it's a safe default rather than a trap. "Cheap" is now relative
// to the film: on an effects-led picture even a pure recut carries real
// re-finishing cost, which is the trade this option is meant to pose.
function reEditChoice(draft: FilmDraft, round: number): EventChoiceTemplate {
  return {
    id: 're-edit',
    label: 'Re-edit',
    description: "A focused editorial pass chasing the test audience's notes - the cutting room reopens and whatever the new cut disturbs has to be re-finished, for a short delay and a reliable if modest improvement.",
    costRange: costRange(reEditCost(draft, round)),
    qualityRange: [3, 9],
    buzzRange: [0, 1],
    delayDaysRange: [3, 8],
    skillSensitive: true,
  };
}

// A round of additional filming costs what a stretch of the actual shoot cost:
// the film's own daily shoot burn (engine/cost.ts:computeDailyShootBurn) for the
// filming days it needs, plus a rush fee to bring the principals back on short
// notice. This makes a reshoot's price track the production it belongs to - a
// lean indie's pickups cost a fraction of a tentpole's - rather than a flat
// authored number that's cheap for a blockbuster and ruinous for a small film.
// Pickups are a quick recall of the leads for a few days; major reshoots pull
// the whole principal cast (leads + supporting) and the director back for a much
// longer stretch - so major reshoots cost decisively more, both in shoot days and
// in the far bigger recall. Rates are the fraction of a person's per-film salary
// their short-notice recall costs.
// Roles and filming days come from RESHOOT_REQUIREMENTS so the option that
// PRICES a reshoot and the check for whether the cast can actually turn up for
// one can never disagree about what it involves (engine/reshootAvailability.ts).
// `recallRate` is the fraction of a person's per-film salary their short-notice
// recall costs, and lives here because it is purely a cost concern.
const PICKUPS = { ...RESHOOT_REQUIREMENTS.pickups, recallRate: 0.1 };
const MAJOR_RESHOOTS = { ...RESHOOT_REQUIREMENTS['major-reshoots'], recallRate: 0.25 };

/** The cost of recalling the given roles' principals for a reshoot - a rush-premium fraction of their per-film salaries. */
function talentRecallCost(draft: FilmDraft, roles: readonly ProductionRole[], rate: number): number {
  return roles
    .flatMap((role) => filterAssignedPeople(draft.talent, role).map((p) => getTypicalSalaryForRole(p, role)))
    .reduce((sum, salary) => sum + salary * rate, 0);
}

/**
 * A round of additional photography costs the shoot-day burn and the recall -
 * PLUS the full cost of a re-edit, because new footage has to be cut in and
 * everything downstream of the cut re-finished. That is not a surcharge, it is
 * the actual sequence of work: you cannot shoot pickups and then not edit.
 *
 * It also makes the option ordering hold BY CONSTRUCTION rather than by tuning.
 * Re-edit < Pickups < Major Reshoots is now true at every budget level, because
 * each option is strictly the previous one plus more work. The old model priced
 * reshoots as photography ALONE against a flat re-edit, so on a small enough
 * film the "cheap option" was genuinely the dearest.
 */
function reshootCostRange(draft: FilmDraft, spec: typeof PICKUPS | typeof MAJOR_RESHOOTS, round: number): [number, number] {
  const dailyBurn = draft.photography && draft.productionChoices
    ? computeDailyShootBurn(draft.productionChoices.shootingBudgetAmount, draft.photography.recommendedDays)
    : 0;
  const photography = dailyBurn * spec.filmingDays + talentRecallCost(draft, spec.roles, spec.recallRate);
  return costRange(reEditCost(draft, round) + photography);
}

// A short, targeted round of additional filming - real money and real time,
// wider outcome range than Re-edit since it's genuinely new footage. Cost tracks
// the film's own shoot-day burn for a few filming days plus recalling the leads.
function pickupsChoice(draft: FilmDraft, round: number): EventChoiceTemplate {
  return {
    id: 'pickups',
    label: 'Pickups',
    description: 'A short, targeted round of additional filming to shore up the weakest material - your own shoot-day rate, recalling the leads, and cutting the new footage in, for a wider range of possible improvement.',
    costRange: reshootCostRange(draft, PICKUPS, round),
    qualityRange: [1, 15],
    buzzRange: [1, 4],
    delayDaysRange: [10, 20],
    skillSensitive: true,
  };
}

// The biggest possible swing - highest potential upside, but also the only
// choice with real downside risk (a troubled reshoot can make things worse),
// so affording it is never automatically correct. A major reworking recalls the
// director and the whole principal cast over many more filming days.
function majorReshootsChoice(draft: FilmDraft, round: number): EventChoiceTemplate {
  return {
    id: 'major-reshoots',
    label: 'Major Reshoots',
    description: 'A significant reworking of the film - many filming days at your own shoot-day rate, recalling the director and full principal cast, and re-cutting and re-finishing around all of it, for the widest range of outcomes, including the risk of making things worse.',
    costRange: reshootCostRange(draft, MAJOR_RESHOOTS, round),
    qualityRange: [-6, 22],
    buzzRange: [-3, 7],
    delayDaysRange: [25, 45],
    skillSensitive: true,
  };
}

/**
 * The opening line for the screening, given which round it is and how the last
 * recut (if any) moved quality. Round 0 is the first screening; later rounds
 * report whether the recut just seen tested better/worse/about the same.
 */
function screeningIntro(round: number, lastQualityDelta: number | null): string {
  if (round === 0) return 'The first test screening is in.';
  const dir =
    lastQualityDelta === null || Math.abs(lastQualityDelta) <= 1
      ? 'about the same as before'
      : lastQualityDelta > 0
        ? 'better than before'
        : 'worse than before';
  return `The recut is back from the editing bay - audiences responded ${dir}.`;
}

/**
 * Builds the test-screening PendingEventChoice for a film. `round` is how many
 * editing rounds have already happened (0 for the first screening), which is
 * exactly draft.postProductionEvents.length at the call site. `draft` must
 * already have script/genre/productionChoices/photography set (guaranteed by
 * the time FINISH_PHOTOGRAPHY has run - the only path that ever sets
 * postProductionScreeningReadyDay in the first place).
 *
 * The qualitative situation line reuses computeQualityBreakdown/
 * pickDepartmentBlurb exactly as engine/releaseFilm.ts does for a real
 * review - fed DEFAULT_POST_PRODUCTION_CHOICES (postProductionChoices
 * haven't been finalized yet; the screening previews against the same
 * shared provisional baseline the Post-Production UI itself defaults to)
 * and the film's accumulated postProductionEvents so far, so a follow-up
 * screening reads the current recut, not the original cut.
 *
 * From the second screening on the player can also revert to the original cut
 * (REVERT_TO_ORIGINAL_CHOICE) - "edit more, keep this, or throw it all away."
 */
export function generateTestScreeningPendingChoice(draft: FilmDraft, rng: RandomFn, round = 0): PendingEventChoice {
  const photography = draft.photography!;
  const shootingRatio = photography.recommendedDays > 0 ? photography.daysElapsed / photography.recommendedDays : 1;
  // Includes every editing round resolved so far, so a follow-up screening
  // reads the current recut rather than the untouched original.
  const quality = computeQualityBreakdown(
    draft.script!,
    draft.talent,
    draft.genre!,
    draft.productionChoices!,
    DEFAULT_POST_PRODUCTION_CHOICES,
    combineProductionEvents(photography.events, draft.postProductionEvents),
    shootingRatio,
    0, // postProductionScoreBonus (default)
    undefined, // executionProfile (derived from events)
    undefined, // stuntTeamSkill (→ fallback)
    true, // player film: person-driven DP/Composer/Editor craft, matching the eventual release
  );

  const lastQualityDelta = round > 0 && draft.postProductionEvents.length > 0
    ? draft.postProductionEvents[draft.postProductionEvents.length - 1].qualityDelta
    : null;
  const departmentBlurb = pickDepartmentBlurb(quality, draft.genre!, rng);
  const intro = screeningIntro(round, lastQualityDelta);
  const situation = departmentBlurb
    ? `${intro} ${departmentBlurb}`
    : `${intro} Reactions were mixed, with nothing standing out clearly either way.`;

  const weakest = Math.min(quality.scriptScore, quality.directionScore, quality.actingScore, quality.productionScore, quality.postProductionScore);
  const polarity: 'positive' | 'negative' = weakest < NEGATIVE_POLARITY_THRESHOLD ? 'negative' : 'positive';
  const severity: EventSeverity = weakest < NEGATIVE_POLARITY_THRESHOLD ? 'high' : weakest < MEDIUM_SEVERITY_FLOOR ? 'medium' : 'low';

  // First screening: accept, or one of the three editing rounds. Every later
  // screening also offers reverting to the original cut.
  const templates: EventChoiceTemplate[] = round === 0
    ? [acceptCutChoice(round), reEditChoice(draft, round), pickupsChoice(draft, round), majorReshootsChoice(draft, round)]
    : [acceptCutChoice(round), reEditChoice(draft, round), pickupsChoice(draft, round), majorReshootsChoice(draft, round), REVERT_TO_ORIGINAL_CHOICE];

  const editor = findAssignedPerson(draft.talent, 'Editor');
  const editorSkill = talentSkillScore(editor, 'Editor', draft.script ?? null);
  const choices = prepareChoicesForInvolvedTalent(
    templates,
    editor?.identity.name ?? 'your editor',
    editorSkill,
  );

  return {
    templateId: 'test-screening',
    situation,
    polarity,
    severity,
    choices,
    involvedTalentId: editor?.id,
    involvedTalentName: editor?.identity.name,
    involvedRole: editor ? 'Editor' : undefined,
  };
}
