// @vitest-environment jsdom
//
// QoL pass: viewing a film's performance now spells out how it was released
// AND distributed (self vs a rented major - engine/distribution.ts), plus an
// exact gross -> your-profit waterfall (the theatrical/international split, a
// rented distributor's fee, then production and marketing), instead of
// leaving the player to reverse-engineer why "Studio's Share" isn't "Profit".
// Shared by ReleaseResults and FilmDetailModal via common/FilmMoneyBreakdown.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FilmMoneyBreakdown } from './FilmMoneyBreakdown';
import type { Film, FilmResults, MarketingChoices } from '../../types';

function film(
  overrides: { results?: Partial<FilmResults>; marketing?: Partial<MarketingChoices>; status?: 'running' | 'finished'; cumulativeGross?: number } = {},
): Film {
  const results: FilmResults = {
    productionCost: 160_000_000, marketingCost: 100_000_000, totalCost: 260_000_000, openingWeekend: 62_000_000,
    totalBoxOffice: 800_000_000, studioRevenue: 336_000_000, profit: 76_000_000, outcome: 'Blockbuster',
    brandChange: 5, prestigeChange: 2, criticScore: 74, audienceScore: 79, buzzScore: 60, qualityScore: 72,
    scriptScore: 82, directionScore: 91, actingScore: 77, productionScore: 71, postProductionScore: 70, eventsScore: 0,
    reviewBlurbs: [], storyReport: '',
    ...overrides.results,
  };
  return {
    id: 'f', title: 'Test', genre: 'Sci-Fi', targetAudience: 'Mass Market',
    script: undefined as never, talent: [],
    productionChoices: { contingencyAmount: 0, setQualityAmount: 0, practicalEffectsAmount: 0, vfxAmount: 0, runtimeIntensity: 0.5 },
    postProductionChoices: { editStyle: 'Balanced', musicFocus: 'Standard', finalCutFocus: 'Trailer-focused' },
    marketingChoices: { marketingSpend: 100_000_000, releaseType: 'Wide', releaseWindow: 'Summer', ...overrides.marketing },
    events: [], postProductionEvents: [],
    results,
    boxOfficeRun: { status: overrides.status ?? 'finished', fixed: undefined as never, simWeeks: [], weeks: [], cumulativeGross: overrides.cumulativeGross ?? 800_000_000, acknowledged: true },
    releasedOnDay: 100,
  };
}

describe('FilmMoneyBreakdown', () => {
  it('a self-distributed film: shows the release + "Self-distributed", the theatrical split, and no distributor fee', () => {
    render(<FilmMoneyBreakdown film={film()} />);

    expect(screen.getByText('Wide')).toBeInTheDocument();
    expect(screen.getByText('Self-distributed')).toBeInTheDocument();

    // 336M kept of 800M -> theaters & international take 58%.
    expect(screen.getByText(/Theaters & international keep 58%/)).toBeInTheDocument();
    expect(screen.getByText("Your studio's share")).toBeInTheDocument();
    expect(screen.getByText('Your profit')).toBeInTheDocument();
    // No rented-distributor fee when self-distributed.
    expect(screen.queryByText(/Distributor's fee/)).not.toBeInTheDocument();
  });

  it("a rented film: names the distributor and breaks its fee off the studio's rentals", () => {
    // Rented Wide keep = 0.42 * 0.72 = 0.3024 -> studioRevenue 241.92M of 800M.
    const rented = film({
      marketing: { distributionMethod: 'rented' },
      results: { studioRevenue: 241_920_000, distributionKeepShare: 0.3024, profit: -18_080_000, outcome: 'Modest Success' },
    });
    render(<FilmMoneyBreakdown film={rented} />);

    expect(screen.getByText('Rented')).toBeInTheDocument();
    // The rentals subtotal (the standard 42%) and the distributor's fee below it.
    expect(screen.getByText('Box-office rentals')).toBeInTheDocument();
    expect(screen.getByText(/Distributor's fee \(28%\)/)).toBeInTheDocument();
    expect(screen.getByText("Your studio's share")).toBeInTheDocument();
    expect(screen.getByText('Your profit')).toBeInTheDocument();
  });

  it('withholds the final split/profit while the film is still playing', () => {
    render(<FilmMoneyBreakdown film={film({ status: 'running', results: { totalBoxOffice: null, studioRevenue: null, profit: null, outcome: null }, cumulativeGross: 120_000_000 })} />);
    expect(screen.getByText('Still playing')).toBeInTheDocument();
    expect(screen.queryByText('Your profit')).not.toBeInTheDocument();
    expect(screen.getByText(/settle when the run ends/)).toBeInTheDocument();
  });
});
