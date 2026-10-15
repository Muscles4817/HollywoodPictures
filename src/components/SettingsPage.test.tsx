// @vitest-environment jsdom
//
// The Settings page: changes apply straight away, persist under their own
// key (never inside the studio save), and drive the theme attribute.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SettingsProvider } from '../settings/SettingsContext';
import { SETTINGS_KEY } from '../settings/settings';
import { SettingsPage } from './SettingsPage';

function renderPage(onBack = () => {}) {
  return render(
    <SettingsProvider>
      <SettingsPage onBack={onBack} />
    </SettingsProvider>,
  );
}

function stored() {
  return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null');
}

describe('SettingsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    // jsdom has no matchMedia; the settings fall back to the OS theme through it.
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
  });

  it('turns music off and remembers it', () => {
    renderPage();
    const music = screen.getByRole('switch', { name: 'Music' });
    expect(music).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(music);
    expect(music).toHaveAttribute('aria-checked', 'false');
    expect(stored().musicEnabled).toBe(false);
    // The track picker goes inert with the music.
    expect(screen.getByRole('radio', { name: /Back Lot/ })).toBeDisabled();
  });

  it('sets a volume from its slider', () => {
    renderPage();
    fireEvent.change(screen.getByRole('slider', { name: 'Master volume' }), { target: { value: '25' } });
    expect(stored().masterVolume).toBeCloseTo(0.25);
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  it('picks a fixed track', () => {
    renderPage();
    fireEvent.click(screen.getByRole('radio', { name: /Night Shoot/ }));
    expect(stored().music).toBe('night-shoot');
    expect(screen.getByRole('radio', { name: /Night Shoot/ })).toHaveAttribute('aria-checked', 'true');
  });

  it('switches the theme on <html>', () => {
    renderPage();
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(stored().theme).toBe('dark');
  });

  it('restores sound defaults but keeps the theme', () => {
    renderPage();
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Sound effects' }));
    fireEvent.click(screen.getByRole('button', { name: /Restore default/ }));
    expect(stored().sfxEnabled).toBe(true);
    expect(stored().theme).toBe('dark');
  });

  it('reads back what was stored', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ sfxEnabled: false, interfaceClicks: false }));
    renderPage();
    expect(screen.getByRole('switch', { name: 'Sound effects' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('switch', { name: 'Button clicks' })).toBeDisabled();
  });

  it('goes back', () => {
    const onBack = vi.fn();
    renderPage(onBack);
    fireEvent.click(screen.getByRole('button', { name: 'Back to the studio' }));
    expect(onBack).toHaveBeenCalled();
  });
});
