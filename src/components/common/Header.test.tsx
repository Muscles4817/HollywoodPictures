// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from './Header';
import { StudioProvider } from '../../state/StudioContext';
import type { TickSpeedMultiplier } from '../../constants';

const noop = () => {};
const headerProps = {
  paused: true,
  onTogglePause: noop,
  tickNonce: 0,
  speedMultiplier: 1 as TickSpeedMultiplier,
  onSetSpeedMultiplier: noop,
  inboxOpen: false,
  onToggleInbox: noop,
  devTool: 'none' as const,
  onSetDevTool: noop,
};

function renderHeader() {
  return render(
    <StudioProvider>
      <Header {...headerProps} />
    </StudioProvider>,
  );
}

/** Any persistence key the save layer writes (the concrete key is versioned - hollywood-pictures-save-vNN - so match the prefix rather than pin the version). */
function saveKeys(): string[] {
  return Object.keys(localStorage).filter((k) => k.startsWith('hollywood-pictures-save'));
}

describe('Header save button', () => {
  beforeEach(() => {
    localStorage.clear();
    // Seed a theme so useTheme's getInitialTheme never reaches window.matchMedia (unimplemented in jsdom).
    localStorage.setItem('hollywood-pictures-theme', 'dark');
  });

  it('renders a Save button that flips to a confirmation when clicked', () => {
    renderHeader();
    const save = screen.getByRole('button', { name: 'Save game now' });
    expect(save).toHaveTextContent('Save');
    expect(save).not.toHaveTextContent('Saved');

    fireEvent.click(save);

    expect(screen.getByRole('button', { name: 'Save game now' })).toHaveTextContent('Saved');
  });

  it('persists the game state to localStorage when clicked', () => {
    renderHeader();
    // Clear the autosave written when StudioProvider mounted, so the assertion
    // proves the click itself wrote the save.
    saveKeys().forEach((k) => localStorage.removeItem(k));
    expect(saveKeys()).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Save game now' }));

    expect(saveKeys().length).toBeGreaterThan(0);
  });
});
