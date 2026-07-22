// First IP-layer milestone (see types/index.ts:IntellectualProperty). Promotes
// a released Film into a persistent IP on demand - it lifts the player's chosen
// Characters and the Film's Setting out into globally-identified components and
// references the source Film by id, never copying or wrapping the Film itself.
import type { Film, GameDay, IntellectualProperty, IpCharacter, Studio } from '../types';

/** The IP the studio has already promoted from this Film, if any - drives both the re-promotion guard (reducer) and the "already an IP" readout (Film dossier). A Film is the source of at most one IP. */
export function ipForSourceFilm(studio: Studio, filmId: string): IntellectualProperty | undefined {
  return studio.intellectualProperties.find((ip) => ip.sourceFilmId === filmId);
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
  const characters: IpCharacter[] = film.script.cast
    .filter((c) => wanted.has(c.id))
    .map((c) => ({
      id: ipCharacterId(film.id, c.id),
      sourceFilmId: film.id,
      sourceCharacterId: c.id,
      name: c.name,
      archetype: c.archetype,
      prominence: c.prominence,
      castingGender: c.castingGender,
      traits: c.traits,
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
  };
}
