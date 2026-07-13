import { describe, it, expect } from 'vitest';
import { settleBoxOfficeForAllFilms, STUDIO_BOX_OFFICE_SHARE, AVERAGE_TICKET_PRICE } from './boxOfficeRun';
import { deriveAudienceSimulationFixedState, type ReleaseSimulationInputs } from './audienceSimulationInputs';
import { advanceOneWeek, MAX_SIMULATION_WEEKS } from './audienceSimulationStep';
import { createAudienceSimulationFixedState, type AudienceSimulationFixedState } from './audienceSimulation';
import type { Film, FilmResults } from '../types';

const RELEASE_INPUTS: ReleaseSimulationInputs = {
  buzzScore: 55,
  marketingSpend: 20_000_000,
  directorFame: 50,
  leadFame: 50,
  studioBrand: 50,
  scriptAccessibility: 55,
  scriptHookStrength: 50,
  scriptCrossoverPotential: 40,
  scriptSpectacle: 50,
  scriptIntendedAudience: 'Mass Market',
  targetAudience: 'Mass Market',
  genre: 'Action',
  releaseWindow: 'Quiet Month',
  releaseType: 'Wide',
  criticScore: 65,
  audienceScore: 68,
};

function fixedFor(overrides: Partial<ReleaseSimulationInputs> = {}): AudienceSimulationFixedState {
  return deriveAudienceSimulationFixedState({ ...RELEASE_INPUTS, ...overrides });
}

function baseResults(overrides: Partial<FilmResults> = {}): FilmResults {
  return {
    productionCost: 10_000_000,
    marketingCost: 20_000_000,
    totalCost: 30_000_000,
    openingWeekend: 0,
    totalBoxOffice: null,
    studioRevenue: null,
    profit: null,
    outcome: null,
    brandChange: null,
    prestigeChange: null,
    criticScore: 65,
    audienceScore: 68,
    buzzScore: 55,
    qualityScore: 60,
    scriptScore: 60,
    directionScore: 60,
    actingScore: 60,
    productionScore: 60,
    postProductionScore: 60,
    eventsScore: 0,
    reviewBlurbs: [],
    storyReport: '',
    ...overrides,
  };
}

/** A freshly-released, never-settled Film - week 1 hasn't happened yet, mirroring exactly how RELEASE_FILM constructs boxOfficeRun (empty weeks/simWeeks) before the immediately-following settlement call. */
function freshFilm(id: string, releasedOnDay: number, fixed: AudienceSimulationFixedState, releasedBy?: string): Film {
  const week1 = advanceOneWeek(fixed, []);
  return {
    id,
    title: id,
    genre: RELEASE_INPUTS.genre,
    targetAudience: RELEASE_INPUTS.targetAudience,
    script: {
      id: 'script-1', title: 'Test Script', genre: RELEASE_INPUTS.genre,
      archetype: 'GenreFormula', storyType: 'Original', setting: 'Modern', scale: 'Medium',
      originality: 40,
      structure: 60, characters: 60, dialogue: 60, complexity: 50, cost: 1_000_000,
      toneProfile: { action: 50, comedy: 50, romance: 50, suspense: 50, drama: 50, spectacle: RELEASE_INPUTS.scriptSpectacle },
      environmentStrategy: { studio: 0.34, location: 0.33, digital: 0.33 }, environmentAmbition: 0.5,
      effectsStrategy: { practical: 0.5, digital: 0.5 }, effectsAmbition: 0.5,
      productionRequirements: {
        extras: 0.3, locations: 0.3, periodSetting: false, vehicles: false, animals: false,
        practicalEffects: 0.3, vfx: 0.3, stunts: 0.2, choreography: 0.1, crowdWork: 0.2,
      },
      synopsis: '', requiredLeads: 1, requiredSupporting: 1, intendedAudience: RELEASE_INPUTS.targetAudience,
    },
    talent: [],
    productionChoices: { contingencyAmount: 500_000, setQualityAmount: 500_000, practicalEffectsAmount: 500_000, vfxAmount: 500_000, runtimeIntensity: 0.5 },
    postProductionChoices: { editStyle: 'Balanced', musicFocus: 'Standard', testScreeningResponse: 'Ignore', finalCutFocus: 'Trailer-focused' },
    marketingChoices: { marketingSpend: RELEASE_INPUTS.marketingSpend, releaseType: RELEASE_INPUTS.releaseType, releaseWindow: RELEASE_INPUTS.releaseWindow },
    events: [],
    results: baseResults({ openingWeekend: Math.round(week1.cumulativeTicketsSold * AVERAGE_TICKET_PRICE) }),
    boxOfficeRun: { status: 'running', fixed, simWeeks: [], weeks: [], cumulativeGross: 0, acknowledged: false },
    releasedOnDay,
    ...(releasedBy ? { releasedBy } : {}),
  };
}

describe('settleBoxOfficeForAllFilms - calendar jumps and catch-up', () => {
  it('advancing multiple films through a single large calendar jump settles every one of them', () => {
    const filmA = freshFilm('a', 1, fixedFor());
    const filmB = freshFilm('b', 8, fixedFor({ criticScore: 90, audienceScore: 92 }));
    const filmC = freshFilm('c', 15, fixedFor({ criticScore: 20, audienceScore: 15 }));

    const settlement = settleBoxOfficeForAllFilms([filmA, filmB, filmC], 1 + 20 * 7); // a huge jump - 20 weeks past film A's release
    for (const film of settlement.filmsReleased) {
      expect(film.boxOfficeRun.weeks.length).toBeGreaterThan(0);
      expect(film.boxOfficeRun.simWeeks.length).toBe(film.boxOfficeRun.weeks.length);
    }
  });

  it('one big catch-up jump produces the exact same final state as settling week by week', () => {
    const bigJump = settleBoxOfficeForAllFilms([freshFilm('x', 1, fixedFor())], 1 + 10 * 7).filmsReleased[0];

    let film = freshFilm('x', 1, fixedFor());
    for (let week = 1; week <= 10; week++) {
      const settlement = settleBoxOfficeForAllFilms([film], 1 + week * 7);
      film = settlement.filmsReleased[0];
    }

    expect(film.boxOfficeRun).toEqual(bigJump.boxOfficeRun);
    expect(film.results).toEqual(bigJump.results);
  });

  it('a run already finished does not get re-settled by a later call - same object, zero cash/brand/prestige this time', () => {
    let film = freshFilm('done', 1, fixedFor({ criticScore: 10, audienceScore: 8 })); // poor reception - ends well before the hard cap
    let settlement = settleBoxOfficeForAllFilms([film], 1 + MAX_SIMULATION_WEEKS * 7);
    film = settlement.filmsReleased[0];
    expect(film.boxOfficeRun.status).toBe('finished');
    const finishedRun = film.boxOfficeRun;
    const finishedResults = film.results;

    settlement = settleBoxOfficeForAllFilms([film], 1 + (MAX_SIMULATION_WEEKS + 10) * 7);
    expect(settlement.filmsReleased[0]).toBe(film); // literally the same object - the `run === film.boxOfficeRun` short-circuit fired
    expect(settlement.filmsReleased[0].boxOfficeRun).toBe(finishedRun);
    expect(settlement.filmsReleased[0].results).toBe(finishedResults);
    expect(settlement.cashCredit).toBe(0);
    expect(settlement.brandDelta).toBe(0);
    expect(settlement.prestigeDelta).toBe(0);
  });
});

describe('settleBoxOfficeForAllFilms - revenue and cash', () => {
  it("cashCredit equals the sum of each newly-settled week's gross times the studio share", () => {
    const film = freshFilm('rev', 1, fixedFor());
    const settlement = settleBoxOfficeForAllFilms([film], 1 + 3 * 7);
    const settled = settlement.filmsReleased[0];
    const expectedCredit = settled.boxOfficeRun.weeks.reduce((sum, w) => sum + Math.round(w.gross * STUDIO_BOX_OFFICE_SHARE), 0);
    expect(settlement.cashCredit).toBe(expectedCredit);
  });

  it('cashCredit is never negative, across a range of reception levels including terrible ones', () => {
    for (const [criticScore, audienceScore] of [[5, 5], [30, 30], [60, 60], [95, 97]] as const) {
      const film = freshFilm(`cash-${criticScore}`, 1, fixedFor({ criticScore, audienceScore }));
      const settlement = settleBoxOfficeForAllFilms([film], 1 + MAX_SIMULATION_WEEKS * 7);
      expect(settlement.cashCredit).toBeGreaterThanOrEqual(0);
    }
  });

  it('cumulativeGross always equals the sum of that run\'s own weekly grosses', () => {
    const film = freshFilm('cum', 1, fixedFor({ criticScore: 85, audienceScore: 88 }));
    const settlement = settleBoxOfficeForAllFilms([film], 1 + 6 * 7);
    const settled = settlement.filmsReleased[0];
    const summed = settled.boxOfficeRun.weeks.reduce((sum, w) => sum + w.gross, 0);
    expect(settled.boxOfficeRun.cumulativeGross).toBe(summed);
  });
});

describe('settleBoxOfficeForAllFilms - termination', () => {
  it('a run can terminate normally, well before the hard cap, once weekly admissions trickle down', () => {
    // deriveAudienceSimulationFixedState's realistic release-input ranges
    // (Milestone 3) never produce a conversionPacingBaseline high enough for
    // the natural depletion of a *non*-replenished pool to fall below
    // hasSimulationEnded's 2%-of-opening cutoff within MAX_SIMULATION_WEEKS -
    // checked empirically (a scratch sweep across buzz/marketing/release
    // type/reception extremes) before writing this test, per this
    // project's own calibration discipline. That's a genuine, already-
    // documented property of Milestones 1-4's committed calibration, not
    // something this integration milestone should quietly patch - so this
    // test constructs a fixed state directly via Milestone 1's own
    // createAudienceSimulationFixedState (a much higher, synthetic
    // conversionPacingBaseline) specifically to exercise
    // settleBoxOfficeForAllFilms' handling of an early finish, independent
    // of whether realistic release inputs can currently reach one.
    const fastDecayFixed = createAudienceSimulationFixedState({
      totalAddressableAudience: 5_000_000,
      baseInterestFraction: 0.2,
      marketingEfficiency: 0.5,
      crossoverCapacityFraction: 0,
      conversionPacingBaseline: 0.5,
      externalWeeklyAwarenessRate: 0,
      criticScore: 5,
      audienceScore: 5,
      initialAwareCount: 1_500_000,
      // Full, unconstrained availability throughout - this test is about
      // exercising an early finish via fast interest depletion
      // (conversionPacingBaseline alone), not about exhibition access, so
      // availability is kept out of the way entirely (1.0, zero decay).
      initialAvailabilityFraction: 1,
      availabilityBaseWeeklyDecay: 0,
      criticLedExpansionWeight: 0,
    });
    const film = freshFilm('normal-end', 1, fastDecayFixed);
    const settlement = settleBoxOfficeForAllFilms([film], 1 + MAX_SIMULATION_WEEKS * 7);
    const settled = settlement.filmsReleased[0];
    expect(settled.boxOfficeRun.status).toBe('finished');
    expect(settled.boxOfficeRun.weeks.length).toBeLessThan(MAX_SIMULATION_WEEKS);
  });

  it('a run terminates via the hard cap for a film that keeps performing well', () => {
    const film = freshFilm('hard-cap', 1, fixedFor({ criticScore: 95, audienceScore: 96, scriptCrossoverPotential: 80 }));
    const settlement = settleBoxOfficeForAllFilms([film], 1 + (MAX_SIMULATION_WEEKS + 30) * 7); // ask for far more than MAX_SIMULATION_WEEKS
    const settled = settlement.filmsReleased[0];
    expect(settled.boxOfficeRun.status).toBe('finished');
    expect(settled.boxOfficeRun.weeks.length).toBeLessThanOrEqual(MAX_SIMULATION_WEEKS);
  });

  it('once finished, totalBoxOffice/studioRevenue/profit/outcome/brandChange/prestigeChange are all populated and coherent', () => {
    const film = freshFilm('coherent', 1, fixedFor({ criticScore: 70, audienceScore: 75 }));
    const settlement = settleBoxOfficeForAllFilms([film], 1 + MAX_SIMULATION_WEEKS * 7);
    const settled = settlement.filmsReleased[0];
    expect(settled.boxOfficeRun.status).toBe('finished');
    expect(settled.results.totalBoxOffice).toBe(settled.boxOfficeRun.cumulativeGross);
    expect(settled.results.studioRevenue).toBe(Math.round(settled.results.totalBoxOffice! * STUDIO_BOX_OFFICE_SHARE));
    expect(settled.results.profit).toBe(settled.results.studioRevenue! - settled.results.totalCost);
    expect(settled.results.outcome).not.toBeNull();
    expect(settled.results.brandChange).not.toBeNull();
    expect(settled.results.prestigeChange).not.toBeNull();
  });
});

describe('rival films settle through the exact same function', () => {
  it('a film tagged releasedBy (a rival) settles identically to one without it', () => {
    const fixed = fixedFor({ criticScore: 80, audienceScore: 82 });
    const player = freshFilm('player-film', 1, fixed);
    const rival = freshFilm('rival-film', 1, fixed, 'A Rival Studio');

    const settlement = settleBoxOfficeForAllFilms([player, rival], 1 + 5 * 7);
    const [settledPlayer, settledRival] = settlement.filmsReleased;
    expect(settledRival.releasedBy).toBe('A Rival Studio');
    // Same fixed state, same release day, same calendar jump -> identical box office shape regardless of releasedBy.
    expect(settledRival.boxOfficeRun.weeks).toEqual(settledPlayer.boxOfficeRun.weeks);
    expect(settledRival.boxOfficeRun.simWeeks).toEqual(settledPlayer.boxOfficeRun.simWeeks);
  });
});
