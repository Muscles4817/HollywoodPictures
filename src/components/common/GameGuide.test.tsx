// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameGuide } from './GameGuide';

describe('GameGuide (How It Works FAQ)', () => {
  it('renders the FAQ with topic chips and covers the major systems', () => {
    render(<GameGuide onBack={() => {}} />);
    expect(screen.getByRole('heading', { name: 'How It Works', level: 1 })).toBeInTheDocument();

    // Every category heading is present (the systems a confused player asks about).
    for (const topic of [
      'Getting started',
      'Scripts, Assets & the Opportunity Market',
      'Casting & crew',
      'Making the film',
      'The Production Office & Producers',
      'Marketing & release',
      'Results & money',
      'Your studio over time',
    ]) {
      expect(screen.getByRole('heading', { name: topic })).toBeInTheDocument();
    }
  });

  it('explains the newer Production Office feature in the answers', () => {
    render(<GameGuide onBack={() => {}} />);
    // Content is in the DOM even inside a collapsed <details>.
    expect(screen.getByText(/Line Producer trims production spend/)).toBeInTheDocument();
    expect(screen.getByText(/one-time hiring fee/)).toBeInTheDocument();
  });

  it('calls onBack from the header button', () => {
    const onBack = vi.fn();
    render(<GameGuide onBack={onBack} />);
    // Two "Back to Dashboard" buttons (header + footer); either should work.
    fireEvent.click(screen.getAllByRole('button', { name: 'Back to Dashboard' })[0]);
    expect(onBack).toHaveBeenCalled();
  });
});
