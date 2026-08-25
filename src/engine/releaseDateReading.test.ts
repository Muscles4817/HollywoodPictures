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
  describeCompetitor,
  describeField,
  readReleaseDate,
  seasonBandFor,
  seasonalDesirability,
} from './releaseDateReading';
import type { CrowdingContributor } from './releaseCrowding';
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

describe('describeField', () => {
  const base = { crowding: 0 };

  it('separates an empty frame from an empty map', () => {
    // Both score zero. Only one of them is good news.
    expect(describeField({ ...base, beyondKnownField: false })).toBe('Clear window');
    expect(describeField({ ...base, beyondKnownField: true })).toBe('Nothing known yet');
  });

  it('reads a surveyed, contested date by its band', () => {
    expect(describeField({ crowding: 0.6, beyondKnownField: false })).toBe('Crowded');
  });
});

describe('describeCompetitor', () => {
  const contributor = (over: Partial<CrowdingContributor> = {}): CrowdingContributor => ({
    index: 0,
    release: { releaseDay: 200, genre: 'Action', targetAudience: 'Mass Market', strength: 0.8 },
    pressure: 1, share: 1, matchup: 'outmatched', sameGenre: true, sameAudience: true, daysApart: 0,
    ...over,
  });

  it('names a rival whose campaign has begun, and says what makes it expensive', () => {
    const text = describeCompetitor(contributor(), {
      label: 'Ironbound', studioName: 'Meridian Pictures', named: true, isOwn: false,
    });
    expect(text).toContain('Ironbound (Meridian Pictures)');
    expect(text).toContain('same genre, same audience');
    expect(text).toContain('opening alongside you');
    expect(text).toContain('the stronger picture');
  });

  it('keeps an unannounced rival under wraps, describing it rather than naming it', () => {
    // The fog of war stays: title and cast are not public until the rival's
    // campaign begins, so this far out only the shape of the thing is knowable.
    const text = describeCompetitor(contributor({ daysApart: 21 }), {
      label: 'a big Sci-Fi picture', studioName: 'Meridian Pictures', named: false, isOwn: false,
    });
    expect(text).toContain('Meridian Pictures — a big Sci-Fi picture');
    expect(text).not.toContain('(');
    expect(text).toContain('about 3 weeks away');
  });

  it('calls the player\'s own collision what it is', () => {
    const text = describeCompetitor(contributor(), {
      label: 'Nightfall', studioName: 'Silver Reel', named: true, isOwn: true,
    });
    expect(text).toContain('Your own Nightfall');
    expect(text).toContain('your own two films splitting the same crowd');
  });

  it('says when a competitor is not really competing', () => {
    const text = describeCompetitor(
      contributor({ sameGenre: false, sameAudience: false, matchup: 'dominant', daysApart: 30 }),
      { label: 'Beach Day', studioName: 'Kestrel', named: true, isOwn: false },
    );
    expect(text).toContain('a different film for a different crowd');
    expect(text).toContain('the smaller picture');
  });
});
