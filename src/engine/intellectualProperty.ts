// First IP-layer milestone (see types/index.ts:IntellectualProperty). Promotes
// a released Film into a persistent IP on demand - it lifts the player's chosen
// Characters and the Film's Setting out into globally-identified components and
// references the source Film by id, never copying or wrapping the Film itself.
import type { Film, GameDay, IntellectualProperty, IpCharacter, IpCharacterStanding, ScriptCharacter, Studio } from '../types';
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
  };
}
