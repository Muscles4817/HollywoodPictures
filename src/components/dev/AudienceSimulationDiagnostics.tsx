import {
  deriveAudienceSimulationFixedState,
  type ReleaseSimulationInputs,
  type SupportedReleaseType,
} from '../../engine/audienceSimulationInputs';
import { advanceToWeekWithDiagnostics, MAX_SIMULATION_WEEKS } from '../../engine/audienceSimulationStep';
import { maxInterestedAudience } from '../../engine/audienceSimulation';
import { buildWeeklyReport, diagnoseRunShape, AVERAGE_TICKET_PRICE } from '../../engine/audienceSimulationReporting';
import { BoxOfficeChart } from '../common/BoxOfficeChart';
import { Money, formatMoney } from '../common/Money';
import type { ReleaseType } from '../../types';

function formatPeople(n: number): string {
  return Math.round(n).toLocaleString();
}

function formatPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

/**
 * Milestone 4: full weekly observability for the new audience-simulation
 * model (Milestones 1-3, engine/audienceSimulation*.ts) - "make it obvious
 * why a film opened strongly, collapsed, grew, plateaued, or remained
 * niche." Every number here comes straight from
 * advanceToWeekWithDiagnostics/buildWeeklyReport - no separate
 * reimplementation, so this can never show something the actual
 * simulation didn't produce. Still not wired into the live game - purely
 * a read of what the isolated engine does with a given set of inputs.
 */
export function AudienceSimulationDiagnostics({ releaseType, ...rest }: { releaseType: ReleaseType } & Omit<ReleaseSimulationInputs, 'releaseType'>) {
  if (releaseType === 'Streaming') {
    return (
      <div className="card stack">
        <h2 style={{ margin: 0 }}>Audience Simulation (New Model) - Weekly Diagnostics</h2>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>
          Streaming isn't supported by the new model yet (docs/DESIGN.md 5.34, Milestone 3) - forcing a streaming
          release through a theatrical-admissions model (seats, "opening weekend," per-screen scarcity) would be
          dishonest, so it's deliberately excluded rather than quietly approximated. Pick a different Release Type
          to see this section.
        </p>
      </div>
    );
  }

  const inputs: ReleaseSimulationInputs = { ...rest, releaseType: releaseType as SupportedReleaseType };
  const fixed = deriveAudienceSimulationFixedState(inputs);
  const ceiling = maxInterestedAudience(fixed);
  const { diagnostics } = advanceToWeekWithDiagnostics(fixed, [], MAX_SIMULATION_WEEKS);
  const report = buildWeeklyReport(diagnostics);
  const shape = diagnoseRunShape(fixed, ceiling, diagnostics);
  const totalGross = report.length > 0 ? report[report.length - 1].cumulativeGross : 0;
  const totalAdmissions = report.length > 0 ? report[report.length - 1].cumulativeTicketsSold : 0;

  return (
    <div className="card stack">
      <div>
        <h2 style={{ margin: 0 }}>Audience Simulation (New Model) - Weekly Diagnostics</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>
          A weekly population simulation (docs/DESIGN.md 5.34) run against the same script/marketing/reception
          inputs above, entirely separate from the Box Office card's fixed-legs figures. Gross assumes a flat{' '}
          {formatMoney(AVERAGE_TICKET_PRICE)} average ticket price (reporting only - see
          engine/audienceSimulationReporting.ts).
        </p>
      </div>

      <div className="row" style={{ flexWrap: 'wrap', gap: 16 }}>
        <div className="row-between" style={{ minWidth: 220 }}>
          <span className="score-bar-label">Total Addressable Audience</span>
          <span>{formatPeople(fixed.totalAddressableAudience)}</span>
        </div>
        <div className="row-between" style={{ minWidth: 220 }}>
          <span className="score-bar-label">Realistic Ceiling</span>
          <span>{formatPeople(ceiling)}</span>
        </div>
        <div className="row-between" style={{ minWidth: 220 }}>
          <span className="score-bar-label">Release-Day Awareness Seed</span>
          <span>{formatPeople(fixed.initialAwareCount)}</span>
        </div>
        <div className="row-between" style={{ minWidth: 220 }}>
          <span className="score-bar-label">Base Interest Fraction</span>
          <span>{formatPercent(fixed.baseInterestFraction)}</span>
        </div>
        <div className="row-between" style={{ minWidth: 220 }}>
          <span className="score-bar-label">Crossover Capacity</span>
          <span>{formatPercent(fixed.crossoverCapacityFraction)}</span>
        </div>
        <div className="row-between" style={{ minWidth: 220 }}>
          <span className="score-bar-label">Marketing Efficiency</span>
          <span>{formatPercent(fixed.marketingEfficiency)}</span>
        </div>
        <div className="row-between" style={{ minWidth: 220 }}>
          <span className="score-bar-label">Baseline Attendance Prob.</span>
          <span>{formatPercent(fixed.conversionPacingBaseline)}</span>
        </div>
        <div className="row-between" style={{ minWidth: 220 }}>
          <span className="score-bar-label">Run Length</span>
          <span>{report.length} weeks</span>
        </div>
        <div className="row-between" style={{ minWidth: 220 }}>
          <span className="score-bar-label">Total Admissions</span>
          <span>{formatPeople(totalAdmissions)}</span>
        </div>
        <div className="row-between" style={{ minWidth: 220 }}>
          <span className="score-bar-label">Total Gross</span>
          <span><Money amount={totalGross} /></span>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
        <p className="choice-description" style={{ margin: '0 0 8px' }}>Why it did that</p>
        {shape.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>No single label dominates this run's shape.</p>
        ) : (
          <div className="stack" style={{ gap: 6 }}>
            {shape.map((s) => (
              <div key={s.label} className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                <span className="badge">{s.label}</span>
                <span style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>{s.detail}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
        <p className="choice-description" style={{ margin: '0 0 8px' }}>Weekly gross</p>
        <BoxOfficeChart weeks={report.map((r) => ({ week: r.week, gross: r.weeklyGross }))} />
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, overflowX: 'auto' }}>
        <p className="choice-description" style={{ margin: '0 0 8px' }}>Full weekly trace</p>
        <table>
          <thead>
            <tr>
              <th>Wk</th>
              <th>Awareness</th>
              <th>Newly Aware</th>
              <th>Interested</th>
              <th>New Interest</th>
              <th>Crossover</th>
              <th>WOM Influence</th>
              <th>Baseline Prob.</th>
              <th>Pull-Forward</th>
              <th>Final Prob.</th>
              <th>Admissions</th>
              <th>Gross</th>
              <th>Cum. Admissions</th>
              <th>Cum. Gross</th>
            </tr>
          </thead>
          <tbody>
            {report.map((r) => (
              <tr key={r.week}>
                <td>{r.week}</td>
                <td>{formatPeople(r.awareCount)}</td>
                <td>{formatPeople(r.newlyAware)}</td>
                <td>{formatPeople(r.interestedRemaining)}</td>
                <td>{formatPeople(r.newInterestCreated)}</td>
                <td>{formatPeople(r.crossoverInterestCreated)}</td>
                <td>{r.womInfluence.toFixed(4)}</td>
                <td>{formatPercent(r.baselineAttendanceProbability)}</td>
                <td>{formatPercent(r.womPullForwardBoost)}</td>
                <td>{formatPercent(r.finalAttendanceProbability)}</td>
                <td>{formatPeople(r.weeklyAdmissions)}</td>
                <td><Money amount={r.weeklyGross} /></td>
                <td>{formatPeople(r.cumulativeTicketsSold)}</td>
                <td><Money amount={r.cumulativeGross} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
