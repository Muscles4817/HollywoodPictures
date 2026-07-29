// Workstream II, Phase C — compatibility edges. The Director ↔ approach edge:
// a director's practical/digital lean read against the chosen Execution Strategy.
// A relationship read (aligned · mixed · friction), never a quality modifier.
import { describe, it, expect } from 'vitest';
import { deriveDirectorApproachFit } from './collaborationEdges';
import type { ExecutionStrategy, ExecutionStrategyAxis } from './executionStrategy';
import type { DirectorProductionStyle } from '../types';

function style(effectsDigital: number, envDigital: number): DirectorProductionStyle {
  return {
    effectsStrategy: { practical: 1 - effectsDigital, digital: effectsDigital },
    environmentStrategy: { studio: (1 - envDigital) / 2, location: (1 - envDigital) / 2, digital: envDigital },
  };
}
const AXES: ExecutionStrategyAxis[] = ['creatureMethod', 'environmentMethod'];
const practicalStrategy: ExecutionStrategy = { creatureMethod: 'animatronic', environmentMethod: 'location' };
const digitalStrategy: ExecutionStrategy = { creatureMethod: 'fullyCG', environmentMethod: 'fullyDigital' };

describe('deriveDirectorApproachFit', () => {
  it('a practical director on a practical production reads as aligned', () => {
    const read = deriveDirectorApproachFit(style(0.1, 0.1), practicalStrategy, AXES);
    expect(read.alignment).toBe('aligned');
    expect(read.directorPrefers).toBe('practical');
    expect(read.approachIs).toBe('practical');
  });

  it('a practical director on a fully-CG production reads as friction', () => {
    const read = deriveDirectorApproachFit(style(0.1, 0.1), digitalStrategy, AXES);
    expect(read.alignment).toBe('friction');
    expect(read.directorPrefers).toBe('practical');
    expect(read.approachIs).toBe('digital');
    expect(read.headline).toMatch(/pulling against/i);
  });

  it('a digital director on a fully-CG production reads as aligned', () => {
    const read = deriveDirectorApproachFit(style(0.95, 0.95), digitalStrategy, AXES);
    expect(read.alignment).toBe('aligned');
    expect(read.approachIs).toBe('digital');
  });

  it('a middling gap reads as mixed', () => {
    // director balanced-ish (0.5), approach set-extension/hybrid (~0.5) -> aligned;
    // shift the approach digital enough to open a mixed gap.
    const read = deriveDirectorApproachFit(style(0.2, 0.2), { creatureMethod: 'hybrid', environmentMethod: 'setExtension' }, AXES);
    expect(read.alignment).toBe('mixed');
  });

  it('averages only over the axes the film exposes (creature-less film ignores creature method)', () => {
    // A practical-env director; creature method is digital but the film has no
    // creature, so only environmentMethod counts -> aligned on environment.
    const envOnly: ExecutionStrategyAxis[] = ['environmentMethod'];
    const read = deriveDirectorApproachFit(style(0.9, 0.1), { creatureMethod: 'fullyCG', environmentMethod: 'location' }, envOnly);
    expect(read.approachIs).toBe('practical'); // creature (digital) excluded
    expect(read.alignment).toBe('aligned');
  });

  it('never emits digits in the player-facing copy', () => {
    const read = deriveDirectorApproachFit(style(0.1, 0.1), digitalStrategy, AXES);
    expect(read.headline).not.toMatch(/\d/);
    expect(read.detail).not.toMatch(/\d/);
  });
});
