import type {
  ActingStyle,
  DirectorProductionStyle,
  EffectsMethodKey,
  EnvironmentMethodKey,
  GameDate,
  Gender,
  Person,
  PersonCareers,
  TalentProfession,
  ToneProfile,
} from '../types';
import { ALL_TALENT_PROFESSIONS, ROLE_GENERATION_PROFILES } from '../data/talentGeneration';
import { HANDCRAFTED_TALENTS_BY_ROLE } from '../data/handcraftedTalents';
import { TALENT_FIRST_NAMES, TALENT_LAST_NAMES } from '../data/talentNames';
import { TONES } from '../data/tones';
import { ACTING_STYLE_AXES } from '../data/actingStyle';
import { CREW_CAREER_KEY } from './person';
import { logAmount, logT } from './interpolate';
import { clamp, normalizeWeights, pick, pickMany, randFloat, randInt, weightedPick, type RandomFn } from './random';

let nextTalentId = 1;

function randomName(rng: RandomFn): string {
  return `${pick(rng, TALENT_FIRST_NAMES)} ${pick(rng, TALENT_LAST_NAMES)}`;
}

const GENDERS: readonly Gender[] = ['Male', 'Female', 'NonBinary'];

// TALENT_FIRST_NAMES is a single unisex pool by design (data/talentNames.ts)
// rather than split by gender, so this is drawn independently rather than
// correlated to the name already picked - matches how neither the pool nor
// any name in it was ever meant to imply a gender.
function generateGender(rng: RandomFn): Gender {
  return weightedPick(rng, GENDERS, { Male: 1, Female: 1, NonBinary: 0.06 });
}

// Every generated person is a working professional, so the range skews
// toward a plausible career-active adult rather than including anyone
// still a minor - averaging two independent rolls (a triangular rather than
// flat distribution) keeps the bulk in a normal working-age band without
// entirely excluding a rare very-young or very-old outlier. Talent pools
// are only ever generated at RESET_SAVE/a fresh save (both always at
// GameState.totalDays === 1, Year 1) - see generateTalentPool - so "Year 1"
// is always genuinely "now" at the moment this runs, not a stale anchor.
function generateDateOfBirth(rng: RandomFn): GameDate {
  const age = Math.round((randInt(rng, 20, 68) + randInt(rng, 20, 68)) / 2);
  return { year: 1 - age, month: randInt(rng, 1, 12), day: randInt(rng, 1, 28) };
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

const ENVIRONMENT_METHOD_KEYS: readonly EnvironmentMethodKey[] = ['studio', 'location', 'digital'];
const EFFECTS_METHOD_KEYS: readonly EffectsMethodKey[] = ['practical', 'digital'];

/**
 * A personal lean across a fixed set of options - one key rolls a
 * meaningfully stronger weight so the result reads as a genuine preference
 * (a location purist, a studio loyalist) rather than a bland even split.
 * Same "roll one thing high, the rest lower and noisier" idea as
 * generateSignatureProfile above, just normalized into a Distribution
 * instead of independent per-axis scores - a director's own leanings have
 * no genre to anchor around the way a script's do (see
 * engine/scriptGenerator.ts), so this is pure personal variation.
 */
function generateLeaningDistribution<K extends string>(rng: RandomFn, keys: readonly K[]): Record<K, number> {
  const leanKey = pick(rng, keys);
  const weights = {} as Record<K, number>;
  for (const key of keys) {
    weights[key] = key === leanKey ? randFloat(rng, 1.5, 3) : randFloat(rng, 0.3, 1.2);
  }
  return normalizeWeights(weights);
}

function generateProductionStyle(rng: RandomFn): DirectorProductionStyle {
  return {
    environmentStrategy: generateLeaningDistribution(rng, ENVIRONMENT_METHOD_KEYS),
    effectsStrategy: generateLeaningDistribution(rng, EFFECTS_METHOD_KEYS),
  };
}

function generateSkill(rng: RandomFn, t: number): number {
  const skillMean = 25 + 65 * t;
  return clamp(Math.round(skillMean + randFloat(rng, -20, 20)), 1, 100);
}

function generateFame(role: TalentProfession, rng: RandomFn, t: number): number {
  switch (role) {
    case 'Actor':
      return clamp(
        Math.round(5 + 90 * t + randFloat(rng, -12, 12)),
        1,
        100,
      );

    case 'Director':
      return clamp(
        Math.round(8 + 87 * t + randFloat(rng, -10, 10)),
        1,
        100,
      );

    case 'Writer': {
      const fameT = 0.35 * t + 0.65 * rng();
      return clamp(
        Math.round(3 + 49 * fameT + randFloat(rng, -7, 7)),
        1,
        100,
      );
    }

    case 'Composer': {
      const fameT = 0.45 * t + 0.55 * rng();
      return clamp(
        Math.round(3 + 52 * fameT + randFloat(rng, -8, 8)),
        1,
        100,
      );
    }

    case 'Cinematographer': {
      const fameT = 0.2 * t + 0.8 * rng();
      return clamp(
        Math.round(2 + 36 * fameT + randFloat(rng, -5, 5)),
        1,
        100,
      );
    }

    case 'Editor': {
      const fameT = 0.15 * t + 0.85 * rng();
      return clamp(
        Math.round(2 + 28 * fameT + randFloat(rng, -5, 5)),
        1,
        100,
      );
    }

    case 'VFX Supervisor': {
      const fameT = 0.15 * t + 0.85 * rng();
      return clamp(
        Math.round(2 + 30 * fameT + randFloat(rng, -5, 5)),
        1,
        100,
      );
    }

    case 'Casting Director': {
      const fameT = 0.15 * t + 0.85 * rng();
      return clamp(
        Math.round(2 + 20 * fameT + randFloat(rng, -4, 4)),
        1,
        100,
      );
    }
  }
}

function generateEgo(role: TalentProfession, rng: RandomFn, fame: number): number {
  const fameInfluence: Record<TalentProfession, number> = {
    Director: 0.45,
    'Actor': 0.5,
    Writer: 0.25,
    Cinematographer: 0.15,
    Composer: 0.15,
    Editor: 0.1,
    'VFX Supervisor': 0.1,
    'Casting Director': 0.1,
  };

  const base: Record<TalentProfession, number> = {
    Director: 18,
    'Actor': 18,
    Writer: 16,
    Cinematographer: 10,
    Composer: 10,
    Editor: 8,
    'VFX Supervisor': 8,
    'Casting Director': 8,
  };

  return clamp(
    Math.round(
      base[role] +
      fame * fameInfluence[role] +
      randFloat(rng, -20, 20),
    ),
    1,
    100,
  );
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
 * Every generated person has exactly one career (see PERSON_MODEL_REDESIGN.md
 * Phase 4 - multiple careers are only ever hand-authored, never generated).
 */
function generateTalent(role: TalentProfession, rng: RandomFn, t: number): Person {
  const profile = ROLE_GENERATION_PROFILES[role];
  const salary = Math.round(logAmount(t, profile.salaryRange) / 1000) * 1000;

  const fame = generateFame(role, rng, t);

  const reliabilityMean = 45 + 25 * t;
  const reliability = clamp(Math.round(reliabilityMean + randFloat(rng, -30, 30)), 1, 100);

  const ego = generateEgo(role, rng, fame);

  const roleCareerCommon = {
    active: true,
    roleReputation: fame,
    minimumSalary: salary,
    typicalSalary: salary,
  };

  let careers: PersonCareers;
  if (role === 'Director') {
    const skill = generateSkill(rng, t);
    careers = {
      director: {
        role,
        ...roleCareerCommon,
        experience: skill,
        skill,
        toneProfile: generateToneProfile(rng),
        productionStyle: generateProductionStyle(rng),
      },
    };
  } else if (role === 'Actor') {
    const actingStyle = generateActingStyle(rng);
    careers = {
      actor: {
        role,
        ...roleCareerCommon,
        experience: Math.round((actingStyle.characterTransformation + actingStyle.emotionalPerformance + actingStyle.charisma + actingStyle.comedy + actingStyle.physicalPerformance) / 5),
        actingStyle,
      },
    };
  } else {
    const skill = generateSkill(rng, t);
    careers = { [CREW_CAREER_KEY[role]]: { role, ...roleCareerCommon, experience: skill, skill } };
  }

  return {
    id: `talent-${nextTalentId++}`,
    identity: { name: randomName(rng), gender: generateGender(rng), dateOfBirth: generateDateOfBirth(rng), appearanceTags: [] },
    personality: {
      professionalism: reliability,
      ambition: 50,
      loyalty: 50,
      ego,
      temperament: 50,
      pressureHandling: 50,
      controversy: 20,
      adaptability: 50,
    },
    reputation: { fame, prestige: fame, industryRespect: reliability, reliability, currentHeat: fame },
    primaryRole: role,
    careers,
    availability: { commitments: [] },
    traits: [],
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
export function generateTalentCandidates(role: TalentProfession, rng: RandomFn, count = 100, tRange: [number, number] = [0, 1]): Person[] {
  const [tMin, tMax] = tRange;
  return Array.from({ length: count }, (_, i) => {
    const bandStart = tMin + (i / count) * (tMax - tMin);
    const bandEnd = tMin + ((i + 1) / count) * (tMax - tMin);
    const t = randFloat(rng, bandStart, bandEnd);
    return generateTalent(role, rng, t);
  });
}

// Below this salary, an actor is background/extras-tier - nobody a player
// would recognize by name, so a procedurally generated unknown reads as
// authentic rather than a gap in the handcrafted roster. Above it, every
// actor is hand-authored (see the comment in the loop below).
const BUDGET_ACTOR_SALARY_CEILING = 300_000;
const BUDGET_ACTOR_POOL_SIZE = 150;

/** The full studio roster: every role's candidate slate, generated once. */
export function generateTalentPool(
  rng: RandomFn,
): Record<TalentProfession, Person[]> {
  const pool = {} as Record<TalentProfession, Person[]>;

  for (const role of ALL_TALENT_PROFESSIONS) {
    const handcrafted = HANDCRAFTED_TALENTS_BY_ROLE[role] ?? [];

    // Every recognizable actor is hand-authored now, real name and
    // realistic stats - but the handcrafted roster doesn't reach down into
    // background/extras-tier pay, so procedural generation is kept around
    // just for that bottom slice of the market, capped below
    // BUDGET_ACTOR_SALARY_CEILING so it never produces a "random" A-lister.
    if (role === 'Actor') {
      const budgetTMax = logT(BUDGET_ACTOR_SALARY_CEILING, ROLE_GENERATION_PROFILES.Actor.salaryRange);
      pool[role] = [
        ...handcrafted,
        ...generateTalentCandidates(role, rng, BUDGET_ACTOR_POOL_SIZE, [0, budgetTMax]),
      ];
      continue;
    }

    pool[role] = [...handcrafted, ...generateTalentCandidates(role, rng)];
  }

  return pool;
}
