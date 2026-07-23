// Production Execution (docs/DESIGN_REVIEW_production_execution.md, Phase 1 of
// docs/SIMULATION_PHILOSOPHY.md).
//
// The finished film should be shaped by how the shoot actually went, not just
// by the pre-production inputs. This module turns a production's *recorded*
// event history (PhotographyState.events + the resolved test-screening events)
// into typed, per-department execution modifiers that engine/scoring.ts routes
// into the finished film - and into a player-facing, causally-explained
// summary.
//
// Everything here is a PURE, DETERMINISTIC read of already-recorded facts:
// same event history + same shootingRatio + same talent/plan -> same result.
// There is no new randomness at release (the randomness already happened, day
// by day, during the shoot). This is the whole point - see
// SIMULATION_PHILOSOPHY.md Principles 1 & 2.
import type {
  ProductionChoices,
  ProductionEvent,
  ProductionExecutionImpact,
  ProductionExecutionOutcome,
  TalentAssignment,
} from '../types';
import { clamp } from './random';
import { contingencyT } from './productionDials';

// --- Impact classification -------------------------------------------------
// Which part of the finished film an on-set event logically affects. An event
// may carry an explicit `impact` (set at roll time, or authored on a template);
// otherwise we infer it from its id, so legacy/saved events - and every event
// generated before this system existed - are still routed correctly with no
// save migration. See data/productionEvents.ts for the event bank.

interface KeywordRule {
  impact: ProductionExecutionImpact;
  keywords: string[];
}

// Order matters: the first rule whose keyword appears in the id wins. Tuned
// against the current event bank (data/productionEvents.ts) so each template
// lands on the department it's really about.
const CLASSIFICATION_RULES: KeywordRule[] = [
  { impact: 'script', keywords: ['writer', 'rewrite', 'script-doctor', 'draft', 'punch-up'] },
  { impact: 'pacing', keywords: ['composer', 'score', 'music', 'temp-track', 'arranger', 'editor', 'assembly', 'twist', 'climax', 'centerpiece', 'continuity', 'structure', 'format-mismatch'] },
  { impact: 'performances', keywords: ['morale', 'tension', 'clash', 'diva', 'rivalry', 'walked-off', 'no-show', 'blowup', 'mediator', 'bonding', 'bonded'] },
  { impact: 'coverage', keywords: ['schedule', 'weather', 'location', 'scene-cut', 'double-booked', 'exhausted', 'ad-quit', 'frantic', 'second-unit', 'rest', 'pace', 'wrapped', 'generous-time', 'extra-take', 'caught-continuity'] },
  { impact: 'visual', keywords: ['safety', 'stunt', 'explosion', 'rig', 'injury', 'near-miss', 'hazard', 'technical', 'vfx', 'equipment', 'render', 'effects', 'set', 'prop', 'design', 'gore', 'creature', 'scifi', 'fantasy', 'horror', 'action'] },
  { impact: 'general', keywords: ['budget', 'financing', 'contingency', 'corners', 'reserve', 'discount', 'exchange', 'vendor', 'insurance'] },
  { impact: 'performances', keywords: ['actor', 'lead', 'cast', 'chemistry', 'improv', 'raw-take', 'coach', 'performance', 'nailed'] },
];

/** The finished-film department an on-set event affects. Explicit `impact` wins; otherwise inferred from the id (no migration needed for old events). */
export function classifyEventImpact(event: Pick<ProductionEvent, 'id' | 'impact'>): ProductionExecutionImpact {
  if (event.impact) return event.impact;
  const id = event.id.toLowerCase();
  for (const rule of CLASSIFICATION_RULES) {
    if (rule.keywords.some((k) => id.includes(k))) return rule.impact;
  }
  return 'general';
}

// --- Execution profile -----------------------------------------------------

export interface ExecutionProfileInput {
  /** The recorded shoot history (on-set + resolved post-production events), already producer-mitigated by the caller if applicable. */
  events: ProductionEvent[];
  /** daysElapsed / recommendedDays from the finished shoot. */
  shootingRatio: number;
  /** The film's talent - reliability drives execution resilience (a reliable production absorbs the same problems with less damage). */
  talent: TalentAssignment[];
  /** Production plan - contingency margin is the other half of resilience. */
  productionChoices: ProductionChoices;
}

/**
 * The numeric execution modifiers engine/scoring.ts routes into the finished
 * film. Each is an orthogonal "how did this actually come out on set" reading,
 * NOT a re-use of a department's own raw score - so routing them never
 * double-counts Direction, Acting, Script, or Post-Production (see
 * docs/DESIGN_REVIEW_production_execution.md "Avoiding double-counting").
 */
export interface ExecutionProfile {
  /** Multiplier on effective Acting - how well performances were captured (morale, chemistry, improv, conflict). */
  performanceCapture: number;
  /** Multiplier on effective Post-Production - how well the shoot's footage cut together (pacing, visual execution, general set quality). */
  postExecution: number;
  /** Multiplier on the Script term - mid-shoot rewrites/script problems that changed the material. */
  scriptExecution: number;
  /** Coverage-adjusted shooting ratio feeding the edit ceiling - lost scenes/days mean the editor has less to work with. */
  coverageRatio: number;
  /** Aggregate execution quality in roughly [-1, +1], for the star rating and sensitivity reporting. */
  overall: number;
  /** Resilience applied (0-1) - how much negative execution damage was absorbed by reliability + contingency. */
  resilience: number;
  /** Per-event, impact-classified, resilience-mitigated quality contributions - the causal record the summary is built from. */
  contributions: ExecutionContribution[];
}

export interface ExecutionContribution {
  event: ProductionEvent;
  impact: ProductionExecutionImpact;
  /** The event's qualityDelta after resilience mitigation (negatives softened; positives unchanged). */
  mitigatedDelta: number;
}

// How much resilience (reliability + contingency) can soften negative execution
// damage, at most. A fully reliable, well-resourced production halves the harm
// its on-set problems do to the finished film - the mitigation lever the design
// calls for (SIMULATION_PHILOSOPHY.md "Reliability is a mitigation lever").
const MAX_MITIGATION = 0.5;

// Per-department conversion of a bucket's net (mitigated) quality points into a
// multiplier: mult = 1 + pos*POS - |neg|*NEG, clamped. Negative sensitivity is
// deliberately larger than positive (asymmetric tails - a troubled shoot hurts
// more than an equally-eventful smooth one helps), and floors sit further from
// 1 than ceilings, so downside is real but upside stays meaningful. Tuned
// against the Phase 1 tests + diagnostic; rebalance here.
// Positive sensitivity is deliberately much smaller than negative. Upside must
// be *earned* by genuinely strong positive events (a career-best take, real
// chemistry) - a calm, careful shoot's scattering of small positives should
// net close to neutral (preserve the film, don't passively elevate it). The
// asymmetry is the point: reliability/contingency protect the downside; they do
// not manufacture excellence (docs/SIMULATION_PHILOSOPHY.md).
interface DeptConversion { pos: number; neg: number; floor: number; ceil: number; }
const PERFORMANCE_CONV: DeptConversion = { pos: 0.0072, neg: 0.0270, floor: 0.50, ceil: 1.16 };
const POST_CONV: DeptConversion = { pos: 0.0062, neg: 0.0235, floor: 0.48, ceil: 1.14 };
const SCRIPT_CONV: DeptConversion = { pos: 0.0042, neg: 0.0150, floor: 0.78, ceil: 1.10 };
// Quality points of lost/gained coverage -> shooting-ratio adjustment fed to the
// edit ceiling. Negative coverage events (a scene cut for time, a week of
// unusable footage) leave the editor less to work with.
const COVERAGE_TO_RATIO = 0.016;

function avgReliability(talent: TalentAssignment[]): number {
  if (talent.length === 0) return 70;
  return talent.reduce((sum, a) => sum + a.person.reputation.reliability, 0) / talent.length;
}

/** Resilience 0-1: reliable, well-resourced productions absorb on-set problems with less damage to the finished film. */
export function computeExecutionResilience(talent: TalentAssignment[], productionChoices: ProductionChoices): number {
  const reliabilityT = clamp(avgReliability(talent) / 100, 0, 1);
  const contingencyStrength = clamp(contingencyT(productionChoices.contingencyAmount), 0, 1);
  return clamp(0.55 * reliabilityT + 0.45 * contingencyStrength, 0, 1);
}

/** A running per-department tally: positive and negative execution quality points, kept separate. */
interface PosNeg { pos: number; neg: number; }

/**
 * Combine a department's positive and negative execution points into one
 * multiplier - MULTIPLICATIVELY, so a triumph and an unrelated disaster on the
 * same department don't simply cancel: a failed VFX sequence still leaves its
 * mark even if the set looked great. This is what lets a genuinely mixed shoot
 * read as marked rather than bland, and is the main reason realistic (not just
 * hand-built) shoots produce a real spread.
 */
function combineMultiplier(pn: PosNeg, conv: DeptConversion): number {
  const up = 1 + pn.pos * conv.pos;
  const down = 1 + pn.neg * conv.neg; // pn.neg <= 0, so this is <= 1
  return clamp(up * down, conv.floor, conv.ceil);
}

/**
 * Turn a recorded shoot history into per-department execution modifiers.
 * Deterministic and pure - it reads facts, it never rolls. Reusable by a
 * future rival execution resolver (Phase 2): synthesize a rival's events from
 * its risk profile and pass them here to get the same finished-film treatment
 * the player's shoot gets (see docs/SIMULATION_PHILOSOPHY.md phasing).
 */
export function computeExecutionProfile(input: ExecutionProfileInput): ExecutionProfile {
  const resilience = computeExecutionResilience(input.talent, input.productionChoices);

  const buckets: Record<ProductionExecutionImpact, PosNeg> = {
    performances: { pos: 0, neg: 0 }, coverage: { pos: 0, neg: 0 }, visual: { pos: 0, neg: 0 },
    pacing: { pos: 0, neg: 0 }, script: { pos: 0, neg: 0 }, general: { pos: 0, neg: 0 },
  };
  const contributions: ExecutionContribution[] = [];

  for (const event of input.events) {
    const impact = classifyEventImpact(event);
    const raw = event.qualityDelta;
    // Resilience softens negative execution damage only; a good day on set is a
    // good day regardless of how well-resourced you were.
    const mitigatedDelta = raw >= 0 ? raw : raw * (1 - resilience * MAX_MITIGATION);
    if (mitigatedDelta >= 0) buckets[impact].pos += mitigatedDelta;
    else buckets[impact].neg += mitigatedDelta;
    contributions.push({ event, impact, mitigatedDelta });
  }

  // Aggregate the post-production readings (pacing/editing + visual/technical +
  // general set quality) keeping positives and negatives separate.
  const postBucket: PosNeg = {
    pos: buckets.pacing.pos + buckets.visual.pos + buckets.general.pos,
    neg: buckets.pacing.neg + buckets.visual.neg + buckets.general.neg,
  };

  // Performances = morale/chemistry/conflict/improv. Post-execution = the
  // finished-cut readings above. Script = mid-shoot rewrites. Each bucket routes
  // to exactly one effective term, so nothing is double-counted.
  const performanceCapture = combineMultiplier(buckets.performances, PERFORMANCE_CONV);
  const postExecution = combineMultiplier(postBucket, POST_CONV);
  const scriptExecution = combineMultiplier(buckets.script, SCRIPT_CONV);

  // Coverage: lost scenes/days shrink what the edit can work with. Positive
  // coverage events (a generous schedule, an extra take) lift it slightly.
  const coverageAdj = (buckets.coverage.pos + buckets.coverage.neg) * COVERAGE_TO_RATIO;
  const coverageRatio = clamp(input.shootingRatio + coverageAdj, 0.4, 3);

  // Aggregate for the star rating: acting + finished cut dominate, script and
  // coverage contribute less. Coverage's effect is only counted where it
  // actually bites (below ratio 1, where the edit ceiling binds).
  const coverageEffect = Math.min(coverageRatio, 1) - Math.min(input.shootingRatio, 1);
  const overall =
    (performanceCapture - 1) * 0.40 +
    (postExecution - 1) * 0.40 +
    (scriptExecution - 1) * 0.10 +
    coverageEffect * 0.6;

  return { performanceCapture, postExecution, scriptExecution, coverageRatio, overall, resilience, contributions };
}

/** A neutral profile (no events, on-schedule) - the finished film is unchanged from its pre-production potential. Used as the default when no history is available. */
export function neutralExecutionProfile(shootingRatio = 1): ExecutionProfile {
  return {
    performanceCapture: 1,
    postExecution: 1,
    scriptExecution: 1,
    coverageRatio: shootingRatio,
    overall: 0,
    resilience: 0,
    contributions: [],
  };
}

// --- Player-facing summary -------------------------------------------------

const IMPACT_LABEL: Record<ProductionExecutionImpact, string> = {
  performances: 'the performances',
  coverage: 'the available coverage',
  visual: 'the visual execution',
  pacing: 'the edit and pacing',
  script: 'the screenplay',
  general: 'the production',
};

type Rating = ProductionExecutionOutcome['rating'];

// Thresholds are asymmetric: 'strong'/'exceptional' sit further from zero than
// 'troubled'/'catastrophic', so a preserved (near-neutral) shoot reads as
// 'solid' rather than being handed 'strong' for a few minor positives. Upside
// ratings require genuinely strong positive execution.
function ratingForOverall(overall: number): { rating: Rating; stars: number } {
  if (overall <= -0.18) return { rating: 'catastrophic', stars: 1 };
  if (overall <= -0.06) return { rating: 'troubled', stars: 2 };
  if (overall < 0.10) return { rating: 'solid', stars: 3 };
  if (overall < 0.20) return { rating: 'strong', stars: 4 };
  return { rating: 'exceptional', stars: 5 };
}

const HEADLINE: Record<Rating, string> = {
  catastrophic: 'A disastrous shoot badly compromised the finished film.',
  troubled: 'A troubled shoot left its mark on the finished film.',
  solid: 'The shoot came together without major incident.',
  strong: 'A strong shoot elevated the finished film.',
  exceptional: 'An exceptional shoot lifted the film beyond the material.',
};

/**
 * Build the player-facing execution summary - stars, a qualitative headline,
 * a causal detail sentence, and the named causes behind it. Deliberately holds
 * NO raw internal stat values (the modifiers live on the outcome for dev
 * inspectors/tests, but normal UI renders only stars + prose). Presentation
 * style mirrors the screenplay-presentation philosophy: describe, don't expose
 * the numbers.
 */
export function summarizeExecution(profile: ExecutionProfile): ProductionExecutionOutcome {
  const { rating, stars } = ratingForOverall(profile.overall);

  // Rank the events that actually moved the needle, strongest first. All of
  // them are kept (the expandable breakdown); the compact card renders only the
  // top couple, so a smooth shoot never becomes a wall of text.
  const ranked = [...profile.contributions]
    .filter((c) => Math.abs(c.mitigatedDelta) >= 2)
    .sort((a, b) => Math.abs(b.mitigatedDelta) - Math.abs(a.mitigatedDelta));

  const causes = ranked.map((c) => ({
    department: c.impact,
    direction: (c.mitigatedDelta >= 0 ? 'positive' : 'negative') as 'positive' | 'negative',
    text: c.event.description,
  }));

  const detail = buildDetail(rating, ranked);

  return {
    stars,
    rating,
    headline: HEADLINE[rating],
    detail,
    causes,
    mitigation: buildMitigation(profile),
    modifiers: {
      performanceCapture: round2(profile.performanceCapture),
      postExecution: round2(profile.postExecution),
      scriptExecution: round2(profile.scriptExecution),
      coverageRatio: round2(profile.coverageRatio),
      overall: round2(profile.overall),
    },
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// The most negative points a resilient production is credited with having
// absorbed before the mitigation note appears (below this, the shoot wasn't
// troubled enough for containment to be worth calling out).
const MITIGATION_MIN_ABSORBED = 6;

/**
 * What reliable leadership / contingency demonstrably contained. Only surfaced
 * when the production was both genuinely resilient AND actually took negative
 * hits - so it reads as "your preparation paid off here", never as unearned
 * credit on a smooth shoot. Estimates the damage absorbed from the gap between
 * the raw and mitigated negative deltas.
 */
function buildMitigation(profile: ExecutionProfile): string[] {
  if (profile.resilience < 0.5) return [];
  let absorbed = 0;
  for (const c of profile.contributions) {
    if (c.event.qualityDelta < 0) absorbed += c.mitigatedDelta - c.event.qualityDelta; // >= 0
  }
  if (absorbed < MITIGATION_MIN_ABSORBED) return [];
  return ['Reliable leadership and contingency reserves contained the damage from the shoot’s setbacks.'];
}

/** A one-line causal read: the strongest positive and strongest negative thread of the shoot, in plain language. */
function buildDetail(rating: Rating, ranked: ExecutionContribution[]): string {
  const topPositive = ranked.find((c) => c.mitigatedDelta > 0);
  const topNegative = ranked.find((c) => c.mitigatedDelta < 0);

  const positivePhrase = topPositive ? `lifted ${IMPACT_LABEL[topPositive.impact]}` : null;
  const negativePhrase = topNegative ? `weakened ${IMPACT_LABEL[topNegative.impact]}` : null;

  if (rating === 'solid' && !positivePhrase && !negativePhrase) {
    return 'Nothing on set materially changed the film in either direction.';
  }
  if (positivePhrase && negativePhrase) {
    return `On balance the shoot ${positivePhrase}, but it ${negativePhrase} along the way.`;
  }
  if (positivePhrase) return `The shoot ${positivePhrase}.`;
  if (negativePhrase) return `The shoot ${negativePhrase}.`;
  return HEADLINE[rating];
}
