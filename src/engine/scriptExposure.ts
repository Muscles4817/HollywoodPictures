// Script Exposure (docs/DESIGN_REVIEW_project_clocks_and_script_openness.md
// sections 3.3 and 4.3, Phase 5 of docs/SIMULATION_PHILOSOPHY.md).
//
// A screenplay's execution craft carried NO production risk. computeStaticProductionRisk
// read `script.complexity` and nothing else of the screenplay - and complexity is
// explicitly production *scope*, not quality (types/index.ts) - so a structurally
// broken script and a brilliant one of equal complexity entered photography on
// mechanically identical terms. The thing a rewrite exists to fix had no
// consequence for the process the rewrite's time was being taken from.
//
// This module closes that gap WITHOUT collapsing it into one "unfinished script"
// modifier, which would discard exactly the typed causality Phase 1 was built to
// create. Each weakness raises the odds and severity of a PARTICULAR kind of
// trouble, and carries the named cause with it:
//
//   Weak structure   -> conflicting scene purposes, coverage inflation, assembly
//   Weak characters  -> actor objections, interpretation drift
//   Raw dialogue     -> pages changing on the day, extra takes
//   Unstable tone    -> the director, cast and departments pulling different ways
//
// Derived on demand from the stored script, never stored itself: changing what
// counts as an exposed script is a formula change with no schema churn
// (Principle 8). Pure - plain data in, plain data out.
import type { Script, Tone, ToneProfile } from '../types';
import { clamp } from './random';

export type ScriptExposureKind =
  | 'structural-instability'
  | 'character-ambiguity'
  | 'dialogue-rawness'
  | 'tonal-instability';

export interface ScriptExposure {
  kind: ScriptExposureKind;
  /** 0-1. How exposed this axis leaves the production - 0 when the draft is solid on it. */
  severity: number;
  /** The player-facing named reason, for the greenlight warning and the production report. */
  cause: string;
}

// At or above this a craft axis is a solid shooting draft and carries no
// exposure at all. Below it, severity ramps to 1 at the floor - so most
// competent scripts contribute nothing here and only genuinely thin ones do.
const SOLID_DRAFT = 65;

/** How exposed one craft axis leaves the shoot: 0 at a solid draft, ramping to 1 at the floor. */
function axisSeverity(value: number): number {
  return clamp((SOLID_DRAFT - value) / SOLID_DRAFT, 0, 1);
}

// A tone profile that says "this film is several things at once, equally" is
// harder for a director, cast and departments to agree on than one with a clear
// centre of gravity. Measured as how little the top tone leads the rest, so it
// reads off the profile's SHAPE rather than its magnitude.
const TONE_FOCUS_FLOOR = 0.28;

/** 0-1: how far the profile is from having a clear dominant tone. 0 when one tone clearly leads. */
export function toneDiffusion(profile: ToneProfile | undefined): number {
  // Read defensively: an absent profile reads as settled rather than throwing,
  // so this stays safe on the risk hot path and on partially-built fixtures.
  if (!profile) return 0;
  const values = (Object.keys(profile) as Tone[]).map((tone) => profile[tone]);
  const total = values.reduce((sum, v) => sum + v, 0);
  if (total <= 0) return 0;
  const share = Math.max(...values) / total;
  // An even spread across six tones gives share ~= 1/6; a focused script much
  // more. Below the floor is fully diffuse, at or above it is coherent enough.
  return clamp((TONE_FOCUS_FLOOR - share) / TONE_FOCUS_FLOOR, 0, 1);
}

// Below this an exposure isn't worth naming - it would be noise in the report
// and a rounding error in the risk.
const REPORTABLE_SEVERITY = 0.08;

/**
 * The typed exposures a screenplay carries into production. Ordered most-severe
 * first, so a caller wanting "the thing to worry about" can take the head.
 * Empty for a solid draft - a good script should carry no production penalty at
 * all, not merely a smaller one.
 */
export function deriveScriptExposure(script: Script): ScriptExposure[] {
  const candidates: ScriptExposure[] = [
    {
      kind: 'structural-instability',
      severity: axisSeverity(script.structure),
      cause: 'The structure is unresolved — scenes will be pulling against each other on the day',
    },
    {
      kind: 'character-ambiguity',
      severity: axisSeverity(script.characters),
      cause: 'The characters are thinly drawn — expect the cast to argue their way to an interpretation',
    },
    {
      kind: 'dialogue-rawness',
      severity: axisSeverity(script.dialogue),
      cause: 'The dialogue is raw — pages will be changing on the day',
    },
    {
      kind: 'tonal-instability',
      severity: toneDiffusion(script.toneProfile),
      cause: 'The tone is unsettled — the director, cast and departments may not be making the same film',
    },
  ];
  return candidates
    .filter((exposure) => exposure.severity >= REPORTABLE_SEVERITY)
    .sort((left, right) => right.severity - left.severity);
}

/** Convenience read for one axis - 0 when the script carries no exposure of that kind. */
export function exposureSeverity(exposures: ScriptExposure[], kind: ScriptExposureKind): number {
  return exposures.find((e) => e.kind === kind)?.severity ?? 0;
}

// How many points of each risk dimension a fully-exposed axis contributes.
// Deliberately modest: a thin script should make a shoot meaningfully harder,
// not doom it - the damage should arrive through the events these odds raise
// (which can still break either way), never as a flat penalty. Same shape as
// creativeTension.ts's own amplifier contract.
const MORALE_FROM_CHARACTERS = 14;
const MORALE_FROM_DIALOGUE = 7;
const MORALE_FROM_TONE = 12;
const TECHNICAL_FROM_STRUCTURE = 12;
const BUDGET_FROM_STRUCTURE = 10;

/** The per-dimension contributions a script's exposures make to StaticProductionRisk. */
export function scriptRiskContribution(exposures: ScriptExposure[]): {
  morale: number;
  technical: number;
  budget: number;
} {
  const characters = exposureSeverity(exposures, 'character-ambiguity');
  const dialogue = exposureSeverity(exposures, 'dialogue-rawness');
  const tone = exposureSeverity(exposures, 'tonal-instability');
  const structure = exposureSeverity(exposures, 'structural-instability');
  return {
    // Actor objections, interpretation drift, and departments pulling different
    // ways all land as interpersonal friction on the floor.
    morale: characters * MORALE_FROM_CHARACTERS + dialogue * MORALE_FROM_DIALOGUE + tone * MORALE_FROM_TONE,
    // An unresolved structure is a creative-difficulty problem before it is
    // anything else: nobody is sure what a scene is for.
    technical: structure * TECHNICAL_FROM_STRUCTURE,
    // ...and it inflates coverage, because the cure for "we'll fix it in the
    // edit" is shooting more of everything.
    budget: structure * BUDGET_FROM_STRUCTURE,
  };
}
