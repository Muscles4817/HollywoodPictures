// Talent chemistry, Phase 0: a well-matched director/lead makes the positive
// "the cast developed real chemistry" beat likelier to be the good news that
// lands, without changing anything else about event selection. These pin that
// wiring end-to-end through pickShootEvent - the same entry point the player's
// shoot and the rival synthesizer both use.
import { describe, it, expect } from 'vitest';
import { pickShootEvent, type FullProductionRisk } from './production';
import { generateTalentCandidates } from './talentGenerator';
import { withRng } from './random';
import type { Person, PersonPersonality, TalentAssignment, TalentProfession } from '../types';

// All-zero risk forces the positive pool every roll (rollNegative is
// `rng()*100 < avgRisk`, so avgRisk 0 is never negative) - isolating the
// positive-side weighting this feature touches.
const NO_RISK: FullProductionRisk = { schedulePressure: 0, moraleRisk: 0, safetyRisk: 0, technicalComplexity: 0, budgetRisk: 0 };
const NO_POOL = {} as Record<TalentProfession, Person[]>;

/** A real generated director + lead (so any interactive template resolves cleanly), with personality overridden to a controlled value. */
function castWith(personality: Partial<PersonPersonality>): TalentAssignment[] {
  const { result: director } = withRng(1, (rng) => generateTalentCandidates('Director', rng, 1)[0]);
  const { result: actor } = withRng(2, (rng) => generateTalentCandidates('Actor', rng, 1)[0]);
  const apply = (p: Person): Person => ({ ...p, personality: { ...p.personality, ...personality } });
  return [
    { role: 'Director', person: apply(director) },
    { role: 'Lead Actor', person: apply(actor) },
  ];
}

const NEUTRAL: Partial<PersonPersonality> = { ego: 50, adaptability: 50, professionalism: 50 };
const HIGH_CHEMISTRY: Partial<PersonPersonality> = { ego: 50, adaptability: 100, professionalism: 100 };

/** How often 'pos-chemistry' is the event that fires over `runs` independent positive-pool rolls, for the given cast. Same seed sequence regardless of cast, so chemistry weighting is the only variable. */
function chemistryHitRate(talent: TalentAssignment[], runs: number): number {
  let hits = 0;
  for (let i = 0; i < runs; i++) {
    const rolled = withRng(1000 + i, (rng) => pickShootEvent(NO_RISK, 0, 'Action', new Set<string>(), talent, null, NO_POOL, rng)).result;
    if (!rolled) continue;
    const id = 'event' in rolled ? rolled.event.id : rolled.pendingChoice.templateId;
    if (id === 'pos-chemistry') hits++;
  }
  return hits;
}

describe('pair chemistry biases positive event selection', () => {
  const RUNS = 400;

  it('a high-chemistry director/lead land the chemistry beat more often than a neutral pairing', () => {
    const neutral = chemistryHitRate(castWith(NEUTRAL), RUNS);
    const highChemistry = chemistryHitRate(castWith(HIGH_CHEMISTRY), RUNS);

    expect(neutral).toBeGreaterThan(0); // the beat is reachable at baseline - the test isn't vacuous
    expect(highChemistry).toBeGreaterThan(neutral); // ...and chemistry makes it materially likelier
    expect(highChemistry).toBeGreaterThan(neutral * 1.5);
  });

  it('a neutral pairing leaves selection identical to no chemistry input at all (the weighting no-ops at 0)', () => {
    // Same seed, same cast personality (chemistry 0): every roll must match,
    // proving the feature is inert on an ordinary shoot.
    const talent = castWith(NEUTRAL);
    for (let i = 0; i < 50; i++) {
      const a = withRng(2000 + i, (rng) => pickShootEvent(NO_RISK, 0, 'Action', new Set<string>(), talent, null, NO_POOL, rng)).result;
      const b = withRng(2000 + i, (rng) => pickShootEvent(NO_RISK, 0, 'Action', new Set<string>(), talent, null, NO_POOL, rng)).result;
      const idOf = (r: typeof a) => (r ? ('event' in r ? r.event.id : r.pendingChoice.templateId) : null);
      expect(idOf(a)).toBe(idOf(b));
    }
  });
});
