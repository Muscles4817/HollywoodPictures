// The creative-disagreement engine (Phase 2b - docs/DESIGN_REVIEW_development_and_financing.md
// §5/§5a). A director attached during development brings *opinions*: a set of
// demands to take control of specific crafts. Accepting one cedes that craft to
// them - a BET whose expected value is keyed to their aptitude in that exact
// domain (the "Snyder principle": a brilliant visual director is often a poor
// writer, and letting them rewrite the script usually hurts it). Refusing keeps
// control (no quality change in 2b; tension and walk-risk arrive in 2c).
//
// Pure, like the rest of engine/. Generation is DETERMINISTIC per (director,
// script) and resolution DETERMINISTIC per demand id - both seed their own rng
// (engine/random.ts) rather than threading the main stream, so demands never
// reshuffle on unrelated re-renders and an accepted demand's outcome is fixed
// once (the same "roll once, deterministic thereafter" shape rewrite/commission
// already use).
import type {
  CreativeDemand,
  CreativeDemandDomain,
  Person,
  Script,
  ToneProfile,
} from '../types';
import {
  deriveDirectorAptitudes,
  bandFor,
  APTITUDE_DOMAIN_NOUN,
  type AptitudeDomain,
  type AptitudeBand,
  type DirectorAptitudeRead,
} from './creativeAptitudes';
import { describeDirectorAptitudes } from './creativeAptitudes';
import { getDirectorCareer } from './person';
import { directorHandsOn, stableUnit } from './actingModel';
import { NO_RELATIONSHIP, type RelationshipStanding } from './relationships';
import { clamp, createRng, randFloat } from './random';

// Which single aptitude decides whether ceding this domain helps or hurts. The
// whole design pivots on this map: a Script demand is judged by the director's
// Story aptitude, a Cinematography demand by their Visual aptitude, and so on -
// so a spiky director is great to cede to in some domains and ruinous in others.
// 'Scale' is intentionally absent: it's a budget/scope side-effect demand wired
// in Phase 2c, not generated here.
const DEMAND_GOVERNOR: Partial<Record<CreativeDemandDomain, AptitudeDomain>> = {
  Script: 'story',
  Casting: 'performance',
  Cinematography: 'visual',
  ProductionDesign: 'visual',
  Edit: 'craft',
  Score: 'craft',
  VFX: 'visual',
  Practical: 'visual',
};

const GENERABLE_DOMAINS = Object.keys(DEMAND_GOVERNOR) as CreativeDemandDomain[];

/** The aptitude that governs a demand's domain (Visual for a Cinematography demand, etc.). */
export function demandGovernor(domain: CreativeDemandDomain): AptitudeDomain {
  return DEMAND_GOVERNOR[domain] ?? 'story';
}

const MAX_DEMANDS = 10; // the cap the design sets; a low-ego, aligned director lands near 0
const BLOCKING_STRENGTH = 0.6; // a high-conviction demand the player must resolve before Greenlight
const MAX_QUALITY_DELTA = 10; // per-demand quality swing, in the same small scale a production event's qualityDelta uses

const TONE_KEYS: (keyof ToneProfile)[] = ['action', 'comedy', 'romance', 'suspense', 'drama', 'spectacle'];

/** 0-1 distance between two tone profiles (normalised Euclidean over the six axes) - how far the director's taste sits from the material. */
function toneDistance(a: ToneProfile, b: ToneProfile): number {
  let sumSq = 0;
  for (const k of TONE_KEYS) sumSq += ((a[k] - b[k]) / 100) ** 2;
  return clamp(Math.sqrt(sumSq / TONE_KEYS.length), 0, 1);
}

/** 0-1 read of how uneven a director's aptitudes are - a spiky vector means strong, potentially misplaced opinions. */
function aptitudeSpikiness(a: { story: number; visual: number; performance: number; craft: number }): number {
  const values = [a.story, a.visual, a.performance, a.craft];
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return clamp(Math.sqrt(variance) / 35, 0, 1); // ~35 std maps to a fully spiky read
}

/**
 * How many demands this director makes on this script (0-10). The product of
 * PROPENSITY (ego + hands-on-ness: how much they insist on their way at all) and
 * CLASH (tone mismatch + how spiky their aptitudes are: how much this specific
 * pairing rubs). A low-ego, versatile director on aligned material lands at ~0 -
 * the "yes-man" who does as they're told (and whose film then lives or dies on
 * the script and crew alone).
 */
export function deriveDemandLoad(director: Person, script: Script): number {
  const career = getDirectorCareer(director);
  const apt = deriveDirectorAptitudes(director);
  const ego = (director.personality?.ego ?? 50) / 100;
  const handsOn = directorHandsOn(director); // 0..1
  const propensity = clamp(ego * 0.6 + handsOn * 0.4, 0, 1);
  const tone = career ? toneDistance(career.toneProfile, script.toneProfile) : 0.3;
  const clash = clamp(tone * 0.6 + aptitudeSpikiness(apt) * 0.4, 0, 1);
  return Math.round(propensity * clash * MAX_DEMANDS);
}

/**
 * The director's creative demands on this script - deterministic per (director,
 * script). Domains are weighted toward where the director's aptitude deviates
 * most from their own average (where their opinions are strongest), so the set
 * naturally mixes demands worth granting (their genuine strengths) with
 * over-reaches (the domains they wrongly think they're good at) - the judgement
 * the player has to make.
 */
export function generateCreativeDemands(director: Person, script: Script): CreativeDemand[] {
  const n = deriveDemandLoad(director, script);
  if (n <= 0) return [];
  const apt = deriveDirectorAptitudes(director);
  const mean = (apt.story + apt.visual + apt.performance + apt.craft) / 4;
  const ego = (director.personality?.ego ?? 50) / 100;
  const rng = createRng(Math.floor(stableUnit(`${director.id}|${script.id}|demands`) * 2 ** 31));

  // Score each generable domain by how strong an opinion the director has there
  // (aptitude distance from their own mean), with a little stable jitter, then
  // take the top n - distinct by construction, deterministic given the seed.
  const scored = GENERABLE_DOMAINS.map((domain) => {
    const deviation = Math.abs(apt[demandGovernor(domain)] - mean); // 0..~50
    const score = (1 + deviation / 10) * (0.7 + 0.6 * rng());
    return { domain, deviation, score };
  }).sort((a, b) => b.score - a.score);

  return scored.slice(0, Math.min(n, GENERABLE_DOMAINS.length)).map(({ domain, deviation }) => {
    const strength = clamp(ego * 0.5 + (deviation / 50) * 0.4 + randFloat(rng, 0, 0.2), 0.2, 1);
    return {
      id: `demand-${director.id}-${script.id}-${domain}`,
      demanderId: director.id,
      domain,
      strength: Math.round(strength * 100) / 100,
      blocking: strength >= BLOCKING_STRENGTH,
    };
  });
}

/**
 * The quality outcome of ACCEPTING a demand (the Snyder bet), rolled once and
 * deterministic per demand id. Expected value tracks the director's aptitude in
 * the governing domain: cede a domain they command and it lifts the film; cede
 * one they're weak at (an over-reach) and it drags it down - with real variance
 * either way, so it is genuinely a bet. In the same small +/-10 scale a
 * production event's qualityDelta uses (folded unamplified into Quality).
 */
export function resolveDemandQualityDelta(demand: CreativeDemand, director: Person): number {
  const apt = deriveDirectorAptitudes(director);
  const competence = (apt[demandGovernor(demand.domain)] - 50) / 50; // -1..+1
  const rng = createRng(Math.floor(stableUnit(`${demand.id}|resolve`) * 2 ** 31));
  const base = demand.strength * competence * MAX_QUALITY_DELTA;
  const noise = randFloat(rng, -1, 1) * (MAX_QUALITY_DELTA * 0.4);
  return clamp(Math.round(base + noise), -MAX_QUALITY_DELTA, MAX_QUALITY_DELTA);
}

/** The net accepted-demand quality swing to freeze at Greenlight - the sum of every accepted demand's rolled qualityDelta. */
export function acceptedDemandQualityDelta(demands: CreativeDemand[] | undefined): number {
  if (!demands) return 0;
  return demands.reduce((sum, d) => sum + (d.resolution === 'accepted' ? (d.qualityDelta ?? 0) : 0), 0);
}

/** Whether any BLOCKING demand is still unresolved - the gate project readiness reads before allowing Greenlight. */
export function hasUnresolvedBlockingDemand(demands: CreativeDemand[] | undefined): boolean {
  return !!demands?.some((d) => d.blocking && !d.resolution);
}

// --- Player-facing prose (qualitative only) ---------------------------------

const DEMAND_TEXT: Record<CreativeDemandDomain, string> = {
  Script: 'wants to take their own pass at the screenplay',
  Casting: 'wants to recast a key role their own way',
  Cinematography: 'insists on their own cinematographer and visual approach',
  ProductionDesign: 'wants to overhaul the production design',
  Edit: 'demands final say in the edit',
  Score: 'wants to bring their own composer and shape the sound',
  VFX: 'wants to direct the effects approach',
  Practical: 'wants to stage the action and stunts their way',
  Scale: 'wants to push the scale and budget up',
};

/** A one-line, diegetic description of what the director is asking for. */
export function describeCreativeDemand(demand: CreativeDemand): string {
  return `Your director ${DEMAND_TEXT[demand.domain]}.`;
}

const BAND_JUDGEMENT: Record<AptitudeBand, string> = {
  exceptional: 'a commanding strength of theirs',
  strong: 'a real strength of theirs',
  solid: 'safely within their wheelhouse',
  shaky: 'not a strength of theirs',
  weak: 'a genuine weak spot for them',
};

export interface DemandCompetenceRead {
  /** The governing domain's band, if the relationship reveals it; absent when you don't know the director well enough. */
  band?: AptitudeBand;
  /** A qualitative hint the player uses to judge whether to accept - never numbers. */
  text: string;
}

/**
 * The read the player judges a demand by: how good the director actually is in
 * the domain they want control over - but only as sharply as the relationship
 * reveals (Phase 2a). With a director you barely know, you genuinely can't tell
 * if their script demand is inspired or a disaster; a real working history makes
 * the call clear. This is what makes attaching a *known* director safer.
 */
export function describeDemandCompetence(
  director: Person,
  demand: CreativeDemand,
  relationship: RelationshipStanding = NO_RELATIONSHIP,
): DemandCompetenceRead {
  const read: DirectorAptitudeRead = describeDirectorAptitudes(director, relationship);
  const governor = demandGovernor(demand.domain);
  const band = read.domains[governor];
  const noun = APTITUDE_DOMAIN_NOUN[governor];
  if (!band) {
    return { text: `You don't yet know this director's ${noun} well enough to judge - work with them more to read it.` };
  }
  return { band, text: `Their ${noun} is ${BAND_JUDGEMENT[band]}.` };
}

// Re-export for callers that want the raw band mapping alongside the demand helpers.
export { bandFor };
