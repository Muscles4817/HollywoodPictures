// Contested scripts (docs/IMPLEMENTATION_PLAN_market_realism.md Phase 5): the
// best of each week's batch are sold by bidding, and rivals want them.
import { describe, expect, it } from 'vitest';
import { CONTESTED_MIN_HEAT, CONTESTED_PER_BATCH, flagContested, marketHeat, settleOpportunities } from './opportunities';
import { considerBiddingOnOpportunity, evaluateOpportunityForTier, generateRivalStudios } from './rivalStudios';
import { chooseRivalHires } from './rivalCasting';
import { computeTalentCompatibility } from './compatibility';
import { getTypicalSalaryForRole } from './person';
import { createRng, withRng } from './random';
import { buildReadyAsset } from '../state/testFixtures';
import { generateTalentCandidates } from './talentGenerator';
import type { Opportunity, Person, Script } from '../types';

const baseScript = buildReadyAsset(createRng(1)).script;
const withStats = (stats: Partial<Script>): Script => ({ ...baseScript, ...stats });
const listing = (id: string, script: Script, overrides: Partial<Opportunity> = {}): Opportunity => ({
  id, source: 'Spec Screenplay', script, acquisitionCost: 200_000, expiresOnDay: 100, postedOnDay: 1, bids: [], ...overrides,
});

describe('marketHeat', () => {
  it('is the mean of originality, hook, emotional premise, structure, characters and dialogue', () => {
    const s = withStats({ originality: 60, hook: 90, emotionalPremise: 30, structure: 70, characters: 50, dialogue: 60 });
    expect(marketHeat(s)).toBeCloseTo((60 + 90 + 30 + 70 + 50 + 60) / 6, 10);
  });
});

describe('settling a batch', () => {
  it('flags at most two of a batch, the hottest, and none below the minimum', () => {
    const heats = [50, 70, 80, 61, 75, 90];
    const batch = heats.map((h, i) => listing(`o${i}`, withStats({ originality: h, hook: h, emotionalPremise: h, structure: h, characters: h, dialogue: h })));
    const flagged = flagContested(batch);
    expect(flagged.filter((o) => o.contested).map((o) => o.id)).toEqual(['o2', 'o5']);
    const cold = flagContested(batch.slice(0, 1).concat(batch[3]));
    expect(cold.some((o) => o.contested)).toBe(false);
    expect(CONTESTED_PER_BATCH).toBe(2);
    expect(CONTESTED_MIN_HEAT).toBe(62);
  });

  it('flags real generated batches deterministically, never more than two, never a cold script', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const a = withRng(seed, (rng) => settleOpportunities([], 1, 1, rng)).result.opportunities;
      const b = withRng(seed, (rng) => settleOpportunities([], 1, 1, rng)).result.opportunities;
      expect(a.map((o) => o.contested)).toEqual(b.map((o) => o.contested));
      const contested = a.filter((o) => o.contested);
      expect(contested.length).toBeLessThanOrEqual(2);
      for (const o of contested) expect(marketHeat(o.script)).toBeGreaterThanOrEqual(CONTESTED_MIN_HEAT);
    }
  });

  it('resolves a contested script with offers to the highest, and makes one without an ordinary listing', () => {
    const offered = listing('hot', baseScript, { contested: true, bids: [{ bidderId: 'r1', bidderName: 'R1', amount: 300_000 }, { bidderId: 'player', bidderName: 'You', amount: 350_000 }] });
    const ignored = listing('lukewarm', baseScript, { contested: true });
    const { result } = withRng(9, (rng) => settleOpportunities([offered, ignored], 1, 1, rng));
    expect(result.resolvedBids.map((r) => [r.opportunity.id, r.winnerId, r.amount])).toEqual([['hot', 'player', 350_000]]);
    const lapsed = result.opportunities.find((o) => o.id === 'lukewarm')!;
    expect(lapsed.contested).toBe(false);
    expect(lapsed.expiresOnDay).toBe(100);
  });
});

describe('rivals want contested and high-hook scripts', () => {
  const rival = { ...generateRivalStudios(createRng(3)).find((r) => r.tier === 'Mid-Size')!, cash: 1_000_000_000 };

  it('opens higher on a contested script than on an ordinary one of the same price', () => {
    let contestedTotal = 0;
    let ordinaryTotal = 0;
    for (let seed = 0; seed < 40; seed++) {
      const c = considerBiddingOnOpportunity(rival, 'Medium', [listing('c', baseScript, { contested: true })], 1, createRng(seed));
      const o = considerBiddingOnOpportunity(rival, 'Medium', [listing('o', baseScript)], 1, createRng(seed));
      contestedTotal += c!.amount;
      ordinaryTotal += o!.amount;
    }
    expect(contestedTotal).toBeGreaterThan(ordinaryTotal * 1.15);
  });

  it('ranks a high-hook script above a low-hook one of equal craft, and a contested one higher still', () => {
    const craft = { originality: 60, structure: 60, characters: 60, dialogue: 60, emotionalPremise: 60 };
    const high = evaluateOpportunityForTier(rival, 'Medium', listing('h', withStats({ ...craft, hook: 90 })), 1_000_000);
    const low = evaluateOpportunityForTier(rival, 'Medium', listing('l', withStats({ ...craft, hook: 30 })), 1_000_000);
    const hot = evaluateOpportunityForTier(rival, 'Medium', listing('l', withStats({ ...craft, hook: 30 }), { contested: true }), 1_000_000);
    expect(high).toBeGreaterThan(low);
    expect(hot).toBeGreaterThan(low);
  });
});

describe('rivals read a director\'s fit for the script', () => {
  const directors: Person[] = withRng(21, (rng) => generateTalentCandidates('Director', rng, 40)).result;

  it('prefers, among equal records, the director whose taste suits the script', () => {
    // Two copies of one director - identical record and fee - differing only in taste.
    const base = directors[0];
    const fits = directors.map((d) => ({ d, fit: computeTalentCompatibility(d, 'Director', baseScript) ?? 50 })).sort((a, b) => b.fit - a.fit);
    // Same career in every respect but its tonal taste.
    const withTaste = (id: string, from: Person): Person => ({ ...base, id, careers: { ...base.careers, director: { ...base.careers.director!, toneProfile: from.careers.director!.toneProfile } } });
    const suited = withTaste('suited', fits[0].d);
    const unsuited = withTaste('unsuited', fits[fits.length - 1].d);
    const fee = getTypicalSalaryForRole(base, 'Director');
    const record = (p: Person) => computeTalentCompatibility(p, 'Director', baseScript)!;
    expect(record(suited)).toBeGreaterThan(record(unsuited) + 10);
    let suitedWins = 0;
    for (let seed = 0; seed < 30; seed++) {
      const [pick] = chooseRivalHires([unsuited, suited], 'Director', fee, 1, createRng(seed), undefined, baseScript);
      if (pick.id === 'suited') suitedWins += 1;
    }
    expect(suitedWins).toBeGreaterThan(20);
  });

  it('without a script behaves exactly as before', () => {
    const a = chooseRivalHires(directors, 'Director', 1_000_000, 3, createRng(5));
    const b = chooseRivalHires(directors, 'Director', 1_000_000, 3, createRng(5), undefined, undefined);
    expect(b.map((p) => p.id)).toEqual(a.map((p) => p.id));
  });
});
