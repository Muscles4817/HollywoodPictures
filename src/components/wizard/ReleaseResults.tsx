import { useStudio } from '../../state/StudioContext';
import { deriveFocusedFilm } from '../../state/selectors';
import { Money } from '../common/Money';
import { ScoreBar } from '../common/ScoreBar';
import { StarRating } from '../common/StarRating';
import { StatTile } from '../common/StatTile';

export function ReleaseResults() {
  const { state } = useStudio();
  // The focused project's id survives the transition RELEASE_FILM makes
  // from 'player-in-progress' to 'released' (see engine/project.ts,
  // state/studioReducer.ts) - so this is always the live, currently-settling
  // record of this exact film, not a frozen snapshot. The background
  // day-tick keeps running on this very screen (docs/DESIGN.md 5.20),
  // settling its box office run week by week, so a short-legged run
  // finishing while the player is still looking at this page shows the
  // real final numbers immediately rather than "still playing" forever.
  const film = deriveFocusedFilm(state)!;
  const results = film.results;
  // The film has already finished its whole run if the very first
  // settlement pass at release crossed straight to 'finished' (a weak
  // enough reception that legs bottom out after a single week) - rare, but
  // when it happens the final numbers below are already real, not pending.
  const finished = results.outcome !== null;

  return (
    <div className="stack">
      <h1>{film.title} - Opening Weekend</h1>
      {finished ? (
        <div>
          <span className={`badge badge-outcome-${results.outcome!.replace(/\s+/g, '-')}`} style={{ fontSize: '1.1em' }}>
            {results.outcome}
          </span>
        </div>
      ) : (
        <p className="choice-description" style={{ margin: 0 }}>
          This is just the opening - the film is still playing. Its total gross, profit, outcome, and Brand/Prestige
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
          <div className="stat-label">Brand Change</div>
          <div className="stat-value">
            {finished ? (
              <>{results.brandChange! >= 0 ? '+' : ''}{results.brandChange}</>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.7em' }}>Pending run's end</span>
            )}
          </div>
        </div>
        <div>
          <div className="stat-label">Prestige Change</div>
          <div className="stat-value">
            {finished ? (
              <>{results.prestigeChange! >= 0 ? '+' : ''}{results.prestigeChange}</>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.7em' }}>Pending run's end</span>
            )}
          </div>
        </div>
        <div>
          <div className="stat-label">Studio Brand Now</div>
          <div className="stat-value">{state.studio.brand} / 100</div>
        </div>
        <div>
          <div className="stat-label">Studio Prestige Now</div>
          <div className="stat-value">{state.studio.prestige} / 100</div>
        </div>
        <div>
          <div className="stat-label">Studio Cash Now</div>
          <div className="stat-value"><Money amount={state.studio.cash} signColor /></div>
        </div>
      </div>
    </div>
  );
}
