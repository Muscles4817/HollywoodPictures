import type { Genre, Talent, TalentRole } from '../types';
import { ROLE_GENERATION_PROFILES } from '../data/talentGeneration';
import { TALENT_FIRST_NAMES, TALENT_LAST_NAMES } from '../data/talentNames';
import { logAmount } from './interpolate';
import { clamp, pick, randFloat, randInt, type RandomFn } from './random';

let nextTalentId = 1;

function randomName(rng: RandomFn): string {
  return `${pick(rng, TALENT_FIRST_NAMES)} ${pick(rng, TALENT_LAST_NAMES)}`;
}

/**
 * Generates one candidate for a role at a given point along that role's
 * salary range (t, 0-1 on the log scale - see generateTalentCandidates for
 * how t is chosen). Fame and skill scale up with price on average, but with
 * enough noise that a cheap unknown can be a hidden gem and an expensive
 * hire can disappoint. Reliability and ego are only loosely tied to price -
 * professionalism isn't for sale, and neither is a diva-free set.
 */
function generateTalent(role: TalentRole, genre: Genre, rng: RandomFn, t: number): Talent {
  const profile = ROLE_GENERATION_PROFILES[role];
  const salary = Math.round(logAmount(t, profile.salaryRange) / 1000) * 1000;

  const fameMean = 10 + (profile.fameCeiling - 10) * t;
  const fame = clamp(Math.round(fameMean + randFloat(rng, -12, 12)), 1, 100);

  const skillMean = 25 + 65 * t;
  const skill = clamp(Math.round(skillMean + randFloat(rng, -20, 20)), 1, 100);

  const reliabilityMean = 45 + 25 * t;
  const reliability = clamp(Math.round(reliabilityMean + randFloat(rng, -30, 30)), 1, 100);

  const ego = clamp(Math.round(15 + fame * 0.45 + randFloat(rng, -20, 20)), 1, 100);

  const genreAffinity = randInt(rng, 15, 100);

  return {
    id: `talent-${nextTalentId++}`,
    name: randomName(rng),
    role,
    fame,
    skill,
    reliability,
    ego,
    salary,
    genreAffinities: { [genre]: genreAffinity },
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
 * 50 is generous on purpose: generation is cheap (a handful of arithmetic
 * ops and RNG calls each, no rendering cost since only the closest few are
 * ever displayed - see HireTalent.tsx's VISIBLE_CANDIDATE_COUNT), so there's
 * no real reason to ration it. The whole slate serializes to well under
 * 100KB of localStorage even at this size.
 */
export function generateTalentCandidates(role: TalentRole, genre: Genre, rng: RandomFn, count = 50): Talent[] {
  return Array.from({ length: count }, (_, i) => {
    const bandStart = i / count;
    const bandEnd = (i + 1) / count;
    const t = randFloat(rng, bandStart, bandEnd);
    return generateTalent(role, genre, rng, t);
  });
}
