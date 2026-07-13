import type { Film, FilmDraft, Project, RivalProductionInProgress } from '../types';

/**
 * The one stable identity a Project carries for its entire life, regardless
 * of which variant it currently is - see types/index.ts:Project for why
 * this exists (architecture roadmap Phase 3, fixing the three-way storage/
 * two-id-scheme fragmentation the architecture audit's Identity #1 found).
 */
export function projectId(project: Project): string {
  switch (project.kind) {
    case 'player-in-progress': return project.draft.id;
    case 'rival-in-progress': return project.production.id;
    case 'released': return project.film.id;
  }
}

// --- Wrap an existing shape as a Project - purely additive, no data changes ---

export function playerDraftToProject(draft: FilmDraft): Project {
  return { kind: 'player-in-progress', draft };
}

export function rivalProductionToProject(production: RivalProductionInProgress): Project {
  return { kind: 'rival-in-progress', production };
}

export function filmToProject(film: Film): Project {
  return { kind: 'released', film };
}

// --- Narrow a Project back to its underlying shape, or null if it's a different variant ---

export function asPlayerDraft(project: Project): FilmDraft | null {
  return project.kind === 'player-in-progress' ? project.draft : null;
}

export function asRivalProduction(project: Project): RivalProductionInProgress | null {
  return project.kind === 'rival-in-progress' ? project.production : null;
}

export function asFilm(project: Project): Film | null {
  return project.kind === 'released' ? project.film : null;
}
