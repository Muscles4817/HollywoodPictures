import type { Genre } from '../types';
import { GENRE_PROFILES, type GenreProfile } from '../data/genres';
import { BASE_QUALITY_WEIGHTS, type QualityWeights } from '../data/scoringWeights';

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** A genre's VFX and practical-effects importance collapsed into one production-importance figure. */
export function productionImportance(profile: GenreProfile): number {
  return (profile.vfxImportance + profile.practicalEffectsImportance) / 2;
}

// Cross-genre averages, computed once from the live genre data rather than
// hardcoded, so retuning data/genres.ts automatically keeps every genre
// centered around the same base - a genre with exactly average importance
// gets exactly BASE_QUALITY_WEIGHTS back, unchanged.
const ALL_PROFILES = Object.values(GENRE_PROFILES);
const AVG_SCRIPT_IMPORTANCE = average(ALL_PROFILES.map((p) => p.scriptImportance));
const AVG_ACTING_IMPORTANCE = average(ALL_PROFILES.map((p) => p.actingImportance));

/**
 * Final Quality Score weights, tilted per genre instead of fixed for every
 * film - a Drama leans hard on script+acting, an Action film barely does.
 * Only script and acting flex; direction and post-production stay at their
 * base share. Production isn't a top-level weight any more - its influence
 * flows entirely through the "captured footage" ceiling in
 * engine/scoring.ts:computeQualityBreakdown, genre-neutral for now (see that
 * file's dependency-chain comment for the known gap this leaves - a VFX-
 * heavy genre no longer gets extra top-level weight on Production the way
 * it used to). Everything is renormalized so the four weights always sum to
 * 1 exactly, regardless of how extreme a genre's importance values are.
 */
export function computeQualityWeights(genre: Genre): QualityWeights {
  const profile = GENRE_PROFILES[genre];

  const raw: QualityWeights = {
    script: BASE_QUALITY_WEIGHTS.script * (profile.scriptImportance / AVG_SCRIPT_IMPORTANCE),
    acting: BASE_QUALITY_WEIGHTS.acting * (profile.actingImportance / AVG_ACTING_IMPORTANCE),
    direction: BASE_QUALITY_WEIGHTS.direction,
    postProduction: BASE_QUALITY_WEIGHTS.postProduction,
  };

  const total = raw.script + raw.direction + raw.acting + raw.postProduction;

  return {
    script: raw.script / total,
    direction: raw.direction / total,
    acting: raw.acting / total,
    postProduction: raw.postProduction / total,
  };
}

/**
 * Which craft department a genre leans on hardest - script, acting, or
 * production (VFX/practical effects combined). Used to pick genre-flavored
 * review commentary: praise or criticism lands harder when it's aimed at the
 * department a genre's audience actually cares about (e.g. cheap effects
 * sting more on a Sci-Fi film than a Drama).
 */
export function genreSignatureDepartment(genre: Genre): 'script' | 'acting' | 'production' {
  const profile = GENRE_PROFILES[genre];
  const scores: Record<'script' | 'acting' | 'production', number> = {
    script: profile.scriptImportance,
    acting: profile.actingImportance,
    production: productionImportance(profile),
  };
  return (Object.keys(scores) as Array<'script' | 'acting' | 'production'>).reduce((best, key) =>
    scores[key] > scores[best] ? key : best,
  );
}
