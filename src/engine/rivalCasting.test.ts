import { describe, it, expect } from 'vitest';
import { chooseRivalHires, RIVAL_REACH_BELOW_TARGET, RIVAL_STRETCH_ABOVE_TARGET, trackRecordScore } from './rivalCasting';
import { generateTalentPool } from './talentGenerator';
import { getTypicalSalaryForRole } from './person';
import { createRng } from './random';
import { GENERATED_TALENT_DB } from '../data/talentDatabases';
import type { Person } from '../types';

const pool = generateTalentPool(createRng(31), GENERATED_TALENT_DB);
const fee = (p: Person) => getTypicalSalaryForRole(p, 'Lead Actor');
const withStanding = (p: Person, heat: number, fame = p.reputation.fame): Person => ({ ...p, reputation: { ...p.reputation, currentHeat: heat, fame } });

describe('a rival hires on track record from the people it can afford', () => {
  const target = 2_000_000;

  it('stays within what the film can pay, and does not reach far beneath it when it need not', () => {
    for (let seed = 1; seed <= 20; seed++) {
      for (const hire of chooseRivalHires(pool.Actor, 'Lead Actor', target, 2, createRng(seed))) {
        expect(fee(hire)).toBeLessThanOrEqual(target * RIVAL_STRETCH_ABOVE_TARGET);
        expect(fee(hire)).toBeGreaterThanOrEqual(target * RIVAL_REACH_BELOW_TARGET);
      }
    }
  });

  it('prefers the hot to the cold among people at the same price', () => {
    const inRange = pool.Actor.filter((p) => fee(p) <= target && fee(p) >= target * 0.5).slice(0, 12);
    const hot = inRange.slice(0, 3).map((p) => withStanding(p, 95, 70));
    const cold = inRange.slice(3).map((p) => withStanding(p, 10, 30));
    let hotPicks = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const picked = chooseRivalHires([...hot, ...cold], 'Lead Actor', target, 1, createRng(seed));
      if (hot.some((p) => p.id === picked[0].id)) hotPicks++;
    }
    expect(hotPicks).toBeGreaterThan(36);
  });

  it('notices a cheap person on a run: they get the bigger film a price-only rule would never have given them', () => {
    const cheap = pool.Actor.filter((p) => fee(p) >= target * 0.4 && fee(p) <= target * 0.5)[0];
    const others = pool.Actor.filter((p) => p.id !== cheap.id);
    const timesPicked = (person: Person) => {
      let picked = 0;
      for (let seed = 1; seed <= 60; seed++) {
        if (chooseRivalHires([person, ...others], 'Lead Actor', target, 2, createRng(seed)).some((p) => p.id === person.id)) picked++;
      }
      return picked;
    };
    // Under the old rule nobody at half the target price was ever considered.
    // Now someone at that price with heat is in the running against the whole
    // field, and the same person without it is not.
    expect(timesPicked(withStanding(cheap, 96, 65))).toBeGreaterThanOrEqual(3);
    expect(timesPicked(withStanding(cheap, 15, 20))).toBe(0);
  });

  it('does not always pick the same people: the read is imperfect', () => {
    const sets = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) sets.add(chooseRivalHires(pool.Actor, 'Lead Actor', target, 2, createRng(seed)).map((p) => p.id).sort().join(','));
    expect(sets.size).toBeGreaterThan(3);
  });

  it('for a craft, reads the respect of colleagues and years in the job, not fame', () => {
    const base = pool.Editor[10];
    const respected = { ...base, reputation: { ...base.reputation, industryRespect: 90, fame: 5 } };
    const famous = { ...base, reputation: { ...base.reputation, industryRespect: 20, fame: 90 } };
    expect(trackRecordScore(respected, 'Editor')).toBeGreaterThan(trackRecordScore(famous, 'Editor'));
    expect(trackRecordScore(famous, 'Lead Actor')).toBeGreaterThan(trackRecordScore(respected, 'Lead Actor'));
  });

  it('still casts the film when nobody is in range, taking whoever is nearest in price', () => {
    const picked = chooseRivalHires(pool.Editor, 'Editor', 50_000_000, 1, createRng(1));
    expect(picked).toHaveLength(1);
    expect(chooseRivalHires([], 'Editor', 100_000, 1, createRng(1))).toEqual([]);
    expect(chooseRivalHires(pool.Editor, 'Editor', 100_000, 0, createRng(1))).toEqual([]);
  });
});
