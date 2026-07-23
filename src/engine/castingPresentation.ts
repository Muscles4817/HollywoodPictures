// Casting Redesign (docs/DESIGN_REVIEW_casting_redesign.md section 7) -
// "explain why applicants appear, not raw numbers." Mirrors
// engine/scriptPresentation.ts's own established pattern
// (describeSettingImplication/describeCharacterDemands) of turning a
// numeric profile into a short, capped sentence rather than a stat block -
// same job, different profile (ActorAppealFactors instead of SettingProfile/
// CharacterTraitProfile).
import type { ActorAppealFactors, ActorScheduleAssessment, OfferRejectionReason } from './castingAppeal';
import type { DirectorAppealFactors, DirectorOfferRejectionReason } from './directorAppeal';
import { actorArchetype, directorTouch, directorActorPairing } from './actingModel';
import type { Person } from '../types';

// --- Acting model reads (docs/DESIGN_REVIEW_acting_model.md §10) -----------
// Qualitative casting reads for the floor+headroom craft model - never raw
// floor/headroom/handsOn numbers, per the house style (CLAUDE.md).

/**
 * How an actor's craft reads on a casting card - a dependable pro who holds up
 * in any hands vs. a director-dependent talent who needs the right filmmaker.
 * Derived from the archetype (engine/actingModel.ts), so it stays in step with
 * how the performance is actually computed.
 */
export function describeActorCraft(person: Person): string {
  switch (actorArchetype(person)) {
    case 'dependable':
      return 'A dependable presence - steady in almost any hands.';
    case 'director-dependent':
      return 'Raw, director-dependent talent - soars with the right filmmaker, adrift without.';
    case 'all-rounder':
      return 'A capable all-rounder - a good director still lifts them.';
  }
}

/** How a director's approach to performances reads on a card - a hands-on performance-driver vs. one who gives actors room. */
export function describeDirectorTouch(person: Person): string {
  switch (directorTouch(person)) {
    case 'hands-on':
      return 'A hands-on performance-driver - shapes each turn, for better or worse.';
    case 'hands-off':
      return 'Gives actors room - lets a performance find its own level.';
    case 'balanced':
      return 'A measured hand with actors - guides without forcing.';
  }
}

/** A compatibility hint for a specific director<->lead pairing - great match / risky match - the way casting compatibility is already surfaced. */
export function describeDirectorActorPairing(director: Person, actor: Person): string {
  switch (directorActorPairing(director, actor)) {
    case 'strong':
      return 'A strong match with the director - the kind of pairing that pulls out a career-best.';
    case 'risky':
      return "A risky match - the director's instincts pull against this actor's; a forced read could misfire.";
    case 'neutral':
      return 'A workable pairing with the director - no natural spark, no clear friction.';
  }
}

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

/** A compact, scannable reason chip for a candidate card - a positive draw, a soft warning, or a hard blocker. */
export interface CandidateSignal {
  label: string;
  tone: 'positive' | 'warning' | 'blocked';
}

// Short chip labels for the positive appeal factors - the badge form of
// describeApplicantInterest's sentence. attachmentMomentum names the actual
// attached director when there is one (the same personalization the sentence
// does), so "who they're drawn to" is concrete, not "someone."
const STRENGTH_LABELS: Record<keyof ActorAppealFactors, string> = {
  suitability: 'Great fit',
  salaryFit: 'Happy with the pay',
  attachmentMomentum: 'Likes the lineup',
  brandFit: 'Likes your studio',
  prestigeFit: 'Likes your studio',
};

/**
 * The candidate's standout *strengths*, as compact chips - "why this is a good
 * pick," surfaced before the player commits rather than buried in a blended
 * score (docs/DESIGN_REVIEW_casting_ux.md: the sim already knows why someone is
 * a strong candidate; expose it). Reads the exact same ActorAppealFactors the
 * acceptance math uses, keeps only notable ones (the APPEAL_NOTABLE bar
 * describeApplicantInterest already uses), strongest first, capped so the card
 * stays scannable. brandFit/prestigeFit are complementary halves of one
 * reputation read, so they collapse into a single "Likes your studio" chip.
 */
export function candidateStrengthSignals(factors: ActorAppealFactors, directorName?: string, max = 3): CandidateSignal[] {
  const reputationFit = factors.brandFit + factors.prestigeFit;
  const entries = [
    { value: factors.suitability, label: STRENGTH_LABELS.suitability },
    { value: factors.salaryFit, label: STRENGTH_LABELS.salaryFit },
    { value: factors.attachmentMomentum, label: directorName ? `Keen to work with ${directorName}` : STRENGTH_LABELS.attachmentMomentum },
    { value: reputationFit, label: STRENGTH_LABELS.brandFit },
  ];
  return entries
    .filter((e) => e.value >= APPEAL_NOTABLE)
    .sort((a, b) => b.value - a.value)
    .slice(0, max)
    .map((e) => ({ label: e.label, tone: 'positive' as const }));
}

// Director-side strength chips - the same idea as candidateStrengthSignals over
// DirectorAppealFactors. scriptFit is "how good the material reads to them," the
// director's own version of an actor's role fit.
const DIRECTOR_STRENGTH_LABELS: Record<keyof DirectorAppealFactors, string> = {
  scriptFit: 'Loves the script',
  salaryFit: 'Happy with the pay',
  brandFit: 'Likes your studio',
  prestigeFit: 'Likes your studio',
};

/** A director candidate's standout strengths as chips (docs/DESIGN_REVIEW_casting_ux.md) - the DirectorAppealFactors counterpart of candidateStrengthSignals. */
export function directorStrengthSignals(factors: DirectorAppealFactors, max = 3): CandidateSignal[] {
  const reputationFit = factors.brandFit + factors.prestigeFit;
  const entries = [
    { value: factors.scriptFit, label: DIRECTOR_STRENGTH_LABELS.scriptFit },
    { value: factors.salaryFit, label: DIRECTOR_STRENGTH_LABELS.salaryFit },
    { value: reputationFit, label: DIRECTOR_STRENGTH_LABELS.brandFit },
  ];
  return entries
    .filter((e) => e.value >= APPEAL_NOTABLE)
    .sort((a, b) => b.value - a.value)
    .slice(0, max)
    .map((e) => ({ label: e.label, tone: 'positive' as const }));
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
