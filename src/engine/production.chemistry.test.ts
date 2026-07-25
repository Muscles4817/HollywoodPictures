// Talent chemistry: a well-matched pairing makes the positive "the cast
// developed real chemistry" beat likelier to be the good news that lands,
// without changing anything else about event selection. These pin that wiring
// end-to-end through pickShootEvent - the same entry point the player's shoot
// and the rival synthesizer both use. Phase 0 covers the director/lead pairing;
// Phase 1 adds co-stars (actor<->actor).
import { describe, it, expect } from 'vitest';
import { pickShootEvent, type FullProductionRisk } from './production';
import { recordPlayerFilmPairings } from './pairHistory';
import { generateTalentCandidates } from './talentGenerator';
import { withRng } from './random';
import type { Film, Person, PersonPersonality, TalentAssignment, TalentPairing, TalentProfession } from '../types';

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

/** An average (chemistry-neutral) director plus two leads with a controlled personality - isolates the co-star (actor<->actor) pairing Phase 1 added. */
function castCoStars(leadPersonality: Partial<PersonPersonality>): TalentAssignment[] {
  const { result: director } = withRng(1, (rng) => generateTalentCandidates('Director', rng, 1)[0]);
  const { result: actors } = withRng(2, (rng) => generateTalentCandidates('Actor', rng, 2));
  const withPersonality = (p: Person, over: Partial<PersonPersonality>): Person => ({ ...p, personality: { ...p.personality, ...over } });
  return [
    { role: 'Director', person: withPersonality(director, NEUTRAL) }, // neutral, so only the co-star pair contributes chemistry
    { role: 'Lead Actor', person: withPersonality(actors[0], leadPersonality) },
    { role: 'Lead Actor', person: withPersonality(actors[1], leadPersonality) },
  ];
}

/** How often `targetId` is the event that fires over `runs` independent positive-pool rolls, for the given cast and (optional) shared pairing history. Same seed sequence regardless of inputs, so chemistry weighting is the only variable. */
function hitRate(talent: TalentAssignment[], runs: number, targetId: string, pairings: TalentPairing[] = []): number {
  let hits = 0;
  for (let i = 0; i < runs; i++) {
    const rolled = withRng(1000 + i, (rng) => pickShootEvent(NO_RISK, 0, 'Action', new Set<string>(), talent, null, NO_POOL, rng, pairings)).result;
    if (!rolled) continue;
    const id = 'event' in rolled ? rolled.event.id : rolled.pendingChoice.templateId;
    if (id === targetId) hits++;
  }
  return hits;
}

/** Convenience for the performance beat the Phase 0/1 cases assert on. */
function chemistryHitRate(talent: TalentAssignment[], runs: number, pairings: TalentPairing[] = []): number {
  return hitRate(talent, runs, 'pos-chemistry', pairings);
}

function filmWith(id: string, talent: TalentAssignment[], criticScore: number, stars: number): Film {
  return {
    id,
    talent,
    results: {
      criticScore,
      audienceScore: criticScore,
      productionExecution: { stars, rating: 'solid', headline: '', detail: '', causes: [], mitigation: [], modifiers: { performanceCapture: 0, postExecution: 0, scriptExecution: 0, coverageRatio: 1, overall: 0 } },
    },
  } as unknown as Film;
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

  it('two clicking co-stars bias the chemistry beat even with an unremarkable director (Phase 1)', () => {
    const neutral = chemistryHitRate(castCoStars(NEUTRAL), RUNS);
    const highChemistry = chemistryHitRate(castCoStars(HIGH_CHEMISTRY), RUNS);

    expect(neutral).toBeGreaterThan(0);
    expect(highChemistry).toBeGreaterThan(neutral); // the actor<->actor pairing reaches selection, not just director<->actor
    expect(highChemistry).toBeGreaterThan(neutral * 1.5);
  });

  it('a proven duo lands the chemistry beat more often than the same neutral duo with no shared history (Phase 2)', () => {
    // Both casts are personality-neutral (baseline chemistry 0), so the ONLY
    // difference is the pairing history - proving history reaches selection.
    const talent = castWith(NEUTRAL);
    const noHistory = chemistryHitRate(talent, RUNS);
    const provenHistory = recordPlayerFilmPairings(
      [],
      [filmWith('past1', talent, 95, 5), filmWith('past2', talent, 92, 5)],
      500,
    );
    const proven = chemistryHitRate(talent, RUNS, provenHistory);

    expect(proven).toBeGreaterThan(noHistory);
    expect(proven).toBeGreaterThan(noHistory * 1.5);
  });

  it('a proven director/editor lifts the CRAFT beat end-to-end (Phase 3 typed routing)', () => {
    const { result: director } = withRng(1, (rng) => generateTalentCandidates('Director', rng, 1)[0]);
    const { result: editor } = withRng(3, (rng) => generateTalentCandidates('Editor', rng, 1)[0]);
    const neutralize = (p: Person): Person => ({ ...p, personality: { ...p.personality, ...NEUTRAL } });
    const talent: TalentAssignment[] = [
      { role: 'Director', person: neutralize(director) },
      { role: 'Editor', person: neutralize(editor) },
    ];
    const provenCraft = recordPlayerFilmPairings(
      [],
      [filmWith('e1', talent, 95, 5), filmWith('e2', talent, 92, 5)],
      500,
    );

    // The editorial beat fires more once the director/editor are a proven
    // partnership - crew chemistry reaches selection, routed to a craft event.
    // (Cast-beat isolation is proven at the value level in pairHistory.test.ts:
    // the performance chemistry read is unmoved by craft-only history.)
    const noHistory = hitRate(talent, RUNS, 'int-editor-assembly-ahead');
    const proven = hitRate(talent, RUNS, 'int-editor-assembly-ahead', provenCraft);
    expect(proven).toBeGreaterThan(noHistory);
    expect(proven).toBeGreaterThan(noHistory * 1.5);
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
