import {
  useMemo,
  useState,
} from 'react';
import { useStudio } from '../state/StudioContext';
import { formatGameMonthYear } from '../engine/calendar';
import { CheckboxFilterDropdown, type CheckboxFilterOption } from './common/CheckboxFilterDropdown';
import { asScheduled, asRivalProduction } from '../engine/project';
import { useReconciledFilterSelection } from '../hooks/useReconciledFilterSelection';

interface CalendarEntry {
  id: string;
  title: string;
  genre: string;
  targetAudience: string;
  releaseDay: number;
  studioId: string;
  studioName: string;
  isPlayer: boolean;
}

interface CalendarMonthGroup {
  monthYear: string;
  entries: CalendarEntry[];
}

const PLAYER_STUDIO_ID = 'player-studio';

/**
 * Every upcoming release, the player's own scheduled projects and every
 * rival's in-progress production, grouped by release month and sorted by day.
 *
 * Read-only: no action here changes anything, matching StatsPage.tsx and
 * RivalStudioPage.tsx.
 */
export function ReleaseCalendar() {
  const { state } = useStudio();

  const [openFilterId, setOpenFilterId] = useState<string | null>(null);

  const toggleFilter = (filterId: string) => {
    setOpenFilterId((current) =>
      current === filterId ? null : filterId,
    );
  };

  const closeFilters = () => {
    setOpenFilterId(null);
  };

  const rivalNameById = useMemo(
    () =>
      new Map(
        state.rivalStudios.map((rival) => [rival.id, rival.name]),
      ),
    [state.rivalStudios],
  );

  const entries = useMemo<CalendarEntry[]>(() => {
    const calendarEntries = state.projects.flatMap(
      (project): CalendarEntry[] => {
        const scheduled = asScheduled(project);

        if (scheduled) {
          return [
            {
              id: scheduled.draft.id,
              title: scheduled.draft.title || 'Untitled Film',
              genre: scheduled.draft.genre ?? '-',
              targetAudience: scheduled.draft.targetAudience ?? '-',
              releaseDay: scheduled.releaseDay,
              studioId: PLAYER_STUDIO_ID,
              studioName: state.studio.name,
              isPlayer: true,
            },
          ];
        }

        const production = asRivalProduction(project);

        if (production) {
          return [
            {
              id: production.id,
              title: `${production.scale} ${production.genre} film`,
              genre: production.genre,
              targetAudience: production.targetAudience,
              releaseDay: production.releaseDay,
              studioId: production.rivalStudioId,
              studioName:
                rivalNameById.get(production.rivalStudioId) ??
                'A Rival Studio',
              isPlayer: false,
            },
          ];
        }

        return [];
      },
    );

    return calendarEntries.sort(
      (a, b) => a.releaseDay - b.releaseDay,
    );
  }, [
    rivalNameById,
    state.projects,
    state.studio.name,
  ]);

  const studioIds = useMemo(
    () => [PLAYER_STUDIO_ID, ...state.rivalStudios.map((studio) => studio.id)],
    [state.rivalStudios],
  );

  const studioOptions = useMemo<CheckboxFilterOption[]>(
    () => [
      {
        id: PLAYER_STUDIO_ID,
        label: `${state.studio.name} (you)`,
      },
      ...state.rivalStudios.map((studio) => ({
        id: studio.id,
        label: studio.name,
      })),
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

  // Each reconciles itself as new studios/genres/target audiences appear
  // (this screen is a pure read-only detour - PAUSE_PERSISTING_SCREENS in
  // App.tsx - but the background day-tick still runs while it's open, so
  // the underlying data can change mid-visit) instead of freezing
  // "selected" at whatever existed on the very first render - see
  // useReconciledFilterSelection's own doc comment.
  const [selectedStudioIds, setSelectedStudioIds] = useReconciledFilterSelection(studioIds);
  const [selectedGenres, setSelectedGenres] = useReconciledFilterSelection(genreIds);
  const [selectedTargetAudiences, setSelectedTargetAudiences] = useReconciledFilterSelection(targetAudienceIds);

  const filteredEntries = useMemo(
    () =>
      entries.filter(
        (entry) =>
          selectedStudioIds.has(entry.studioId) &&
          selectedGenres.has(entry.genre) &&
          selectedTargetAudiences.has(entry.targetAudience),
      ),
    [entries, selectedStudioIds, selectedGenres, selectedTargetAudiences],
  );

  const entriesByMonth = useMemo(
    () =>
      filteredEntries.reduce<CalendarMonthGroup[]>(
        (groups, entry) => {
          const monthYear = formatGameMonthYear(entry.releaseDay);
          const currentGroup = groups.at(-1);

          if (currentGroup?.monthYear === monthYear) {
            currentGroup.entries.push(entry);
          } else {
            groups.push({
              monthYear,
              entries: [entry],
            });
          }

          return groups;
        },
        [],
      ),
    [filteredEntries],
  );

  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>Release Calendar</h1>

      <p className="choice-description" style={{ margin: 0 }}>
        Every release still to come — your own scheduled films and what
        every rival studio currently has in the works, grouped by expected
        release month. A rival&apos;s title is a working guess, announced
        only once it actually releases. Only its scale, genre, studio and
        timing are known ahead of time.
      </p>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
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
          label="Target Audience"
          options={targetAudienceOptions}
          selectedIds={selectedTargetAudiences}
          allSelectedLabel="All target audiences"
          noneSelectedLabel="No target audiences"
          selectedCountLabel={(count) => `${count} target audiences`}
          isOpen={openFilterId === 'targetAudience'}
          onToggle={toggleFilter}
          onClose={closeFilters}
          onChange={setSelectedTargetAudiences}
        />
      </div>

      {entries.length === 0 ? (
        <div className="card">
          <p>Nothing scheduled or in production anywhere right now.</p>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="card">
          <p>No releases match the selected filters.</p>
        </div>
      ) : (
        entriesByMonth.map((group) => (
          <section className="stack" key={group.monthYear}>
            <h2 style={{ marginBottom: 0 }}>{group.monthYear}</h2>

            <div className="card">
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Genre</th>
                      <th>Target Audience</th>
                      <th>Studio</th>
                    </tr>
                  </thead>

                  <tbody>
                    {group.entries.map((entry) => (
                      <tr key={entry.id}>
                        <td>
                          {entry.isPlayer ? (
                            entry.title
                          ) : (
                            <em>{entry.title}</em>
                          )}
                        </td>

                        <td>{entry.genre}</td>

                        <td>{entry.targetAudience}</td>

                        <td>
                          {entry.studioName}
                          {entry.isPlayer ? ' (you)' : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ))
      )}
    </div>
  );
}