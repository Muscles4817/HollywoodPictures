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
} from './project';
import { studioReducer } from '../state/studioReducer';
import { buildStateWithReadyDraft, buildReadyDraft } from '../state/testFixtures';
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
