// Awards Season - pure scoring, eligibility, and payoff computation
// (docs/DESIGN_REVIEW_awards_season.md). Plain data in, plain data out, no
// React, no state - the same discipline as the rest of engine/. The reducer
// (increment 2) opens/resolves seasons and applies these numbers; tunables
// live in data/awards.ts.
import type {
  AwardCategory,
  AwardNomination,
  AwardsCeremony,
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
  /** The 1-indexed calendar year being honoured. */
  year: number;
  ceremonyDay: number;
  /** Every film eligible this year - player and rival alike (already filtered). */
  eligibleFilms: Film[];
  /** Player film id -> campaign cash committed. Rival films campaign nothing in MVP. */
  campaignByFilm: Record<string, number>;
  /** Prestige of whichever studio made a given film (player or rival) - drives the small nudge. */
  studioPrestigeForFilm: (film: Film) => number;
  rng: RandomFn;
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

function pictureContenders(input: CeremonyInput): ScoredContender[] {
  return input.eligibleFilms.map((f) => scored(input, f, f.results.qualityScore * 0.6 + f.results.criticScore * 0.4));
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

function actingContenders(input: CeremonyInput, role: 'Lead Actor' | 'Supporting Actor'): GenderedContender[] {
  return input.eligibleFilms.flatMap((f) =>
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

/** Resolve one year's Academy Awards - nominees (top N) and a winner (top 1) per category. Deterministic given the rng. */
export function computeCeremony(input: CeremonyInput): AwardsCeremony {
  const leads = splitByGender(actingContenders(input, 'Lead Actor'));
  const supporting = splitByGender(actingContenders(input, 'Supporting Actor'));

  const categories: Record<AwardCategory, AwardNomination[]> = {
    'best-picture': toNominations(pictureContenders(input)),
    'best-director': toNominations(directorContenders(input)),
    'best-screenplay': toNominations(screenplayContenders(input)),
    'best-actor': toNominations(leads.masc),
    'best-actress': toNominations(leads.fem),
    'best-supporting-actor': toNominations(supporting.masc),
    'best-supporting-actress': toNominations(supporting.fem),
    'best-cinematography': toNominations(craftContenders(input, 'Cinematographer', (r) => r.productionScore)),
    'best-film-editing': toNominations(craftContenders(input, 'Editor', (r) => r.postProductionScore)),
    'best-original-score': toNominations(craftContenders(input, 'Composer', (r) => r.postProductionScore)),
    'best-visual-effects': toNominations(craftContenders(input, 'VFX Supervisor', (r) => r.productionScore)),
  };

  return { year: input.year, ceremonyDay: input.ceremonyDay, categories };
}

// --- Payoff (pure; the reducer applies these in increment 2) ---------------

function forEachNomination(ceremony: AwardsCeremony, fn: (nom: AwardNomination, weight: number) => void): void {
  for (const category of Object.keys(ceremony.categories) as AwardCategory[]) {
    const weight = AWARD_CATEGORY_WEIGHT[category];
    for (const nom of ceremony.categories[category]) fn(nom, weight);
  }
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
