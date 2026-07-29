// Workstream II, Phase C — compatibility edges (docs/DESIGN_production_requirements_model.md
// Addition #2 + Revision 1 #6). A collaborator relationship, DERIVED from the two
// parties' creative-philosophy vectors rather than authored per pair, that
// produces an INTERACTION read — a story about how they'll get on — never a
// hidden quality modifier.
//
// Two kinds of edge live here:
//  1. Director ↔ the production's approach — the director's practical↔digital
//     lean vs the chosen Execution Strategy (Layer 2). The computable core of the
//     design's Director↔VFX/PD "practical-vs-digital" disagreement, mediated by
//     the strategy those departments execute.
//  2. Person↔person edges (Director↔PD, Director↔VFX, PD↔VFX) — now that crew
//     heads carry a creative-philosophy vector (Addition #1,
//     engine/crewPhilosophy.ts), these are DERIVED from the two heads' vectors,
//     O(N) data with the O(N²) edges emergent. Actor↔Stunt and Composer/Editor
//     edges still wait on those parties gaining vectors.
//
// Calibration-safe, like the rest of the floor: this reads existing data and
// emits a relationship read. It feeds no cost or scoring — a philosophy clash is
// a STORY (and, later, an event/recommendation surface), not a −quality knob.
import type { CrewPhilosophy, DirectorProductionStyle, FilmDraft } from '../types';
import { clamp } from './random';
import { methodDigitalCharacter, type ExecutionStrategy, type ExecutionStrategyAxis } from './executionStrategy';
import { getDirectorCareer } from './person';
import { crewPhilosophy, directorPhilosophy } from './crewPhilosophy';

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

// --- Person↔person collaborator edges (Addition #1 unlock) -----------------
// DERIVED from the two heads' creative-philosophy vectors (never authored per
// pair, so data stays O(N) and the edges are emergent). Each produces a
// relationship read on the two axes; the dominant disagreement names the topic.

/** A collaborator relationship read between two attached heads. */
export interface CollaboratorEdgeRead {
  pair: string; // "Director & Production Designer"
  alignment: Alignment;
  topic: 'practical vs digital' | 'grounded vs stylised' | 'aligned';
  headline: string;
  detail: string;
  gap: number; // dev/test only
}

function alignmentFromGap(gap: number): Alignment {
  if (gap < 0.18) return 'aligned';
  if (gap < 0.4) return 'mixed';
  return 'friction';
}

function edgeRead(aLabel: string, bLabel: string, a: CrewPhilosophy, b: CrewPhilosophy): CollaboratorEdgeRead {
  const digitalGap = Math.abs(a.digitalAffinity - b.digitalAffinity);
  const styleGap = Math.abs(a.stylisation - b.stylisation);
  const gap = (digitalGap + styleGap) / 2;
  const alignment = alignmentFromGap(gap);
  const pair = `${aLabel} & ${bLabel}`;
  if (alignment === 'aligned') {
    return { pair, alignment, topic: 'aligned', headline: `${pair} see eye to eye`, detail: `Their creative instincts line up — expect a smooth, mutually reinforcing collaboration.`, gap };
  }
  const digitalDominant = digitalGap >= styleGap;
  const topic = digitalDominant ? 'practical vs digital' : 'grounded vs stylised';
  const axisPhrase = digitalDominant
    ? 'one leans practical and tactile, the other digital'
    : 'one wants it grounded, the other heightened and stylised';
  const verb = alignment === 'friction' ? 'clash' : 'differ';
  return {
    pair, alignment, topic,
    headline: `${pair} ${verb} over ${topic}`,
    detail: `On this production ${axisPhrase} — ${alignment === 'friction' ? 'a real source of friction to manage.' : 'a workable difference, with some negotiation.'}`,
    gap,
  };
}

/**
 * The active collaborator edges among the attached creative heads (Director,
 * Production Designer, VFX Supervisor), derived from their philosophy vectors.
 * Only edges whose BOTH heads are attached appear. Director maps into the same
 * philosophy space via directorPhilosophy. Pure.
 */
export function deriveCrewCollaborationReads(draft: FilmDraft): CollaboratorEdgeRead[] {
  const personFor = (role: string) => draft.talent.find((a) => a.role === role)?.person;
  const directorPerson = personFor('Director');
  const directorCareer = directorPerson ? getDirectorCareer(directorPerson) : null;
  const director = directorCareer ? directorPhilosophy(directorCareer) : null;
  const pdPerson = personFor('Production Designer');
  const pd = pdPerson ? crewPhilosophy(pdPerson, 'Production Designer') : null;
  const vfxPerson = personFor('VFX Supervisor');
  const vfx = vfxPerson ? crewPhilosophy(vfxPerson, 'VFX Supervisor') : null;

  const reads: CollaboratorEdgeRead[] = [];
  if (director && pd) reads.push(edgeRead('Director', 'Production Designer', director, pd));
  if (director && vfx) reads.push(edgeRead('Director', 'VFX Supervisor', director, vfx));
  if (pd && vfx) reads.push(edgeRead('Production Designer', 'VFX Supervisor', pd, vfx));
  return reads;
}
