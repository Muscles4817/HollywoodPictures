// Guards the one property state/testFixtures.ts exists to have: a fixture draft
// must be reproducible from its seed, and its TALENT must not move when script
// generation changes.
//
// The second half is the point. Script and talent used to be drawn from one
// shared rng, so any change to how many draws a script costs re-rolled the
// director and both actors of every fixture built here - and 40 test files
// build from it. An honest one-draw change to the generator surfaced as a dozen
// unrelated failures across the box office, casting and execution suites, which
// is how a real regression gets lost in noise.
import { describe, it, expect } from 'vitest';
import { buildReadyAsset, buildReadyDraft } from './testFixtures';
import { generateTalentCandidates } from '../engine/talentGenerator';
import { createRng, randInt } from '../engine/random';

describe('buildReadyDraft', () => {
  it('is reproducible from its seed', () => {
    const a = buildReadyDraft(createRng(2024));
    const b = buildReadyDraft(createRng(2024));
    expect(b.talent.map((t) => t.person.identity.name)).toEqual(a.talent.map((t) => t.person.identity.name));
    expect(b.script!.title).toBe(a.script!.title);
  });

  it('gives different seeds different drafts', () => {
    const a = buildReadyDraft(createRng(1));
    const b = buildReadyDraft(createRng(2));
    expect(b.talent.map((t) => t.person.identity.name).join('/')).not.toBe(a.talent.map((t) => t.person.identity.name).join('/'));
  });

  it('draws its talent from a child stream seeded before the script, so script generation can never move it', () => {
    // Reconstructs the child stream by hand: one draw off the caller's rng for
    // the seed, and nothing else. If talent ever starts depending on anything
    // the script generator consumes, these ids stop matching - which is exactly
    // the coupling this fixture must not have. Compared on name, not id -
    // Person ids come off a module-level counter, so they are not seed-derived
    // and say nothing about which person was actually generated.
    const seedSource = createRng(99);
    const talentSeed = randInt(seedSource, 0, 2_147_483_646);
    const expectedRng = createRng(talentSeed);
    const expected = [
      generateTalentCandidates('Director', expectedRng, 1)[0],
      generateTalentCandidates('Actor', expectedRng, 1)[0],
      generateTalentCandidates('Actor', expectedRng, 1)[0],
    ];

    const draft = buildReadyDraft(createRng(99));
    expect(draft.talent.map((t) => t.person.identity.name)).toEqual(expected.map((p) => p.identity.name));
  });

  it('still draws its script from the caller\'s own stream', () => {
    const shared = createRng(7);
    randInt(shared, 0, 2_147_483_646); // the talent seed buildReadyDraft would take
    const asset = buildReadyAsset(shared);
    expect(buildReadyDraft(createRng(7)).script!.title).toBe(asset.script.title);
  });
});
