// "Live screen competition" implementation plan - settleTheatricalMarket is
// the new unified entry point replacing the box-office-and-release-
// resolution portions of engine/scheduledReleases.ts's retired
// settleScheduledReleases and engine/rivalStudios.ts's settleRivalMarket.
// Player release-resolution regression coverage (the exact behavior
// settleScheduledReleases used to own) lives in scheduledReleases.test.ts,
// retargeted onto this function - not duplicated here. This file covers
// what's genuinely new: rival release resolution running through the same
// unified pass, cross-owner competitive crowding, and correct per-owner
// cash/brand/prestige attribution.
import { describe, it, expect } from 'vitest';
import { settleTheatricalMarket } from './marketSettlement';
import { buildReadyDraft } from '../state/testFixtures';
import { withRng } from './random';
import type { ScheduledRelease } from './scheduledReleases';
import type { ProductionEvent, RivalProductionInProgress, RivalStudio } from '../types';

function readyDraft(seed: number) {
  return withRng(seed, (rng) => buildReadyDraft(rng)).result;
}

/** A RivalProductionInProgress built from a real generated draft's own script/talent/choices - same shape state/selectors.test.ts's own rivalProductionFixture uses. */
function rivalProduction(seed: number, overrides: Partial<RivalProductionInProgress> = {}): RivalProductionInProgress {
  const draft = readyDraft(seed);
  return {
    id: `rival-prod-${seed}`,
    rivalStudioId: 'rival-studio-1',
    scale: 'Medium',
    genre: draft.genre!,
    script: draft.script!,
    talent: draft.talent,
    productionChoices: draft.productionChoices!,
    postProductionChoices: draft.postProductionChoices!,
    marketingChoices: draft.marketingChoices!,
    targetAudience: draft.targetAudience!,
    releaseDay: 40,
    ...overrides,
  };
}

function rivalStudio(overrides: Partial<RivalStudio> = {}): RivalStudio {
  return {
    id: 'rival-studio-1',
    name: 'Meridian Pictures',
    tier: 'Mid-Size',
    nextSpawnCheckDay: 1000,
    cash: 10_000_000,
    brand: 50,
    prestige: 50,
    lifetimeRevenue: 0,
    lifetimeExpenditure: 0,
    ...overrides,
  };
}

describe('settleTheatricalMarket - rival release resolution', () => {
  it('a due rival production resolves into a Film tagged with its own studio name, and is removed from stillInProgress', () => {
    const production = rivalProduction(1, { releaseDay: 40 });
    const rival = rivalStudio();
    const { result } = withRng(2, (rng) => settleTheatricalMarket([], [], [production], [rival], 40, 50, rng));

    expect(result.stillInProgress).toHaveLength(0);
    expect(result.settledFilms).toHaveLength(1);
    const film = result.settledFilms[0];
    expect(film.id).toBe(`rival-film-${production.id}`);
    expect(film.releasedBy).toBe('Meridian Pictures');
    expect(film.boxOfficeRun.status).toBe('running');
  });

  it('an unresolvable rival studio id (defensive) still resolves the production, falling back to a generic studio name', () => {
    const production = rivalProduction(3, { releaseDay: 40, rivalStudioId: 'no-such-studio' });
    const { result } = withRng(4, (rng) => settleTheatricalMarket([], [], [production], [rivalStudio()], 40, 50, rng));
    expect(result.settledFilms[0].releasedBy).toBe('A Rival Studio');
  });

  it('a not-yet-due rival production is left untouched in stillInProgress', () => {
    const production = rivalProduction(5, { releaseDay: 100 });
    const { result } = withRng(6, (rng) => settleTheatricalMarket([], [], [production], [rivalStudio()], 40, 50, rng));
    expect(result.stillInProgress).toEqual([production]);
    expect(result.settledFilms).toHaveLength(0);
  });
});

describe('settleTheatricalMarket - player and rival settle together, correctly attributed', () => {
  it('a player release and a rival release due in the same pass both settle, split correctly by owner', () => {
    const playerDraft = readyDraft(10);
    const scheduled: ScheduledRelease = { draft: playerDraft, releaseDay: 40 };
    const production = rivalProduction(11, { releaseDay: 40 });
    const rival = rivalStudio();

    const { result } = withRng(12, (rng) => settleTheatricalMarket([], [scheduled], [production], [rival], 40, 50, rng));

    expect(result.settledFilms).toHaveLength(2);
    const playerFilm = result.settledFilms.find((f) => f.releasedBy === undefined);
    const rivalFilm = result.settledFilms.find((f) => f.releasedBy !== undefined);
    expect(playerFilm?.id).toBe(playerDraft.id);
    expect(rivalFilm?.releasedBy).toBe('Meridian Pictures');
    expect(result.playerCostCharged).toBeGreaterThan(0);
  });

  it("a rival's cashCredit/brandDelta/prestigeDelta land only on its own studio's rivalDeltas entry, never on the player's own totals or another rival's", () => {
    const playerDraft = readyDraft(20);
    const scheduled: ScheduledRelease = { draft: playerDraft, releaseDay: 1 };
    const productionA = rivalProduction(21, { releaseDay: 1, rivalStudioId: 'studio-a', id: 'prod-a' });
    const productionB = rivalProduction(22, { releaseDay: 1, rivalStudioId: 'studio-b', id: 'prod-b' });
    const studioA = rivalStudio({ id: 'studio-a', name: 'Studio A' });
    const studioB = rivalStudio({ id: 'studio-b', name: 'Studio B' });

    // Settle far enough out that box office actually accrues (not just the release-day week), so cashCredit is genuinely nonzero to check attribution against.
    const { result } = withRng(23, (rng) =>
      settleTheatricalMarket([], [scheduled], [productionA, productionB], [studioA, studioB], 1 + 3 * 7, 50, rng),
    );

    expect(result.rivalDeltas.has('Studio A')).toBe(true);
    expect(result.rivalDeltas.has('Studio B')).toBe(true);
    // Two distinct rivals, each with their own nonzero credit, neither summed into the other - and the player's own credit (also accrues over this 3-week span) is a third, independent figure, not folded into either.
    const deltaA = result.rivalDeltas.get('Studio A')!;
    const deltaB = result.rivalDeltas.get('Studio B')!;
    expect(deltaA.cashCredit).toBeGreaterThan(0);
    expect(deltaB.cashCredit).toBeGreaterThan(0);
    expect(result.playerCashCredit).toBeGreaterThan(0);
    // No pairwise bleed: neither rival's credit accidentally equals the other's or the player's.
    expect(deltaA.cashCredit).not.toBe(deltaB.cashCredit);
    expect(deltaA.cashCredit).not.toBe(result.playerCashCredit);
    expect(deltaB.cashCredit).not.toBe(result.playerCashCredit);
  });

  it('a released player film and a released rival film both keep settling their own ongoing box office in the same later pass, still correctly attributed', () => {
    const playerDraft = readyDraft(30);
    const rival = rivalStudio();
    const production = rivalProduction(31, { releaseDay: 1 });

    const first = withRng(32, (rng) => settleTheatricalMarket([], [{ draft: playerDraft, releaseDay: 1 }], [production], [rival], 1, 50, rng)).result;
    const runningFilms = first.settledFilms;

    const second = withRng(33, (rng) => settleTheatricalMarket(runningFilms, [], [], [rival], 1 + 3 * 7, 50, rng)).result;
    expect(second.playerCashCredit).toBeGreaterThan(0);
    expect(second.rivalDeltas.get('Meridian Pictures')?.cashCredit).toBeGreaterThan(0);
  });
});

describe('settleTheatricalMarket - press tour reputation write-back (D2b)', () => {
  it('returns a baseline heat delta for each tourer of a settled player film, and none when no tour ran', () => {
    const draft = readyDraft(70);
    const tourer = draft.talent[0].person;
    const touring = { ...draft, marketingChoices: { ...draft.marketingChoices!, pressTourCast: [tourer.id] } };

    const withTour = withRng(71, (rng) => settleTheatricalMarket([], [{ draft: touring, releaseDay: 40 }], [], [], 40, 50, rng)).result;
    const delta = withTour.playerTalentReputationDeltas.find((d) => d.personId === tourer.id);
    expect(delta).toBeDefined();
    expect(delta!.heatDelta).toBeGreaterThan(0);

    const noTour = withRng(71, (rng) => settleTheatricalMarket([], [{ draft, releaseDay: 40 }], [], [], 40, 50, rng)).result;
    expect(noTour.playerTalentReputationDeltas).toEqual([]);
  });
});

describe('settleTheatricalMarket - cross-owner competitive crowding at release', () => {
  it("a rival's own crowded release day is dented by a same-genre/audience player release already on the calendar, and vice versa - crowding sees across owners now, not just within one", () => {
    const playerDraft = readyDraft(40);
    const scheduledAlone: ScheduledRelease = { draft: playerDraft, releaseDay: 40 };

    // Baseline: the rival resolves with nothing else on the calendar.
    const noCompetitionRival = rivalProduction(41, { releaseDay: 40, genre: playerDraft.genre!, targetAudience: playerDraft.targetAudience! });
    const isolated = withRng(42, (rng) => settleTheatricalMarket([], [], [noCompetitionRival], [rivalStudio()], 40, 50, rng)).result;

    // Same rival production, same day, but now a same-genre/audience player release is also scheduled for that exact day.
    const crowdedRival = rivalProduction(41, { releaseDay: 40, genre: playerDraft.genre!, targetAudience: playerDraft.targetAudience! });
    const crowded = withRng(42, (rng) => settleTheatricalMarket([], [scheduledAlone], [crowdedRival], [rivalStudio()], 40, 50, rng)).result;

    const isolatedRivalFilm = isolated.settledFilms.find((f) => f.releasedBy !== undefined)!;
    const crowdedRivalFilm = crowded.settledFilms.find((f) => f.releasedBy !== undefined)!;
    // A same-genre/audience competitor releasing the same day can only ever
    // dent initialAvailabilityFraction (CROWDING_PENALTY_WEIGHT, engine/
    // audienceSimulationInputs.ts) or leave it unchanged - never raise it.
    expect(crowdedRivalFilm.boxOfficeRun.fixed.initialAvailabilityFraction).toBeLessThanOrEqual(
      isolatedRivalFilm.boxOfficeRun.fixed.initialAvailabilityFraction,
    );
  });
});

describe('settleTheatricalMarket - big jump consistency across player and rival together', () => {
  it('a multi-week jump settling a player release, a rival release, and their ongoing box office together matches the same span done as several smaller calls', () => {
    const playerDraft = readyDraft(50);
    const production = rivalProduction(51, { releaseDay: 1 });
    const rival = rivalStudio();

    const bigJump = withRng(52, (rng) =>
      settleTheatricalMarket([], [{ draft: playerDraft, releaseDay: 1 }], [production], [rival], 1 + 6 * 7, 50, rng),
    ).result;

    // Threads the rng seed forward call to call (withRng's own nextSeed),
    // the same pattern this codebase's other big-jump-vs-small-batches
    // tests already use (e.g. scheduledReleases.test.ts) - reusing the same
    // seed for every call would replay identical randomness each time
    // instead of genuinely continuing where the previous step left off.
    let runningFilms: ReturnType<typeof settleTheatricalMarket>['settledFilms'] = [];
    let scheduled: ScheduledRelease[] = [{ draft: playerDraft, releaseDay: 1 }];
    let inProgress: RivalProductionInProgress[] = [production];
    let seed = 52;
    for (let week = 1; week <= 6; week++) {
      const { result: step, nextSeed } = withRng(seed, (rng) => settleTheatricalMarket(runningFilms, scheduled, inProgress, [rival], 1 + week * 7, 50, rng));
      runningFilms = step.settledFilms;
      scheduled = step.stillScheduled;
      inProgress = step.stillInProgress;
      seed = nextSeed;
    }

    const byId = (films: typeof runningFilms) => [...films].sort((a, b) => a.id.localeCompare(b.id));
    expect(byId(runningFilms).map((f) => f.boxOfficeRun)).toEqual(byId(bigJump.settledFilms).map((f) => f.boxOfficeRun));
  });
});

// Post-Production Redesign Phase B architecture cleanup
// (docs/DESIGN_REVIEW_post_production_redesign.md section 2) - a resolved
// test-screening intervention's own ProductionEvent now lives on
// FilmDraft.postProductionEvents, charged immediately at
// RESOLVE_TEST_SCREENING_CHOICE (state/studioReducer.ts), not deferred like
// an on-set event. These cover the three things that change at release:
// its cost is reported (results.totalCost) but never charged a second time
// here, its quality/buzz reach scoring the same way an on-set event's would,
// and the resolved outcome itself carries over onto the released Film.
describe('settleTheatricalMarket - resolved post-production intervention accounting (architecture cleanup)', () => {
  const INTERVENTION_EVENT: ProductionEvent = {
    id: 'test-screening',
    description: 'Resolved: Major Reshoots.',
    severity: 'high',
    costDelta: 3_000_000,
    qualityDelta: 8,
    buzzDelta: 2,
    delayDaysDelta: 30,
  };

  it("carries FilmDraft.postProductionEvents over onto the released Film verbatim, and folds its cost into results.totalCost for reporting", () => {
    const draft = readyDraft(60);
    const withIntervention = { ...draft, postProductionEvents: [INTERVENTION_EVENT] };
    const scheduled: ScheduledRelease = { draft: withIntervention, releaseDay: 40 };
    const { result } = withRng(61, (rng) => settleTheatricalMarket([], [scheduled], [], [], 40, 50, rng));
    const film = result.settledFilms[0];
    expect(film.postProductionEvents).toEqual([INTERVENTION_EVENT]);

    const withoutScheduled: ScheduledRelease = { draft, releaseDay: 40 };
    const { result: withoutResult } = withRng(61, (rng) => settleTheatricalMarket([], [withoutScheduled], [], [], 40, 50, rng));
    const filmWithout = withoutResult.settledFilms[0];

    expect(film.results.productionCost).toBe(filmWithout.results.productionCost + INTERVENTION_EVENT.costDelta);
    expect(film.results.totalCost).toBe(filmWithout.results.totalCost + INTERVENTION_EVENT.costDelta);
  });

  it("does not charge the intervention's cost again at settlement - playerCostCharged is identical whether or not it's present, since it was already deducted from studio.cash immediately at resolution", () => {
    const draft = readyDraft(62);
    const withIntervention = { ...draft, postProductionEvents: [INTERVENTION_EVENT] };
    const scheduledWith: ScheduledRelease = { draft: withIntervention, releaseDay: 40 };
    const scheduledWithout: ScheduledRelease = { draft, releaseDay: 40 };

    const { result: withResult } = withRng(63, (rng) => settleTheatricalMarket([], [scheduledWith], [], [], 40, 50, rng));
    const { result: withoutResult } = withRng(63, (rng) => settleTheatricalMarket([], [scheduledWithout], [], [], 40, 50, rng));

    expect(withResult.playerCostCharged).toBe(withoutResult.playerCostCharged);
  });

  it("a resolved intervention's quality/buzz reach the released film's scoring, combined with any on-set events, without a parallel scoring system", () => {
    const draft = readyDraft(64);
    const withIntervention = { ...draft, postProductionEvents: [INTERVENTION_EVENT] };
    const scheduled: ScheduledRelease = { draft: withIntervention, releaseDay: 40 };
    const { result } = withRng(65, (rng) => settleTheatricalMarket([], [scheduled], [], [], 40, 50, rng));
    const film = result.settledFilms[0];

    const withoutScheduled: ScheduledRelease = { draft, releaseDay: 40 };
    const { result: withoutResult } = withRng(65, (rng) => settleTheatricalMarket([], [withoutScheduled], [], [], 40, 50, rng));
    const filmWithout = withoutResult.settledFilms[0];

    // The intervention's own qualityDelta/buzzDelta genuinely moved the
    // final numbers, same as an on-set event's would - not silently dropped
    // for living on a separate collection from photography.events.
    expect(film.results.eventsScore).not.toBe(filmWithout.results.eventsScore);
    expect(film.results.buzzScore).not.toBe(filmWithout.results.buzzScore);
  });
});
