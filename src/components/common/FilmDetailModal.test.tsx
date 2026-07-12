// @vitest-environment jsdom
//
// QoL pass (docs/DESIGN.md): the Studio History dossier never showed the
// screenplay at all - added as its own section, leading the modal ahead of
// Cast & Crew/Events/Reception/Financials/Reviews. First test coverage for
// this component.
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { FilmDetailModal } from './FilmDetailModal';
import { generateScriptOptions } from '../../engine/scriptGenerator';
import { generateTalentCandidates } from '../../engine/talentGenerator';
import { createRng } from '../../engine/random';
import { ARCHETYPE_LABELS } from '../../data/scriptTagLabels';
import type { Film } from '../../types';

function buildFilm(): Film {
  const script = generateScriptOptions('Action', createRng(1), 1)[0];
  const director = generateTalentCandidates('Director', createRng(2), 1)[0];
  return {
    id: 'film-1',
    title: 'Test Film',
    genre: 'Action',
    targetAudience: 'Mass Market',
    script,
    talent: [director],
    productionChoices: { contingencyAmount: 500_000, setQualityAmount: 500_000, practicalEffectsAmount: 500_000, vfxAmount: 500_000, runtimeIntensity: 0.5 },
    postProductionChoices: { editStyle: 'Balanced', musicFocus: 'Standard', testScreeningResponse: 'Ignore', finalCutFocus: 'Trailer-focused' },
    marketingChoices: { marketingSpend: 10_000_000, releaseType: 'Wide', releaseWindow: 'Quiet Month' },
    events: [],
    results: {
      productionCost: 10_000_000, marketingCost: 10_000_000, totalCost: 20_000_000, openingWeekend: 5_000_000,
      totalBoxOffice: 50_000_000, studioRevenue: 25_000_000, profit: 5_000_000, outcome: 'Hit', reputationChange: 3,
      criticScore: 65, audienceScore: 70, buzzScore: 55, qualityScore: 60,
      scriptScore: 60, directionScore: 60, actingScore: 60, productionScore: 60, postProductionScore: 60, eventsScore: 50,
      reviewBlurbs: ['A solid effort.'], storyReport: 'Filming went smoothly.',
    },
    boxOfficeRun: { status: 'finished', fixed: undefined as never, simWeeks: [], weeks: [], cumulativeGross: 50_000_000, acknowledged: true },
    releasedOnDay: 100,
  };
}

describe('FilmDetailModal - Screenplay section', () => {
  it("shows the film's script - title, concept badges, quality stats, production tags and tone profile", () => {
    const film = buildFilm();
    render(<FilmDetailModal film={film} onClose={() => {}} />);
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
    render(<FilmDetailModal film={film} onClose={() => {}} />);
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
