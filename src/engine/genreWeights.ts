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
const AVG_PRODUCTION_IMPORTANCE = average(ALL_PROFILES.map(productionImportance));

/**
 * Final Quality Score weights, tilted per genre instead of fixed for every
 * film - a Drama leans hard on script+acting and barely on production; an
 * Action film is close to the reverse. Only script, acting and production
 * flex (production's "importance" is derived from the genre's existing
 * vfxImportance/practicalEffectsImportance rather than a new field -
 * genres that lean on effects also lean on production quality at the top
 * level). Direction, post-production and random-events stay at their base
 * share. Everything is then renormalized so the six weights always sum to
 * 1 exactly, regardless of how extreme a genre's importance values are.
 */
export function computeQualityWeights(genre: Genre): QualityWeights {
  const profile = GENRE_PROFILES[genre];

  const raw: QualityWeights = {
    script: BASE_QUALITY_WEIGHTS.script * (profile.scriptImportance / AVG_SCRIPT_IMPORTANCE),
    acting: BASE_QUALITY_WEIGHTS.acting * (profile.actingImportance / AVG_ACTING_IMPORTANCE),
    production: BASE_QUALITY_WEIGHTS.production * (productionImportance(profile) / AVG_PRODUCTION_IMPORTANCE),
    direction: BASE_QUALITY_WEIGHTS.direction,
    postProduction: BASE_QUALITY_WEIGHTS.postProduction,
    randomEvents: BASE_QUALITY_WEIGHTS.randomEvents,
  };

  const total = raw.script + raw.direction + raw.acting + raw.postProduction + raw.production + raw.randomEvents;

  return {
    script: raw.script / total,
    direction: raw.direction / total,
    acting: raw.acting / total,
    postProduction: raw.postProduction / total,
    production: raw.production / total,
    randomEvents: raw.randomEvents / total,
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
