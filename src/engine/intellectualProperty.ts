// First IP-layer milestone (see types/index.ts:IntellectualProperty). Promotes
// a released Film into a persistent IP on demand - it lifts the player's chosen
// Characters and the Film's Setting out into globally-identified components and
// references the source Film by id, never copying or wrapping the Film itself.
import type { Asset, Film, GameDay, IntellectualProperty, IpCharacter, IpCharacterStanding, ScriptCharacter, Studio } from '../types';
import { clamp } from './random';

/** The IP the studio has already promoted from this Film, if any - drives both the re-promotion guard (reducer) and the "already an IP" readout (Film dossier). A Film is the source of at most one IP. */
export function ipForSourceFilm(studio: Studio, filmId: string): IntellectualProperty | undefined {
  return studio.intellectualProperties.find((ip) => ip.sourceFilmId === filmId);
}

// --- Historical-standing derivations (shared with engine/ipViability.ts) -----
//
// Recognition/prestige don't exist independently of a Film - they're read off
// the Film's own preserved results. Kept here (not in the evaluator) because
// promotion inherits them, and the evaluator reuses them for carryover.

/** A film's box-office magnitude as a 0-100 reach reading - roughly $2M -> 0, $1B -> 100 on a log scale. Falls back to whatever gross figure is known while a run is still settling. */
export function filmBoxOfficeReach(film: Film): number {
  const gross = film.results.totalBoxOffice ?? film.boxOfficeRun.cumulativeGross ?? film.results.openingWeekend ?? 0;
  if (gross <= 0) return 0;
  // log10: 2M ~= 6.3, 1B = 9. Map [6.3, 9] -> [0, 100].
  return clamp(((Math.log10(gross) - 6.3) / (9 - 6.3)) * 100, 0, 100);
}

/** How known a film is with audiences, 0-100 - audience approval, buzz, and sheer box-office reach. What an IP's Recognition is seeded from. */
export function deriveFilmRecognition(film: Film): number {
  return clamp(film.results.audienceScore * 0.45 + film.results.buzzScore * 0.25 + filmBoxOfficeReach(film) * 0.3, 0, 100);
}

/** A film's critical standing, 0-100 - what an IP's Prestige is seeded from. Critic-led (a beloved flop still reads high), consistent with how Studio Prestige itself is earned. */
export function deriveFilmPrestige(film: Film): number {
  return clamp(film.results.criticScore * 0.6 + film.results.qualityScore * 0.4, 0, 100);
}

const PROMINENCE_STANDING_FACTOR: Record<ScriptCharacter['prominence'], number> = {
  Lead: 1,
  Supporting: 0.65,
  Minor: 0.35,
};

/** A promoted character's starting standing - recognition scaled from the film's reach by how prominent the role was; popularity from the character's own appeal, lifted by the film's reach. Only ever an initial value (no evolution yet). */
export function deriveCharacterStanding(character: ScriptCharacter, filmRecognition: number): IpCharacterStanding {
  const prominenceFactor = PROMINENCE_STANDING_FACTOR[character.prominence];
  const appeal = character.traits.distinctiveness * 0.4 + character.traits.merchandisePotential * 0.3 + character.traits.audienceAccessibility * 0.3;
  return {
    recognition: clamp(filmRecognition * prominenceFactor, 0, 100),
    popularity: clamp(appeal * (0.55 + filmRecognition / 250), 0, 100),
  };
}

// Ids are derived from the source Film's id (globally unique) plus, for a
// character, its script-local id (unique within that Film) - so every promoted
// component gets a stable, globally-unique id without a mutable counter that a
// page reload could reset and collide. One IP per source Film (the reducer
// guards re-promotion), so `ip-<filmId>` never clashes either.
export function ipIdForFilm(filmId: string): string {
  return `ip-${filmId}`;
}
function ipCharacterId(filmId: string, sourceCharacterId: string): string {
  return `ipchar-${filmId}-${sourceCharacterId}`;
}
function ipSettingId(filmId: string): string {
  return `ipset-${filmId}`;
}

/**
 * Builds the IntellectualProperty for promoting `film`, lifting the Characters
 * whose script-local ids are in `characterIds` (any id not on the film's cast
 * is simply ignored) plus the film's primarySetting into persistent components.
 * `name` falls back to the film's own title when blank. Pure - the reducer owns
 * the affordability/guard/append side of promotion.
 */
export function promoteFilmToIp(film: Film, characterIds: string[], name: string, today: GameDay): IntellectualProperty {
  const wanted = new Set(characterIds);
  const recognition = deriveFilmRecognition(film);
  const prestige = deriveFilmPrestige(film);
  const characters: IpCharacter[] = film.script.cast
    .filter((c) => wanted.has(c.id))
    .map((c) => ({
      id: ipCharacterId(film.id, c.id),
      sourceFilmId: film.id,
      sourceCharacterId: c.id,
      name: c.name,
      prominence: c.prominence,
      castingGender: c.castingGender,
      castingAgeBand: c.castingAgeBand,
      archetype: c.archetype,
      traits: c.traits,
      standing: deriveCharacterStanding(c, recognition),
    }));

  return {
    id: ipIdForFilm(film.id),
    name: name.trim() || film.title,
    createdOnDay: today,
    sourceFilmId: film.id,
    filmIds: [film.id],
    characters,
    setting: {
      id: ipSettingId(film.id),
      sourceFilmId: film.id,
      archetype: film.script.primarySetting,
    },
    // Inherited from the Film's preserved historical success - never invented.
    recognition,
    prestige,
    genre: film.script.genre,
  };
}

// --- Franchise flywheel (Sequels & Franchises stage 2b) ----------------------
//
// A released franchise entry feeds back into its IP: the Film joins the IP's
// filmIds and the IP's recognition grows by the entry's own reach. This is what
// makes a franchise *compound* - each successful entry makes the next draw
// harder, because the next sequel inherits the grown recognition as its
// franchiseRecognition (the pre-sold draw deriveMarketability is dominated by).
// An entry is linked to its IP through its source Asset: a sequel Asset carries
// `ipId` (set when the development delivers), and the greenlit Film carries that
// Asset's id (Film.assetId).

/**
 * How strongly a finished franchise entry grows its IP's recognition. The entry
 * lifts awareness a fraction of the remaining gap to saturation (100), scaled by
 * the entry's own reach - a blockbuster sequel builds the brand hard, a quiet
 * one barely moves it, and a franchise near saturation gains little from one
 * more entry. Monotonic up: a weak entry never erodes the franchise (erosion is
 * a later refinement, not this stage). A tunable lever for stage-4 calibration.
 */
export const FRANCHISE_RECOGNITION_GAIN = 0.5;

/** Recognition after folding in a finished entry of the given reach (0-100). Never decreases; never exceeds 100. */
export function grownFranchiseRecognition(current: number, entryReach: number): number {
  const lift = FRANCHISE_RECOGNITION_GAIN * (entryReach / 100) * (100 - current);
  return clamp(Math.max(current, current + lift), 0, 100);
}

/**
 * The franchise flywheel: fold every newly-*finished* player film that belongs
 * to an IP back into that IP - appending the Film to `filmIds` and growing
 * `recognition` by the entry's reach (deriveFilmRecognition). A film is matched
 * to its IP through its source Asset's `ipId`. Idempotent: a film already in an
 * IP's filmIds is skipped, so re-seeing a finished entry every settlement pass
 * never double-counts it (the same membership guard
 * recordPlayerFilmCollaborations uses), and the IP's own source film - seeded
 * into filmIds at promotion - is a no-op here too. Only 'finished' runs are
 * folded, so recognition reads a settled box office, not a partial mid-run
 * gross. Returns the same array reference when nothing changed.
 */
export function recordFranchiseEntries(ips: IntellectualProperty[], playerFilms: Film[], assets: Asset[]): IntellectualProperty[] {
  if (ips.length === 0) return ips;
  const ipIdByAssetId = new Map<string, string>();
  for (const asset of assets) if (asset.ipId) ipIdByAssetId.set(asset.id, asset.ipId);
  if (ipIdByAssetId.size === 0) return ips;

  let changed = false;
  const next = ips.map((ip) => {
    const owned = new Set(ip.filmIds);
    const entries = playerFilms.filter(
      (f) => f.boxOfficeRun.status === 'finished' && f.assetId !== undefined && ipIdByAssetId.get(f.assetId) === ip.id && !owned.has(f.id),
    );
    if (entries.length === 0) return ip;
    changed = true;
    let recognition = ip.recognition;
    const filmIds = [...ip.filmIds];
    for (const film of entries) {
      filmIds.push(film.id);
      recognition = grownFranchiseRecognition(recognition, deriveFilmRecognition(film));
    }
    return { ...ip, filmIds, recognition };
  });
  return changed ? next : ips;
}
