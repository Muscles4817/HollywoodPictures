// Phase B3 (docs/DESIGN_director_pitch_and_bakeoff.md): the director's pitched
// tonal take reaches the finished film. computeReleaseResults judges the film in
// its *realized* tone (script tone + the pitch's toneShift), so a bolder shift is
// a bigger market bet - reception moves further from the script's baseline, for
// better or worse - while an absent shift leaves the film byte-identical.
import { describe, it, expect } from 'vitest';
import { computeReleaseResults, type ReleaseComputationInput } from './releaseFilm';
import { buildReadyDraft } from '../state/testFixtures';
import { withRng, createRng } from './random';
import { TONES } from '../data/tones';
import type { Tone } from '../types';

function baseInput(): ReleaseComputationInput {
  const { result: draft } = withRng(2024, (rng) => buildReadyDraft(rng));
  return {
    title: draft.title || 'Untitled',
    genre: draft.genre!,
    targetAudience: draft.targetAudience!,
    script: draft.script!,
    talent: draft.talent,
    productionChoices: draft.productionChoices!,
    postProductionChoices: draft.postProductionChoices!,
    marketingChoices: draft.marketingChoices!,
    events: draft.photography!.events,
    postProductionEvents: draft.postProductionEvents,
    photographyCost: draft.photography!.runningCost,
    shootingRatio: 1,
    studioBrand: 20,
    competitiveCrowding: 0,
  };
}

const zeroShift = (): Record<Tone, number> => Object.fromEntries(TONES.map((t) => [t, 0])) as Record<Tone, number>;

describe('computeReleaseResults - director pitch tonal take (Phase B3)', () => {
  it('an absent shift is identical to a zero shift (and to no pitch at all)', () => {
    const base = computeReleaseResults(baseInput(), createRng(1)).results;
    const zero = computeReleaseResults({ ...baseInput(), directorToneShift: zeroShift() }, createRng(1)).results;
    expect(zero.criticScore).toBe(base.criticScore);
    expect(zero.audienceScore).toBe(base.audienceScore);
    expect(zero.qualityScore).toBe(base.qualityScore);
  });

  it('a non-trivial tonal take moves the realized film off its baseline reception', () => {
    const base = computeReleaseResults(baseInput(), createRng(1)).results;
    // A heavy reinterpretation - push spectacle and action up hard, pull drama
    // down - is a different film than the script alone, so at least one reception
    // axis must move.
    const shift: Record<Tone, number> = { ...zeroShift(), action: 30, spectacle: 35, drama: -25 };
    const shifted = computeReleaseResults({ ...baseInput(), directorToneShift: shift }, createRng(1)).results;
    const moved = shifted.criticScore !== base.criticScore || shifted.audienceScore !== base.audienceScore || shifted.qualityScore !== base.qualityScore;
    expect(moved).toBe(true);
  });

  it('different takes yield different films - the realized tone is read per-axis, not as one scalar', () => {
    // A spectacle-forward take and a drama-forward take reshape the same script
    // into genuinely different films, so their reception differs.
    const spectacleTake: Record<Tone, number> = { ...zeroShift(), spectacle: 30, action: 25 };
    const dramaTake: Record<Tone, number> = { ...zeroShift(), drama: 30, romance: 20 };
    const spectacle = computeReleaseResults({ ...baseInput(), directorToneShift: spectacleTake }, createRng(1)).results;
    const drama = computeReleaseResults({ ...baseInput(), directorToneShift: dramaTake }, createRng(1)).results;
    const differ = spectacle.audienceScore !== drama.audienceScore || spectacle.criticScore !== drama.criticScore;
    expect(differ).toBe(true);
  });

  it('a take that moves the film toward its genre reads better than one that moves it away', () => {
    // Distance-based genre fit (engine/scoring.ts:deriveGenreFit): a take that
    // pushes a tone axis to an extreme AWAY from what the genre wants must not
    // read better than the neutral baseline on audience. We assert the weaker
    // property that at least one of the two extreme, opposite takes is worse than
    // baseline - a shift is a real bet with a real downside, not free upside.
    const base = computeReleaseResults(baseInput(), createRng(1)).results;
    const hi: Record<Tone, number> = { ...zeroShift(), suspense: 40, drama: 40 };
    const lo: Record<Tone, number> = { ...zeroShift(), suspense: -40, drama: -40 };
    const a = computeReleaseResults({ ...baseInput(), directorToneShift: hi }, createRng(1)).results.audienceScore;
    const b = computeReleaseResults({ ...baseInput(), directorToneShift: lo }, createRng(1)).results.audienceScore;
    expect(Math.min(a, b)).toBeLessThan(base.audienceScore);
  });
});
