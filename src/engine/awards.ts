// Awards Season - pure scoring, eligibility, and payoff computation
// (docs/DESIGN_REVIEW_awards_season.md). Plain data in, plain data out, no
// React, no state - the same discipline as the rest of engine/. The reducer
// (increment 2) opens/resolves seasons and applies these numbers; tunables
// live in data/awards.ts.
import type {
  AwardCategory,
  AwardNomination,
  AwardsCeremony,
  AwardShowId,
  CrewRole,
  Film,
  FilmResults,
  Gender,
  Person,
  ProductionRole,
} from '../types';
import { yearOf } from './calendar';
import { computeTalentCompatibility } from './compatibility';
import { getCrewCareer } from './person';
import { randFloat, type RandomFn } from './random';
import {
  AWARD_CATEGORY_WEIGHT,
  AWARD_JITTER_MAGNITUDE,
  BUMP_CAP_FRACTION,
  CAMPAIGN_MAX,
  CAMPAIGN_SCALE,
  MOMENTUM_CAP,
  MOMENTUM_NOMINATION,
  MOMENTUM_WIN,
  NOMINATION_BUMP_FRACTION,
  NOMINATION_PRESTIGE,
  NOMINEES_PER_CATEGORY,
  PRESTIGE_NUDGE_CAP,
  PRESTIGE_NUDGE_FACTOR,
  WIN_BRAND,
  WIN_BUMP_FRACTION,
  WIN_PRESTIGE,
} from '../data/awards';

export interface CeremonyInput {
  /** Which show is resolving - stamped onto the ceremony. */
  show: AwardShowId;
  /** The categories this show awards (from its profile). */
  categories: readonly AwardCategory[];
  /** The 1-indexed calendar year being honoured. */
  year: number;
  ceremonyDay: number;
  /** Every film eligible this year - player and rival alike (already filtered). */
  eligibleFilms: Film[];
  /** Player film id -> campaign cash committed. Rival films campaign nothing in MVP. */
  campaignByFilm: Record<string, number>;
  /** Prestige of whichever studio made a given film (player or rival) - drives the small nudge. */
  studioPrestigeForFilm: (film: Film) => number;
  /** Accumulated precursor momentum, keyed by momentumKey - folded into each contender's score. Empty for the season's first ceremony. */
  momentum: Record<string, number>;
  rng: RandomFn;
}

/** The unsplit Academy category a (possibly Globes-split) category maps onto - the key momentum and payoffs aggregate under. */
export function toOscarCategory(category: AwardCategory): AwardCategory {
  switch (category) {
    case 'best-picture-drama':
    case 'best-picture-comedy':
      return 'best-picture';
    case 'best-actor-drama':
    case 'best-actor-comedy':
      return 'best-actor';
    case 'best-actress-drama':
    case 'best-actress-comedy':
      return 'best-actress';
    default:
      return category;
  }
}

/** The Globes bucket a film competes in - only Comedy films go Musical/Comedy; everything else is Drama. */
function isComedyFilm(film: Film): boolean {
  return film.genre === 'Comedy';
}

export function momentumKey(oscarCategory: AwardCategory, filmId: string, personId?: string): string {
  return `${oscarCategory}|${filmId}|${personId ?? ''}`;
}

function momentumFor(ledger: Record<string, number>, category: AwardCategory, filmId: string, personId?: string): number {
  return Math.min(MOMENTUM_CAP, ledger[momentumKey(toOscarCategory(category), filmId, personId)] ?? 0);
}

/** Films released in `year` (by releasedOnDay). Player + rival - the caller passes the combined list. */
export function filmsForAwardsYear(films: Film[], year: number): Film[] {
  return films.filter((film) => yearOf(film.releasedOnDay) === year);
}

/** Diminishing-returns campaign curve, capped at CAMPAIGN_MAX award-score points. */
export function campaignBoost(spend: number): number {
  return CAMPAIGN_MAX * (1 - Math.exp(-Math.max(0, spend) / CAMPAIGN_SCALE));
}

function prestigeNudge(prestige: number): number {
  return Math.min(PRESTIGE_NUDGE_CAP, Math.max(0, prestige) * PRESTIGE_NUDGE_FACTOR);
}

interface ScoredContender {
  filmId: string;
  personId?: string;
  score: number;
}

function personForRole(film: Film, role: ProductionRole): Person | null {
  return film.talent.find((a) => a.role === role)?.person ?? null;
}

function peopleForRole(film: Film, role: ProductionRole): Person[] {
  return film.talent.filter((a) => a.role === role).map((a) => a.person);
}

// awardScore = merit (0-100) + a small studio-Prestige nudge + campaign boost +
// bounded jitter. Merit dominates; the rest only reorder close races.
function scored(input: CeremonyInput, film: Film, merit: number, personId?: string): ScoredContender {
  const score =
    merit +
    prestigeNudge(input.studioPrestigeForFilm(film)) +
    campaignBoost(input.campaignByFilm[film.id] ?? 0) +
    randFloat(input.rng, -AWARD_JITTER_MAGNITUDE, AWARD_JITTER_MAGNITUDE);
  return { filmId: film.id, personId, score };
}

function toNominations(contenders: ScoredContender[]): AwardNomination[] {
  return [...contenders]
    .sort((a, b) => b.score - a.score)
    .slice(0, NOMINEES_PER_CATEGORY)
    .map((c, i) => ({ filmId: c.filmId, personId: c.personId, awardScore: c.score, won: i === 0 }));
}

function pictureContenders(input: CeremonyInput, filter: (f: Film) => boolean = () => true): ScoredContender[] {
  return input.eligibleFilms
    .filter(filter)
    .map((f) => scored(input, f, f.results.qualityScore * 0.6 + f.results.criticScore * 0.4));
}

function directorContenders(input: CeremonyInput): ScoredContender[] {
  return input.eligibleFilms.flatMap((f) => {
    const director = personForRole(f, 'Director');
    if (!director) return [];
    return [scored(input, f, f.results.directionScore * 0.7 + f.results.qualityScore * 0.3, director.id)];
  });
}

function screenplayContenders(input: CeremonyInput): ScoredContender[] {
  return input.eligibleFilms.map((f) => {
    const writer = personForRole(f, 'Writer');
    return scored(input, f, f.results.scriptScore * 0.7 + f.script.originality * 0.3, writer?.id);
  });
}

// Crafts share film-level sub-scores but separate on the individual crew
// member's skill, so two films with equal productionScore still differ on
// their DP vs their VFX lead.
function craftContenders(input: CeremonyInput, role: CrewRole, subScore: (r: FilmResults) => number): ScoredContender[] {
  return input.eligibleFilms.flatMap((f) => {
    const person = personForRole(f, role);
    if (!person) return [];
    const skill = getCrewCareer(person, role)?.skill;
    if (skill == null) return [];
    return [scored(input, f, subScore(f.results) * 0.6 + skill * 0.4, person.id)];
  });
}

interface GenderedContender {
  contender: ScoredContender;
  gender?: Gender;
}

function actingContenders(
  input: CeremonyInput,
  role: 'Lead Actor' | 'Supporting Actor',
  filter: (f: Film) => boolean = () => true,
): GenderedContender[] {
  return input.eligibleFilms.filter(filter).flatMap((f) =>
    peopleForRole(f, role).map((person) => {
      const compat = computeTalentCompatibility(person, role, f.script) ?? 50;
      const merit = compat * 0.7 + f.results.qualityScore * 0.3;
      return { contender: scored(input, f, merit, person.id), gender: person.identity.gender };
    }),
  );
}

// Gender-split the performers. Male -> the "actor" field, Female -> "actress".
// A non-binary or unknown-gender performer is eligible for both but placed in
// exactly one - whichever gendered field they'd rank higher in (measured
// against the strictly-gendered contenders), so they're never excluded and
// never double-nominated (docs/DESIGN_REVIEW_awards_season.md §3.1).
function splitByGender(entries: GenderedContender[]): { masc: ScoredContender[]; fem: ScoredContender[] } {
  const male = entries.filter((e) => e.gender === 'Male').map((e) => e.contender);
  const female = entries.filter((e) => e.gender === 'Female').map((e) => e.contender);
  const masc = [...male];
  const fem = [...female];
  for (const e of entries) {
    if (e.gender === 'Male' || e.gender === 'Female') continue;
    const rankInMasc = male.filter((m) => m.score > e.contender.score).length;
    const rankInFem = female.filter((f) => f.score > e.contender.score).length;
    if (rankInMasc <= rankInFem) masc.push(e.contender);
    else fem.push(e.contender);
  }
  return { masc, fem };
}

// The contender pool for a single category, before momentum. Split categories
// filter the field by Globes bucket; gendered categories pick their half.
function contendersForCategory(input: CeremonyInput, category: AwardCategory): ScoredContender[] {
  switch (category) {
    case 'best-picture':
      return pictureContenders(input);
    case 'best-picture-drama':
      return pictureContenders(input, (f) => !isComedyFilm(f));
    case 'best-picture-comedy':
      return pictureContenders(input, isComedyFilm);
    case 'best-director':
      return directorContenders(input);
    case 'best-screenplay':
      return screenplayContenders(input);
    case 'best-actor':
      return splitByGender(actingContenders(input, 'Lead Actor')).masc;
    case 'best-actress':
      return splitByGender(actingContenders(input, 'Lead Actor')).fem;
    case 'best-actor-drama':
      return splitByGender(actingContenders(input, 'Lead Actor', (f) => !isComedyFilm(f))).masc;
    case 'best-actress-drama':
      return splitByGender(actingContenders(input, 'Lead Actor', (f) => !isComedyFilm(f))).fem;
    case 'best-actor-comedy':
      return splitByGender(actingContenders(input, 'Lead Actor', isComedyFilm)).masc;
    case 'best-actress-comedy':
      return splitByGender(actingContenders(input, 'Lead Actor', isComedyFilm)).fem;
    case 'best-supporting-actor':
      return splitByGender(actingContenders(input, 'Supporting Actor')).masc;
    case 'best-supporting-actress':
      return splitByGender(actingContenders(input, 'Supporting Actor')).fem;
    case 'best-cinematography':
      return craftContenders(input, 'Cinematographer', (r) => r.productionScore);
    case 'best-film-editing':
      return craftContenders(input, 'Editor', (r) => r.postProductionScore);
    case 'best-original-score':
      return craftContenders(input, 'Composer', (r) => r.postProductionScore);
    case 'best-visual-effects':
      return craftContenders(input, 'VFX Supervisor', (r) => r.productionScore);
  }
}

// Fold accumulated precursor momentum into each contender's score, keyed by the
// category's unsplit Academy equivalent, before nominees are picked.
function applyMomentum(input: CeremonyInput, category: AwardCategory, contenders: ScoredContender[]): ScoredContender[] {
  if (Object.keys(input.momentum).length === 0) return contenders;
  return contenders.map((c) => ({
    ...c,
    score: c.score + momentumFor(input.momentum, category, c.filmId, c.personId),
  }));
}

/**
 * Resolve one show's ceremony - nominees (top N) and a winner (top 1) for each
 * category the show awards. Deterministic given the rng. Precursor momentum
 * (from earlier shows this season) lifts contenders toward the odds a real
 * awards-season frontrunner carries.
 */
export function computeCeremony(input: CeremonyInput): AwardsCeremony {
  const categories: Partial<Record<AwardCategory, AwardNomination[]>> = {};
  for (const category of input.categories) {
    categories[category] = toNominations(applyMomentum(input, category, contendersForCategory(input, category)));
  }
  return { show: input.show, year: input.year, ceremonyDay: input.ceremonyDay, categories };
}

// --- Payoff (pure; the reducer applies these in increment 2) ---------------

function forEachNomination(
  ceremony: AwardsCeremony,
  fn: (nom: AwardNomination, weight: number, category: AwardCategory) => void,
): void {
  for (const category of Object.keys(ceremony.categories) as AwardCategory[]) {
    const weight = AWARD_CATEGORY_WEIGHT[category];
    for (const nom of ceremony.categories[category] ?? []) fn(nom, weight, category);
  }
}

/**
 * The momentum a resolved ceremony contributes toward every later show this
 * season - keyed by the unsplit Academy category, so a Globes Drama win and a
 * SAG win both stack onto the same Oscar contender. Scaled by the show's own
 * momentumWeight (the flagship's is 0 - nothing resolves after it).
 */
export function accrueMomentum(ceremony: AwardsCeremony, momentumWeight: number): Record<string, number> {
  const delta: Record<string, number> = {};
  if (momentumWeight <= 0) return delta;
  forEachNomination(ceremony, (nom, weight, category) => {
    const key = momentumKey(toOscarCategory(category), nom.filmId, nom.personId);
    delta[key] = (delta[key] ?? 0) + (nom.won ? MOMENTUM_WIN : MOMENTUM_NOMINATION) * momentumWeight * weight;
  });
  return delta;
}

/** Prestige & Brand a studio earns from a ceremony, given the set of its film ids. Nominations add Prestige; wins add Prestige + Brand. */
export function computeStudioAwardDeltas(ceremony: AwardsCeremony, filmIds: Set<string>): { prestige: number; brand: number } {
  let prestige = 0;
  let brand = 0;
  forEachNomination(ceremony, (nom, weight) => {
    if (!filmIds.has(nom.filmId)) return;
    prestige += (nom.won ? WIN_PRESTIGE : NOMINATION_PRESTIGE) * weight;
    if (nom.won) brand += WIN_BRAND * weight;
  });
  return { prestige, brand };
}

/** One-time box-office "Oscar bump" for a film: a capped fraction of its own studio revenue share, scaled by its award haul. */
export function computeBoxOfficeBump(film: Film, ceremony: AwardsCeremony): number {
  let fraction = 0;
  forEachNomination(ceremony, (nom, weight) => {
    if (nom.filmId !== film.id) return;
    fraction += (nom.won ? WIN_BUMP_FRACTION : NOMINATION_BUMP_FRACTION) * weight;
  });
  fraction = Math.min(fraction, BUMP_CAP_FRACTION);
  return Math.round((film.results.studioRevenue ?? 0) * fraction);
}

/** Every film id that earned at least one nomination - the set the box-office bump iterates. */
export function nominatedFilmIds(ceremony: AwardsCeremony): Set<string> {
  const ids = new Set<string>();
  forEachNomination(ceremony, (nom) => ids.add(nom.filmId));
  return ids;
}
