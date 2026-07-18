// Tuning data for the Production Office and Producers
// (docs/DESIGN_REVIEW_production_office.md). Pure numbers - the logic that
// reads them lives in engine/producers.ts, generation in
// engine/talentGenerator.ts. Rebalance here without touching either.
import type { ProducerSpecialty } from '../types';
import type { Range } from '../engine/interpolate';

export const PRODUCER_SPECIALTIES: readonly ProducerSpecialty[] = ['Line', 'Creative', 'Executive', 'Fixer'];

// Player-facing names and one-line "what this producer does" blurbs, so the
// Production Office UI can explain each specialty without hardcoding copy.
export const PRODUCER_SPECIALTY_LABEL: Record<ProducerSpecialty, string> = {
  Line: 'Line Producer',
  Creative: 'Creative Producer',
  Executive: 'Executive Producer',
  Fixer: 'Fixer',
};

export const PRODUCER_SPECIALTY_BLURB: Record<ProducerSpecialty, string> = {
  Line: 'Trims production spend.',
  Creative: 'Lifts post-production quality.',
  Executive: 'Boosts marketing buzz.',
  Fixer: 'Softens on-set disasters.',
};

// Each specialty's raw effect is `lerp(min, max, skill/100)` (skill 1-100),
// before affinity, reliability, and stacking are applied (engine/producers.ts).
// Ranges are chosen against the real sim scale: sub-scores are 0-100 (the
// existing Balanced-edit bonus is +5, the neighbourhood Creative lives in);
// production budget cost is the largest controllable line, so Line trims a
// fraction of it; marketing efficiency multiplies Buzz-per-pound.
export const PRODUCER_EFFECT_RANGES: {
  Line: { costReduction: Range };
  Creative: { postScoreDelta: Range };
  Executive: { marketingEfficiency: Range; flatBuzz: Range };
  Fixer: { eventMitigation: Range };
} = {
  Line: { costReduction: { min: 0.01, max: 0.17 } }, // fraction of production budget cost
  Creative: { postScoreDelta: { min: 0.5, max: 8 } }, // points added to the post-production sub-score
  Executive: {
    marketingEfficiency: { min: 0.02, max: 0.28 }, // added to the marketing-efficiency multiplier (0.28 -> x1.28)
    flatBuzz: { min: 0.5, max: 8 }, // flat Buzz points added pre-opening
  },
  Fixer: { eventMitigation: { min: 0.05, max: 0.45 } }, // fraction of an event's *negative* impact removed
};

// Genre affinity is amplify-only (never a penalty): a producer whose
// genreAffinity includes the film's genre applies their effect at x this,
// otherwise at face value.
export const PRODUCER_AFFINITY_MULTIPLIER = 1.3;

// Same-specialty stacking decays geometrically (sorted strongest-first):
// total = e0 + e1*d + e2*d^2 + ...  So two Line producers give ~1.5x one, not
// 2x - you can't drive a lever to an absurd value by hoarding one type, and
// the maths quietly rewards a *diverse* bench. Cross-specialty effects hit
// different systems and simply add.
export const PRODUCER_SAME_SPECIALTY_DECAY = 0.5;

// Reliability (reputation.reliability, 1-100) dampens how much of the boost
// lands, deterministically: at reliability 1 a producer delivers this
// fraction of their effect, ramping to 1.0 at reliability 100. Keeps the
// existing stat load-bearing without introducing per-film randomness into a
// pure function (a stochastic "occasionally underdelivers" variant is a noted
// future option, docs/DESIGN_REVIEW_production_office.md §4.2/§12).
export const PRODUCER_RELIABILITY_FLOOR = 0.8;

// Safety clamps so stacking can never run past sane bounds.
export const PRODUCTION_COST_MULTIPLIER_FLOOR = 0.55; // Line can trim at most 45% of production budget
export const EVENT_IMPACT_MULTIPLIER_FLOOR = 0.4; // Fixer can remove at most 60% of a negative event
export const MAX_POST_SCORE_DELTA = 12; // Creative's post-score bump caps here
export const MAX_MARKETING_EFFICIENCY_MULTIPLIER = 1.6; // Executive efficiency caps here

// --- Generation (engine/talentGenerator.ts) --------------------------------

// Producer pay band - deliberately below marquee talent (directors/actors cap
// £12-15M): a producer is a force multiplier, not the biggest line item.
export const PRODUCER_SALARY_RANGE: Range = { min: 40_000, max: 4_000_000 };
export const PRODUCER_POOL_SIZE = 40;
export const PRODUCER_MIN_AFFINITIES = 1;
export const PRODUCER_MAX_AFFINITIES = 2;

// --- Employment / office economy (engine/producers.ts) ---------------------

// One-time hiring fee = per-film fee (typicalSalary) x this.
export const PRODUCER_HIRING_FEE_MULTIPLE = 3;

export const OFFICE_MAX_TIER = 3;

// Bench capacity (how many producers can be employed at once) per tier.
export const OFFICE_BENCH_CAPACITY_BY_TIER: Record<number, number> = { 1: 1, 2: 2, 3: 4 };

// Cash cost to *reach* each tier above the unlock tier. Tier 1 is the unlock
// itself (milestone-gated, not bought).
export const OFFICE_UPGRADE_COST_BY_TIER: Record<number, number> = { 2: 1_500_000, 3: 4_000_000 };

// Unlock is earned, not bought: either enough films shipped OR enough Brand.
export const OFFICE_UNLOCK_FILMS_RELEASED = 3;
export const OFFICE_UNLOCK_BRAND = 40;
