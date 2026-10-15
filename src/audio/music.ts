// The score, as data. Each loop is a short chord progression plus a handful of
// step patterns on a 16-step-per-bar grid; audioEngine.ts turns the events this
// module emits into synthesized notes. Kept pure (no Web Audio here) so what a
// loop *plays* can be read, tested and rewritten without touching how it sounds.

import type { MusicChoice, MusicTrackId } from '../settings/settings';
import type { Screen } from '../types';

export const STEPS_PER_BAR = 16;

/** The instrument a note is played on - the engine owns what each one sounds like per palette. */
export type Voice = 'pad' | 'keys' | 'bass' | 'arp' | 'lead' | 'kick' | 'brush';

/** Which family of instrument sounds a track is voiced with. */
export type Palette = 'orchestral' | 'jazz' | 'synth';

export interface Chord {
  /** Upper-structure voicing (MIDI note numbers). */
  notes: number[];
  /** Bass notes, taken in turn on each bass hit in the bar. */
  bass: number[];
}

export interface MelodyNote {
  step: number;
  midi: number;
  /** Length in steps. */
  length: number;
}

export interface MusicTrack {
  id: MusicTrackId;
  name: string;
  description: string;
  bpm: number;
  /** Fraction of a step the off-beat eighths (step 2, 6, 10, 14) are pushed late - 0 is straight, ~0.33 a lazy swing. */
  swing: number;
  palette: Palette;
  chords: Chord[];
  pad?: { velocity: number };
  keys?: { steps: number[]; length: number; velocity: number };
  bass: { steps: number[]; length: number; velocity: number };
  arp?: { steps: number[]; octave: number; length: number; velocity: number };
  /** One melody per bar, indexed like `chords` (an empty bar rests). */
  lead?: { bars: MelodyNote[][]; velocity: number };
  kick?: { steps: number[]; velocity: number };
  brush?: { hits: { step: number; velocity: number }[] };
}

export interface NoteEvent {
  voice: Voice;
  /** Absent for unpitched percussion. */
  midi?: number;
  /** Length in steps. */
  length: number;
  /** 0-1. */
  velocity: number;
}

const m = (step: number, midi: number, length: number): MelodyNote => ({ step, midi, length });

const MAIN_TITLE: MusicTrack = {
  id: 'main-title',
  name: 'Main Title',
  description: 'Strings, harp and a horn line - the studio logo before the picture starts.',
  bpm: 76,
  swing: 0,
  palette: 'orchestral',
  chords: [
    { notes: [60, 64, 67, 72], bass: [36] }, // C
    { notes: [57, 60, 64, 69], bass: [33] }, // Am
    { notes: [53, 57, 60, 65], bass: [29] }, // F
    { notes: [55, 59, 62, 67], bass: [31] }, // G
    { notes: [57, 60, 64, 69], bass: [33] }, // Am
    { notes: [53, 57, 60, 65], bass: [29] }, // F
    { notes: [50, 57, 62, 65], bass: [38] }, // Dm
    { notes: [55, 59, 62, 67], bass: [31] }, // G
  ],
  pad: { velocity: 0.32 },
  bass: { steps: [0], length: 16, velocity: 0.3 },
  arp: { steps: [0, 2, 4, 6, 8, 10, 12, 14], octave: 12, length: 4, velocity: 0.22 },
  lead: {
    velocity: 0.42,
    bars: [
      [m(0, 67, 6), m(6, 72, 2), m(8, 76, 8)],
      [m(0, 74, 4), m(4, 72, 4), m(8, 69, 8)],
      [m(0, 72, 6), m(6, 74, 2), m(8, 76, 4), m(12, 77, 4)],
      [m(0, 79, 12)],
      [m(0, 76, 6), m(6, 74, 2), m(8, 72, 8)],
      [m(0, 69, 6), m(6, 72, 2), m(8, 77, 8)],
      [m(0, 76, 4), m(4, 74, 4), m(8, 69, 8)],
      [m(0, 71, 8), m(8, 74, 8)],
    ],
  },
  kick: { steps: [0], velocity: 0.35 },
};

const BACK_LOT: MusicTrack = {
  id: 'back-lot',
  name: 'Back Lot',
  description: 'Brushes, upright bass and electric piano - an ordinary afternoon running a studio.',
  bpm: 96,
  swing: 0.33,
  palette: 'jazz',
  chords: [
    { notes: [53, 57, 60, 64], bass: [41, 45, 48, 50] }, // Fmaj7
    { notes: [54, 57, 60, 62], bass: [38, 42, 45, 44] }, // D7
    { notes: [53, 55, 58, 62], bass: [43, 46, 50, 47] }, // Gm7
    { notes: [52, 55, 58, 62], bass: [48, 46, 43, 44] }, // C9
    { notes: [52, 55, 57, 60], bass: [45, 48, 52, 51] }, // Am7
    { notes: [53, 57, 60, 62], bass: [50, 48, 45, 44] }, // Dm7
    { notes: [53, 55, 58, 62], bass: [43, 46, 50, 47] }, // Gm7
    { notes: [52, 55, 58, 62], bass: [48, 46, 43, 40] }, // C9
  ],
  keys: { steps: [0, 6], length: 3, velocity: 0.38 },
  bass: { steps: [0, 4, 8, 12], length: 3, velocity: 0.6 },
  brush: {
    hits: [
      { step: 0, velocity: 0.25 },
      { step: 4, velocity: 0.55 },
      { step: 6, velocity: 0.2 },
      { step: 8, velocity: 0.25 },
      { step: 12, velocity: 0.55 },
      { step: 14, velocity: 0.2 },
    ],
  },
};

const NIGHT_SHOOT: MusicTrack = {
  id: 'night-shoot',
  name: 'Night Shoot',
  description: 'A low pulse and a running arpeggio - cameras rolling, the clock running.',
  bpm: 104,
  swing: 0,
  palette: 'synth',
  chords: [
    { notes: [50, 53, 57, 62], bass: [38] }, // Dm
    { notes: [50, 53, 58, 62], bass: [34] }, // Bb
    { notes: [48, 53, 57, 60], bass: [41] }, // F
    { notes: [48, 52, 55, 60], bass: [36] }, // C
    { notes: [50, 53, 57, 62], bass: [38] }, // Dm
    { notes: [50, 53, 58, 62], bass: [34] }, // Bb
    { notes: [50, 55, 58, 62], bass: [43] }, // Gm
    { notes: [49, 52, 57, 61], bass: [33] }, // A
  ],
  pad: { velocity: 0.7 },
  bass: { steps: [0, 2, 4, 6, 8, 10, 12, 14], length: 1, velocity: 0.8 },
  arp: { steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], octave: 12, length: 1, velocity: 0.3 },
  kick: { steps: [0, 8], velocity: 0.4 },
  brush: {
    hits: [
      { step: 2, velocity: 0.2 },
      { step: 6, velocity: 0.2 },
      { step: 10, velocity: 0.2 },
      { step: 14, velocity: 0.2 },
    ],
  },
};

export const MUSIC_TRACKS: Record<MusicTrackId, MusicTrack> = {
  'main-title': MAIN_TITLE,
  'back-lot': BACK_LOT,
  'night-shoot': NIGHT_SHOOT,
};

/** Every note that starts on `step` of bar `bar` (bars wrap around the progression). */
export function stepEvents(track: MusicTrack, bar: number, step: number): NoteEvent[] {
  const barIndex = ((bar % track.chords.length) + track.chords.length) % track.chords.length;
  const chord = track.chords[barIndex];
  const events: NoteEvent[] = [];

  if (track.pad && step === 0) {
    for (const midi of chord.notes) events.push({ voice: 'pad', midi, length: STEPS_PER_BAR, velocity: track.pad.velocity });
  }

  if (track.keys && track.keys.steps.includes(step)) {
    for (const midi of chord.notes) events.push({ voice: 'keys', midi, length: track.keys.length, velocity: track.keys.velocity });
  }

  const bassHit = track.bass.steps.indexOf(step);
  if (bassHit >= 0) {
    events.push({ voice: 'bass', midi: chord.bass[bassHit % chord.bass.length], length: track.bass.length, velocity: track.bass.velocity });
  }

  if (track.arp) {
    const arpHit = track.arp.steps.indexOf(step);
    if (arpHit >= 0) {
      const midi = chord.notes[arpHit % chord.notes.length] + track.arp.octave;
      events.push({ voice: 'arp', midi, length: track.arp.length, velocity: track.arp.velocity });
    }
  }

  if (track.lead) {
    for (const note of track.lead.bars[barIndex] ?? []) {
      if (note.step === step) events.push({ voice: 'lead', midi: note.midi, length: note.length, velocity: track.lead.velocity });
    }
  }

  if (track.kick && track.kick.steps.includes(step)) {
    events.push({ voice: 'kick', length: 1, velocity: track.kick.velocity });
  }

  if (track.brush) {
    for (const hit of track.brush.hits) {
      if (hit.step === step) events.push({ voice: 'brush', length: 1, velocity: hit.velocity });
    }
  }

  return events;
}

/** Seconds per 16th-note step. */
export function stepDuration(track: MusicTrack): number {
  return 60 / track.bpm / 4;
}

/** How late a step sounds relative to the straight grid, in seconds. */
export function swingOffset(track: MusicTrack, step: number): number {
  return step % 4 === 2 ? track.swing * stepDuration(track) : 0;
}

export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

const SHOOTING_SCREENS = new Set<Screen>(['pre-production', 'production', 'post-production']);

/**
 * Which loop plays. On 'auto' the score follows the player: the title theme on
 * the main menu, the night-shoot pulse while a picture is being made, the lounge
 * on everything else.
 */
export function resolveMusicTrack(choice: MusicChoice, screen: Screen, onMainMenu: boolean): MusicTrackId {
  if (choice !== 'auto') return choice;
  if (onMainMenu) return 'main-title';
  if (SHOOTING_SCREENS.has(screen)) return 'night-shoot';
  return 'back-lot';
}
