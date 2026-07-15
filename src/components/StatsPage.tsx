import { useState } from 'react';
import { useStudio } from '../state/StudioContext';
import {
  collectFilmStats, filterAndSortFilmStats, type FilmStatSortKey, type FilmStatsFilters,
  collectStudioStats, sortStudioStats, type StudioStatRow,
  collectPersonStats, filterAndSortPersonStats, type PersonStatRow, type StatSortKey,
} from '../state/selectors';
import { formatGameDate } from '../engine/calendar';
import { GENRES } from '../data/genres';
import { ALL_TALENT_ROLES } from '../data/talentGeneration';
import { Button } from './common/Button';
import { Money } from './common/Money';
import { FilmDetailModal } from './common/FilmDetailModal';
import type { Film, Genre, ProductionRole } from '../types';

const SORT_OPTIONS: Array<{ value: FilmStatSortKey; label: string }> = [
  { value: 'releasedOnDay', label: 'Release Date' },
  { value: 'title', label: 'Title' },
  { value: 'studio', label: 'Studio' },
  { value: 'genre', label: 'Genre' },
  { value: 'criticScore', label: 'Critic Score' },
  { value: 'audienceScore', label: 'Audience Score' },
  { value: 'buzzScore', label: 'Buzz Score' },
  { value: 'qualityScore', label: 'Quality Score' },
  { value: 'boxOffice', label: 'Box Office' },
  { value: 'profit', label: 'Profit / Loss' },
];

const AGG_SORT_OPTIONS: Array<{ value: StatSortKey; label: string }> = [
  { value: 'name', label: 'Name' },
  { value: 'filmCount', label: 'Films' },
  { value: 'avgCriticScore', label: 'Avg Critic Score' },
  { value: 'avgAudienceScore', label: 'Avg Audience Score' },
  { value: 'avgQualityScore', label: 'Avg Quality Score' },
  { value: 'totalBoxOffice', label: 'Total Box Office' },
  { value: 'totalProfit', label: 'Total Profit / Loss' },
  { value: 'hitCount', label: 'Hits' },
];

const ACTOR_ROLES: ProductionRole[] = ['Lead Actor', 'Supporting Actor'];

type StatsTab = 'studio' | 'film' | 'director' | 'actor';
const TABS: Array<{ value: StatsTab; label: string }> = [
  { value: 'studio', label: 'Studio' },
  { value: 'film', label: 'Film' },
  { value: 'director', label: 'Director' },
  { value: 'actor', label: 'Actor' },
];

/** Director credit, or the leads (a script can call for more than one) - same fallback either table row needs. */
function creditLine(film: Film, role: ProductionRole): string {
  const names = film.talent.filter((a) => a.role === role).map((a) => a.talent.name);
  return names.length > 0 ? names.join(', ') : '-';
}

/**
 * A filterable, sortable view across every film ever released - the
 * player's own (Studio.filmsReleased) and every rival's
 * (GameState.rivalFilmsReleased) - rather than a set of hardcoded named
 * queries. "Highest Rated Horror Film for studio X" is just Genre=Horror +
 * Studio=X + sort by Critic Score on the Film tab; "who's the most
 * bankable Director" is the same underlying film pool rolled up per person
 * instead of per release. See state/selectors.ts - nothing here is new
 * tracked state, just four views over what's already stored forever.
 */
export function StatsPage() {
  const { state } = useStudio();
  const { studio } = state;
  const [selectedFilm, setSelectedFilm] = useState<Film | null>(null);

  const [activeTab, setActiveTab] = useState<StatsTab>('studio');

  // Shared base filters - narrow the underlying film pool every tab aggregates over.
  const [studioName, setStudioName] = useState<string | 'all'>('all');
  const [genre, setGenre] = useState<Genre | 'all'>('all');

  // Film tab.
  const [role, setRole] = useState<ProductionRole | 'any'>('any');
  const [personName, setPersonName] = useState('');
  const [filmSortBy, setFilmSortBy] = useState<FilmStatSortKey>('releasedOnDay');
  const [filmSortDirection, setFilmSortDirection] = useState<'asc' | 'desc'>('desc');

  // Studio/Director/Actor tabs share one sort control - same metrics apply to all three.
  const [aggSortBy, setAggSortBy] = useState<StatSortKey>('totalBoxOffice');
  const [aggSortDirection, setAggSortDirection] = useState<'asc' | 'desc'>('desc');

  // Director/Actor tabs.
  const [personSearch, setPersonSearch] = useState('');
  const [actorRoleFilter, setActorRoleFilter] = useState<ProductionRole | 'any'>('any');

  const allRows = collectFilmStats(state.projects, studio.name);
  const baseRows = genre === 'all' ? allRows : allRows.filter((row) => row.film.genre === genre);

  const filmFilters: FilmStatsFilters = { studioName, genre, role, personName, sortBy: filmSortBy, sortDirection: filmSortDirection };
  const filmRows = filterAndSortFilmStats(allRows, filmFilters);

  const studioStatRows = sortStudioStats(collectStudioStats(baseRows), { sortBy: aggSortBy, sortDirection: aggSortDirection });
  const directorStatRows = filterAndSortPersonStats(
    collectPersonStats(baseRows, ['Director']),
    { nameSearch: personSearch, sortBy: aggSortBy, sortDirection: aggSortDirection },
  );
  const actorRoles = actorRoleFilter === 'any' ? ACTOR_ROLES : [actorRoleFilter];
  const actorStatRows = filterAndSortPersonStats(
    collectPersonStats(baseRows, actorRoles),
    { nameSearch: personSearch, sortBy: aggSortBy, sortDirection: aggSortDirection },
  );

  function jumpToFilmsFor(filters: { studioName?: string | 'all'; role?: ProductionRole | 'any'; personName?: string }) {
    setActiveTab('film');
    setStudioName(filters.studioName ?? 'all');
    setRole(filters.role ?? 'any');
    setPersonName(filters.personName ?? '');
  }

  return (
    <div className="stack">
      {selectedFilm && <FilmDetailModal film={selectedFilm} onClose={() => setSelectedFilm(null)} />}

      <h1 style={{ margin: 0 }}>Studio Stats</h1>

      <div className="row" style={{ gap: 8 }}>
        {TABS.map((tab) => (
          <Button key={tab.value} variant={activeTab === tab.value ? 'primary' : 'secondary'} onClick={() => setActiveTab(tab.value)}>
            {tab.label}
          </Button>
        ))}
      </div>

      <div className="card row" style={{ flexWrap: 'wrap', gap: 12 }}>
        <label className="stack" style={{ gap: 4 }}>
          <span className="stat-label">Genre</span>
          <select value={genre} onChange={(e) => setGenre(e.target.value as Genre | 'all')}>
            <option value="all">All Genres</option>
            {GENRES.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </label>

        {activeTab === 'film' && (
          <>
            <label className="stack" style={{ gap: 4 }}>
              <span className="stat-label">Studio</span>
              <select value={studioName} onChange={(e) => setStudioName(e.target.value)}>
                <option value="all">All Studios</option>
                <option value={studio.name}>{studio.name} (you)</option>
                {state.rivalStudios.map((r) => (
                  <option key={r.id} value={r.name}>{r.name}</option>
                ))}
              </select>
            </label>

            <label className="stack" style={{ gap: 4 }}>
              <span className="stat-label">Role</span>
              <select value={role} onChange={(e) => setRole(e.target.value as ProductionRole | 'any')}>
                <option value="any">Any Role</option>
                {ALL_TALENT_ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>

            <label className="stack" style={{ gap: 4 }}>
              <span className="stat-label">Director / Actor Name</span>
              <input type="text" placeholder="Search by name..." value={personName} onChange={(e) => setPersonName(e.target.value)} />
            </label>

            <label className="stack" style={{ gap: 4 }}>
              <span className="stat-label">Sort By</span>
              <select value={filmSortBy} onChange={(e) => setFilmSortBy(e.target.value as FilmStatSortKey)}>
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>

            <Button onClick={() => setFilmSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}>
              {filmSortDirection === 'asc' ? 'Ascending ↑' : 'Descending ↓'}
            </Button>
          </>
        )}

        {(activeTab === 'director' || activeTab === 'actor') && (
          <label className="stack" style={{ gap: 4 }}>
            <span className="stat-label">Name</span>
            <input type="text" placeholder="Search by name..." value={personSearch} onChange={(e) => setPersonSearch(e.target.value)} />
          </label>
        )}

        {activeTab === 'actor' && (
          <label className="stack" style={{ gap: 4 }}>
            <span className="stat-label">Credit</span>
            <select value={actorRoleFilter} onChange={(e) => setActorRoleFilter(e.target.value as ProductionRole | 'any')}>
              <option value="any">Lead + Supporting</option>
              <option value="Lead Actor">Lead Actor</option>
              <option value="Supporting Actor">Supporting Actor</option>
            </select>
          </label>
        )}

        {(activeTab === 'studio' || activeTab === 'director' || activeTab === 'actor') && (
          <>
            <label className="stack" style={{ gap: 4 }}>
              <span className="stat-label">Sort By</span>
              <select value={aggSortBy} onChange={(e) => setAggSortBy(e.target.value as StatSortKey)}>
                {AGG_SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>

            <Button onClick={() => setAggSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}>
              {aggSortDirection === 'asc' ? 'Ascending ↑' : 'Descending ↓'}
            </Button>
          </>
        )}
      </div>

      {activeTab === 'studio' && (
        <StudioStatsTable rows={studioStatRows} onSelect={(row) => jumpToFilmsFor({ studioName: row.studioName })} />
      )}

      {activeTab === 'film' && (
        <>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            Showing {filmRows.length} of {allRows.length} film{allRows.length === 1 ? '' : 's'}.
          </p>
          <FilmStatsTable rows={filmRows} onSelect={setSelectedFilm} />
        </>
      )}

      {activeTab === 'director' && (
        <PersonStatsTable rows={directorStatRows} onSelect={(row) => jumpToFilmsFor({ role: 'Director', personName: row.name })} />
      )}

      {activeTab === 'actor' && (
        <PersonStatsTable rows={actorStatRows} onSelect={(row) => jumpToFilmsFor({ role: 'any', personName: row.name })} />
      )}
    </div>
  );
}

function StudioStatsTable({ rows, onSelect }: { rows: StudioStatRow[]; onSelect: (row: StudioStatRow) => void }) {
  return (
    <div className="card">
      {rows.length === 0 ? (
        <p>No studios have released a matching film.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Studio</th>
                <th>Films</th>
                <th>Avg Critic</th>
                <th>Avg Audience</th>
                <th>Avg Quality</th>
                <th>Total Box Office</th>
                <th>Total Profit / Loss</th>
                <th>Hits</th>
                <th>Flops</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.studioName} className="film-history-row" onClick={() => onSelect(row)}>
                  <td>{row.studioName}{row.isPlayer ? ' (you)' : ''}</td>
                  <td>{row.filmCount}</td>
                  <td>{Math.round(row.avgCriticScore)}</td>
                  <td>{Math.round(row.avgAudienceScore)}</td>
                  <td>{Math.round(row.avgQualityScore)}</td>
                  <td><Money amount={row.totalBoxOffice} /></td>
                  <td><Money amount={row.totalProfit} signColor showSign /></td>
                  <td>{row.hitCount}</td>
                  <td>{row.flopCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PersonStatsTable({ rows, onSelect }: { rows: PersonStatRow[]; onSelect: (row: PersonStatRow) => void }) {
  return (
    <div className="card">
      {rows.length === 0 ? (
        <p>No one matches these filters.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Films</th>
                <th>Avg Critic</th>
                <th>Avg Audience</th>
                <th>Avg Quality</th>
                <th>Total Box Office</th>
                <th>Total Profit / Loss</th>
                <th>Hits</th>
                <th>Flops</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="film-history-row" onClick={() => onSelect(row)}>
                  <td>{row.name}</td>
                  <td>{row.filmCount}</td>
                  <td>{Math.round(row.avgCriticScore)}</td>
                  <td>{Math.round(row.avgAudienceScore)}</td>
                  <td>{Math.round(row.avgQualityScore)}</td>
                  <td><Money amount={row.totalBoxOffice} /></td>
                  <td><Money amount={row.totalProfit} signColor showSign /></td>
                  <td>{row.hitCount}</td>
                  <td>{row.flopCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilmStatsTable({ rows, onSelect }: { rows: ReturnType<typeof filterAndSortFilmStats>; onSelect: (film: Film) => void }) {
  return (
    <div className="card">
      {rows.length === 0 ? (
        <p>No films match these filters.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Studio</th>
                <th>Genre</th>
                <th>Director</th>
                <th>Lead(s)</th>
                <th>Released</th>
                <th>Critic</th>
                <th>Audience</th>
                <th>Quality</th>
                <th>Box Office</th>
                <th>Profit / Loss</th>
                <th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ film, studioName: rowStudioName }) => {
                const running = film.boxOfficeRun.status === 'running';
                return (
                  <tr key={film.id} className="film-history-row" onClick={() => onSelect(film)}>
                    <td>{film.title}</td>
                    <td>{rowStudioName}</td>
                    <td>{film.genre}</td>
                    <td>{creditLine(film, 'Director')}</td>
                    <td>{creditLine(film, 'Lead Actor')}</td>
                    <td>{formatGameDate(film.releasedOnDay)}</td>
                    <td>{film.results.criticScore}</td>
                    <td>{film.results.audienceScore}</td>
                    <td>{Math.round(film.results.qualityScore)}</td>
                    <td>
                      {running ? (
                        <span style={{ color: 'var(--text-muted)' }}><Money amount={film.boxOfficeRun.cumulativeGross} /> so far</span>
                      ) : (
                        <Money amount={film.results.totalBoxOffice ?? 0} />
                      )}
                    </td>
                    <td>
                      {running || film.results.profit === null ? (
                        <span style={{ color: 'var(--text-muted)' }}>Pending</span>
                      ) : (
                        <Money amount={film.results.profit} signColor showSign />
                      )}
                    </td>
                    <td>
                      {running || !film.results.outcome ? (
                        <span className="badge">In Theaters</span>
                      ) : (
                        <span className={`badge badge-outcome-${film.results.outcome.replace(/\s+/g, '-')}`}>
                          {film.results.outcome}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
