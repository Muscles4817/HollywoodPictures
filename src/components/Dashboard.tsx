import { useState } from 'react';
import { useStudio } from '../state/StudioContext';
import { exportFilmHistory } from '../state/exportFilmHistory';
import { formatGameDate } from '../engine/calendar';
import { Button } from './common/Button';
import { StatTile } from './common/StatTile';
import { Money } from './common/Money';
import { GameGuide } from './common/GameGuide';
import { BoxOfficeChart } from './common/BoxOfficeChart';
import { BoxOfficeFinishedPopup } from './common/BoxOfficeFinishedPopup';
import { FilmDetailModal } from './common/FilmDetailModal';
import { TimeTickIndicator } from './common/TimeTickIndicator';
import { TopGrossingPanel } from './common/TopGrossingPanel';
import { DifficultyPicker } from './common/DifficultyPicker';
import { computeTopGrossingFilms, deriveProjectsView } from '../state/selectors';
import { asFilm, asPlayerDraft } from '../engine/project';
import type { TickSpeedMultiplier } from '../constants';
import type { Film } from '../types';

interface DashboardProps {
  paused: boolean;
  onTogglePause: () => void;
  tickNonce: number;
  speedMultiplier: TickSpeedMultiplier;
  onSetSpeedMultiplier: (speed: TickSpeedMultiplier) => void;
}

export function Dashboard({ paused, onTogglePause, tickNonce, speedMultiplier, onSetSpeedMultiplier }: DashboardProps) {
  const { state, dispatch } = useStudio();
  const { studio } = state;
  const [showGuide, setShowGuide] = useState(false);
  const [selectedFilm, setSelectedFilm] = useState<Film | null>(null);
  const [showResetPicker, setShowResetPicker] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(studio.name);
  // Which running-film panels are collapsed - plain UI state, not persisted,
  // same as everything else in this component that's about how the
  // Dashboard looks rather than the game itself.
  const [collapsedFilmIds, setCollapsedFilmIds] = useState<Set<string>>(new Set());

  function startEditingName() {
    setNameDraft(studio.name);
    setEditingName(true);
  }

  function commitNameEdit() {
    const trimmed = nameDraft.trim();
    if (trimmed) dispatch({ type: 'RENAME_STUDIO', name: trimmed });
    setEditingName(false);
  }

  function toggleCollapsed(filmId: string) {
    setCollapsedFilmIds((prev) => {
      const next = new Set(prev);
      if (next.has(filmId)) next.delete(filmId);
      else next.add(filmId);
      return next;
    });
  }

  if (showGuide) {
    return <GameGuide onBack={() => setShowGuide(false)} />;
  }

  // deriveProjectsView (roadmap Phase 4.1) folds the still-fragmented
  // storage into one list; RETURN_TO_DASHBOARD always clears state.draft
  // (see state/studioReducer.ts), so the 'player-in-progress' subset here is
  // exactly studio.productionsInProgress - nothing behaves differently by
  // reading it through the derived view instead.
  const projects = deriveProjectsView(state);
  const playerReleasedFilms = projects.flatMap((p) => {
    const film = asFilm(p);
    return film && film.releasedBy === undefined ? [film] : [];
  });
  const backgroundedDrafts = projects.flatMap((p) => {
    const draft = asPlayerDraft(p);
    return draft ? [draft] : [];
  });
  const runningFilms = playerReleasedFilms.filter((f) => f.boxOfficeRun.status === 'running');
  // Only ever surface one at a time, oldest-unseen-first, so a second
  // "film finished" popup doesn't stack behind/interrupt the first.
  const unacknowledgedFinished = playerReleasedFilms.find((f) => f.boxOfficeRun.status === 'finished' && !f.boxOfficeRun.acknowledged);

  return (
    <div className="stack">
      {unacknowledgedFinished && <BoxOfficeFinishedPopup film={unacknowledgedFinished} />}
      {selectedFilm && <FilmDetailModal film={selectedFilm} onClose={() => setSelectedFilm(null)} />}
      {showResetPicker && (
        <DifficultyPicker
          studioName={studio.name}
          onCancel={() => setShowResetPicker(false)}
          onConfirm={(startingCash) => {
            dispatch({ type: 'RESET_SAVE', startingCash });
            setShowResetPicker(false);
          }}
        />
      )}

      <div className="row-between">
        <div>
          {editingName ? (
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitNameEdit();
                  if (e.key === 'Escape') setEditingName(false);
                }}
                autoFocus
                style={{ fontSize: '1.5em', fontWeight: 700, maxWidth: 360 }}
              />
              <Button className="btn-sm" variant="primary" onClick={commitNameEdit}>Save</Button>
              <Button className="btn-sm" onClick={() => setEditingName(false)}>Cancel</Button>
            </div>
          ) : (
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <h1 style={{ margin: 0 }}>{studio.name}</h1>
              <Button className="btn-sm" onClick={startEditingName}>Rename</Button>
            </div>
          )}
          <p>{formatGameDate(state.totalDays)} &middot; {studio.filmsReleased.length} film{studio.filmsReleased.length === 1 ? '' : 's'} released</p>
        </div>
        <div className="row">
          <TimeTickIndicator
            paused={paused}
            onTogglePause={onTogglePause}
            tickNonce={tickNonce}
            speedMultiplier={speedMultiplier}
            onSetSpeedMultiplier={onSetSpeedMultiplier}
          />
          <Button onClick={() => dispatch({ type: 'VIEW_STATS' })}>Stats</Button>
          <Button onClick={() => setShowGuide(true)}>How It Works</Button>
          <Button onClick={() => setShowResetPicker(true)}>Reset Studio</Button>
          <Button variant="primary" onClick={() => dispatch({ type: 'START_NEW_FILM' })}>
            Start New Film
          </Button>
        </div>
      </div>

      <div className="row">
        <StatTile label="Studio Cash" value={<Money amount={studio.cash} signColor />} />
        <StatTile label="Reputation" value={`${studio.reputation} / 100`} />
        <StatTile label="Films Released" value={studio.filmsReleased.length} />
        <StatTile label="Current Date" value={formatGameDate(state.totalDays)} />
      </div>

      <div className="dashboard-layout">
        <div className="stack">
          {runningFilms.map((film) => {
            const collapsed = collapsedFilmIds.has(film.id);
            return (
              <div className="card stack" key={film.id}>
                <div className="row-between">
                  <h2 style={{ margin: 0 }}>{film.title} - In Theaters</h2>
                  <div className="row" style={{ gap: 12 }}>
                    {collapsed && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85em' }}>
                        Week {film.boxOfficeRun.weeks.length} &middot; <Money amount={film.boxOfficeRun.cumulativeGross} /> so far
                      </span>
                    )}
                    <Button className="btn-sm" onClick={() => toggleCollapsed(film.id)}>
                      {collapsed ? 'Expand' : 'Collapse'}
                    </Button>
                  </div>
                </div>
                {!collapsed && (
                  <>
                    <div className="row">
                      <StatTile label="Week" value={film.boxOfficeRun.weeks.length} />
                      <StatTile label="Opening Weekend" value={<Money amount={film.results.openingWeekend} />} />
                      <StatTile label="Gross So Far" value={<Money amount={film.boxOfficeRun.cumulativeGross} />} />
                    </div>
                    <BoxOfficeChart weeks={film.boxOfficeRun.weeks} />
                    <p className="choice-description" style={{ margin: 0 }}>
                      Updates as time passes - keep developing your next film and the numbers here will keep climbing (or fading) week by week.
                    </p>
                  </>
                )}
              </div>
            );
          })}

          {backgroundedDrafts.map((production) => {
            const photography = production.photography;
            if (!photography) return null;
            const statusLabel =
              photography.status === 'awaiting-choice'
                ? 'Awaiting your decision - check the Inbox'
                : photography.status === 'finished'
                  ? 'Wrapped - ready for post-production (check the Inbox)'
                  : 'Shooting in the background';
            return (
              <div className="card stack" key={production.id}>
                <div className="row-between">
                  <h2 style={{ margin: 0 }}>{production.title || 'Untitled Film'}</h2>
                  <div className="row" style={{ gap: 8 }}>
                    <Button className="btn-sm" onClick={() => dispatch({ type: 'VIEW_PRODUCTION', productionId: production.id })}>
                      View
                    </Button>
                    {photography.status === 'in-progress' && (
                      <Button
                        className="btn-sm"
                        onClick={() => dispatch({ type: 'FINISH_PHOTOGRAPHY', productionId: production.id })}
                      >
                        Finish Principal Photography
                      </Button>
                    )}
                  </div>
                </div>
                <div className="row">
                  <StatTile label="Status" value={statusLabel} />
                  <StatTile label="Day" value={`${photography.daysElapsed} of ~${photography.recommendedDays} recommended`} />
                  <StatTile label="Spent So Far" value={<Money amount={photography.runningCost} />} />
                </div>
              </div>
            );
          })}

          <div className="card">
            <div className="row-between">
              <h2 style={{ margin: 0 }}>Studio History</h2>
              <Button disabled={studio.filmsReleased.length === 0} onClick={() => exportFilmHistory(studio, state.totalDays)}>
                Export Film History (JSON)
              </Button>
            </div>
            {studio.filmsReleased.length === 0 ? (
              <p>No films released yet. Start your first production to build a track record.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Genre</th>
                      <th>Released</th>
                      <th>Total Cost</th>
                      <th>Box Office</th>
                      <th>Critic Score</th>
                      <th>Outcome</th>
                      <th>Profit / Loss</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...studio.filmsReleased].reverse().map((film) => {
                      const running = film.boxOfficeRun.status === 'running';
                      return (
                        <tr key={film.id} className="film-history-row" onClick={() => setSelectedFilm(film)}>
                          <td>{film.title}</td>
                          <td>{film.genre}</td>
                          <td>{formatGameDate(film.releasedOnDay)}</td>
                          <td><Money amount={film.results.totalCost} /></td>
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
                          <td>
                            {running || film.results.profit === null ? (
                              <span style={{ color: 'var(--text-muted)' }}>Pending</span>
                            ) : (
                              <Money amount={film.results.profit} signColor showSign />
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

        <div className="dashboard-right-rail">
          <TopGrossingPanel
            entries={computeTopGrossingFilms(projects, studio.name)}
            playerStudioName={studio.name}
            onSelectFilm={setSelectedFilm}
            onSelectStudio={(studioName) => dispatch({ type: 'VIEW_RIVAL_STUDIO', studioName })}
          />

          <div className="card stack">
            <h2 style={{ margin: 0 }}>Rival Studios</h2>
            <div className="stack" style={{ gap: 10 }}>
              {state.rivalStudios.map((rival) => (
                <button
                  key={rival.id}
                  className="top-grossing-row"
                  onClick={() => dispatch({ type: 'VIEW_RIVAL_STUDIO', studioName: rival.name })}
                >
                  <span className="top-grossing-details">
                    <span className="top-grossing-title">{rival.name}</span>
                    <span className="top-grossing-studio">{rival.tier}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
