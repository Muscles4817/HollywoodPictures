// Acting Model (docs/DESIGN_REVIEW_acting_model.md §13) - the floor+headroom
// unlock. An actor delivers a reliable floor self-directed; a well-aimed,
// hands-on director unlocks headroom on top; a mis-aimed hands-on director
// drags below floor; a hands-off director leaves the actor near their floor
// regardless of match. Craft is decoupled from fame, role-fit gates the
// headroom in full, and the two actor archetypes' curves cross.
import { describe, it, expect } from 'vitest';
import {
  actorCraft,
  deriveCraftFromStyle,
  deriveHandsOnFromUnit,
  directorHandsOn,
  computeRealizedPerformance,
  actorArchetype,
  directorTouch,
  directorActorPairing,
} from './actingModel';
import { deriveToneFromActingStyle } from './compatibility';
import type { ActingStyle, Person, ToneProfile } from '../types';

// --- builders --------------------------------------------------------------

function actor(id: string, actingStyle: ActingStyle, over: { fame?: number; craftFloor?: number; craftHeadroom?: number } = {}): Person {
  return {
    id,
    identity: { name: id, appearanceTags: [] },
    personality: { professionalism: 50, ambition: 50, loyalty: 50, ego: 50, temperament: 50, pressureHandling: 50, controversy: 50, adaptability: 50 },
    reputation: { fame: over.fame ?? 50, prestige: 50, industryRespect: 50, reliability: 50, currentHeat: 50 },
    availability: { commitments: [] },
    traits: [],
    primaryRole: 'Actor',
    careers: {
      actor: { role: 'Actor', active: true, experience: 50, roleReputation: 50, minimumSalary: 100_000, typicalSalary: 100_000, actingStyle, craftFloor: over.craftFloor, craftHeadroom: over.craftHeadroom },
    },
  };
}

function director(id: string, opts: { toneProfile: ToneProfile; skill: number; handsOn: number }): Person {
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
        role: 'Director', active: true, experience: opts.skill, roleReputation: 50, minimumSalary: 100_000, typicalSalary: 100_000,
        skill: opts.skill,
        toneProfile: opts.toneProfile,
        productionStyle: { environmentStrategy: { studio: 1, location: 0, digital: 0 }, effectsStrategy: { practical: 1, digital: 0 } },
        handsOn: opts.handsOn,
      },
    },
  };
}

/** A director whose ToneProfile *is* the actor's derived tone - a perfect aim (+1). */
function matchedDirector(actorStyle: ActingStyle, opts: { skill: number; handsOn: number }): Person {
  return director('matched-dir', { toneProfile: deriveToneFromActingStyle(actorStyle), skill: opts.skill, handsOn: opts.handsOn });
}

/**
 * A director who pours all their tonal weight onto exactly the tone the actor
 * is WEAKEST at - a confident wrong read. computeCompatibility is a weighted
 * average of per-tone gaps (weighted by the director's own profile), so
 * concentrating on the actor's worst tone is what actually drives aim negative.
 */
function mismatchedDirector(actorStyle: ActingStyle, opts: { skill: number; handsOn: number }): Person {
  const actorTone = deriveToneFromActingStyle(actorStyle);
  const tones = Object.keys(actorTone) as Array<keyof ToneProfile>;
  const weakest = tones.reduce((w, t) => (actorTone[t] < actorTone[w] ? t : w), tones[0]);
  const profile = {} as ToneProfile;
  for (const t of tones) profile[t] = t === weakest ? 100 : 0;
  return director('mismatched-dir', { toneProfile: profile, skill: opts.skill, handsOn: opts.handsOn });
}

// A dependable pro: well-rounded, high - high floor, little headroom.
const PRO_STYLE: ActingStyle = { characterTransformation: 74, emotionalPerformance: 74, charisma: 74, comedy: 72, physicalPerformance: 72 };
// An auteur-magnet: one towering strength over a modest base - lower floor,
// large headroom (a director-dependent talent).
const MAGNET_STYLE: ActingStyle = { characterTransformation: 92, emotionalPerformance: 30, charisma: 30, comedy: 26, physicalPerformance: 28 };

const FULL_FIT = 100;

describe('deriveCraftFromStyle - floor from ability, headroom from spikiness', () => {
  it('a well-rounded actor is high-floor / low-headroom (a dependable pro)', () => {
    const pro = deriveCraftFromStyle(PRO_STYLE);
    expect(pro.floor).toBeGreaterThan(60);
    expect(pro.headroom).toBeLessThan(15);
  });

  it('a one-note specialist is lower-floor / high-headroom (a director-dependent magnet)', () => {
    const magnet = deriveCraftFromStyle(MAGNET_STYLE);
    const pro = deriveCraftFromStyle(PRO_STYLE);
    expect(magnet.headroom).toBeGreaterThan(pro.headroom + 15);
    expect(magnet.floor).toBeLessThan(pro.floor);
  });

  it("the magnet's ceiling (floor+headroom) clears the pro's - headroom genuinely adds top-end", () => {
    const magnet = deriveCraftFromStyle(MAGNET_STYLE);
    const pro = deriveCraftFromStyle(PRO_STYLE);
    expect(magnet.floor + magnet.headroom).toBeGreaterThan(pro.floor + pro.headroom);
  });
});

describe('computeRealizedPerformance - the unlock', () => {
  it('delivers ~the floor under neutral (no) direction', () => {
    const { floor } = actorCraft(actor('a', PRO_STYLE));
    const realized = computeRealizedPerformance(actor('a', PRO_STYLE), undefined, FULL_FIT);
    expect(realized).toBeCloseTo(floor, 0);
  });

  it('a great matched hands-on director unlocks headroom (a career-best, well above floor)', () => {
    const a = actor('magnet', MAGNET_STYLE);
    const { floor } = actorCraft(a);
    const dir = matchedDirector(MAGNET_STYLE, { skill: 95, handsOn: 0.95 });
    const realized = computeRealizedPerformance(a, dir, FULL_FIT);
    expect(realized).toBeGreaterThan(floor + 8);
  });

  it('a mis-aimed hands-on director drags the performance below its floor', () => {
    const a = actor('magnet', MAGNET_STYLE);
    const { floor } = actorCraft(a);
    const dir = mismatchedDirector(MAGNET_STYLE, { skill: 95, handsOn: 0.95 });
    const realized = computeRealizedPerformance(a, dir, FULL_FIT);
    expect(realized).toBeLessThan(floor);
  });

  it('a hands-off director leaves the actor near floor regardless of match', () => {
    const a = actor('magnet', MAGNET_STYLE); // headroom ~45, the hardest case for "near floor"
    const { floor } = actorCraft(a);
    const good = matchedDirector(MAGNET_STYLE, { skill: 90, handsOn: 0.02 });
    const bad = mismatchedDirector(MAGNET_STYLE, { skill: 90, handsOn: 0.02 });
    // Low push -> only a little unlock either way, small next to the 45 of
    // headroom a hands-on director could reach.
    expect(Math.abs(computeRealizedPerformance(a, good, FULL_FIT) - floor)).toBeLessThan(7);
    expect(Math.abs(computeRealizedPerformance(a, bad, FULL_FIT) - floor)).toBeLessThan(7);
  });

  it('a low-headroom pro barely moves even under a great matched director', () => {
    const a = actor('pro', PRO_STYLE);
    const { floor } = actorCraft(a);
    const dir = matchedDirector(PRO_STYLE, { skill: 95, handsOn: 0.95 });
    expect(computeRealizedPerformance(a, dir, FULL_FIT)).toBeLessThan(floor + 8);
  });
});

describe('fame != craft', () => {
  it('two actors with identical style but wildly different fame deliver the identical performance', () => {
    const unknown = actor('unknown', MAGNET_STYLE, { fame: 3 });
    const superstar = actor('superstar', MAGNET_STYLE, { fame: 99 });
    const dir = matchedDirector(MAGNET_STYLE, { skill: 80, handsOn: 0.7 });
    expect(computeRealizedPerformance(unknown, dir, FULL_FIT)).toBe(computeRealizedPerformance(superstar, dir, FULL_FIT));
  });
});

describe('role-fit gates the headroom', () => {
  it('a brilliant high-headroom actor badly miscast cannot be unlocked (no career-best in the wrong role)', () => {
    const a = actor('magnet', MAGNET_STYLE);
    const dir = matchedDirector(MAGNET_STYLE, { skill: 95, handsOn: 0.95 });
    const wellCast = computeRealizedPerformance(a, dir, FULL_FIT);
    const miscast = computeRealizedPerformance(a, dir, 10);
    // Full fit lets the director unlock the headroom; near-zero fit both gates
    // the headroom away and drops the floor, so the miscast turn is far weaker.
    expect(miscast).toBeLessThan(wellCast - 15);
  });
});

describe('the archetype curves cross', () => {
  it('the pro out-delivers the magnet self-directed, but the magnet wins under a great matched director', () => {
    const pro = actor('pro', PRO_STYLE);
    const magnet = actor('magnet', MAGNET_STYLE);

    // Self-directed (no director): the dependable pro wins.
    const proSolo = computeRealizedPerformance(pro, undefined, FULL_FIT);
    const magnetSolo = computeRealizedPerformance(magnet, undefined, FULL_FIT);
    expect(proSolo).toBeGreaterThan(magnetSolo);

    // Each with their own ideal hands-on director: the magnet's ceiling wins.
    const proDirected = computeRealizedPerformance(pro, matchedDirector(PRO_STYLE, { skill: 95, handsOn: 0.95 }), FULL_FIT);
    const magnetDirected = computeRealizedPerformance(magnet, matchedDirector(MAGNET_STYLE, { skill: 95, handsOn: 0.95 }), FULL_FIT);
    expect(magnetDirected).toBeGreaterThan(proDirected);
  });
});

describe('qualitative reads (engine categories; presentation owns the prose)', () => {
  it('classifies a high-floor / low-headroom actor as dependable, a high-headroom actor as director-dependent', () => {
    const pro = actor('pro', PRO_STYLE, { craftFloor: 72, craftHeadroom: 8 });
    const magnet = actor('magnet', MAGNET_STYLE, { craftFloor: 55, craftHeadroom: 40 });
    expect(actorArchetype(pro)).toBe('dependable');
    expect(actorArchetype(magnet)).toBe('director-dependent');
  });

  it('bands a director by hands-on-ness', () => {
    const handsOn = director('a', { toneProfile: deriveToneFromActingStyle(PRO_STYLE), skill: 50, handsOn: 0.85 });
    const handsOff = director('b', { toneProfile: deriveToneFromActingStyle(PRO_STYLE), skill: 50, handsOn: 0.15 });
    const balanced = director('c', { toneProfile: deriveToneFromActingStyle(PRO_STYLE), skill: 50, handsOn: 0.5 });
    expect(directorTouch(handsOn)).toBe('hands-on');
    expect(directorTouch(handsOff)).toBe('hands-off');
    expect(directorTouch(balanced)).toBe('balanced');
  });

  it('reads a matched pairing as strong and a confidently-mismatched one as risky', () => {
    const a = actor('magnet', MAGNET_STYLE);
    expect(directorActorPairing(matchedDirector(MAGNET_STYLE, { skill: 80, handsOn: 0.8 }), a)).toBe('strong');
    expect(directorActorPairing(mismatchedDirector(MAGNET_STYLE, { skill: 80, handsOn: 0.8 }), a)).toBe('risky');
  });
});

describe('directorHandsOn / deriveHandsOnFromUnit', () => {
  it('deriveHandsOnFromUnit maps [0,1) into a below-neutral-centred spread', () => {
    expect(deriveHandsOnFromUnit(0)).toBeCloseTo(0.25, 5);
    expect(deriveHandsOnFromUnit(1)).toBeCloseTo(0.85, 5);
  });

  it('an authored handsOn is used verbatim (clamped)', () => {
    const dir = director('d', { toneProfile: deriveToneFromActingStyle(PRO_STYLE), skill: 50, handsOn: 0.9 });
    expect(directorHandsOn(dir)).toBeCloseTo(0.9, 5);
  });

  it('an unauthored director reads a stable per-id default (deterministic, no rng)', () => {
    const bare = director('stable-id', { toneProfile: deriveToneFromActingStyle(PRO_STYLE), skill: 50, handsOn: 0.5 });
    delete bare.careers.director!.handsOn;
    expect(directorHandsOn(bare)).toBe(directorHandsOn(bare));
    expect(directorHandsOn(bare)).toBeGreaterThanOrEqual(0.25);
    expect(directorHandsOn(bare)).toBeLessThanOrEqual(0.85);
  });
});
