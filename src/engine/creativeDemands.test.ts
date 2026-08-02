import { describe, it, expect } from 'vitest';
import {
  deriveDemandLoad,
  generateCreativeDemands,
  resolveDemandQualityDelta,
  acceptedDemandQualityDelta,
  hasUnresolvedBlockingDemand,
  describeDemandCompetence,
  describeCreativeDemand,
  directorPatience,
  directorWouldWalk,
  refusalTension,
  describeDirectorPatience,
} from './creativeDemands';
import { generateTalentCandidates } from './talentGenerator';
import { generateScriptOptions } from './scriptGenerator';
import { withRng } from './random';
import type { CreativeDemand, DomainAptitudes, Person, Script, ToneProfile } from '../types';

function baseDirector(seed: number): Person {
  return withRng(seed, (rng) => generateTalentCandidates('Director', rng, 1)[0]).result;
}
function script(seed: number): Script {
  return withRng(seed, (rng) => generateScriptOptions('Drama', rng, 1)[0]).result;
}

/** A director with authored aptitudes, ego, and (optionally) a tone profile - for controlling the Snyder bet directly. */
function authoredDirector(
  seed: number,
  over: { aptitudes: DomainAptitudes; ego?: number; toneProfile?: ToneProfile },
): Person {
  const base = baseDirector(seed);
  return {
    ...base,
    personality: { ...base.personality, ego: over.ego ?? base.personality.ego },
    careers: {
      ...base.careers,
      director: { ...base.careers.director!, aptitudes: over.aptitudes, toneProfile: over.toneProfile ?? base.careers.director!.toneProfile },
    },
  };
}

const demand = (id: string, domain: CreativeDemand['domain'], over: Partial<CreativeDemand> = {}): CreativeDemand => ({
  id,
  demanderId: 'dir',
  domain,
  strength: 0.9,
  blocking: true,
  ...over,
});

const rel = (collaborations: number) => ({ collaborations, warmth: 0, tier: 'none' as const, lastWorkedDay: null });

describe('deriveDemandLoad', () => {
  it('an aligned, versatile director (flat aptitudes, tone matching the material) makes zero demands - the yes-man', () => {
    const s = script(1);
    const yesMan = authoredDirector(1, {
      ego: 10,
      aptitudes: { story: 60, visual: 60, performance: 60, craft: 60 },
      toneProfile: s.toneProfile, // no tone clash
    });
    expect(deriveDemandLoad(yesMan, s)).toBe(0);
  });

  it('a spiky, high-ego director on clashing material makes several demands', () => {
    const s = script(2);
    const clashingTone: ToneProfile = { action: 90, comedy: 90, romance: 10, suspense: 90, drama: 10, spectacle: 90 };
    const auteur = authoredDirector(2, {
      ego: 100,
      aptitudes: { story: 15, visual: 95, performance: 60, craft: 35 },
      toneProfile: clashingTone,
    });
    expect(deriveDemandLoad(auteur, s)).toBeGreaterThan(0);
  });
});

describe('generateCreativeDemands', () => {
  it('is deterministic per (director, script) and yields as many distinct demands as the load', () => {
    const s = script(3);
    const dir = authoredDirector(3, { ego: 100, aptitudes: { story: 12, visual: 96, performance: 55, craft: 30 }, toneProfile: { action: 90, comedy: 10, romance: 10, suspense: 90, drama: 10, spectacle: 95 } });
    const a = generateCreativeDemands(dir, s);
    const b = generateCreativeDemands(dir, s);
    expect(a).toEqual(b);
    expect(a.length).toBe(deriveDemandLoad(dir, s));
    expect(new Set(a.map((d) => d.domain)).size).toBe(a.length); // distinct domains
    for (const d of a) expect(d.demanderId).toBe(dir.id);
  });
});

describe('resolveDemandQualityDelta - the Snyder bet', () => {
  it('ceding a domain the director commands lifts the film; ceding one they are weak at drags it down', () => {
    const dir = authoredDirector(4, { aptitudes: { story: 15, visual: 95, performance: 60, craft: 40 } });
    const visualDelta = resolveDemandQualityDelta(demand('d-vis', 'Cinematography', { demanderId: dir.id }), dir);
    const storyDelta = resolveDemandQualityDelta(demand('d-story', 'Script', { demanderId: dir.id }), dir);
    expect(visualDelta).toBeGreaterThan(0); // visual 95 -> good to cede
    expect(storyDelta).toBeLessThan(0); // story 15 -> the classic over-reach, hurts
  });

  it('is deterministic per demand id', () => {
    const dir = authoredDirector(5, { aptitudes: { story: 70, visual: 70, performance: 70, craft: 70 } });
    const d = demand('fixed-id', 'Edit', { demanderId: dir.id });
    expect(resolveDemandQualityDelta(d, dir)).toBe(resolveDemandQualityDelta(d, dir));
  });
});

describe('accepted-delta and blocking-gate helpers', () => {
  it('acceptedDemandQualityDelta sums only accepted demands', () => {
    const demands: CreativeDemand[] = [
      demand('a', 'Cinematography', { resolution: 'accepted', qualityDelta: 6 }),
      demand('b', 'Script', { resolution: 'accepted', qualityDelta: -4 }),
      demand('c', 'Edit', { resolution: 'refused', qualityDelta: 9 }),
      demand('d', 'Score'),
    ];
    expect(acceptedDemandQualityDelta(demands)).toBe(2); // 6 + (-4), refused/pending ignored
    expect(acceptedDemandQualityDelta(undefined)).toBe(0);
  });

  it('hasUnresolvedBlockingDemand is true only while a blocking demand is still pending', () => {
    expect(hasUnresolvedBlockingDemand([demand('a', 'Script', { blocking: true })])).toBe(true);
    expect(hasUnresolvedBlockingDemand([demand('a', 'Script', { blocking: true, resolution: 'refused' })])).toBe(false);
    expect(hasUnresolvedBlockingDemand([demand('a', 'Script', { blocking: false })])).toBe(false);
    expect(hasUnresolvedBlockingDemand(undefined)).toBe(false);
  });
});

describe('describeDemandCompetence - relationship gates the read', () => {
  it("hides a domain you can't yet judge at arm's length, then reveals it once you've worked together", () => {
    // Visual is the standout strength, Story the pronounced weakness; Performance
    // is a middling domain the reputation read does NOT surface.
    const dir = authoredDirector(6, { aptitudes: { story: 15, visual: 95, performance: 60, craft: 40 } });
    const castingDemand = demand('cast', 'Casting', { demanderId: dir.id }); // governed by Performance

    const stranger = describeDemandCompetence(dir, castingDemand, rel(0));
    expect(stranger.band).toBeUndefined();
    expect(stranger.text).toMatch(/don't yet know/i);

    const known = describeDemandCompetence(dir, castingDemand, rel(3));
    expect(known.band).toBe('solid'); // performance 60
    expect(known.text).not.toMatch(/[0-9]/);
  });

  it('describeCreativeDemand is diegetic prose with no numbers', () => {
    expect(describeCreativeDemand(demand('x', 'Script'))).toMatch(/screenplay/i);
    expect(describeCreativeDemand(demand('x', 'Script'))).not.toMatch(/[0-9]/);
  });
});

describe('tension & walk-risk (Phase 2c)', () => {
  function persona(seed: number, ego: number, loyalty: number): Person {
    const base = baseDirector(seed);
    return { ...base, personality: { ...base.personality, ego, loyalty } };
  }

  it('a loyal director you have a history with tolerates far more "no" than a proud stranger', () => {
    const proudStranger = persona(20, 100, 0);
    const loyalPartner = persona(21, 30, 100);
    expect(directorPatience(loyalPartner, rel(3))).toBeGreaterThan(directorPatience(proudStranger, rel(0)));
  });

  it('a proud stranger walks after a single strong refusal; a loyal partner does not', () => {
    const strongRefused = [demand('r', 'Script', { strength: 0.95, resolution: 'refused' })];
    expect(directorWouldWalk(strongRefused, persona(22, 100, 0), rel(0))).toBe(true);
    expect(directorWouldWalk(strongRefused, persona(23, 25, 100), rel(3))).toBe(false);
  });

  it('only refused demands build tension - accepted and pending contribute nothing', () => {
    const dir = persona(24, 60, 40);
    const mixed = [
      demand('a', 'Script', { strength: 0.8, resolution: 'refused' }),
      demand('b', 'Edit', { strength: 0.8, resolution: 'accepted', qualityDelta: 5 }),
      demand('c', 'Score', { strength: 0.8 }),
    ];
    const onlyRefused = [demand('a', 'Script', { strength: 0.8, resolution: 'refused' })];
    expect(refusalTension(mixed, dir)).toBeCloseTo(refusalTension(onlyRefused, dir));
  });

  it('the patience read escalates content -> on-the-brink as refusals mount', () => {
    const dir = persona(25, 90, 0); // low patience
    expect(describeDirectorPatience([], dir, rel(0)).band).toBe('content');
    const overruled = [
      demand('a', 'Script', { strength: 0.9, resolution: 'refused' }),
      demand('b', 'Cinematography', { strength: 0.9, resolution: 'refused' }),
    ];
    expect(describeDirectorPatience(overruled, dir, rel(0)).band).toBe('on-the-brink');
    expect(describeDirectorPatience(overruled, dir, rel(0)).text).not.toMatch(/[0-9]/);
  });
});
