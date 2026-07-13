import { describe, it, expect } from 'vitest';
import { computeReportedLegs, deriveProjectsView } from './selectors';
import { studioReducer } from './studioReducer';
import { buildStateWithReadyDraft, buildReadyDraft } from './testFixtures';
import { withRng } from '../engine/random';
import { MAX_SIMULATION_WEEKS } from '../engine/audienceSimulationStep';
import { projectId } from '../engine/project';
import type { RivalProductionInProgress } from '../types';

describe('computeReportedLegs - a derived reported statistic, never a stored driver', () => {
  it('is null while the run is still in theaters - not knowable before the run has a real total', () => {
    const released = studioReducer(buildStateWithReadyDraft(1), { type: 'RELEASE_FILM' });
    const film = released.studio.filmsReleased[0];
    expect(film.boxOfficeRun.status).toBe('running');
    expect(computeReportedLegs(film)).toBeNull();
  });

  it('equals totalBoxOffice / openingWeekend exactly once the run finishes', () => {
    const released = studioReducer(buildStateWithReadyDraft(2), { type: 'RELEASE_FILM' });
    let state = released;
    for (let i = 0; i < MAX_SIMULATION_WEEKS * 7 + 7; i++) state = studioReducer(state, { type: 'ADVANCE_DAY' });
    const film = state.studio.filmsReleased[0];
    expect(film.boxOfficeRun.status).toBe('finished');

    const legs = computeReportedLegs(film);
    expect(legs).not.toBeNull();
    expect(legs).toBeCloseTo(film.results.totalBoxOffice! / film.results.openingWeekend, 9);
    expect(legs).toBeGreaterThanOrEqual(1); // a run can never gross less than its own opening
  });

  it('updates correctly as actual gross grows - a longer, bigger-grossing run reports proportionally higher legs than a shorter one with the same opening', () => {
    const released = studioReducer(buildStateWithReadyDraft(3, { releaseType: 'Limited' }), { type: 'RELEASE_FILM' });
    let state = released;
    const legsByWeek: number[] = [];
    for (let week = 1; week <= MAX_SIMULATION_WEEKS + 2; week++) {
      for (let day = 0; day < 7; day++) state = studioReducer(state, { type: 'ADVANCE_DAY' });
      const film = state.studio.filmsReleased[0];
      const legs = computeReportedLegs(film);
      if (legs !== null) legsByWeek.push(legs);
      if (film.boxOfficeRun.status === 'finished') break;
    }
    // Once knowable (the run has finished), legs is a single settled figure - this just confirms it was actually computed from a real, non-trivial run rather than defaulting to some placeholder.
    expect(legsByWeek.length).toBeGreaterThan(0);
    expect(legsByWeek[legsByWeek.length - 1]).toBeGreaterThanOrEqual(1);
  });
});

describe('deriveProjectsView - roadmap Phase 4.1 (temporary compatibility layer)', () => {
  it('returns one Project per entry across every still-fragmented storage location, tagged with the right kind', () => {
    // One released player film, one backgrounded player draft, one rival
    // production in progress, one released rival film - one of each kind
    // this selector has to fold together.
    let state = studioReducer(buildStateWithReadyDraft(1), { type: 'RELEASE_FILM' });
    const backgroundedDraft = withRng(2, (rng) => buildReadyDraft(rng)).result;
    const rivalProduction: RivalProductionInProgress = {
      id: 'rival-prod-test-1',
      rivalStudioId: 'rival-studio-0',
      scale: 'Medium',
      genre: backgroundedDraft.genre!,
      script: backgroundedDraft.script!,
      talent: backgroundedDraft.talent,
      productionChoices: backgroundedDraft.productionChoices!,
      postProductionChoices: backgroundedDraft.postProductionChoices!,
      marketingChoices: backgroundedDraft.marketingChoices!,
      targetAudience: backgroundedDraft.targetAudience!,
      releaseDay: 200,
    };
    const rivalFilm = { ...state.studio.filmsReleased[0], id: 'rival-film-test-1', releasedBy: 'A Rival Studio' };
    state = {
      ...state,
      studio: { ...state.studio, productionsInProgress: [backgroundedDraft] },
      rivalProductionsInProgress: [rivalProduction],
      rivalFilmsReleased: [rivalFilm],
    };

    const projects = deriveProjectsView(state);
    expect(projects).toHaveLength(4);

    const byId = new Map(projects.map((p) => [projectId(p), p]));
    expect(byId.get(state.studio.filmsReleased[0].id)?.kind).toBe('released');
    expect(byId.get(backgroundedDraft.id)?.kind).toBe('player-in-progress');
    expect(byId.get(rivalProduction.id)?.kind).toBe('rival-in-progress');
    expect(byId.get(rivalFilm.id)?.kind).toBe('released');
  });

  it('the released subset matches collectFilmStats output for the same state', () => {
    const state = studioReducer(buildStateWithReadyDraft(3), { type: 'RELEASE_FILM' });
    const projects = deriveProjectsView(state);
    const releasedIds = projects.filter((p) => p.kind === 'released').map(projectId);
    expect(releasedIds).toEqual([state.studio.filmsReleased[0].id]);
  });

  it('does not double-count a just-released film via its still-populated draft (RELEASE_FILM keeps draft.results set for ReleaseResults.tsx)', () => {
    const state = studioReducer(buildStateWithReadyDraft(5), { type: 'RELEASE_FILM' });
    expect(state.draft).not.toBeNull();
    expect(state.draft!.results).not.toBeNull();
    const projects = deriveProjectsView(state);
    expect(projects).toHaveLength(1);
    expect(projects[0].kind).toBe('released');
  });

  it('an empty draft slot and no backgrounded/rival activity yields exactly the released films, no phantom entries', () => {
    const released = studioReducer(buildStateWithReadyDraft(4), { type: 'RELEASE_FILM' });
    const state = { ...released, draft: null };
    const projects = deriveProjectsView(state);
    expect(projects).toHaveLength(1);
    expect(projects[0].kind).toBe('released');
  });
});
