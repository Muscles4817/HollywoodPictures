import { describe, it, expect } from 'vitest';
import { computeReleaseResults, type ReleaseComputationInput } from './releaseFilm';
import { buildReadyDraft } from '../state/testFixtures';
import { createRng, withRng } from './random';
import type { Person, PersonPersonality, TalentAssignment } from '../types';

function person(id: string, fame: number, personality: Partial<PersonPersonality> = {}): Person {
  return {
    id,
    identity: { name: id, appearanceTags: [] },
    personality: {
      professionalism: 60, ambition: 50, loyalty: 50, ego: 40, temperament: 55, pressureHandling: 60, controversy: 20, adaptability: 55,
      ...personality,
    },
    reputation: { fame, prestige: 40, industryRespect: 50, reliability: 60, currentHeat: 40 },
    availability: { commitments: [] },
    traits: [],
    primaryRole: 'Actor',
    careers: { actor: { role: 'Actor', active: true, experience: 50, roleReputation: 50, minimumSalary: 100_000, typicalSalary: 100_000, actingStyle: { characterTransformation: 50, emotionalPerformance: 50, charisma: 50, comedy: 50, physicalPerformance: 50 } } },
  };
}

const safeStar = person('safe-star', 90, { controversy: 5, professionalism: 90, pressureHandling: 90 });
const looseCannon = person('loose-cannon', 90, { controversy: 95, professionalism: 20, pressureHandling: 15 });
const knownTalent: TalentAssignment[] = [
  { role: 'Lead Actor', person: safeStar },
  { role: 'Lead Actor', person: looseCannon },
];

function baseInput(): ReleaseComputationInput {
  const { result: draft } = withRng(2024, (rng) => buildReadyDraft(rng));
  return {
    title: draft.title || 'Untitled',
    genre: draft.genre!,
    targetAudience: draft.targetAudience!,
    script: draft.script!,
    talent: knownTalent,
    productionChoices: draft.productionChoices!,
    postProductionChoices: draft.postProductionChoices!,
    marketingChoices: draft.marketingChoices!,
    events: draft.photography!.events,
    postProductionEvents: draft.postProductionEvents,
    photographyCost: draft.photography!.runningCost,
    shootingRatio: 1,
    studioBrand: 20,
    competitiveCrowding: 0,
  };
}

const base = baseInput();

function release(pressTourCast: string[] | undefined) {
  return computeReleaseResults({ ...base, marketingChoices: { ...base.marketingChoices, pressTourCast } }, createRng(1)).results;
}

describe('computeReleaseResults - press tour', () => {
  it('is unchanged when nobody tours (absent roster falls through to no delta, no cost)', () => {
    const none = computeReleaseResults(base, createRng(1)).results;
    const explicitAbsent = release(undefined);
    expect(explicitAbsent).toEqual(none);
  });

  it('a famous, media-safe star lifts Buzz and opening, and adds cost', () => {
    const none = release(undefined);
    const toured = release([safeStar.id]);
    expect(toured.buzzScore).toBeGreaterThan(none.buzzScore);
    expect(toured.openingWeekend).toBeGreaterThan(none.openingWeekend);
    expect(toured.marketingCost).toBeGreaterThan(none.marketingCost);
    expect(toured.totalCost).toBeGreaterThan(none.totalCost);
  });

  it('a famous loose cannon is a net liability - Buzz drops below not touring at all', () => {
    const none = release(undefined);
    const toured = release([looseCannon.id]);
    expect(toured.buzzScore).toBeLessThan(none.buzzScore);
  });

  it('the same-fame safe star out-opens the loose cannon for a comparable spend', () => {
    expect(release([safeStar.id]).openingWeekend).toBeGreaterThan(release([looseCannon.id]).openingWeekend);
  });

  it('a resolved press-tour moment saps Buzz and appends its beat to the story report', () => {
    const withTour = { ...base, marketingChoices: { ...base.marketingChoices, pressTourCast: [safeStar.id] } };
    const quiet = computeReleaseResults(withTour, createRng(1)).results;
    const gaffe = computeReleaseResults(
      { ...withTour, pressTourMoment: { buzzDelta: -9, storyBeat: 'The junket went sideways.' } },
      createRng(1),
    ).results;
    expect(gaffe.buzzScore).toBeLessThan(quiet.buzzScore);
    expect(gaffe.storyReport).toContain('The junket went sideways.');
    expect(quiet.storyReport).not.toContain('The junket went sideways.');
  });
});
