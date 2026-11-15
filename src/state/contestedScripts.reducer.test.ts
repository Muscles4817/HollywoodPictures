// Contested scripts through the reducer and the harness bot
// (docs/IMPLEMENTATION_PLAN_market_realism.md Phase 5).
import { describe, expect, it } from 'vitest';
import { studioReducer } from './studioReducer';
import { BOT_STRATEGIES, botScratchRun, botStartFilm, createBotStudio } from './playerBot';
import { DIFFICULTY_TIERS } from '../data/difficulty';
import { asPlayerDraft } from '../engine/project';
import { buildReadyAsset } from './testFixtures';
import { createRng } from '../engine/random';
import type { GameState } from './gameState';
import type { Opportunity } from '../types';

const midmajor = DIFFICULTY_TIERS.find((t) => t.id === 'midmajor')!;
const careful = BOT_STRATEGIES.find((s) => s.name === 'Careful')!;

function hotScript(seed: number) {
  const script = buildReadyAsset(createRng(seed)).script;
  return { ...script, title: `Hot ${seed}`, originality: 90, hook: 90, emotionalPremise: 90, structure: 90, characters: 90, dialogue: 90, scale: 'Medium' as const };
}
const listing = (id: string, seed: number, overrides: Partial<Opportunity> = {}): Opportunity => ({
  id, source: 'Agent Package', script: hotScript(seed), acquisitionCost: 300_000, expiresOnDay: 400, postedOnDay: 1, bids: [], ...overrides,
});

/** A bot studio whose market is exactly these listings, with no rivals to bid against it unless a test adds a bid. */
function marketOf(opportunities: Opportunity[]): GameState {
  const s = createBotStudio(42, midmajor);
  return { ...s, rivalStudios: [], opportunities, nextOpportunityCheckDay: s.totalDays + 3 };
}

function tickUntilResolved(s: GameState): GameState {
  const until = s.nextOpportunityCheckDay;
  while (s.totalDays < until) s = studioReducer({ ...s, rivalStudios: [] }, { type: 'ADVANCE_DAY' });
  return s;
}

describe('the reducer and a contested script', () => {
  it('refuses to sell a contested script outright', () => {
    const s = marketOf([listing('hot', 1, { contested: true })]);
    expect(studioReducer(s, { type: 'ACQUIRE_OPPORTUNITY', opportunityId: 'hot' })).toBe(s);
  });

  it('accepts an opening offer on a contested script with no bids, above the asking price only', () => {
    const s = marketOf([listing('hot', 1, { contested: true })]);
    expect(studioReducer(s, { type: 'PLACE_BID', opportunityId: 'hot', amount: 300_000 })).toBe(s);
    const bid = studioReducer(s, { type: 'PLACE_BID', opportunityId: 'hot', amount: 320_000 });
    expect(bid.opportunities[0].bids).toEqual([{ bidderId: 'player', bidderName: s.studio.name, amount: 320_000 }]);
  });

  it('sells a lapsed contested script outright again', () => {
    const s = marketOf([listing('cold', 1, { contested: false })]);
    const bought = studioReducer(s, { type: 'ACQUIRE_OPPORTUNITY', opportunityId: 'cold' });
    expect(bought.studio.assets.some((a) => a.id === 'cold')).toBe(true);
  });
});

describe('the bot bids on a contested script', () => {
  it('wins an auction nobody else enters, then makes the film from the new asset', () => {
    const run = botScratchRun();
    let s = marketOf([listing('hot', 1, { contested: true }), listing('plain', 2, { script: { ...hotScript(2), originality: 40, hook: 40, emotionalPremise: 40, structure: 40, characters: 40, dialogue: 40 } })]);
    s = botStartFilm(s, careful, run);
    expect(run.contestedOffers).toBe(1);
    expect(s.opportunities.find((o) => o.id === 'hot')!.bids[0].bidderId).toBe('player');
    // While its offer is open it starts nothing else.
    expect(botStartFilm(s, careful, run)).toBe(s);
    s = tickUntilResolved(s);
    expect(s.studio.assets.some((a) => a.id === 'hot')).toBe(true);
    // The player hears about it (engine/bidNotifications.ts).
    expect(s.bidNotifications?.some((n) => n.kind === 'won' && n.opportunityId === 'hot')).toBe(true);
    s = botStartFilm(s, careful, run);
    expect(run.contestedWins).toBe(1);
    expect(s.projects.map(asPlayerDraft).some((d) => d?.assetId === 'hot' && d.greenlitOnDay != null)).toBe(true);
  });

  it('moves on after losing, and is never left waiting on an offer that cannot resolve', () => {
    const run = botScratchRun();
    let s = marketOf([listing('hot', 1, { contested: true }), listing('plain', 2, { script: { ...hotScript(2), originality: 40, hook: 40, emotionalPremise: 40, structure: 40, characters: 40, dialogue: 40 } })]);
    s = botStartFilm(s, careful, run);
    // A rival comes in over the top before the week closes.
    s = { ...s, opportunities: s.opportunities.map((o) => (o.id === 'hot' ? { ...o, bids: [...o.bids, { bidderId: 'rival-x', bidderName: 'Rival X', amount: 5_000_000 }] } : o)) };
    s = tickUntilResolved(s);
    expect(s.studio.assets.some((a) => a.id === 'hot')).toBe(false);
    expect(s.bidNotifications?.some((n) => n.kind === 'lost' && n.opportunityId === 'hot')).toBe(true);
    const assetsBefore = s.studio.assets.length;
    const next = botStartFilm(s, careful, run);
    expect(run.contestedWins).toBe(0);
    // It chose again: a fresh offer on this week's best, or a script bought outright.
    expect(next).not.toBe(s);
    expect(run.contestedOffers === 2 || next.studio.assets.length > assetsBefore).toBe(true);
  });
});
