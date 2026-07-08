import { useStudio } from '../../state/StudioContext';
import { Button } from '../common/Button';
import { Money } from '../common/Money';
import { ScoreBar } from '../common/ScoreBar';
import { StarRating } from '../common/StarRating';
import { StatTile } from '../common/StatTile';

export function ReleaseResults() {
  const { state, dispatch } = useStudio();
  const draft = state.draft!;
  const results = draft.results!;

  return (
    <div className="stack">
      <h1>{draft.title || 'Untitled Film'} - Results</h1>
      <div>
        <span className={`badge badge-outcome-${results.outcome.replace(/\s+/g, '-')}`} style={{ fontSize: '1.1em' }}>
          {results.outcome}
        </span>
      </div>

      <div className="card stack">
        <h2>Box Office</h2>
        <div className="row">
          <StatTile label="Final Production Cost" value={<Money amount={results.productionCost} />} />
          <StatTile label="Marketing Cost" value={<Money amount={results.marketingCost} />} />
          <StatTile label="Total Cost" value={<Money amount={results.totalCost} />} />
        </div>
        <div className="row">
          <StatTile label="Opening Weekend" value={<Money amount={results.openingWeekend} />} />
          <StatTile label="Total Box Office" value={<Money amount={results.totalBoxOffice} />} />
          <StatTile label="Profit / Loss" value={<Money amount={results.profit} signColor showSign />} />
        </div>
      </div>

      <div className="card stack">
        <h2>Reception</h2>
        <ScoreBar label="Quality Score" value={results.qualityScore} />
        <div className="row-between">
          <span className="score-bar-label">Critic Score</span>
          <StarRating value={results.criticScore} />
        </div>
        <ScoreBar label="Audience Score" value={results.audienceScore} />
        <ScoreBar label="Buzz Score" value={results.buzzScore} />
      </div>

      <div className="card stack">
        <h2>Department Breakdown</h2>
        <p className="choice-description">What actually drove the Quality Score above.</p>
        <ScoreBar label="Screenplay" value={results.scriptScore} />
        <ScoreBar label="Direction" value={results.directionScore} />
        <ScoreBar label="Acting" value={results.actingScore} />
        <ScoreBar label="Production" value={results.productionScore} />
        <ScoreBar label="Post-Production" value={results.postProductionScore} />
        <ScoreBar label="On-Set Events" value={results.eventsScore} />
      </div>

      <div className="card stack">
        <h2>Reviews</h2>
        {results.reviewBlurbs.map((blurb, i) => (
          <p key={i}>{blurb}</p>
        ))}
      </div>

      <div className="card row-between">
        <div>
          <div className="stat-label">Studio Reputation Change</div>
          <div className="stat-value">
            {results.reputationChange >= 0 ? '+' : ''}
            {results.reputationChange}
          </div>
        </div>
        <div>
          <div className="stat-label">Studio Reputation Now</div>
          <div className="stat-value">{state.studio.reputation} / 100</div>
        </div>
        <div>
          <div className="stat-label">Studio Cash Now</div>
          <div className="stat-value"><Money amount={state.studio.cash} signColor /></div>
        </div>
      </div>

      <div className="row-between">
        <span />
        <Button variant="primary" onClick={() => dispatch({ type: 'RETURN_TO_DASHBOARD' })}>
          Back to Studio Dashboard
        </Button>
      </div>
    </div>
  );
}
