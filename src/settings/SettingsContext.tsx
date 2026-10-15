import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { audio } from '../audio/audioEngine';
import { defaultSettings, loadSettings, saveSettings, type Settings } from './settings';

interface SettingsContextValue {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

// What a press on these sounds like. Matched on the element actually pressed,
// so a click anywhere inside a button (its icon, its label span) still counts.
const PRESSABLE = 'button, [role="button"], [role="radio"], [role="tab"], summary, a[href]';

/**
 * Owns the player's preferences and applies them: the theme attribute on
 * <html>, and every volume and music choice on the audio engine. Also the one
 * place that wires the audio engine to the page - unlocking it on the first
 * gesture (browsers refuse sound before one), muting it with the tab, and the
 * soft click on every button press. Wraps the whole app, above the studio, so
 * the title screen has sound and settings too.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  useEffect(() => {
    saveSettings(settings);
    document.documentElement.setAttribute('data-theme', settings.theme);
    audio.applySettings(settings);
  }, [settings]);

  useEffect(() => {
    function unlock() {
      audio.unlock();
    }
    function onClick(e: MouseEvent) {
      const target = e.target instanceof Element ? e.target.closest(PRESSABLE) : null;
      if (!target || (target as HTMLButtonElement).disabled || target.getAttribute('aria-disabled') === 'true') return;
      audio.play(target.classList.contains('btn-primary') ? 'select' : 'click');
    }
    function onVisibility() {
      audio.setHidden(document.hidden);
    }
    // Capture phase, so a handler that stops propagation can't swallow the unlock or the click.
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    window.addEventListener('click', onClick, true);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      window.removeEventListener('click', onClick, true);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  }, []);

  // A reset keeps the theme the player is looking at - "defaults" is about sound,
  // and flipping the whole screen to another palette under them would be a surprise.
  const resetSettings = useCallback(() => {
    setSettings((current) => defaultSettings(current.theme));
  }, []);

  return <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings must be used inside <SettingsProvider>');
  return value;
}
