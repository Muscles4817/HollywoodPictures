// The director pitch (Phase B - docs/DESIGN_director_pitch_and_bakeoff.md). A
// director's proposed vision for a specific script: the pre-hire counterpart of
// the post-hire creative demands. A pitch is modelled as a *risk posture the
// player bets on*, not a score to maximise (SIMULATION_PHILOSOPHY Principle 1/6):
// a bold pitch (a large tonal reinterpretation, high conviction, many demands)
// WIDENS the film's outcome distribution - higher ceiling, lower floor - while a
// faithful one narrows it. The bet is chosen here and paid downstream in
// production (Phase B3), never rolled at selection.
//
// Pure, like the rest of engine/. Generation is DETERMINISTIC per (director,
// script) - the tonal shift and conviction are stable derivations of the
// director's own traits, and the previewed demands come straight from
// generateCreativeDemands (itself deterministic per director x script), so a
// pitch never reshuffles on an unrelated re-render.
import type {
  CreativeDemand,
  DirectorPitch,
  DirectorProductionStyle,
  EffectsMethodKey,
  EnvironmentMethodKey,
  Person,
  Script,
  Tone,
  ToneProfile,
} from '../types';
import { TONES, TONE_LABELS } from '../data/tones';
import { getDirectorCareer } from './person';
import { directorHandsOn } from './actingModel';
import { generateCreativeDemands, describeDemandAmbition, describeDemandCompetence } from './creativeDemands';
import { NO_RELATIONSHIP, type RelationshipStanding } from './relationships';
import { clamp } from './random';

// --- Generation --------------------------------------------------------------

// First-draft, tunable constants (top-of-module, per the repo convention). Even
// a maximal director only pulls the film part-way to their own taste - a pitch
// reinterprets the material, it doesn't overwrite it.
const MAX_TONE_PUSH = 0.5;
const PUSH_EGO_WEIGHT = 0.5;
const PUSH_HANDSON_WEIGHT = 0.5;
// Conviction: how hard they back the vision, independent of whether it's a good
// idea (that's the player's bet). Ego-led, with hands-on-ness behind it.
const CONVICTION_EGO_WEIGHT = 0.6;
const CONVICTION_HANDSON_WEIGHT = 0.4;

function egoUnit(person: Person): number {
  return clamp((person.personality?.ego ?? 50) / 100, 0, 1);
}

/**
 * This director's proposed vision for this script - deterministic per (director,
 * script). The tonal shift nudges the film toward the director's own taste in
 * proportion to how forcefully they work (ego + hands-on-ness); the demands are
 * the same set they'd bring post-hire, surfaced up front.
 */
export function generateDirectorPitch(director: Person, script: Script): DirectorPitch {
  const career = getDirectorCareer(director);
  const dirTone = career?.toneProfile ?? script.toneProfile; // no career -> no reinterpretation
  const ego = egoUnit(director);
  const handsOn = directorHandsOn(director);

  const push = clamp(ego * PUSH_EGO_WEIGHT + handsOn * PUSH_HANDSON_WEIGHT, 0, 1) * MAX_TONE_PUSH;
  const toneShift = {} as Record<Tone, number>;
  for (const tone of TONES) toneShift[tone] = Math.round((dirTone[tone] - script.toneProfile[tone]) * push);

  // A non-director person (impossible in practice) has no production style of
  // their own; fall back to the script's own implied approach - same Distribution
  // keys by design - so the pitch reads as "shoot it as written".
  const productionStyle: DirectorProductionStyle = career?.productionStyle ?? {
    environmentStrategy: { ...script.environmentStrategy },
    effectsStrategy: { ...script.effectsStrategy },
  };

  return {
    directorId: director.id,
    scriptId: script.id,
    toneShift,
    productionStyle,
    previewedDemands: generateCreativeDemands(director, script),
    conviction: Math.round(clamp(ego * CONVICTION_EGO_WEIGHT + handsOn * CONVICTION_HANDSON_WEIGHT, 0, 1) * 100) / 100,
  };
}

// --- Risk posture ------------------------------------------------------------

export type PitchPosture = 'faithful' | 'balanced' | 'bold';

// How far the mean absolute tonal shift has to reach to read as a full
// reinterpretation, and how many demands read as a full creative load - both
// tunable. Boldness blends the size of the reinterpretation, how hard they back
// it, and how much control they want.
const FULL_SHIFT = 40;
const FULL_DEMAND_LOAD = 6;
const BOLDNESS_WEIGHTS = { shift: 0.45, conviction: 0.3, demands: 0.25 };
const FAITHFUL_BELOW = 0.33;
const BOLD_AT = 0.62;

/**
 * Apply a pitch's tonal take to a tone profile: the director's signed per-axis
 * nudges (toneShift), clamped 0-100. This is the *realized* tone the finished
 * film is made in and judged on (Phase B3, engine/releaseFilm.ts) - the concept
 * and execution craft are untouched, only the tonal emphasis moves, so the pitch
 * reinterprets the material rather than rewriting it (Principle 9). A deferential
 * director's near-zero shift returns the tone essentially unchanged.
 */
export function applyDirectorToneShift(tone: ToneProfile, shift: Record<Tone, number>): ToneProfile {
  const out = {} as ToneProfile;
  for (const tone_ of TONES) out[tone_] = clamp(tone[tone_] + (shift[tone_] ?? 0), 0, 100);
  return out;
}

/** The 0-1 boldness of a pitch - the size of the bet it represents. */
export function pitchBoldness(pitch: DirectorPitch): number {
  const meanShift = TONES.reduce((sum, tone) => sum + Math.abs(pitch.toneShift[tone]), 0) / TONES.length;
  const shift = clamp(meanShift / FULL_SHIFT, 0, 1);
  const demandLoad = clamp(pitch.previewedDemands.length / FULL_DEMAND_LOAD, 0, 1);
  return clamp(shift * BOLDNESS_WEIGHTS.shift + pitch.conviction * BOLDNESS_WEIGHTS.conviction + demandLoad * BOLDNESS_WEIGHTS.demands, 0, 1);
}

/**
 * How the pitch reads as a bet: `faithful` (serves the script, narrow outcome
 * range), `bold` (a large reinterpretation, wide range - higher ceiling, lower
 * floor), or `balanced` between. This is the thing the player chooses between in
 * the bake-off, not a "which is best" verdict.
 */
export function pitchRiskPosture(pitch: DirectorPitch): PitchPosture {
  const boldness = pitchBoldness(pitch);
  if (boldness < FAITHFUL_BELOW) return 'faithful';
  if (boldness >= BOLD_AT) return 'bold';
  return 'balanced';
}

// --- Player-facing read (qualitative only, relationship-gated) ---------------

export interface PitchRead {
  posture: PitchPosture;
  /** The tonal reinterpretation, in prose - which tones they'd push and pull. */
  take: string;
  /** The production approach they'd bring, in prose. */
  approach: string;
  /** The previewed demands, each with a relationship-gated competence read - top few by conviction. */
  demands: string[];
  /** The risk framing - what kind of bet this pitch is. */
  postureSummary: string;
}

// A per-axis shift has to reach this (in tone points) to be worth calling out in
// the take prose - below it the director is broadly shooting the script as written.
const TAKE_NOTABLE = 6;
const MAX_TAKE_AXES = 2;
const MAX_DEMAND_LINES = 3;

const ENV_PHRASE: Record<EnvironmentMethodKey, string> = {
  studio: 'stage-bound',
  location: 'on-location',
  digital: 'virtual, digital',
};
const FX_PHRASE: Record<EffectsMethodKey, string> = {
  practical: 'practical effects',
  digital: 'CG-led effects',
};

const POSTURE_SUMMARY: Record<PitchPosture, string> = {
  faithful: 'A safe pair of hands - serves the script largely as written. A narrower range of outcomes: dependable, rarely transcendent.',
  balanced: 'A considered take that reshapes the film without fighting the material.',
  bold: 'A bold reinterpretation - a wider range of outcomes: a higher ceiling, but a lower floor if the vision misfires.',
};

function joinLabels(tones: Tone[]): string {
  const labels = tones.map((tone) => TONE_LABELS[tone].toLowerCase());
  if (labels.length <= 1) return labels[0] ?? '';
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

function describeTake(toneShift: Record<Tone, number>): string {
  const ups = TONES.filter((tone) => toneShift[tone] >= TAKE_NOTABLE).sort((a, b) => toneShift[b] - toneShift[a]);
  const downs = TONES.filter((tone) => toneShift[tone] <= -TAKE_NOTABLE).sort((a, b) => toneShift[a] - toneShift[b]);
  if (ups.length === 0 && downs.length === 0) {
    return 'Would shoot the script much as written, without reshaping its tone.';
  }
  const parts: string[] = [];
  if (ups.length > 0) parts.push(`lean harder into the ${joinLabels(ups.slice(0, MAX_TAKE_AXES))}`);
  if (downs.length > 0) parts.push(`pull back the ${joinLabels(downs.slice(0, MAX_TAKE_AXES))}`);
  return `Would ${parts.join(' and ')}.`;
}

function dominantKey<K extends string>(dist: Record<K, number>): K {
  return (Object.keys(dist) as K[]).reduce((best, key) => (dist[key] > dist[best] ? key : best));
}

function describeApproach(style: DirectorProductionStyle): string {
  const env = ENV_PHRASE[dominantKey(style.environmentStrategy)];
  const fx = FX_PHRASE[dominantKey(style.effectsStrategy)];
  return `${env.charAt(0).toUpperCase()}${env.slice(1)}, leaning on ${fx}.`;
}

function describeDemandLine(director: Person, demand: CreativeDemand, relationship: RelationshipStanding): string {
  return `${describeDemandAmbition(demand)} ${describeDemandCompetence(director, demand, relationship).text}`;
}

/**
 * The player-facing read of a pitch: its take, production approach, previewed
 * demands (each with a competence read only as sharp as the relationship
 * reveals - a stranger's bold script demand could be inspired or a disaster),
 * and the risk framing. Qualitative only; never raw numbers.
 */
export function describePitch(pitch: DirectorPitch, director: Person, relationship: RelationshipStanding = NO_RELATIONSHIP): PitchRead {
  const posture = pitchRiskPosture(pitch);
  const demands = [...pitch.previewedDemands]
    .sort((a, b) => b.strength - a.strength)
    .slice(0, MAX_DEMAND_LINES)
    .map((demand) => describeDemandLine(director, demand, relationship));
  return {
    posture,
    take: describeTake(pitch.toneShift),
    approach: describeApproach(pitch.productionStyle),
    demands,
    postureSummary: POSTURE_SUMMARY[posture],
  };
}
