import { describe, it, expect } from 'vitest';
import {
  projectId,
  playerDraftToProject,
  rivalProductionToProject,
  filmToProject,
  asPlayerDraft,
  asRivalProduction,
  asFilm,
  playerReleasedFilms,
  deriveInboxItems,
  inboxBadgeCount,
} from './project';
import { studioReducer } from '../state/studioReducer';
import { buildStateWithReadyDraft, buildReadyDraft, buildReadyAsset } from '../state/testFixtures';
import { openCastingCall } from './castingCalls';
import { withRng } from './random';
import type { Film, FilmDraft, RivalProductionInProgress } from '../types';

function sampleDraft(): FilmDraft {
  return withRng(1, (rng) => buildReadyDraft(rng)).result;
}

function sampleFilm(): Film {
  const released = studioReducer(buildStateWithReadyDraft(2), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
  return playerReleasedFilms(released.projects)[0];
}

function sampleRivalProduction(): RivalProductionInProgress {
  const draft = sampleDraft();
  return {
    id: 'rival-prod-sample-1',
    rivalStudioId: 'rival-studio-0',
    scale: 'Medium',
    genre: draft.genre!,
    script: draft.script!,
    talent: draft.talent,
    productionChoices: draft.productionChoices!,
    postProductionChoices: draft.postProductionChoices!,
    marketingChoices: draft.marketingChoices!,
    targetAudience: draft.targetAudience!,
    releaseDay: 120,
  };
}

describe('project.ts - wrapping is a pure, lossless round trip', () => {
  it('playerDraftToProject/asPlayerDraft round-trips a FilmDraft exactly, and projectId is the draft id', () => {
    const draft = sampleDraft();
    const project = playerDraftToProject(draft);
    expect(project.kind).toBe('player-in-progress');
    expect(asPlayerDraft(project)).toBe(draft); // same reference - wrapping copies nothing
    expect(projectId(project)).toBe(draft.id);
  });

  it('rivalProductionToProject/asRivalProduction round-trips a RivalProductionInProgress exactly, and projectId is the production id', () => {
    const production = sampleRivalProduction();
    const project = rivalProductionToProject(production);
    expect(project.kind).toBe('rival-in-progress');
    expect(asRivalProduction(project)).toBe(production);
    expect(projectId(project)).toBe(production.id);
  });

  it('filmToProject/asFilm round-trips a Film exactly, and projectId is the film id', () => {
    const film = sampleFilm();
    const project = filmToProject(film);
    expect(project.kind).toBe('released');
    expect(asFilm(project)).toBe(film);
    expect(projectId(project)).toBe(film.id);
  });

  it('narrowing to the wrong shape returns null, not a crash or a silently-wrong value', () => {
    const draftProject = playerDraftToProject(sampleDraft());
    expect(asRivalProduction(draftProject)).toBeNull();
    expect(asFilm(draftProject)).toBeNull();

    const rivalProject = rivalProductionToProject(sampleRivalProduction());
    expect(asPlayerDraft(rivalProject)).toBeNull();
    expect(asFilm(rivalProject)).toBeNull();

    const filmProject = filmToProject(sampleFilm());
    expect(asPlayerDraft(filmProject)).toBeNull();
    expect(asRivalProduction(filmProject)).toBeNull();
  });
});

/** An uncast draft (buildReadyDraft's own cast cleared - a filled slot would make the call's Character read as already-cast and inert) with one Open Casting call already carrying an applicant, on its Lead Character. */
function draftWithPendingCastingApplicant(seed: number, id: string): FilmDraft {
  const asset = withRng(seed, (rng) => buildReadyAsset(rng)).result;
  const base = withRng(seed, (rng) => buildReadyDraft(rng)).result;
  const [applicant] = withRng(seed + 100, (rng) => buildReadyDraft(rng)).result.talent.map((a) => a.person);
  const leadCharacter = asset.script.cast.find((c) => c.prominence === 'Lead')!;
  const call = { ...openCastingCall(leadCharacter.id, 'Lead Actor', 1), applicants: [{ person: applicant, appliedOnDay: 1 }] };
  // buildReadyDraft sets photography to a finished shoot (it's meant for
  // release-flow tests) - castingCallsAwaitingReview is scoped to
  // still-in-Development drafts, so this needs clearing back to null.
  return { ...base, id, script: asset.script, talent: [], photography: null, castingCalls: [call] };
}

// deriveInboxItems/inboxBadgeCount is the one canonical derivation both
// components/common/Header.tsx's badge and components/common/Inbox.tsx's
// own rendering read - added after the two briefly drifted apart (the
// badge undercounted new Casting Redesign applicants because Inbox.tsx
// grew its own local 'casting' category without this shared function
// knowing about it).
describe('deriveInboxItems / inboxBadgeCount', () => {
  it('counts a backgrounded, still-in-Development draft with a new casting applicant', () => {
    const draft = draftWithPendingCastingApplicant(1, 'draft-uncast');
    const projects = [playerDraftToProject(draft)];
    const items = deriveInboxItems(projects, null);
    expect(items.casting).toHaveLength(1);
    expect(items.casting[0].production.id).toBe(draft.id);
    expect(inboxBadgeCount(projects, null)).toBe(1);
  });

  it('excludes the currently-focused draft, same as every other category', () => {
    const draft = draftWithPendingCastingApplicant(2, 'draft-focused');
    const projects = [playerDraftToProject(draft)];
    expect(deriveInboxItems(projects, draft.id).casting).toEqual([]);
    expect(inboxBadgeCount(projects, draft.id)).toBe(0);
  });

  it('inboxBadgeCount always equals the sum of every deriveInboxItems category', () => {
    const projects = [playerDraftToProject(draftWithPendingCastingApplicant(3, 'draft-a')), playerDraftToProject(sampleDraft())];
    const items = deriveInboxItems(projects, null);
    const total = items.awaitingChoice.length + items.wrapped.length + items.parked.length + items.casting.length;
    expect(inboxBadgeCount(projects, null)).toBe(total);
  });
});
