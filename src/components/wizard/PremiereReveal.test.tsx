// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PremiereReveal } from './PremiereReveal';
import type { ReviewQuote } from '../../types';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const criticReviews: ReviewQuote[] = [
  { text: 'Sharp and confident.', score: 78 },
  { text: 'A genuine achievement.', score: 82 },
  { text: 'Assured from start to finish.', score: 80 },
];
const audienceReviews: ReviewQuote[] = [
  { text: 'Loved every minute!', score: 88 },
  { text: 'Already planning a rewatch.', score: 85 },
  { text: 'Everyone was buzzing after.', score: 90 },
];

function renderReveal() {
  return render(
    <PremiereReveal
      title="The Long Take"
      genre="Drama"
      outcome="Hit"
      criticScore={80}
      audienceScore={88}
      criticReviews={criticReviews}
      audienceReviews={audienceReviews}
      openingWeekend={12_500_000}
    />,
  );
}

describe('PremiereReveal', () => {
  it('renders the title, all six quotes, both aggregate scores, and the opening weekend figure regardless of reveal progress', () => {
    renderReveal();
    expect(screen.getByText('The Long Take')).toBeInTheDocument();
    for (const quote of [...criticReviews, ...audienceReviews]) {
      expect(screen.getByText(`“${quote.text}”`)).toBeInTheDocument();
    }
    expect(screen.getByText('Critic Score')).toBeInTheDocument();
    expect(screen.getByText('Audience Score')).toBeInTheDocument();
    expect(screen.getByText('Opening Weekend')).toBeInTheDocument();
  });

  it('shows a Skip control while still revealing, which disappears once clicked (the reveal has nothing left to skip)', () => {
    renderReveal();
    const skip = screen.getByRole('button', { name: 'Skip' });
    expect(skip).toBeInTheDocument();
    fireEvent.click(skip);
    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
  });

  it('respects prefers-reduced-motion - reveals immediately, no Skip control ever needed', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    renderReveal();
    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
  });
});
