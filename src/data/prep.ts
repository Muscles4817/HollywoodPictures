// Tunable data for pre-production (docs/DESIGN_REVIEW_preproduction_realism.md,
// docs/IMPLEMENTATION_PLAN_preproduction_realism.md). Every number says what
// real thing it stands for and where in docs/domain/ it comes from. Rebalance
// here, never by threading numbers through engine logic (CLAUDE.md).

/** The parallel chains of a real prep (docs/domain/04-preproduction.md §1.3), each owned by a department. */
export const PREP_FRONTS = ['breakdown', 'design', 'costume', 'locations', 'casting', 'action', 'effects', 'visual'] as const;
export type PrepFront = (typeof PREP_FRONTS)[number];

/** Player-facing name of each front. */
export const PREP_FRONT_LABEL: Record<PrepFront, string> = {
  breakdown: 'Schedule and budget',
  design: 'Design and build',
  costume: 'Costume, hair and makeup',
  locations: 'Locations',
  casting: 'Casting and performance',
  action: 'Action and stunts',
  effects: 'Visual effects',
  visual: 'The visual plan',
};

/** Below this demand a front is not live: no chain, no problems (a chamber drama has no action front). */
export const PREP_FRONT_LIVE_THRESHOLD = 0.15;

/**
 * The core of every prep, in days: breakdown, first board and budget, the
 * budget meeting and the production meeting - about three weeks even on the
 * smallest film (04 §1, "micro-budget indie 3-5 weeks"; §1.2 puts breakdown,
 * board and budget in the first two to three weeks).
 */
export const PREP_CORE_DAYS = 21;

/**
 * How long each front's chain runs, in calendar days: minDays at the edge of
 * being live, + spanDays at full demand. Read from 04 §1.3's irreducible
 * elapsed times and §1's prep lengths by film type:
 * - design: stage set 6-12 weeks, a hero set 3-6 months;
 * - costume: bespoke 6-10 weeks, prosthetics 10-20 weeks, a creature suit 6-12 months;
 * - locations: scouting and permits, days to 6 months for the hard ones;
 * - casting: supporting roles are cast through prep;
 * - action: stunt design and rehearsal 2-8 weeks (§10.5);
 * - effects: previs 6-16 weeks; on an effects-led film VFX starts 6-12 months out (§1.1);
 * - breakdown and visual: inside the core, unless the script or the creatives
 *   keep moving.
 * Prep is as long as the core plus the slowest chain, so a two-hander lands at
 * 3-5 weeks and a creature-heavy tentpole at 6+ months, as §1 says.
 */
export const PREP_FRONT_CHAIN: Record<PrepFront, { minDays: number; spanDays: number }> = {
  breakdown: { minDays: 0, spanDays: 21 },
  design: { minDays: 14, spanDays: 110 },
  costume: { minDays: 14, spanDays: 120 },
  locations: { minDays: 10, spanDays: 70 },
  casting: { minDays: 7, spanDays: 35 },
  action: { minDays: 10, spanDays: 50 },
  effects: { minDays: 14, spanDays: 160 },
  visual: { minDays: 0, spanDays: 21 },
};

/**
 * How much longer every chain runs at each production scale. A front's demand
 * reads how heavy its biggest item is; scale is how MANY of them there are - a
 * dozen sets, two hundred costumes, three countries. "On a tentpole the same
 * sequence runs at 3-4x the elapsed time" (04 §1.2), measured against the
 * ten-week studio prep a Medium film is.
 */
export const PREP_SCALE_FACTOR: Record<'Intimate' | 'Medium' | 'Epic', number> = { Intimate: 0.85, Medium: 1, Epic: 1.6 };

// --- Problems (docs/DESIGN_REVIEW_preproduction_realism.md §1.3, §4.2) -----------

/** Prep work that reveals specific problems (04 §5.2, §10): without it, its problems are only found on the shoot. */
export const PREP_ACTIVITIES = ['scouting', 'tests', 'rehearsal', 'previs'] as const;
export type PrepActivity = (typeof PREP_ACTIVITIES)[number];

export const PREP_ACTIVITY_LABEL: Record<PrepActivity, string> = {
  scouting: 'Location scouting and tech scouts',
  tests: 'Camera, costume and makeup tests',
  rehearsal: 'Rehearsal with the principals',
  previs: 'Previs and stunt rehearsal',
};

/** What each activity is for, in a line. */
export const PREP_ACTIVITY_PURPOSE: Record<PrepActivity, string> = {
  scouting: 'Finds the location that will not work - power, sound, access, permits - before the unit arrives.',
  tests: 'Ends the argument about the look before the shoot, not in dailies.',
  rehearsal: 'Finds the scene that does not play and the pairing that does not spark, while fixing it is free.',
  previs: 'Turns an unpriceable action or effects sequence into one that can be scheduled.',
};

/** Extra daily prep burn each activity adds while it runs (04 §1.4: prep is cheap next to a shooting day). */
export const PREP_ACTIVITY_BURN: Record<PrepActivity, number> = { scouting: 0.12, tests: 0.08, rehearsal: 0.1, previs: 0.15 };

/** The front that makes each activity worth doing; it defaults on when that front is at least moderately live. */
export const PREP_ACTIVITY_FRONTS: Record<PrepActivity, PrepFront[]> = {
  scouting: ['locations'],
  tests: ['visual', 'costume'],
  rehearsal: ['casting'],
  previs: ['action', 'effects'],
};

/** When a prep is cut short, what goes first (04 §16, "sacrifice, in this order"). */
export const PREP_SACRIFICE_ORDER: readonly PrepActivity[] = ['rehearsal', 'previs', 'tests', 'scouting'];

/** The ways a found problem can be handled (04 §4.5, 06 §16.2, 03 §13). */
export type PrepFixKind = 'pay' | 'time' | 'cut' | 'rewrite' | 'recast' | 'contingency' | 'carry';

export const PREP_FIX_LABEL: Record<PrepFixKind, string> = {
  pay: 'Pay to fix it',
  time: 'Take more prep time',
  cut: 'Simplify it',
  rewrite: 'Rewrite around it',
  recast: 'Recast or replace',
  contingency: 'Cover it from the contingency',
  carry: 'Carry it into the shoot',
};

export type PrepProblemKind =
  | 'implied-element'
  | 'script-not-locked'
  | 'budget-gap'
  | 'long-lead-build'
  | 'costume-lead-time'
  | 'location-at-risk'
  | 'location-logistics'
  | 'flat-pairing'
  | 'unrehearsed'
  | 'difficult-star'
  | 'action-unready'
  | 'effects-method'
  | 'visions-differ'
  | 'director-undecided';

/** A way to deal with a problem. Costs scale with the problem's severity (0..1) and the film's own money and days. */
export interface PrepFixSpec {
  kind: PrepFixKind;
  /** Money now, in the film's shooting days at full severity (the daily shoot burn is "a lost day", 04 §1.4). */
  shootDaysOfMoney?: number;
  /** Prep days added, at full severity. */
  prepDays?: number;
  /** A cut or substitution costs the film this much in the named department, per unit of severity: a typed, smaller loss than carrying it. */
  scope?: { impact: ShootImpact; quality: number };
  /** Share of the severity this fix removes (1 = solved). */
  remedy: number;
  /** Last point in prep (0..1 of it) at which this fix is still available; a rush order works in week 3, not week 9. */
  deadline?: number;
  /** Player-facing: what this option is, for this problem. */
  text: string;
}

/** Typed impacts an incident or a cut can carry (a subset of ProductionExecutionImpact). */
export type ShootImpact = 'performances' | 'coverage' | 'sets' | 'vfx' | 'practical' | 'visual' | 'pacing' | 'script' | 'general';

// Rates (expected count on a film whose front is at full demand) are judgement
// read from the reference's frequency words, not measured figures: "every
// script implies elements nobody costed" (04 §2.6) -> the highest rate; a
// script not locked is "the root cause of most overruns" (03 §13) -> common;
// a flat pairing "happens on a minority of films and is unfixable on the day"
// (04 §8.3) -> rare. Severity ranges are shares of each incident's full size.
// These are the first numbers to revisit if the PREP_DIAGNOSTIC harness reads
// wrong against 03 §13 / 04 §1.4.
export interface PrepProblemSpec {
  front: PrepFront;
  /** Expected count on a film whose front demand is 1 (Poisson-ish draw, scaled by demand). */
  rate: number;
  /** Severity drawn in this range, then scaled by demand. */
  severity: [number, number];
  /** 'always' = anyone working the front sees it; otherwise only the named activity reveals it. */
  revealedBy: 'always' | PrepActivity;
  /** Share of prep (0..1) in which it is normally found. */
  window: [number, number];
  /** True when a short prep makes it worse: a long-lead item that cannot be ready (04 §1.3). */
  leadTime?: boolean;
  /** Plain words: what was found. */
  found: string;
  /** What it becomes on the shoot if never dealt with (at full severity). */
  incident: { delayDays: number; impact: ShootImpact; quality: number; overrunShootDays?: number; text: string };
  fixes: PrepFixSpec[];
}

/**
 * The catalogue. Sizes are the reference's: an implied element costs half to a
 * whole shooting day (04 §1.4, §2.6); a set handed over late costs 1-2 hours a
 * day over a block (04 §6.4); a missed tech scout 1-3 hours a day at that
 * location (04 §5.4); an unlocked script compounds, 5-25% (03 §13); a dead
 * pairing is "unfixable" on the day (04 §8.3). Incident quality is in the
 * shoot's own event units (the -100..100 scale shoot events use).
 */
export const PREP_PROBLEMS: Record<PrepProblemKind, PrepProblemSpec> = {
  'implied-element': {
    front: 'breakdown', rate: 2.2, severity: [0.3, 0.8], revealedBy: 'always', window: [0, 0.3],
    found: 'The breakdown turned up something the script takes for granted and nobody has costed.',
    incident: { delayDays: 1, impact: 'coverage', quality: -3, text: 'Something the script needed was never ordered; the unit lost most of a day improvising it.' },
    fixes: [
      { kind: 'pay', shootDaysOfMoney: 0.35, remedy: 1, text: 'Budget for it properly now.' },
      { kind: 'cut', scope: { impact: 'visual', quality: -1.5 }, remedy: 1, text: 'Write it out or play it smaller.' },
    ],
  },
  'script-not-locked': {
    front: 'breakdown', rate: 1.2, severity: [0.4, 1], revealedBy: 'always', window: [0.15, 0.5],
    found: 'The table read showed the script is not finished: scenes that die, a character who vanishes, a film that runs long.',
    incident: { delayDays: 4, impact: 'script', quality: -6, overrunShootDays: 1, text: 'Pages kept changing during the shoot; departments prepped twice and the schedule paid for it.' },
    fixes: [
      { kind: 'rewrite', prepDays: 10, shootDaysOfMoney: 0.2, remedy: 0.85, deadline: 0.6, text: 'A proper pass now, before anyone builds to the old pages.' },
      { kind: 'cut', scope: { impact: 'script', quality: -2.5 }, remedy: 0.9, text: 'Cut what does not work and lock what is left.' },
    ],
  },
  'budget-gap': {
    front: 'breakdown', rate: 1, severity: [0.3, 1], revealedBy: 'always', window: [0.1, 0.3],
    found: "The first real budget came in over what the film was set up to spend. Someone has to find the difference.",
    incident: { delayDays: 2, impact: 'coverage', quality: -4, overrunShootDays: 3, text: 'The schedule was built to the budget rather than the work; the shoot fell behind from the first week.' },
    fixes: [
      { kind: 'pay', shootDaysOfMoney: 3, remedy: 1, text: 'Put in the money the film actually needs.' },
      { kind: 'cut', scope: { impact: 'sets', quality: -4 }, remedy: 1, text: 'Take a pass for budget: merge locations, shrink set pieces, cut a set.' },
      { kind: 'contingency', shootDaysOfMoney: 3, remedy: 1, text: 'Close the gap with the contingency - leaving less for the shoot.' },
    ],
  },
  'long-lead-build': {
    front: 'design', rate: 1.6, severity: [0.3, 0.9], revealedBy: 'always', window: [0.15, 0.6], leadTime: true,
    found: 'A build on the set list cannot be finished in the time prep has.',
    incident: { delayDays: 2, impact: 'sets', quality: -5, text: 'A set was handed over unfinished on the shooting morning; days were lost and it shows on screen.' },
    fixes: [
      { kind: 'pay', shootDaysOfMoney: 0.8, remedy: 0.9, deadline: 0.7, text: 'A second build crew and overtime to make the date.' },
      { kind: 'time', prepDays: 14, remedy: 1, text: 'Give construction the weeks it needs.' },
      { kind: 'cut', scope: { impact: 'sets', quality: -2.5 }, remedy: 1, text: 'Simplify it - a redress, a set extension, a practical location.' },
    ],
  },
  'costume-lead-time': {
    front: 'costume', rate: 1.4, severity: [0.3, 0.9], revealedBy: 'always', window: [0.2, 0.65], leadTime: true,
    found: 'Bespoke costumes, wigs or prosthetics cannot be made, fitted and tested in time.',
    incident: { delayDays: 1, impact: 'visual', quality: -4, text: 'Principals shot in rented approximations, and the unit waited on the makeup trailer.' },
    fixes: [
      { kind: 'pay', shootDaysOfMoney: 0.5, remedy: 0.85, deadline: 0.75, text: 'More makers and a rush on the workroom.' },
      { kind: 'time', prepDays: 10, remedy: 1, text: 'Hold the start until the fittings are done.' },
      { kind: 'cut', scope: { impact: 'visual', quality: -2 }, remedy: 1, text: 'Hire and alter stock instead of making.' },
    ],
  },
  'location-at-risk': {
    front: 'locations', rate: 1.4, severity: [0.3, 1], revealedBy: 'scouting', window: [0.25, 0.75],
    found: 'A key location is not secure: a permit stalling, an owner wavering, neighbours organising.',
    incident: { delayDays: 3, impact: 'coverage', quality: -4, overrunShootDays: 1, text: 'A location was lost mid-shoot; the scenes were rewritten and reshot somewhere else.' },
    fixes: [
      { kind: 'pay', shootDaysOfMoney: 0.6, remedy: 0.9, text: 'Pay to secure it, and line up an alternative.' },
      { kind: 'time', prepDays: 10, remedy: 1, text: 'Wait for the permit and scout a fallback.' },
      { kind: 'rewrite', scope: { impact: 'script', quality: -1.5 }, remedy: 1, text: 'Merge the scenes into a location the film already has.' },
    ],
  },
  'location-logistics': {
    front: 'locations', rate: 1.6, severity: [0.2, 0.7], revealedBy: 'scouting', window: [0.5, 0.95],
    found: 'The tech scout found a location that will fight the unit: no power, a flight path, nowhere to park ninety trucks.',
    incident: { delayDays: 1.5, impact: 'pacing', quality: -2, text: 'Hours lost every day at a location nobody had properly walked; much of the dialogue had to be re-recorded.' },
    fixes: [
      { kind: 'pay', shootDaysOfMoney: 0.3, remedy: 0.9, text: 'Generators, a closer base camp, sound blankets - solve it with kit.' },
      { kind: 'cut', scope: { impact: 'visual', quality: -1 }, remedy: 1, text: 'Move the scenes to an easier location.' },
    ],
  },
  'flat-pairing': {
    front: 'casting', rate: 0.6, severity: [0.4, 1], revealedBy: 'rehearsal', window: [0.55, 0.95],
    found: 'Rehearsal showed the central pairing does not spark.',
    incident: { delayDays: 0, impact: 'performances', quality: -8, text: 'The central relationship never landed; no amount of takes found it.' },
    fixes: [
      { kind: 'time', prepDays: 7, shootDaysOfMoney: 0.1, remedy: 0.5, text: 'More rehearsal - it helps, it rarely cures.' },
      { kind: 'recast', prepDays: 12, shootDaysOfMoney: 1.5, remedy: 0.95, text: 'Recast one of them now, while it costs a fee rather than the film.' },
    ],
  },
  unrehearsed: {
    front: 'casting', rate: 1.2, severity: [0.2, 0.6], revealedBy: 'rehearsal', window: [0.6, 1],
    found: 'Rehearsal found scenes that do not play and lines that will not sit in the actors\' mouths.',
    incident: { delayDays: 1.5, impact: 'performances', quality: -2, text: 'Blocking and line changes were worked out on the floor with ninety people waiting.' },
    fixes: [
      { kind: 'time', prepDays: 5, shootDaysOfMoney: 0.05, remedy: 0.9, text: 'Another week of rehearsal.' },
      { kind: 'rewrite', scope: { impact: 'script', quality: -0.5 }, remedy: 0.9, text: 'Rewrite the scenes that do not play.' },
    ],
  },
  'difficult-star': {
    front: 'casting', rate: 0, severity: [0.4, 0.9], revealedBy: 'always', window: [0.1, 0.5],
    found: 'The lead is already picking fights over billing and pages before a frame is shot.',
    incident: { delayDays: 2, impact: 'performances', quality: -3, text: 'A star at war with the production cost days and frayed the whole cast.' },
    fixes: [
      { kind: 'pay', shootDaysOfMoney: 0.2, remedy: 0.6, text: 'Give a little: billing, a trailer, a say on their pages.' },
      { kind: 'time', prepDays: 2, remedy: 0.7, text: 'An uncomfortable conversation now about how this shoot will run.' },
    ],
  },
  'action-unready': {
    front: 'action', rate: 1.3, severity: [0.3, 1], revealedBy: 'previs', window: [0.35, 0.85],
    found: 'An action sequence is not designed, rehearsed or rigged to a standard anyone can safely shoot.',
    incident: { delayDays: 2.5, impact: 'practical', quality: -5, overrunShootDays: 0.5, text: 'A sequence was worked out on the day; resets ate the schedule and the gag was cut down to what was safe.' },
    fixes: [
      { kind: 'time', prepDays: 10, shootDaysOfMoney: 0.2, remedy: 1, text: 'Weeks of stunt rehearsal and rigging tests.' },
      { kind: 'pay', shootDaysOfMoney: 0.7, remedy: 0.8, text: 'A bigger stunt team and more cameras to get it in one.' },
      { kind: 'cut', scope: { impact: 'practical', quality: -2.5 }, remedy: 1, text: 'Simplify the sequence to what can be done well.' },
    ],
  },
  'effects-method': {
    front: 'effects', rate: 1.4, severity: [0.3, 1], revealedBy: 'previs', window: [0.2, 0.7],
    found: 'How the big effects shots will actually be done has not been settled shot by shot.',
    incident: { delayDays: 1, impact: 'vfx', quality: -4, overrunShootDays: 2, text: 'Effects methods were decided on the floor; the shot count grew in post and the bill with it.' },
    fixes: [
      { kind: 'pay', shootDaysOfMoney: 0.6, remedy: 0.9, text: 'Previs and techvis for every effects sequence.' },
      { kind: 'cut', scope: { impact: 'vfx', quality: -2.5 }, remedy: 1, text: 'Scale the effects back to what the plan can deliver.' },
    ],
  },
  'visions-differ': {
    front: 'visual', rate: 1, severity: [0.3, 1], revealedBy: 'tests', window: [0.4, 0.9],
    found: 'The tests showed the director, the cinematographer and the designer imagining different films.',
    incident: { delayDays: 1, impact: 'visual', quality: -5, text: 'Two visual plans fought each other all shoot; the grade had to pick one.' },
    fixes: [
      { kind: 'time', prepDays: 5, shootDaysOfMoney: 0.1, remedy: 0.9, text: 'More tests, screened together, until there is one look.' },
      { kind: 'recast', prepDays: 10, shootDaysOfMoney: 0.8, remedy: 1, text: 'Replace the head who sees a different film.' },
    ],
  },
  'director-undecided': {
    front: 'visual', rate: 1, severity: [0.3, 0.9], revealedBy: 'always', window: [0.2, 0.6],
    found: 'Departments are waiting on decisions the director has not made.',
    incident: { delayDays: 2, impact: 'pacing', quality: -2, overrunShootDays: 0.5, text: 'The set stood still while choices were made on the floor; departments built the expensive version to be safe.' },
    fixes: [
      { kind: 'time', prepDays: 4, remedy: 0.7, text: 'Lock the decisions in a long meeting now.' },
      { kind: 'cut', scope: { impact: 'pacing', quality: -1 }, remedy: 1, text: 'The production takes the open choices off the table.' },
    ],
  },
};

/** The four real moments a producer faces prep's problems (04 §1.2), as shares of prep. */
export const PREP_CHECKPOINTS: readonly { at: number; title: string }[] = [
  { at: 0.25, title: 'The first budget and board' },
  { at: 0.55, title: 'Design and locations lock' },
  { at: 0.8, title: 'Tests, rehearsal and scouts' },
  { at: 0.95, title: 'The production meeting' },
];

/** Discovery: the share of a problem's window in which a skill-0 and a skill-100 owner find it, if the work that reveals it is done. */
// How much of a problem's window finds it. Judgement, anchored on 04 §5.2 and
// §10 (a skilled location manager "finds it on the recce"; juniors miss it) and
// tuned so the PREP_DIAGNOSTIC harness puts carried-problem lost days for a
// weak team at the reference's "short prep" overrun (03 §13: 3-10%) and for a
// strong one near zero.
// 'always' problems are in plain sight to anyone working the front (a budget
// that does not add up, a build that cannot finish), so they get a further
// alwaysBonus; subtle ones need the work and the skill (04 §5.2, §10).
export const PREP_FIND_SHARE = { atSkill0: 0.35, atSkill100: 0.95, severityBonus: 0.1, reliabilityBonus: 0.08, alwaysBonus: 0.2, familiarityBonus: 6 } as const;

/** Schedule shares are judgement from 04 §6.4 (sets are scheduled in build order, mid-shoot), §10 (big action and effects days sit mid-schedule, not week one) and 06 §2 (week one shoots what is ready - the cast, the look, the breakdown's errors). */
/** Where in the shoot each front's problems surface, as a share of the schedule: the breakdown and the look bite in week one; action and effects land on their big days mid-shoot (04 §6.4, §10). */
export const PREP_FRONT_SHOOT_SHARE: Record<PrepFront, [number, number]> = {
  breakdown: [0.02, 0.4],
  design: [0.1, 0.7],
  costume: [0.02, 0.35],
  locations: [0.05, 0.85],
  casting: [0.02, 0.3],
  action: [0.25, 0.85],
  effects: [0.25, 0.85],
  visual: [0.02, 0.3],
};

/** A problem left at or under this severity after a fix is solved. */
export const PREP_SOLVED_SEVERITY = 0.05;

/** A front is checked by its activity when its demand is at least this (the activity defaults on). */
export const PREP_ACTIVITY_DEFAULT_DEMAND = 0.25;

/** How a shorter prep loses its revealing work: one activity per this much prep cut (04 §16 sacrifice order). */
export const PREP_ACTIVITY_DROP_STEP = 0.125;

/** Shoot-risk adjustments from prep (a bounded swing per dimension, as the old shared delta was; the old delta's +/-25 split four ways, rounded down to 15 because carried problems now also fire as their own incidents). */
export const PREP_RISK = {
  /** Per carried problem, at full severity, on its front's dimension. */
  carriedPerSeverity: 6,
  /** Lowered on its dimension by each activity done. */
  activityRelief: 3,
  maxSwing: 15,
} as const;

/** A prep shorter than recommended worsens long-lead problems by this much per unit of shortfall (a chain cannot be compressed - 04 §1.3). */
export const PREP_SHORTFALL_SEVERITY = 1.2;

/** The prep length choices the player has, as a factor on the recommendation. */
export const PREP_LENGTH_FACTORS = { short: 0.75, recommended: 1, long: 1.25 } as const;

/** For the AI's judgement only: what one quality point on screen is worth, in shooting days. Never shown. */
export const PREP_QUALITY_POINT_SHOOT_DAYS = 0.6;

// --- Time costs (Phase 5; 04 §9.6 "What a start-date slip actually does") -----

/**
 * Share of a film's people booked elsewhere (in demand) who leave as its start
 * slips, by how far it has slipped in all: a few days are absorbed; a week loses
 * one or two with a hard out; 2-4 weeks and HODs start dropping, "and they are
 * the good ones"; 6+ weeks is effectively a re-crew. Anyone whose next job now
 * overlaps the film leaves whatever the slip (the hard clash).
 */
export const PREP_SLIP_LEAVE_SHARE: readonly { minDays: number; share: number }[] = [
  { minDays: 42, share: 0.75 },
  { minDays: 14, share: 0.35 },
  { minDays: 7, share: 0.1 },
  { minDays: 0, share: 0 },
];

/** Keeping someone whose next job now clashes, when no one can replace them: the production buys them out of it (the shoot's own severance rate). */
export const PREP_SLIP_BUYOUT_RATE = 0.4;
