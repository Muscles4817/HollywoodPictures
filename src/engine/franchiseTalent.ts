// Franchise talent continuity - who worked on an IP's earlier entries, so the
// hiring drawer can flag returning cast & crew when casting a sequel (rather
// than making the player remember who played the lead last time). Reads the
// prior films' own TalentAssignments; nothing new is stored on the IP for this.
//
// A player film is tied to its IP through its source Asset: the draft carries
// `assetId`, that Asset carries `ipId` (set when a sequel development delivers,
// engine/sequelDevelopment.ts), and the IP lists every entry in `filmIds`.
import type { Film, FilmDraft, IntellectualProperty, ProductionRole, Studio } from '../types';

/** How one person is tied to a franchise's history - their most recent prior entry and role. */
export interface FranchiseReturner {
  role: ProductionRole;
  filmTitle: string;
  /** The character they played, for an actor with a resolved character assignment. */
  characterName?: string;
}

/** Who played a given returning character most recently across an IP's entries. */
export interface CharacterReprisal {
  personId: string;
  personName: string;
  filmTitle: string;
}

export interface FranchiseTalentHistory {
  ipName: string;
  /** Person id -> their most recent prior tie to this franchise (newest entry wins). */
  byPersonId: Map<string, FranchiseReturner>;
  /** Character name (as written) -> the actor who most recently played them. Lets a sequel's returning role reconnect to its original actor without any stored actor<->IP link. */
  reprisalByCharacterName: Map<string, CharacterReprisal>;
}

/** The IntellectualProperty this draft is a new entry in (draft.assetId -> Asset.ipId -> IP), or null for an original / an un-linked draft. */
export function findDraftFranchiseIp(draft: FilmDraft, studio: Studio): IntellectualProperty | null {
  const asset = studio.assets.find((a) => a.id === draft.assetId);
  if (!asset?.ipId) return null;
  return studio.intellectualProperties.find((ip) => ip.id === asset.ipId) ?? null;
}

/**
 * Builds the franchise's talent history from the IP's prior entries. Films are
 * walked oldest -> newest so the most recent appearance wins for both the
 * per-person tie and the per-character reprisal - a role recast between entries
 * maps to whoever last held it. Character names come from each film's own script
 * cast (via the assignment's characterId); crew and un-charactered actors still
 * appear in `byPersonId` for the general "returning" flag.
 */
export function deriveFranchiseTalentHistory(ip: IntellectualProperty, films: Film[]): FranchiseTalentHistory {
  const ipFilms = films
    .filter((f) => ip.filmIds.includes(f.id))
    .sort((a, b) => a.releasedOnDay - b.releasedOnDay);

  const byPersonId = new Map<string, FranchiseReturner>();
  const reprisalByCharacterName = new Map<string, CharacterReprisal>();

  for (const film of ipFilms) {
    for (const assignment of film.talent) {
      const characterName = assignment.characterId
        ? film.script.cast.find((c) => c.id === assignment.characterId)?.name
        : undefined;
      byPersonId.set(assignment.person.id, { role: assignment.role, filmTitle: film.title, characterName });
      if (characterName) {
        reprisalByCharacterName.set(characterName, {
          personId: assignment.person.id,
          personName: assignment.person.identity.name,
          filmTitle: film.title,
        });
      }
    }
  }

  return { ipName: ip.name, byPersonId, reprisalByCharacterName };
}
