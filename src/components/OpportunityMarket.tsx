import { useStudio } from '../state/StudioContext';
import { formatGameDate } from '../engine/calendar';
import { Card } from './common/Card';
import { Button } from './common/Button';
import { Money } from './common/Money';
import { ScriptDetails } from './common/ScriptDetails';

/**
 * The shared, time-limited pool of Opportunities (development-pipeline doc)
 * - acquiring one charges its own acquisitionCost immediately and turns it
 * into a permanently-owned Asset (ACQUIRE_OPPORTUNITY, state/studioReducer.ts).
 * The pool itself is world-level and settles lazily off the calendar
 * (engine/opportunities.ts), the same pattern the release calendar and
 * rival market already use - so this screen is a pure read/act view over
 * GameState.opportunities, nothing generated here.
 */
export function OpportunityMarket() {
  const { state, dispatch } = useStudio();
  const opportunities = [...state.opportunities].sort((a, b) => a.expiresOnDay - b.expiresOnDay);

  return (
    <div className="stack">
      <div className="row-between">
        <h1 style={{ margin: 0 }}>Opportunity Market</h1>
        <Button onClick={() => dispatch({ type: 'RETURN_TO_DASHBOARD' })}>Home</Button>
      </div>
      <p className="choice-description" style={{ margin: 0 }}>
        Screenplays and pitches available to acquire - each one expires if left too long, and acquiring it charges
        its price immediately and adds it to your Asset Library, where you can develop it into a Project whenever
        you're ready.
      </p>

      {opportunities.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0 }}>Nothing available right now - check back as time passes.</p>
        </div>
      ) : (
        <div className="grid grid-wide">
          {opportunities.map((opportunity) => {
            const affordable = state.studio.cash >= opportunity.acquisitionCost;
            return (
              <Card key={opportunity.id}>
                <div className="row-between" style={{ marginBottom: 4 }}>
                  <span className="card-tag">{opportunity.source}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85em' }}>
                    Expires {formatGameDate(opportunity.expiresOnDay)}
                  </span>
                </div>
                <div className="card-title">{opportunity.script.title}</div>
                <ScriptDetails script={opportunity.script} />
                <div className="row-between" style={{ marginTop: 8 }}>
                  <span className="key-stat-label">Acquisition Price</span>
                  <Money amount={opportunity.acquisitionCost} />
                </div>
                <Button
                  variant="primary"
                  style={{ marginTop: 8, width: '100%' }}
                  disabled={!affordable}
                  onClick={() => dispatch({ type: 'ACQUIRE_OPPORTUNITY', opportunityId: opportunity.id })}
                >
                  Acquire
                </Button>
                {!affordable && <p style={{ color: 'var(--red)', marginTop: 6 }}>Can't afford this right now</p>}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
