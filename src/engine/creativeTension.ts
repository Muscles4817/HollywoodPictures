// Creative Tension (docs/SIMULATION_PHILOSOPHY.md phasing, Phase 5 - "creative
// disagreement as an explicit risk amplifier, so competing creative visions
// widen the outcome distribution instead of merely subtracting a few points").
//
// Two strong-willed, inflexible creatives who have to align on one film generate
// friction the cast-wide personality AVERAGES don't capture - it's an
// INTERACTION between a specific pair, not a mean. A calm, deferential lead next
// to a domineering director is fine; two immovable egos in the same room are
// not. This module reads the key creative pairing(s) - the Director against each
// principal actor - and returns how much EXTRA morale friction their particular
// combination creates.
//
// It is deliberately a RISK amplifier, not a quality penalty: the number feeds
// engine/production.ts's moraleRisk (so a high-tension shoot rolls more, and
// bigger, on-set friction events - which route through the normal execution
// pipeline and can break either way), never a flat `quality -= n`. That is the
// exact shape the philosophy asks for.
//
// Pure: plain data in, a number out. Uses the three personality axes that were
// otherwise cosmetic - ego (the will to control) and adaptability (the
// willingness to bend) - turning them into a genuine simulation input.
import type { Person, TalentAssignment } from '../types';
import { filterAssignedPeople } from '../data/helpers';
import { clamp } from './random';

// How much shared inflexibility (low adaptability on both sides) amplifies an
// ego clash. Ego is the primary driver - two people both wanting control is what
// starts a fight - and rigidity decides whether it festers or gets resolved: at
// RIGIDITY_AMPLIFY = 0.5 a maximally rigid pair doubles the friction a perfectly
// adaptable pair of the same egos would generate.
const RIGIDITY_AMPLIFY = 0.5;

/**
 * One director<->actor pairing's friction, 0..1. Both parties must be
 * above-average ego for a real clash (the `min` gate: a deferential party
 * defuses even a domineering counterpart), amplified by their shared
 * inflexibility. Everything is relu'd at the 50 midpoint so an average or
 * agreeable pairing reads as exactly zero - tension is the EXTRA friction over a
 * normal collaboration, not a baseline every production pays.
 */
export function pairFriction(a: Person, b: Person): number {
  const egoClash = clamp((Math.min(a.personality.ego, b.personality.ego) - 50) / 50, 0, 1);
  const rigidity = clamp(
    ((50 - a.personality.adaptability) / 50 + (50 - b.personality.adaptability) / 50) / 2,
    0,
    1,
  );
  return egoClash * (1 - RIGIDITY_AMPLIFY + RIGIDITY_AMPLIFY * rigidity);
}

/**
 * How much extra creative friction the key creatives generate, 0-100. Zero for
 * an agreeable, average, or one-strong-will collaboration; high only when a
 * strong-willed, inflexible director and a principal actor are set against each
 * other. Uses the single WORST pairing rather than an average: one genuine clash
 * at the top of the call sheet defines a shoot's tension, and a max reads more
 * legibly ("the director and their lead are at war") than a blend that averages
 * the drama away. Returns 0 whenever there's no director or no principal cast to
 * clash with.
 */
export function computeCreativeTension(talent: TalentAssignment[]): number {
  const director = filterAssignedPeople(talent, 'Director')[0];
  if (!director) return 0;
  const principals = [
    ...filterAssignedPeople(talent, 'Lead Actor'),
    ...filterAssignedPeople(talent, 'Supporting Actor'),
  ];
  let worst = 0;
  for (const actor of principals) {
    worst = Math.max(worst, pairFriction(director, actor));
  }
  return Math.round(worst * 100);
}
