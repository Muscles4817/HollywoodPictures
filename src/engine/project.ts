import type { Asset, CastingCall, Film, FilmDraft, Project, RivalProductionInProgress } from '../types';
import { castingCallsAwaitingReview } from './castingCalls';

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

/**
 * Every backgrounded draft actually worth surfacing in the Inbox, grouped
 * by why - the one canonical derivation both components/common/Header.tsx's
 * badge count and components/common/Inbox.tsx's own rendering read, so the
 * two can never quietly drift apart again the way they once did (the badge
 * undercounted new casting applicants for a stretch because Inbox.tsx grew
 * its own 'casting' category locally without this shared function knowing
 * about it). A draft still mid-shoot ('in-progress') never contributes
 * anything here - only one paused on an on-set choice, fully wrapped, or
 * still in Development with new Casting Redesign applicants waiting does.
 */
export interface InboxItems {
  awaitingChoice: FilmDraft[];
  wrapped: FilmDraft[];
  parked: FilmDraft[];
  casting: Array<{ production: FilmDraft; calls: CastingCall[] }>;
  /** Scheduled (not-yet-released) films with a fired-but-unanswered press-tour incident awaiting a response (the interactive layer). Sourced from 'scheduled' projects, which backgroundedPlayerDrafts deliberately excludes. */
  pressTourIncidents: FilmDraft[];
  /** The player's own films that have opened but whose Premiere Reveal the player hasn't watched yet (Film.boxOfficeRun.premiereSeen === false) - a background-settled scheduled release never lands on the results screen, so this is where the "now playing, watch the premiere" moment surfaces instead. */
  nowPlaying: Film[];
  /** The player's own films whose theatrical run has ended but whose final breakdown the player hasn't reviewed yet (Film.boxOfficeRun.acknowledged === false). Informational catch-up: it replaces the old blocking BoxOfficeFinishedPopup, and the Inbox routes it to the film's own dossier (components/common/FilmDetailModal.tsx) rather than reproducing the numbers. Unread until the player opens that dossier, which sets acknowledged (ACKNOWLEDGE_BOX_OFFICE_RESULTS). */
  boxOfficeFinished: Film[];
}

/**
 * Whether a parked film (photography wrapped, post-production choices locked)
 * is actually actionable - its mandatory test screening has come back AND no
 * re-cut is still in the editing bay, i.e. the player can genuinely schedule a
 * release day right now. A film merely *waiting* on its screening (or mid-recut)
 * is parked too, but there is nothing to do, so it must not light the Inbox
 * badge - it still renders an informational card in the Inbox. Mirrors the exact
 * branch components/common/Inbox.tsx uses to decide between the "just needs a
 * release day" (enabled) and the "still wrapping up / re-cut underway" (waiting)
 * copy.
 */
export function isParkedActionable(p: FilmDraft): boolean {
  return p.testScreeningResolved && p.postProductionEditingUntilDay == null;
}

export function deriveInboxItems(projects: Project[], excludeId: string | null): InboxItems {
  const productions = backgroundedPlayerDrafts(projects, excludeId);
  return {
    // Post-Production Redesign, Phase B - a pending test screening surfaces
    // here too, alongside an on-set pendingChoice, even for a project that
    // already has postProductionChoices set (the screening is calendar-
    // driven, independent of whether the player has ever opened the
    // Post-Production screen) - see components/common/Inbox.tsx, which picks
    // whichever of the two a given production actually has pending.
    awaitingChoice: productions.filter((p) => p.photography?.status === 'awaiting-choice' || p.testScreeningPendingChoice),
    wrapped: productions.filter((p) => p.photography?.status === 'finished' && !p.testScreeningPendingChoice && !p.postProductionChoices),
    parked: productions.filter((p) => p.photography?.status === 'finished' && !p.testScreeningPendingChoice && p.postProductionChoices),
    casting: productions
      .filter((p) => !p.photography)
      .map((p) => ({ production: p, calls: castingCallsAwaitingReview(p) }))
      .filter((c) => c.calls.length > 0),
    pressTourIncidents: scheduledPlayerReleases(projects)
      .map((s) => s.draft)
      .filter((d) => d.pressTourIncident),
    // The player's own opened films whose Premiere Reveal hasn't been watched
    // yet - a same-day release lands on the results screen and is marked seen
    // immediately (state/studioReducer.ts), so in practice this only ever holds
    // background-settled scheduled releases the player would otherwise never see
    // celebrated.
    nowPlaying: playerReleasedFilms(projects).filter((f) => f.boxOfficeRun.premiereSeen === false),
    // Finished theatrical runs the player hasn't reviewed yet - the informational
    // "box office closed" catch-up beat that replaced the blocking popup. Distinct
    // from nowPlaying (that's the opening; this is the run ending).
    boxOfficeFinished: playerReleasedFilms(projects).filter(
      (f) => f.boxOfficeRun.status === 'finished' && !f.boxOfficeRun.acknowledged,
    ),
  };
}

/** The Inbox badge count (components/common/Header.tsx) - the sum of every category deriveInboxItems groups that the player still needs to see. Mostly ACTIONABLE items; parked films still waiting on their test screening (or mid-recut) are deliberately excluded (they render an informational Inbox card but there is nothing the player can do, so they must not keep the badge lit). boxOfficeFinished is the one purely-informational category counted here: an unreviewed finished run is a "you missed a result" signal that should keep the badge lit until the player opens its dossier, the same way an unwatched premiere (nowPlaying) does. Awards highlights are counted separately in Header.tsx since they need the awards/acknowledgement state deriveInboxItems doesn't take. */
export function inboxBadgeCount(projects: Project[], excludeId: string | null): number {
  const items = deriveInboxItems(projects, excludeId);
  return (
    items.awaitingChoice.length +
    items.wrapped.length +
    items.parked.filter(isParkedActionable).length +
    items.casting.length +
    items.pressTourIncidents.length +
    items.nowPlaying.length +
    items.boxOfficeFinished.length
  );
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
