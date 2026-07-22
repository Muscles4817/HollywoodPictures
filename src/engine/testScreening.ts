// Post-Production Redesign, Phase B
// (docs/DESIGN_REVIEW_post_production_redesign.md section 2). Builds the
// one PendingEventChoice a film gets when its
// FilmDraft.postProductionScreeningReadyDay is reached - reusing the exact
// same PendingEventChoice/EventChoiceTemplate shape and roll math
// (engine/production.ts:resolveEventChoice) on-set events already use, so
// state/studioReducer.ts:RESOLVE_TEST_SCREENING_CHOICE and
// components/common/OnSetDecisionCard.tsx need no test-screening-specific
// branching at all.
import type { EventChoiceTemplate, EventSeverity, FilmDraft, PendingEventChoice } from '../types';
import { computeQualityBreakdown, combineProductionEvents } from './scoring';
import { pickDepartmentBlurb } from './reviews';
import { DEFAULT_POST_PRODUCTION_CHOICES } from '../data/postProduction';
import { findAssignedPerson } from '../data/helpers';
import { talentSkillScore, prepareChoicesForInvolvedTalent } from './production';
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

// A focused editorial pass chasing the audience's specific notes - the
// cheap, fast, reliable option. Narrow ranges (little downside, modest
// upside) so it's a safe default rather than a trap.
const RE_EDIT_CHOICE: EventChoiceTemplate = {
  id: 're-edit',
  label: 'Re-edit',
  description: "A focused editorial pass chasing the test audience's notes - low cost, short delay, a reliable if modest improvement.",
  costRange: [150_000, 350_000],
  qualityRange: [3, 9],
  buzzRange: [0, 1],
  delayDaysRange: [3, 8],
  skillSensitive: true,
};

// A short, targeted round of additional filming - real money and real time,
// wider outcome range than Re-edit since it's genuinely new footage, not
// just a smarter arrangement of what already exists.
const PICKUPS_CHOICE: EventChoiceTemplate = {
  id: 'pickups',
  label: 'Pickups',
  description: 'A short, targeted round of additional filming to shore up the weakest material - real cost and delay, for a wider range of possible improvement.',
  costRange: [600_000, 1_200_000],
  qualityRange: [1, 15],
  buzzRange: [1, 4],
  delayDaysRange: [10, 20],
  skillSensitive: true,
};

// The biggest possible swing - highest potential upside, but also the only
// choice with real downside risk (a troubled reshoot can make things worse,
// not just fail to help), so affording it is never automatically correct.
const MAJOR_RESHOOTS_CHOICE: EventChoiceTemplate = {
  id: 'major-reshoots',
  label: 'Major Reshoots',
  description: 'A significant reworking of the film - the highest possible cost and the longest delay, for the widest range of outcomes, including the risk of making things worse.',
  costRange: [2_000_000, 4_500_000],
  qualityRange: [-6, 22],
  buzzRange: [-3, 7],
  delayDaysRange: [25, 45],
  skillSensitive: true,
};

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
    ? [acceptCutChoice(round), RE_EDIT_CHOICE, PICKUPS_CHOICE, MAJOR_RESHOOTS_CHOICE]
    : [acceptCutChoice(round), RE_EDIT_CHOICE, PICKUPS_CHOICE, MAJOR_RESHOOTS_CHOICE, REVERT_TO_ORIGINAL_CHOICE];

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
