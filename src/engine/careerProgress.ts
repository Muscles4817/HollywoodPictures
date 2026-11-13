// How careers move (docs/DESIGN_talent_model.md §4.3-4.4, stage 2).
//
// Until this existed a person's standing was fixed the day the world was
// generated: nobody got hotter for a hit, colder for a bomb, or dearer for
// either. This updates everyone credited on a film when its run ends, eases
// heat back toward normal between films, and moves each person's quote with
// their standing.
//
// What moves, and on what:
//  - Heat follows how the film did commercially, weighted by how much the film
//    was that person's (the lead and the director carry it; the editor does
//    not) and, for actors, by their own notices. A miss is cushioned by the
//    standing the person has built - an established name absorbs a bomb or two;
//    someone with one hit behind them does not. "A flop does not end a career;
//    a flop that is attributed to you starts the chain" (docs/domain/12 §4.4).
//  - Fame follows how many people saw the film. It does not fall for a bomb: a
//    faded star is still famous, just no longer expensive.
//  - Industry respect follows the reviews.
//  - The quote follows standing, and ratchets: up at once, down slowly
//    (docs/domain/12 §2.3).
//
// Ability does not move here. Skill is still what generation set it to; this
// stage is about price and reputation only.
//
// Pure: plain data in, plain data out. No rng - a career moves on what
// happened, not on a roll.
import type { AwardsCeremony, Film, Person, ProductionRole, TalentProfession } from '../types';
import { readCastPerformances, type PerformanceBand } from './castPerformance';
import { experienceFromYears } from './careerHistory';
import { DAYS_PER_YEAR } from './calendar';
import { professionForProductionRole } from '../data/helpers';
import { CREW_CAREER_KEY } from './person';
import { ROLE_GENERATION_PROFILES } from '../data/talentGeneration';

// --- Tunables ---------------------------------------------------------------

/** How much of a film's commercial result lands on each role: who the film was sold on. */
const BLAME_BY_ROLE: Record<ProductionRole, number> = {
  'Lead Actor': 1,
  Director: 0.9,
  'Supporting Actor': 0.35,
  Writer: 0.3,
  Cinematographer: 0.2,
  Composer: 0.2,
  Editor: 0.15,
  'VFX Supervisor': 0.15,
  'Production Designer': 0.15,
  'Casting Director': 0.1,
};

/** How much being in a widely seen film makes each role known to the public. */
const PUBLIC_BY_ROLE: Record<ProductionRole, number> = {
  'Lead Actor': 1,
  Director: 0.9,
  'Supporting Actor': 0.25,
  Writer: 0.1,
  Composer: 0.1,
  Cinematographer: 0.03,
  Editor: 0.03,
  'VFX Supervisor': 0.03,
  'Production Designer': 0.03,
  'Casting Director': 0.02,
};

/** How much a film's reviews reflect on each role in the eyes of colleagues. */
const RESPECT_BY_ROLE: Record<ProductionRole, number> = {
  Director: 1,
  Writer: 0.9,
  Cinematographer: 0.8,
  Composer: 0.8,
  Editor: 0.8,
  'VFX Supervisor': 0.8,
  'Production Designer': 0.8,
  'Casting Director': 0.6,
  'Lead Actor': 0.6,
  'Supporting Actor': 0.5,
};

/** Heat points a full hit (or full bomb) moves the person the film was built around. */
export const HEAT_SWING = 22;
/** Fame points a widely seen film can add to an unknown lead. */
export const FAME_GAIN = 5;
/** Industry-respect points a rave (or a pan) moves a director. */
export const RESPECT_SWING = 5;

/** The gross at which a film has been seen widely enough to count in full for the people in it. */
export const CAREER_FULL_VISIBILITY_GROSS = 60_000_000;
/** Extra fame, as a share of the base gain, for each doubling of gross past full visibility. */
export const PHENOMENON_BOOST_PER_DOUBLING = 0.6;
/** Profit ratio at which a film is as much of a hit as it can be for its people; and loss ratio at which it is a full bomb. */
const FULL_HIT_RATIO = 1.25;
const FULL_BOMB_RATIO = 0.6;
/** How much an actor's own notices count next to how the film did. The film is the main thing. */
const NOTICE_WEIGHT = 0.25;
/** The most of a miss an established name can shrug off. */
const MAX_CUSHION = 0.75;

/** Share of the gap between heat and its resting level closed each quarter: about half gone in a year. */
export const HEAT_FADE_PER_QUARTER = 0.16;
/** How often standing eases back, in days. */
export const STANDING_FADE_INTERVAL_DAYS = 91;
/**
 * The public forgets, slowly: the share of fame everyone loses each quarter
 * (a little over 1% a year). Someone working in films people see gains more
 * than this; someone who has stopped fades over decades, not years. It is what
 * keeps the pool's fame, and so its fees, from only ever going up.
 */
export const FAME_DECAY_PER_QUARTER = 0.003;

/**
 * Quotes go up easily and come down slowly (docs/domain/12 §2.3). When standing
 * falls, this share of the gap between the quote and what standing now implies
 * is closed: at the moment of a bad result, and then each quarter after.
 */
export const QUOTE_FALL_ON_RESULT = 0.3;
export const QUOTE_FALL_PER_QUARTER = 0.12;
/** A quote never leaves this multiple of the role's generated fee range. */
const QUOTE_RANGE_SLACK = 1.5;

const NOTICE_BY_BAND: Record<PerformanceBand, number> = { inspired: 1, strong: 0.5, solid: 0, weak: -0.5, poor: -1 };

/** Awards move standing too: what a nomination and a win are worth, before the category's weight. */
const AWARD_HEAT: Record<'nomination' | 'win', number> = { nomination: 3, win: 8 };
const AWARD_RESPECT: Record<'nomination' | 'win', number> = { nomination: 2, win: 5 };

// --- Reading a film ---------------------------------------------------------

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Math.round(value * 10) / 10;

/** -1 (a full bomb) .. +1 (a full hit): how the film did against what it cost, in cinemas. */
export function commercialScore(film: Film): number {
  const { profit, totalCost } = film.results;
  if (profit === null || totalCost <= 0) return 0;
  const ratio = profit / totalCost;
  return ratio >= 0 ? Math.min(1, ratio / FULL_HIT_RATIO) : Math.max(-1, ratio / FULL_BOMB_RATIO);
}

/**
 * How much more a phenomenon does for the people in it than a film that was
 * merely widely seen: 1 up to full visibility, rising with each doubling of the
 * gross beyond it. This is what makes a star - the lead of a film everybody saw
 * is known to everybody - and with people retiring from the top of the pool
 * every year (engine/careerTurnover.ts) it is what refills it.
 */
export function phenomenonBoost(film: Film): number {
  const multiple = (film.results.totalBoxOffice ?? 0) / CAREER_FULL_VISIBILITY_GROSS;
  return multiple <= 1 ? 1 : 1 + PHENOMENON_BOOST_PER_DOUBLING * Math.log2(multiple);
}

/** 0.05..1: how widely the film was seen. */
export function careerVisibility(film: Film): number {
  return clamp((film.results.totalBoxOffice ?? 0) / CAREER_FULL_VISIBILITY_GROSS, 0.05, 1);
}

/**
 * 0..0.75: how much of a miss this person's standing absorbs. Built from fame
 * and years in the job, and worn down as heat sinks below fame - which is what
 * makes it take a run of bombs, not one, to bring an established name down.
 */
export function missCushion(person: Person, experience: number): number {
  const { fame, currentHeat } = person.reputation;
  const standing = clamp((0.5 * fame + 0.5 * experience - 40) / 50, 0, MAX_CUSHION);
  return standing * clamp(currentHeat / Math.max(40, fame), 0.25, 1);
}

export interface StandingDelta {
  heat: number;
  fame: number;
  respect: number;
}

/**
 * What a finished film does to the standing of one person credited on it.
 * `notice` is -1..1 for an actor's own reviews, 0 for everyone else.
 */
export function standingDeltaFor(person: Person, role: ProductionRole, experience: number, film: Film, notice: number): StandingDelta {
  const commercial = commercialScore(film);
  const seen = careerVisibility(film);
  const { fame, industryRespect } = person.reputation;

  // A bomb is noticed inside the industry even when the public never saw it, so
  // visibility softens heat less than it does fame.
  const felt = 0.3 + 0.7 * seen;
  let heat = HEAT_SWING * BLAME_BY_ROLE[role] * felt * ((1 - NOTICE_WEIGHT) * commercial + NOTICE_WEIGHT * notice);
  if (heat < 0) heat *= 1 - missCushion(person, experience);

  // Fame only rises: being seen makes you known, and a hit more so.
  const fameGain =
    // Harder to add to the more famous you already are, but not so hard that a
    // working star cannot hold their place against the public's forgetting.
    // Only the people a film is sold on are made by its being a phenomenon.
    FAME_GAIN * PUBLIC_BY_ROLE[role] * seen * (role === 'Lead Actor' || role === 'Director' ? phenomenonBoost(film) : 1) * (1 - (fame / 100) ** 2) * (0.5 + 0.5 * Math.max(0, commercial)) +
    Math.max(0, notice) * 1.5 * PUBLIC_BY_ROLE[role] * seen;

  const reviews = clamp((film.results.criticScore - 55) / 40, -1, 1);
  const respect = RESPECT_SWING * RESPECT_BY_ROLE[role] * (reviews >= 0 ? reviews * (1 - industryRespect / 100) : reviews * 0.6);

  return { heat, fame: fameGain, respect };
}

// --- The quote --------------------------------------------------------------

/** What the market reads when it prices someone: the public's view for those it knows, colleagues' for the crafts. */
export function marketValue(person: Person, profession: TalentProfession): number {
  const { fame, currentHeat, industryRespect } = person.reputation;
  return profession === 'Actor' || profession === 'Director'
    ? 0.6 * fame + 0.4 * currentHeat
    : 0.45 * industryRespect + 0.35 * currentHeat + 0.2 * fame;
}

/**
 * What standing says someone should be asking, read against the quote and the
 * standing they had when they were last priced (the anchor). Scaled so that a
 * point of standing is worth what it was worth when the pool was generated: a
 * role's whole fee range spans a hundred points. Symmetric: the same standing
 * always implies the same quote, however it was reached.
 */
export function impliedQuote(profession: TalentProfession, anchor: { salary: number; value: number }, valueNow: number): number {
  const { min, max } = ROLE_GENERATION_PROFILES[profession].salaryRange;
  const implied = anchor.salary * Math.exp((Math.log(max / min) / 100) * (valueNow - anchor.value));
  return clamp(implied, min / QUOTE_RANGE_SLACK, max * QUOTE_RANGE_SLACK);
}

/**
 * Move a quote toward what standing implies. Up at once; down by only part of
 * the gap each time, so a fall takes years to work through but does complete.
 *
 * An earlier version passed on a fixed share of every fall and all of every
 * rise, measured step by step. That is a ratchet with no way back down, and it
 * inflated the whole pool: the median actor's fee more than tripled in ten
 * years on nothing but the ordinary ups and downs of heat. Reading the quote
 * against an anchor instead means the long run follows standing exactly, and
 * only the *speed* differs by direction.
 */
export function nextQuote(current: number, implied: number, fallRate: number): number {
  if (implied >= current) return implied;
  return current * Math.pow(implied / current, fallRate);
}

function requote(person: Person, before: Person, fallRate: number): Person {
  let changed = false;
  const careers = Object.fromEntries(
    Object.entries(person.careers).map(([key, career]) => {
      const c = career as { role: TalentProfession; typicalSalary?: number; minimumSalary?: number; quoteAnchor?: { salary: number; value: number } } | undefined;
      if (!c || c.typicalSalary === undefined || !ROLE_GENERATION_PROFILES[c.role]) return [key, career];
      // The first time someone is repriced, their generated quote and the
      // standing they had then become the anchor everything later is read from.
      const anchor = c.quoteAnchor ?? { salary: c.typicalSalary, value: marketValue(before, c.role) };
      const target = nextQuote(c.typicalSalary, impliedQuote(c.role, anchor, marketValue(person, c.role)), fallRate);
      const typicalSalary = Math.max(1000, Math.round(target / 1000) * 1000);
      if (typicalSalary === c.typicalSalary && c.quoteAnchor) return [key, career];
      changed = true;
      const minimumSalary = Math.min(typicalSalary, Math.round(((c.minimumSalary ?? c.typicalSalary) * typicalSalary) / c.typicalSalary / 1000) * 1000);
      return [key, { ...career, typicalSalary, minimumSalary, quoteAnchor: anchor }];
    }),
  ) as Person['careers'];
  return changed ? { ...person, careers } : person;
}

function withStanding(person: Person, delta: StandingDelta, fallRate: number): Person {
  const r = person.reputation;
  const next = {
    ...r,
    fame: round1(clamp(r.fame + delta.fame, 0, 100)),
    currentHeat: round1(clamp(r.currentHeat + delta.heat, 0, 100)),
    industryRespect: round1(clamp(r.industryRespect + delta.respect, 0, 100)),
  };
  if (next.fame === r.fame && next.currentHeat === r.currentHeat && next.industryRespect === r.industryRespect) return person;
  return requote({ ...person, reputation: next }, person, fallRate);
}

// --- Applying it to the pool -------------------------------------------------

type TalentPool = Record<TalentProfession, Person[]>;

/** Replace the people an update touched, leaving every other person - and every untouched roster - the same object. */
function mapPool(pool: TalentPool, update: (person: Person) => Person): TalentPool {
  let poolChanged = false;
  const next = { ...pool };
  for (const profession of Object.keys(pool) as TalentProfession[]) {
    let rosterChanged = false;
    const roster = pool[profession].map((person) => {
      const updated = update(person);
      if (updated !== person) rosterChanged = true;
      return updated;
    });
    if (rosterChanged) {
      next[profession] = roster;
      poolChanged = true;
    }
  }
  return poolChanged ? next : pool;
}

/**
 * Update everyone credited on films whose runs have just ended: standing, the
 * quote that follows from it, and the credit itself (a year's more experience,
 * and the day they last worked).
 */
export function applyFilmResultsToCareers(pool: TalentPool, finishedFilms: Film[], day: number): TalentPool {
  if (finishedFilms.length === 0) return pool;

  const deltas = new Map<string, StandingDelta>();
  const worked = new Set<string>();
  const byId = new Map<string, Person>();
  for (const roster of Object.values(pool)) for (const person of roster) byId.set(person.id, person);

  for (const film of finishedFilms) {
    const notices = new Map(readCastPerformances(film.talent, film.script).map((read) => [read.personId, NOTICE_BY_BAND[read.band]]));
    for (const assignment of film.talent) {
      // The pool's person, not the film's snapshot: standing may have moved since they were cast.
      const person = byId.get(assignment.person.id);
      if (!person) continue;
      worked.add(person.id);
      const career = person.careers[careerKeyFor(assignment.role)] as { experience?: number } | undefined;
      const delta = standingDeltaFor(person, assignment.role, career?.experience ?? 0, film, notices.get(person.id) ?? 0);
      const sum = deltas.get(person.id) ?? { heat: 0, fame: 0, respect: 0 };
      deltas.set(person.id, { heat: sum.heat + delta.heat, fame: sum.fame + delta.fame, respect: sum.respect + delta.respect });
    }
  }

  return mapPool(pool, (person) => {
    if (!worked.has(person.id)) return person;
    return withCredit(withStanding(person, deltas.get(person.id)!, QUOTE_FALL_ON_RESULT), day);
  });
}

function careerKeyFor(role: ProductionRole): keyof Person['careers'] {
  const profession = professionForProductionRole(role);
  if (profession === 'Actor') return 'actor';
  if (profession === 'Director') return 'director';
  if (profession === 'Writer') return 'writer';
  return CREW_CAREER_KEY[profession] as keyof Person['careers'];
}

/** Stamp the day worked, and bring experience up to date with the years the career has now run. */
function withCredit(person: Person, day: number): Person {
  const careers = Object.fromEntries(
    Object.entries(person.careers).map(([key, career]) => {
      const c = career as { careerStartDay?: number; experience?: number } | undefined;
      if (!c) return [key, career];
      const experience = c.careerStartDay === undefined ? c.experience : experienceFromYears((day - c.careerStartDay) / DAYS_PER_YEAR);
      return [key, { ...career, lastWorkedDay: day, experience }];
    }),
  ) as Person['careers'];
  return { ...person, careers };
}

/**
 * Between films, heat eases back toward the person's fame and fame itself
 * slips a little. Run once a quarter.
 */
export function fadeStanding(pool: TalentPool): TalentPool {
  return mapPool(pool, (person) => {
    const { fame, currentHeat } = person.reputation;
    const heatStep = (fame - currentHeat) * HEAT_FADE_PER_QUARTER;
    const fameStep = -fame * FAME_DECAY_PER_QUARTER;
    const moved = withStanding(person, { heat: Math.abs(heatStep) < 0.25 ? 0 : heatStep, fame: fameStep, respect: 0 }, QUOTE_FALL_PER_QUARTER);
    // Someone whose standing has settled may still be asking more than it
    // supports: keep easing the quote down until it gets there.
    return moved === person ? requote(person, person, QUOTE_FALL_PER_QUARTER) : moved;
  });
}

/** Whether the calendar crossed a quarter boundary between two days - when standing eases. */
export function crossedStandingFade(dayBefore: number, dayAfter: number): boolean {
  return Math.floor(dayAfter / STANDING_FADE_INTERVAL_DAYS) > Math.floor(dayBefore / STANDING_FADE_INTERVAL_DAYS);
}

/** A nomination or a win is noticed: heat and the respect of colleagues, for the person named. */
export function applyAwardsToCareers(pool: TalentPool, ceremonies: AwardsCeremony[], categoryWeight: (category: string) => number): TalentPool {
  const deltas = new Map<string, StandingDelta>();
  for (const ceremony of ceremonies) {
    for (const [category, nominations] of Object.entries(ceremony.categories)) {
      for (const nomination of nominations ?? []) {
        if (!nomination.personId) continue;
        const kind = nomination.won ? 'win' : 'nomination';
        const weight = categoryWeight(category);
        const sum = deltas.get(nomination.personId) ?? { heat: 0, fame: 0, respect: 0 };
        deltas.set(nomination.personId, { heat: sum.heat + AWARD_HEAT[kind] * weight, fame: sum.fame, respect: sum.respect + AWARD_RESPECT[kind] * weight });
      }
    }
  }
  if (deltas.size === 0) return pool;
  return mapPool(pool, (person) => {
    const delta = deltas.get(person.id);
    return delta ? withStanding(person, delta, QUOTE_FALL_ON_RESULT) : person;
  });
}
