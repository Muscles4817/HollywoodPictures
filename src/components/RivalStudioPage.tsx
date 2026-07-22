import { useState } from 'react';
import { useStudio } from '../state/StudioContext';
import { formatGameDateWithMonth, formatGameMonthYear } from '../engine/calendar';
import { StatTile } from './common/StatTile';
import { Money } from './common/Money';
import { FilmDetailModal } from './common/FilmDetailModal';
import { asFilm, asRivalProduction } from '../engine/project';
import { rivalReleaseIsAnnounced } from '../engine/rivalStudios';
import type { Film } from '../types';

/**
 * A rival studio's own read-only page - its released films (out of
 * GameState.projects, filtered by name, same as the Top 10 chart) plus a
 * teaser of what it's currently making, without the full detail the player
 * gets on their own production (see engine/rivalStudios.ts:RivalProductionInProgress).
 * Reached from a Top 10 row or the Dashboard's "Rival Studios" list; the
 * only way back is the header's persistent Dashboard button.
 */
export function RivalStudioPage() {
  const { state } = useStudio();
  const [selectedFilm, setSelectedFilm] = useState<Film | null>(null);

  const rival = state.rivalStudios.find((r) => r.name === state.viewingRivalStudioName);
  const { projects } = state;
  const films = projects
    .flatMap((p) => {
      const film = asFilm(p);
      return film && film.releasedBy === state.viewingRivalStudioName ? [film] : [];
    })
    .sort((a, b) => b.releasedOnDay - a.releasedOnDay);
  const inProgress = rival
    ? projects.flatMap((p) => {
        const production = asRivalProduction(p);
        return production && production.rivalStudioId === rival.id ? [production] : [];
      })
    : [];

  if (!rival) {
    return (
      <div className="stack">
        <h1>Studio Not Found</h1>
      </div>
    );
  }

  const totalGross = films.reduce((sum, f) => sum + f.boxOfficeRun.cumulativeGross, 0);

  return (
    <div className="stack">
      {selectedFilm && <FilmDetailModal film={selectedFilm} onClose={() => setSelectedFilm(null)} />}

      <div>
        <h1>{rival.name}</h1>
        <p><span className="badge">{rival.tier}</span></p>
      </div>

      <div className="row">
        <StatTile label="Films Released" value={films.length} />
        <StatTile label="Lifetime Box Office" value={<Money amount={totalGross} />} />
        <StatTile label="Currently In Production" value={inProgress.length} />
      </div>

      <div className="row">
        <StatTile label="Cash" value={<Money amount={rival.cash} signColor />} />
        <StatTile label="Brand Recognition" value={`${rival.brand} / 100`} />
        <StatTile label="Prestige" value={`${rival.prestige} / 100`} />
      </div>

      {inProgress.length > 0 && (
        <div className="card stack">
          <h2 style={{ margin: 0 }}>In Production</h2>
          {inProgress.map((p) => {
            // Once the marketing rollout begins (engine/rivalStudios.ts) the real
            // title and cast are public; before that it's an under-wraps project
            // the player only knows the scale/genre of.
            const announced = rivalReleaseIsAnnounced(p, state.totalDays);
            const stars = p.talent.filter((a) => a.role === 'Lead Actor').map((a) => a.person.identity.name);
            const director = p.talent.find((a) => a.role === 'Director')?.person.identity.name;
            return (
              <div className="row-between" key={p.id}>
                <span className="stack" style={{ gap: 2 }}>
                  <strong>{announced ? p.script.title : `${p.scale} ${p.genre} film`}</strong>
                  {announced ? (
                    <small style={{ color: 'var(--text-muted)' }}>
                      {stars.length > 0 ? `Starring ${stars.join(', ')}` : ''}
                      {stars.length > 0 && director ? ' · ' : ''}
                      {director ? `Dir. ${director}` : ''}
                    </small>
                  ) : (
                    <small style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Title &amp; cast under wraps</small>
                  )}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>Expected {formatGameMonthYear(p.releaseDay)}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="card">
        <h2 style={{ margin: 0 }}>Release History</h2>
        {films.length === 0 ? (
          <p>Nothing released yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Genre</th>
                  <th>Released</th>
                  <th>Box Office</th>
                  <th>Critic Score</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {films.map((film) => {
                  const running = film.boxOfficeRun.status === 'running';
                  return (
                    <tr key={film.id} className="film-history-row" onClick={() => setSelectedFilm(film)}>
                      <td>{film.title}</td>
                      <td>{film.genre}</td>
                      <td>{formatGameDateWithMonth(film.releasedOnDay)}</td>
                      <td>
                        {running ? (
                          <span style={{ color: 'var(--text-muted)' }}><Money amount={film.boxOfficeRun.cumulativeGross} /> so far</span>
                        ) : (
                          <Money amount={film.results.totalBoxOffice ?? 0} />
                        )}
                      </td>
                      <td>{film.results.criticScore}</td>
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
    </div>
  );
}
