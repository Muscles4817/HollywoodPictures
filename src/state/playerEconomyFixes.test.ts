// The four player-economy fixes (docs/DESIGN_REVIEW_player_economy.md §7,
// items 1-4), each pinned by the behaviour it exists for.
import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { buildStateWithReadyDraft } from './testFixtures';
import type { GameState } from './gameState';
import { asPlayerDraft, findProject, playerReleasedFilms } from '../engine/project';
import { MAX_SIMULATION_WEEKS } from '../engine/audienceSimulationStep';
import { computeDailyPrepBurn, PREP_DAILY_BURN_FLOOR } from '../engine/cost';
import { determineOutcome } from '../engine/outcome';
import { computeBrandChange } from '../engine/reputation';

function withMarketing(state: GameState, marketingSpend: number): GameState {
  return studioReducer(state, {
    type: 'SET_MARKETING_CHOICES',
    choices: { ...asPlayerDraft(findProject(state.projects, state.focusedProjectId))!.marketingChoices!, marketingSpend, releaseType: 'Limited', pressTourCast: [] },
  });
}

function overdrawn(state: GameState): GameState {
  return { ...state, studio: { ...state.studio, cash: -750_000 } };
}

describe('an overdrawn studio can still release a finished film', () => {
  it('with no campaign, the release goes ahead', () => {
    const state = withMarketing(overdrawn(buildStateWithReadyDraft(11)), 0);
    const after = studioReducer(state, { type: 'SCHEDULE_RELEASE', releaseDay: state.totalDays });
    // The lock this fixes: a zero charge used to "exceed" a negative balance,
    // so the film could never come out and the studio could never recover.
    expect(playerReleasedFilms(after.projects)).toHaveLength(1);
  });

  it('but it cannot buy a campaign it has no money for', () => {
    const state = withMarketing(overdrawn(buildStateWithReadyDraft(11)), 2_000_000);
    const after = studioReducer(state, { type: 'SCHEDULE_RELEASE', releaseDay: state.totalDays });
    expect(after).toBe(state);
  });
});

describe('pre-production overhead follows the size of the film', () => {
  it('a small film pays a small prep bill, not the bill of a fully-funded one', () => {
    const micro = computeDailyPrepBurn('Intimate', 400_000);
    const funded = computeDailyPrepBurn('Intimate', 20_000_000);
    expect(micro).toBeLessThan(funded / 5);
    // Over a 50-day prep it is around a fifth of the budget, as in the real business.
    expect((micro * 50) / 400_000).toBeGreaterThan(0.1);
    expect((micro * 50) / 400_000).toBeLessThan(0.3);
  });

  it('never drops below the floor and never exceeds the ceiling for the scale', () => {
    expect(computeDailyPrepBurn('Intimate', 0)).toBe(PREP_DAILY_BURN_FLOOR);
    expect(computeDailyPrepBurn('Epic', 10_000_000_000)).toBe(computeDailyPrepBurn('Epic', Infinity));
    expect(computeDailyPrepBurn('Intimate', Infinity)).toBeLessThan(computeDailyPrepBurn('Medium', Infinity));
    expect(computeDailyPrepBurn('Medium', Infinity)).toBeLessThan(computeDailyPrepBurn('Epic', Infinity));
  });
});

describe('a finished film is judged on everything it is expected to earn', () => {
  const released = studioReducer(buildStateWithReadyDraft(5), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
  let finished = released;
  for (let i = 0; i < MAX_SIMULATION_WEEKS * 7 + 7; i++) finished = studioReducer(finished, { type: 'ADVANCE_DAY' });
  const film = playerReleasedFilms(finished.projects)[0];

  it('records the after-market it expected when the run ended, and leaves profit as the cinema figure', () => {
    expect(film.results.expectedAfterMarket).toBeGreaterThan(0);
    expect(film.results.profit).toBe(film.results.studioRevenue! - film.results.totalCost);
  });

  it('uses cinema profit plus that expectation for the label; Brand still reads the cinema result', () => {
    const allWindows = film.results.profit! + film.results.expectedAfterMarket!;
    const inputs = { totalCost: film.results.totalCost, totalBoxOffice: film.results.totalBoxOffice!, audienceScore: film.results.audienceScore };
    expect(film.results.outcome).toBe(
      determineOutcome({ ...inputs, profit: allWindows, qualityScore: film.results.qualityScore, criticScore: film.results.criticScore }),
    );
    // Brand is what the public knows, and the public sees box office.
    expect(film.results.brandChange).toBe(computeBrandChange({ ...inputs, profit: film.results.profit! }));
  });

  it('so a film that loses money in cinemas but earns it back afterwards is not a Flop', () => {
    const inputs = { totalCost: 4_000_000, totalBoxOffice: 4_000_000, qualityScore: 60, criticScore: 60, audienceScore: 60 };
    expect(determineOutcome({ ...inputs, profit: -2_200_000 })).toBe('Flop');
    expect(determineOutcome({ ...inputs, profit: -2_200_000 + 2_600_000 })).not.toBe('Flop');
  });
});
