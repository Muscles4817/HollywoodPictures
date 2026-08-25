// Pins the rng discipline state/testFixtures.ts depends on. That file states the
// rationale in full at buildReadyDraft; the short version is that ~64 test files
// build from these fixtures, so anything the builders couple together they
// couple together for most of the suite - and a pure draw-count change inside
// script generation must not re-roll talent, the talent pool, or the state seed
// every later reducer roll runs on.
//
// Each test reconstructs the expected stream by hand from the same primitives
// the builders use, so reordering the draws inside a builder fails here rather
// than surfacing as unrelated red in the box office or execution suites.
import { describe, it, expect } from 'vitest';
import { buildReadyAsset, buildReadyDraft, buildStateWithReadyDraft } from './testFixtures';
import { generateTalentCandidates, generateTalentPool } from '../engine/talentGenerator';
import { createRng, forkRng, forkSeed } from '../engine/random';

// Compared on identity name rather than id throughout: Person ids come off a
// module-level counter, so they are not seed-derived and say nothing about which
// person was actually generated.
const names = (people: Array<{ identity: { name: string } }>) => people.map((p) => p.identity.name);

describe('buildReadyDraft', () => {
  it('is reproducible from its seed', () => {
    const a = buildReadyDraft(createRng(2024));
    const b = buildReadyDraft(createRng(2024));
    expect(names(b.talent.map((t) => t.person))).toEqual(names(a.talent.map((t) => t.person)));
    expect(b.script!.title).toBe(a.script!.title);
  });

  it('draws its talent from a stream forked before the script, so script generation can never move it', () => {
    const parent = createRng(99);
    const talentRng = forkRng(parent); // exactly what the builder does, and nothing else
    const expected = [
      generateTalentCandidates('Director', talentRng, 1)[0],
      generateTalentCandidates('Actor', talentRng, 1)[0],
      generateTalentCandidates('Actor', talentRng, 1)[0],
    ];

    const draft = buildReadyDraft(createRng(99));
    expect(names(draft.talent.map((t) => t.person))).toEqual(names(expected));
  });

  it("still draws its script from the caller's own stream", () => {
    const shared = createRng(7);
    forkRng(shared); // the talent fork the builder takes first
    const asset = buildReadyAsset(shared);
    expect(buildReadyDraft(createRng(7)).script!.title).toBe(asset.script.title);
  });
});

describe('buildStateWithReadyDraft', () => {
  // The larger half of the fixture surface - ~36 files enter through here, and
  // its rngSeed drives every later reducer roll (pre-production events, on-set
  // choices, the test screening, the box office). Both of the things that must
  // not move are taken before the script exists; these two tests are what keep
  // that ordering from being quietly undone.
  it('generates its talent pool before the script, so script generation cannot re-roll who is hireable', () => {
    const expected = generateTalentPool(createRng(4242));
    const state = buildStateWithReadyDraft(4242);
    expect(names(state.talentPool.Actor)).toEqual(names(expected.Actor));
    expect(names(state.talentPool.Director)).toEqual(names(expected.Director));
  });

  it('forks its downstream rngSeed before the script, so script generation cannot re-run every simulated shoot', () => {
    const parent = createRng(4242);
    generateTalentPool(parent); // the pool comes off the parent stream first
    const expectedSeed = forkSeed(parent); // ...then the state's own seed, still before any script
    expect(buildStateWithReadyDraft(4242).rngSeed).toBe(expectedSeed);
  });
});
