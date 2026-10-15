import { describe, expect, it } from 'vitest';
import { MUSIC_TRACKS, STEPS_PER_BAR, midiToFrequency, resolveMusicTrack, stepEvents, swingOffset, stepDuration } from './music';
import { MUSIC_TRACK_IDS } from '../settings/settings';

describe('music tracks', () => {
  it('defines every track the settings can name', () => {
    for (const id of MUSIC_TRACK_IDS) expect(MUSIC_TRACKS[id].id).toBe(id);
  });

  it('keeps every melody note inside its bar and aligned to its chords', () => {
    for (const track of Object.values(MUSIC_TRACKS)) {
      if (!track.lead) continue;
      expect(track.lead.bars).toHaveLength(track.chords.length);
      for (const bar of track.lead.bars) {
        for (const note of bar) expect(note.step + note.length).toBeLessThanOrEqual(STEPS_PER_BAR);
      }
    }
  });

  it('plays something on the downbeat of every bar, and keeps velocities in range', () => {
    for (const track of Object.values(MUSIC_TRACKS)) {
      for (let bar = 0; bar < track.chords.length; bar++) {
        expect(stepEvents(track, bar, 0).length).toBeGreaterThan(0);
        for (let step = 0; step < STEPS_PER_BAR; step++) {
          for (const e of stepEvents(track, bar, step)) {
            expect(e.velocity).toBeGreaterThan(0);
            expect(e.velocity).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  it('walks the bass through the chord in turn', () => {
    const lot = MUSIC_TRACKS['back-lot'];
    const bass = [0, 4, 8, 12].map((step) => stepEvents(lot, 0, step).find((e) => e.voice === 'bass')?.midi);
    expect(bass).toEqual(lot.chords[0].bass);
  });

  it('loops the progression', () => {
    const track = MUSIC_TRACKS['main-title'];
    expect(stepEvents(track, track.chords.length, 0)).toEqual(stepEvents(track, 0, 0));
  });

  it('swings only the off-beat eighths', () => {
    const lot = MUSIC_TRACKS['back-lot'];
    expect(swingOffset(lot, 0)).toBe(0);
    expect(swingOffset(lot, 2)).toBeCloseTo(lot.swing * stepDuration(lot));
    expect(swingOffset(MUSIC_TRACKS['night-shoot'], 2)).toBe(0);
  });
});

describe('midiToFrequency', () => {
  it('tunes A4 to 440 and doubles per octave', () => {
    expect(midiToFrequency(69)).toBe(440);
    expect(midiToFrequency(81)).toBeCloseTo(880);
  });
});

describe('resolveMusicTrack', () => {
  it('follows the player on auto', () => {
    expect(resolveMusicTrack('auto', 'dashboard', true)).toBe('main-title');
    expect(resolveMusicTrack('auto', 'production', false)).toBe('night-shoot');
    expect(resolveMusicTrack('auto', 'dashboard', false)).toBe('back-lot');
  });

  it('honours a fixed choice everywhere', () => {
    expect(resolveMusicTrack('night-shoot', 'dashboard', true)).toBe('night-shoot');
  });
});
