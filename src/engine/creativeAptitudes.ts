// Domain aptitudes (docs/DESIGN_REVIEW_development_and_financing.md §5a) - the
// four crafts a creative is separately good (or not) at, distinct from `skill`
// (how good overall). Phase 2a: directors only, plus the partial, relationship-
// sharpened read the player uses to judge whether a director's demand in a given
// domain is worth accepting (the "Snyder principle": a great visual director can
// be a weak story mind, and ceding the script to them usually hurts the film).
//
// Pure, like the rest of engine/. An unauthored aptitude vector is a STABLE
// per-person derivation (engine/actingModel.ts:stableUnit, not rng and not a live
// dial - exactly the discipline directorHandsOn/crewPhilosophy already use), so a
// generated pool never shifts underfoot and the same director always reads the
// same. An authored DirectorCareer.aptitudes (marquee directors with a real
// reputation) overrides it.
import type { DomainAptitudes, Person } from '../types';
import { getDirectorCareer } from './person';
import { stableUnit } from './actingModel';
import { NO_RELATIONSHIP, type RelationshipStanding } from './relationships';
import { clamp } from './random';

export type AptitudeDomain = keyof DomainAptitudes;

export const APTITUDE_DOMAINS: AptitudeDomain[] = ['story', 'visual', 'performance', 'craft'];

// How far a derived domain can swing from the director's overall skill: a stable
// per-(person, domain) offset of ± half this. Deliberately moderate - overall
// skill stays meaningful (a great director is generally good, a poor one
// generally not), while domains still genuinely diverge. Truly dramatic
// "great visual / weak story" splits are what AUTHORED marquee aptitudes are for.
const APTITUDE_SPREAD = 50;

/**
 * A director's four domain aptitudes: the authored vector if present, otherwise
 * a stable per-person derivation centred on overall `skill` with an independent
 * per-domain offset (keyed on `id|aptitude|<domain>` so each domain varies on its
 * own and the whole vector is deterministic). Falls back to a skill of 50 for the
 * impossible-in-practice non-director person, matching how directorHandsOn stays
 * total under the same case.
 */
export function deriveDirectorAptitudes(person: Person): DomainAptitudes {
  const career = getDirectorCareer(person);
  const authored = career?.aptitudes;
  if (authored) {
    return {
      story: clamp(Math.round(authored.story), 0, 100),
      visual: clamp(Math.round(authored.visual), 0, 100),
      performance: clamp(Math.round(authored.performance), 0, 100),
      craft: clamp(Math.round(authored.craft), 0, 100),
    };
  }
  const skill = career?.skill ?? 50;
  const id = person.id ?? person.identity.name;
  const axis = (domain: AptitudeDomain) =>
    clamp(Math.round(skill + (stableUnit(`${id}|aptitude|${domain}`) - 0.5) * APTITUDE_SPREAD), 0, 100);
  return { story: axis('story'), visual: axis('visual'), performance: axis('performance'), craft: axis('craft') };
}

// --- Partial, relationship-sharpened reveal ---------------------------------
//
// The player never sees the raw numbers (house rule 3). At arm's length they get
// a reputation-level read - the director's standout strength, and a hint at a
// standout weakness only if it's pronounced. Working together sharpens it: one or
// two films resolves the strongest AND weakest domains; a real history resolves
// all four. Relationship is the lens, never a quality change.

export type AptitudeBand = 'exceptional' | 'strong' | 'solid' | 'shaky' | 'weak';
export type AptitudeReadResolution = 'reputation' | 'familiar' | 'intimate';

export interface DirectorAptitudeRead {
  /** How sharp the read is, set by how much the studio has worked with this director. */
  resolution: AptitudeReadResolution;
  /** Qualitative band per domain - only the domains this resolution actually reveals. */
  domains: Partial<Record<AptitudeDomain, AptitudeBand>>;
  /** A one-line diegetic summary composed from the revealed domains. Never contains numbers. */
  summary: string;
}

// Films worked together at/above which the read is fully resolved (all four
// domains). One or two films is a "familiar" read (strongest + weakest only).
const INTIMATE_COLLABS = 3;

function bandFor(value: number): AptitudeBand {
  if (value >= 85) return 'exceptional';
  if (value >= 70) return 'strong';
  if (value >= 50) return 'solid';
  if (value >= 35) return 'shaky';
  return 'weak';
}

const DOMAIN_NOUN: Record<AptitudeDomain, string> = {
  story: 'story and script',
  visual: 'visual craft',
  performance: 'directing performances',
  craft: 'editorial craft',
};

const BAND_ADJECTIVE: Record<AptitudeBand, string> = {
  exceptional: 'a commanding',
  strong: 'a strong',
  solid: 'a capable',
  shaky: 'an uncertain',
  weak: 'a weak',
};

function resolutionFor(collaborations: number): AptitudeReadResolution {
  if (collaborations >= INTIMATE_COLLABS) return 'intimate';
  if (collaborations >= 1) return 'familiar';
  return 'reputation';
}

/** The domain with the highest aptitude, then lowest - ties broken by APTITUDE_DOMAINS order (deterministic). */
function strongestAndWeakest(aptitudes: DomainAptitudes): { strongest: AptitudeDomain; weakest: AptitudeDomain } {
  let strongest = APTITUDE_DOMAINS[0];
  let weakest = APTITUDE_DOMAINS[0];
  for (const d of APTITUDE_DOMAINS) {
    if (aptitudes[d] > aptitudes[strongest]) strongest = d;
    if (aptitudes[d] < aptitudes[weakest]) weakest = d;
  }
  return { strongest, weakest };
}

/**
 * The player-facing read of a director's domain aptitudes, sharpened by how much
 * the studio has worked with them (relationship.collaborations). Qualitative
 * only. `reputation` (strangers) names the standout strength, plus a standout
 * weakness only when it's genuinely weak and clearly below that strength;
 * `familiar` resolves strongest + weakest; `intimate` resolves all four.
 */
export function describeDirectorAptitudes(
  person: Person,
  relationship: RelationshipStanding = NO_RELATIONSHIP,
): DirectorAptitudeRead {
  const aptitudes = deriveDirectorAptitudes(person);
  const resolution = resolutionFor(relationship.collaborations);
  const { strongest, weakest } = strongestAndWeakest(aptitudes);

  const domains: Partial<Record<AptitudeDomain, AptitudeBand>> = {};
  if (resolution === 'intimate') {
    for (const d of APTITUDE_DOMAINS) domains[d] = bandFor(aptitudes[d]);
  } else if (resolution === 'familiar') {
    domains[strongest] = bandFor(aptitudes[strongest]);
    domains[weakest] = bandFor(aptitudes[weakest]);
  } else {
    // reputation: always the standout strength; the weakness only if pronounced.
    domains[strongest] = bandFor(aptitudes[strongest]);
    const weakBand = bandFor(aptitudes[weakest]);
    const pronouncedWeak = (weakBand === 'shaky' || weakBand === 'weak') && aptitudes[strongest] - aptitudes[weakest] >= 20;
    if (pronouncedWeak && weakest !== strongest) domains[weakest] = weakBand;
  }

  return { resolution, domains, summary: composeSummary(resolution, domains, strongest, weakest) };
}

function composeSummary(
  resolution: AptitudeReadResolution,
  domains: Partial<Record<AptitudeDomain, AptitudeBand>>,
  strongest: AptitudeDomain,
  weakest: AptitudeDomain,
): string {
  const phrase = (d: AptitudeDomain) => `${BAND_ADJECTIVE[domains[d]!]} ${DOMAIN_NOUN[d]}`;
  if (resolution === 'intimate') {
    return `Known well: ${APTITUDE_DOMAINS.map((d) => phrase(d)).join(', ')}.`;
  }
  if (resolution === 'familiar') {
    if (strongest === weakest) return `A dependable, even hand - ${phrase(strongest)} across the board.`;
    return `${capitalize(phrase(strongest))}, but ${phrase(weakest)}.`;
  }
  // reputation
  if (domains[weakest] && weakest !== strongest) {
    return `Reputation: ${phrase(strongest)} - though less sure-footed with ${DOMAIN_NOUN[weakest]}.`;
  }
  return `Reputation: ${phrase(strongest)}.`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
