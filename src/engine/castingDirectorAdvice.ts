// Casting Redesign, Phase 7 (design brief point 8) - Casting Director depth.
// A hired Casting Director's value is already threaded through the whole flow:
// they sharpen the fit read and price estimate (Phase 2), speed up auditions
// (Phase 4), and widen/curate Open Casting plus firm up its forecast (Phase 5).
// What was missing was the CD speaking in ONE voice - an explicit "here's my
// take on this candidate" the way a real casting director advises a producer.
//
// This module is that consolidation, not new hidden math: it SYNTHESISES the
// reads the cards already compute (perceived fit, acceptance odds, risk,
// affordability, schedule) into a single recommendation with its reasons. It is
// deliberately CD-GATED - with nobody hired there is no take (deriveCasting
// DirectorTake returns null), so the advisory is a concrete thing you unlock by
// hiring one, and its confidence is only ever as sharp as the CD's own skill.
// Pure and derived, like the rest of engine/.
import type { AcceptanceOdds } from './castingEstimate';
import type { FitConfidence, FitRead, RiskTier } from './talentCardPresentation';

export type CDRecommendation = 'strong-yes' | 'worth-it' | 'reach' | 'pass';

export interface CastingDirectorTake {
  recommendation: CDRecommendation;
  /** The one-line verdict, in the casting director's voice. */
  headline: string;
  /** Up to a few short drivers behind the verdict - the "why". */
  reasons: string[];
  /** How sure the take is - only ever as sharp as the casting director's own skill. */
  confidence: FitConfidence;
}

// Below this casting-director skill there's effectively no professional read to
// give - a warm body in the chair, not an eye. At/above it, a take appears.
const MIN_SKILL_FOR_TAKE = 1;
// Skill bands for how confident the take reads.
const CONFIDENT_SKILL = 66;
const FAIRLY_SURE_SKILL = 33;

// Fit-quality cutoffs the verdict leans on - same spirit as the hiring-verdict
// bands elsewhere, kept local and tunable.
const STRONG_FIT = 75;
const GOOD_FIT = 60;
const POOR_FIT = 40;

function skillConfidence(skill: number): FitConfidence {
  if (skill >= CONFIDENT_SKILL) return 'high';
  if (skill >= FAIRLY_SURE_SKILL) return 'medium';
  return 'low';
}

const HEADLINE: Record<CDRecommendation, string> = {
  'strong-yes': 'A strong pick for this part',
  'worth-it': 'Worth pursuing',
  reach: 'A reach, but not impossible',
  pass: "I'd look elsewhere",
};

const ODDS_REASON: Partial<Record<AcceptanceOdds, string>> = {
  likely: "they'll likely say yes at this offer",
  even: 'landing them is a coin toss at this offer',
  stretch: "they'll want more than you're offering",
  'long-shot': "this offer won't get near them",
  no: "they can't take it - schedule or history",
};

export interface CastingDirectorTakeInput {
  /** The production's hired casting-director skill (0-100), or null/0 if none. */
  castingDirectorSkill: number | null | undefined;
  /** The perceived fit read the card already shows (engine/talentCardPresentation.ts). */
  fit: FitRead;
  /** How this offer would land (engine/castingEstimate.ts). */
  odds: AcceptanceOdds;
  /** The candidate's risk tier (engine/talentCardPresentation.ts:deriveRiskRead). */
  risk: RiskTier;
  /** Whether hiring them keeps the film within budget. */
  affordable: boolean;
  /** A short strengths phrase from the fit breakdown, if any (deriveFitReason.strengths). */
  strengths?: string | null;
  /** The honest caveat from the fit breakdown, if any (deriveFitReason.caveat). */
  caveat?: string | null;
}

/**
 * The casting director's take on one candidate - a single recommendation with
 * its reasons, synthesised from the reads the card already computes. Returns
 * null when no casting director is hired (there's no one to give a read), which
 * is exactly what makes hiring one worth it. Deterministic.
 */
export function deriveCastingDirectorTake(input: CastingDirectorTakeInput): CastingDirectorTake | null {
  const skill = input.castingDirectorSkill ?? 0;
  if (skill < MIN_SKILL_FOR_TAKE) return null;

  const { fit, odds, risk, affordable } = input;
  const perceived = fit.perceived;
  const strongFit = perceived >= STRONG_FIT;
  const goodFit = perceived >= GOOD_FIT;
  const poorFit = perceived < POOR_FIT;
  const goodOdds = odds === 'likely' || odds === 'even';
  const badOdds = odds === 'no' || odds === 'long-shot';
  const volatile = risk === 'volatile';

  let recommendation: CDRecommendation;
  if (odds === 'no' || poorFit) recommendation = 'pass';
  else if (strongFit && goodOdds && !volatile && affordable) recommendation = 'strong-yes';
  else if (goodFit && !badOdds && !volatile) recommendation = 'worth-it';
  else recommendation = 'reach';

  // The "why": lead with the strengths the fit breakdown found, then the honest
  // caveat, then the DECISIVE blockers (risk, budget) ahead of the softer odds
  // read - so when reasons are trimmed, the dealbreakers survive. Kept short.
  const reasons: string[] = [];
  if (input.strengths) reasons.push(lowerFirst(stripPeriod(input.strengths)));
  else reasons.push(`${fitWord(perceived)} fit for the part`);
  if (recommendation !== 'strong-yes' && input.caveat) reasons.push(lowerFirst(stripPeriod(input.caveat)));
  if (volatile) reasons.push('and they carry real risk on set');
  if (!affordable) reasons.push('and they push the film over budget');
  const oddsReason = ODDS_REASON[odds];
  if (oddsReason) reasons.push(oddsReason);

  return {
    recommendation,
    headline: HEADLINE[recommendation],
    reasons: reasons.slice(0, 3),
    confidence: skillConfidence(skill),
  };
}

function fitWord(score: number): string {
  if (score >= STRONG_FIT) return 'a strong';
  if (score >= GOOD_FIT) return 'a good';
  if (score >= POOR_FIT) return 'a risky';
  return 'a poor';
}

function stripPeriod(s: string): string {
  return s.endsWith('.') ? s.slice(0, -1) : s;
}
function lowerFirst(s: string): string {
  return s.length === 0 ? s : `${s.charAt(0).toLowerCase()}${s.slice(1)}`;
}

const CONFIDENCE_TAG: Record<FitConfidence, string> = {
  high: 'Confident.',
  medium: 'A fair read.',
  low: 'Only a rough read.',
};

/**
 * The casting director's take as a producer-facing line: the verdict, the
 * reasons joined into a sentence, and how sure they are. `take` is a
 * CastingDirectorTake; callers render the string.
 */
export function describeCastingDirectorTake(take: CastingDirectorTake): string {
  const reasons = joinReasons(take.reasons);
  const because = reasons ? ` - ${reasons}` : '';
  return `${take.headline}${because}. ${CONFIDENCE_TAG[take.confidence]}`;
}

function joinReasons(parts: string[]): string {
  const cleaned = parts.filter((p) => p.length > 0);
  if (cleaned.length === 0) return '';
  // Reasons already read as clauses ("and they carry real risk"); join with
  // commas but keep a leading "and" clause gluing naturally.
  return cleaned.reduce((acc, part, i) => {
    if (i === 0) return part;
    return part.startsWith('and ') ? `${acc} ${part}` : `${acc}, ${part}`;
  }, '');
}
