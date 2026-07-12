import { useStudio } from '../../state/StudioContext';
import { Button } from '../common/Button';
import { Money } from '../common/Money';
import { ScoreBar } from '../common/ScoreBar';
import { StarRating } from '../common/StarRating';
import { StatTile } from '../common/StatTile';

export function ReleaseResults() {
  const { state, dispatch } = useStudio();
  const draft = state.draft!;
  // Read the just-released Film's own results from Studio History, not the
  // draft's frozen results snapshot - RELEASE_FILM only ever freezes one
  // into draft.results at the moment of release, and nothing refreshes it
  // afterward. The background day-tick keeps running on this very screen
  // (docs/DESIGN.md 5.20), which settles state.studio.filmsReleased's copy
  // week by week - so a short-legged run finishing while the player is
  // still looking at this page would otherwise display "still playing"
  // forever, even after Studio History next door already shows the real
  // final numbers. RELEASE_FILM always appends the new film last and
  // 'results' is only ever reached immediately after that append, so the
  // last entry is always this film - falling back to the draft's own
  // snapshot only if that invariant is somehow violated.
  const releasedFilm = state.studio.filmsReleased[state.studio.filmsReleased.length - 1];
  const results = releasedFilm?.results ?? draft.results!;
  // The film has already finished its whole run if the very first
  // settlement pass at release crossed straight to 'finished' (a weak
  // enough reception that legs bottom out after a single week) - rare, but
  // when it happens the final numbers below are already real, not pending.
  const finished = results.outcome !== null;

  return (
    <div className="stack">
      <h1>{draft.title || 'Untitled Film'} - Opening Weekend</h1>
      {finished ? (
        <div>
          <span className={`badge badge-outcome-${results.outcome!.replace(/\s+/g, '-')}`} style={{ fontSize: '1.1em' }}>
            {results.outcome}
          </span>
        </div>
      ) : (
        <p className="choice-description" style={{ margin: 0 }}>
          This is just the opening - the film is still playing. Its total gross, profit, outcome and reputation
          effect will all firm up week by week as it plays out; keep an eye on the Dashboard to watch it happen.
        </p>
      )}

      <div className="card stack">
        <h2>Box Office</h2>
        <div className="row">
          <StatTile label="Final Production Cost" value={<Money amount={results.productionCost} />} />
          <StatTile label="Marketing Cost" value={<Money amount={results.marketingCost} />} />
          <StatTile label="Total Cost" value={<Money amount={results.totalCost} />} />
        </div>
        <div className="row">
          <StatTile label="Opening Weekend" value={<Money amount={results.openingWeekend} />} />
          {finished ? (
            <>
              <StatTile label="Total Box Office" value={<Money amount={results.totalBoxOffice!} />} />
              <StatTile label="Studio's Share" value={<Money amount={results.studioRevenue!} />} />
              <StatTile label="Profit / Loss" value={<Money amount={results.profit!} signColor showSign />} />
            </>
          ) : (
            <StatTile label="Total Box Office" value="Still playing" />
          )}
        </div>
        <p className="choice-description" style={{ margin: 0 }}>
          Theaters and international distribution keep the rest - the studio's actual cut of box office is well below
          the headline gross.
        </p>
      </div>

      <div className="card stack">
        <h2>Reception</h2>
        <ScoreBar label="Quality Score" value={results.qualityScore} />
        <div className="row-between">
          <span className="score-bar-label">Critic Score</span>
          <StarRating value={results.criticScore} />
        </div>
        <div className="row-between">
          <span className="score-bar-label">Audience Score</span>
          <StarRating value={results.audienceScore} />
        </div>
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
        <h2>Studio Report</h2>
        <p>{results.storyReport}</p>
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
            {finished ? (
              <>{results.reputationChange! >= 0 ? '+' : ''}{results.reputationChange}</>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.7em' }}>Pending run's end</span>
            )}
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
