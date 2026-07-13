import { useStudio } from '../../state/StudioContext';
import { rivalProductionsInProgress, rivalReleasedFilms } from '../../engine/project';
import { Money } from '../common/Money';

// Developer-only tool (Milestone: AI Studios 2.0, engine/rivalStudios.ts) -
// every rival studio's real cash/brand/prestige/lifetime revenue/lifetime
// expenditure at a glance, read straight from live GameState rather than a
// synthetic sample the way OutcomeInspector/RecommendationInspector are -
// the whole point is verifying the real affordability gate
// (startRivalProduction) is actually behaving as intended against a real
// save, not a hypothetical one. Not reachable from normal play, never
// mutates GameState.
export function RivalFinancesInspector() {
  const { state } = useStudio();
  const productions = rivalProductionsInProgress(state.projects);
  const films = rivalReleasedFilms(state.projects);

  return (
    <div className="stack">
      <div>
        <h1 style={{ margin: 0 }}>Rival Studio Finances</h1>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>
          Developer tool - live cash/brand/prestige for every AI studio. A studio whose Cash has fallen below what a
          new production for its tier typically costs should naturally stop starting new ones (In Production stops
          growing) until box office revenue brings it back up.
        </p>
      </div>
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Studio</th>
                <th>Tier</th>
                <th>Cash</th>
                <th>Brand</th>
                <th>Prestige</th>
                <th>Lifetime Revenue</th>
                <th>Lifetime Expenditure</th>
                <th>In Production</th>
                <th>Released</th>
              </tr>
            </thead>
            <tbody>
              {state.rivalStudios.map((rival) => (
                <tr key={rival.id}>
                  <td>{rival.name}</td>
                  <td><span className="badge">{rival.tier}</span></td>
                  <td><Money amount={rival.cash} signColor /></td>
                  <td>{rival.brand} / 100</td>
                  <td>{rival.prestige} / 100</td>
                  <td><Money amount={rival.lifetimeRevenue} /></td>
                  <td><Money amount={rival.lifetimeExpenditure} /></td>
                  <td>{productions.filter((p) => p.rivalStudioId === rival.id).length}</td>
                  <td>{films.filter((f) => f.releasedBy === rival.name).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
