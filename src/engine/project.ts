import type { Asset, Film, FilmDraft, Project, RivalProductionInProgress } from '../types';

/**
 * The one stable identity a Project carries for its entire life, regardless
 * of which variant it currently is - see types/index.ts:Project for why
 * this exists (architecture roadmap Phase 3, fixing the three-way storage/
 * two-id-scheme fragmentation the architecture audit's Identity #1 found).
 */
export function projectId(project: Project): string {
  switch (project.kind) {
    case 'player-in-progress': return project.draft.id;
    case 'scheduled': return project.draft.id;
    case 'rival-in-progress': return project.production.id;
    case 'released': return project.film.id;
  }
}

// --- Wrap an existing shape as a Project - purely additive, no data changes ---

export function playerDraftToProject(draft: FilmDraft): Project {
  return { kind: 'player-in-progress', draft };
}

export function scheduledDraftToProject(draft: FilmDraft, releaseDay: number): Project {
  return { kind: 'scheduled', draft, releaseDay };
}

export function rivalProductionToProject(production: RivalProductionInProgress): Project {
  return { kind: 'rival-in-progress', production };
}

export function filmToProject(film: Film): Project {
  return { kind: 'released', film };
}

// --- Narrow a Project back to its underlying shape, or null if it's a
// different variant (or there's no Project at all - accepting `| null` here
// lets every call site compose directly with findProject below without its
// own null check first) ---

export function asPlayerDraft(project: Project | null): FilmDraft | null {
  return project?.kind === 'player-in-progress' ? project.draft : null;
}

export function asScheduled(project: Project | null): { draft: FilmDraft; releaseDay: number } | null {
  return project?.kind === 'scheduled' ? { draft: project.draft, releaseDay: project.releaseDay } : null;
}

export function asRivalProduction(project: Project | null): RivalProductionInProgress | null {
  return project?.kind === 'rival-in-progress' ? project.production : null;
}

export function asFilm(project: Project | null): Film | null {
  return project?.kind === 'released' ? project.film : null;
}

// --- Query helpers over the flat Project[] store (roadmap Phase 5) --------

/** By-id lookup - the one place every "which project is this action/screen about" resolution goes through. */
export function findProject(projects: Project[], id: string | null | undefined): Project | null {
  if (!id) return null;
  return projects.find((p) => projectId(p) === id) ?? null;
}

/** Every released film that's the player's own (no `releasedBy` - see types/index.ts:Film). */
export function playerReleasedFilms(projects: Project[]): Film[] {
  return projects.flatMap((p) => {
    const film = asFilm(p);
    return film && film.releasedBy === undefined ? [film] : [];
  });
}

/** Every released film that's a rival's (`releasedBy` set - see engine/rivalStudios.ts). */
export function rivalReleasedFilms(projects: Project[]): Film[] {
  return projects.flatMap((p) => {
    const film = asFilm(p);
    return film && film.releasedBy !== undefined ? [film] : [];
  });
}

export function rivalProductionsInProgress(projects: Project[]): RivalProductionInProgress[] {
  return projects.flatMap((p) => {
    const production = asRivalProduction(p);
    return production ? [production] : [];
  });
}

/**
 * Every player-in-progress draft EXCEPT `excludeId` - the "backgrounded"
 * subset (Studio.productionsInProgress before Phase 5) once the currently-
 * focused one (GameState.focusedProjectId, the live wizard/ProductionRun
 * draft) is pulled out separately. Pass `null` to get every player-in-
 * progress draft with none excluded. Deliberately does not include
 * 'scheduled' projects - their photography/post-production are locked, so
 * they have nothing left for settleProductionsInProgress to advance; see
 * scheduledPlayerReleases below for their own dedicated extraction.
 */
export function backgroundedPlayerDrafts(projects: Project[], excludeId: string | null): FilmDraft[] {
  return projects.flatMap((p) => {
    const draft = asPlayerDraft(p);
    return draft && draft.id !== excludeId ? [draft] : [];
  });
}

/** Every player project waiting on its own releaseDay to arrive (roadmap Phase 7.2) - see engine/scheduledReleases.ts. */
export function scheduledPlayerReleases(projects: Project[]): Array<{ draft: FilmDraft; releaseDay: number }> {
  return projects.flatMap((p) => {
    const s = asScheduled(p);
    return s ? [s] : [];
  });
}

// --- Development pipeline (docs/DESIGN_REVIEW_development_pipeline.md) ---

/** Which Asset a Project was developed from, regardless of which kind it's currently in - null for a rival production (rivals don't go through the Asset pipeline in this MVP) or a released film with no recorded asset (an old save, or a rival's). */
export function assetIdOfProject(project: Project): string | null {
  switch (project.kind) {
    case 'player-in-progress': return project.draft.assetId;
    case 'scheduled': return project.draft.assetId;
    case 'released': return project.film.assetId ?? null;
    case 'rival-in-progress': return null;
  }
}

export type AssetStatus =
  | { status: 'available' }
  | { status: 'in-development'; projectId: string }
  | { status: 'used'; projectIds: string[] };

/**
 * Derived purely from whether any Project currently references this Asset -
 * Asset itself carries no status flag, same "derive, don't duplicate"
 * discipline this file already uses for everything else (deriveProjectsView's
 * old job, playerReleasedFilms, etc.). "in-development" beats "used": a
 * second attempt from an asset that already produced one released film
 * still counts as in-development while it's active. "used" only shows once
 * nothing is currently active - the asset generated one or more films and
 * is free to try again.
 */
export function deriveAssetStatus(asset: Asset, projects: Project[]): AssetStatus {
  const own = projects.filter((p) => assetIdOfProject(p) === asset.id);
  const active = own.find((p) => p.kind === 'player-in-progress' || p.kind === 'scheduled');
  if (active) return { status: 'in-development', projectId: projectId(active) };
  const releasedIds = own.filter((p) => p.kind === 'released').map(projectId);
  if (releasedIds.length > 0) return { status: 'used', projectIds: releasedIds };
  return { status: 'available' };
}
