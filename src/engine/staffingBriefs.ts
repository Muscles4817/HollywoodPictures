// Delegated Staffing (docs/DESIGN_REVIEW_delegated_staffing.md) - handing one
// crew slot to an attached Line Producer, who searches for real calendar days
// and comes back with ONE name to accept or veto.
//
// Pure, like the rest of engine/: plain data in, plain data out, no React, no
// hidden state. Every number lives in data/producers.ts. The design rule this
// module exists to enforce is that delegation is a TRADE, never a shortcut -
// so read the two places where that is deliberately paid for:
//   - `producerCandidatePick` weights VALUE over department FIT, so delegating
//     a demanding department is a real gamble (and the board already shows you
//     which departments are demanding, before you delegate);
//   - `canDelegateRole` enforces MAX_BRIEFS_PER_ROLE, so vetoing is never a
//     free reroll.
import type {
  Film,
  FilmDraft,
  GameDay,
  Genre,
  Money,
  Person,
  PersonId,
  ProducerCareer,
  ProducerStableEntry,
  ProductionRole,
  StaffingBrief,
  Studio,
  TalentProfession,
} from '../types';
import {
  BRIEF_AFFINITY_SKILL_BONUS,
  BRIEF_BASE_DAYS,
  BRIEF_BASE_DAYS_FALLBACK,
  BRIEF_CANDIDATE_SLICE,
  BRIEF_ESTIMATE_OPTIMISM,
  BRIEF_FEE_DISCOUNT_BY_SKILL,
  BRIEF_FIT_WEIGHT,
  BRIEF_HONEST_READ_SKILL,
  BRIEF_PRICE_PENALTY,
  BRIEF_STABLE_SCORE_BONUS,
  BRIEF_MAX_OVERRUN,
  BRIEF_SPEED_BY_SKILL,
  BRIEF_VALUE_WEIGHT,
  DELEGABLE_CREW_ROLES,
  MAX_BRIEFS_PER_ROLE,
} from '../data/producers';
import { professionForProductionRole } from '../data/helpers';
import { getProducerCareer, isOfficeUnlocked } from './producers';
import { availableCandidatesForRole, getCrewCareer, getTypicalSalaryForRole } from './person';
import { crewSpecialtyCapability, describeStandoutSpecialty, isSpecialtyDepartment, specialtyDepartmentForRole, specialtyWeightedCapability } from './crewSpecialty';
import { deriveDepartmentWorkloadsForScript } from './departmentWorkload';
import { deriveDefaultStrategy } from './executionStrategy';
import { describeStableBond, producerStable, stableFeeMultiplier, stableStrength } from './producerStables';
import type { RandomFn } from './random';
import { clamp, randInt } from './random';
import { logT, type Range } from './interpolate';
import { ROLE_GENERATION_PROFILES } from '../data/talentGeneration';

type TalentPool = Record<TalentProfession, Person[]>;

function lerp(range: Range, t: number): number {
  return range.min + (range.max - range.min) * t;
}

export function isDelegableRole(role: ProductionRole): boolean {
  return DELEGABLE_CREW_ROLES.includes(role);
}

// --- Brief bookkeeping -----------------------------------------------------

export function draftBriefs(draft: FilmDraft): StaffingBrief[] {
  return draft.staffingBriefs ?? [];
}

export function briefsForRole(draft: FilmDraft, role: ProductionRole): StaffingBrief[] {
  return draftBriefs(draft).filter((b) => b.role === role);
}

/** The brief currently out or awaiting the player's answer on this role, if any. */
export function liveBriefForRole(draft: FilmDraft, role: ProductionRole): StaffingBrief | null {
  return briefsForRole(draft, role).find((b) => b.status === 'out' || b.status === 'returned') ?? null;
}

/** Every brief awaiting an accept/veto, across the whole draft. */
export function returnedBriefs(draft: FilmDraft): StaffingBrief[] {
  return draftBriefs(draft).filter((b) => b.status === 'returned');
}

/**
 * How many briefs this producer has left on this role for this film. EVERY
 * issued brief counts, including one the player withdrew - otherwise
 * withdraw-and-reissue is the same free reroll the cap exists to close.
 */
export function briefsRemainingForRole(draft: FilmDraft, role: ProductionRole): number {
  return Math.max(0, MAX_BRIEFS_PER_ROLE - briefsForRole(draft, role).length);
}

/** The bench producers attached to this draft who can take a crew brief - Line only, in this phase. */
export function eligibleBriefProducers(draft: FilmDraft, producerPool: Person[]): Person[] {
  const attached = new Set(draft.attachedProducerIds ?? []);
  return producerPool.filter((p) => attached.has(p.id) && getProducerCareer(p)?.specialty === 'Line');
}

/**
 * Whether this role can be handed to this producer right now. Deliberately one
 * predicate for the UI and the reducer, so the button and the guard can never
 * disagree about what is legal.
 */
export function canDelegateRole(
  draft: FilmDraft,
  studio: Studio,
  producerPool: Person[],
  role: ProductionRole,
  producerId: PersonId,
): boolean {
  if (!isOfficeUnlocked(studio)) return false;
  if (!isDelegableRole(role)) return false;
  if (draft.talent.some((a) => a.role === role)) return false; // already filled
  if (liveBriefForRole(draft, role)) return false;
  if (briefsRemainingForRole(draft, role) <= 0) return false;
  return eligibleBriefProducers(draft, producerPool).some((p) => p.id === producerId);
}

// --- The producer's own reading of a brief ---------------------------------

/**
 * Effective skill for everything in this module: their raw skill, amplified
 * (never penalised) when the film's genre is one they know. Same amplify-only
 * rule producer effects already follow.
 */
function effectiveSkill(career: ProducerCareer, genre: Genre | null): number {
  const affinity = genre != null && career.genreAffinity.includes(genre) ? BRIEF_AFFINITY_SKILL_BONUS : 0;
  return clamp(career.skill + affinity, 1, 100);
}

function baseDaysFor(role: ProductionRole): number {
  return BRIEF_BASE_DAYS[role] ?? BRIEF_BASE_DAYS_FALLBACK;
}

/** The candidates a brief could return: right career, free today, not already on this film. */
export function eligibleBriefCandidates(
  draft: FilmDraft,
  talentPool: TalentPool,
  role: ProductionRole,
  today: GameDay,
): Person[] {
  const alreadyOn = new Set(draft.talent.map((a) => a.person.id));
  const pool = talentPool[professionForProductionRole(role)] ?? [];
  return availableCandidatesForRole(pool, role, today).filter((p) => !alreadyOn.has(p.id));
}

export type BriefReadBand = 'nobody' | 'thin' | 'solid' | 'generous';

export interface BriefQuote {
  /** What the producer tells the player it will take. Their belief, not the truth. */
  estimatedDays: number;
  /** How the allocation reads against the market, as they see it. */
  band: BriefReadBand;
  /** One line in their voice, for the confirm panel. */
  read: string;
  /** The cheapest fee that would buy anybody at all, for the 'nobody' line. */
  floorFee: Money;
}

const BAND_ORDER: BriefReadBand[] = ['nobody', 'thin', 'solid', 'generous'];

function bandForShare(share: number, anyAffordable: boolean): BriefReadBand {
  if (!anyAffordable) return 'nobody';
  if (share < 0.15) return 'thin';
  if (share < 0.5) return 'solid';
  return 'generous';
}

function readLine(band: BriefReadBand, role: ProductionRole, floorFee: Money): string {
  const money = (n: Money) => `£${Math.round(n / 1000).toLocaleString()}k`;
  switch (band) {
    case 'nobody':
      return `Nobody works for that. The cheapest ${role.toLowerCase()} I'd put on this is about ${money(floorFee)}.`;
    case 'thin':
      return `That's thin. I'll find you someone who can hold the department, but don't expect a name.`;
    case 'solid':
      return `That'll get you someone solid. I'll try to come in under it.`;
    case 'generous':
      return `For that I can get you a real name — and I'd still expect change.`;
  }
}

/**
 * What the producer says when you show them the allocation, BEFORE you commit:
 * how long they think it'll take and what they think it'll buy. Deterministic
 * (no rng) so the confirm panel can render it live. Both halves are skill-gated
 * - a mediocre producer quotes a rosier band and a shorter search than the pool
 * actually supports, which is the honest in-fiction version of a difficulty
 * warning rather than a hidden trap.
 */
export function quoteBrief(
  producer: Person,
  role: ProductionRole,
  allocation: Money,
  draft: FilmDraft,
  talentPool: TalentPool,
  today: GameDay,
): BriefQuote {
  const career = getProducerCareer(producer);
  const genre = draft.genre;
  const skill = career ? effectiveSkill(career, genre) : 1;
  const speed = lerp(BRIEF_SPEED_BY_SKILL, skill / 100);
  const optimism = lerp(BRIEF_ESTIMATE_OPTIMISM, skill / 100);
  const estimatedDays = Math.max(1, Math.round(baseDaysFor(role) * speed * optimism));

  const candidates = eligibleBriefCandidates(draft, talentPool, role, today);
  const fees = candidates.map((p) => getTypicalSalaryForRole(p, role)).sort((a, b) => a - b);
  const affordable = fees.filter((f) => f <= allocation).length;
  const trueBand = bandForShare(fees.length > 0 ? affordable / fees.length : 0, affordable > 0);
  // The rosier read of a producer who doesn't quite know the market.
  const band =
    skill < BRIEF_HONEST_READ_SKILL
      ? BAND_ORDER[Math.min(BAND_ORDER.length - 1, BAND_ORDER.indexOf(trueBand) + 1)]
      : trueBand;
  const floorFee = fees[0] ?? 0;
  return { estimatedDays, band, read: readLine(band, role, floorFee), floorFee };
}

// --- Issuing ---------------------------------------------------------------

/**
 * Hand the slot over. The true return day is rolled ONCE here, from the
 * producer's reliability, and stored - the schedule is committed the moment you
 * delegate, and re-reading the record always yields the same history
 * (SIMULATION_PHILOSOPHY Principle 2). The candidate is deliberately NOT rolled
 * yet; see `tickStaffingBriefs`.
 */
export function issueBrief(
  id: string,
  producer: Person,
  role: ProductionRole,
  allocation: Money,
  draft: FilmDraft,
  talentPool: TalentPool,
  today: GameDay,
  rng: RandomFn,
): StaffingBrief {
  const career = getProducerCareer(producer);
  const skill = career ? effectiveSkill(career, draft.genre) : 1;
  const quote = quoteBrief(producer, role, allocation, draft, talentPool, today);
  const honestDays = Math.max(1, Math.round(baseDaysFor(role) * lerp(BRIEF_SPEED_BY_SKILL, skill / 100)));
  // Reliability decides whether they come back when they said they would.
  const reliability = clamp(producer.reputation.reliability, 1, 100);
  const overrunCeiling = BRIEF_MAX_OVERRUN * (1 - reliability / 100);
  const trueDays = Math.max(1, Math.round(honestDays * (1 + overrunCeiling * rng())));
  return {
    id,
    role,
    producerId: producer.id,
    allocation,
    issuedOnDay: today,
    estimatedDays: quote.estimatedDays,
    dueOnDay: today + trueDays,
    status: 'out',
    briefsUsed: briefsForRole(draft, role).length + 1,
  };
}

// --- The pick --------------------------------------------------------------

/**
 * How well this head suits what the film actually asks of their department.
 * Only the two modelled specialty departments (Production Design, VFX) have a
 * real answer; the others fall back to overall skill, which is exactly why the
 * fit gamble below bites hardest on the two departments that are also the most
 * demanding and the most optional.
 */
function fitScore(person: Person, role: ProductionRole, draft: FilmDraft): number {
  const career = getCrewCareer(person, role as Parameters<typeof getCrewCareer>[1]);
  const overallSkill = career?.skill ?? 50;
  const department = specialtyDepartmentForRole(role);
  const script = draft.script;
  if (!department || !script || !isSpecialtyDepartment(department)) return overallSkill;
  const strategy = draft.executionStrategy ? { ...deriveDefaultStrategy(script), ...draft.executionStrategy } : undefined;
  const workload = deriveDepartmentWorkloadsForScript(script, strategy).find((w) => w.department === department);
  if (!workload) return overallSkill;
  const caps = crewSpecialtyCapability(person, role, department, overallSkill);
  return specialtyWeightedCapability(caps, workload.contributions, overallSkill).skill;
}

function pitchFor(
  person: Person,
  role: ProductionRole,
  fee: Money,
  allocation: Money,
  career: ProducerCareer,
  genre: Genre | null,
  bond: ProducerStableEntry | null,
): string[] {
  const pitch: string[] = [];
  // The bond leads: it is why THIS name, and it is what makes the pick read as
  // a person's choice rather than a sample.
  const bondLine = describeStableBond(bond);
  if (bondLine) pitch.push(bondLine);
  const under = allocation - fee;
  if (under > 0) pitch.push(`£${Math.round(under / 1000).toLocaleString()}k under what you gave me.`);
  else pitch.push(`Right at the number you gave me.`);
  const specialty = describeStandoutSpecialty(person, role);
  if (specialty) pitch.push(specialty);
  if (genre != null && career.genreAffinity.includes(genre)) pitch.push(`I've worked ${genre.toLowerCase()} with people like this for years.`);
  return pitch;
}

/**
 * Who the producer comes back with. TWO deliberate biases, and the whole
 * balance of the feature lives in them:
 *
 *  1. They rank by VALUE (skill per pound) and under-weight department FIT.
 *     A Line Producer's professional instinct is the budget, not the film - so
 *     on a script that leans hard on one department, their top-value pick can
 *     be a genuine mismatch, and the staffing board told you that department
 *     was demanding before you handed it over.
 *  2. Their SKILL narrows the slice they choose from, uniformly. A good
 *     producer picks from a tight top few; a poor one is erratic across a wide
 *     field - occasionally a bargain nobody would have found, more often
 *     somebody nobody would have chosen. Skill sets the SPREAD, not just the
 *     mean (SIMULATION_PHILOSOPHY Principle 1).
 *
 * Returns null when nothing in the pool comes in at the allocation - a real,
 * legible failure that still cost the player the days.
 */
export function producerCandidatePick(
  producer: Person,
  role: ProductionRole,
  allocation: Money,
  draft: FilmDraft,
  talentPool: TalentPool,
  today: GameDay,
  rng: RandomFn,
  playerFilms: readonly Film[] = [],
): NonNullable<StaffingBrief['candidate']> | null {
  const career = getProducerCareer(producer);
  if (!career) return null;
  const skill = effectiveSkill(career, draft.genre);
  const discount = lerp(BRIEF_FEE_DISCOUNT_BY_SKILL, skill / 100);
  // Their book (engine/producerStables.ts) - who they already trust, and what
  // those people charge them. Read once; every candidate below checks against it.
  const bonds = new Map(producerStable(producer, playerFilms).map((e) => [`${e.personId}::${e.role}`, e]));
  const bondFor = (personId: string) => bonds.get(`${personId}::${role}`) ?? null;

  const affordable = eligibleBriefCandidates(draft, talentPool, role, today)
    .map((person) => {
      const bond = bondFor(person.id);
      // The favour rate stacks with the skill discount: a regular of a good
      // producer is the cheapest this game gets.
      const fee = Math.round(getTypicalSalaryForRole(person, role) * discount * stableFeeMultiplier(bond));
      return { person, fee, bond };
    })
    .filter((c) => c.fee <= allocation);
  if (affordable.length === 0) return null;

  // Both axes live in the same 0-1 space, so the weights mean what they say:
  // quality is skill/100, price is the candidate's LOG position within the
  // role's own salary range (the scale salaries are actually distributed on),
  // and fit is the specialty-weighted read. "Value" is quality minus what the
  // price costs them - a line producer's actual instinct, and pointedly not
  // skill-per-pound, which degenerates to "hire the cheapest body alive".
  const salaryRange = ROLE_GENERATION_PROFILES[professionForProductionRole(role)].salaryRange;
  const ranked = affordable
    .map((c) => {
      const quality = (getCrewCareer(c.person, role as Parameters<typeof getCrewCareer>[1])?.skill ?? 50) / 100;
      const price = clamp(logT(c.fee, salaryRange), 0, 1);
      const fit = fitScore(c.person, role, draft) / 100;
      // Familiarity is a thumb on the scale, not a trump card: enough that a
      // producer visibly keeps going back to their people, never enough to
      // carry someone whose price and fit both argue against them. This is
      // also the mechanic's second way to be WRONG - their regular is not
      // necessarily right for this film, and they will still bring them.
      const familiarity = BRIEF_STABLE_SCORE_BONUS * stableStrength(c.bond?.films ?? 0);
      return { ...c, score: BRIEF_VALUE_WEIGHT * (quality - BRIEF_PRICE_PENALTY * price) + BRIEF_FIT_WEIGHT * fit + familiarity };
    })
    .sort((a, b) => b.score - a.score);

  const sliceSize = Math.max(1, Math.round(lerp(BRIEF_CANDIDATE_SLICE, skill / 100)));
  const chosen = ranked[randInt(rng, 0, Math.min(sliceSize, ranked.length) - 1)];
  return {
    personId: chosen.person.id,
    fee: chosen.fee,
    pitch: pitchFor(chosen.person, role, chosen.fee, allocation, career, draft.genre, chosen.bond),
  };
}

// --- The daily tick --------------------------------------------------------

/**
 * One day for one draft's live briefs: any brief whose true return day has
 * arrived comes back with a candidate. Called from state/studioReducer.ts's
 * ADVANCE_DAY case for the focused draft AND every backgrounded one - the same
 * beat, and the same reasoning, as engine/castingCalls.ts:tickCastingCalls.
 *
 * A brief that finds nobody at the allocation still returns; it just returns
 * empty-handed (`candidate` absent). The player sees what it cost them.
 */
export function tickStaffingBriefs(
  draft: FilmDraft,
  totalDays: GameDay,
  talentPool: TalentPool,
  producerPool: Person[],
  rng: RandomFn,
  playerFilms: readonly Film[] = [],
): FilmDraft {
  const briefs = draftBriefs(draft);
  if (briefs.length === 0) return draft;
  let changed = false;

  const next = briefs.map((brief) => {
    if (brief.status !== 'out' || brief.dueOnDay > totalDays) return brief;
    // The role got filled by hand while they were out - the brief is moot.
    if (draft.talent.some((a) => a.role === brief.role)) {
      changed = true;
      return { ...brief, status: 'declined' as const };
    }
    const producer = producerPool.find((p) => p.id === brief.producerId);
    if (!producer) {
      // Fired mid-search. Nothing comes back.
      changed = true;
      return { ...brief, status: 'declined' as const };
    }
    changed = true;
    const candidate = producerCandidatePick(producer, brief.role, brief.allocation, draft, talentPool, totalDays, rng, playerFilms);
    return { ...brief, status: 'returned' as const, candidate: candidate ?? undefined };
  });

  if (!changed) return draft;
  return { ...draft, staffingBriefs: next };
}

/** Close out every live brief on this draft - greenlight, abandonment, a fired producer. */
export function withdrawBriefs(draft: FilmDraft, predicate: (brief: StaffingBrief) => boolean): FilmDraft {
  const briefs = draftBriefs(draft);
  if (briefs.length === 0) return draft;
  let changed = false;
  const next = briefs.map((brief) => {
    if ((brief.status !== 'out' && brief.status !== 'returned') || !predicate(brief)) return brief;
    changed = true;
    return { ...brief, status: 'declined' as const };
  });
  return changed ? { ...draft, staffingBriefs: next } : draft;
}
