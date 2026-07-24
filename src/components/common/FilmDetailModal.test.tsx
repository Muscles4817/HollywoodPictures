// @vitest-environment jsdom
//
// QoL pass (docs/DESIGN.md): the Studio History dossier never showed the
// screenplay at all - added as its own section, leading the modal ahead of
// Cast & Crew/Events/Reception/Financials/Reviews. First test coverage for
// this component.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { StudioProvider } from '../../state/StudioContext';
import { FilmDetailModal } from './FilmDetailModal';
import { generateScriptOptions } from '../../engine/scriptGenerator';
import { generateTalentCandidates } from '../../engine/talentGenerator';
import { createRng } from '../../engine/random';
import { studioReducer } from '../../state/studioReducer';
import { buildStateWithReadyDraft } from '../../state/testFixtures';
import { saveState } from '../../state/persistence';
import { playerReleasedFilms } from '../../engine/project';
import { ARCHETYPE_LABELS } from '../../data/scriptTagLabels';
import type { Film } from '../../types';

// The modal now hosts a self-contained IP panel that reads the store, so these
// renders mount inside a StudioProvider (fresh studio - no promoted IP).
beforeEach(() => {
  localStorage.clear();
});

function buildFilm(): Film {
  const script = generateScriptOptions('Action', createRng(1), 1)[0];
  const director = generateTalentCandidates('Director', createRng(2), 1)[0];
  return {
    id: 'film-1',
    title: 'Test Film',
    genre: 'Action',
    targetAudience: 'Mass Market',
    script,
    talent: [{ role: 'Director', person: director }],
    productionChoices: { contingencyAmount: 500_000, setQualityAmount: 500_000, practicalEffectsAmount: 500_000, vfxAmount: 500_000, runtimeIntensity: 0.5 },
    postProductionChoices: { editStyle: 'Balanced', musicFocus: 'Standard', finalCutFocus: 'Trailer-focused' },
    marketingChoices: { marketingSpend: 10_000_000, releaseType: 'Wide', releaseWindow: 'Quiet Month' },
    events: [],
    postProductionEvents: [],
    results: {
      productionCost: 10_000_000, marketingCost: 10_000_000, totalCost: 20_000_000, openingWeekend: 5_000_000,
      totalBoxOffice: 50_000_000, studioRevenue: 25_000_000, profit: 5_000_000, outcome: 'Hit', brandChange: 3, prestigeChange: 2,
      criticScore: 65, audienceScore: 70, buzzScore: 55, qualityScore: 60,
      scriptScore: 60, directionScore: 60, actingScore: 60, productionScore: 60, postProductionScore: 60, eventsScore: 50,
      reviewBlurbs: ['A solid effort.'], storyReport: 'Filming went smoothly.',
    },
    boxOfficeRun: { status: 'finished', fixed: undefined as never, simWeeks: [], weeks: [], cumulativeGross: 50_000_000, acknowledged: true, premiereSeen: true },
    releasedOnDay: 100,
  };
}

describe('FilmDetailModal - Screenplay section', () => {
  it("shows the film's script - title, concept badges, quality stats, production tags and tone profile", () => {
    const film = buildFilm();
    render(<StudioProvider><FilmDetailModal film={film} onClose={() => {}} /></StudioProvider>);
    const heading = screen.getByRole('heading', { name: 'Screenplay' });
    expect(heading).toBeInTheDocument();
    const section = heading.closest('.card') as HTMLElement;
    expect(within(section).getByText(film.script.title)).toBeInTheDocument();
    // The archetype label can coincidentally collide with a tone-axis label
    // shown further down the same card (e.g. archetype "Spectacle" vs. the
    // tone profile's own "Spectacle" axis) - assert presence, not uniqueness.
    expect(within(section).getAllByText(ARCHETYPE_LABELS[film.script.archetype]).length).toBeGreaterThanOrEqual(1);
    expect(within(section).getByText(film.script.synopsis)).toBeInTheDocument();
    expect(within(section).getByText('Writing')).toBeInTheDocument();
    expect(within(section).getByText('Creative')).toBeInTheDocument();
  });

  it('renders the Screenplay section before Cast & Crew, Reception and Financials - a deliberate narrative order', () => {
    const film = buildFilm();
    render(<StudioProvider><FilmDetailModal film={film} onClose={() => {}} /></StudioProvider>);
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    const screenplayIndex = headings.indexOf('Screenplay');
    const castCrewIndex = headings.indexOf('Cast & Crew');
    const receptionIndex = headings.indexOf('Reception');
    const financialsIndex = headings.indexOf('Financials');
    expect(screenplayIndex).toBeGreaterThanOrEqual(0);
    expect(screenplayIndex).toBeLessThan(castCrewIndex);
    expect(castCrewIndex).toBeLessThan(receptionIndex);
    expect(receptionIndex).toBeLessThan(financialsIndex);
  });
});

describe('FilmDetailModal - Promote to IP', () => {
  /** A state whose projects actually contain the released film, so PROMOTE_FILM_TO_IP can find it. */
  function releasedFilmState() {
    const released = studioReducer(buildStateWithReadyDraft(1), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    return { state: released, film: playerReleasedFilms(released.projects)[0] };
  }

  it("promotes the player's film from its dossier, then shows the resulting IP", () => {
    const { state, film } = releasedFilmState();
    saveState(state);
    render(<StudioProvider><FilmDetailModal film={film} onClose={() => {}} /></StudioProvider>);

    // Before: a promote panel with an action.
    expect(screen.getByRole('heading', { name: 'Promote to Intellectual Property' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Promote to IP' }));

    // After: the panel becomes a read-only IP readout.
    expect(screen.getByRole('heading', { name: 'Intellectual Property' })).toBeInTheDocument();
    expect(screen.getByText(/has been promoted to the IP/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Promote to IP' })).not.toBeInTheDocument();
  });

  it("does not offer promotion for a rival's film", () => {
    const rivalFilm: Film = { ...buildFilm(), releasedBy: 'Rival Pictures' };
    render(<StudioProvider><FilmDetailModal film={rivalFilm} onClose={() => {}} /></StudioProvider>);
    expect(screen.queryByRole('heading', { name: 'Promote to Intellectual Property' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Intellectual Property' })).not.toBeInTheDocument();
  });
});

describe('FilmDetailModal - IP Assessment', () => {
  it("shows a franchise-viability assessment for the player's own film, whether or not an IP exists", () => {
    render(<StudioProvider><FilmDetailModal film={buildFilm()} onClose={() => {}} /></StudioProvider>);
    expect(screen.getByRole('heading', { name: 'IP Assessment' })).toBeInTheDocument();
    // The inherent-vs-opportunity split is surfaced.
    expect(screen.getByText('Inherent Potential')).toBeInTheDocument();
    expect(screen.getByText('Current Opportunity')).toBeInTheDocument();
  });

  it("shows no assessment for a rival's film", () => {
    const rivalFilm: Film = { ...buildFilm(), releasedBy: 'Rival Pictures' };
    render(<StudioProvider><FilmDetailModal film={rivalFilm} onClose={() => {}} /></StudioProvider>);
    expect(screen.queryByRole('heading', { name: 'IP Assessment' })).not.toBeInTheDocument();
  });
});
