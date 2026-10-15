// Every sound in the game is synthesized here with the Web Audio API - no audio
// files, so nothing to license, load or cache, and every effect can be retuned
// by editing a number. One engine for the page (`audio`, below); React talks to
// it through SettingsContext (volumes, music choice) and calls `audio.play()`
// for one-shot effects.
//
// Browsers refuse to start audio before the first user gesture, so nothing is
// created until `unlock()` is called from one. Everything is a silent no-op
// where Web Audio does not exist (the jsdom test environment included).

import { MUSIC_TRACKS, STEPS_PER_BAR, midiToFrequency, stepDuration, stepEvents, swingOffset, type MusicTrack, type NoteEvent, type Palette } from './music';
import { channelGain, defaultSettings, type MusicTrackId, type Settings } from '../settings/settings';

export type SoundEffect =
  /** Any button press. */
  | 'click'
  /** A primary (committing) button press. */
  | 'select'
  /** An action receipt with no money attached. */
  | 'confirm'
  /** An action receipt that moved money - the register. */
  | 'cash'
  /** Something new arrived in the Inbox. */
  | 'notify'
  /** A rival outbid you - the one sound that means "now". */
  | 'alert'
  | 'pause'
  | 'resume'
  /** The premiere curtain going up. */
  | 'premiere'
  /** Opening-weekend verdict: it worked. */
  | 'hit'
  /** Opening-weekend verdict: it didn't. */
  | 'flop';

export const SOUND_EFFECTS: readonly SoundEffect[] = ['click', 'select', 'confirm', 'cash', 'notify', 'alert', 'pause', 'resume', 'premiere', 'hit', 'flop'];

/** The same effect fired twice inside this window plays once - StrictMode double effects, double-bound handlers. */
const DEDUPE_MS = 60;
/** How far ahead the music scheduler books notes. Longer while hidden, where timers are throttled to ~1/s. */
const LOOKAHEAD_S = 0.15;
const HIDDEN_LOOKAHEAD_S = 1.5;
const SCHEDULER_INTERVAL_MS = 25;
const MUSIC_FADE_IN_S = 2;
const MUSIC_FADE_OUT_S = 1.2;

interface PlayingTrack {
  track: MusicTrack;
  gain: GainNode;
  bar: number;
  step: number;
  nextTime: number;
}

type AudioContextCtor = typeof AudioContext;

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private settings: Settings = defaultSettings();
  private desiredTrack: MusicTrackId | null = null;
  private playing: PlayingTrack | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private hidden = false;
  private lastPlayed = new Map<SoundEffect, number>();

  get supported(): boolean {
    return audioContextCtor() !== null;
  }

  /** Call from inside a user gesture. Creates the audio graph on first call; resumes it after. */
  unlock(): void {
    const Ctor = audioContextCtor();
    if (!Ctor) return;
    if (!this.ctx) {
      try {
        this.ctx = new Ctor();
      } catch {
        return;
      }
      const ctx = this.ctx;
      // A gentle limiter on the whole mix, so stacked effects over music never clip.
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -10;
      limiter.ratio.value = 6;
      limiter.connect(ctx.destination);
      this.sfxBus = ctx.createGain();
      this.musicBus = ctx.createGain();
      this.sfxBus.connect(limiter);
      this.musicBus.connect(limiter);
      this.noise = makeNoiseBuffer(ctx);
      this.applyGains(true);
    }
    if (this.ctx.state === 'suspended' && !(this.hidden && this.settings.muteInBackground)) void this.ctx.resume();
    this.syncMusic();
  }

  applySettings(settings: Settings): void {
    this.settings = settings;
    this.applyGains(false);
    this.applyVisibility();
    this.syncMusic();
  }

  /** The loop that should be playing (null for none). Switching crossfades. */
  setTrack(track: MusicTrackId | null): void {
    this.desiredTrack = track;
    this.syncMusic();
  }

  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    this.applyVisibility();
  }

  play(effect: SoundEffect): void {
    const ctx = this.ctx;
    const bus = this.sfxBus;
    if (!ctx || !bus || ctx.state !== 'running') return;
    if (channelGain(this.settings, 'sfx') <= 0) return;
    if ((effect === 'click' || effect === 'select') && !this.settings.interfaceClicks) return;
    const now = performance.now();
    const last = this.lastPlayed.get(effect);
    if (last !== undefined && now - last < DEDUPE_MS) return;
    this.lastPlayed.set(effect, now);
    try {
      playEffect(ctx, bus, this.noise, effect, ctx.currentTime + 0.005);
    } catch {
      // A failed sound is never worth an error in the game.
    }
  }

  private applyGains(immediate: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || !this.musicBus) return;
    const set = (param: AudioParam, value: number) => {
      if (immediate) param.value = value;
      else param.setTargetAtTime(value, ctx.currentTime, 0.05);
    };
    set(this.sfxBus.gain, channelGain(this.settings, 'sfx'));
    set(this.musicBus.gain, channelGain(this.settings, 'music'));
  }

  private applyVisibility(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const shouldMute = this.hidden && this.settings.muteInBackground;
    if (shouldMute && ctx.state === 'running') void ctx.suspend();
    else if (!shouldMute && ctx.state === 'suspended') void ctx.resume();
  }

  private syncMusic(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    const target = this.settings.musicEnabled && channelGain(this.settings, 'music') > 0 ? this.desiredTrack : null;
    if (this.playing?.track.id === target) return;

    if (this.playing) {
      const old = this.playing.gain;
      old.gain.cancelScheduledValues(ctx.currentTime);
      old.gain.setValueAtTime(old.gain.value, ctx.currentTime);
      old.gain.linearRampToValueAtTime(0, ctx.currentTime + MUSIC_FADE_OUT_S);
      setTimeout(() => old.disconnect(), (MUSIC_FADE_OUT_S + 4) * 1000);
      this.playing = null;
    }

    if (target) {
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(1, ctx.currentTime + MUSIC_FADE_IN_S);
      gain.connect(this.musicBus);
      this.playing = { track: MUSIC_TRACKS[target], gain, bar: 0, step: 0, nextTime: ctx.currentTime + 0.1 };
      if (!this.timer) this.timer = setInterval(() => this.scheduleAhead(), SCHEDULER_INTERVAL_MS);
    } else if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private scheduleAhead(): void {
    const ctx = this.ctx;
    const p = this.playing;
    if (!ctx || !p || ctx.state !== 'running') return;
    // Fell behind (a long stall, a resumed context): rejoin the grid now rather than firing a backlog.
    if (p.nextTime < ctx.currentTime) p.nextTime = ctx.currentTime + 0.05;
    const horizon = ctx.currentTime + (this.hidden ? HIDDEN_LOOKAHEAD_S : LOOKAHEAD_S);
    const stepSeconds = stepDuration(p.track);
    while (p.nextTime < horizon) {
      const at = p.nextTime + swingOffset(p.track, p.step);
      for (const event of stepEvents(p.track, p.bar, p.step)) {
        try {
          playNote(ctx, p.gain, this.noise, p.track.palette, event, at, event.length * stepSeconds);
        } catch {
          // skip the note
        }
      }
      p.nextTime += stepSeconds;
      p.step += 1;
      if (p.step >= STEPS_PER_BAR) {
        p.step = 0;
        p.bar += 1;
      }
    }
  }
}

/** The one engine for the page. */
export const audio = new AudioEngine();

// --- Synthesis -------------------------------------------------------------

export function makeNoiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

interface ToneOptions {
  type: OscillatorType;
  freq: number;
  /** Glide to this frequency over the note. */
  toFreq?: number;
  start: number;
  attack: number;
  /** Seconds held at peak after the attack. */
  hold: number;
  release: number;
  peak: number;
  detune?: number;
  filter?: { type: BiquadFilterType; freq: number; q?: number };
  vibrato?: { rate: number; depth: number };
}

function tone(ctx: BaseAudioContext, dest: AudioNode, o: ToneOptions): void {
  const osc = ctx.createOscillator();
  osc.type = o.type;
  osc.frequency.setValueAtTime(o.freq, o.start);
  if (o.toFreq) osc.frequency.exponentialRampToValueAtTime(o.toFreq, o.start + o.attack + o.hold + o.release);
  if (o.detune) osc.detune.value = o.detune;

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, o.start);
  env.gain.exponentialRampToValueAtTime(Math.max(o.peak, 0.0002), o.start + o.attack);
  env.gain.setValueAtTime(Math.max(o.peak, 0.0002), o.start + o.attack + o.hold);
  env.gain.exponentialRampToValueAtTime(0.0001, o.start + o.attack + o.hold + o.release);

  let head: AudioNode = osc;
  if (o.filter) {
    const f = ctx.createBiquadFilter();
    f.type = o.filter.type;
    f.frequency.value = o.filter.freq;
    if (o.filter.q !== undefined) f.Q.value = o.filter.q;
    head.connect(f);
    head = f;
  }
  head.connect(env);
  env.connect(dest);

  const end = o.start + o.attack + o.hold + o.release + 0.05;
  if (o.vibrato) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = o.vibrato.rate;
    depth.gain.value = o.vibrato.depth;
    lfo.connect(depth);
    depth.connect(osc.frequency);
    lfo.start(o.start);
    lfo.stop(end);
  }
  osc.start(o.start);
  osc.stop(end);
}

function noiseBurst(
  ctx: BaseAudioContext,
  dest: AudioNode,
  noise: AudioBuffer | null,
  start: number,
  peak: number,
  decay: number,
  filter: { type: BiquadFilterType; freq: number; q?: number },
): void {
  if (!noise) return;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = filter.type;
  f.frequency.value = filter.freq;
  if (filter.q !== undefined) f.Q.value = filter.q;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), start + 0.004);
  env.gain.exponentialRampToValueAtTime(0.0001, start + decay);
  src.connect(f);
  f.connect(env);
  env.connect(dest);
  // A random offset into the buffer so consecutive hits don't sound identical.
  src.start(start, Math.random() * 0.5);
  src.stop(start + decay + 0.05);
}

/** Exported for offline rendering (previews, level checks); the game goes through `audio`. */
export function playNote(ctx: BaseAudioContext, dest: AudioNode, noise: AudioBuffer | null, palette: Palette, e: NoteEvent, at: number, seconds: number): void {
  const v = e.velocity;
  const freq = e.midi !== undefined ? midiToFrequency(e.midi) : 0;
  switch (e.voice) {
    case 'pad': {
      const cutoff = palette === 'synth' ? 700 : 1300;
      const attack = palette === 'synth' ? 0.4 : 0.7;
      for (const detune of [-7, 7]) {
        tone(ctx, dest, { type: 'sawtooth', freq, start: at, attack, hold: Math.max(0, seconds - attack), release: 0.9, peak: 0.035 * v, detune, filter: { type: 'lowpass', freq: cutoff, q: 0.5 } });
      }
      return;
    }
    case 'keys':
      // Electric piano: a sine with a quiet octave on top, struck and left to ring.
      tone(ctx, dest, { type: 'sine', freq, start: at, attack: 0.006, hold: 0, release: seconds + 0.7, peak: 0.12 * v });
      tone(ctx, dest, { type: 'sine', freq: freq * 2, start: at, attack: 0.004, hold: 0, release: 0.35, peak: 0.035 * v });
      return;
    case 'bass':
      if (palette === 'jazz') {
        tone(ctx, dest, { type: 'triangle', freq, start: at, attack: 0.008, hold: 0.04, release: seconds + 0.25, peak: 0.45 * v, filter: { type: 'lowpass', freq: 650 } });
      } else if (palette === 'synth') {
        tone(ctx, dest, { type: 'sawtooth', freq, start: at, attack: 0.005, hold: 0, release: seconds + 0.12, peak: 0.22 * v, filter: { type: 'lowpass', freq: 380, q: 4 } });
      } else {
        tone(ctx, dest, { type: 'sine', freq, start: at, attack: 0.25, hold: Math.max(0, seconds - 0.5), release: 0.9, peak: 0.4 * v });
        tone(ctx, dest, { type: 'triangle', freq: freq * 2, start: at, attack: 0.3, hold: Math.max(0, seconds - 0.5), release: 0.9, peak: 0.08 * v });
      }
      return;
    case 'arp':
      if (palette === 'synth') {
        tone(ctx, dest, { type: 'square', freq, start: at, attack: 0.004, hold: 0, release: 0.16, peak: 0.12 * v, filter: { type: 'lowpass', freq: 1700, q: 2 } });
      } else {
        // Harp: a plucked triangle with a long, soft tail.
        tone(ctx, dest, { type: 'triangle', freq, start: at, attack: 0.004, hold: 0, release: 1.3, peak: 0.3 * v });
      }
      return;
    case 'lead':
      // A horn: a filtered saw with a slow-ish swell and a little vibrato.
      tone(ctx, dest, { type: 'sawtooth', freq, start: at, attack: 0.09, hold: Math.max(0, seconds - 0.12), release: 0.35, peak: 0.1 * v, filter: { type: 'lowpass', freq: 1100, q: 0.7 }, vibrato: { rate: 5, depth: 3 } });
      return;
    case 'kick':
      if (palette === 'orchestral') {
        tone(ctx, dest, { type: 'sine', freq: 98, toFreq: 70, start: at, attack: 0.01, hold: 0, release: 1.1, peak: 0.55 * v });
      } else {
        tone(ctx, dest, { type: 'sine', freq: 120, toFreq: 45, start: at, attack: 0.004, hold: 0, release: 0.22, peak: 0.8 * v });
      }
      return;
    case 'brush':
      noiseBurst(ctx, dest, noise, at, 0.18 * v, palette === 'jazz' ? 0.16 : 0.05, { type: palette === 'jazz' ? 'bandpass' : 'highpass', freq: palette === 'jazz' ? 5500 : 8000, q: 0.6 });
      return;
  }
}

/** Exported for offline rendering (previews, level checks); the game goes through `audio`. */
export function playEffect(ctx: BaseAudioContext, dest: AudioNode, noise: AudioBuffer | null, effect: SoundEffect, t: number): void {
  switch (effect) {
    case 'click':
      tone(ctx, dest, { type: 'sine', freq: 1500, toFreq: 950, start: t, attack: 0.002, hold: 0, release: 0.035, peak: 0.12 });
      return;
    case 'select':
      tone(ctx, dest, { type: 'sine', freq: 1050, toFreq: 700, start: t, attack: 0.002, hold: 0, release: 0.05, peak: 0.16 });
      tone(ctx, dest, { type: 'triangle', freq: 2100, start: t, attack: 0.002, hold: 0, release: 0.03, peak: 0.04 });
      return;
    case 'confirm':
      tone(ctx, dest, { type: 'triangle', freq: 659.3, start: t, attack: 0.005, hold: 0.02, release: 0.22, peak: 0.22 });
      tone(ctx, dest, { type: 'triangle', freq: 987.8, start: t + 0.075, attack: 0.005, hold: 0.03, release: 0.32, peak: 0.22 });
      return;
    case 'cash':
      // The drawer, then the bell.
      noiseBurst(ctx, dest, noise, t, 0.25, 0.06, { type: 'bandpass', freq: 2800, q: 1.2 });
      noiseBurst(ctx, dest, noise, t + 0.035, 0.18, 0.05, { type: 'bandpass', freq: 4200, q: 1.2 });
      tone(ctx, dest, { type: 'sine', freq: 2093, start: t + 0.07, attack: 0.002, hold: 0, release: 0.6, peak: 0.16 });
      tone(ctx, dest, { type: 'sine', freq: 2637, start: t + 0.07, attack: 0.002, hold: 0, release: 0.55, peak: 0.12 });
      tone(ctx, dest, { type: 'sine', freq: 4186, start: t + 0.07, attack: 0.002, hold: 0, release: 0.25, peak: 0.04 });
      return;
    case 'notify':
      [783.99, 1046.5, 1318.5].forEach((freq, i) =>
        tone(ctx, dest, { type: 'sine', freq, start: t + i * 0.09, attack: 0.004, hold: 0.02, release: 0.45, peak: 0.16 }),
      );
      return;
    case 'alert':
      [0, 0.32].forEach((offset) => {
        tone(ctx, dest, { type: 'square', freq: 880, start: t + offset, attack: 0.004, hold: 0.07, release: 0.07, peak: 0.15, filter: { type: 'lowpass', freq: 2400 } });
        tone(ctx, dest, { type: 'square', freq: 659.3, start: t + offset + 0.14, attack: 0.004, hold: 0.07, release: 0.09, peak: 0.15, filter: { type: 'lowpass', freq: 2400 } });
      });
      return;
    case 'pause':
      tone(ctx, dest, { type: 'sine', freq: 560, toFreq: 280, start: t, attack: 0.004, hold: 0.02, release: 0.14, peak: 0.17 });
      return;
    case 'resume':
      tone(ctx, dest, { type: 'sine', freq: 280, toFreq: 560, start: t, attack: 0.004, hold: 0.02, release: 0.14, peak: 0.17 });
      return;
    case 'premiere': {
      // A short brass pickup into a held major chord, with a timpani hit under it.
      const brass = (freq: number, start: number, hold: number, peak: number) =>
        tone(ctx, dest, { type: 'sawtooth', freq, start, attack: 0.03, hold, release: 0.4, peak, filter: { type: 'lowpass', freq: 2200, q: 0.8 }, vibrato: { rate: 5.5, depth: 2 } });
      brass(392, t, 0.06, 0.09);
      brass(523.25, t + 0.13, 0.06, 0.09);
      brass(659.25, t + 0.26, 0.06, 0.09);
      for (const freq of [523.25, 659.25, 783.99, 1046.5]) brass(freq, t + 0.4, 0.75, 0.05);
      tone(ctx, dest, { type: 'sine', freq: 98, toFreq: 70, start: t + 0.4, attack: 0.01, hold: 0, release: 1.2, peak: 0.5 });
      return;
    }
    case 'hit':
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, i) => {
        tone(ctx, dest, { type: 'triangle', freq, start: t + i * 0.07, attack: 0.004, hold: 0.03, release: 0.9, peak: 0.17 });
        tone(ctx, dest, { type: 'sine', freq: freq * 2, start: t + i * 0.07, attack: 0.003, hold: 0, release: 0.4, peak: 0.04 });
      });
      return;
    case 'flop': {
      // The sad trombone: four sagging steps, the last one wobbling out.
      const notes = [392, 370, 349.2, 329.6];
      notes.forEach((freq, i) => {
        const last = i === notes.length - 1;
        tone(ctx, dest, {
          type: 'sawtooth',
          freq,
          toFreq: last ? freq * 0.97 : undefined,
          start: t + i * 0.32,
          attack: 0.04,
          hold: last ? 0.7 : 0.18,
          release: last ? 0.3 : 0.08,
          peak: 0.17,
          filter: { type: 'lowpass', freq: 900, q: 1 },
          vibrato: last ? { rate: 6, depth: 6 } : undefined,
        });
      });
      return;
    }
  }
}
