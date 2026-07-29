// Workstream II, Phase C — compatibility edges (docs/DESIGN_production_requirements_model.md
// Addition #2 + Revision 1 #6). A collaborator relationship, DERIVED from the two
// parties' creative-philosophy vectors rather than authored per pair, that
// produces an INTERACTION read — a story about how they'll get on — never a
// hidden quality modifier.
//
// v1 wires the one edge whose BOTH endpoints carry a real philosophy vector
// today: Director ↔ the production's approach. A director's practical↔digital
// lean (productionStyle.effectsStrategy / environmentStrategy — real data) is
// compared against the practical↔digital character of the chosen Execution
// Strategy (Layer 2). This is the computable core of the design's Director↔VFX /
// Director↔PD edges ("practical-vs-digital strategy disagreements"): the strategy
// is exactly what those departments execute. Person↔person crew edges
// (Director↔PD/DP as individuals, PD↔VFX) wait on crew heads gaining their own
// philosophy vectors (Addition #1) — not invented here.
//
// Calibration-safe, like the rest of the floor: this reads existing data and
// emits a relationship read. It feeds no cost or scoring — a philosophy clash is
// a STORY (and, later, an event/recommendation surface), not a −quality knob.
import type { DirectorProductionStyle } from '../types';
import { clamp } from './random';
import { methodDigitalCharacter, type ExecutionStrategy, type ExecutionStrategyAxis } from './executionStrategy';

/** How well two collaborators' creative philosophies line up. */
export type Alignment = 'aligned' | 'mixed' | 'friction';

export interface DirectorApproachRead {
  alignment: Alignment;
  /** Which pole the friction is on, for prose — only meaningful when not aligned. */
  directorPrefers: 'practical' | 'digital' | 'balanced';
  approachIs: 'practical' | 'digital' | 'balanced';
  headline: string; // qualitative one-liner, no digits
  detail: string;
  // --- raw, dev/test only — never shown to the player ---
  directorLean: number; // 0 practical → 1 digital
  approachLean: number; // 0 practical → 1 digital
  gap: number; // |director − approach|
}

// Which of the director's two lean axes governs each strategy axis: the creature
// method is an effects decision; the environment method an environment decision.
const AXIS_DIRECTOR_LEAN: Record<ExecutionStrategyAxis, (d: DirectorProductionStyle) => number> = {
  creatureMethod: (d) => clamp(d.effectsStrategy.digital, 0, 1),
  environmentMethod: (d) => clamp(d.environmentStrategy.digital, 0, 1),
};

function pole(lean: number): 'practical' | 'digital' | 'balanced' {
  if (lean <= 0.38) return 'practical';
  if (lean >= 0.62) return 'digital';
  return 'balanced';
}

/**
 * The Director ↔ production-approach edge. Compares the director's practical↔
 * digital lean against the chosen methods, averaged over the axes the film
 * actually exposes. Pure. `axes` is `relevantStrategyAxes(script)`.
 */
export function deriveDirectorApproachFit(
  director: DirectorProductionStyle,
  strategy: ExecutionStrategy,
  axes: ExecutionStrategyAxis[],
): DirectorApproachRead {
  const active = axes.length > 0 ? axes : (['environmentMethod'] as ExecutionStrategyAxis[]);
  const directorLean = clamp(active.reduce((s, a) => s + AXIS_DIRECTOR_LEAN[a](director), 0) / active.length, 0, 1);
  const approachLean = clamp(active.reduce((s, a) => s + methodDigitalCharacter(a, strategy), 0) / active.length, 0, 1);
  const gap = Math.abs(directorLean - approachLean);
  const alignment: Alignment = gap < 0.2 ? 'aligned' : gap < 0.45 ? 'mixed' : 'friction';
  const directorPrefers = pole(directorLean);
  const approachIs = pole(approachLean);

  let headline: string;
  let detail: string;
  if (alignment === 'aligned') {
    headline = 'Director and approach are in sync';
    detail =
      directorPrefers === 'balanced'
        ? 'Your director is comfortable across methods, and the chosen approach sits right in their range.'
        : `Your director favours a ${directorPrefers} approach, and that's how this film is being made.`;
  } else if (alignment === 'mixed') {
    headline = 'Director and approach only partly align';
    detail = `Your director leans ${directorPrefers}, the production ${approachIs} — workable, with some pushing and pulling.`;
  } else {
    headline = 'Director and approach are pulling against each other';
    detail = `Your director is a ${directorPrefers}-first film-maker, but you've committed to a ${approachIs} production — expect friction over how scenes are realised.`;
  }

  return { alignment, directorPrefers, approachIs, headline, detail, directorLean, approachLean, gap };
}
