import { describe, it, expect } from 'vitest';
import {
  establishRivalFranchises,
  growRivalFranchises,
  chooseRivalFranchiseToSequelize,
  RIVAL_MAX_FRANCHISES_PER_STUDIO,
} from './rivalFranchise';
import { promoteFilmToIp } from './intellectualProperty';
import { generateScriptOptions } from './scriptGenerator';
import { createRng } from './random';
import type { Film, IntellectualProperty, RivalStudio, Script, StudioTier } from '../types';

function scriptFor(seed: number): Script {
  return generateScriptOptions('Action', createRng(seed), 1)[0];
}

// A finished rival film. `hit` toggles the reception between a franchise-worthy
// hit (well above the establish threshold) and an ordinary release (well below).
function rivalFilm(id: string, studioName: string, hit: boolean, extra: Partial<Film> = {}): Film {
  const reach = hit ? 320_000_000 : 6_000_000;
  const score = hit ? 84 : 42;
  return {
    id,
    title: `The ${id}`,
    script: scriptFor(id.length + (hit ? 1 : 2)),
    releasedBy: studioName,
    releasedOnDay: 200,
    results: { audienceScore: score, criticScore: 60, buzzScore: score, qualityScore: 60, profit: 0, totalCost: 0, totalBoxOffice: reach, openingWeekend: reach / 3 },
    boxOfficeRun: { status: 'finished', cumulativeGross: reach },
    ...extra,
  } as unknown as Film;
}

function rival(name: string, tier: StudioTier = 'Major', franchises?: IntellectualProperty[]): RivalStudio {
  return { id: `r-${name}`, name, tier, nextSpawnCheckDay: 1, cash: 500_000_000, brand: 60, prestige: 50, lifetimeRevenue: 0, lifetimeExpenditure: 0, franchises };
}

describe('establishRivalFranchises', () => {
  it('turns a rival hit into a franchise, seeded from that film', () => {
    const rivals = [rival('Apex')];
    const film = rivalFilm('apex-hit', 'Apex', true);
    const [after] = establishRivalFranchises(rivals, [film], 300);
    expect(after.franchises).toHaveLength(1);
    const fr = after.franchises![0];
    expect(fr.sourceFilmId).toBe('apex-hit');
    expect(fr.filmIds).toEqual(['apex-hit']);
    expect(fr.genre).toBe('Action'); // the franchise's home genre, for sequel generation
    expect(fr.characters.length).toBeGreaterThan(0);
  });

  it('ignores an ordinary release - only genuine hits become franchises', () => {
    const rivals = [rival('Apex')];
    expect(establishRivalFranchises(rivals, [rivalFilm('flop', 'Apex', false)], 300)).toBe(rivals);
  });

  it('is idempotent - a film already a franchise source is never re-established', () => {
    let rivals = [rival('Apex')];
    const film = rivalFilm('apex-hit', 'Apex', true);
    rivals = establishRivalFranchises(rivals, [film], 300);
    const again = establishRivalFranchises(rivals, [film], 301);
    expect(again).toBe(rivals);
    expect(again[0].franchises).toHaveLength(1);
  });

  it('never exceeds the per-studio franchise cap', () => {
    const rivals = [rival('Apex')];
    const hits = Array.from({ length: RIVAL_MAX_FRANCHISES_PER_STUDIO + 2 }, (_, i) => rivalFilm(`hit-${i}`, 'Apex', true));
    // One franchise established per pass; run enough passes to exceed the cap.
    let s = rivals;
    for (let i = 0; i < hits.length; i++) s = establishRivalFranchises(s, hits, 300 + i);
    expect(s[0].franchises!.length).toBe(RIVAL_MAX_FRANCHISES_PER_STUDIO);
  });

  it('never establishes a franchise from an existing franchise entry (a sequel)', () => {
    const rivals = [rival('Apex')];
    const sequelEntry = rivalFilm('apex-2', 'Apex', true, { franchiseId: 'ip-apex-hit' });
    expect(establishRivalFranchises(rivals, [sequelEntry], 300)).toBe(rivals);
  });

  it('only credits a hit to the studio that released it', () => {
    const rivals = [rival('Apex'), rival('Zenith')];
    const [apex, zenith] = establishRivalFranchises(rivals, [rivalFilm('apex-hit', 'Apex', true)], 300);
    expect(apex.franchises).toHaveLength(1);
    expect(zenith.franchises ?? []).toHaveLength(0);
  });
});

describe('growRivalFranchises', () => {
  function withFranchise(name: string): { rivals: RivalStudio[]; franchiseId: string; baseRecognition: number } {
    const source = rivalFilm('src', name, true);
    const fr = promoteFilmToIp(source, source.script.cast.map((c) => c.id), 'Saga', 100);
    return { rivals: [rival(name, 'Major', [fr])], franchiseId: fr.id, baseRecognition: fr.recognition };
  }

  it('folds a finished franchise entry into its franchise and grows recognition', () => {
    const { rivals, franchiseId, baseRecognition } = withFranchise('Apex');
    const entry = rivalFilm('apex-2', 'Apex', true, { franchiseId });
    const [after] = growRivalFranchises(rivals, [entry]);
    const fr = after.franchises![0];
    expect(fr.filmIds).toContain('apex-2');
    expect(fr.recognition).toBeGreaterThan(baseRecognition);
  });

  it('is idempotent and ignores running entries', () => {
    const { rivals, franchiseId } = withFranchise('Apex');
    const entry = rivalFilm('apex-2', 'Apex', true, { franchiseId });
    const once = growRivalFranchises(rivals, [entry]);
    expect(growRivalFranchises(once, [entry])).toBe(once); // idempotent

    const running = rivalFilm('apex-3', 'Apex', true, { franchiseId, boxOfficeRun: { status: 'running', cumulativeGross: 1 } as Film['boxOfficeRun'] });
    expect(growRivalFranchises(rivals, [running])).toBe(rivals); // not settled yet
  });
});

describe('chooseRivalFranchiseToSequelize', () => {
  it('returns null (and draws no rng) for a rival with no franchises', () => {
    expect(chooseRivalFranchiseToSequelize(rival('Apex'), createRng(1))).toBeNull();
  });

  it('a Major sequelises more often than an Indie over many rolls', () => {
    const source = rivalFilm('src', 'Apex', true);
    const fr = promoteFilmToIp(source, [], 'Saga', 100);
    const count = (tier: StudioTier) =>
      Array.from({ length: 200 }, (_, s) => chooseRivalFranchiseToSequelize(rival('Apex', tier, [fr]), createRng(s + 1))).filter(Boolean).length;
    expect(count('Major')).toBeGreaterThan(count('Indie'));
  });

  it('weights the pick toward the bigger franchise', () => {
    const big = { ...promoteFilmToIp(rivalFilm('big', 'Apex', true), [], 'Big', 1), id: 'fr-big', recognition: 95 };
    const small = { ...promoteFilmToIp(rivalFilm('small', 'Apex', true), [], 'Small', 1), id: 'fr-small', recognition: 20 };
    const picks = Array.from({ length: 200 }, (_, s) => chooseRivalFranchiseToSequelize(rival('Apex', 'Major', [big, small]), createRng(s + 1))).filter(Boolean);
    const bigPicks = picks.filter((p) => p!.id === 'fr-big').length;
    const smallPicks = picks.filter((p) => p!.id === 'fr-small').length;
    expect(bigPicks).toBeGreaterThan(smallPicks);
  });
});
