import { useMemo, useState } from 'react';
import { useStudio } from '../state/StudioContext';
import { exportFilmHistory } from '../state/exportFilmHistory';
import { formatGameDate, formatGameMonthYear } from '../engine/calendar';
import { Button } from './common/Button';
import { StatTile } from './common/StatTile';
import { Money } from './common/Money';
import { GameGuide } from './common/GameGuide';
import { BoxOfficeChart } from './common/BoxOfficeChart';
import { BoxOfficeFinishedPopup } from './common/BoxOfficeFinishedPopup';
import { FilmDetailModal } from './common/FilmDetailModal';
import { TopGrossingPanel } from './common/TopGrossingPanel';
import { DifficultyPicker } from './common/DifficultyPicker';
import { computeTopGrossingFilms, hasDraftProgress } from '../state/selectors';
import { asFilm, asPlayerDraft, asScheduled } from '../engine/project';
import { MANDATORY_TALENT_ROLES } from '../data/talentGeneration';
import { effectiveRoleCapacity } from '../engine/castRequirements';
import type { Film, FilmDraft } from '../types';
import './Dashboard.css';

type ActivityItem = {
  id: string;
  tone: 'urgent' | 'warning' | 'positive' | 'neutral';
  eyebrow: string;
  title: string;
  detail: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function Dashboard() {
  const { state, dispatch } = useStudio();
  const { studio } = state;
  const [showGuide, setShowGuide] = useState(false);
  const [selectedFilm, setSelectedFilm] = useState<Film | null>(null);
  const [showResetPicker, setShowResetPicker] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(studio.name);
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

  const { projects } = state;

  const playerReleasedFilms = projects.flatMap((project) => {
    const film = asFilm(project);
    return film && film.releasedBy === undefined ? [film] : [];
  });

  const backgroundedDrafts = projects.flatMap((project) => {
    const draft = asPlayerDraft(project);
    return draft ? [draft] : [];
  });

  const scheduledReleases = projects
    .flatMap((project) => {
      const scheduled = asScheduled(project);
      return scheduled ? [scheduled] : [];
    })
    .sort((a, b) => a.releaseDay - b.releaseDay);

  const runningFilms = playerReleasedFilms.filter((film) => film.boxOfficeRun.status === 'running');
  const finishedFilms = playerReleasedFilms.filter((film) => film.boxOfficeRun.status === 'finished');
  const unacknowledgedFinished = playerReleasedFilms.find(
    (film) => film.boxOfficeRun.status === 'finished' && !film.boxOfficeRun.acknowledged,
  );

  const attentionDrafts = backgroundedDrafts.filter((production) => {
    const status = production.photography?.status;
    return status === 'awaiting-choice' || status === 'finished';
  });

  const activeShoots = backgroundedDrafts.filter(
    (production) => production.photography?.status === 'in-progress',
  );

  // A backgrounded draft the player has started staffing (a hire, a
  // casting call, or a production plan) but hasn't greenlit yet - these
  // used to be entirely invisible here (the row list below only ever
  // rendered drafts with `photography` set) and read as "Shelved" on the
  // Projects page, indistinguishable from a script nobody's touched since
  // acquisition (state/selectors.ts:hasDraftProgress).
  const staffingDrafts = backgroundedDrafts.filter(
    (production) => !production.photography && hasDraftProgress(production),
  );

  const weeklyGross = runningFilms.reduce((total, film) => {
    const latestWeek = film.boxOfficeRun.weeks.at(-1);
    return total + getWeekGross(latestWeek);
  }, 0);

  const nextRelease = scheduledReleases[0];

  const activityItems = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];

    attentionDrafts.forEach((production) => {
      const status = production.photography?.status;
      const title = production.title || 'Untitled Film';

      if (status === 'awaiting-choice') {
        items.push({
          id: `${production.id}-decision`,
          tone: 'urgent',
          eyebrow: 'Decision required',
          title,
          detail: 'Production is paused until you resolve the latest on-set decision.',
          actionLabel: 'Open project',
          onAction: () => dispatch({ type: 'VIEW_PRODUCTION', productionId: production.id }),
        });
      } else if (status === 'finished') {
        items.push({
          id: `${production.id}-wrapped`,
          tone: 'warning',
          eyebrow: production.postProductionChoices ? 'Release preparation' : 'Post-production ready',
          title,
          detail: production.postProductionChoices
            ? 'The film is complete and waiting for its release day.'
            : 'Principal photography has wrapped and the film is ready for post-production.',
          actionLabel: 'Open project',
          onAction: () => dispatch({ type: 'VIEW_PRODUCTION', productionId: production.id }),
        });
      }
    });

    runningFilms.forEach((film) => {
      const latestWeek = film.boxOfficeRun.weeks.at(-1);
      items.push({
        id: `${film.id}-cinemas`,
        tone: 'positive',
        eyebrow: `In theatres · Week ${film.boxOfficeRun.weeks.length}`,
        title: film.title,
        detail: latestWeek
          ? `${formatMoney(getWeekGross(latestWeek))} this week · ${formatMoney(film.boxOfficeRun.cumulativeGross)} total`
          : `${formatMoney(film.boxOfficeRun.cumulativeGross)} gross so far`,
        actionLabel: 'View performance',
        onAction: () => setSelectedFilm(film),
      });
    });

    if (nextRelease) {
      items.push({
        id: `${nextRelease.draft.id}-release`,
        tone: 'neutral',
        eyebrow: 'Next release',
        title: nextRelease.draft.title || 'Untitled Film',
        detail: `Scheduled for ${formatGameMonthYear(nextRelease.releaseDay)}.`,
        actionLabel: 'Open calendar',
        onAction: () => dispatch({ type: 'VIEW_RELEASE_CALENDAR' }),
      });
    }

    if (items.length === 0) {
      items.push({
        id: 'start-first-film',
        tone: 'neutral',
        eyebrow: 'Your studio is ready',
        title: 'Find your first project',
        detail: 'Browse the Opportunity Market, acquire a script and begin building your slate.',
        actionLabel: 'Browse opportunities',
        onAction: () => dispatch({ type: 'VIEW_OPPORTUNITY_MARKET' }),
      });
    }

    return items.slice(0, 5);
  }, [attentionDrafts, dispatch, nextRelease, runningFilms]);

  const studioTier = playerReleasedFilms.length >= 10
    ? 'Major studio'
    : playerReleasedFilms.length >= 4
      ? 'Established studio'
      : 'Independent studio';

  return (
    <div className="dashboard-page">
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

      <section className="dashboard-hero">
        <div className="dashboard-identity">
          {editingName ? (
            <div className="dashboard-name-editor">
              <input
                type="text"
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitNameEdit();
                  if (event.key === 'Escape') setEditingName(false);
                }}
                autoFocus
              />
              <Button className="btn-sm" variant="primary" onClick={commitNameEdit}>Save</Button>
              <Button className="btn-sm" onClick={() => setEditingName(false)}>Cancel</Button>
            </div>
          ) : (
            <div className="dashboard-title-row">
              <div>
                <div className="dashboard-kicker">{studioTier}</div>
                <h1>{studio.name}</h1>
              </div>
              <Button className="btn-sm dashboard-rename" onClick={startEditingName}>Rename</Button>
            </div>
          )}

          <div className="dashboard-identity-meta">
            <span>Year {Math.floor(state.totalDays / 365) + 1}</span>
            <span>{projects.length} active project{projects.length === 1 ? '' : 's'}</span>
            <span>{playerReleasedFilms.length} released film{playerReleasedFilms.length === 1 ? '' : 's'}</span>
          </div>
        </div>

        <div className="dashboard-primary-actions">
          <Button onClick={() => dispatch({ type: 'VIEW_PROJECTS' })}>View projects</Button>
          <Button variant="primary" onClick={() => dispatch({ type: 'VIEW_OPPORTUNITY_MARKET' })}>
            Find a project
          </Button>
        </div>
      </section>

      <nav className="dashboard-subnav" aria-label="Studio navigation">
        <button type="button" onClick={() => dispatch({ type: 'VIEW_ASSET_LIBRARY' })}>Asset Library</button>
        <button type="button" onClick={() => dispatch({ type: 'VIEW_RELEASE_CALENDAR' })}>Release Calendar</button>
        <button type="button" onClick={() => dispatch({ type: 'VIEW_STATS' })}>Studio Stats</button>
        <button type="button" onClick={() => setShowGuide(true)}>How It Works</button>
        <button type="button" className="dashboard-danger-link" onClick={() => setShowResetPicker(true)}>Reset Studio</button>
      </nav>

      <section className="dashboard-metrics" aria-label="Studio overview">
        <div className="dashboard-metric dashboard-metric-money">
          <span className="dashboard-metric-label">Studio cash</span>
          <strong><Money amount={studio.cash} signColor /></strong>
          <span className="dashboard-metric-note">Available to invest</span>
        </div>
        <div className="dashboard-metric dashboard-metric-brand">
          <span className="dashboard-metric-label">Brand recognition</span>
          <strong>{studio.brand}<small>/100</small></strong>
          <div className="dashboard-meter"><span style={{ width: `${studio.brand}%` }} /></div>
        </div>
        <div className="dashboard-metric dashboard-metric-prestige">
          <span className="dashboard-metric-label">Prestige</span>
          <strong>{studio.prestige}<small>/100</small></strong>
          <div className="dashboard-meter"><span style={{ width: `${studio.prestige}%` }} /></div>
        </div>
        <div className="dashboard-metric dashboard-metric-revenue">
          <span className="dashboard-metric-label">Weekly box office</span>
          <strong><Money amount={weeklyGross} /></strong>
          <span className="dashboard-metric-note">
            {runningFilms.length} film{runningFilms.length === 1 ? '' : 's'} currently playing
          </span>
        </div>
      </section>

      <div className="dashboard-main-grid">
        <main className="dashboard-main-column">
          <section className="dashboard-card dashboard-attention-card">
            <div className="dashboard-card-heading">
              <div>
                <span className="dashboard-section-kicker">Command centre</span>
                <h2>What’s happening</h2>
              </div>
              {attentionDrafts.length > 0 && (
                <span className="dashboard-attention-count">{attentionDrafts.length} need attention</span>
              )}
            </div>

            <div className="dashboard-activity-list">
              {activityItems.map((item) => (
                <article key={item.id} className={`dashboard-activity dashboard-activity-${item.tone}`}>
                  <span className="dashboard-activity-dot" aria-hidden="true" />
                  <div className="dashboard-activity-copy">
                    <span className="dashboard-activity-eyebrow">{item.eyebrow}</span>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </div>
                  {item.onAction && item.actionLabel && (
                    <Button className="btn-sm" onClick={item.onAction}>{item.actionLabel}</Button>
                  )}
                </article>
              ))}
            </div>
          </section>

          {(backgroundedDrafts.length > 0 || scheduledReleases.length > 0) && (
            <section className="dashboard-card">
              <div className="dashboard-card-heading">
                <div>
                  <span className="dashboard-section-kicker">Your slate</span>
                  <h2>Production pipeline</h2>
                </div>
                <Button className="btn-sm" onClick={() => dispatch({ type: 'VIEW_PROJECTS' })}>All projects</Button>
              </div>

              <div className="dashboard-pipeline-summary">
                <PipelineStat label="Staffing" value={staffingDrafts.length} />
                <PipelineStat label="Filming" value={activeShoots.length} />
                <PipelineStat label="Needs attention" value={attentionDrafts.length} emphasis={attentionDrafts.length > 0} />
                <PipelineStat label="Scheduled" value={scheduledReleases.length} />
                <PipelineStat label="In theatres" value={runningFilms.length} />
              </div>

              <div className="dashboard-project-list">
                {staffingDrafts.map((production) => (
                  <StaffingProjectRow key={production.id} production={production} onOpen={() => dispatch({ type: 'RESUME_PROJECT', projectId: production.id })} />
                ))}

                {backgroundedDrafts.map((production) => {
                  const photography = production.photography;
                  if (!photography) return null;

                  const statusLabel = photography.status === 'awaiting-choice'
                    ? 'Decision required'
                    : photography.status === 'finished'
                      ? production.postProductionChoices
                        ? 'Awaiting release'
                        : 'Ready for post-production'
                      : 'Principal photography';

                  return (
                    <article className="dashboard-project-row" key={production.id}>
                      <div className="dashboard-project-main">
                        <span className={`dashboard-status-pill dashboard-status-${photography.status}`}>
                          {statusLabel}
                        </span>
                        <strong>{production.title || 'Untitled Film'}</strong>
                        <span className="dashboard-project-meta">
                          Day {photography.daysElapsed} of ~{photography.recommendedDays} · <Money amount={photography.runningCost} /> spent
                        </span>
                      </div>
                      <div className="dashboard-project-actions">
                        <Button className="btn-sm" onClick={() => dispatch({ type: 'VIEW_PRODUCTION', productionId: production.id })}>
                          Open
                        </Button>
                        {photography.status === 'in-progress' && (
                          <Button
                            className="btn-sm"
                            onClick={() => dispatch({ type: 'FINISH_PHOTOGRAPHY', productionId: production.id })}
                          >
                            Finish shoot
                          </Button>
                        )}
                      </div>
                    </article>
                  );
                })}

                {scheduledReleases.map(({ draft, releaseDay }) => (
                  <article className="dashboard-project-row" key={draft.id}>
                    <div className="dashboard-project-main">
                      <span className="dashboard-status-pill dashboard-status-scheduled">Scheduled release</span>
                      <strong>{draft.title || 'Untitled Film'}</strong>
                      <span className="dashboard-project-meta">Releasing {formatGameMonthYear(releaseDay)}</span>
                    </div>
                    <Button className="btn-sm" onClick={() => dispatch({ type: 'VIEW_RELEASE_CALENDAR' })}>Calendar</Button>
                  </article>
                ))}
              </div>
            </section>
          )}

          {runningFilms.map((film) => {
            const collapsed = collapsedFilmIds.has(film.id);
            const latestWeek = film.boxOfficeRun.weeks.at(-1);

            return (
              <section className="dashboard-card dashboard-box-office-card" key={film.id}>
                <div className="dashboard-card-heading">
                  <div>
                    <span className="dashboard-section-kicker">Now playing · Week {film.boxOfficeRun.weeks.length}</span>
                    <h2>{film.title}</h2>
                  </div>
                  <div className="dashboard-heading-actions">
                    {collapsed && (
                      <span className="dashboard-muted">
                        <Money amount={film.boxOfficeRun.cumulativeGross} /> total
                      </span>
                    )}
                    <Button className="btn-sm" onClick={() => toggleCollapsed(film.id)}>
                      {collapsed ? 'Expand' : 'Collapse'}
                    </Button>
                  </div>
                </div>

                {!collapsed && (
                  <>
                    <div className="dashboard-film-metrics">
                      <StatTile label="This Week" value={<Money amount={getWeekGross(latestWeek)} />} />
                      <StatTile label="Opening Weekend" value={<Money amount={film.results.openingWeekend} />} />
                      <StatTile label="Gross So Far" value={<Money amount={film.boxOfficeRun.cumulativeGross} />} />
                    </div>
                    <BoxOfficeChart weeks={film.boxOfficeRun.weeks} />
                  </>
                )}
              </section>
            );
          })}

          <section className="dashboard-card">
            <div className="dashboard-card-heading">
              <div>
                <span className="dashboard-section-kicker">Track record</span>
                <h2>Filmography</h2>
              </div>
              <Button
                className="btn-sm"
                disabled={playerReleasedFilms.length === 0}
                onClick={() => exportFilmHistory(studio, playerReleasedFilms, state.totalDays)}
              >
                Export JSON
              </Button>
            </div>

            {playerReleasedFilms.length === 0 ? (
              <div className="dashboard-empty-state">
                <span className="dashboard-empty-icon" aria-hidden="true">◆</span>
                <h3>Your story starts with the first release</h3>
                <p>Completed films, studio records and long-term performance will appear here.</p>
                <Button variant="primary" onClick={() => dispatch({ type: 'VIEW_OPPORTUNITY_MARKET' })}>
                  Browse the Opportunity Market
                </Button>
              </div>
            ) : (
              <div className="dashboard-table-wrap">
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
                    {[...playerReleasedFilms].reverse().map((film) => {
                      const running = film.boxOfficeRun.status === 'running';
                      return (
                        <tr key={film.id} className="film-history-row" onClick={() => setSelectedFilm(film)}>
                          <td><strong>{film.title}</strong></td>
                          <td>{film.genre}</td>
                          <td>{formatGameDate(film.releasedOnDay)}</td>
                          <td><Money amount={film.results.totalCost} /></td>
                          <td>
                            {running
                              ? <span className="dashboard-muted"><Money amount={film.boxOfficeRun.cumulativeGross} /> so far</span>
                              : <Money amount={film.results.totalBoxOffice ?? 0} />}
                          </td>
                          <td>{film.results.criticScore}</td>
                          <td>
                            {running || !film.results.outcome
                              ? <span className="badge">In Theaters</span>
                              : (
                                <span className={`badge badge-outcome-${film.results.outcome.replace(/\s+/g, '-')}`}>
                                  {film.results.outcome}
                                </span>
                              )}
                          </td>
                          <td>
                            {running || film.results.profit === null
                              ? <span className="dashboard-muted">Pending</span>
                              : <Money amount={film.results.profit} signColor showSign />}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>

        <aside className="dashboard-sidebar">
          <section className="dashboard-card dashboard-sidebar-card dashboard-box-office-sidebar">
            <div className="dashboard-card-heading dashboard-sidebar-heading">
              <div>
                <span className="dashboard-section-kicker">Industry pulse</span>
                <h2>Box office this week</h2>
              </div>
            </div>
            <TopGrossingPanel
              entries={computeTopGrossingFilms(projects, studio.name)}
              playerStudioName={studio.name}
              onSelectFilm={setSelectedFilm}
              onSelectStudio={(studioName) => dispatch({ type: 'VIEW_RIVAL_STUDIO', studioName })}
            />
          </section>

          <section className="dashboard-card dashboard-sidebar-card">
            <div className="dashboard-card-heading dashboard-sidebar-heading">
              <div>
                <span className="dashboard-section-kicker">Coming up</span>
                <h2>Release calendar</h2>
              </div>
              <Button className="btn-sm" onClick={() => dispatch({ type: 'VIEW_RELEASE_CALENDAR' })}>View</Button>
            </div>

            {scheduledReleases.length === 0 ? (
              <p className="dashboard-sidebar-empty">No player releases are currently scheduled.</p>
            ) : (
              <div className="dashboard-upcoming-list">
                {scheduledReleases.slice(0, 4).map(({ draft, releaseDay }) => (
                  <button
                    type="button"
                    key={draft.id}
                    className="dashboard-upcoming-row"
                    onClick={() => dispatch({ type: 'VIEW_RELEASE_CALENDAR' })}
                  >
                    <span>
                      <strong>{draft.title || 'Untitled Film'}</strong>
                      <small>Your studio</small>
                    </span>
                    <time>{formatGameMonthYear(releaseDay)}</time>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="dashboard-card dashboard-sidebar-card">
            <div className="dashboard-card-heading dashboard-sidebar-heading">
              <div>
                <span className="dashboard-section-kicker">Competition</span>
                <h2>Rival studios</h2>
              </div>
            </div>
            <div className="dashboard-rival-list">
              {state.rivalStudios.map((rival) => (
                <button
                  type="button"
                  key={rival.id}
                  className="dashboard-rival-row"
                  onClick={() => dispatch({ type: 'VIEW_RIVAL_STUDIO', studioName: rival.name })}
                >
                  <span>
                    <strong>{rival.name}</strong>
                    <small>{rival.tier}</small>
                  </span>
                  <span aria-hidden="true">›</span>
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

/** One row for a backgrounded, pre-photography draft with real progress on it (hasDraftProgress) - the "Staffing" slate slot. Mirrors the photography rows' shape (status pill, title, a one-line progress meta, an Open button) but reads roles-filled progress instead of shoot-day progress, since there's no photography state yet to read from. */
function StaffingProjectRow({ production, onOpen }: { production: FilmDraft; onOpen: () => void }) {
  const filledMandatoryCount = MANDATORY_TALENT_ROLES.filter(
    (role) => production.talent.filter((a) => a.role === role).length >= effectiveRoleCapacity(role, production.script).min,
  ).length;

  return (
    <article className="dashboard-project-row">
      <div className="dashboard-project-main">
        <span className="dashboard-status-pill dashboard-status-staffing">Staffing</span>
        <strong>{production.title || 'Untitled Film'}</strong>
        <span className="dashboard-project-meta">
          {filledMandatoryCount}/{MANDATORY_TALENT_ROLES.length} roles filled
        </span>
      </div>
      <div className="dashboard-project-actions">
        <Button className="btn-sm" onClick={onOpen}>Open</Button>
      </div>
    </article>
  );
}

function PipelineStat({ label, value, emphasis = false }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <div className={emphasis ? 'dashboard-pipeline-stat dashboard-pipeline-stat-emphasis' : 'dashboard-pipeline-stat'}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);
}

function getWeekGross(week: unknown): number {
  if (!week || typeof week !== 'object') return 0;
  const record = week as Record<string, unknown>;
  const value = record.gross ?? record.weeklyGross ?? record.boxOffice ?? record.revenue;
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
