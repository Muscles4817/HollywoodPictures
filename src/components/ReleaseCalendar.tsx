import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useStudio } from '../state/StudioContext';
import { formatGameMonthYear } from '../engine/calendar';
import { Button } from './common/Button';
import { CheckboxFilterDropdown, type CheckboxFilterOption } from './common/CheckboxFilterDropdown';
import { asScheduled, asRivalProduction } from '../engine/project';

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

interface ReleaseCalendarFilters {
  studioIds: Set<string>;
  genres: Set<string>;
  targetAudiences: Set<string>;
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
  const { state, dispatch } = useStudio();

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

  const genreOptions = useMemo<CheckboxFilterOption[]>(() => {
    const genres = [...new Set(entries.map((entry) => entry.genre))];

    return genres
      .sort((a, b) => a.localeCompare(b))
      .map((genre) => ({
        id: genre,
        label: genre,
      }));
  }, [entries]);

  const targetAudienceOptions = useMemo<CheckboxFilterOption[]>(() => {
    const targetAudiences = [...new Set(entries.map((entry) => entry.targetAudience))];
    
    return targetAudiences
      .sort((a, b) => a.localeCompare(b))
      .map((targetAudience) => ({
        id: targetAudience,
        label: targetAudience,
      }));
  }, [entries]);

  const [filters, setFilters] = useState<ReleaseCalendarFilters>(() => ({
    studioIds: new Set(studioOptions.map((option) => option.id)),
    genres: new Set(genreOptions.map((option) => option.id)),
    targetAudiences: new Set(targetAudienceOptions.map((option) => option.id)),
  }));

  /*
   * Include newly appearing studios and genres automatically without
   * re-selecting options that the player deliberately unchecked.
   */
  useEffect(() => {
    setFilters((current) => {
      const knownStudioIds = new Set(
        studioOptions.map((option) => option.id),
      );

      const knownGenres = new Set(
        genreOptions.map((option) => option.id),
      );

      const knownTargetAudiences = new Set(
        targetAudienceOptions.map((option) => option.id),
      );

      return {
        studioIds: new Set(
          [...current.studioIds].filter((id) =>
            knownStudioIds.has(id),
          ),
        ),
        genres: new Set(
          [...current.genres].filter((genre) =>
            knownGenres.has(genre),
          ),
        ),
        targetAudiences: new Set(
          [...current.targetAudiences].filter((targetAudience) =>
            knownTargetAudiences.has(targetAudience),
          ),
        ),
      };
    });
  }, [studioOptions, genreOptions, targetAudienceOptions]);

  const filteredEntries = useMemo(
    () =>
      entries.filter(
        (entry) =>
          filters.studioIds.has(entry.studioId) &&
          filters.genres.has(entry.genre) &&
          filters.targetAudiences.has(entry.targetAudience),
      ),
    [entries, filters],
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

  const setStudioFilter = (studioIds: Set<string>) => {
    setFilters((current) => ({
      ...current,
      studioIds,
    }));
  };

  const setGenreFilter = (genres: Set<string>) => {
    setFilters((current) => ({
      ...current,
      genres,
    }));
  };

  const setTargetAudienceFilter = (targetAudiences: Set<string>) => {
    setFilters((current) => ({
      ...current,
      targetAudiences,
    }));
  };

  return (
    <div className="stack">
      <div className="row-between">
        <h1 style={{ margin: 0 }}>Release Calendar</h1>

        <Button
          onClick={() =>
            dispatch({ type: 'RETURN_TO_DASHBOARD' })
          }
        >
          Home
        </Button>
      </div>

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
          selectedIds={filters.studioIds}
          allSelectedLabel="All studios"
          noneSelectedLabel="No studios"
          selectedCountLabel={(count) => `${count} studios`}
          isOpen={openFilterId === 'studio'}
          onToggle={toggleFilter}
          onClose={closeFilters}
          onChange={setStudioFilter}
        />

        <CheckboxFilterDropdown
          id="genre"
          label="Genre"
          options={genreOptions}
          selectedIds={filters.genres}
          allSelectedLabel="All genres"
          noneSelectedLabel="No genres"
          selectedCountLabel={(count) => `${count} genres`}
          isOpen={openFilterId === 'genre'}
          onToggle={toggleFilter}
          onClose={closeFilters}
          onChange={setGenreFilter}
        />

        <CheckboxFilterDropdown
          id="targetAudience"
          label="Target Audience"
          options={targetAudienceOptions}
          selectedIds={filters.targetAudiences}
          allSelectedLabel="All target audiences"
          noneSelectedLabel="No target audiences"
          selectedCountLabel={(count) => `${count} target audiences`}
          isOpen={openFilterId === 'targetAudience'}
          onToggle={toggleFilter}
          onClose={closeFilters}
          onChange={setTargetAudienceFilter}
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