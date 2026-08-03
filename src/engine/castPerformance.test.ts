// Post-release per-actor performance surfacing (engine/castPerformance.ts +
// castPerformancePresentation.ts). The engine already computes each cast
// member's realised performance to score a film; these read it back out as a
// qualitative band + named cause, and the presentation turns that into prose.
import { describe, it, expect } from 'vitest';
import { readCastMemberPerformance, readCastPerformances, explainCastPerformances } from './castPerformance';
import { computeRealizedPerformance } from './actingModel';
import type { CastMemberPerformance } from './scoring';
import { deriveToneFromActingStyle } from './compatibility';
import { describeCastPerformance, castBandLabel, castPerformanceMarker } from './castPerformancePresentation';
import type { ActingStyle, Person, ToneProfile } from '../types';

// --- builders (mirrors engine/actingModel.test.ts) --------------------------

function actor(id: string, actingStyle: ActingStyle, over: { craftFloor?: number; craftHeadroom?: number } = {}): Person {
  return {
    id,
    identity: { name: id, appearanceTags: [] },
    personality: { professionalism: 50, ambition: 50, loyalty: 50, ego: 50, temperament: 50, pressureHandling: 50, controversy: 50, adaptability: 50 },
    reputation: { fame: 50, prestige: 50, industryRespect: 50, reliability: 50, currentHeat: 50 },
    availability: { commitments: [] },
    traits: [],
    primaryRole: 'Actor',
    careers: {
      actor: { role: 'Actor', active: true, experience: 50, roleReputation: 50, minimumSalary: 100_000, typicalSalary: 100_000, actingStyle, craftFloor: over.craftFloor, craftHeadroom: over.craftHeadroom },
    },
  };
}

function director(id: string, toneProfile: ToneProfile): Person {
  return {
    id,
    identity: { name: id, appearanceTags: [] },
    personality: { professionalism: 50, ambition: 50, loyalty: 50, ego: 50, temperament: 50, pressureHandling: 50, controversy: 50, adaptability: 50 },
    reputation: { fame: 50, prestige: 50, industryRespect: 50, reliability: 50, currentHeat: 50 },
    availability: { commitments: [] },
    traits: [],
    primaryRole: 'Director',
    careers: {
      director: {
        role: 'Director', active: true, experience: 60, roleReputation: 50, minimumSalary: 100_000, typicalSalary: 100_000,
        skill: 60, toneProfile,
        productionStyle: { environmentStrategy: { studio: 1, location: 0, digital: 0 }, effectsStrategy: { practical: 1, digital: 0 } },
        handsOn: 0.8,
      },
    },
  };
}

/** A director whose ToneProfile *is* the actor's derived tone - a strong pairing. */
function matchedDirector(style: ActingStyle): Person {
  return director('matched', deriveToneFromActingStyle(style));
}

/** A director pouring all tonal weight on the actor's WEAKEST tone - a risky pairing. */
function mismatchedDirector(style: ActingStyle): Person {
  const tone = deriveToneFromActingStyle(style);
  const tones = Object.keys(tone) as Array<keyof ToneProfile>;
  const weakest = tones.reduce((w, t) => (tone[t] < tone[w] ? t : w), tones[0]);
  const profile = {} as ToneProfile;
  for (const t of tones) profile[t] = t === weakest ? 100 : 0;
  return director('mismatched', profile);
}

const GIFTED: ActingStyle = { characterTransformation: 40, emotionalPerformance: 40, charisma: 85, comedy: 40, physicalPerformance: 40 };
const ROUNDED: ActingStyle = { characterTransformation: 50, emotionalPerformance: 50, charisma: 50, comedy: 50, physicalPerformance: 50 };
// A one-note style whose derived tone has a genuinely weak axis, so a director
// concentrated there produces a clearly risky pairing (charisma-led styles
// spread across every tone and can't be strongly mismatched).
const SPIKY: ActingStyle = { characterTransformation: 15, emotionalPerformance: 15, charisma: 15, comedy: 95, physicalPerformance: 15 };

function member(person: Person, roleFit: number, performance: number, role: 'Lead Actor' | 'Supporting Actor' = 'Lead Actor'): CastMemberPerformance {
  return { assignment: { role, person }, role, roleFit, performance };
}

// --- banding ---------------------------------------------------------------

describe('performance banding', () => {
  it('bands the realised performance into good / neutral / bad tones', () => {
    const p = actor('a', ROUNDED);
    expect(readCastMemberPerformance(member(p, 70, 88), undefined).band).toBe('inspired');
    expect(readCastMemberPerformance(member(p, 70, 70), undefined).band).toBe('strong');
    expect(readCastMemberPerformance(member(p, 70, 58), undefined).band).toBe('solid');
    expect(readCastMemberPerformance(member(p, 70, 44), undefined).band).toBe('weak');
    expect(readCastMemberPerformance(member(p, 70, 30), undefined).band).toBe('poor');
  });

  it('maps bands to the three-way good/neutral/bad tone the card colours by', () => {
    const p = actor('a', ROUNDED);
    expect(readCastMemberPerformance(member(p, 70, 88), undefined).tone).toBe('good');
    expect(readCastMemberPerformance(member(p, 70, 58), undefined).tone).toBe('neutral');
    expect(readCastMemberPerformance(member(p, 70, 30), undefined).tone).toBe('bad');
  });
});

// --- named cause -----------------------------------------------------------

describe('named cause', () => {
  it('a standout on a strong fit with a signature gift reads as gift-realized, naming the axis', () => {
    const read = readCastMemberPerformance(member(actor('a', GIFTED), 80, 85), undefined);
    expect(read.cause).toBe('gift-realized');
    expect(read.giftAxis).toBe('charisma');
  });

  it('a standout the director pulled out (strong pairing, no towering gift) reads as director-unlocked', () => {
    const p = actor('a', ROUNDED);
    const read = readCastMemberPerformance(member(p, 55, 85), matchedDirector(ROUNDED));
    expect(read.cause).toBe('director-unlocked');
  });

  it('a good turn from a natural fit with no standout gift reads as well-fitted', () => {
    const read = readCastMemberPerformance(member(actor('a', ROUNDED), 80, 70), undefined);
    expect(read.cause).toBe('well-fitted');
  });

  it('a poor performance on a poor fit reads as miscast', () => {
    const read = readCastMemberPerformance(member(actor('a', GIFTED), 40, 32), undefined);
    expect(read.cause).toBe('miscast');
  });

  it('a director-dependent talent left under-directed on a middling turn reads as director-flat', () => {
    // craftFloor + craftHeadroom both set -> archetype reads from them; headroom
    // >= 25 makes the actor director-dependent. No director -> neutral pairing.
    const magnet = actor('a', ROUNDED, { craftFloor: 50, craftHeadroom: 30 });
    const read = readCastMemberPerformance(member(magnet, 60, 58), undefined);
    expect(read.cause).toBe('director-flat');
  });

  it('a mismatched director dragging a dependable actor down reads as director-misfire', () => {
    const p = actor('a', SPIKY, { craftFloor: 65, craftHeadroom: 8 }); // dependable, not director-dependent
    const read = readCastMemberPerformance(member(p, 60, 45), mismatchedDirector(SPIKY));
    expect(read.cause).toBe('director-misfire');
  });

  it('a weak turn from a fine fit and no other signal reads as limited (out of their depth)', () => {
    const p = actor('a', ROUNDED, { craftFloor: 65, craftHeadroom: 8 });
    const read = readCastMemberPerformance(member(p, 60, 45), undefined);
    expect(read.cause).toBe('limited');
  });
});

// --- determinism -----------------------------------------------------------

describe('determinism', () => {
  it('is a pure, stable read - identical inputs give identical output (no RNG at render time)', () => {
    const m = member(actor('steady-id', GIFTED), 80, 85);
    const first = readCastMemberPerformance(m, undefined);
    const second = readCastMemberPerformance(m, undefined);
    expect(first).toEqual(second);
    expect(describeCastPerformance(first)).toBe(describeCastPerformance(second));
  });
});

// --- presentation ----------------------------------------------------------

describe('presentation', () => {
  it('names the actor and their gift when a standout turned on that strength', () => {
    const read = readCastMemberPerformance(member(actor('Rex Vaughn', GIFTED), 80, 85), undefined);
    const sentence = describeCastPerformance(read);
    expect(sentence).toContain('Rex Vaughn');
    expect(sentence).toContain('screen presence'); // the charisma gift noun
  });

  it('calls out the wasted gift when a gifted actor is miscast', () => {
    const read = readCastMemberPerformance(member(actor('Rex Vaughn', GIFTED), 40, 32), undefined);
    const sentence = describeCastPerformance(read);
    expect(read.cause).toBe('miscast');
    expect(sentence).toMatch(/waste|never got the chance/);
  });

  it('never leaks a {placeholder} into the prose for any cause', () => {
    const styles = [GIFTED, ROUNDED];
    for (const style of styles) {
      for (const perf of [85, 70, 58, 45, 30]) {
        for (const fit of [80, 60, 40]) {
          const s = describeCastPerformance(readCastMemberPerformance(member(actor('x', style), fit, perf), undefined));
          expect(s).not.toMatch(/[{}]/);
          expect(s.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('exposes a chip label and a tone marker for every band', () => {
    expect(castBandLabel('inspired')).toBe('Inspired casting');
    expect(castBandLabel('poor')).toBe('Miscast');
    expect(castPerformanceMarker('good')).toBe('▲');
    expect(castPerformanceMarker('bad')).toBe('▼');
    expect(castPerformanceMarker('neutral')).toBe('■');
  });
});

// --- integration: one read per actor, leads first, crew excluded -----------

describe('readCastPerformances (whole cast)', () => {
  it('returns exactly one read per acting assignment, leads before supporting, and none for the director', () => {
    const lead = actor('lead', ROUNDED);
    const supp = actor('supp', ROUNDED);
    const dir = director('dir', deriveToneFromActingStyle(ROUNDED));
    const script = {
      // Minimal script shape actorFitScore/computeTalentCompatibility tolerate:
      // a real generated script is used in scoring.test.ts, but here we only
      // assert the shape/ordering of the reads, which doesn't depend on tone.
      toneProfile: deriveToneFromActingStyle(ROUNDED),
      requiredLeads: 1,
      requiredSupporting: 1,
      cast: [],
    } as never;
    const talent = [
      { role: 'Director' as const, person: dir },
      { role: 'Supporting Actor' as const, person: supp },
      { role: 'Lead Actor' as const, person: lead },
    ];
    const reads = readCastPerformances(talent, script);
    expect(reads.map((r) => r.personId)).toEqual(['lead', 'supp']);
    expect(reads.every((r) => r.role === 'Lead Actor' || r.role === 'Supporting Actor')).toBe(true);
  });
});

// --- dev decomposition ------------------------------------------------------

describe('explainCastPerformances (dev-only raw breakdown)', () => {
  const lead = actor('lead', ROUNDED);
  const dir = director('dir', deriveToneFromActingStyle(ROUNDED));
  const script = { toneProfile: deriveToneFromActingStyle(ROUNDED), requiredLeads: 1, requiredSupporting: 0, cast: [] } as never;
  const talent = [
    { role: 'Director' as const, person: dir },
    { role: 'Lead Actor' as const, person: lead },
  ];

  it('is internally consistent: performance = effFloor + unlock, and matches computeRealizedPerformance', () => {
    const [detail] = explainCastPerformances(talent, script);
    const b = detail.breakdown;
    expect(b.effFloor + b.unlock).toBeCloseTo(b.performance, 6);
    // The exposed decomposition must equal the number that actually scores the film.
    expect(b.performance).toBeCloseTo(computeRealizedPerformance(lead, dir, detail.roleFit), 6);
  });

  it('carries the same band + cause the player-facing read shows (dev and player never disagree)', () => {
    const [detail] = explainCastPerformances(talent, script);
    const [read] = readCastPerformances(talent, script);
    expect(detail.read).toEqual(read);
  });

  it('exposes fit gating, the director push, and the actor archetype', () => {
    const [detail] = explainCastPerformances(talent, script);
    const b = detail.breakdown;
    expect(b.fit).toBeCloseTo(detail.roleFit / 100, 6);
    expect(b.availHeadroom).toBeCloseTo(b.headroom * b.fit, 6); // headroom fully gated by fit
    expect(b.push).toBeGreaterThan(0);
    expect(['dependable', 'director-dependent', 'all-rounder']).toContain(detail.archetype);
  });
});
