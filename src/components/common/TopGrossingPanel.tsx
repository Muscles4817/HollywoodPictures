import { Money } from './Money';
import type { TopGrossingEntry } from '../../state/selectors';
import type { Film } from '../../types';

interface TopGrossingPanelProps {
  entries: TopGrossingEntry[];
  playerStudioName: string;
  onSelectFilm: (film: Film) => void;
  onSelectStudio: (studioName: string) => void;
}

/** This week's box office chart across the player's own films and every rival's - see state/selectors.ts:computeTopGrossingFilms and docs/DESIGN.md 5.24. */
export function TopGrossingPanel({ entries, playerStudioName, onSelectFilm, onSelectStudio }: TopGrossingPanelProps) {
  return (
    <div className="card stack top-grossing-panel">
      <h2 style={{ margin: 0 }}>Top 10 This Week</h2>
      {entries.length === 0 ? (
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>Nothing currently in theaters.</p>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          {entries.map((entry, i) => {
            const isPlayer = entry.studioName === playerStudioName;
            return (
              <button
                key={entry.film.id}
                className="top-grossing-row"
                onClick={() => onSelectFilm(entry.film)}
              >
                <span className="top-grossing-rank">{i + 1}</span>
                <span className="top-grossing-details">
                  <span className={isPlayer ? 'top-grossing-title top-grossing-title-player' : 'top-grossing-title'}>
                    {entry.film.title}
                  </span>
                  <span className="top-grossing-studio">
                    {isPlayer ? (
                      entry.studioName
                    ) : (
                      <span
                        className="top-grossing-studio-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectStudio(entry.studioName);
                        }}
                      >
                        {entry.studioName}
                      </span>
                    )}
                    {' '}&middot; Week {entry.weekNumber}
                  </span>
                  <span className="top-grossing-figures">
                    <Money amount={entry.thisWeekGross} /> this week &middot; <Money amount={entry.film.boxOfficeRun.cumulativeGross} /> total
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
