// Casting Redesign (docs/DESIGN_REVIEW_casting_redesign.md section 7) -
// "explain why applicants appear, not raw numbers." Mirrors
// engine/scriptPresentation.ts's own established pattern
// (describeSettingImplication/describeCharacterDemands) of turning a
// numeric profile into a short, capped sentence rather than a stat block -
// same job, different profile (ActorAppealFactors instead of SettingProfile/
// CharacterTraitProfile).
import type { ActorAppealFactors, ActorScheduleAssessment, OfferRejectionReason } from './castingAppeal';
import type { DirectorAppealFactors, DirectorOfferRejectionReason } from './directorAppeal';

const APPEAL_NOTABLE = 60;
const APPEAL_MAX_NOTES = 2;

const POSITIVE_LABELS: Record<keyof ActorAppealFactors, string> = {
  suitability: 'drawn to the role itself',
  brandFit: "excited by the studio's commercial reach",
  prestigeFit: "drawn to the studio's prestige",
  salaryFit: 'happy with the money on offer',
  attachmentMomentum: 'drawn in by who else is already attached',
};

/**
 * "Why did this person apply" - the one or two highest-scoring
 * ActorAppealFactors, named in plain English rather than shown as a
 * five-number breakdown (Casting Redesign Additional Notes, points 3/4 -
 * "the player should feel the world is reacting to their studio rather
 * than rolling dice"). Falls back to a neutral line rather than an empty
 * string when nothing stands out - every applicant reads as having *some*
 * reason to be there. `directorName` (Casting Appeal Rework) names the
 * actual attached director in place of the generic attachmentMomentum
 * line, when that's the standout factor - a player should be told *who*
 * they're drawn to, not just that "someone" is already attached.
 */
export function describeApplicantInterest(factors: ActorAppealFactors, directorName?: string): string {
  const entries = (Object.keys(POSITIVE_LABELS) as Array<keyof ActorAppealFactors>).map((key) => ({
    key,
    value: factors[key],
  }));
  const top = entries
    .filter((e) => e.value >= APPEAL_NOTABLE)
    .sort((a, b) => b.value - a.value)
    .slice(0, APPEAL_MAX_NOTES);
  if (top.length === 0) return 'Applying on spec - nothing about this pitch stands out to them yet.';
  const sentence = top
    .map((e) => (e.key === 'attachmentMomentum' && directorName ? `drawn to working with ${directorName}` : POSITIVE_LABELS[e.key]))
    .join(' and ');
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}

const REJECTION_LABELS: Record<OfferRejectionReason, string> = {
  suitability: "doesn't feel right for the role",
  'brand-prestige-mismatch': "isn't where they want their name attached right now",
  salary: 'wants more money than this offer',
  schedule: "can't clear their existing commitments in time",
};

/** "Why did they say no" - engine/castingAppeal.ts:OfferRejectionReason turned into a sentence a producer would actually say, per section 7's "rejected offers should explain the primary reason." */
export function describeOfferRejection(reason: OfferRejectionReason): string {
  return `They passed - ${REJECTION_LABELS[reason]}.`;
}

/**
 * A more specific schedule rejection than describeOfferRejection('schedule')
 * can give on its own - the full ActorScheduleAssessment (with delayDays)
 * distinguishes "could start later" from "not on any timeline this
 * production could realistically wait for," which the bare
 * OfferRejectionReason enum can't. Falls back to the generic line for
 * 'unavailable', where there's nothing more specific to say.
 */
export function describeScheduleRejection(schedule: ActorScheduleAssessment): string {
  if (schedule.status === 'requires-delay') {
    return `They passed - could start in ${schedule.delayDays} day${schedule.delayDays === 1 ? '' : 's'}, once their current commitment wraps.`;
  }
  return describeOfferRejection('schedule');
}

const DIRECTOR_POSITIVE_LABELS: Record<keyof DirectorAppealFactors, string> = {
  scriptFit: 'genuinely excited by this script',
  brandFit: "drawn to the studio's commercial reach",
  prestigeFit: "drawn to the studio's prestige",
  salaryFit: 'happy with the money on offer',
};

/** describeApplicantInterest's director-side counterpart - same "one or two standout factors, in plain English" shape, over DirectorAppealFactors instead. */
export function describeDirectorInterest(factors: DirectorAppealFactors): string {
  const entries = (Object.keys(DIRECTOR_POSITIVE_LABELS) as Array<keyof DirectorAppealFactors>).map((key) => ({
    key,
    value: factors[key],
  }));
  const top = entries
    .filter((e) => e.value >= APPEAL_NOTABLE)
    .sort((a, b) => b.value - a.value)
    .slice(0, APPEAL_MAX_NOTES);
  if (top.length === 0) return 'Considering it on spec - nothing about this pitch stands out to them yet.';
  const sentence = top.map((e) => DIRECTOR_POSITIVE_LABELS[e.key]).join(' and ');
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}

const DIRECTOR_REJECTION_LABELS: Record<DirectorOfferRejectionReason, string> = {
  'prestige-gate': "isn't the kind of studio they attach their name to right now",
  'script-fit': "isn't excited enough by this script",
  'brand-prestige-mismatch': "isn't where they want their name attached right now",
  salary: 'wants more money than this offer',
  schedule: "can't clear their existing commitments in time",
};

/** describeOfferRejection's director-side counterpart, including the prestige-gate reason actors never have. */
export function describeDirectorRejection(reason: DirectorOfferRejectionReason): string {
  return `They passed - ${DIRECTOR_REJECTION_LABELS[reason]}.`;
}
