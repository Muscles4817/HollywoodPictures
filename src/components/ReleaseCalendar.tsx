import { useStudio } from '../state/StudioContext';
import { formatGameDate } from '../engine/calendar';
import { Button } from './common/Button';
import { asScheduled, asRivalProduction } from '../engine/project';

interface CalendarEntry {
  id: string;
  title: string;
  genre: string;
  releaseDay: number;
  studioName: string;
  isPlayer: boolean;
}

/**
 * Every upcoming release, the player's own scheduled projects and every
 * rival's in-progress production, sorted by day (roadmap Phase 7.3) - the
 * whole point of real release scheduling (Phase 7.2) is being able to see
 * what else is coming out before picking a date, the same way
 * RivalProductionInProgress.releaseDay has always driven when a rival
 * actually shows up in Studio History (engine/rivalStudios.ts), just not
 * previously visible anywhere before it happened. Read-only - no action
 * here changes anything, same as StatsPage.tsx/RivalStudioPage.tsx.
 */
export function ReleaseCalendar() {
  const { state, dispatch } = useStudio();

  const rivalNameById = new Map(state.rivalStudios.map((r) => [r.id, r.name]));

  const entries: CalendarEntry[] = state.projects.flatMap((p): CalendarEntry[] => {
    const scheduled = asScheduled(p);
    if (scheduled) {
      return [{
        id: scheduled.draft.id,
        title: scheduled.draft.title || 'Untitled Film',
        genre: scheduled.draft.genre ?? '-',
        releaseDay: scheduled.releaseDay,
        studioName: state.studio.name,
        isPlayer: true,
      }];
    }
    const production = asRivalProduction(p);
    if (production) {
      return [{
        id: production.id,
        title: `${production.scale} ${production.genre} film`,
        genre: production.genre,
        releaseDay: production.releaseDay,
        studioName: rivalNameById.get(production.rivalStudioId) ?? 'A Rival Studio',
        isPlayer: false,
      }];
    }
    return [];
  });
  entries.sort((a, b) => a.releaseDay - b.releaseDay);

  return (
    <div className="stack">
      <div className="row-between">
        <h1 style={{ margin: 0 }}>Release Calendar</h1>
        <Button onClick={() => dispatch({ type: 'RETURN_TO_DASHBOARD' })}>Home</Button>
      </div>
      <p className="choice-description" style={{ margin: 0 }}>
        Every release still to come - your own scheduled films and what every rival studio currently has in the
        works, sorted by expected release day. A rival's title is a working guess (announced only once it actually
        releases) - only its scale, genre, studio and timing are known ahead of time.
      </p>

      <div className="card">
        {entries.length === 0 ? (
          <p>Nothing scheduled or in production anywhere right now.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Release Day</th>
                  <th>Title</th>
                  <th>Genre</th>
                  <th>Studio</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatGameDate(entry.releaseDay)}</td>
                    <td>{entry.isPlayer ? entry.title : <em>{entry.title}</em>}</td>
                    <td>{entry.genre}</td>
                    <td>{entry.studioName}{entry.isPlayer ? ' (you)' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
