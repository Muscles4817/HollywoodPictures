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
