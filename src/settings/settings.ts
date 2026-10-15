// Player preferences - sound and display. A device preference, not game
// state: stored under its own localStorage key, separate from the studio save,
// so resetting a studio never touches them and changing them never touches a
// playthrough (same reasoning the theme toggle always had).

export type Theme = 'light' | 'dark';

/** 'auto' follows what the player is doing (title screen, the lot, a shoot). */
export type MusicChoice = 'auto' | MusicTrackId;
export type MusicTrackId = 'main-title' | 'back-lot' | 'night-shoot';

export interface Settings {
  /** 0-1. Scales everything. */
  masterVolume: number;
  sfxEnabled: boolean;
  /** 0-1. */
  sfxVolume: number;
  /** The soft tick on every button press - separate because it is the one effect heard hundreds of times a session. */
  interfaceClicks: boolean;
  musicEnabled: boolean;
  /** 0-1. */
  musicVolume: number;
  music: MusicChoice;
  /** Silence everything while the tab is in the background. */
  muteInBackground: boolean;
  theme: Theme;
}

export const SETTINGS_KEY = 'hollywood-pictures-settings';
/** The theme toggle's own key, from before there was a settings page - read once as the starting theme. */
const LEGACY_THEME_KEY = 'hollywood-pictures-theme';

export const MUSIC_TRACK_IDS: readonly MusicTrackId[] = ['main-title', 'back-lot', 'night-shoot'];

export function defaultSettings(theme: Theme = 'light'): Settings {
  return {
    masterVolume: 0.8,
    sfxEnabled: true,
    sfxVolume: 0.7,
    interfaceClicks: true,
    musicEnabled: true,
    musicVolume: 0.35,
    music: 'auto',
    muteInBackground: true,
    theme,
  };
}

function clamp01(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Reads whatever was stored, field by field, falling back to the default for
 * anything missing or malformed - a hand-edited or half-written entry should
 * cost one preference, not all of them.
 */
export function parseSettings(raw: unknown, fallbackTheme: Theme = 'light'): Settings {
  const d = defaultSettings(fallbackTheme);
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  const music = r.music === 'auto' || MUSIC_TRACK_IDS.includes(r.music as MusicTrackId) ? (r.music as MusicChoice) : d.music;
  return {
    masterVolume: clamp01(r.masterVolume, d.masterVolume),
    sfxEnabled: bool(r.sfxEnabled, d.sfxEnabled),
    sfxVolume: clamp01(r.sfxVolume, d.sfxVolume),
    interfaceClicks: bool(r.interfaceClicks, d.interfaceClicks),
    musicEnabled: bool(r.musicEnabled, d.musicEnabled),
    musicVolume: clamp01(r.musicVolume, d.musicVolume),
    music,
    muteInBackground: bool(r.muteInBackground, d.muteInBackground),
    theme: r.theme === 'light' || r.theme === 'dark' ? r.theme : d.theme,
  };
}

function systemTheme(): Theme {
  try {
    const legacy = localStorage.getItem(LEGACY_THEME_KEY);
    if (legacy === 'light' || legacy === 'dark') return legacy;
  } catch {
    // localStorage unavailable - fall through to OS preference
  }
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function loadSettings(): Settings {
  const fallbackTheme = systemTheme();
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) return parseSettings(JSON.parse(stored), fallbackTheme);
  } catch {
    // unreadable - defaults
  }
  return defaultSettings(fallbackTheme);
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore - preferences just won't persist across reloads
  }
}

/** The gain actually applied to a channel: zero when the channel is off. */
export function channelGain(settings: Settings, channel: 'sfx' | 'music'): number {
  if (channel === 'sfx') return settings.sfxEnabled ? settings.masterVolume * settings.sfxVolume : 0;
  return settings.musicEnabled ? settings.masterVolume * settings.musicVolume : 0;
}
