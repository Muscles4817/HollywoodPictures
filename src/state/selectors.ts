import type { AwardCategory, AwardShowId, AwardsCeremony, Asset, Film, FilmDraft, Genre, Person, PersonId, ProductionRole, ProductionScale, Project, RivalStudio, ScriptScale, TalentAssignment, WizardStep } from '../types';
import { computeTalentCost, computeProductionBudgetCost, computeEventsCostDelta, computeMarketingCost } from '../engine/cost';
import { totalAttachedPerFilmFees } from '../engine/producers';
import { computeBoxOfficeBump, computeStudioAwardDeltas } from '../engine/awards';
import { awardShow } from '../data/awardsShows';
import { explainBrandChange, explainPrestigeChange } from '../engine/reputation';
import { WEEK_LENGTH_DAYS } from '../engine/boxOfficeRun';
import { GENRE_PROFILES } from '../data/genres';
import { AWARD_CATEGORY_LABEL } from '../data/awards';
import { productionRequirementTags } from '../engine/scriptPresentation';
import { asFilm, asPlayerDraft, asScheduled, asRivalProduction, findProject, projectId } from '../engine/project';
import { rivalReleaseIsAnnounced } from '../engine/rivalStudios';
import type { GameState } from './gameState';

/**
 * The project the live wizard/ProductionRun screen is currently driving
 * (GameState.focusedProjectId), narrowed to its FilmDraft shape - null both
 * when nothing's focused and when the focused project has already
 * transitioned to 'released' (see deriveFocusedFilm below and RELEASE_FILM,
 * state/studioReducer.ts). The read-side replacement for the old
 * `GameState.draft` field (roadmap Phase 5).
 */
export function deriveFocusedDraft(state: GameState): FilmDraft | null {
  return asPlayerDraft(findProject(state.projects, state.focusedProjectId));
}

/**
 * The focused project narrowed to its released Film shape - non-null only
 * right after RELEASE_FILM, while the player is still on the 'results'
 * screen looking at the film they just released (see
 * components/wizard/ReleaseResults.tsx). The id is the same one
 * deriveFocusedDraft would have returned a moment earlier - RELEASE_FILM
 * doesn't touch focusedProjectId, only the project's own `kind` changes.
 */
export function deriveFocusedFilm(state: GameState): Film | null {
  return asFilm(findProject(state.projects, state.focusedProjectId));
}

/**
 * Sums whatever costs aren't reflected in studio.cash yet for the film in
 * progress - event cost swings, the test screening fee, and marketing are
 * still only charged at SCHEDULE_RELEASE, so those are always added here.
 * The script's own cost is deliberately NOT included - it was already
 * charged in full at Opportunity acquisition, before this Project (or any
 * Project) existed (docs/DESIGN_REVIEW_development_pipeline.md); adding it
 * here would double-count spend that's already reflected in studio.cash.
 * Talent salary, the non-contingency production budget, and the
 * contingency reserve are different: GREENLIGHT_PROJECT deducts all three
 * from studio.cash immediately (and FINISH_PHOTOGRAPHY settles contingency
 * against what was actually burned) - see state/studioReducer.ts - so once
 * `draft.photography` exists, those three are already real cash movements,
 * not a projection, and adding them here again would double-count spend
 * this preview's caller is about to subtract a second time from a cash
 * figure that's already down that amount.
 */
export function computeCommittedSpend(draft: FilmDraft | null, producerPool: Person[] = []): number {
  if (!draft) return 0;

  let total = 0;
  // Attached producers' per-film fees are a release-time cost (like marketing
  // below), not charged at Greenlight - included here so the projected all-in
  // spend is honest. Pool is optional/defaulted so callers that don't have it
  // (or predate producers) simply see no fee, never a crash.
  total += totalAttachedPerFilmFees(producerPool, draft.attachedProducerIds ?? []);
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
 * The player's own films plus every rival's, ranked by whatever each one
 * made in its own most recently settled week - a real weekend chart, not
 * lifetime gross, so a long-running hit and a film in its second week both
 * compete on the same number. Only films still actually in theaters count;
 * a finished run drops off the chart the same way it would in reality.
 * Reads off GameState.projects directly (roadmap Phase 5) - a film is the
 * player's own iff it has no `releasedBy` (see types/index.ts:Film), same
 * convention as collectFilmStats above.
 */
export function computeTopGrossingFilms(projects: Project[], playerStudioName: string, limit = 10): TopGrossingEntry[] {
  const candidates: Array<{ film: Film; studioName: string }> = projects.flatMap((project) => {
    const film = asFilm(project);
    if (!film) return [];
    return [{ film, studioName: film.releasedBy ?? playerStudioName }];
  });

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
 * Nothing new is tracked here; GameState.projects (roadmap Phase 5) already
 * folds every release, player's and every rival's, into one list, complete
 * with cast (stable talent ids, since rivals cast from the same shared
 * talent pool - see engine/rivalStudios.ts) and full results. A film is the
 * player's own iff it has no `releasedBy` (see types/index.ts:Film) - only
 * rivals stamp that field (engine/rivalStudios.ts).
 */
export function collectFilmStats(projects: Project[], studioName: string): FilmStatRow[] {
  return projects.flatMap((project) => {
    const film = asFilm(project);
    if (!film) return [];
    const isPlayer = film.releasedBy === undefined;
    return [{ film, studioName: isPlayer ? studioName : (film.releasedBy ?? 'A Rival Studio'), isPlayer }];
  });
}

export interface ReputationEvent {
  id: string;
  /** GameState.totalDays this event landed on - a film's own last-settled week, or an awards ceremony's own ceremonyDay. */
  day: number;
  kind: 'film' | 'awards';
  title: string;
  prestigeDelta: number;
  brandDelta: number;
  /** Plain-language reason for prestigeDelta - absent when prestigeDelta is 0. */
  prestigeDetail?: string;
  /** Plain-language reason for brandDelta - absent when brandDelta is 0. */
  brandDetail?: string;
}

/** How many of `ceremony`'s nominations/wins belong to a studio holding `filmIds`. */
function playerAwardHaul(ceremony: AwardsCeremony, filmIds: Set<string>): { wins: number; nominations: number } {
  let wins = 0;
  let nominations = 0;
  for (const noms of Object.values(ceremony.categories)) {
    for (const nom of noms ?? []) {
      if (!filmIds.has(nom.filmId)) continue;
      nominations += 1;
      if (nom.won) wins += 1;
    }
  }
  return { wins, nominations };
}

/**
 * The player's whole Brand/Prestige history, most recent first - every
 * finished film's own reception-driven change (engine/reputation.ts) plus
 * every awards ceremony's own haul (engine/awards.ts:computeStudioAwardDeltas),
 * each with a plain-language reason attached. Deliberately not its own piece
 * of persisted state: everything it needs (FilmResults.prestigeChange/
 * brandChange, GameState.awards.history) is already saved as part of the
 * films and awards state that produced it, so this is free to derive fresh
 * every time rather than something a save-format migration could ever
 * desync from its source. The Dashboard's Brand/Prestige tiles (and,
 * per-event, the moment a film's run finishes or a ceremony resolves) are
 * what actually explain a given change to the player; this is the
 * standing record of everything that's happened so far.
 */
export function deriveReputationHistory(state: GameState): ReputationEvent[] {
  const playerFilms = state.projects.flatMap((project) => {
    const film = asFilm(project);
    return film && film.releasedBy === undefined ? [film] : [];
  });
  const playerFilmIds = new Set(playerFilms.map((film) => film.id));

  const filmEvents: ReputationEvent[] = playerFilms
    .filter((film) => film.boxOfficeRun.status === 'finished' && (film.results.prestigeChange || film.results.brandChange))
    .map((film) => ({
      id: `film-${film.id}`,
      day: film.releasedOnDay + film.boxOfficeRun.weeks.length * WEEK_LENGTH_DAYS,
      kind: 'film',
      title: film.title,
      prestigeDelta: film.results.prestigeChange ?? 0,
      brandDelta: film.results.brandChange ?? 0,
      prestigeDetail: film.results.prestigeChange ? explainPrestigeChange({ criticScore: film.results.criticScore, qualityScore: film.results.qualityScore }) : undefined,
      brandDetail: film.results.brandChange
        ? explainBrandChange({
            profit: film.results.profit ?? 0,
            totalCost: film.results.totalCost,
            totalBoxOffice: film.results.totalBoxOffice ?? 0,
            audienceScore: film.results.audienceScore,
          })
        : undefined,
    }));

  const awardsEvents: ReputationEvent[] = (state.awards?.history ?? []).flatMap((ceremony) => {
    // Each show's payoff is scaled by its stakes (a precursor pays less than the
    // Oscars) - the reputation history must apply the same scale so its "why"
    // numbers match what the reducer actually credited.
    const show = awardShow(ceremony.show);
    const raw = computeStudioAwardDeltas(ceremony, playerFilmIds);
    const prestige = raw.prestige * show.payoffScale;
    const brand = raw.brand * show.payoffScale;
    if (prestige === 0 && brand === 0) return [];
    const { wins, nominations } = playerAwardHaul(ceremony, playerFilmIds);
    const haul = wins > 0
      ? `${wins} win${wins === 1 ? '' : 's'}, ${nominations} nomination${nominations === 1 ? '' : 's'}`
      : `${nominations} nomination${nominations === 1 ? '' : 's'}, no wins`;
    return [{
      id: `awards-${ceremony.year}-${ceremony.show}`,
      day: ceremony.ceremonyDay,
      kind: 'awards' as const,
      title: `Year ${ceremony.year} ${show.name}`,
      prestigeDelta: prestige,
      brandDelta: brand,
      prestigeDetail: prestige !== 0 ? haul : undefined,
      brandDetail: brand !== 0 ? haul : undefined,
    }];
  });

  return [...filmEvents, ...awardsEvents].sort((a, b) => b.day - a.day);
}

/** How long after a ceremony the Dashboard keeps announcing it, so a passive real-time player still sees the win (and the money it brought) even if they weren't watching that day. */
export const RECENT_AWARD_HIGHLIGHT_DAYS = 14;

export interface RecentAwardHighlight {
  id: string;
  /** GameState.totalDays the ceremony resolved on. */
  day: number;
  showName: string;
  year: number;
  wins: number;
  nominations: number;
  /** Cash prize credited to the studio at the ceremony (engine/awards.ts:computeBoxOfficeBump x payoffScale) - the number that mysteriously moved the budget. */
  payout: number;
  prestigeDelta: number;
  brandDelta: number;
}

/**
 * Recently-resolved ceremonies the player was actually in - the data behind the
 * Dashboard "Awards night" announcement, since awards otherwise resolve silently
 * inside the background day tick and their cash prize lands with no explanation.
 * Purely derived (like deriveReputationHistory): the ceremony is stored in
 * awards.history and the money is recomputed from it plus each film's stored
 * studioRevenue, applying the same payoffScale and Math.round the reducer used
 * so the announced figure matches what actually hit the budget.
 */
export function deriveRecentAwardHighlights(state: GameState, withinDays: number = RECENT_AWARD_HIGHLIGHT_DAYS): RecentAwardHighlight[] {
  const playerFilms = state.projects.flatMap((project) => {
    const film = asFilm(project);
    return film && film.releasedBy === undefined ? [film] : [];
  });
  const playerFilmIds = new Set(playerFilms.map((film) => film.id));

  return (state.awards?.history ?? [])
    .flatMap((ceremony) => {
      const age = state.totalDays - ceremony.ceremonyDay;
      if (age < 0 || age > withinDays) return [];
      const { wins, nominations } = playerAwardHaul(ceremony, playerFilmIds);
      if (nominations === 0) return []; // the player wasn't in this one
      const show = awardShow(ceremony.show);
      const raw = computeStudioAwardDeltas(ceremony, playerFilmIds);
      const payout = Math.round(playerFilms.reduce((sum, film) => sum + computeBoxOfficeBump(film, ceremony), 0) * show.payoffScale);
      return [{
        id: `award-highlight-${ceremony.year}-${ceremony.show}`,
        day: ceremony.ceremonyDay,
        showName: show.name,
        year: ceremony.year,
        wins,
        nominations,
        payout,
        prestigeDelta: Math.round(raw.prestige * show.payoffScale),
        brandDelta: Math.round(raw.brand * show.payoffScale),
      }];
    })
    .sort((a, b) => b.day - a.day);
}

export type FilmStatSortKey =
  | 'title' | 'studio' | 'genre' | 'releasedOnDay'
  | 'criticScore' | 'audienceScore' | 'buzzScore' | 'qualityScore'
  | 'boxOffice' | 'profit';

export interface FilmStatsFilters {
  studioName: string | 'all';
  genre: Genre | 'all';
  role: ProductionRole | 'any';
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

function matchesPerson(row: FilmStatRow, role: ProductionRole | 'any', personName: string): boolean {
  const needle = personName.trim().toLowerCase();
  if (!needle) return true;
  const candidates = (role === 'any' ? row.film.talent : row.film.talent.filter((a) => a.role === role)).map((a) => a.person);
  return candidates.some((p) => p.identity.name.toLowerCase().includes(needle));
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
export function collectPersonStats(rows: FilmStatRow[], roles: ProductionRole[]): PersonStatRow[] {
  const map = aggregateFilmStats(rows, (row) =>
    row.film.talent.filter((a) => roles.includes(a.role)).map((a) => ({ key: a.person.id, label: a.person.identity.name })),
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

export interface AwardTally {
  wins: number;
  nominations: number;
}

export interface PersonAwardSummary {
  /** Total wins across every show (Globes, SAG, BAFTA, Academy). */
  wins: number;
  /** Total nominations (wins included) across every show. */
  nominations: number;
  /** Per-show totals, for the full record - keyed by AwardShowId. */
  byShow: Partial<Record<AwardShowId, AwardTally>>;
  /**
   * Academy Awards only, per canonical (unsplit) category. Drives the flagship
   * "N-time Best Actor winner" marquee - the Oscar is the headline honour, and
   * keying the marquee off it alone avoids conflating a precursor sweep (a Globes
   * + SAG + BAFTA + Oscar year would otherwise read as "Four-time" for one role).
   */
  academyByCategory: Partial<Record<AwardCategory, AwardTally>>;
}

function bumpTally<K extends string>(map: Partial<Record<K, AwardTally>>, key: K, won: boolean): void {
  const cell = map[key] ?? { wins: 0, nominations: 0 };
  cell.nominations += 1;
  if (won) cell.wins += 1;
  map[key] = cell;
}

/**
 * Aggregate every person's whole awards record out of the permanent ceremony
 * history (state.awards.history), across every show. Keyed by PersonId the same
 * way collectPersonStats and creditsByPerson are, so a Talent Database row can
 * look its subject up directly. Best Picture nominations carry no personId and
 * are simply skipped here - this is a per-person tally, and the studio's own
 * Best Picture haul lives in playerAwardHaul.
 */
export function collectPersonAwards(history: AwardsCeremony[]): Map<PersonId, PersonAwardSummary> {
  const map = new Map<PersonId, PersonAwardSummary>();
  for (const ceremony of history) {
    for (const category of Object.keys(ceremony.categories) as AwardCategory[]) {
      const nominations = ceremony.categories[category];
      if (!nominations) continue;
      for (const nomination of nominations) {
        if (!nomination.personId) continue;
        let summary = map.get(nomination.personId);
        if (!summary) {
          summary = { wins: 0, nominations: 0, byShow: {}, academyByCategory: {} };
          map.set(nomination.personId, summary);
        }
        summary.nominations += 1;
        if (nomination.won) summary.wins += 1;
        bumpTally(summary.byShow, ceremony.show, nomination.won);
        if (ceremony.show === 'academy') bumpTally(summary.academyByCategory, category, nomination.won);
      }
    }
  }
  return map;
}

const AWARD_COUNT_WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

/** "Two-time " for 2+, "" for a single win (so "Best Actor winner" reads plainly). */
function timesPrefix(n: number): string {
  if (n <= 1) return '';
  return `${AWARD_COUNT_WORDS[n] ?? String(n)}-time `;
}

/**
 * The Talent Database header banner for an actor who has actually won an Academy
 * Award - "Two-time Best Actor winner", or several categories joined
 * ("Best Actor winner · Best Supporting Actor winner"). Keyed off the flagship
 * Oscar only (see academyByCategory); returns null for anyone without an Academy
 * win, so precursor-only winners still show in the panel but carry no headline.
 */
export function formatWinnerMarquee(summary: PersonAwardSummary): string | null {
  const won = (Object.entries(summary.academyByCategory) as Array<[AwardCategory, AwardTally]>)
    .filter(([, cell]) => cell.wins > 0)
    .sort((a, b) => b[1].wins - a[1].wins);
  if (won.length === 0) return null;
  return won.map(([category, cell]) => `${timesPrefix(cell.wins)}${AWARD_CATEGORY_LABEL[category]} winner`).join(' · ');
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

// --- Projects page (components/ProjectsPage.tsx) ---------------------------
//
// "Shelved" and "Pre-Production" split a photography-less draft two ways:
// focused (being actively decided right now) or carrying genuine progress
// already (hasDraftProgress below) both read as 'pre-production' - the
// industry term is accurate either way, whether or not the player happens
// to be looking at it this exact moment. Only a draft with neither - a
// script sitting untouched since acquisition - is genuinely 'shelved'.
// This used to be a pure focus check (a hired director and an unopened
// script both read as "shelved" the instant they weren't focused), which
// misrepresented a project the player had already started staffing as
// abandoned. Note a backgrounded pre-photography draft isn't actually
// frozen even so - Casting Redesign calls keep ticking on it via
// ADVANCE_DAY (engine/castingCalls.ts:tickCastingCalls) regardless of which
// stage it reads as here. Every other stage is a pure function of the
// Project/FilmDraft shape alone. Nothing rival-owned ever appears here -
// neither an in-progress rival production nor an already-released rival
// film - this page is "your current projects," not the market's.
export type ProjectStage =
  | 'pre-production'
  | 'filming'
  | 'post-production'
  | 'scheduled'
  | 'in-cinemas'
  | 'archived'
  | 'shelved';

/** Whether a pre-photography draft has any real commitment on it yet - someone hired, a casting call opened, or a production plan set - as opposed to a script that's simply been acquired and never opened. Shared by deriveProjectStage below and Dashboard.tsx's own "Staffing" slate slot, so the two can never disagree about what counts as "started." */
export function hasDraftProgress(draft: FilmDraft): boolean {
  return draft.talent.length > 0 || draft.castingCalls.length > 0 || draft.productionChoices !== null;
}

/**
 * How many projects on the *player's own* active slate right now - films still
 * in development/production plus ones already scheduled and awaiting their
 * release day. Deliberately excludes released films (they're done) and every
 * rival's in-progress production: state.projects is world-level and mixes all
 * of those together, so the Dashboard's "N active projects" line read wildly
 * high before this (it was `projects.length`, counting rivals and released
 * films too).
 */
export function countActivePlayerProjects(projects: Project[]): number {
  return projects.filter((p) => p.kind === 'player-in-progress' || p.kind === 'scheduled').length;
}

export function deriveProjectStage(project: Project, focusedProjectId: string | null): ProjectStage | null {
  if (project.kind === 'rival-in-progress') return null;
  // A 'released' Project can be a rival's own film too (Film.releasedBy set
  // - engine/rivalStudios.ts is the only thing that ever stamps it), the
  // same convention engine/project.ts:playerReleasedFilms/collectFilmStats
  // already use to tell the two apart. Excluded here, not just left to a
  // caller to filter - "your current projects" should never include one
  // that isn't yours regardless of which selector reaches it.
  if (project.kind === 'released') {
    if (project.film.releasedBy !== undefined) return null;
    return project.film.boxOfficeRun.status === 'running' ? 'in-cinemas' : 'archived';
  }
  if (project.kind === 'scheduled') return 'scheduled';
  const { draft } = project;
  if (!draft.photography) {
    return draft.id === focusedProjectId || hasDraftProgress(draft) ? 'pre-production' : 'shelved';
  }
  return draft.photography.status === 'finished' ? 'post-production' : 'filming';
}

/**
 * Same screen RESUME_PROJECT (state/studioReducer.ts) would send a
 * pre-greenlight/mid-shoot/post-production draft to - re-exported here so a
 * Projects-page card for the *already-focused* project can jump straight
 * back to it (RESUME_PROJECT itself refuses to run while something's
 * already focused, even if it's this exact project - see its own reducer
 * guard). A pre-greenlight draft (no `photography` yet) always re-enters the
 * Producer Workspace's Overview tab regardless of which section it was last
 * on, same as RESUME_PROJECT's own behavior - everything already chosen is
 * preserved on the draft either way. Narrower than `Screen` on purpose (see
 * types/index.ts) - every value this can actually return is either
 * 'workspace' or a WizardStep, so a caller dispatching off this return value
 * doesn't need to re-narrow away the rest of Screen's members by hand.
 */
export function currentScreenFor(draft: FilmDraft): 'workspace' | WizardStep {
  if (!draft.photography) return 'workspace';
  if (draft.photography.status === 'finished') return draft.postProductionChoices ? 'marketing' : 'post-production';
  return 'production';
}

/**
 * Which WizardStep screens can be jumped to directly right now, via the
 * clickable step nav (components/common/WizardSteps.tsx) - Post-Production
 * Redesign, Phase C (docs/DESIGN_REVIEW_post_production_redesign.md section
 * 3): once photography wraps, Marketing becomes reachable independently of
 * post-production completion, not gated behind postProductionChoices being
 * locked in or the test screening having resolved - that's the entire
 * point of decoupling them. 'production' is always reachable (checking
 * wrap-up stats, or it's simply where a still-shooting draft already is).
 * 'marketing' additionally requires no currently-pending, unresolved test
 * screening - mirrors the existing block on PostProduction.tsx's own
 * "Continue to Marketing" button, so this nav can never let the player
 * route around a decision they still owe. 'results' is deliberately never
 * included - it's only ever reached by SCHEDULE_RELEASE actually resolving
 * a release, never by jumping there ahead of that.
 */
export function deriveReachableWizardSteps(draft: FilmDraft): WizardStep[] {
  const steps: WizardStep[] = ['production'];
  if (draft.photography?.status === 'finished') {
    steps.push('post-production');
    if (!draft.testScreeningPendingChoice) steps.push('marketing');
  }
  return steps;
}

/**
 * The full Greenlight cost breakdown - talent salary, the non-contingency
 * production budget, and the contingency reserve, summed into one
 * commitment against current studio cash. Extracted from the old
 * Greenlight.tsx screen's own inline calculation (development-pipeline
 * doc) so the Producer Workspace's Finance tab, its Greenlight confirmation
 * modal, and Overview's financial summary all read the exact same numbers -
 * none of them can ever disagree, because none of them compute this
 * independently any more. `productionChoices` may still be null this early
 * (the player hasn't opened Production yet) - the breakdown just reads as
 * "nothing planned yet" rather than throwing, same as
 * engine/projectReadiness.ts's own handling of the same gap.
 */
export interface GreenlightCommitment {
  talentCost: number;
  productionCost: number;
  contingency: number;
  totalCommitment: number;
  cashAfter: number;
  canAfford: boolean;
}

export function deriveGreenlightCommitment(draft: FilmDraft, studioCash: number): GreenlightCommitment {
  const talentCost = computeTalentCost(draft.talent);
  const productionCost = draft.productionChoices ? computeProductionBudgetCost(draft.productionChoices) : 0;
  const contingency = draft.productionChoices ? draft.productionChoices.contingencyAmount : 0;
  const totalCommitment = talentCost + productionCost + contingency;
  const cashAfter = studioCash - totalCommitment;
  return { talentCost, productionCost, contingency, totalCommitment, cashAfter, canAfford: cashAfter >= 0 };
}

/**
 * Total money committed to this specific project so far, across every
 * stage - unlike computeCommittedSpend above (which deliberately excludes
 * whatever's already a real studio.cash movement, to avoid a caller
 * double-subtracting it from that same cash figure), this is a standalone
 * per-project running total, so it includes everything: the script's own
 * acquisition cost (paid once, at ACQUIRE_OPPORTUNITY, looked up from the
 * still-owned Asset since FilmDraft/Film don't carry it directly), talent,
 * production budget + contingency once planned, event cost swings once
 * shooting has happened, test screening once decided, and marketing once
 * set. A released film reads its own already-settled results.totalCost
 * instead of re-deriving the production-side terms by hand.
 */
export function computeProjectSpendSoFar(project: Project, assets: Asset[]): number {
  const scriptCostFor = (assetId: string) => assets.find((a) => a.id === assetId)?.acquisitionCost ?? 0;

  if (project.kind === 'released') {
    const scriptCost = project.film.assetId ? scriptCostFor(project.film.assetId) : 0;
    return scriptCost + project.film.results.totalCost;
  }
  if (project.kind === 'rival-in-progress') return 0;

  const draft = project.draft;
  let spend = scriptCostFor(draft.assetId) + computeTalentCost(draft.talent);
  if (draft.productionChoices) spend += computeProductionBudgetCost(draft.productionChoices) + draft.productionChoices.contingencyAmount;
  if (draft.photography) spend += computeEventsCostDelta(draft.photography.events);
  // Architecture cleanup (post-Phase-B post-production redesign) - a
  // resolved test-screening choice's cost is charged immediately, straight
  // out of Studio.cash (RESOLVE_TEST_SCREENING_CHOICE), the same way
  // talent/production/contingency above already are once `draft.photography`
  // exists - real cash movements already reflected in studio.cash, not a
  // projection, but still real spend this project has incurred, so (unlike
  // computeCommittedSpend above, which deliberately excludes them) it
  // belongs in a "spend so far" total. Lives on its own
  // draft.postProductionEvents collection now rather than a zeroed-out entry
  // hidden inside draft.photography.events - see that field's own comment
  // (types/index.ts) for why.
  spend += computeEventsCostDelta(draft.postProductionEvents);
  if (draft.marketingChoices) spend += computeMarketingCost(draft.marketingChoices);
  return spend;
}

export interface ProjectCardData {
  projectId: string;
  stage: ProjectStage;
  isFocused: boolean;
  title: string;
  synopsis: string;
  genre: Genre;
  genreDescription: string;
  tags: string[];
  director: string | null;
  leads: string[];
  spendSoFar: number;
  /** Only while actually shooting - null at every other stage. */
  shootProgress: { daysElapsed: number; recommendedDays: number } | null;
  /** Only for a scheduled project - the release day it's committed to. */
  scheduledReleaseDay: number | null;
  /** Only for a released film (in-cinemas or archived). */
  boxOffice: {
    running: boolean;
    cumulativeGross: number;
    thisWeekGross: number | null;
    weekNumber: number | null;
    finalTotal: number | null;
  } | null;
}

function creditedNames(talent: Film['talent'], role: ProductionRole): string[] {
  return talent.filter((a) => a.role === role).map((a) => a.person.identity.name);
}

/** Builds one card's worth of display data for a single Project - null for a rival production (this page is player-only) or one whose stage can't be derived. */
export function buildProjectCardData(project: Project, state: GameState): ProjectCardData | null {
  const stage = deriveProjectStage(project, state.focusedProjectId);
  if (!stage) return null;
  const id = projectId(project);
  const spendSoFar = computeProjectSpendSoFar(project, state.studio.assets);

  if (project.kind === 'released') {
    const { film } = project;
    const { boxOfficeRun } = film;
    const latestWeek = boxOfficeRun.weeks.length > 0 ? boxOfficeRun.weeks[boxOfficeRun.weeks.length - 1] : null;
    return {
      projectId: id,
      stage,
      isFocused: id === state.focusedProjectId,
      title: film.title,
      synopsis: film.script.synopsis,
      genre: film.genre,
      genreDescription: GENRE_PROFILES[film.genre].description,
      tags: productionRequirementTags(film.script),
      director: creditedNames(film.talent, 'Director')[0] ?? null,
      leads: creditedNames(film.talent, 'Lead Actor'),
      spendSoFar,
      shootProgress: null,
      scheduledReleaseDay: null,
      boxOffice: {
        running: boxOfficeRun.status === 'running',
        cumulativeGross: boxOfficeRun.cumulativeGross,
        thisWeekGross: latestWeek?.gross ?? null,
        weekNumber: latestWeek?.week ?? null,
        finalTotal: film.results.totalBoxOffice,
      },
    };
  }

  const draft = project.kind === 'scheduled' || project.kind === 'player-in-progress' ? project.draft : null;
  if (!draft || !draft.script || !draft.genre) return null;
  return {
    projectId: id,
    stage,
    isFocused: id === state.focusedProjectId,
    title: draft.title || draft.script.title,
    synopsis: draft.script.synopsis,
    genre: draft.genre,
    genreDescription: GENRE_PROFILES[draft.genre].description,
    tags: productionRequirementTags(draft.script),
    director: creditedNames(draft.talent, 'Director')[0] ?? null,
    leads: creditedNames(draft.talent, 'Lead Actor'),
    spendSoFar,
    shootProgress:
      draft.photography && draft.photography.status !== 'finished'
        ? { daysElapsed: draft.photography.daysElapsed, recommendedDays: draft.photography.recommendedDays }
        : null,
    scheduledReleaseDay: project.kind === 'scheduled' ? project.releaseDay : null,
    boxOffice: null,
  };
}

/** Every one of the player's own current projects, as card data - excludes rival productions entirely. */
export function collectProjectCards(state: GameState): ProjectCardData[] {
  return state.projects.flatMap((project) => {
    const card = buildProjectCardData(project, state);
    return card ? [card] : [];
  });
}

/**
 * One player-facing size tier for a calendar release. The sim models film
 * size on two separate axes - a rival production's ProductionScale
 * (Small/Medium/Big) and a script's own ScriptScale (Intimate/Medium/Epic) -
 * and the calendar collapses both onto this shared vocabulary so a release's
 * size reads the same whoever is making it. There is deliberately no
 * 'Blockbuster' tier: nothing pre-release in the sim plans one (OutcomeLabel's
 * 'Blockbuster' is a box-office *result*, not a planned size), so inventing one
 * here would be fiction. The two mappers below are the single place to widen
 * if a fourth tier ever lands.
 */
export type ReleaseScale = 'Small' | 'Medium' | 'Large';

function releaseScaleFromProduction(scale: ProductionScale): ReleaseScale {
  switch (scale) {
    case 'Small':
      return 'Small';
    case 'Medium':
      return 'Medium';
    case 'Big':
      return 'Large';
  }
}

function releaseScaleFromScript(scale: ScriptScale): ReleaseScale {
  switch (scale) {
    case 'Intimate':
      return 'Small';
    case 'Medium':
      return 'Medium';
    case 'Epic':
      return 'Large';
  }
}

export interface CalendarEntry {
  id: string;
  title: string;
  genre: string;
  targetAudience: string;
  /** Normalized display size - see ReleaseScale. */
  scale: ReleaseScale;
  releaseDay: number;
  studioId: string;
  studioName: string;
  isPlayer: boolean;
  /**
   * Whether this film's real identity (title + cast) is public yet. Always true
   * for the player's own films; for a rival it flips true once its marketing
   * rollout has begun (engine/rivalStudios.ts:rivalReleaseIsAnnounced). While
   * false the `title` is a generic "{scale} {genre} film" and `stars`/`director`
   * are empty - the project is still under wraps.
   */
  announced: boolean;
  /** Lead actor names, shown once the film is announced (empty while under wraps). */
  stars: string[];
  /** Director name, shown once the film is announced. */
  director?: string;
}

export const PLAYER_STUDIO_ID = 'player-studio';

/** Lead actor names on a film (the marquee cast), in assignment order. */
function leadActorNames(talent: TalentAssignment[]): string[] {
  return talent.filter((a) => a.role === 'Lead Actor').map((a) => a.person.identity.name);
}

/** The director's name, if one is assigned. */
function directorName(talent: TalentAssignment[]): string | undefined {
  return talent.find((a) => a.role === 'Director')?.person.identity.name;
}

/**
 * Every upcoming release, the player's own scheduled projects and every
 * rival's in-progress production, sorted by release day - the shared
 * source both components/ReleaseCalendar.tsx and
 * components/wizard/MarketingRelease.tsx's inline release-date picker
 * (Phase 1 of release scheduling competition) read from, so a rival's
 * upcoming slate can never look different depending on which screen is
 * asking. `genre`/`targetAudience` stay plain strings here (not the
 * stricter Genre/TargetAudience unions) to match CheckboxFilterDropdown's
 * string-id filter options, which is what this shape was originally built
 * for - a caller that needs the stricter type back (e.g. to feed
 * engine/releaseCrowding.ts:computeCompetitiveCrowding) can cast safely,
 * since every entry here is sourced from a real FilmDraft/RivalProductionInProgress,
 * never the placeholder '-' fallback (a 'scheduled' project's draft always
 * has genre/targetAudience set - see state/studioReducer.ts:SCHEDULE_RELEASE's
 * own guard).
 */
export function deriveUpcomingReleaseEntries(projects: Project[], rivalStudios: RivalStudio[], studioName: string, today: number): CalendarEntry[] {
  const rivalNameById = new Map(rivalStudios.map((rival) => [rival.id, rival.name]));

  const entries = projects.flatMap((project): CalendarEntry[] => {
    const scheduled = asScheduled(project);
    if (scheduled) {
      return [
        {
          id: scheduled.draft.id,
          title: scheduled.draft.title || 'Untitled Film',
          genre: scheduled.draft.genre ?? '-',
          targetAudience: scheduled.draft.targetAudience ?? '-',
          // A 'scheduled' draft always has a script (SCHEDULE_RELEASE's guard),
          // but the field is Script | null on the draft type - fall back neutrally.
          scale: scheduled.draft.script ? releaseScaleFromScript(scheduled.draft.script.scale) : 'Medium',
          releaseDay: scheduled.releaseDay,
          studioId: PLAYER_STUDIO_ID,
          studioName,
          isPlayer: true,
          // The player always knows their own film's title and cast.
          announced: true,
          stars: leadActorNames(scheduled.draft.talent),
          director: directorName(scheduled.draft.talent),
        },
      ];
    }

    const production = asRivalProduction(project);
    if (production) {
      // A rival's title and cast are announced once its marketing rollout has
      // begun (engine/rivalStudios.ts) - before that the project is under wraps
      // and only its scale/genre/studio/timing are known.
      const announced = rivalReleaseIsAnnounced(production, today);
      return [
        {
          id: production.id,
          title: announced ? production.script.title : `${production.scale} ${production.genre} film`,
          genre: production.genre,
          targetAudience: production.targetAudience,
          scale: releaseScaleFromProduction(production.scale),
          releaseDay: production.releaseDay,
          studioId: production.rivalStudioId,
          studioName: rivalNameById.get(production.rivalStudioId) ?? 'A Rival Studio',
          isPlayer: false,
          announced,
          stars: announced ? leadActorNames(production.talent) : [],
          director: announced ? directorName(production.talent) : undefined,
        },
      ];
    }

    return [];
  });

  return entries.sort((a, b) => a.releaseDay - b.releaseDay);
}
