import type { Talent, TalentRole, ToneProfile } from '../types';
import { ALL_TALENT_ROLES, ROLE_GENERATION_PROFILES } from '../data/talentGeneration';
import { TALENT_FIRST_NAMES, TALENT_LAST_NAMES } from '../data/talentNames';
import { TONES } from '../data/tones';
import { logAmount } from './interpolate';
import { clamp, pick, pickMany, randFloat, randInt, type RandomFn } from './random';

let nextTalentId = 1;

function randomName(rng: RandomFn): string {
  return `${pick(rng, TALENT_FIRST_NAMES)} ${pick(rng, TALENT_LAST_NAMES)}`;
}

const SIGNATURE_TONE_RANGE: [number, number] = [70, 100];
const BASE_TONE_RANGE: [number, number] = [10, 55];

/**
 * Rolls a tone profile with 1-2 "signature" tones (rolled high) and the rest
 * rolled from a lower, noisier base - independent uniform rolls across all
 * six tones would regress everyone toward a flat, unmemorable middle, which
 * loses the "brilliant at suspense, hopeless at comedy" specialist flavor
 * a real cast/crew has. Every candidate gets a profile for every tone, not
 * just whatever genre happens to be selected - talent is a persistent studio
 * resource (see state/gameState.ts:createInitialStudio), generated once at
 * the start of the game, so it needs a complete, permanent profile.
 */
function generateToneProfile(rng: RandomFn): ToneProfile {
  const signatureCount = randInt(rng, 1, 2);
  const signatures = new Set(pickMany(rng, TONES, signatureCount));
  const profile = {} as ToneProfile;
  for (const tone of TONES) {
    profile[tone] = signatures.has(tone)
      ? randInt(rng, ...SIGNATURE_TONE_RANGE)
      : randInt(rng, ...BASE_TONE_RANGE);
  }
  return profile;
}

/**
 * Generates one candidate for a role at a given point along that role's
 * salary range (t, 0-1 on the log scale - see generateTalentCandidates for
 * how t is chosen). Fame and skill scale up with price on average, but with
 * enough noise that a cheap unknown can be a hidden gem and an expensive
 * hire can disappoint. Reliability and ego are only loosely tied to price -
 * professionalism isn't for sale, and neither is a diva-free set.
 */
function generateTalent(role: TalentRole, rng: RandomFn, t: number): Talent {
  const profile = ROLE_GENERATION_PROFILES[role];
  const salary = Math.round(logAmount(t, profile.salaryRange) / 1000) * 1000;

  const fameMean = 10 + (profile.fameCeiling - 10) * t;
  const fame = clamp(Math.round(fameMean + randFloat(rng, -12, 12)), 1, 100);

  const skillMean = 25 + 65 * t;
  const skill = clamp(Math.round(skillMean + randFloat(rng, -20, 20)), 1, 100);

  const reliabilityMean = 45 + 25 * t;
  const reliability = clamp(Math.round(reliabilityMean + randFloat(rng, -30, 30)), 1, 100);

  const ego = clamp(Math.round(15 + fame * 0.45 + randFloat(rng, -20, 20)), 1, 100);

  return {
    id: `talent-${nextTalentId++}`,
    name: randomName(rng),
    role,
    fame,
    skill,
    reliability,
    ego,
    salary,
    toneProfile: generateToneProfile(rng),
  };
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
