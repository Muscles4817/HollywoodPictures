import { useState } from 'react';
import { useStudio } from '../state/StudioContext';
import { exportFilmHistory } from '../state/exportFilmHistory';
import { Button } from './common/Button';
import { StatTile } from './common/StatTile';
import { Money } from './common/Money';
import { GameGuide } from './common/GameGuide';

export function Dashboard() {
  const { state, dispatch } = useStudio();
  const { studio } = state;
  const [showGuide, setShowGuide] = useState(false);

  function handleReset() {
    const confirmed = window.confirm(
      `Reset ${studio.name}? This wipes all cash, reputation, and film history and starts a brand new studio. This can't be undone.`,
    );
    if (confirmed) dispatch({ type: 'RESET_SAVE' });
  }

  if (showGuide) {
    return <GameGuide onBack={() => setShowGuide(false)} />;
  }

  return (
    <div className="stack">
      <div className="row-between">
        <div>
          <h1>{studio.name}</h1>
          <p>Year {studio.year} &middot; {studio.filmsReleased.length} film{studio.filmsReleased.length === 1 ? '' : 's'} released</p>
        </div>
        <div className="row">
          <Button onClick={() => setShowGuide(true)}>How It Works</Button>
          <Button onClick={handleReset}>Reset Studio</Button>
          <Button variant="primary" onClick={() => dispatch({ type: 'START_NEW_FILM' })}>
            Start New Film
          </Button>
        </div>
      </div>

      <div className="row">
        <StatTile label="Studio Cash" value={<Money amount={studio.cash} signColor />} />
        <StatTile label="Reputation" value={`${studio.reputation} / 100`} />
        <StatTile label="Films Released" value={studio.filmsReleased.length} />
        <StatTile label="Current Year" value={`Year ${studio.year}`} />
      </div>

      <div className="card">
        <div className="row-between">
          <h2 style={{ margin: 0 }}>Studio History</h2>
          <Button disabled={studio.filmsReleased.length === 0} onClick={() => exportFilmHistory(studio)}>
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
                  <th>Year</th>
                  <th>Total Cost</th>
                  <th>Box Office</th>
                  <th>Critic Score</th>
                  <th>Outcome</th>
                  <th>Profit / Loss</th>
                </tr>
              </thead>
              <tbody>
                {[...studio.filmsReleased].reverse().map((film) => (
                  <tr key={film.id}>
                    <td>{film.title}</td>
                    <td>{film.genre}</td>
                    <td>{film.yearReleased}</td>
                    <td><Money amount={film.results.totalCost} /></td>
                    <td><Money amount={film.results.totalBoxOffice} /></td>
                    <td>{film.results.criticScore}</td>
                    <td>
                      <span className={`badge badge-outcome-${film.results.outcome.replace(/\s+/g, '-')}`}>
                        {film.results.outcome}
                      </span>
                    </td>
                    <td><Money amount={film.results.profit} signColor showSign /></td>
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
