import { describe, it, expect } from 'vitest';
import { createRng } from './random';
import { generateScriptOptions } from './scriptGenerator';
import type { Genre, ScriptArchetype, ToneProfile, WriterCreativeProfile } from '../types';

const FLAT_GENRE: Record<Genre, number> = {
  Action: 50, Comedy: 50, Drama: 50, Horror: 50, Romance: 50, 'Sci-Fi': 50, Fantasy: 50, Thriller: 50,
};
const FLAT_TONE: ToneProfile = { action: 50, comedy: 50, romance: 50, suspense: 50, drama: 50, spectacle: 50 };

function profile(overrides: Partial<WriterCreativeProfile> = {}): WriterCreativeProfile {
  return {
    skill: 70,
    craft: { originality: 50, structure: 50, characters: 50, dialogue: 50 },
    toneProfile: { ...FLAT_TONE },
    genreAffinity: { ...FLAT_GENRE },
    commercialLean: 50,
    consistency: 60,
    ...overrides,
  };
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => { const m = avg(xs); return Math.sqrt(avg(xs.map((x) => (x - m) ** 2))); };
const share = (scripts: { archetype: ScriptArchetype }[], set: ScriptArchetype[]) => scripts.filter((s) => set.includes(s.archetype)).length / scripts.length;

describe('writer influence on screenplay generation', () => {
  it('a strong-dialogue writer produces higher-dialogue scripts than a weak-dialogue one, on average', () => {
    const strong = generateScriptOptions('Drama', createRng(1), 60, profile({ craft: { originality: 50, structure: 50, characters: 50, dialogue: 95 } }));
    const weak = generateScriptOptions('Drama', createRng(1), 60, profile({ craft: { originality: 50, structure: 50, characters: 50, dialogue: 15 } }));
    expect(avg(strong.map((s) => s.dialogue))).toBeGreaterThan(avg(weak.map((s) => s.dialogue)) + 10);
  });

  it('a commercial writer skews toward crowd-pleasing archetypes more than a prestige writer does', () => {
    const commercial = generateScriptOptions('Drama', createRng(2), 150, profile({ commercialLean: 95 }));
    const prestige = generateScriptOptions('Drama', createRng(2), 150, profile({ commercialLean: 5 }));
    expect(share(commercial, ['CrowdPleaser', 'GenreFormula', 'Spectacle'])).toBeGreaterThan(share(prestige, ['CrowdPleaser', 'GenreFormula', 'Spectacle']));
  });

  it("pulls a script's tone toward the writer's tonal signature", () => {
    const comedic = generateScriptOptions('Drama', createRng(3), 60, profile({ toneProfile: { action: 20, comedy: 95, romance: 30, suspense: 30, drama: 40, spectacle: 20 } }));
    const plain = generateScriptOptions('Drama', createRng(3), 60);
    expect(avg(comedic.map((s) => s.toneProfile.comedy))).toBeGreaterThan(avg(plain.map((s) => s.toneProfile.comedy)) + 5);
  });

  it('low consistency widens craft variance versus high consistency, for the same craft target', () => {
    const craft = { originality: 60, structure: 60, characters: 60, dialogue: 60 };
    const volatile = generateScriptOptions('Drama', createRng(4), 150, profile({ craft, consistency: 5 }));
    const steady = generateScriptOptions('Drama', createRng(4), 150, profile({ craft, consistency: 98 }));
    expect(sd(volatile.map((s) => s.dialogue))).toBeGreaterThan(sd(steady.map((s) => s.dialogue)));
  });

  it('archetype-first still dominates: even a hard-prestige writer yields a spread of archetypes, not a single one', () => {
    const scripts = generateScriptOptions('Action', createRng(5), 120, profile({ commercialLean: 2 }));
    expect(new Set(scripts.map((s) => s.archetype)).size).toBeGreaterThan(1);
  });

  it('un-authored generation stays deterministic, and omitting the author equals passing undefined', () => {
    // Ids are minted outside the rng stream (Date.now()+random - Phase 1) so are
    // deliberately non-reproducible; every rng-derived field must still match.
    const stripIds = (scripts: ReturnType<typeof generateScriptOptions>) =>
      scripts.map(({ id: _id, cast, ...rest }) => ({ ...rest, cast: cast.map(({ id: _cid, ...c }) => c) }));
    const a = generateScriptOptions('Drama', createRng(9), 12);
    const b = generateScriptOptions('Drama', createRng(9), 12);
    const c = generateScriptOptions('Drama', createRng(9), 12, undefined);
    expect(stripIds(b)).toEqual(stripIds(a));
    expect(stripIds(c)).toEqual(stripIds(a));
  });
});
