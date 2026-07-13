import type { Film, FilmDraft, Genre, Project, Studio, TalentRole } from '../types';
import { computeTalentCost, computeProductionBudgetCost, computeEventsCostDelta, computeMarketingCost } from '../engine/cost';
import { TEST_SCREENING_PROFILES } from '../data/postProduction';
import { playerDraftToProject, rivalProductionToProject, filmToProject } from '../engine/project';
import type { GameState } from './gameState';

/**
 * A temporary compatibility layer for the architecture roadmap's Phase 4:
 * presents the still-fragmented storage (GameState.draft,
 * Studio.productionsInProgress, GameState.rivalProductionsInProgress,
 * Studio.filmsReleased, GameState.rivalFilmsReleased) as one flat
 * Project[] list, so read-only consumers can migrate to the target shape
 * before Phase 5 flips the actual source of truth. Computed fresh on every
 * read, never stored - same "derive, don't duplicate" discipline this file
 * already uses for its Stats-page aggregates. Deleted once Phase 5 makes
 * GameState.projects the real field (at which point consumers here just
 * read that directly).
 */
export function deriveProjectsView(state: GameState): Project[] {
  // A draft with `results` set has already been released by RELEASE_FILM -
  // it stays populated afterward purely so ReleaseResults.tsx still has
  // something to show (docs/DESIGN.md), not because it's still "in
  // progress." The real, canonical record of that same film already exists
  // in studio.filmsReleased; counting the draft here too would double it.
  const liveDraft = state.draft && state.draft.results === null ? state.draft : null;
  const playerInProgress = [
    ...(liveDraft ? [liveDraft] : []),
    ...state.studio.productionsInProgress,
  ].map(playerDraftToProject);
  const rivalInProgress = state.rivalProductionsInProgress.map(rivalProductionToProject);
  const released = [
    ...state.studio.filmsReleased,
    ...state.rivalFilmsReleased,
  ].map(filmToProject);
  return [...playerInProgress, ...rivalInProgress, ...released];
}

/**
 * Sums whatever costs aren't reflected in studio.cash yet for the film in
 * progress - script cost, event cost swings, the test screening fee, and
 * marketing are still only charged at RELEASE_FILM, so those are always
 * added here. Talent salary, the non-contingency production budget, and the
 * contingency reserve are different: BEGIN_PHOTOGRAPHY deducts all three
 * from studio.cash immediately (and FINISH_PHOTOGRAPHY settles contingency
 * against what was actually burned) - see state/studioReducer.ts - so once
 * `draft.photography` exists, those three are already real cash movements,
 * not a projection, and adding them here again would double-count spend
 * this preview's caller is about to subtract a second time from a cash
 * figure that's already down that amount.
 */
export function computeCommittedSpend(draft: FilmDraft | null): number {
  if (!draft) return 0;

  let total = 0;
  if (draft.script) total += draft.script.cost;
  if (!draft.photography) {
    // Not charged yet - BEGIN_PHOTOGRAPHY is what actually deducts these,
    // so until then this is a pure "what would this cost" projection. Uses
    // the full planned contingency reserve (what it costs to shoot the
    // recommended schedule, see engine/production.ts:computeRecommendedShootDays)
    // as the estimate - the same number ProductionPlanning.tsx shows
    // directly, so this stays consistent with what the player can already
    // see on screen.
    total += computeTalentCost(draft.talent);
    if (draft.productionChoices) {
      total += computeProductionBudgetCost(draft.productionChoices);
      total += draft.productionChoices.contingencyAmount;
    }
  } else {
    total += computeEventsCostDelta(draft.photography.events);
  }
  if (draft.postProductionChoices) {
    total += TEST_SCREENING_PROFILES[draft.postProductionChoices.testScreeningResponse].cost;
  }
  if (draft.marketingChoices) total += computeMarketingCost(draft.marketingChoices);

  return total;
}

/**
 * "Legs" - how many multiples of its own opening weekend a film's whole run
 * added up to - is a derived reported statistic now (docs/DESIGN.md 5.34,
 * Milestone 5), never a stored field and never an input to how a run
 * actually plays out (the retired fixed-legs model used to compute it up
 * front from reviews and feed it straight into weekly retention; the
 * audience simulation that replaced it has no such lever anywhere - see
 * engine/audienceSimulationStep.ts). Only meaningful once a run has
 * actually opened (an unreleased film has no `Film` yet) and once its
 * total is known - a still-running film's *eventual* legs aren't knowable
 * any earlier than its real total gross is, so this deliberately doesn't
 * project one from `boxOfficeRun.cumulativeGross` the way the Outcome
 * Inspector's dev-only preview does.
 */
export function computeReportedLegs(film: Film): number | null {
  if (film.results.totalBoxOffice === null || film.results.openingWeekend <= 0) return null;
  return film.results.totalBoxOffice / film.results.openingWeekend;
}

export interface TopGrossingEntry {
  film: Film;
  studioName: string;
  thisWeekGross: number;
  weekNumber: number;
}

/**
 * The player's own films plus every rival's (GameState.rivalFilmsReleased,
 * see engine/rivalStudios.ts), ranked by whatever each one made in its own
 * most recently settled week - a real weekend chart, not lifetime gross, so
 * a long-running hit and a film in its second week both compete on the same
 * number. Only films still actually in theaters count; a finished run drops
 * off the chart the same way it would in reality.
 */
export function computeTopGrossingFilms(studio: Studio, rivalFilmsReleased: Film[], limit = 10): TopGrossingEntry[] {
  const candidates: Array<{ film: Film; studioName: string }> = [
    ...studio.filmsReleased.map((film) => ({ film, studioName: studio.name })),
    ...rivalFilmsReleased.map((film) => ({ film, studioName: film.releasedBy ?? 'A Rival Studio' })),
  ];

  const entries: TopGrossingEntry[] = [];
  for (const { film, studioName } of candidates) {
    const { boxOfficeRun } = film;
    if (boxOfficeRun.status !== 'running' || boxOfficeRun.weeks.length === 0) continue;
    const latestWeek = boxOfficeRun.weeks[boxOfficeRun.weeks.length - 1];
    entries.push({ film, studioName, thisWeekGross: latestWeek.gross, weekNumber: latestWeek.week });
  }
  return entries.sort((a, b) => b.thisWeekGross - a.thisWeekGross).slice(0, limit);
}

export interface FilmStatRow {
  film: Film;
  studioName: string;
  isPlayer: boolean;
}

/**
 * Every film ever released, player's own and every rival's, as one flat
 * list - the raw material for the Stats page (components/StatsPage.tsx).
 * Nothing new is tracked here; Studio.filmsReleased/GameState.rivalFilmsReleased
 * already keep every release forever, complete with cast (stable talent
 * ids, since rivals cast from the same shared talent pool - see
 * engine/rivalStudios.ts) and full results.
 */
export function collectFilmStats(studio: Studio, rivalFilmsReleased: Film[]): FilmStatRow[] {
  return [
    ...studio.filmsReleased.map((film) => ({ film, studioName: studio.name, isPlayer: true })),
    ...rivalFilmsReleased.map((film) => ({ film, studioName: film.releasedBy ?? 'A Rival Studio', isPlayer: false })),
  ];
}

export type FilmStatSortKey =
  | 'title' | 'studio' | 'genre' | 'releasedOnDay'
  | 'criticScore' | 'audienceScore' | 'buzzScore' | 'qualityScore'
  | 'boxOffice' | 'profit';

export interface FilmStatsFilters {
  studioName: string | 'all';
  genre: Genre | 'all';
  role: TalentRole | 'any';
  /** Case-insensitive substring match against the name of whoever's hired for `role` (or any role, if 'any'). */
  personName: string;
  sortBy: FilmStatSortKey;
  sortDirection: 'asc' | 'desc';
}

/** So-far gross/profit for a still-running film, final figures once its run has settled - same convention Dashboard.tsx's Studio History table and RivalStudioPage.tsx already display. */
function boxOfficeSortValue(film: Film): number {
  return film.results.totalBoxOffice ?? film.boxOfficeRun.cumulativeGross;
}
function profitSortValue(film: Film): number {
  return film.results.profit ?? 0;
}

function matchesPerson(row: FilmStatRow, role: TalentRole | 'any', personName: string): boolean {
  const needle = personName.trim().toLowerCase();
  if (!needle) return true;
  const candidates = role === 'any' ? row.film.talent : row.film.talent.filter((t) => t.role === role);
  return candidates.some((t) => t.name.toLowerCase().includes(needle));
}

export function filterAndSortFilmStats(rows: FilmStatRow[], filters: FilmStatsFilters): FilmStatRow[] {
  const filtered = rows.filter((row) => {
    if (filters.studioName !== 'all' && row.studioName !== filters.studioName) return false;
    if (filters.genre !== 'all' && row.film.genre !== filters.genre) return false;
    if (!matchesPerson(row, filters.role, filters.personName)) return false;
    return true;
  });

  const sign = filters.sortDirection === 'asc' ? 1 : -1;
  const compare = (a: FilmStatRow, b: FilmStatRow): number => {
    switch (filters.sortBy) {
      case 'title': return sign * a.film.title.localeCompare(b.film.title);
      case 'studio': return sign * a.studioName.localeCompare(b.studioName);
      case 'genre': return sign * a.film.genre.localeCompare(b.film.genre);
      case 'releasedOnDay': return sign * (a.film.releasedOnDay - b.film.releasedOnDay);
      case 'criticScore': return sign * (a.film.results.criticScore - b.film.results.criticScore);
      case 'audienceScore': return sign * (a.film.results.audienceScore - b.film.results.audienceScore);
      case 'buzzScore': return sign * (a.film.results.buzzScore - b.film.results.buzzScore);
      case 'qualityScore': return sign * (a.film.results.qualityScore - b.film.results.qualityScore);
      case 'boxOffice': return sign * (boxOfficeSortValue(a.film) - boxOfficeSortValue(b.film));
      case 'profit': return sign * (profitSortValue(a.film) - profitSortValue(b.film));
      default: return 0;
    }
  };
  return [...filtered].sort(compare);
}

/**
 * Shared roll-up math behind the Studio/Director/Actor stat tabs
 * (components/StatsPage.tsx) - every aggregate view is "bucket these same
 * FilmStatRows by some key, average the always-known scores, sum the
 * box-office/profit figures that are only known once a run settles, and
 * count outcome labels into hit/flop." `entriesFor` is the only thing that
 * differs per view: one row maps to exactly one studio bucket, but to zero
 * or more person buckets (a film can credit several Lead Actors, or none).
 */
interface StatAccumulator {
  label: string;
  filmCount: number;
  criticSum: number;
  audienceSum: number;
  qualitySum: number;
  totalBoxOffice: number;
  totalProfit: number;
  hitCount: number;
  flopCount: number;
}

const HIT_OUTCOMES = new Set(['Hit', 'Blockbuster', 'Masterpiece']);

function aggregateFilmStats(
  rows: FilmStatRow[],
  entriesFor: (row: FilmStatRow) => Array<{ key: string; label: string }>,
): Map<string, StatAccumulator> {
  const map = new Map<string, StatAccumulator>();
  for (const row of rows) {
    for (const { key, label } of entriesFor(row)) {
      let acc = map.get(key);
      if (!acc) {
        acc = { label, filmCount: 0, criticSum: 0, audienceSum: 0, qualitySum: 0, totalBoxOffice: 0, totalProfit: 0, hitCount: 0, flopCount: 0 };
        map.set(key, acc);
      }
      acc.filmCount += 1;
      acc.criticSum += row.film.results.criticScore;
      acc.audienceSum += row.film.results.audienceScore;
      acc.qualitySum += row.film.results.qualityScore;
      acc.totalBoxOffice += boxOfficeSortValue(row.film);
      if (row.film.results.profit !== null) acc.totalProfit += row.film.results.profit;
      const { outcome } = row.film.results;
      if (outcome && HIT_OUTCOMES.has(outcome)) acc.hitCount += 1;
      else if (outcome === 'Flop') acc.flopCount += 1;
    }
  }
  return map;
}

export interface StudioStatRow {
  studioName: string;
  isPlayer: boolean;
  filmCount: number;
  avgCriticScore: number;
  avgAudienceScore: number;
  avgQualityScore: number;
  totalBoxOffice: number;
  totalProfit: number;
  hitCount: number;
  flopCount: number;
}

/** One row per studio (the player's own plus every rival that's released a film) - the "how do our track records compare" rollup. */
export function collectStudioStats(rows: FilmStatRow[]): StudioStatRow[] {
  const map = aggregateFilmStats(rows, (row) => [{ key: row.studioName, label: row.studioName }]);
  const isPlayerByName = new Map(rows.map((row) => [row.studioName, row.isPlayer]));
  return [...map.entries()].map(([studioName, acc]) => ({
    studioName,
    isPlayer: isPlayerByName.get(studioName) ?? false,
    filmCount: acc.filmCount,
    avgCriticScore: acc.criticSum / acc.filmCount,
    avgAudienceScore: acc.audienceSum / acc.filmCount,
    avgQualityScore: acc.qualitySum / acc.filmCount,
    totalBoxOffice: acc.totalBoxOffice,
    totalProfit: acc.totalProfit,
    hitCount: acc.hitCount,
    flopCount: acc.flopCount,
  }));
}

export type StatSortKey =
  | 'name' | 'filmCount' | 'avgCriticScore' | 'avgAudienceScore' | 'avgQualityScore' | 'totalBoxOffice' | 'totalProfit' | 'hitCount';

export interface StudioStatsFilters {
  sortBy: StatSortKey;
  sortDirection: 'asc' | 'desc';
}

export function sortStudioStats(rows: StudioStatRow[], filters: StudioStatsFilters): StudioStatRow[] {
  const sign = filters.sortDirection === 'asc' ? 1 : -1;
  const compare = (a: StudioStatRow, b: StudioStatRow): number => {
    switch (filters.sortBy) {
      case 'name': return sign * a.studioName.localeCompare(b.studioName);
      case 'filmCount': return sign * (a.filmCount - b.filmCount);
      case 'avgCriticScore': return sign * (a.avgCriticScore - b.avgCriticScore);
      case 'avgAudienceScore': return sign * (a.avgAudienceScore - b.avgAudienceScore);
      case 'avgQualityScore': return sign * (a.avgQualityScore - b.avgQualityScore);
      case 'totalBoxOffice': return sign * (a.totalBoxOffice - b.totalBoxOffice);
      case 'totalProfit': return sign * (a.totalProfit - b.totalProfit);
      case 'hitCount': return sign * (a.hitCount - b.hitCount);
      default: return 0;
    }
  };
  return [...rows].sort(compare);
}

export interface PersonStatRow {
  id: string;
  name: string;
  filmCount: number;
  avgCriticScore: number;
  avgAudienceScore: number;
  avgQualityScore: number;
  totalBoxOffice: number;
  totalProfit: number;
  hitCount: number;
  flopCount: number;
}

/**
 * One row per credited person (keyed by Talent.id, not name - names aren't
 * guaranteed unique and rivals cast from the same shared talent pool, see
 * collectFilmStats above) across every film where they held one of `roles`.
 * Same shape powers both the Director tab (roles=['Director']) and the
 * Actor tab (roles=['Lead Actor', 'Supporting Actor']).
 */
export function collectPersonStats(rows: FilmStatRow[], roles: TalentRole[]): PersonStatRow[] {
  const map = aggregateFilmStats(rows, (row) =>
    row.film.talent.filter((t) => roles.includes(t.role)).map((t) => ({ key: t.id, label: t.name })),
  );
  return [...map.entries()].map(([id, acc]) => ({
    id,
    name: acc.label,
    filmCount: acc.filmCount,
    avgCriticScore: acc.criticSum / acc.filmCount,
    avgAudienceScore: acc.audienceSum / acc.filmCount,
    avgQualityScore: acc.qualitySum / acc.filmCount,
    totalBoxOffice: acc.totalBoxOffice,
    totalProfit: acc.totalProfit,
    hitCount: acc.hitCount,
    flopCount: acc.flopCount,
  }));
}

export interface PersonStatsFilters {
  nameSearch: string;
  sortBy: StatSortKey;
  sortDirection: 'asc' | 'desc';
}

export function filterAndSortPersonStats(rows: PersonStatRow[], filters: PersonStatsFilters): PersonStatRow[] {
  const needle = filters.nameSearch.trim().toLowerCase();
  const filtered = needle ? rows.filter((row) => row.name.toLowerCase().includes(needle)) : rows;

  const sign = filters.sortDirection === 'asc' ? 1 : -1;
  const compare = (a: PersonStatRow, b: PersonStatRow): number => {
    switch (filters.sortBy) {
      case 'name': return sign * a.name.localeCompare(b.name);
      case 'filmCount': return sign * (a.filmCount - b.filmCount);
      case 'avgCriticScore': return sign * (a.avgCriticScore - b.avgCriticScore);
      case 'avgAudienceScore': return sign * (a.avgAudienceScore - b.avgAudienceScore);
      case 'avgQualityScore': return sign * (a.avgQualityScore - b.avgQualityScore);
      case 'totalBoxOffice': return sign * (a.totalBoxOffice - b.totalBoxOffice);
      case 'totalProfit': return sign * (a.totalProfit - b.totalProfit);
      case 'hitCount': return sign * (a.hitCount - b.hitCount);
      default: return 0;
    }
  };
  return [...filtered].sort(compare);
}
