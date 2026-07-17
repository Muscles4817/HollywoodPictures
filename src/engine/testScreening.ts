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

const RELEASE_AS_IS_CHOICE: EventChoiceTemplate = {
  id: 'release-as-is',
  label: 'Release As-Is',
  description: 'Accept the current cut and move forward - no further cost, delay, or quality change.',
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
 * Builds the test-screening PendingEventChoice for a film whose
 * postProductionScreeningReadyDay has been reached. `draft` must already
 * have script/genre/productionChoices/photography set (guaranteed by the
 * time FINISH_PHOTOGRAPHY has run - the only path that ever sets
 * postProductionScreeningReadyDay in the first place).
 *
 * The qualitative situation line reuses computeQualityBreakdown/
 * pickDepartmentBlurb exactly as engine/releaseFilm.ts does for a real
 * review - fed DEFAULT_POST_PRODUCTION_CHOICES (postProductionChoices
 * haven't been finalized yet; the screening previews against the same
 * shared provisional baseline the Post-Production UI itself defaults to)
 * so this is a genuine "how does the film read right now" reading, not a
 * parallel scoring system.
 */
export function generateTestScreeningPendingChoice(draft: FilmDraft, rng: RandomFn): PendingEventChoice {
  const photography = draft.photography!;
  const shootingRatio = photography.recommendedDays > 0 ? photography.daysElapsed / photography.recommendedDays : 1;
  // draft.postProductionEvents is always empty at this point (this is what
  // generates the one screening a film ever gets, before it's resolved) -
  // combined anyway for consistency with every other quality read.
  const quality = computeQualityBreakdown(
    draft.script!,
    draft.talent,
    draft.genre!,
    draft.productionChoices!,
    DEFAULT_POST_PRODUCTION_CHOICES,
    combineProductionEvents(photography.events, draft.postProductionEvents),
    shootingRatio,
  );

  const departmentBlurb = pickDepartmentBlurb(quality, draft.genre!, rng);
  const situation = departmentBlurb
    ? `The first test screening is in. ${departmentBlurb}`
    : 'The first test screening is in. Reactions were mixed, with nothing standing out clearly either way.';

  const weakest = Math.min(quality.scriptScore, quality.directionScore, quality.actingScore, quality.productionScore, quality.postProductionScore);
  const polarity: 'positive' | 'negative' = weakest < NEGATIVE_POLARITY_THRESHOLD ? 'negative' : 'positive';
  const severity: EventSeverity = weakest < NEGATIVE_POLARITY_THRESHOLD ? 'high' : weakest < MEDIUM_SEVERITY_FLOOR ? 'medium' : 'low';

  const editor = findAssignedPerson(draft.talent, 'Editor');
  const editorSkill = talentSkillScore(editor, 'Editor', draft.script ?? null);
  const choices = prepareChoicesForInvolvedTalent(
    [RELEASE_AS_IS_CHOICE, RE_EDIT_CHOICE, PICKUPS_CHOICE, MAJOR_RESHOOTS_CHOICE],
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
