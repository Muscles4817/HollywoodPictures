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
import { fameCraftContrast } from './actingModel';
import { clamp } from './random';
import { NO_RELATIONSHIP, type RelationshipStanding } from './relationships';
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

// --- Reading role fit under uncertainty ------------------------------------
// The engine's fit score is exact and deterministic, but a producer sizing up a
// candidate never sees it that cleanly. Two real-life truths the raw number
// hides:
//   1. How *confidently* you can read a fit depends on how much of a known
//      quantity the person is - a much-seen, dependable name is predictable; an
//      unproven newcomer or a flaky one is a gamble whatever the number says.
//   2. The read itself is *biased* by reputation - a star's marquee flatters a
//      shaky fit (you over-rate them), an unknown gets under-rated.
// So this turns the exact score into what a casting eye would actually perceive:
// a hedged verdict over a band, not a figure to two digits. Crucially it stays
// DETERMINISTIC per person (no RNG) - a *knowledge* problem the player can
// reason about (and, later, buy their way out of with a screen test), never a
// slot machine bolted onto the outcome. The true fit underneath is untouched;
// this is a presentation read of it (CLAUDE.md house style: qualitative, never
// the raw stat).

export type FitConfidence = 'high' | 'medium' | 'low';

// How established a name reads - blends public fame, peer respect, and current
// heat. A respected character actor (modest fame, high respect) is still a known
// quantity, so respect counts alongside fame rather than fame carrying it alone.
function establishment(person: Person): number {
  const { fame, industryRespect, currentHeat } = person.reputation;
  return 0.55 * fame + 0.3 * industryRespect + 0.15 * currentHeat;
}

const WELL_KNOWN = 62; // a bankable, much-seen name - matches actingModel's FAME_HIGH
const SOMEWHAT_KNOWN = 40; // enough of a track record to have a read on
const WILDCARD_RELIABILITY = 35; // below this they're unpredictable however famous
// Band half-widths in fit points, per confidence tier. Deliberately HARSH at the
// base (an unread candidate is a real gamble, not a mild wobble) - because the
// point of the uncertainty is to give the things that *reduce* it real value: a
// hired casting director's eye and a history of working together (see
// deriveFitReadAssist). Mild base uncertainty would make both pointless. The old,
// gentler spreads are now roughly what a strong assist earns you back, not the
// starting point. First-draft, tunable like every cutoff here.
const BAND_HALF_WIDTH: Record<FitConfidence, number> = { high: 7, medium: 18, low: 30 };
const CONFIDENCE_LABEL: Record<FitConfidence, string> = {
  high: 'Confident read',
  medium: 'Fairly sure',
  low: 'Hard to read',
};

// How a studio-side assist (a casting director, or history with the person)
// sharpens a read: promote the confidence tier, shave the band within it, and
// fade the reputation bias. Tunable.
const TIER_ORDER: FitConfidence[] = ['low', 'medium', 'high'];
const ASSIST_NOTABLE = 0.3; // below this an assist is too slight to credit or promote on
const ASSIST_STRONG = 0.66; // a genuinely expert eye / deep history - promotes two tiers
const WITHIN_TIER_SHAVE = 0.35; // how much a full assist tightens the band inside its tier
const BIAS_SHAVE = 0.8; // how much a full assist sees through the reputation over/under-read

// --- The studio-side assist: a casting director, or history with the person --
// The candidate-intrinsic read above is only half the story. Two things the
// STUDIO brings sharpen it, and are exactly what harsh base uncertainty makes
// worth paying for:
//   - a hired Casting Director, whose whole job is reading actors - a per-
//     production hire whose skill sharpens every actor read on the film (and who
//     already "discovers" well-suited unknowns in open casting, engine/
//     castingCalls.ts - the same eye, now speaking on the card too);
//   - HISTORY with the person - you can read someone you've worked with, because
//     you know them. Keyed off the collaboration COUNT, not warmth: a grudge
//     still means you know them well (that read lives in relationships.ts's
//     appeal/salary effects, not here).

export interface FitReadAssist {
  /** 0..1 - how much studio-side knowledge sharpens the read. */
  level: number;
  /** What's providing it, for crediting on the card - null when nothing is. */
  source: 'casting-director' | 'history' | null;
}
export const NO_ASSIST: FitReadAssist = { level: 0, source: null };

const MAX_FAMILIARITY = 0.85; // even a long history leaves the shoot itself to surprise you
const FAMILIARITY_PER_COLLAB = 0.3;
function familiarityLevel(collaborations: number): number {
  return clamp(collaborations * FAMILIARITY_PER_COLLAB, 0, MAX_FAMILIARITY);
}

/**
 * The studio-side assist to a fit read: the stronger of a hired casting
 * director's eye (actors only - they don't read directors or crew) and how well
 * you already know the person from working together. The two don't stack into
 * false certainty - the better of your two ways of knowing them wins.
 */
export function deriveFitReadAssist(
  castingDirectorSkill: number | null | undefined,
  relationship: RelationshipStanding = NO_RELATIONSHIP,
  isActor = true,
): FitReadAssist {
  const cdLevel = isActor ? clamp((castingDirectorSkill ?? 0) / 100, 0, 1) : 0;
  const familiarity = familiarityLevel(relationship.collaborations);
  if (cdLevel === 0 && familiarity === 0) return NO_ASSIST;
  return cdLevel >= familiarity
    ? { level: cdLevel, source: 'casting-director' }
    : { level: familiarity, source: 'history' };
}

export interface FitConfidenceRead {
  tier: FitConfidence;
  /** ± fit points the shown band spreads around the perceived centre. */
  halfWidth: number;
  /** The short caption that replaces the old raw "· 87" number under the verdict. */
  label: string;
  /** The named reason the read isn't a sure thing, for the verdict's caveat - null at high confidence. */
  cause: string | null;
}

// The candidate-intrinsic tier, before any studio-side assist. Establishment
// sets it; low reliability caps it (a flaky name is a gamble however established).
function baseConfidenceTier(person: Person): FitConfidence {
  const known = establishment(person);
  const { reliability } = person.reputation;
  if (reliability < WILDCARD_RELIABILITY) return known >= WELL_KNOWN ? 'medium' : 'low';
  if (known >= WELL_KNOWN) return 'high';
  if (known >= SOMEWHAT_KNOWN) return 'medium';
  return 'low';
}

// The residual doubt to name when a read still isn't a sure thing - only ever
// read for a non-high tier, so it always has a real reason to point at.
function residualCause(person: Person): string {
  if (person.reputation.reliability < WILDCARD_RELIABILITY) return 'they blow hot and cold - hard to bank on';
  if (establishment(person) < SOMEWHAT_KNOWN) return 'an unproven name, with little to go on';
  return 'still something of an unknown quantity';
}

function promoteTier(base: FitConfidence, assistLevel: number): FitConfidence {
  const steps = assistLevel >= ASSIST_STRONG ? 2 : assistLevel >= ASSIST_NOTABLE ? 1 : 0;
  return TIER_ORDER[Math.min(TIER_ORDER.indexOf(base) + steps, TIER_ORDER.length - 1)];
}

/**
 * How confidently this person's fit can be read, and why not, when it can't.
 * The candidate-intrinsic tier (baseConfidenceTier) is then sharpened by any
 * studio-side `assist` - a casting director or shared history promotes the tier
 * and tightens the band, but never to a razor point (the shoot still surprises).
 * Deterministic throughout.
 */
export function deriveFitConfidence(person: Person, assist: FitReadAssist = NO_ASSIST): FitConfidenceRead {
  const tier = promoteTier(baseConfidenceTier(person), assist.level);
  const halfWidth = BAND_HALF_WIDTH[tier] * (1 - assist.level * WITHIN_TIER_SHAVE);
  return {
    tier,
    halfWidth,
    label: CONFIDENCE_LABEL[tier],
    cause: tier === 'high' ? null : residualCause(person),
  };
}

// How far a reputation pushes a fit read off the truth, in points. A famous
// 'coaster' (name outruns craft) reads BETTER than they are - the marquee
// flatters a shaky fit; an 'undiscovered' talent (craft outruns name) reads
// WORSE - no name to trust, so they're under-rated. Reuses the exact fame-vs-
// craft contrast the sim already computes (engine/actingModel.ts), so the card's
// read never disagrees with the identity line right above it. 0 when fame and
// craft roughly agree, and for non-actors.
const READ_BIAS_POINTS = 13;
export function perceivedFitBias(person: Person): number {
  switch (fameCraftContrast(person)) {
    case 'coaster':
      return READ_BIAS_POINTS;
    case 'undiscovered':
      return -READ_BIAS_POINTS;
    default:
      return 0; // 'star-and-craft' or null - the read is honest
  }
}

export interface FitRead {
  /** Player-facing centre of the read: the true fit shifted by reputation bias. Deterministic, still 0-100, but NOT the raw engine number when a bias applies. */
  perceived: number;
  confidence: FitConfidence;
  /** Band edges around `perceived`, wider the harder the person is to read - what the meter fills as a range instead of a point. */
  low: number;
  high: number;
  /** The hedged verdict phrase, e.g. "A strong fit" / "Likely a good fit" / "Reads like a risky fit". */
  verdict: string;
  /** The confidence caption that replaces the raw score number. */
  confidenceLabel: string;
  /** The named reason the read is uncertain, for the "why" caveat - null at high confidence. */
  uncertaintyCause: string | null;
  /** Why the read can be trusted more than it otherwise would - a casting director's eye or history together - for a positive note on the card. null when nothing is sharpening it. */
  assistNote: string | null;
}

// The fit-quality word for a perceived score - the adjective the hedged verdict
// is built from. Same cutoffs as StarRatingConversion.deriveHiringVerdict, but a
// bare quality so a hedge can sit in front of it ("Likely a strong fit").
function fitQualityWord(score: number): string {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'strong';
  if (score >= 60) return 'good';
  if (score >= 40) return 'risky';
  return 'poor';
}

const HEDGE: Record<FitConfidence, (phrase: string) => string> = {
  high: (phrase) => capitalize(phrase),
  medium: (phrase) => `Likely ${phrase}`,
  low: (phrase) => `Reads like ${phrase}`,
};

const ASSIST_NOTE: Record<'casting-director' | 'history', string> = {
  'casting-director': 'your casting director has a read on this one',
  history: "you've worked together, so you know what you're getting",
};

/**
 * The exact engine fit score as a casting eye would actually perceive it -
 * shifted by reputation bias (perceivedFitBias), hedged and banded by how
 * readable the person is (deriveFitConfidence), and SHARPENED by any studio-side
 * `assist` (a casting director's eye, or history with the person - see
 * deriveFitReadAssist), which both tightens the band and fades the bias. The card
 * leads with this instead of the raw number, so "always accurate and exact"
 * becomes "here's my read, how sure I am, and why." `trueScore` is the untouched
 * 0-100 fit; everything derived here is deterministic.
 */
export function deriveFitRead(trueScore: number, person: Person, assist: FitReadAssist = NO_ASSIST): FitRead {
  const bias = perceivedFitBias(person) * (1 - assist.level * BIAS_SHAVE);
  const perceived = clamp(trueScore + bias, 0, 100);
  const { tier, halfWidth, label, cause } = deriveFitConfidence(person, assist);
  const word = fitQualityWord(perceived);
  const phrase = `${word === 'excellent' ? 'an' : 'a'} ${word} fit`;
  return {
    perceived,
    confidence: tier,
    low: clamp(perceived - halfWidth, 0, 100),
    high: clamp(perceived + halfWidth, 0, 100),
    verdict: HEDGE[tier](phrase),
    confidenceLabel: label,
    uncertaintyCause: cause,
    assistNote: assist.source && assist.level >= ASSIST_NOTABLE ? ASSIST_NOTE[assist.source] : null,
  };
}

// --- Which fit dimensions you'd actually know ------------------------------
// Real casting only knows an actor cold on the dimensions they're *known for* -
// their standout strengths. The rest you're guessing at until you see them in
// the part. So the per-axis breakdown reveals the axes the actor is genuinely
// strong on and, the less of a known quantity they are, veils the rest as
// "Unknown" rather than handing over a precise per-axis fit for a performance
// nobody has seen yet. `strength` is the actor's OWN value on the axis (how much
// they're known for it), not the match score - a low-strength axis is a question
// mark even when it happens to match a role that doesn't demand it.

// The actor-strength above which an axis reads as "known", per confidence tier.
// A confident read reveals everything (0); the shakier the read, the higher the
// bar an axis must clear to be something you can vouch for. Tunable.
const AXIS_KNOWN_THRESHOLD: Record<FitConfidence, number> = { high: 0, medium: 55, low: 68 };

export interface GatedAxis {
  label: string;
  matchScore: number;
  strength: number;
  /** false when the actor isn't known enough on this axis to vouch for the fit - the breakdown veils it as "Unknown". */
  known: boolean;
}

/**
 * Marks each per-axis fit row known/unknown for how confidently this person can
 * be read - fewer axes revealed the less of a known quantity they are. Never
 * hides everything: their single strongest dimension (what they're known for)
 * always shows, so even an unknown reads as "known for X, the rest a question
 * mark," not a blank.
 */
export function gateKnownAxes(
  rows: Array<{ label: string; matchScore: number; strength: number }>,
  confidence: FitConfidence,
): GatedAxis[] {
  if (rows.length === 0) return [];
  const threshold = AXIS_KNOWN_THRESHOLD[confidence];
  const gated = rows.map((r) => ({ ...r, known: r.strength >= threshold }));
  if (!gated.some((r) => r.known)) {
    // You always know their standout dimension - reveal at least the strongest.
    const topIdx = rows.reduce((best, r, i) => (r.strength > rows[best].strength ? i : best), 0);
    gated[topIdx] = { ...gated[topIdx], known: true };
  }
  return gated;
}

// --- Head-to-head comparison verdict ---------------------------------------
// The recommendation the two-candidate comparison view leads with. Only names a
// pick when one candidate clearly wins the decisive axes (user choice: "diffs +
// pick only when clear"); otherwise it's an honest "Close call" naming the main
// trade-off. Presentation-only - it re-reads the same scores the cards show, it
// doesn't invent a new one.

export interface CompareSide {
  name: string;
  /** Role-fit / skill score 0-100, or null when there's nothing to compare on (e.g. crew with no script). The *perceived* fit (post read-bias), so the verdict matches what each card shows. */
  fit: number | null;
  /** How readable that fit is - a fit edge over a candidate you can't confidently read isn't worth claiming, so an uncertain side widens the margin. Optional/high-by-default, so existing callers are unchanged. */
  fitConfidence?: FitConfidence;
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

  // A fit edge is only worth claiming if you can actually read both fits - when
  // either side is a hard-to-read gamble, the numbers alone don't justify "a
  // clearly better fit," so the margin needed doubles.
  const fitReadable = (a.fitConfidence ?? 'high') !== 'low' && (b.fitConfidence ?? 'high') !== 'low';
  const fitMargin = fitReadable ? FIT_MARGIN : FIT_MARGIN * 2;
  if (a.fit !== null && b.fit !== null && Math.abs(a.fit - b.fit) >= fitMargin) {
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
