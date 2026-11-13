// Arrivals and departures (docs/DESIGN_talent_model.md §4.4, stage 3).
//
// The talent pool used to be generated once and never change: nobody entered,
// nobody left, and after ten years it was the same people ten years older. Once
// careers began to move (engine/careerProgress.ts) that showed up as fees
// crowding toward the middle - people who worked became better known, the
// famous could only hold their place, and nobody arrived at the bottom or left
// the top.
//
// Once a year, people leave - mostly by age, some because they have not worked
// in years and nobody is asking - and the same number of newcomers arrive in
// each profession: young, cheap and unproven. The pool keeps its size.
//
// Who leaves is decided by a hash of the person and the year, and the newcomers
// are generated from a seed derived from the save's own, so none of this draws
// from the game's main random stream: adding it moved no other roll.
//
// Pure: plain data in, plain data out.
import type { Person, TalentProfession } from '../types';
import { DAYS_PER_YEAR, gameDateFromTotalDays, yearOf } from './calendar';
import { createRng, hashUnit } from './random';
import { generateNewcomer } from './talentGenerator';

// --- Tunables ---------------------------------------------------------------

/** Nobody leaves for age before this. */
export const RETIREMENT_STARTS_AT = 55;
/** The yearly chance of leaving at RETIREMENT_STARTS_AT, and at 80. It rises in a line between. */
const RETIREMENT_CHANCE_AT_START = 0.02;
const RETIREMENT_CHANCE_AT_80 = 0.25;
/** From here on most go each year, and by the last age everyone has. */
const RETIREMENT_CHANCE_OVER_80 = 0.5;
export const LAST_WORKING_AGE = 88;

/** Years without a film after which a cold career starts to end, the heat below which it counts as cold, and the yearly chance. */
const IDLE_YEARS_BEFORE_LEAVING = 6;
const COLD_HEAT = 35;
const IDLE_LEAVING_CHANCE = 0.08;

/** No profession loses more than this share of its people in one year. */
export const MAX_YEARLY_TURNOVER = 0.06;

export interface Departure {
  person: Person;
  profession: TalentProfession;
  age: number;
  reason: 'retired' | 'left the business';
}

export interface TurnoverResult {
  pool: Record<TalentProfession, Person[]>;
  arrivals: Person[];
  departures: Departure[];
}

function ageOn(person: Person, day: number): number {
  const born = person.identity.dateOfBirth;
  return born ? gameDateFromTotalDays(day).year - born.year : 40;
}

function lastWorkedDay(person: Person): number {
  return Math.max(1, ...Object.values(person.careers).map((career) => (career as { lastWorkedDay?: number } | undefined)?.lastWorkedDay ?? 1));
}

/** The chance this person leaves this year, and why they would. */
export function leavingChance(person: Person, day: number): { chance: number; reason: Departure['reason'] } {
  const age = ageOn(person, day);
  let retirement = 0;
  if (age >= LAST_WORKING_AGE) retirement = 1;
  else if (age >= 80) retirement = RETIREMENT_CHANCE_OVER_80;
  else if (age >= RETIREMENT_STARTS_AT) {
    retirement = RETIREMENT_CHANCE_AT_START + ((age - RETIREMENT_STARTS_AT) / (80 - RETIREMENT_STARTS_AT)) * (RETIREMENT_CHANCE_AT_80 - RETIREMENT_CHANCE_AT_START);
  }
  const idleYears = (day - lastWorkedDay(person)) / DAYS_PER_YEAR;
  const drifting = idleYears >= IDLE_YEARS_BEFORE_LEAVING && person.reputation.currentHeat < COLD_HEAT ? IDLE_LEAVING_CHANCE : 0;
  return retirement >= drifting ? { chance: retirement, reason: 'retired' } : { chance: drifting, reason: 'left the business' };
}

function isCommitted(person: Person, day: number): boolean {
  return person.availability.commitments.some((commitment) => commitment.endDay > day);
}

/**
 * One year's turnover. `seed` is the save's own random seed (read, not
 * advanced); `protectedIds` are people the player has attached to a film that
 * is not out yet, who must not vanish from under it.
 */
export function turnOverTalent(
  pool: Record<TalentProfession, Person[]>,
  options: { day: number; seed: number; protectedIds: ReadonlySet<string> },
): TurnoverResult {
  const { day, seed, protectedIds } = options;
  const year = yearOf(day);
  const next = { ...pool };
  const arrivals: Person[] = [];
  const departures: Departure[] = [];

  for (const profession of Object.keys(pool) as TalentProfession[]) {
    const roster = pool[profession];
    const candidates: Array<Departure & { margin: number }> = [];
    for (const person of roster) {
      if (protectedIds.has(person.id) || isCommitted(person, day)) continue;
      const { chance, reason } = leavingChance(person, day);
      if (chance <= 0) continue;
      const margin = chance - hashUnit(`${person.id}|leaves|${year}`);
      if (margin > 0) candidates.push({ person, profession, age: ageOn(person, day), reason, margin });
    }
    // If more would go than the profession can lose in a year, the surest go first.
    const leaving = candidates.sort((a, b) => b.margin - a.margin).slice(0, Math.floor(roster.length * MAX_YEARLY_TURNOVER));
    if (leaving.length === 0) continue;

    const gone = new Set(leaving.map((d) => d.person.id));
    const rng = createRng((seed ^ Math.floor(hashUnit(`arrivals|${year}|${profession}`) * 2 ** 31)) >>> 0);
    const slug = profession.toLowerCase().replace(/[^a-z]+/g, '-');
    const newcomers = leaving.map((_, i) => generateNewcomer(profession, rng, day, `talent-y${year}-${slug}-${i + 1}`));

    next[profession] = [...roster.filter((person) => !gone.has(person.id)), ...newcomers];
    arrivals.push(...newcomers);
    departures.push(...leaving.map(({ person, age, reason }) => ({ person, profession, age, reason })));
  }

  return departures.length === 0 ? { pool, arrivals, departures } : { pool: next, arrivals, departures };
}

/** Whether the calendar moved into a later year between two days - when the year's turnover happens. */
export function crossedIntoNewYear(dayBefore: number, dayAfter: number): boolean {
  return yearOf(dayAfter) > yearOf(dayBefore);
}

// --- Telling the player -----------------------------------------------------

/**
 * A stored note of one year's turnover, for the Inbox. Stored rather than
 * derived because the people who left are no longer in the pool to derive it
 * from (docs/DESIGN_notification_contract.md §2.1, the bid-notification
 * exception).
 */
export interface IndustryNotice {
  id: string;
  /** The year that has just begun. */
  year: number;
  day: number;
  arrivals: number;
  departures: number;
  /** The best-known people who left, most famous first: enough to name, not a roll call. */
  notable: Array<{ name: string; role: TalentProfession; age: number; reason: Departure['reason'] }>;
  /** People who left with whom the studio had made a film. */
  collaborators: string[];
  read: boolean;
}

const NOTABLE_FAME = 55;
const MAX_NOTABLE = 4;
/** How many years of notices are kept. */
export const MAX_INDUSTRY_NOTICES = 3;

export function buildIndustryNotice(result: TurnoverResult, day: number, collaboratorIds: ReadonlySet<string>): IndustryNotice | null {
  if (result.departures.length === 0) return null;
  const year = yearOf(day);
  const byFame = [...result.departures].sort((a, b) => b.person.reputation.fame - a.person.reputation.fame);
  return {
    id: `industry-${year}`,
    year,
    day,
    arrivals: result.arrivals.length,
    departures: result.departures.length,
    notable: byFame
      .filter((d) => d.person.reputation.fame >= NOTABLE_FAME)
      .slice(0, MAX_NOTABLE)
      .map((d) => ({ name: d.person.identity.name, role: d.profession, age: d.age, reason: d.reason })),
    collaborators: result.departures.filter((d) => collaboratorIds.has(d.person.id)).map((d) => d.person.identity.name),
    read: false,
  };
}

export function unreadIndustryNoticeCount(notices: IndustryNotice[] | undefined): number {
  return (notices ?? []).filter((notice) => !notice.read).length;
}
