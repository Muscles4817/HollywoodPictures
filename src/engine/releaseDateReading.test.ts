import { describe, it, expect } from 'vitest';
import { createRng } from './random';
import { buildReadyDraft } from '../state/testFixtures';
import { estimateDelivery } from './deliveryEstimate';
import { totalDaysForMonth, deriveReleaseWindowFromDay, monthYearOf } from './calendar';
import {
  campaignRunwayBand,
  describeCampaignRunwayBand,
  describeDeliveryVerdict,
  describeReleaseDateConcern,
  describeSeason,
  describeSeasonBand,
  deliveryVerdictFor,
  earliestUnrushedDay,
  readReleaseDate,
  seasonBandFor,
  seasonalDesirability,
} from './releaseDateReading';
import type { FilmDraft, Genre } from '../types';

const TODAY = 400;

function inDevelopment(): FilmDraft {
  const draft = buildReadyDraft(createRng(11));
  return {
    ...draft,
    preProduction: null,
    photography: null,
    postProductionFinalReadyDay: null,
    postProductionScreeningReadyDay: null,
    testScreeningResolved: false,
  };
}

/** The first day in the next 24 months whose window is `target`. */
function dayInWindow(target: string): number {
  const { year, monthIndex } = monthYearOf(TODAY);
  for (let i = 0; i < 24; i++) {
    const m = (monthIndex + i) % 12;
    const y = year + Math.floor((monthIndex + i) / 12);
    const day = totalDaysForMonth(y, m);
    if (deriveReleaseWindowFromDay(day) === target) return day;
  }
  throw new Error(`no ${target} month within two years`);
}

describe('seasonalDesirability', () => {
  it('is the multipliers the box office itself applies, not a parallel guess', () => {
    // Halloween for Horror is the single strongest frame in the data; a quiet
    // month is the weakest. If these ever diverge from data/release.ts the
    // player is being advised toward frames that do not pay.
    expect(seasonalDesirability(dayInWindow('Halloween'), 'Horror')).toBeGreaterThan(
      seasonalDesirability(dayInWindow('Halloween'), 'Drama'),
    );
    expect(seasonalDesirability(dayInWindow('Quiet Month'), 'Horror')).toBeLessThan(1);
  });
});

describe('seasonBandFor', () => {
  it('reads a genre-matched holiday frame as prime and a quiet month as dead', () => {
    expect(seasonBandFor(dayInWindow('Halloween'), 'Horror')).toBe('prime');
    expect(seasonBandFor(dayInWindow('Summer'), 'Action')).toBe('prime');
    expect(seasonBandFor(dayInWindow('Quiet Month'), 'Action')).toBe('weak');
  });

  it('does not promote a holiday frame that does not favour the genre', () => {
    // A Horror film at Christmas gets the crowd but not the bonus.
    expect(seasonBandFor(dayInWindow('Christmas'), 'Horror')).toBe('strong');
    expect(seasonBandFor(dayInWindow('Halloween'), 'Drama')).toBe('ordinary');
  });

  it('names the cause, not the number', () => {
    for (const genre of ['Horror', 'Action', 'Drama'] as Genre[]) {
      for (const window of ['Halloween', 'Summer', 'Quiet Month', 'Christmas']) {
        const text = describeSeason(dayInWindow(window), genre);
        expect(text).not.toMatch(/\d/);
      }
      expect(describeSeasonBand(seasonBandFor(dayInWindow('Summer'), genre))).not.toMatch(/\d/);
    }
  });
});

describe('campaignRunwayBand', () => {
  it('rises with the runway, and tops out at a full rollout', () => {
    expect(campaignRunwayBand(100, 100)).toBe('none');
    expect(campaignRunwayBand(100, 110)).toBe('rushed');
    expect(campaignRunwayBand(100, 140)).toBe('building');
    expect(campaignRunwayBand(100, 200)).toBe('full');
  });

  it('treats a date before the film is ready as no runway at all', () => {
    // A campaign cannot promote a film that does not exist yet.
    expect(campaignRunwayBand(100, 60)).toBe('none');
  });

  it('puts earliestUnrushedDay exactly at the full-rollout boundary', () => {
    const ready = 500;
    expect(campaignRunwayBand(ready, earliestUnrushedDay(ready))).toBe('full');
    expect(campaignRunwayBand(ready, earliestUnrushedDay(ready) - 1)).toBe('building');
  });

  it('describes each band in words', () => {
    for (const band of ['none', 'rushed', 'building', 'full'] as const) {
      expect(describeCampaignRunwayBand(band)).not.toMatch(/\d/);
    }
  });
});

describe('deliveryVerdictFor', () => {
  const estimate = estimateDelivery(inDevelopment(), TODAY);

  it('calls a date the film cannot reach impossible', () => {
    expect(deliveryVerdictFor(estimate, estimate.readyOnDay - 1)).toBe('impossible');
  });

  it('walks up the ladder as margin grows', () => {
    expect(deliveryVerdictFor(estimate, estimate.readyOnDay + 5)).toBe('no-margin');
    expect(deliveryVerdictFor(estimate, estimate.readyOnDay + 30)).toBe('tight');
    expect(deliveryVerdictFor(estimate, estimate.readyOnDay + 200)).toBe('comfortable');
  });

  it('describes each verdict in words', () => {
    for (const v of ['impossible', 'no-margin', 'tight', 'comfortable'] as const) {
      expect(describeDeliveryVerdict(v)).not.toMatch(/\d/);
    }
  });
});

describe('readReleaseDate', () => {
  const draft = inDevelopment();
  const estimate = estimateDelivery(draft, TODAY);
  const read = (day: number) =>
    readReleaseDate(day, estimate, draft.genre!, { genre: draft.genre!, targetAudience: draft.targetAudience! }, []);

  it('reads a near date as both unreachable and unpromotable', () => {
    // The exact case the announcement grid used to present as an ordinary
    // choice: a date two months out for a film that has not begun.
    const soon = read(TODAY + 60);
    expect(soon.delivery).toBe('impossible');
    expect(soon.runway).toBe('none');
  });

  it('reads a date well past the film with a full rollout as clean', () => {
    const later = read(estimate.readyOnDay + 300);
    expect(later.delivery).toBe('comfortable');
    expect(later.runway).toBe('full');
  });
});

describe('describeReleaseDateConcern', () => {
  const draft = inDevelopment();
  const estimate = estimateDelivery(draft, TODAY);
  const read = (day: number) =>
    readReleaseDate(day, estimate, draft.genre!, { genre: draft.genre!, targetAudience: draft.targetAudience! }, []);

  it('leads with the film not existing, over any softer problem', () => {
    // Ordered by what would actually sink the release: a film that is not
    // finished beats a rushed campaign beats a dead season.
    const concern = describeReleaseDateConcern(read(TODAY + 60), draft.genre!)!;
    expect(concern).toMatch(/not be finished/);
  });

  it('warns about a rushed campaign once the film itself is safe', () => {
    // +20 days: the film comfortably exists ('tight', which is a state rather
    // than a problem and so raises nothing of its own), but three weeks is not
    // enough runway for the campaign to build any momentum.
    const reading = read(estimate.readyOnDay + 20);
    expect(reading.delivery).toBe('tight');
    expect(describeReleaseDateConcern(reading, draft.genre!)).toMatch(/runway/);
  });

  it('says nothing when nothing is wrong with the date', () => {
    // A comfortable, fully-promoted, uncontested date in a season that suits
    // the genre has no concern to raise.
    const clean = read(estimate.readyOnDay + 300);
    if (clean.season !== 'weak' && clean.crowdingBand !== 'high') {
      expect(describeReleaseDateConcern(clean, draft.genre!)).toBeNull();
    }
  });
});
