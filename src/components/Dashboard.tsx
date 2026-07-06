import { useStudio } from '../state/StudioContext';
import { Button } from './common/Button';
import { StatTile } from './common/StatTile';
import { Money } from './common/Money';

export function Dashboard() {
  const { state, dispatch } = useStudio();
  const { studio } = state;

  return (
    <div className="stack">
      <div className="row-between">
        <div>
          <h1>{studio.name}</h1>
          <p>Year {studio.year} &middot; {studio.filmsReleased.length} film{studio.filmsReleased.length === 1 ? '' : 's'} released</p>
        </div>
        <Button variant="primary" onClick={() => dispatch({ type: 'START_NEW_FILM' })}>
          Start New Film
        </Button>
      </div>

      <div className="row">
        <StatTile label="Studio Cash" value={<Money amount={studio.cash} signColor />} />
        <StatTile label="Reputation" value={`${studio.reputation} / 100`} />
        <StatTile label="Films Released" value={studio.filmsReleased.length} />
        <StatTile label="Current Year" value={`Year ${studio.year}`} />
      </div>

      <div className="card">
        <h2>Studio History</h2>
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
