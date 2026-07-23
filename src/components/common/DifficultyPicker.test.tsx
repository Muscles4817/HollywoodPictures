// @vitest-environment jsdom
//
// The difficulty picker widened to accurate studio-scale tiers (the old flat
// £25M "Major" couldn't fund even one blockbuster), and each tier now seeds
// Brand and Prestige to match its stature, not just cash. This checks the
// picker surfaces those and hands the whole choice back on confirm.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DifficultyPicker } from './DifficultyPicker';

describe('DifficultyPicker', () => {
  it('offers more than the old four tiers, topping out well above the old £25M ceiling', () => {
    render(<DifficultyPicker studioName="Silver Reel" onConfirm={() => {}} onCancel={() => {}} />);
    for (const label of ['Garage Outfit', 'Grassroots Indie', 'Boutique Studio', 'Major Studio', 'Legacy Powerhouse']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // The top tier is a real studio-scale figure (£500,000,000), not £25M.
    expect(screen.getByText('£500,000,000')).toBeInTheDocument();
  });

  it('shows the Brand and Prestige each tier starts with', () => {
    render(<DifficultyPicker studioName="Silver Reel" onConfirm={() => {}} onCancel={() => {}} />);
    // Major Studio's standing is surfaced on its card.
    expect(screen.getByText('Brand 72 · Prestige 60')).toBeInTheDocument();
  });

  it('confirms the full choice - cash, Brand and Prestige - for the selected tier', () => {
    const onConfirm = vi.fn();
    render(<DifficultyPicker studioName="Silver Reel" onConfirm={onConfirm} onCancel={() => {}} />);

    fireEvent.click(screen.getByText('Major Studio'));
    fireEvent.click(screen.getByRole('button', { name: 'Start New Studio' }));

    expect(onConfirm).toHaveBeenCalledWith({ startingCash: 200_000_000, brand: 72, prestige: 60 });
  });
});
