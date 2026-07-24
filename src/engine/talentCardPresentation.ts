// Talent Card UX Redesign (user request) - the presentation reads that let a
// redesigned candidate card speak in more than one visual language. Everything
// here is qualitative and derived, never a raw stat handed to the player
// (CLAUDE.md house style): a single risk verdict instead of four personality
// star rows, magnitude words instead of bars-of-stars, a one-line "why" behind
// the hiring verdict, and the head-to-head recommendation the two-candidate
// comparison view leads with.
//
// Pure (plain data in, plain data out) like the rest of engine/ - the card
// components import these and render, they don't recompute. Phrasing lives here
// alongside the classification, the same "derive and phrase together" split
// engine/castingPresentation.ts already uses for the appeal reads.
import { deriveTraits } from './personTraits';
import type { Person } from '../types';

// --- Magnitude words -------------------------------------------------------
// A 0-100 reputation/skill value as the qualitative band a player actually
// reasons about ("a high-prestige name"), so Industry standing can read as
// labelled bars rather than yet another star row. Bands are deliberately
// coarse - five buckets, matching how blunt the underlying number really is.
export function qualitativeMagnitude(value: number): string {
  if (value >= 80) return 'Very high';
  if (value >= 62) return 'High';
  if (value >= 45) return 'Moderate';
  if (value >= 28) return 'Low';
  return 'Very low';
}

// Fame at or above this reads as genuine marquee draw - the one place the card
// keeps a star, as a "★ Star draw" flag rather than a rated row (user request:
// keep a single, purposeful star use). Matches actingModel's own FAME_HIGH.
const STAR_DRAW_FAME = 62;

/** Whether this person is a real box-office draw - drives the one kept star flourish on the card. */
export function isStarDraw(person: Person): boolean {
  return person.reputation.fame >= STAR_DRAW_FAME;
}

// --- Risk verdict ----------------------------------------------------------
// The four raw personality star rows (professionalism/temperament/ego/
// controversy) collapse into one traffic-light verdict. The named risk traits
// deriveTraits already computes (ScandalProne, DifficultToWorkWith) are the
// real signal; reliability and controversy round out the read. Tunable
// first-draft thresholds, like every cutoff in this sim.
export type RiskTier = 'dependable' | 'some-risk' | 'volatile';

export interface RiskRead {
  tier: RiskTier;
  label: string;
}

export function deriveRiskRead(person: Person): RiskRead {
  const traits = deriveTraits(person);
  const scandalProne = traits.includes('ScandalProne');
  const difficult = traits.includes('DifficultToWorkWith');
  const { reliability } = person.reputation;
  const { controversy, temperament } = person.personality;

  // Volatile - a genuine red flag you'd plan a production around.
  if ((scandalProne && difficult) || (scandalProne && controversy >= 75) || reliability < 30) {
    return { tier: 'volatile', label: 'Volatile' };
  }
  // Some risk - a manageable but real concern worth a glance.
  if (scandalProne || difficult || reliability < 50 || controversy >= 65 || temperament < 35) {
    return { tier: 'some-risk', label: 'Some risk' };
  }
  return { tier: 'dependable', label: 'Dependable' };
}

// --- The verdict's "why" ---------------------------------------------------
// The one-line reason under the hiring verdict, built from the same per-axis
// role-fit breakdown the card already computes - a couple of genuine strengths
// and, honestly, the single weakest axis as a caveat. This is the "earned
// recommendation" (user request): the sim already knows the best and worst
// axis, so say so rather than only showing the tier.
export interface FitReason {
  /** The strengths sentence, e.g. "Perfect emotional fit and strong transformation." */
  strengths: string;
  /** The honest caveat, e.g. "Lighter on comedy for this part." - null when nothing stands out as weak. */
  caveat: string | null;
}

// A per-axis match score as the adjective the strengths line uses - the bare
// quality word (no "Match" suffix), so it reads as prose: "Perfect emotional
// fit", not "Perfect Match emotional fit".
function matchWord(score: number): string {
  if (score >= 90) return 'Perfect';
  if (score >= 75) return 'Strong';
  return 'Good';
}

const STRONG_AXIS = 60; // a genuine strength worth naming
const WEAK_AXIS = 45; // a real soft spot worth flagging as a caveat
const MAX_STRENGTHS = 2;

/**
 * The reason line for a role-fit verdict, from the per-axis breakdown rows the
 * card already has ({ label, matchScore }, e.g. from
 * computeCharacterCompatibilityBreakdown). null when there are no rows (crew,
 * or nothing to compare against) - the caller simply omits the line. `noun`
 * tailors the phrasing to whether these are acting axes ("fit") or tones
 * ("tone") so both a character read and a whole-script read stay grammatical.
 */
export function deriveFitReason(
  rows: Array<{ label: string; matchScore: number }>,
  noun: 'fit' | 'tone' = 'fit',
): FitReason | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => b.matchScore - a.matchScore);
  const tops = sorted.filter((r) => r.matchScore >= STRONG_AXIS).slice(0, MAX_STRENGTHS);

  let strengths: string;
  if (tops.length > 0) {
    const parts = tops.map((r) => `${matchWord(r.matchScore).toLowerCase()} ${r.label.toLowerCase()} ${noun}`);
    strengths = joinAnd(parts);
  } else {
    // Nobody clears the strength bar - lead with the least-bad axis rather than
    // an empty line, so a poor-fitting candidate still reads honestly.
    const best = sorted[0];
    strengths = `${matchWord(best.matchScore).toLowerCase()} ${best.label.toLowerCase()} ${noun} at best`;
  }
  strengths = `${capitalize(strengths)}.`;

  const weakest = sorted[sorted.length - 1];
  const caveat =
    weakest.matchScore < WEAK_AXIS && !tops.includes(weakest)
      ? `Lighter on ${weakest.label.toLowerCase()} for this part.`
      : null;

  return { strengths, caveat };
}

function joinAnd(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

function capitalize(s: string): string {
  return s.length === 0 ? s : `${s.charAt(0).toUpperCase()}${s.slice(1)}`;
}

// --- Head-to-head comparison verdict ---------------------------------------
// The recommendation the two-candidate comparison view leads with. Only names a
// pick when one candidate clearly wins the decisive axes (user choice: "diffs +
// pick only when clear"); otherwise it's an honest "Close call" naming the main
// trade-off. Presentation-only - it re-reads the same scores the cards show, it
// doesn't invent a new one.

export interface CompareSide {
  name: string;
  /** Role-fit / skill score 0-100, or null when there's nothing to compare on (e.g. crew with no script). */
  fit: number | null;
  salary: number;
  availableNow: boolean;
  reliability: number;
  riskTier: RiskTier;
  /** Box-office draw 0-100 - a tie-breaker ("bigger name"), never decisive on its own. */
  fame: number;
}

export interface CompareVerdict {
  /** 'a' | 'b' when one candidate is the clear pick, null for a genuine toss-up. */
  pick: 'a' | 'b' | null;
  /** A producer-voiced one-liner: the pick and why, or the trade-off if it's close. */
  summary: string;
}

const RISK_RANK: Record<RiskTier, number> = { dependable: 0, 'some-risk': 1, volatile: 2 };
const FIT_MARGIN = 8; // fit points before "better fit" is worth saying
const SALARY_MARGIN = 0.15; // 15% cheaper before cost is a real edge
const RELIABILITY_MARGIN = 15;

interface Edge {
  winner: 'a' | 'b';
  weight: number;
  reason: string;
}

/**
 * Which of two candidates to lean toward, and why. Weighs the decisive hiring
 * axes - can you even get them (availability), do they fit, what do they cost,
 * how reliable, how risky - and declares a pick only on a clear margin.
 */
export function deriveComparisonVerdict(a: CompareSide, b: CompareSide): CompareVerdict {
  const edges: Edge[] = [];

  // Availability is nearly decisive: a booked candidate can't be hired today at all.
  if (a.availableNow !== b.availableNow) {
    const winner = a.availableNow ? 'a' : 'b';
    const loser = winner === 'a' ? b : a;
    edges.push({ winner, weight: 3, reason: `${loser.name} can't start yet` });
  }

  if (a.fit !== null && b.fit !== null && Math.abs(a.fit - b.fit) >= FIT_MARGIN) {
    const winner = a.fit > b.fit ? 'a' : 'b';
    edges.push({ winner, weight: 3, reason: 'a clearly better fit for this part' });
  }

  if (a.salary > 0 && b.salary > 0) {
    const cheaper = a.salary < b.salary ? 'a' : 'b';
    const hi = cheaper === 'a' ? b.salary : a.salary;
    const lo = cheaper === 'a' ? a.salary : b.salary;
    if ((hi - lo) / hi >= SALARY_MARGIN) {
      edges.push({ winner: cheaper, weight: 2, reason: `cheaper by ${formatSalaryGap(hi - lo)}` });
    }
  }

  if (Math.abs(a.reliability - b.reliability) >= RELIABILITY_MARGIN) {
    const winner = a.reliability > b.reliability ? 'a' : 'b';
    edges.push({ winner, weight: 2, reason: 'more reliable' });
  }

  if (RISK_RANK[a.riskTier] !== RISK_RANK[b.riskTier]) {
    const winner = RISK_RANK[a.riskTier] < RISK_RANK[b.riskTier] ? 'a' : 'b';
    const riskier = winner === 'a' ? b : a;
    edges.push({ winner, weight: 2, reason: `less of a risk (${riskier.name} looks ${riskier.riskTier.replace('-', ' ')})` });
  }

  const scoreA = edges.filter((e) => e.winner === 'a').reduce((s, e) => s + e.weight, 0);
  const scoreB = edges.filter((e) => e.winner === 'b').reduce((s, e) => s + e.weight, 0);

  // A clear pick: a margin of at least 3 (one decisive axis, or two lesser
  // ones) with the leader not badly outweighed on the other side.
  const lead = Math.abs(scoreA - scoreB);
  if (lead >= 3 && (scoreA === 0 || scoreB === 0 || lead >= 4)) {
    const pick = scoreA > scoreB ? 'a' : 'b';
    const winnerName = pick === 'a' ? a.name : b.name;
    const reasons = edges
      .filter((e) => e.winner === pick)
      .sort((x, y) => y.weight - x.weight)
      .slice(0, 2)
      .map((e) => e.reason);
    return { pick, summary: `Lean ${winnerName} — ${joinAnd(reasons)}.` };
  }

  // Too close to call - surface the single biggest difference as the trade-off.
  const topEdge = [...edges].sort((x, y) => y.weight - x.weight)[0];
  if (!topEdge) {
    return { pick: null, summary: 'Close call — the two are evenly matched on every front that counts.' };
  }
  const strongName = topEdge.winner === 'a' ? a.name : b.name;
  return {
    pick: null,
    summary: `Close call — ${strongName} has the edge (${topEdge.reason}), but it's a real trade-off.`,
  };
}

function formatSalaryGap(amount: number): string {
  if (amount >= 1_000_000) return `£${(amount / 1_000_000).toFixed(amount >= 10_000_000 ? 0 : 1)}M`;
  if (amount >= 1_000) return `£${Math.round(amount / 1_000)}k`;
  return `£${Math.round(amount)}`;
}
