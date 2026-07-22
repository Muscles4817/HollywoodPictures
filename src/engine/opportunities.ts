import type { Opportunity, OpportunityBid, OpportunitySource, Person, ProductionScale, Script } from '../types';
import { GENRES } from '../data/genres';
import { generateScriptOptions } from './scriptGenerator';
import { pickGenreForAffinity, selectWriterForSource, writerProfileFromPerson } from './writers';
import { pick, randInt, type RandomFn } from './random';

// docs/DESIGN_REVIEW_development_pipeline.md - source is mostly flavor
// riding on two real levers (how much it costs, how long it stays
// available), not a parallel generation system per source. Sequel/Director-
// pitch/Actor-passion-project sources are deliberately not modeled yet -
// out of scope for this MVP (no franchises, no talent pre-attachment).
const OPPORTUNITY_SOURCES: OpportunitySource[] = ['Spec Screenplay', 'Agent Package', 'Publisher Rights', 'Studio Original'];

/** acquisitionCost = script.cost * this multiplier - script.cost is still what engine/scriptGenerator.ts rolls, this just prices *access* to it differently per source. */
const SOURCE_COST_MULTIPLIER: Record<OpportunitySource, number> = {
  'Spec Screenplay': 0.4,
  'Agent Package': 0.9,
  'Publisher Rights': 1.1,
  'Studio Original': 0.1,
};

/** How many days from generation until the opportunity expires, if never acquired. */
const SOURCE_EXPIRY_DAYS: Record<OpportunitySource, [number, number]> = {
  'Spec Screenplay': [15, 30],
  'Agent Package': [10, 20],
  'Publisher Rights': [30, 60],
  'Studio Original': [45, 90],
};

/**
 * Milestone: Opportunity Market weekly cadence + bidding. A fixed weekly
 * beat, not the old randomized [8, 16]-day timer - this is what makes "New
 * This Week" (components/OpportunityMarket.tsx) and "resolves at the next
 * weekly tick" (settleOpportunities below) both a clean, well-defined
 * boundary instead of a fuzzy one. Both generation and bid resolution run
 * off this same timer (`nextGenerationCheckDay`) - one shared weekly beat,
 * not two independent ones.
 */
export const WEEK_LENGTH_DAYS = 7;

/** How many opportunities appear in one weekly batch - widened from the old [2, 4] since the pool now also serves AI demand (engine/rivalStudios.ts), not just the player's. */
const BATCH_SIZE: [number, number] = [3, 6];

/** Assembles the final Opportunity from an already-generated source/script/author - shared by both the legacy and authored paths so the id/cost/expiry rng draws happen in exactly one place, in the same order. */
function finishOpportunity(totalDays: number, rng: RandomFn, source: OpportunitySource, script: Script, writerId: string | undefined): Opportunity {
  return {
    id: `opportunity-${totalDays}-${randInt(rng, 0, 999_999)}`,
    source,
    script,
    acquisitionCost: Math.round(script.cost * SOURCE_COST_MULTIPLIER[source]),
    expiresOnDay: totalDays + randInt(rng, ...SOURCE_EXPIRY_DAYS[source]),
    postedOnDay: totalDays,
    bids: [],
    writerIds: writerId ? [writerId] : undefined,
  };
}

/**
 * One opportunity. With no writer pool, the legacy path is preserved exactly -
 * genre, script, source, in that rng draw order - so un-authored generation is
 * byte-identical (opportunities.test.ts). With a pool (Phase 2), the pipeline
 * follows Hollywood: pick the source first, then a source-appropriate writer
 * (a spec skews toward unknowns, a studio commission toward elites - see
 * engine/writers.ts), then a genre from that writer's own affinity, then a
 * screenplay shaped by them.
 */
function generateOpportunity(totalDays: number, rng: RandomFn, writers: Person[]): Opportunity {
  if (writers.length === 0) {
    const genre = pick(rng, GENRES);
    const script = generateScriptOptions(genre, rng, 1)[0];
    const source = pick(rng, OPPORTUNITY_SOURCES);
    return finishOpportunity(totalDays, rng, source, script, undefined);
  }

  const source = pick(rng, OPPORTUNITY_SOURCES);
  const writer = selectWriterForSource(writers, source, rng);
  const profile = writer ? writerProfileFromPerson(writer) : null;
  const genre = profile ? pickGenreForAffinity(rng, profile.genreAffinity) : pick(rng, GENRES);
  const script = generateScriptOptions(genre, rng, 1, profile ?? undefined)[0];
  return finishOpportunity(totalDays, rng, source, script, writer?.id);
}

/**
 * Adds or raises one bidder's own bid on an Opportunity - upserts by
 * `bidderId`, so a studio never has more than one active bid on the same
 * opportunity at once. There's no withdrawal action: a bidder who no longer
 * wants to compete simply never raises again (same "purely additive, no
 * retraction" simplification the talent-shortage/affordability skip
 * patterns elsewhere in this codebase already use) - their last offer stays
 * on the table and can still win if nobody else raises further.
 */
export function placeBid(opportunities: Opportunity[], opportunityId: string, bid: OpportunityBid): Opportunity[] {
  return opportunities.map((o) => {
    if (o.id !== opportunityId) return o;
    const existingIndex = o.bids.findIndex((b) => b.bidderId === bid.bidderId);
    const bids = existingIndex >= 0 ? o.bids.map((b, i) => (i === existingIndex ? bid : b)) : [...o.bids, bid];
    return { ...o, bids };
  });
}

/** The highest bid on an Opportunity, or null if uncontested - ties go to whichever bid was placed first (bids are only ever appended or replaced in place, never reordered, so array order is placement order). */
export function highestBid(opportunity: Opportunity): OpportunityBid | null {
  return opportunity.bids.reduce<OpportunityBid | null>((best, b) => (best === null || b.amount > best.amount ? b : best), null);
}

/** One Opportunity's bidding having resolved at a weekly tick - the winner and what they pay, for state/studioReducer.ts/engine/rivalStudios.ts to actually apply (charge the player's cash / start a rival's production) - engine/opportunities.ts has no business touching Studio/RivalStudio state directly. `scale` mirrors the winning bid's own (types/index.ts:OpportunityBid.scale) - present for a rival winner, absent for the player. */
export interface ResolvedBid {
  opportunity: Opportunity;
  winnerId: string;
  winnerName: string;
  amount: number;
  scale?: ProductionScale;
}

export interface OpportunitySettlement {
  /** Expired opportunities dropped, a fresh batch folded in if due, and every opportunity that just won its own bidding war removed - what's left is exactly what's still available to acquire or bid on. */
  opportunities: Opportunity[];
  nextGenerationCheckDay: number;
  /** Empty on every call that isn't this week's tick - only non-empty the moment contested opportunities actually resolve. */
  resolvedBids: ResolvedBid[];
}

/**
 * Expires anything past its own `expiresOnDay`, then - once
 * `nextGenerationCheckDay` has arrived - generates a fresh batch AND
 * resolves every currently-contested opportunity's bidding war in the same
 * pass (Milestone: Opportunity Market bidding - one shared weekly beat for
 * both, not two independent timers). The same lazy, catch-up-safe
 * settlement pattern every other calendar-triggered thing in this codebase
 * already uses (settleScheduledReleases, settleRivalMarket). Called from
 * the same reducer sites those are - every action that can advance
 * GameState.totalDays.
 *
 * An opportunity with zero bids is untouched by resolution - it just stays
 * available, instant-buy, until someone acquires it or it expires, exactly
 * as before. Resolution only ever looks at opportunities with `bids.length > 0`.
 */
export function settleOpportunities(
  opportunities: Opportunity[],
  nextGenerationCheckDay: number,
  totalDays: number,
  rng: RandomFn,
  // The world's writer pool (GameState.talentPool.Writer), so a fresh batch can
  // be authored (Phase 2). Defaults to empty: callers that omit it (every unit
  // test that exercises settlement logic in isolation) get the byte-identical
  // legacy un-authored generation, preserving determinism.
  writers: Person[] = [],
): OpportunitySettlement {
  const active = opportunities.filter((o) => o.expiresOnDay > totalDays);
  if (nextGenerationCheckDay > totalDays) {
    return { opportunities: active, nextGenerationCheckDay, resolvedBids: [] };
  }

  const resolvedBids: ResolvedBid[] = [];
  const stillOpen: Opportunity[] = [];
  for (const o of active) {
    const winner = o.bids.length > 0 ? highestBid(o) : null;
    if (winner) {
      resolvedBids.push({ opportunity: o, winnerId: winner.bidderId, winnerName: winner.bidderName, amount: winner.amount, scale: winner.scale });
    } else {
      stillOpen.push(o);
    }
  }

  const batchSize = randInt(rng, ...BATCH_SIZE);
  const newOnes = Array.from({ length: batchSize }, () => generateOpportunity(totalDays, rng, writers));
  return {
    opportunities: [...stillOpen, ...newOnes],
    nextGenerationCheckDay: totalDays + WEEK_LENGTH_DAYS,
    resolvedBids,
  };
}

/**
 * Puts a forfeited win's Opportunity back into normal circulation - the
 * winning bidder could no longer actually afford or fit it by the time
 * resolution reached them (state/studioReducer.ts re-validates both a
 * rival winner, via engine/rivalStudios.ts:startRivalProductionFromWonScript,
 * and the player, since cash can move either way between placing a bid and
 * the weekly tick that resolves it). Takes the
 * original `ResolvedBid.opportunity` (settleOpportunities already removed
 * it from the live `opportunities` array once it resolved, so there's
 * nothing left in that array to find and update) and re-adds it with
 * `bids: []` - bids clear entirely rather than falling through to the
 * next-highest bidder, simpler and avoids re-validating a second/third
 * bidder's own affordability in the same pass for what should be a rare
 * edge case.
 */
export function reopenForfeitedOpportunity(opportunities: Opportunity[], opportunity: Opportunity): Opportunity[] {
  return [...opportunities, { ...opportunity, bids: [] }];
}
