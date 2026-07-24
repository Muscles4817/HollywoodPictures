// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActivityCard } from './ActivityCard';
import type { StudioActivity } from '../../state/studioActivity';

const activity: StudioActivity = {
  id: 'a1',
  tone: 'warning',
  category: 'attention',
  eyebrow: 'Post-production ready',
  title: 'Neon Harbor',
  detail: 'Principal photography wrapped — ready for post-production.',
};

describe('ActivityCard', () => {
  it('renders eyebrow, title and detail with the tone class', () => {
    const { container } = render(<ActivityCard activity={activity} />);
    expect(screen.getByText('Post-production ready')).toBeInTheDocument();
    expect(screen.getByText('Neon Harbor')).toBeInTheDocument();
    expect(container.querySelector('.dashboard-activity-warning')).not.toBeNull();
  });

  it('renders a button that fires onClick when the action has one', () => {
    const onClick = vi.fn();
    render(<ActivityCard activity={activity} action={{ label: 'Continue', onClick }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders a muted note instead of a button when the action has no onClick', () => {
    render(<ActivityCard activity={activity} action={{ label: 'Continue', note: 'Finish what you are doing first.' }} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Finish what you are doing first.')).toBeInTheDocument();
  });
});
