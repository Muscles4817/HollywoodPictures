// Tuning data for the Production Office and Producers
// (docs/DESIGN_REVIEW_production_office.md). Pure numbers - the logic that
// reads them lives in engine/producers.ts, generation in
// engine/talentGenerator.ts. Rebalance here without touching either.
import type { ProducerSpecialty, ProductionRole } from '../types';
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

// --- Delegated Staffing (engine/staffingBriefs.ts) --------------------------
// Tuning for handing a crew slot to an attached Line Producer
// (docs/DESIGN_REVIEW_delegated_staffing.md). Every number here exists to keep
// delegation a TRADE - it must never be the strictly better play. Rebalance
// here; engine/staffingBriefs.ts reads them and holds no numbers of its own.

// The five crew heads a Line Producer can be handed. Deliberately excludes
// Director and both actor slots (too consequential to delegate, and the deepest
// existing loops), Writer (development's territory, not staffing), and Casting
// Director (the instrument of the later cast-side delegation, not a target of
// this one). See the review's §2.
export const DELEGABLE_CREW_ROLES: readonly ProductionRole[] = [
  'Cinematographer',
  'Editor',
  'Composer',
  'Production Designer',
  'VFX Supervisor',
];

// How many briefs one producer will take on a single role of a single film.
// THE load-bearing number of the whole mechanic: without a cap, delegate ->
// veto -> repeat is a free reroll and delegation dominates hand-staffing for
// any player willing to fast-forward. Every issued brief counts, including one
// the player withdrew - otherwise withdraw-and-reissue is the same loophole
// wearing a hat.
export const MAX_BRIEFS_PER_ROLE = 2;

// Base search length in days, before the producer's own speed is applied. The
// scarcer/more specialised the department, the longer the look.
export const BRIEF_BASE_DAYS: Record<string, number> = {
  Cinematographer: 12,
  Editor: 9,
  Composer: 8,
  'Production Designer': 13,
  'VFX Supervisor': 14,
};
export const BRIEF_BASE_DAYS_FALLBACK = 10;

// Skill scales how fast they work: at skill 1 a search takes this multiple of
// the base, at skill 100 that one. A good producer is roughly twice as quick as
// a poor one - noticeable against a shoot date, not decisive on its own.
export const BRIEF_SPEED_BY_SKILL: Range = { min: 1.35, max: 0.7 };

// Reliability decides whether they come back when they SAID they would. At
// reliability 1 the search can overrun by up to this fraction; at 100, never.
// Rolled once at issue and stored, so the history is a deterministic read
// (SIMULATION_PHILOSOPHY Principle 2) rather than a per-tick coin flip.
export const BRIEF_MAX_OVERRUN = 0.6;

// How honest their day estimate is. At skill 1 they quote this fraction of the
// time they'll actually need (cheerful optimism); at 100 they quote it straight.
// Combined with the overrun above, a cheap unreliable producer promises two
// weeks and delivers in five.
export const BRIEF_ESTIMATE_OPTIMISM: Range = { min: 0.7, max: 1 };

// The pick. A Line Producer ranks candidates on VALUE - how good someone is
// against what they cost - and under-weights how well that person suits this
// film's specific department demands (engine/crewSpecialty.ts computes that
// fit; they discount it). These weights are the most important balance lever
// after the brief cap: raise the fit weight and delegation stops being a gamble
// on demanding departments.
export const BRIEF_VALUE_WEIGHT = 0.75;
export const BRIEF_FIT_WEIGHT = 0.25;

// How hard the price side of "value" bites, per unit of LOG-scaled position
// within the role's own salary range (engine/interpolate.ts:logT, the same
// log scale every other salary read in the game uses). Deliberately not
// skill-per-pound: fees span orders of magnitude where skill spans 1-100, so a
// literal ratio is just 1/fee and a producer would come back with the cheapest
// warm body every time - measured, and rejected, by the DELEGATION_DIAGNOSTIC
// harness. This says instead "each step up the price scale has to be paid for
// in quality", which is what a line producer actually believes. Higher = they
// scrape harder; at 0 they simply hire the best person the money allows and
// delegation stops costing you anything.
export const BRIEF_PRICE_PENALTY = 0.55;

// Skill narrows the field they choose from. A high-skill producer picks from a
// tight top slice of their own ranking; a poor one is erratic across a wide
// one - so skill sets the SPREAD of the outcome, not just its mean
// (SIMULATION_PHILOSOPHY Principle 1). Uniform within the slice.
export const BRIEF_CANDIDATE_SLICE: Range = { min: 12, max: 2 };

// What they get the deal for, as a multiple of the candidate's standing fee.
// Coming in under the allocation is a Line Producer's whole professional
// identity and the concrete thing delegation buys you; it is paid for by the
// fit risk above, never by being free.
export const BRIEF_FEE_DISCOUNT_BY_SKILL: Range = { min: 1, max: 0.86 };

// Genre affinity is amplify-only here, exactly as it is for producer effects:
// a producer working in a world they know reads as this much more skilled for
// the pick, the pace and the estimate. Never a penalty for its absence.
export const BRIEF_AFFINITY_SKILL_BONUS = 12;

// Below this skill the producer's read of an allocation ("what will that buy
// you?") comes back one band rosier than the pool actually supports. Same
// instinct as the day estimate above: what they tell you is their belief, and
// belief is only ever as good as they are.
export const BRIEF_HONEST_READ_SKILL = 55;
