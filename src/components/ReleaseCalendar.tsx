import { useMemo, useState } from 'react';
import { useStudio } from '../state/StudioContext';
import {
  formatGameMonthYear,
  monthYearOf,
  totalDaysForMonth,
  deriveReleaseWindowFromDay,
} from '../engine/calendar';
import { CheckboxFilterDropdown, type CheckboxFilterOption } from './common/CheckboxFilterDropdown';
import { deriveUpcomingReleaseEntries, PLAYER_STUDIO_ID, type CalendarEntry, type ReleaseScale } from '../state/selectors';
import { useReconciledFilterSelection } from '../hooks/useReconciledFilterSelection';
import type { ReleaseWindow } from '../types';
import './ReleaseCalendar.css';

interface CalendarMonthGroup {
  monthYear: string;
  entries: CalendarEntry[];
}

// How many releases sharing a month reads as a crowded window. Deliberately a
// simple count for now (#5 in the design brief - "prepare the UI"); the same
// thresholds are the single hook a real crowding score can replace later
// without touching the layout.
const SOME_COMPETITION_AT = 2;
const CROWDED_AT = 4;

type CompetitionLevel = 'clear' | 'some' | 'crowded';

function competitionFor(releaseCount: number): { level: CompetitionLevel; label: string } {
  if (releaseCount >= CROWDED_AT) return { level: 'crowded', label: 'Crowded' };
  if (releaseCount >= SOME_COMPETITION_AT) return { level: 'some', label: 'Some competition' };
  return { level: 'clear', label: 'Clear window' };
}

const SCALE_ORDER: ReleaseScale[] = ['Small', 'Medium', 'Large'];

// Industry events the sidebar looks ahead for - the release windows that
// actually shift box office (engine/calendar.ts). 'Quiet Month' is not an
// event, so it's excluded.
const TRACKED_EVENT_WINDOWS: ReleaseWindow[] = ['Summer', 'Halloween', 'Christmas', 'Awards Season'];

/**
 * The Release Calendar - a producer's planning board. Every upcoming release
 * (the player's own scheduled films and every rival's in-progress production)
 * grouped into strongly-divided month sections, with a right-hand industry
 * sidebar for at-a-glance planning.
 *
 * Read-only: no action here changes anything, matching StatsPage.tsx and
 * RivalStudioPage.tsx. Card clicks only expand an inline detail panel (local
 * state) - the structure is ready for richer navigation later (#8).
 */
export function ReleaseCalendar() {
  const { state } = useStudio();
  const today = state.totalDays;

  const [openFilterId, setOpenFilterId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleFilter = (filterId: string) => {
    setOpenFilterId((current) => (current === filterId ? null : filterId));
  };

  const closeFilters = () => setOpenFilterId(null);

  const entries = useMemo(
    () => deriveUpcomingReleaseEntries(state.projects, state.rivalStudios, state.studio.name),
    [state.projects, state.rivalStudios, state.studio.name],
  );

  // --- Filter option lists -------------------------------------------------

  const studioIds = useMemo(
    () => [PLAYER_STUDIO_ID, ...state.rivalStudios.map((studio) => studio.id)],
    [state.rivalStudios],
  );

  const studioOptions = useMemo<CheckboxFilterOption[]>(
    () => [
      { id: PLAYER_STUDIO_ID, label: `${state.studio.name} (you)` },
      ...state.rivalStudios.map((studio) => ({ id: studio.id, label: studio.name })),
    ],
    [state.rivalStudios, state.studio.name],
  );

  const genreIds = useMemo(
    () => [...new Set(entries.map((entry) => entry.genre))].sort((a, b) => a.localeCompare(b)),
    [entries],
  );
  const genreOptions = useMemo<CheckboxFilterOption[]>(
    () => genreIds.map((genre) => ({ id: genre, label: genre })),
    [genreIds],
  );

  const targetAudienceIds = useMemo(
    () => [...new Set(entries.map((entry) => entry.targetAudience))].sort((a, b) => a.localeCompare(b)),
    [entries],
  );
  const targetAudienceOptions = useMemo<CheckboxFilterOption[]>(
    () => targetAudienceIds.map((targetAudience) => ({ id: targetAudience, label: targetAudience })),
    [targetAudienceIds],
  );

  // Scale options are kept in size order (not alphabetized) so the dropdown
  // reads Small -> Medium -> Large.
  const scaleIds = useMemo(
    () => SCALE_ORDER.filter((scale) => entries.some((entry) => entry.scale === scale)),
    [entries],
  );
  const scaleOptions = useMemo<CheckboxFilterOption[]>(
    () => scaleIds.map((scale) => ({ id: scale, label: scale })),
    [scaleIds],
  );

  // Each reconciles itself as new studios/genres/audiences/scales appear (this
  // read-only screen still sees the background day-tick change the data
  // mid-visit) - see useReconciledFilterSelection's own doc comment.
  const [selectedStudioIds, setSelectedStudioIds] = useReconciledFilterSelection(studioIds);
  const [selectedGenres, setSelectedGenres] = useReconciledFilterSelection(genreIds);
  const [selectedTargetAudiences, setSelectedTargetAudiences] = useReconciledFilterSelection(targetAudienceIds);
  const [selectedScales, setSelectedScales] = useReconciledFilterSelection(scaleIds);

  const filtersActive =
    selectedStudioIds.size < studioIds.length ||
    selectedGenres.size < genreIds.length ||
    selectedTargetAudiences.size < targetAudienceIds.length ||
    selectedScales.size < scaleIds.length;

  const resetFilters = () => {
    setSelectedStudioIds(new Set(studioIds));
    setSelectedGenres(new Set(genreIds));
    setSelectedTargetAudiences(new Set(targetAudienceIds));
    setSelectedScales(new Set(scaleIds));
  };

  const filteredEntries = useMemo(
    () =>
      entries.filter(
        (entry) =>
          selectedStudioIds.has(entry.studioId) &&
          selectedGenres.has(entry.genre) &&
          selectedTargetAudiences.has(entry.targetAudience) &&
          selectedScales.has(entry.scale),
      ),
    [entries, selectedStudioIds, selectedGenres, selectedTargetAudiences, selectedScales],
  );

  const entriesByMonth = useMemo(
    () =>
      filteredEntries.reduce<CalendarMonthGroup[]>((groups, entry) => {
        const monthYear = formatGameMonthYear(entry.releaseDay);
        const currentGroup = groups.at(-1);
        if (currentGroup?.monthYear === monthYear) {
          currentGroup.entries.push(entry);
        } else {
          groups.push({ monthYear, entries: [entry] });
        }
        return groups;
      }, []),
    [filteredEntries],
  );

  // --- Competition read, from the *unfiltered* slate ----------------------
  // Filtering out rivals shouldn't make a genuinely crowded month look clear,
  // so the per-month competition and "N competing" reads always come from the
  // full landscape, not the filtered view.
  const monthStats = useMemo(() => {
    const map = new Map<string, { total: number; rivals: number }>();
    for (const entry of entries) {
      const key = formatGameMonthYear(entry.releaseDay);
      const stat = map.get(key) ?? { total: 0, rivals: 0 };
      stat.total += 1;
      if (!entry.isPlayer) stat.rivals += 1;
      map.set(key, stat);
    }
    return map;
  }, [entries]);

  // --- Sidebar: next player release ---------------------------------------
  const nextPlayerRelease = useMemo(() => {
    const mine = entries.filter((entry) => entry.isPlayer);
    if (mine.length === 0) return null;
    return mine.reduce((soonest, entry) => (entry.releaseDay < soonest.releaseDay ? entry : soonest));
  }, [entries]);

  // --- Sidebar: industry statistics ---------------------------------------
  const stats = useMemo(() => {
    const currentYear = monthYearOf(today).year;
    const playerCount = entries.filter((entry) => entry.isPlayer).length;
    const rivalCount = entries.length - playerCount;
    const largeThisYear = entries.filter(
      (entry) => entry.scale === 'Large' && monthYearOf(entry.releaseDay).year === currentYear,
    ).length;
    const activeMonths = monthStats.size;
    const avgPerMonth = activeMonths === 0 ? 0 : entries.length / activeMonths;
    return {
      playerCount,
      rivalCount,
      largeThisYear,
      currentYear,
      avgCompetition: activeMonths === 0 ? null : competitionFor(Math.round(avgPerMonth)).label,
    };
  }, [entries, monthStats, today]);

  // --- Sidebar: next occurrence of each tracked release window ------------
  const upcomingEvents = useMemo(() => {
    const { year, monthIndex } = monthYearOf(today);
    const found = new Map<ReleaseWindow, number>();
    for (let offset = 0; offset < 24 && found.size < TRACKED_EVENT_WINDOWS.length; offset++) {
      const m = (monthIndex + offset) % 12;
      const y = year + Math.floor((monthIndex + offset) / 12);
      const day = totalDaysForMonth(y, m);
      const window = deriveReleaseWindowFromDay(day);
      if (TRACKED_EVENT_WINDOWS.includes(window) && !found.has(window)) {
        found.set(window, day);
      }
    }
    return [...found.entries()]
      .map(([window, day]) => ({ window, day }))
      .sort((a, b) => a.day - b.day);
  }, [today]);

  const monthsAway = (day: number) => {
    const a = monthYearOf(today);
    const b = monthYearOf(day);
    return (b.year - a.year) * 12 + (b.monthIndex - a.monthIndex);
  };

  const toggleExpanded = (id: string) => {
    setExpandedId((current) => (current === id ? null : id));
  };

  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>Release Calendar</h1>

      <p className="choice-description" style={{ margin: 0 }}>
        Every release still to come — your own scheduled films and what every rival studio currently has in the
        works, grouped by expected release month. A rival&apos;s title is a working guess, announced only once it
        actually releases; its scale, genre, studio and timing are known ahead of time.
      </p>

      {/* --- Filter toolbar --- */}
      <div className="release-toolbar" role="group" aria-label="Release filters">
        <span className="release-toolbar__label">Filters</span>

        <CheckboxFilterDropdown
          id="studio"
          label="Studio"
          options={studioOptions}
          selectedIds={selectedStudioIds}
          allSelectedLabel="All studios"
          noneSelectedLabel="No studios"
          selectedCountLabel={(count) => `${count} studios`}
          isOpen={openFilterId === 'studio'}
          onToggle={toggleFilter}
          onClose={closeFilters}
          onChange={setSelectedStudioIds}
        />

        <CheckboxFilterDropdown
          id="genre"
          label="Genre"
          options={genreOptions}
          selectedIds={selectedGenres}
          allSelectedLabel="All genres"
          noneSelectedLabel="No genres"
          selectedCountLabel={(count) => `${count} genres`}
          isOpen={openFilterId === 'genre'}
          onToggle={toggleFilter}
          onClose={closeFilters}
          onChange={setSelectedGenres}
        />

        <CheckboxFilterDropdown
          id="targetAudience"
          label="Audience"
          options={targetAudienceOptions}
          selectedIds={selectedTargetAudiences}
          allSelectedLabel="All audiences"
          noneSelectedLabel="No audiences"
          selectedCountLabel={(count) => `${count} audiences`}
          isOpen={openFilterId === 'targetAudience'}
          onToggle={toggleFilter}
          onClose={closeFilters}
          onChange={setSelectedTargetAudiences}
        />

        <CheckboxFilterDropdown
          id="scale"
          label="Scale"
          options={scaleOptions}
          selectedIds={selectedScales}
          allSelectedLabel="All scales"
          noneSelectedLabel="No scales"
          selectedCountLabel={(count) => `${count} scales`}
          isOpen={openFilterId === 'scale'}
          onToggle={toggleFilter}
          onClose={closeFilters}
          onChange={setSelectedScales}
        />

        <span className="release-toolbar__spacer" />

        <button
          type="button"
          className="release-toolbar__reset"
          onClick={resetFilters}
          disabled={!filtersActive}
        >
          Reset Filters
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0 }}>Nothing scheduled or in production anywhere right now.</p>
        </div>
      ) : (
        <div className="release-calendar__layout">
          {/* --- Main: month-by-month planning board --- */}
          <div className="release-calendar__main">
            {filteredEntries.length === 0 ? (
              <div className="card">
                <p style={{ margin: 0 }}>No releases match the selected filters.</p>
              </div>
            ) : (
              entriesByMonth.map((group) => {
                const stat = monthStats.get(group.monthYear) ?? { total: group.entries.length, rivals: 0 };
                const competition = competitionFor(stat.total);
                const [month, yearLabel] = group.monthYear.split(' Year ');
                return (
                  <section className="release-month" key={group.monthYear}>
                    <header className="release-month__header">
                      <h2 className="release-month__title">
                        {month} · Year {yearLabel}
                      </h2>
                      <div className="release-month__meta">
                        <span className="release-month__count">
                          {group.entries.length} release{group.entries.length === 1 ? '' : 's'}
                          {group.entries.length !== stat.total ? ` of ${stat.total}` : ''}
                        </span>
                        <span className={`competition competition--${competition.level}`}>{competition.label}</span>
                      </div>
                    </header>

                    <div className="release-month__grid">
                      {group.entries.map((entry) => {
                        const rivalsThatMonth = entry.isPlayer
                          ? stat.rivals
                          : Math.max(0, stat.total - 1);
                        return (
                          <ReleaseCard
                            key={entry.id}
                            entry={entry}
                            daysUntil={Math.max(0, entry.releaseDay - today)}
                            competingCount={rivalsThatMonth}
                            expanded={expandedId === entry.id}
                            onToggle={() => toggleExpanded(entry.id)}
                          />
                        );
                      })}
                    </div>
                  </section>
                );
              })
            )}
          </div>

          {/* --- Sidebar: industry planning --- */}
          <aside className="release-calendar__sidebar" aria-label="Industry overview">
            <div className="sidebar-card sidebar-card--accent">
              <h2 className="sidebar-card__title">Next Release</h2>
              {nextPlayerRelease ? (
                <>
                  <div className="next-release__time">
                    {Math.max(0, nextPlayerRelease.releaseDay - today)} days
                  </div>
                  <div className="next-release__label">
                    until <strong>{nextPlayerRelease.title}</strong> · {formatGameMonthYear(nextPlayerRelease.releaseDay)}
                  </div>
                </>
              ) : (
                <p className="sidebar-empty" style={{ margin: 0 }}>
                  You have nothing scheduled. Finish a film and lock a release date to see it here.
                </p>
              )}
            </div>

            <div className="sidebar-card">
              <h2 className="sidebar-card__title">Industry Statistics</h2>
              <div className="stat-row">
                <span className="stat-row__label">Your releases</span>
                <span className="stat-row__value">{stats.playerCount}</span>
              </div>
              <div className="stat-row">
                <span className="stat-row__label">Rival releases</span>
                <span className="stat-row__value">{stats.rivalCount}</span>
              </div>
              <div className="stat-row">
                <span className="stat-row__label">Large-scale (Year {stats.currentYear})</span>
                <span className="stat-row__value">{stats.largeThisYear}</span>
              </div>
              <div className="stat-row">
                <span className="stat-row__label">Avg. competition</span>
                <span className="stat-row__value">{stats.avgCompetition ?? '—'}</span>
              </div>
            </div>

            <div className="sidebar-card">
              <h2 className="sidebar-card__title">Upcoming Industry Events</h2>
              {upcomingEvents.length === 0 ? (
                <p className="sidebar-empty" style={{ margin: 0 }}>No notable windows ahead.</p>
              ) : (
                upcomingEvents.map(({ window, day }) => {
                  const away = monthsAway(day);
                  return (
                    <div className="event-row" key={window}>
                      <span className="event-row__label">{window}</span>
                      <span className="event-row__when">
                        {away <= 0 ? 'Now' : formatGameMonthYear(day)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

interface ReleaseCardProps {
  entry: CalendarEntry;
  daysUntil: number;
  competingCount: number;
  expanded: boolean;
  onToggle: () => void;
}

function ReleaseCard({ entry, daysUntil, competingCount, expanded, onToggle }: ReleaseCardProps) {
  const scaleClass = `chip chip--scale chip--scale-${entry.scale.toLowerCase()}`;
  const timing = daysUntil === 0 ? 'Today' : `in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`;

  return (
    <button
      type="button"
      className={`release-card${entry.isPlayer ? ' release-card--player' : ''}`}
      aria-expanded={expanded}
      aria-label={`${entry.title}, ${entry.scale} ${entry.genre} film${entry.isPlayer ? ' (your film)' : ''}, ${timing}`}
      onClick={onToggle}
    >
      <div className="release-card__top">
        <span className={`release-card__title${entry.isPlayer ? '' : ' release-card__title--rival'}`}>
          {entry.title}
        </span>
        {entry.isPlayer && <span className="badge-player">Your Film</span>}
      </div>

      <div className="release-card__badges">
        <span className={scaleClass}>{entry.scale}</span>
        <span className="chip chip--genre">{entry.genre}</span>
        <span className="chip chip--audience">{entry.targetAudience}</span>
      </div>

      <div className="release-card__studio">{entry.studioName}{entry.isPlayer ? ' (you)' : ''}</div>

      <div className="release-card__badges">
        <span className="release-card__timing">{timing}</span>
        {competingCount > 0 && (
          <span className="competition competition--some" title="Other releases sharing this month">
            {competingCount} competing
          </span>
        )}
      </div>

      {expanded && (
        <dl className="release-card__details">
          <dt>{entry.isPlayer ? 'Title' : 'Working title'}</dt>
          <dd>{entry.title}</dd>
          <dt>Studio</dt>
          <dd>{entry.studioName}{entry.isPlayer ? ' (you)' : ''}</dd>
          <dt>Genre</dt>
          <dd>{entry.genre}</dd>
          <dt>Scale</dt>
          <dd>{entry.scale}</dd>
          <dt>Audience</dt>
          <dd>{entry.targetAudience}</dd>
          <dt>Expected</dt>
          <dd>{formatGameMonthYear(entry.releaseDay)}</dd>
        </dl>
      )}

      {expanded && entry.isPlayer && (
        <span className="release-card__hint">Opening the project from here is coming soon.</span>
      )}
    </button>
  );
}
