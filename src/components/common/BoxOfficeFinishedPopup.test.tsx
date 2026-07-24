// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../state/StudioContext', () => ({ useStudio: () => ({ dispatch: vi.fn() }) }));

// Imported after the mock is declared.
import { BoxOfficeFinishedPopup } from './BoxOfficeFinishedPopup';
import type { Film } from '../../types';

function filmWithStory(storyReport: string): Film {
  return {
    title: 'Test Film',
    results: {
      outcome: 'Hit', totalBoxOffice: 100, studioRevenue: 50, profit: 10, totalCost: 40,
      brandChange: 0, prestigeChange: 0, criticScore: 60, qualityScore: 60, audienceScore: 60,
      storyReport,
    },
    boxOfficeRun: { status: 'finished', weeks: [], acknowledged: false, premiereSeen: true },
  } as unknown as Film;
}

describe('BoxOfficeFinishedPopup', () => {
  it('surfaces the story report - including a press-tour moment - so a background-settled film never buries it', () => {
    const beat = 'Kip Danger made an off-message remark that went viral for all the wrong reasons.';
    render(<BoxOfficeFinishedPopup film={filmWithStory(`The film opened to a warm run. ${beat}`)} />);
    expect(screen.getByText(new RegExp('off-message remark that went viral'))).toBeInTheDocument();
  });
});
