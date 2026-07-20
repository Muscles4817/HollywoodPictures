import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { buildStateWithReadyDraft } from './testFixtures';
import type { GameState } from './gameState';
import type { Person, ProducerSpecialty } from '../types';
import { asPlayerDraft, findProject, playerReleasedFilms } from '../engine/project';
import { producerHiringFee, producerPerFilmFee } from '../engine/producers';
import { OFFICE_BENCH_CAPACITY_BY_TIER, OFFICE_UNLOCK_BRAND, OFFICE_UPGRADE_COST_BY_TIER } from '../data/producers';

let idCounter = 0;
function makeProducer(specialty: ProducerSpecialty, typicalSalary = 300_000): Person {
  return {
    id: `pool-producer-${idCounter++}`,
    identity: { name: 'Pool Producer', appearanceTags: [] },
    personality: { professionalism: 60, ambition: 55, loyalty: 50, ego: 30, temperament: 50, pressureHandling: 55, controversy: 18, adaptability: 55 },
    reputation: { fame: 40, prestige: 40, industryRespect: 60, reliability: 70, currentHeat: 40 },
    primaryRole: 'Producer',
    careers: { producer: { specialty, skill: 60, genreAffinity: [], typicalSalary } },
    availability: { commitments: [] },
    traits: [],
  };
}

/** A ready-draft state with a producer pool injected and (optionally) an unlocked office. */
function stateWith(opts: { pool?: Person[]; tier?: number; bench?: string[]; brand?: number; cash?: number } = {}): GameState {
  const base = buildStateWithReadyDraft(1);
  return {
    ...base,
    producerPool: opts.pool ?? [],
    studio: {
      ...base.studio,
      brand: opts.brand ?? base.studio.brand,
      cash: opts.cash ?? base.studio.cash,
      productionOffice: opts.tier ? { tier: opts.tier, benchProducerIds: opts.bench ?? [] } : null,
    },
  };
}

function focusedAttached(state: GameState): string[] {
  return asPlayerDraft(findProject(state.projects, state.focusedProjectId))?.attachedProducerIds ?? [];
}

describe('UNLOCK_PRODUCTION_OFFICE', () => {
  it('no-ops until the milestone is met', () => {
    const locked = stateWith({ brand: OFFICE_UNLOCK_BRAND - 1 }); // 0 films released, low brand
    const after = studioReducer(locked, { type: 'UNLOCK_PRODUCTION_OFFICE' });
    expect(after.studio.productionOffice).toBeNull();
  });

  it('unlocks at tier 1 with an empty bench once Brand clears the threshold', () => {
    const eligible = stateWith({ brand: OFFICE_UNLOCK_BRAND });
    const after = studioReducer(eligible, { type: 'UNLOCK_PRODUCTION_OFFICE' });
    expect(after.studio.productionOffice).toEqual({ tier: 1, benchProducerIds: [] });
  });

  it('is idempotent - unlocking an already-open office does nothing', () => {
    const open = stateWith({ tier: 1, brand: 90 });
    const after = studioReducer(open, { type: 'UNLOCK_PRODUCTION_OFFICE' });
    expect(after.studio.productionOffice).toEqual({ tier: 1, benchProducerIds: [] });
  });
});

describe('UPGRADE_PRODUCTION_OFFICE', () => {
  it('raises the tier and deducts the cash cost', () => {
    const s = stateWith({ tier: 1, cash: 10_000_000 });
    const after = studioReducer(s, { type: 'UPGRADE_PRODUCTION_OFFICE' });
    expect(after.studio.productionOffice?.tier).toBe(2);
    expect(after.studio.cash).toBe(10_000_000 - OFFICE_UPGRADE_COST_BY_TIER[2]);
  });

  it('no-ops when the studio cannot afford it', () => {
    const s = stateWith({ tier: 1, cash: OFFICE_UPGRADE_COST_BY_TIER[2] - 1 });
    const after = studioReducer(s, { type: 'UPGRADE_PRODUCTION_OFFICE' });
    expect(after.studio.productionOffice?.tier).toBe(1);
    expect(after.studio.cash).toBe(s.studio.cash);
  });

  it('no-ops at the max tier and when locked', () => {
    const maxed = stateWith({ tier: 3, cash: 99_000_000 });
    expect(studioReducer(maxed, { type: 'UPGRADE_PRODUCTION_OFFICE' }).studio.productionOffice?.tier).toBe(3);
    const locked = stateWith({ cash: 99_000_000 });
    expect(studioReducer(locked, { type: 'UPGRADE_PRODUCTION_OFFICE' }).studio.productionOffice).toBeNull();
  });
});

describe('HIRE_PRODUCER / FIRE_PRODUCER', () => {
  it('hires onto the bench and deducts the one-time hiring fee', () => {
    const p = makeProducer('Line', 300_000);
    const s = stateWith({ pool: [p], tier: 1, cash: 5_000_000 });
    const after = studioReducer(s, { type: 'HIRE_PRODUCER', producerId: p.id });
    expect(after.studio.productionOffice?.benchProducerIds).toEqual([p.id]);
    expect(after.studio.cash).toBe(5_000_000 - producerHiringFee(p));
  });

  it('no-ops when the bench is full for the tier', () => {
    const [a, b] = [makeProducer('Line'), makeProducer('Creative')];
    const s = stateWith({ pool: [a, b], tier: 1, bench: [a.id], cash: 5_000_000 }); // tier 1 bench cap is 1
    expect(OFFICE_BENCH_CAPACITY_BY_TIER[1]).toBe(1);
    const after = studioReducer(s, { type: 'HIRE_PRODUCER', producerId: b.id });
    expect(after.studio.productionOffice?.benchProducerIds).toEqual([a.id]);
    expect(after).toBe(s);
  });

  it('no-ops on insufficient cash, unknown id, duplicate hire, or locked office', () => {
    const p = makeProducer('Line', 1_000_000);
    const poor = stateWith({ pool: [p], tier: 1, cash: producerHiringFee(p) - 1 });
    expect(studioReducer(poor, { type: 'HIRE_PRODUCER', producerId: p.id })).toBe(poor);

    const unknown = stateWith({ pool: [p], tier: 1, cash: 9_000_000 });
    expect(studioReducer(unknown, { type: 'HIRE_PRODUCER', producerId: 'nope' })).toBe(unknown);

    const dup = stateWith({ pool: [p], tier: 2, bench: [p.id], cash: 9_000_000 });
    expect(studioReducer(dup, { type: 'HIRE_PRODUCER', producerId: p.id })).toBe(dup);

    const locked = stateWith({ pool: [p], cash: 9_000_000 });
    expect(studioReducer(locked, { type: 'HIRE_PRODUCER', producerId: p.id })).toBe(locked);
  });

  it('firing removes from the bench (no refund) and detaches from any in-progress draft', () => {
    const p = makeProducer('Line', 300_000);
    const hired = stateWith({ pool: [p], tier: 1, bench: [p.id], cash: 4_000_000 });
    const attached = studioReducer(hired, { type: 'ATTACH_PRODUCER', producerId: p.id });
    expect(focusedAttached(attached)).toEqual([p.id]);

    const fired = studioReducer(attached, { type: 'FIRE_PRODUCER', producerId: p.id });
    expect(fired.studio.productionOffice?.benchProducerIds).toEqual([]);
    expect(focusedAttached(fired)).toEqual([]); // invariant: attached is always a subset of the bench
    expect(fired.studio.cash).toBe(attached.studio.cash); // no refund
  });
});

describe('ATTACH_PRODUCER / DETACH_PRODUCER', () => {
  it('attaches a bench producer to the focused draft without moving cash', () => {
    const p = makeProducer('Creative');
    const s = stateWith({ pool: [p], tier: 1, bench: [p.id] });
    const after = studioReducer(s, { type: 'ATTACH_PRODUCER', producerId: p.id });
    expect(focusedAttached(after)).toEqual([p.id]);
    expect(after.studio.cash).toBe(s.studio.cash);
  });

  it('refuses to attach a producer that is not on the bench', () => {
    const p = makeProducer('Creative');
    const s = stateWith({ pool: [p], tier: 1, bench: [] });
    expect(studioReducer(s, { type: 'ATTACH_PRODUCER', producerId: p.id })).toBe(s);
  });

  it('does not attach the same producer twice', () => {
    const p = makeProducer('Fixer');
    const s = stateWith({ pool: [p], tier: 1, bench: [p.id] });
    const once = studioReducer(s, { type: 'ATTACH_PRODUCER', producerId: p.id });
    const twice = studioReducer(once, { type: 'ATTACH_PRODUCER', producerId: p.id });
    expect(focusedAttached(twice)).toEqual([p.id]);
    expect(twice).toBe(once);
  });

  it('detaches an attached producer', () => {
    const p = makeProducer('Executive');
    const s = stateWith({ pool: [p], tier: 1, bench: [p.id] });
    const attached = studioReducer(s, { type: 'ATTACH_PRODUCER', producerId: p.id });
    const detached = studioReducer(attached, { type: 'DETACH_PRODUCER', producerId: p.id });
    expect(focusedAttached(detached)).toEqual([]);
  });
});

describe('per-film fee reaches the released film (end to end)', () => {
  it("a Creative producer's fee lands in the film's totalCost at release", () => {
    // Creative changes quality but never cost, so the whole totalCost delta
    // between the attached and un-attached run is exactly the per-film fee.
    const p = makeProducer('Creative', 300_000);
    const base = stateWith({ pool: [p], tier: 1, bench: [p.id], cash: 50_000_000 });

    const baseline = playerReleasedFilms(studioReducer(base, { type: 'SCHEDULE_RELEASE', releaseDay: 1 }).projects)[0];

    const attached = studioReducer(base, { type: 'ATTACH_PRODUCER', producerId: p.id });
    const withProducer = playerReleasedFilms(studioReducer(attached, { type: 'SCHEDULE_RELEASE', releaseDay: 1 }).projects)[0];

    expect(withProducer.results.totalCost).toBe(baseline.results.totalCost + producerPerFilmFee(p));
  });
});
