import { describe, expect, it } from 'vitest';
import { channelGain, defaultSettings, parseSettings } from './settings';

describe('parseSettings', () => {
  it('returns the defaults for nothing stored', () => {
    expect(parseSettings(null, 'dark')).toEqual(defaultSettings('dark'));
    expect(parseSettings('not an object')).toEqual(defaultSettings());
  });

  it('keeps every well-formed field', () => {
    const stored = { ...defaultSettings(), masterVolume: 0.3, musicEnabled: false, music: 'night-shoot', theme: 'dark' };
    expect(parseSettings(stored)).toEqual(stored);
  });

  it('drops only the malformed fields, clamping volumes into 0-1', () => {
    const parsed = parseSettings({ masterVolume: 4, sfxVolume: -1, musicVolume: 'loud', music: 'polka', sfxEnabled: 'yes', theme: 'sepia' });
    const d = defaultSettings();
    expect(parsed.masterVolume).toBe(1);
    expect(parsed.sfxVolume).toBe(0);
    expect(parsed.musicVolume).toBe(d.musicVolume);
    expect(parsed.music).toBe('auto');
    expect(parsed.sfxEnabled).toBe(d.sfxEnabled);
    expect(parsed.theme).toBe(d.theme);
  });
});

describe('channelGain', () => {
  it('is master times channel, and zero when the channel is off', () => {
    const s = { ...defaultSettings(), masterVolume: 0.5, sfxVolume: 0.8, musicVolume: 0.4 };
    expect(channelGain(s, 'sfx')).toBeCloseTo(0.4);
    expect(channelGain(s, 'music')).toBeCloseTo(0.2);
    expect(channelGain({ ...s, sfxEnabled: false }, 'sfx')).toBe(0);
    expect(channelGain({ ...s, musicEnabled: false }, 'music')).toBe(0);
  });
});
