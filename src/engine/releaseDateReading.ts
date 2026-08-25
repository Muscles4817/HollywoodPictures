// What a candidate release date actually means for THIS film - the four things
// that should decide the choice, named and read the same way on every screen
// that offers a date.
//
// Before this module the announcement card offered eighteen months and told the
// player one thing about them (how crowded they were). So a studio could claim a
// date two months out for a film that had not begun pre-production, and nothing
// on the screen said a word about it - not that the film could not exist by
// then, not that the campaign would have no runway, not that the month was a
// dead season for the genre. The decision was real; the information was not.
//
// Every reading here is derived from the system that actually applies it at
// settlement - engine/production.ts for delivery, data/release.ts for the
// seasonal multipliers, engine/marketing.ts for campaign momentum,
// engine/releaseCrowding.ts for the field - so a date can never look better
// here than it turns out to be. Nothing in this file is a new rule; it is the
// existing rules, made legible at the moment of choosing.
//
// Presentation is qualitative by house rule (CLAUDE.md): bands and prose, never
// the multipliers themselves. Days and dates are business facts and stay exact.
import type { GameDay, Genre, ReleaseWindow } from '../types';
import { deriveReleaseWindowFromDay } from './calendar';
import { RELEASE_WINDOW_BASE_MULTIPLIER, RELEASE_WINDOW_GENRE_BONUS } from '../data/release';
import { CAMPAIGN_FULL_ROLLOUT_WEEKS } from '../data/marketing';
import { campaignRolloutWeeks } from './marketing';
import type { DeliveryEstimate } from './deliveryEstimate';
import { computeCompetitiveCrowding, crowdingBandKey, type CrowdingBand, type UpcomingRelease } from './releaseCrowding';

// --- Season -----------------------------------------------------------------

/**
 * A day's seasonal box-office desirability for a genre - the window's own
 * baseline crowd times whatever bonus it grants that genre.
 *
 * The single formula, shared: engine/rivalStudios.ts scores its own release-day
 * choice with this, so the seasons the AI chases are exactly the ones the
 * player's screen recommends, and both are the multipliers the box office
 * itself applies (data/release.ts).
 */
export function seasonalDesirability(day: GameDay, genre: Genre): number {
  const window = deriveReleaseWindowFromDay(day);
  return RELEASE_WINDOW_BASE_MULTIPLIER[window] * (RELEASE_WINDOW_GENRE_BONUS[window][genre] ?? 1);
}

export type SeasonBand = 'weak' | 'ordinary' | 'strong' | 'prime';

// The bands split the reachable range (0.85 for a quiet month up to ~1.52 for
// Horror at Halloween) where the reasons change, not at even intervals: below
// the neutral 1.0 the season is actively costing you, and above ~1.3 only a
// genre-matched holiday frame can reach.
const ORDINARY_AT = 0.95;
const STRONG_AT = 1.1;
const PRIME_AT = 1.3;

export function seasonBandFor(day: GameDay, genre: Genre): SeasonBand {
  const desirability = seasonalDesirability(day, genre);
  if (desirability < ORDINARY_AT) return 'weak';
  if (desirability < STRONG_AT) return 'ordinary';
  if (desirability < PRIME_AT) return 'strong';
  return 'prime';
}

const SEASON_BAND_LABELS: Record<SeasonBand, string> = {
  weak: 'Dead season',
  ordinary: 'Ordinary season',
  strong: 'Strong season',
  prime: 'Prime season',
};

export function describeSeasonBand(band: SeasonBand): string {
  return SEASON_BAND_LABELS[band];
}

/** The named cause behind the band - which window it is, and whether it favours this genre in particular. */
export function describeSeason(day: GameDay, genre: Genre): string {
  const window: ReleaseWindow = deriveReleaseWindowFromDay(day);
  const bonus = RELEASE_WINDOW_GENRE_BONUS[window][genre];
  if (bonus && bonus > 1) return `${window} — and a ${window} crowd turns out for ${genre}`;
  if (window === 'Quiet Month') return 'A quiet month — no holiday crowd, and nothing the season favours';
  return `${window} — a holiday crowd, though not one that favours ${genre} particularly`;
}

// --- Campaign runway --------------------------------------------------------

export type CampaignRunwayBand = 'none' | 'rushed' | 'building' | 'full';

/**
 * How much runway a campaign gets between the film being ready to promote and
 * the day it opens. The thresholds are the shape of rolloutMomentum's own curve
 * (engine/marketing.ts): concave, so the first weeks buy the most, flat once a
 * full rollout is reached.
 */
export function campaignRunwayBand(readyOnDay: GameDay, releaseDay: GameDay): CampaignRunwayBand {
  const weeks = campaignRolloutWeeks(readyOnDay, releaseDay);
  if (weeks <= 0) return 'none';
  if (weeks < CAMPAIGN_FULL_ROLLOUT_WEEKS / 2) return 'rushed';
  if (weeks < CAMPAIGN_FULL_ROLLOUT_WEEKS) return 'building';
  return 'full';
}

const RUNWAY_BAND_LABELS: Record<CampaignRunwayBand, string> = {
  none: 'No campaign runway',
  rushed: 'Rushed campaign',
  building: 'Campaign still building',
  full: 'Full campaign rollout',
};

export function describeCampaignRunwayBand(band: CampaignRunwayBand): string {
  return RUNWAY_BAND_LABELS[band];
}

/** The first day a release could open on without shortening its own campaign - the film ready, plus a full rollout. */
export function earliestUnrushedDay(readyOnDay: GameDay): GameDay {
  return readyOnDay + CAMPAIGN_FULL_ROLLOUT_WEEKS * 7;
}

// --- The whole reading ------------------------------------------------------

/** Can the film physically exist by this date, and with how much room to spare? */
export type DeliveryVerdict = 'impossible' | 'no-margin' | 'tight' | 'comfortable';

/**
 * Below this many days of margin a single bad week of shooting takes the date
 * away; below the second, there is effectively no absorption at all. Matched to
 * engine/deliveryEstimate.ts's own ladder so the announcement card and the
 * rewrite panel never call the same margin two different things.
 */
const TIGHT_MARGIN_DAYS = 45;
const NO_MARGIN_DAYS = 14;

export function deliveryVerdictFor(estimate: DeliveryEstimate, releaseDay: GameDay): DeliveryVerdict {
  const margin = releaseDay - estimate.readyOnDay;
  if (margin < 0) return 'impossible';
  if (margin < NO_MARGIN_DAYS) return 'no-margin';
  if (margin < TIGHT_MARGIN_DAYS) return 'tight';
  return 'comfortable';
}

const DELIVERY_VERDICT_LABELS: Record<DeliveryVerdict, string> = {
  impossible: 'Film not finished by then',
  'no-margin': 'No room for a single delay',
  tight: 'Tight against the date',
  comfortable: 'Comfortable',
};

export function describeDeliveryVerdict(verdict: DeliveryVerdict): string {
  return DELIVERY_VERDICT_LABELS[verdict];
}

export interface ReleaseDateReading {
  day: GameDay;
  window: ReleaseWindow;
  /** Whether the film can be finished by then, and how much slack is left over. */
  delivery: DeliveryVerdict;
  /** How much runway the campaign gets, measured from the day the film is ready to promote. */
  runway: CampaignRunwayBand;
  season: SeasonBand;
  crowdingBand: CrowdingBand;
  /** The raw crowding score, for a caller that needs to rank days rather than label one. */
  crowding: number;
}

/**
 * Read one candidate date across all four axes at once.
 *
 * `estimate` is passed in rather than recomputed per day: it does not depend on
 * the candidate date, and an eighteen-month grid would otherwise run the whole
 * production projection eighteen times for the same answer.
 */
export function readReleaseDate(
  day: GameDay,
  estimate: DeliveryEstimate,
  genre: Genre,
  candidate: Omit<UpcomingRelease, 'strength' | 'releaseDay'>,
  known: UpcomingRelease[],
  candidateStrength?: number,
): ReleaseDateReading {
  const crowding = computeCompetitiveCrowding({ releaseDay: day, ...candidate }, known, candidateStrength);
  return {
    day,
    window: deriveReleaseWindowFromDay(day),
    delivery: deliveryVerdictFor(estimate, day),
    // Runway is measured from the day the film is READY, not from today: a
    // campaign cannot start promoting a film that does not exist yet, which is
    // exactly why claiming a near date costs twice - the film is not done, and
    // the campaign it does get is a rush.
    runway: campaignRunwayBand(estimate.readyOnDay, day),
    season: seasonBandFor(day, genre),
    crowdingBand: crowdingBandKey(crowding),
    crowding,
  };
}

/**
 * The single sentence that best explains why this date is a problem, or null
 * when nothing about it is. Ordered by what would actually sink the release:
 * a film that does not exist beats a rushed campaign beats a dead season.
 */
export function describeReleaseDateConcern(reading: ReleaseDateReading, genre: Genre): string | null {
  if (reading.delivery === 'impossible') {
    return 'The film will not be finished by this date. Announcing it anyway means moving later and writing off whatever campaign is committed against it — or opening a film that is not done.';
  }
  if (reading.delivery === 'no-margin') {
    return 'The film only just makes this date. One bad week of shooting and it does not.';
  }
  if (reading.runway === 'none' || reading.runway === 'rushed') {
    return 'The campaign gets almost no runway before this date — the film opens on its baseline reach with none of the momentum a rollout builds.';
  }
  if (reading.crowdingBand === 'high') {
    return 'This date is contested. Films close to it are chasing the same audience, and this one is not the strongest of them.';
  }
  if (reading.season === 'weak') {
    return `A dead season for ${genre} — no holiday crowd, and nothing the window favours.`;
  }
  return null;
}
