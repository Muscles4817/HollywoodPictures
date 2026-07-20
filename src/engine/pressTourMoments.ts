// Press Tour Moments - pure logic (docs/DESIGN_REVIEW_marketing_campaign.md,
// "press tours" / D2, lean pass). Rolls the rare, personality-driven moment a
// tour can throw off: usually nothing, occasionally one drawn from a varied pool
// keyed to why a specific tourer is a liability (or, rarely, a standout). Takes
// an RNG - this is the surprise variance that sits on top of D1's deterministic
// Buzz. Rolled at settlement (engine/marketSettlement.ts), never in the
// projection path (engine/releaseFilm.ts stays pure), so the tour moment can
// never leak into the Marketing screen's opening forecast. Tunables + the pool
// live in data/pressTourMoments.ts.
import type { Person, PersonId, TalentAssignment } from '../types';
import type { RandomFn } from './random';
import { clamp } from './random';
import { personMediaRisk, tourers } from './pressTour';
import {
  PRESS_TOUR_BASELINE_HEAT_AT_100,
  PRESS_TOUR_BASELINE_HEAT_FLOOR,
  PRESS_TOUR_MOMENT_NEGATIVE_SCALE,
  PRESS_TOUR_MOMENT_POSITIVE_SCALE,
  PRESS_TOUR_MOMENTS,
  type MomentDriver,
  type PressTourMomentTemplate,
} from '../data/pressTourMoments';

/** A moment that actually fired for one tourer, resolved to concrete text + effects. */
export interface FiredPressTourMoment {
  personId: PersonId;
  personName: string;
  templateId: string;
  headline: string;
  story: string;
  buzzDelta: number;
  fameDelta: number;
  heatDelta: number;
  controversyDelta: number;
}

export interface PressTourMomentsOutcome {
  /** Sum of the fired moments' Buzz effects - folded into the film's Buzz at settlement. */
  buzzDelta: number;
  /** The fired moments' story sentences, joined - appended to the film's story report (null when none fired). */
  storyBeat: string | null;
  /** Every moment that fired, for surfacing and reputation write-back (D2b/D2c). */
  moments: FiredPressTourMoment[];
}

const EMPTY: PressTourMomentsOutcome = { buzzDelta: 0, storyBeat: null, moments: [] };

/** The three negative liabilities and how severe each is for this person (0 safe .. 1 maximal). */
function driverSeverities(person: Person): { driver: MomentDriver; severity: number }[] {
  const p = person.personality;
  return [
    { driver: 'controversy', severity: p.controversy / 100 },
    { driver: 'pressure', severity: 1 - p.pressureHandling / 100 },
    { driver: 'professionalism', severity: 1 - p.professionalism / 100 },
  ];
}

function fill(template: PressTourMomentTemplate, person: Person): FiredPressTourMoment {
  const name = person.identity.name;
  return {
    personId: person.id,
    personName: name,
    templateId: template.id,
    headline: template.headline.replaceAll('{name}', name),
    story: template.story.replaceAll('{name}', name),
    buzzDelta: template.buzzDelta,
    fameDelta: template.fameDelta,
    heatDelta: template.heatDelta,
    controversyDelta: template.controversyDelta,
  };
}

function pickFrom(pool: PressTourMomentTemplate[], rng: RandomFn): PressTourMomentTemplate {
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}

/** Roll the (at most one) moment a single tourer's circuit produces - usually none. */
function rollForPerson(person: Person, rng: RandomFn): FiredPressTourMoment | null {
  const worst = driverSeverities(person).reduce((a, b) => (b.severity > a.severity ? b : a));
  const negativeChance = clamp(worst.severity * PRESS_TOUR_MOMENT_NEGATIVE_SCALE, 0, 1);
  // A breakout is only really on the table for a famous, media-safe tourer.
  const positiveChance = clamp((person.reputation.fame / 100) * (1 - personMediaRisk(person)) * PRESS_TOUR_MOMENT_POSITIVE_SCALE, 0, 1);

  const roll = rng();
  if (roll < negativeChance) {
    const pool = PRESS_TOUR_MOMENTS.filter((m) => m.polarity === 'negative' && m.driver === worst.driver);
    return pool.length > 0 ? fill(pickFrom(pool, rng), person) : null;
  }
  if (roll < negativeChance + positiveChance) {
    const pool = PRESS_TOUR_MOMENTS.filter((m) => m.polarity === 'positive');
    return pool.length > 0 ? fill(pickFrom(pool, rng), person) : null;
  }
  return null;
}

/**
 * Roll every tourer's press-tour moment. Draws from `rng` once per tourer (and
 * a pick draw when one fires), so a film with no tour roster draws nothing and
 * its settlement RNG stream is untouched. Deterministic given the same rng.
 */
export function rollPressTourMoments(
  talent: TalentAssignment[],
  ids: readonly PersonId[] | undefined,
  rng: RandomFn,
): PressTourMomentsOutcome {
  const cast = tourers(talent, ids);
  if (cast.length === 0) return EMPTY;

  const moments: FiredPressTourMoment[] = [];
  for (const person of cast) {
    const fired = rollForPerson(person, rng);
    if (fired) moments.push(fired);
  }
  if (moments.length === 0) return { buzzDelta: 0, storyBeat: null, moments: [] };

  return {
    buzzDelta: moments.reduce((sum, m) => sum + m.buzzDelta, 0),
    storyBeat: moments.map((m) => m.story).join(' '),
    moments,
  };
}

/** A resolved change to one Person's standing, applied to the talent pool at settlement. */
export interface TalentReputationDelta {
  personId: PersonId;
  fameDelta: number;
  heatDelta: number;
  controversyDelta: number;
}

/** The deterministic baseline heat a tourer picks up just from the exposure - bigger names run hotter. */
function baselineHeat(person: Person): number {
  return PRESS_TOUR_BASELINE_HEAT_FLOOR + (person.reputation.fame / 100) * (PRESS_TOUR_BASELINE_HEAT_AT_100 - PRESS_TOUR_BASELINE_HEAT_FLOOR);
}

/**
 * The post-tour standing changes for every tourer: a deterministic baseline heat
 * bump from the exposure (applies even to a quiet tour), plus any fired moment's
 * fame/heat/controversy effect on that person. One entry per tourer, keyed by
 * id, for the pool write-back at settlement (state/studioReducer.ts). Empty when
 * nobody toured.
 */
export function pressTourReputationDeltas(
  talent: TalentAssignment[],
  ids: readonly PersonId[] | undefined,
  moments: FiredPressTourMoment[],
): TalentReputationDelta[] {
  const byPerson = new Map(moments.map((m) => [m.personId, m]));
  return tourers(talent, ids).map((person) => {
    const moment = byPerson.get(person.id);
    return {
      personId: person.id,
      fameDelta: moment?.fameDelta ?? 0,
      heatDelta: baselineHeat(person) + (moment?.heatDelta ?? 0),
      controversyDelta: moment?.controversyDelta ?? 0,
    };
  });
}
