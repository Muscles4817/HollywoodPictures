// Rival franchising (Sequels & Franchises stage 3). Rivals build and milk
// franchises the same way the player does - a hit becomes an IP, and later
// entries inherit its pre-sold recognition - so the world (and the box-office
// calibration harness) is populated with franchise entries on both sides of the
// market, not just the player's. Everything here is the rival analogue of the
// player's own machinery:
//   - establish  <-> the player promoting a released Film to an IP (promoteFilmToIp)
//   - grow       <-> the player's flywheel (recordFranchiseEntries)
//   - sequelize  <-> the player's DEVELOP_SEQUEL (generateSequelScript)
// A rival franchise IS an IntellectualProperty (reusing the type and its
// promotion/derivation code); the rival just owns it on RivalStudio.franchises
// instead of Studio.intellectualProperties, and drives it automatically rather
// than by player action.
import type { Film, GameDay, IntellectualProperty, RivalStudio, StudioTier } from '../types';
import { promoteFilmToIp, deriveFilmRecognition, grownFranchiseRecognition } from './intellectualProperty';
import { randFloat, weightedPick, type RandomFn } from './random';

/** A finished rival hit this recognisable (0-100) is worth turning into a franchise. A genuine hit, not a middling release. Tunable for stage-4 calibration. */
export const RIVAL_FRANCHISE_ESTABLISH_RECOGNITION = 68;
/** How many franchises one rival will run at once - keeps even a prolific Major from franchising every hit. */
export const RIVAL_MAX_FRANCHISES_PER_STUDIO = 3;
/** Per-tier chance that a rival with a franchise spends a production slot on a sequel rather than bidding on a fresh script - Majors lean on franchises hardest, the way real tentpole studios do. Tunable for stage-4 calibration. */
export const RIVAL_SEQUEL_PROBABILITY_BY_TIER: Record<StudioTier, number> = {
  Indie: 0.3,
  'Mid-Size': 0.4,
  Major: 0.55,
};

/**
 * Establishes a new franchise on any rival whose latest finished film was a real
 * hit (recognition >= threshold) and isn't already a franchise entry, capped per
 * studio. Deterministic and rng-free (so it never shifts the shared rng stream):
 * one franchise per rival per pass, from its single strongest eligible hit,
 * promoted via the same promoteFilmToIp the player uses. Idempotent - a film
 * that is already a franchise source is skipped (its id is seeded into filmIds at
 * promotion), so re-seeing it never re-establishes. Returns the same array when
 * nothing changed.
 */
export function establishRivalFranchises(rivals: RivalStudio[], rivalFilms: Film[], today: GameDay): RivalStudio[] {
  // Only finished originals (not existing franchise entries) are candidates.
  const finished = rivalFilms.filter((f) => f.releasedBy !== undefined && f.boxOfficeRun.status === 'finished' && f.franchiseId === undefined);
  if (finished.length === 0) return rivals;

  let changed = false;
  const next = rivals.map((rival) => {
    const existing = rival.franchises ?? [];
    if (existing.length >= RIVAL_MAX_FRANCHISES_PER_STUDIO) return rival;
    const sources = new Set(existing.map((fr) => fr.sourceFilmId));
    const hits = finished.filter(
      (f) => f.releasedBy === rival.name && !sources.has(f.id) && deriveFilmRecognition(f) >= RIVAL_FRANCHISE_ESTABLISH_RECOGNITION,
    );
    if (hits.length === 0) return rival;
    const best = hits.reduce((a, b) => (deriveFilmRecognition(b) > deriveFilmRecognition(a) ? b : a));
    const characterIds = best.script.cast.filter((c) => c.prominence === 'Lead' || c.prominence === 'Supporting').map((c) => c.id);
    const franchise = promoteFilmToIp(best, characterIds, best.title, today);
    changed = true;
    return { ...rival, franchises: [...existing, franchise] };
  });
  return changed ? next : rivals;
}

/**
 * The rival flywheel: folds every finished franchise entry back into its
 * franchise - appending the Film and growing recognition by the entry's reach,
 * exactly like the player's recordFranchiseEntries. A film is matched to its
 * franchise via Film.franchiseId (the rival analogue of Asset.ipId). Idempotent
 * over the run's settlement passes and rng-free. Returns the same array when
 * nothing changed.
 */
export function growRivalFranchises(rivals: RivalStudio[], rivalFilms: Film[]): RivalStudio[] {
  const entries = rivalFilms.filter((f) => f.boxOfficeRun.status === 'finished' && f.franchiseId !== undefined);
  if (entries.length === 0) return rivals;

  let changed = false;
  const next = rivals.map((rival) => {
    if (!rival.franchises || rival.franchises.length === 0) return rival;
    let touched = false;
    const franchises = rival.franchises.map((fr) => {
      const owned = new Set(fr.filmIds);
      const fresh = entries.filter((f) => f.franchiseId === fr.id && !owned.has(f.id));
      if (fresh.length === 0) return fr;
      touched = true;
      let recognition = fr.recognition;
      const filmIds = [...fr.filmIds];
      for (const film of fresh) {
        filmIds.push(film.id);
        recognition = grownFranchiseRecognition(recognition, deriveFilmRecognition(film));
      }
      return { ...fr, filmIds, recognition };
    });
    if (!touched) return rival;
    changed = true;
    return { ...rival, franchises };
  });
  return changed ? next : rivals;
}

/**
 * Decides whether this rival spends the current production slot on a franchise
 * sequel, and which franchise - rolled against its tier's sequel probability,
 * then weighted by recognition (a bigger franchise gets milked harder). Returns
 * the chosen franchise, or null to fall through to normal bidding. Only ever
 * draws rng when the rival actually owns a franchise, so it never disturbs the
 * shared stream for the franchise-less rivals that dominate early play.
 */
export function chooseRivalFranchiseToSequelize(rival: RivalStudio, rng: RandomFn): IntellectualProperty | null {
  const franchises = rival.franchises ?? [];
  if (franchises.length === 0) return null;
  if (randFloat(rng, 0, 1) >= RIVAL_SEQUEL_PROBABILITY_BY_TIER[rival.tier]) return null;
  if (franchises.length === 1) return franchises[0];
  const weights: Record<string, number> = {};
  for (const fr of franchises) weights[fr.id] = Math.max(1, fr.recognition);
  const chosenId = weightedPick(rng, franchises.map((fr) => fr.id), weights);
  return franchises.find((fr) => fr.id === chosenId) ?? null;
}
