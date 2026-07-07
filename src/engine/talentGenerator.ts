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
 * Generates one candidate for a role at a random point along that role's
 * salary range. Fame and skill scale up with price on average, but with
 * enough noise that a cheap unknown can be a hidden gem and an expensive
 * hire can disappoint. Reliability and ego are only loosely tied to price -
 * professionalism isn't for sale, and neither is a diva-free set.
 */
function generateTalent(role: TalentRole, genre: Genre, rng: RandomFn): Talent {
  const profile = ROLE_GENERATION_PROFILES[role];
  const t = rng(); // log-scale position within this role's salary range

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

/** Generates a slate of candidates for one role, spanning the whole salary range. */
export function generateTalentCandidates(role: TalentRole, genre: Genre, rng: RandomFn, count = 10): Talent[] {
  return Array.from({ length: count }, () => generateTalent(role, genre, rng));
}
