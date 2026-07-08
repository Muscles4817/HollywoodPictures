import type { Genre, Talent, TalentRole } from '../types';
import { GENRES } from '../data/genres';
import { ALL_TALENT_ROLES, ROLE_GENERATION_PROFILES } from '../data/talentGeneration';
import { TALENT_FIRST_NAMES, TALENT_LAST_NAMES } from '../data/talentNames';
import { logAmount } from './interpolate';
import { clamp, pick, randFloat, randInt, type RandomFn } from './random';

let nextTalentId = 1;

function randomName(rng: RandomFn): string {
  return `${pick(rng, TALENT_FIRST_NAMES)} ${pick(rng, TALENT_LAST_NAMES)}`;
}

function generateGenreAffinities(rng: RandomFn): Record<Genre, number> {
  const affinities = {} as Record<Genre, number>;
  for (const genre of GENRES) {
    affinities[genre] = randInt(rng, 15, 100);
  }
  return affinities;
}

/**
 * Generates one candidate for a role at a given point along that role's
 * salary range (t, 0-1 on the log scale - see generateTalentCandidates for
 * how t is chosen). Fame and skill scale up with price on average, but with
 * enough noise that a cheap unknown can be a hidden gem and an expensive
 * hire can disappoint. Reliability and ego are only loosely tied to price -
 * professionalism isn't for sale, and neither is a diva-free set.
 *
 * Genre affinity is rolled independently for every genre, not just whatever
 * genre happens to be selected right now - talent is a persistent studio
 * resource (see state/gameState.ts:createInitialStudio), generated once at
 * the start of the game, so it needs a complete, permanent profile rather
 * than one tied to a genre that might not even be picked again this game.
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
    genreAffinities: generateGenreAffinities(rng),
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
