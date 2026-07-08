import type { ActingStyle, Talent, TalentRole, ToneProfile } from '../types';
import { ALL_TALENT_ROLES, ROLE_GENERATION_PROFILES } from '../data/talentGeneration';
import { TALENT_FIRST_NAMES, TALENT_LAST_NAMES } from '../data/talentNames';
import { TONES } from '../data/tones';
import { ACTING_STYLE_AXES } from '../data/actingStyle';
import { logAmount } from './interpolate';
import { clamp, pick, pickMany, randFloat, randInt, type RandomFn } from './random';

let nextTalentId = 1;

function randomName(rng: RandomFn): string {
  return `${pick(rng, TALENT_FIRST_NAMES)} ${pick(rng, TALENT_LAST_NAMES)}`;
}

// Kept off the 1/100 extremes on purpose (see data/genres.ts for the same
// reasoning on the script side) - a coarse 5-star display (5.11) needs the
// underlying numbers to actually spread across the middle of the scale,
// not just flip between "empty" and "full".
const SIGNATURE_RANGE: [number, number] = [65, 90];
const BASE_RANGE: [number, number] = [15, 50];

/**
 * Rolls 1-2 "signature" axes high and the rest from a lower, noisier base -
 * independent uniform rolls across every axis would regress everyone toward
 * a flat, unmemorable middle, which loses the "brilliant at suspense,
 * hopeless at comedy" specialist flavor a real cast/crew has. Shared shape
 * for both a Director's ToneProfile and an Actor's ActingStyle - only the
 * axis list passed in differs.
 */
function generateSignatureProfile<K extends string>(rng: RandomFn, axes: readonly K[]): Record<K, number> {
  const signatureCount = randInt(rng, 1, 2);
  const signatures = new Set(pickMany(rng, axes, signatureCount));
  const profile = {} as Record<K, number>;
  for (const axis of axes) {
    profile[axis] = signatures.has(axis) ? randInt(rng, ...SIGNATURE_RANGE) : randInt(rng, ...BASE_RANGE);
  }
  return profile;
}

function generateToneProfile(rng: RandomFn): ToneProfile {
  return generateSignatureProfile(rng, TONES);
}

function generateActingStyle(rng: RandomFn): ActingStyle {
  return generateSignatureProfile(rng, ACTING_STYLE_AXES);
}

function generateSkill(rng: RandomFn, t: number): number {
  const skillMean = 25 + 65 * t;
  return clamp(Math.round(skillMean + randFloat(rng, -20, 20)), 1, 100);
}

/**
 * Generates one candidate for a role at a given point along that role's
 * salary range (t, 0-1 on the log scale - see generateTalentCandidates for
 * how t is chosen). Fame scales up with price on average, but with enough
 * noise that a cheap unknown can be a hidden gem and an expensive hire can
 * disappoint. Reliability and ego are only loosely tied to price -
 * professionalism isn't for sale, and neither is a diva-free set. What else
 * gets rolled depends on the role: Director gets a general skill plus a
 * ToneProfile shared with Script; Actors get an ActingStyle instead of a
 * separate skill - those five numbers are both their skill and their fit,
 * together (see types/index.ts); everyone else gets a plain skill only.
 */
function generateTalent(role: TalentRole, rng: RandomFn, t: number): Talent {
  const profile = ROLE_GENERATION_PROFILES[role];
  const salary = Math.round(logAmount(t, profile.salaryRange) / 1000) * 1000;

  const fameMean = 10 + (profile.fameCeiling - 10) * t;
  const fame = clamp(Math.round(fameMean + randFloat(rng, -12, 12)), 1, 100);

  const reliabilityMean = 45 + 25 * t;
  const reliability = clamp(Math.round(reliabilityMean + randFloat(rng, -30, 30)), 1, 100);

  const ego = clamp(Math.round(15 + fame * 0.45 + randFloat(rng, -20, 20)), 1, 100);

  const common = {
    id: `talent-${nextTalentId++}`,
    name: randomName(rng),
    fame,
    reliability,
    ego,
    salary,
  };

  if (role === 'Director') {
    return { ...common, role, skill: generateSkill(rng, t), toneProfile: generateToneProfile(rng) };
  }
  if (role === 'Lead Actor' || role === 'Supporting Actor') {
    return { ...common, role, actingStyle: generateActingStyle(rng) };
  }
  return { ...common, role, skill: generateSkill(rng, t) };
}

/**
 * Generates a slate of candidates for one role. Salary positions are
 * stratified - the 0-1 salary-range scale is split into `count` equal bands
 * and one candidate is drawn (with random jitter) from each - rather than
 * pure random sampling, which tends to clump and leave gaps. That guarantees
 * a genuinely cheap option and a genuinely expensive one always show up,
 * and that wherever a price slider is pointed, there's someone nearby.
 *
 * 100 is generous on purpose: generation is cheap (a handful of arithmetic
 * ops and RNG calls each, no rendering cost since only a handful are ever
 * displayed - see engine/talentFilter.ts), and it only happens once, at
 * game start, rather than on every genre pick - so there's no real reason
 * to ration it. Density matters here specifically because the Hire Talent
 * screen filters candidates to a tight percentage band around the target
 * price (see talentFilter.ts) rather than just showing "the N closest" -
 * a sparser pool would make that band come up empty more often.
 */
export function generateTalentCandidates(role: TalentRole, rng: RandomFn, count = 100): Talent[] {
  return Array.from({ length: count }, (_, i) => {
    const bandStart = i / count;
    const bandEnd = (i + 1) / count;
    const t = randFloat(rng, bandStart, bandEnd);
    return generateTalent(role, rng, t);
  });
}

/** The full studio roster: every role's candidate slate, generated once. */
export function generateTalentPool(rng: RandomFn): Record<TalentRole, Talent[]> {
  const pool = {} as Record<TalentRole, Talent[]>;
  for (const role of ALL_TALENT_ROLES) {
    pool[role] = generateTalentCandidates(role, rng);
  }
  return pool;
}
