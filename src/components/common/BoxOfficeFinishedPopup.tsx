import { useStudio } from '../../state/StudioContext';
import { Button } from './Button';
import { Money } from './Money';
import { StatTile } from './StatTile';
import { BoxOfficeChart } from './BoxOfficeChart';
import type { Film } from '../../types';

/**
 * Surfaces once a film's BoxOfficeRun finishes and hasn't been seen yet
 * (Film.boxOfficeRun.acknowledged) - the moment profit/outcome/reputation
 * change are finally knowable, now that the whole theatrical run has played
 * out instead of being computed in one shot at release (docs/DESIGN.md 5.19).
 */
export function BoxOfficeFinishedPopup({ film }: { film: Film }) {
  const { dispatch } = useStudio();
  const { results, boxOfficeRun } = film;

  return (
    <div className="modal-overlay">
      <div className="modal-content stack">
        <h2 style={{ margin: 0 }}>{film.title} has left theaters</h2>
        {results.outcome && (
          <div>
            <span className={`badge badge-outcome-${results.outcome.replace(/\s+/g, '-')}`} style={{ fontSize: '1.1em' }}>
              {results.outcome}
            </span>
          </div>
        )}
        <BoxOfficeChart weeks={boxOfficeRun.weeks} />
        <div className="row">
          <StatTile label="Weeks in Theaters" value={boxOfficeRun.weeks.length} />
          <StatTile label="Total Box Office" value={<Money amount={results.totalBoxOffice ?? 0} />} />
          <StatTile label="Studio's Share" value={<Money amount={results.studioRevenue ?? 0} />} />
          <StatTile label="Profit / Loss" value={<Money amount={results.profit ?? 0} signColor showSign />} />
        </div>
        <div className="row-between">
          <div>
            <div className="stat-label">Reputation Change</div>
            <div className="stat-value">
              {results.reputationChange !== null && results.reputationChange >= 0 ? '+' : ''}
              {results.reputationChange}
            </div>
          </div>
        </div>
        <div className="row-between">
          <span />
          <Button variant="primary" onClick={() => dispatch({ type: 'ACKNOWLEDGE_BOX_OFFICE_RESULTS', filmId: film.id })}>
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}
