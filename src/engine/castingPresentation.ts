// Casting Redesign (docs/DESIGN_REVIEW_casting_redesign.md section 7) -
// "explain why applicants appear, not raw numbers." Mirrors
// engine/scriptPresentation.ts's own established pattern
// (describeSettingImplication/describeCharacterDemands) of turning a
// numeric profile into a short, capped sentence rather than a stat block -
// same job, different profile (ActorAppealFactors instead of SettingProfile/
// CharacterTraitProfile).
import type { ActorAppealFactors, ActorScheduleAssessment, OfferRejectionReason } from './castingAppeal';
import type { DirectorAppealFactors, DirectorOfferRejectionReason } from './directorAppeal';
import type { AcceptanceOdds } from './castingEstimate';
import type { FitConfidence } from './talentCardPresentation';
import { actorArchetype, directorTouch, directorActorPairing, signatureGift, fameCraftContrast, type ActorArchetype, type FameCraftContrast } from './actingModel';
import type { RelationshipStanding } from './relationships';
import type { CastAffinity } from './pairHistory';
import type { ActingStyle, Person, ProductionRole } from '../types';

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

/**
 * The craft archetype as a compact chip label - the ALWAYS-shown categorical
 * read of an actor's performance ceiling (how much a director matters to them),
 * distinct from describeActorCraft's evocative sentence. The card leads with an
 * actor's signature gift when they have one, which meant the archetype - the
 * single biggest thing that makes two performers unequal - was invisible for the
 * majority of actors (spiky by construction, so they usually HAVE a gift). This
 * label rides alongside the gift line so "director-dependent vs dependable" is
 * never hidden; describeActorCraft supplies the full "what it means" on hover.
 */
export const ACTOR_ARCHETYPE_TAGS: Record<ActorArchetype, string> = {
  dependable: 'Consistent performer',
  'director-dependent': 'Director-dependent',
  'all-rounder': 'All-rounder',
};

/** The actor's craft archetype as a short chip label (see ACTOR_ARCHETYPE_TAGS). */
export function actorArchetypeTag(person: Person): string {
  return ACTOR_ARCHETYPE_TAGS[actorArchetype(person)];
}

// A stable index into a phrasing bank from a person id - the same person always
// reads the same line (variety ACROSS the roster, consistency PER person),
// without consuming the rng stream. Two dependable pros shouldn't narrate
// identically just because they share an archetype; two DIFFERENT gifts already
// diverge, and this spreads phrasing within a single gift on top of that.
function stablePick<T>(id: string, options: T[]): T {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return options[(h >>> 0) % options.length];
}

// Two phrasing tiers per gift axis (a towering signature vs. a real-but-lesser
// strength), two phrasings each - so the lead line reads as authored character,
// not a filled-in template. Gender-neutral throughout (the roster is mixed and
// identity.gender is optional). Kept here in presentation, per house style:
// the engine (signatureGift) returns the category, the copy lives here.
const GIFT_PHRASES: Record<keyof ActingStyle, { defining: string[]; notable: string[] }> = {
  characterTransformation: {
    defining: [
      "A total chameleon - disappears so completely into a part you forget it's them.",
      'One of the great transformers, unrecognisable from one film to the next.',
    ],
    notable: ['A transformative actor who genuinely reshapes for a role.', 'Comfortable vanishing into a character.'],
  },
  emotionalPerformance: {
    defining: [
      'An emotional powerhouse who can crack a scene wide open.',
      'Devastating in the emotional beats - the rare actor who moves an audience to tears.',
    ],
    notable: ['A feeling, emotionally present performer.', "Reaches an emotional register a lot of actors can't."],
  },
  charisma: {
    defining: [
      'Pure movie-star charisma - the camera simply loves them.',
      "A magnetic presence it's impossible to look away from.",
    ],
    notable: ['An easy, likeable screen presence.', 'Naturally charismatic on camera.'],
  },
  comedy: {
    defining: [
      'A gifted comic with impeccable, hard-to-teach timing.',
      'Reliably, genuinely funny - lands jokes other actors fumble.',
    ],
    notable: ['A capable, well-judged comic touch.', 'Can carry the lighter, funnier moments.'],
  },
  physicalPerformance: {
    defining: [
      'A fearless physical performer who does the demanding, bodily work.',
      'Built for the physical roles - athletic, committed, does the hard stuff on camera.',
    ],
    notable: ['A physically capable, athletic performer.', 'Comfortable with the physical demands of a role.'],
  },
};

/**
 * An actor's signature gift as a short, evocative line - "what they're uniquely
 * good at," the lead read on a casting card (the thing that makes them a person
 * rather than a role-fit score). null when no single strength stands out, in
 * which case the card simply leads with their craft archetype instead
 * (describeActorCraft). Reads signatureGift (engine/actingModel.ts), so the copy
 * never disagrees with what the actor can actually do.
 */
export function describeSignatureGift(person: Person): string | null {
  const gift = signatureGift(person);
  if (!gift) return null;
  return stablePick(`${person.id}:gift`, GIFT_PHRASES[gift.axis][gift.tier]);
}

const CONTRAST_PHRASES: Record<FameCraftContrast, string> = {
  coaster: "A big name whose craft has never quite matched the billing - you're buying the marquee, not the performance.",
  undiscovered: 'Barely known, but the talent is the real thing - cheap now, if you can pull the performance out of them.',
  'star-and-craft': 'A genuine star - the fame and the craft are both real.',
};

/**
 * The fame-vs-craft trade an actor represents, in a sentence - the "why hire
 * this one over that one" read the sim already knows (a famous coaster vs. an
 * undiscovered talent vs. a genuine star). null when fame and craft roughly
 * agree, so the line appears only when there's a real trade to point out.
 */
export function describeFameCraftContrast(person: Person): string | null {
  const contrast = fameCraftContrast(person);
  return contrast ? CONTRAST_PHRASES[contrast] : null;
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
// DirectorAppealFactors. scriptFit is their personal *appetite* for this film
// (computeDirectorAppetite: taste, craft fit, production method, and how much
// they care about the material) - the director's own version of an actor's role
// fit, so the "Loves the script" chip now reads true rather than aspirational.
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
  relationship: "won't work with your studio again after how things went last time",
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

// --- Negotiation (docs/DESIGN_REVIEW_casting_redesign.md section 13, Phase E) -
// A counter-offer's "why they're holding out," in a producer's voice - the
// qualitative half of engine/castingNegotiation.ts's NegotiationOutcome. The
// counter's actual figure is a game-facing salary (shown on cards and sliders
// throughout), so the UI renders that number; this module only supplies the
// human reason for it, never an internal stat. Derived from the same
// reputation/personality fields the asking price itself reads, so the copy and
// the number it explains never drift.

/** Why this actor is holding their price - a hot streak, an established name, or a hard-nosed sense of their own worth. One clause, no raw numbers. */
export function describeCounterReason(person: Person): string {
  const { fame, currentHeat } = person.reputation;
  const { ego, ambition } = person.personality;
  if (currentHeat >= 62) return 'They know they’re having a moment, and they’re pricing it accordingly.';
  if (fame >= 62) return 'An established name rarely moves far off their quote.';
  if ((ego + ambition) / 2 >= 62) return 'They have a firm sense of exactly what they’re worth.';
  return 'They’re open to the right number - just not this one yet.';
}

/**
 * A counter-offer as a producer would relay it - "interested, but they want
 * `formattedCounter`" plus the human reason. Takes the counter already
 * formatted by the UI's own Money formatter rather than formatting here, so
 * money presentation stays in one place (the Money component / formatMoney).
 */
export function describeCounterOffer(person: Person, formattedCounter: string): string {
  return `Interested - but they’re holding out for ${formattedCounter}. ${describeCounterReason(person)}`;
}

// --- Open Casting forecast (Phase 5, design brief point 10) ------------------
// A pre-open read on a casting call, in a producer's voice - volume, field
// strength, and how much to trust the estimate. Reads the OpenCastingForecast
// engine/castingCalls.ts derives; the numbers here are forecast ranges, not
// stat values.

const FORECAST_QUALITY_LABEL: Record<'thin' | 'moderate' | 'deep', string> = {
  deep: 'a deep field of genuine fits for this part',
  moderate: 'a fair few who could suit this part',
  thin: 'a thin field - few obvious fits',
};
const FORECAST_CONFIDENCE_LABEL: Record<'low' | 'medium' | 'high', string> = {
  high: 'Your casting director is confident in this read.',
  medium: 'A rough read - a casting director would firm it up.',
  low: 'Only a rough guess without a casting director to scout.',
};

/** The pre-open forecast for a casting call as two short lines: expected volume + field, then how much to trust it. `forecast` is engine/castingCalls.ts:OpenCastingForecast. */
export function describeOpenCastingForecast(forecast: { weeklyLow: number; weeklyHigh: number; quality: 'thin' | 'moderate' | 'deep'; confidence: 'low' | 'medium' | 'high' }): { estimate: string; confidence: string } {
  const perWeek = forecast.weeklyLow === forecast.weeklyHigh ? `${forecast.weeklyHigh}` : `${forecast.weeklyLow}–${forecast.weeklyHigh}`;
  return {
    estimate: `Expect about ${perWeek} applicant${forecast.weeklyHigh === 1 ? '' : 's'} a week, from ${FORECAST_QUALITY_LABEL[forecast.quality]}.`,
    confidence: FORECAST_CONFIDENCE_LABEL[forecast.confidence],
  };
}

// --- Pre-offer estimate (Phase 2, uncertainty) - reading the deal before you
// make it. The asking-price band is hedged by how readable the actor is (the
// same FitConfidence the fit read uses); the odds are a qualitative ladder. Both
// take the money already formatted by the UI, per the house money-formatting split.

const ASKING_HEDGE: Record<FitConfidence, (range: string) => string> = {
  high: (range) => `Should want around ${range}.`,
  medium: (range) => `Likely wants somewhere around ${range}.`,
  low: (range) => `Hard to call - maybe ${range}, but that's a guess.`,
};

/** The estimated asking-price band as a hedged sentence, e.g. "Likely wants somewhere around £2M–£4M." - `formattedRange` is built by the UI's Money formatter. */
export function describeAskingEstimate(formattedRange: string, confidence: FitConfidence): string {
  return ASKING_HEDGE[confidence](formattedRange);
}

const ODDS_LABEL: Record<AcceptanceOdds, string> = {
  likely: 'Your offer should land them',
  even: 'Could go either way at this offer',
  stretch: 'A stretch - they’ll likely want more',
  'long-shot': 'A long shot at this offer',
  no: 'Out of reach - their schedule or history with you rules it out',
};

const ODDS_TONE: Record<AcceptanceOdds, CandidateSignal['tone']> = {
  likely: 'positive',
  even: 'warning',
  stretch: 'warning',
  'long-shot': 'blocked',
  no: 'blocked',
};

/** How a given offer would land, as a short phrase and a tone - the odds half of the pre-offer read. */
export function describeAcceptanceOdds(odds: AcceptanceOdds): CandidateSignal {
  return { label: ODDS_LABEL[odds], tone: ODDS_TONE[odds] };
}

/**
 * How a closed deal reads when it landed for less than the actor's usual quote -
 * the "sometimes you get lucky" payoff surfaced back to the player. `belowQuote`
 * is decided by the caller (agreed fee < the actor's typicalSalary); this just
 * picks the line.
 */
export function describeDealClosed(belowQuote: boolean): string {
  return belowQuote
    ? 'Deal - and you landed them for under their usual quote.'
    : 'Deal - terms agreed.';
}

// --- Screen test report (casting QOL) ---------------------------------------
// The payoff of a completed audition, in a producer's voice - the moment you
// "saw them read for the part". The mechanical result (a now-confident, fully-
// revealed fit read) already lands on the card; this is the diegetic beat on top
// of it, graded by how the read actually went (the true character fit an
// audition reveals) so a screen test feels like an event, not a silent stat
// nudge. Deterministic: the variant is picked by a stable hash of who read for
// what, so the same test always reports the same way (no RNG, house style).
type AuditionTier = 'excellent' | 'strong' | 'good' | 'shaky' | 'poor';

function auditionTier(fitScore: number): AuditionTier {
  if (fitScore >= 90) return 'excellent';
  if (fitScore >= 75) return 'strong';
  if (fitScore >= 60) return 'good';
  if (fitScore >= 40) return 'shaky';
  return 'poor';
}

// {name} / {character} are filled from the specific read. Two variants per tier
// so a slate of screen tests doesn't read as copy-paste.
// Roughly ten variants per grade, and deliberately varied in ANGLE as well as
// wording - the crew's reaction, the director's, the dailies/tape, the chemistry
// read, a comparative note, a specific craft beat - so a slate of screen tests
// never reads as one sentence with the names swapped. Every line references
// {name} and {character} (interpolated at render), so the pick is always
// grounded whichever one the stable hash lands on.
const AUDITION_REPORT: Record<AuditionTier, string[]> = {
  excellent: [
    'The read was electric — {name} simply became {character}. You could shoot it tomorrow.',
    'Goosebumps in the room. {name} found things in {character} that weren’t even on the page.',
    'The crew stopped what they were doing to watch. {name} is {character} — there’s no daylight between them.',
    'A masterclass. {name} played {character} three different ways and every one of them worked.',
    'The director sat back and just grinned. That’s the whole movie, right there in {name}’s read of {character}.',
    'You’ll be cutting this reel into the awards campaign. {name} owns {character} completely.',
    'Effortless. {name} made {character} look like the only role they were ever born to play.',
    'The tape doesn’t do it justice, and the tape is extraordinary. {name} is your {character}.',
    'Silence, then genuine applause. {name} took {character} somewhere nobody in the room expected.',
    'Stop the search. {name} walked in and settled {character} in a single take.',
  ],
  strong: [
    '{name} gave an assured, controlled read — a real {character} takes shape.',
    'A confident screen test. {name} clearly understands {character} and can carry the part.',
    '{name} came in prepared and it showed — {character} is in safe hands.',
    'No notes to speak of. {name} has a firm, convincing grip on {character}.',
    'The chemistry read clicked — {name} slots into {character} without a seam.',
    '{name} nailed the big beat and made the quiet ones land too. A strong {character}.',
    'Polished and specific. {name} knows exactly who {character} is.',
    'A pro’s read — {name} won’t give you a bad take as {character}.',
    '{name} found the spine of {character} fast and held it all the way through.',
    'Solid, watchable, true. {name} makes a persuasive {character}.',
  ],
  good: [
    'A solid, professional read from {name} — they can play {character}, with a little shaping.',
    '{name} handled {character} capably. Not a revelation, but dependable.',
    '{name} gets the broad strokes of {character}; the finer shading will come with direction.',
    'Competent and coachable — {name} would grow into {character} on set.',
    '{name} is a sound choice for {character}: no fireworks, and no worries either.',
    'The read was fine — {name} plays {character} straight down the middle.',
    '{name} has the range for {character}, if not yet the nuance.',
    'Reliable work. {name} won’t elevate {character}, but won’t let the part down.',
    '{name} found {character}’s surface cleanly; the depth is a directing job.',
    'A safe pair of hands — {name} covers {character} without surprises.',
  ],
  shaky: [
    'An uneven read — flashes of {character} from {name}, but it never quite settled.',
    '{name} struggled to find {character}. Some moments landed; plenty didn’t.',
    'The pieces were there but never came together — {name} kept reaching for {character}.',
    '{name} pushed hard at {character}, and it read as effort rather than truth.',
    'A frustrating test — one good take of {character} from {name}, buried under several that missed.',
    '{name} and {character} never met in the middle. You’d be directing uphill.',
    'The instincts are off — {name} played {character} against the grain of the scene.',
    'It flickered to life once, then went flat. {name} isn’t comfortable as {character} yet.',
    '{name} seemed to be guessing at {character} — watchable, but not convincing.',
    'Half a performance. {name} has the look for {character}, not yet the read.',
  ],
  poor: [
    'The read fell flat. {name} isn’t the {character} this film needs.',
    'It didn’t come together — {name} and {character} pull in different directions.',
    'Painful to sit through. {name} has no handle on {character} at all.',
    'Wrong from the first line — {name} fights {character} the whole way.',
    'The room went quiet for the wrong reasons. {name} can’t find {character}.',
    'A misfire. Nothing about {name}’s read says {character}.',
    '{name} was lost — {character} never showed up on the tape.',
    'No chemistry, no instinct, no {character}. This one’s a pass on {name}.',
    'Every choice {name} made took the read further from {character}.',
    'It simply isn’t there. {name} and {character} are a mismatch.',
  ],
};

function stableVariant(key: string, count: number): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(hash) % count;
}

/** The producer's-voice report on a completed screen test - graded by the (now revealed) true character fit, one of several stable variants per grade (the pick is a stable hash of who read for what, so it never rerolls). `fitScore` is the true 0-100 character compatibility the audition exposes. */
export function describeAuditionResult(personName: string, characterName: string, personId: string, fitScore: number): string {
  const variants = AUDITION_REPORT[auditionTier(fitScore)];
  const line = variants[stableVariant(`${personId}:${characterName}`, variants.length)];
  return line.replaceAll('{name}', personName).replaceAll('{character}', characterName);
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
  relationship: "won't work with your studio again after how things went last time",
};

/** describeOfferRejection's director-side counterpart, including the prestige-gate reason actors never have. */
export function describeDirectorRejection(reason: DirectorOfferRejectionReason): string {
  return `They passed - ${DIRECTOR_REJECTION_LABELS[reason]}.`;
}

// --- Talent Relationship History (engine/relationships.ts) -----------------
// A short, qualitative chip about the studio's shared past with this person -
// "worked with you twice, keen to do it again" / "you have history, and not the
// good kind." Never raw warmth or a collaboration count as a stat (the house
// style, CLAUDE.md) - a count only appears woven into prose. A sibling session
// owns the casting card that PLACES this chip; this is the read it positions.

function timesPhrase(n: number): string {
  if (n === 1) return 'once';
  if (n === 2) return 'twice';
  return `${n} times`;
}

/**
 * The studio<->person relationship as a single card chip, or null when there's
 * no history to show (strangers - the card shows nothing rather than an empty
 * "no relationship" line). Computed by the caller via
 * engine/relationships.ts:computeRelationship (or playerRelationshipWith) and
 * handed here purely for phrasing, the same "derive elsewhere, phrase here"
 * split every other function in this file follows.
 */
export function describeRelationship(standing: RelationshipStanding): string | null {
  const times = timesPhrase(standing.collaborations);
  switch (standing.tier) {
    case 'none':
      return null;
    case 'loyal':
      return `Worked with you ${times} - loyal to your studio and keen to do it again.`;
    case 'warm':
      return `You have history - ${times} together, and it went well.`;
    case 'neutral':
      return `You've worked together ${times} before.`;
    case 'strained':
      return `You have history - ${times} together, and it left a mark.`;
    case 'grudge':
      return `Bad blood - your last collaboration soured them on working with you again.`;
  }
}

/** How a signed cast member is named in an affinity line - "your director", "your lead", etc. */
function castRoleLabel(role: ProductionRole): string {
  switch (role) {
    case 'Director': return 'director';
    case 'Lead Actor': return 'lead';
    case 'Supporting Actor': return 'co-star';
    case 'Editor': return 'editor';
    case 'Cinematographer': return 'cinematographer';
    default: return 'collaborator';
  }
}

/** Whether an affinity line is good news or a warning - lets the card colour it. */
export function castAffinityTone(affinity: CastAffinity): 'positive' | 'negative' {
  return affinity.chemistry >= 0 ? 'positive' : 'negative';
}

/**
 * A candidate's chemistry with someone already on the cast, as a casting-card
 * chip - the passive "assemble a band" read (engine/pairHistory.ts:CastAffinity).
 * Leads with a proven partnership when there's shared history, and names the
 * person so the player can see WHO the pull is toward (or away from). Qualitative
 * only, never the raw number.
 */
export function describeCastAffinity(affinity: CastAffinity): string {
  const label = castRoleLabel(affinity.partnerRole);
  const name = affinity.partner.identity.name;
  const positive = affinity.chemistry >= 0;
  if (affinity.films > 0) {
    const times = timesPhrase(affinity.films);
    return positive
      ? `Proven partnership - ${times} with your ${label} ${name}, and it clicked.`
      : `You've paired them with your ${label} ${name} ${times} before, and it didn't gel.`;
  }
  return positive
    ? `Looks like a natural fit with your ${label} ${name}.`
    : `Risks clashing with your ${label} ${name}.`;
}
