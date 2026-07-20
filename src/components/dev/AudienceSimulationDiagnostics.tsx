import { deriveAudienceSimulationFixedState, type ReleaseSimulationInputs } from '../../engine/audienceSimulationInputs';
import { advanceToWeekWithDiagnostics, replaySettledWeeksWithDiagnostics, MAX_SIMULATION_WEEKS, type WeekDiagnostics } from '../../engine/audienceSimulationStep';
import { maxInterestedAudience, type AudienceSimulationFixedState } from '../../engine/audienceSimulation';
import { buildWeeklyReport, diagnoseRunShape, AVERAGE_TICKET_PRICE } from '../../engine/audienceSimulationReporting';
import { BoxOfficeChart } from '../common/BoxOfficeChart';
import { Money, formatMoney } from '../common/Money';
import type { BoxOfficeWeek } from '../../types';

function formatPeople(n: number): string {
  return Math.round(n).toLocaleString();
}

function formatPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

/**
 * Full weekly observability for the audience simulation that now settles
 * every live release (docs/DESIGN.md 5.34, Milestones 1-5) - "make it
 * obvious why a film opened strongly, collapsed, grew, plateaued, or
 * remained niche." Shared by both of components/dev/OutcomeInspector.tsx's
 * views (`AudienceSimulationDiagnostics`'s hypothetical, editable-slider
 * "Projected" trace, and `AsReleasedDiagnostics`'s real replayed "As
 * Released" trace below) - one table, one set of formatting rules, fed
 * whatever `diagnostics` a caller actually produced, so the two views can
 * never visually drift out of sync with each other.
 */
function WeeklyDiagnosticsView({
  fixed,
  diagnostics,
  description,
  note,
}: {
  fixed: AudienceSimulationFixedState;
  diagnostics: WeekDiagnostics[];
  description: string;
  note?: string;
}) {
  const ceiling = maxInterestedAudience(fixed);
  const report = buildWeeklyReport(diagnostics);
  const shape = diagnoseRunShape(fixed, ceiling, diagnostics);
  const totalGross = report.length > 0 ? report[report.length - 1].cumulativeGross : 0;
  const totalAdmissions = report.length > 0 ? report[report.length - 1].cumulativeTicketsSold : 0;

  return (
    <div className="card stack">
      <div>
        <h2 style={{ margin: 0 }}>Audience Simulation - Weekly Diagnostics</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>
          {description} Gross assumes a flat {formatMoney(AVERAGE_TICKET_PRICE)} average ticket price (docs/DESIGN.md
          5.34 - see engine/boxOfficeRun.ts:AVERAGE_TICKET_PRICE).
        </p>
        {note && (
          <p style={{ margin: '4px 0 0', color: 'var(--amber, #b8860b)' }}>{note}</p>
        )}
      </div>

      {report.length === 0 ? (
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>No weeks settled yet.</p>
      ) : (
        <>
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
              <span className="score-bar-label">Release-Day Availability</span>
              <span>{formatPercent(fixed.initialAvailabilityFraction)}</span>
            </div>
            <div className="row-between" style={{ minWidth: 220 }}>
              <span className="score-bar-label">Availability Age Decay</span>
              <span>{formatPercent(fixed.availabilityBaseWeeklyDecay)}/wk</span>
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
                  <th>Availability</th>
                  <th>Demand</th>
                  <th>Capacity</th>
                  <th>Utilisation</th>
                  <th>Age Contr.</th>
                  <th>Comp. Pressure</th>
                  <th>Perf. Adj.</th>
                  <th>Next Avail.</th>
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
                    <td>{formatPercent(r.availabilityFraction)}</td>
                    <td>{formatPeople(r.unconstrainedDemand)}</td>
                    <td>{formatPeople(r.maxServiceableDemand)}</td>
                    <td>{r.demandUtilisation.toFixed(2)}x</td>
                    <td>{formatPercent(r.expectedAgeContraction)}</td>
                    <td>{formatPercent(r.competitivePressure)}</td>
                    <td>{r.performanceAdjustment >= 0 ? '+' : ''}{formatPercent(r.performanceAdjustment)}</td>
                    <td>{formatPercent(r.nextAvailabilityFraction)}</td>
                    <td>{formatPeople(r.weeklyAdmissions)}</td>
                    <td><Money amount={r.weeklyGross} /></td>
                    <td>{formatPeople(r.cumulativeTicketsSold)}</td>
                    <td><Money amount={r.cumulativeGross} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The "Projected" view - a fresh, hypothetical, single-film trace driven by
 * whatever the Outcome Inspector's sliders currently say, exactly as before
 * this file was split. No real competitive data (advanceToWeekWithDiagnostics
 * has no way to receive any - see that function's own docs) - always
 * projects in isolation, same as it always has.
 */
export function AudienceSimulationDiagnostics(inputs: ReleaseSimulationInputs) {
  const fixed = deriveAudienceSimulationFixedState(inputs);
  const { diagnostics } = advanceToWeekWithDiagnostics(fixed, [], MAX_SIMULATION_WEEKS);
  return (
    <WeeklyDiagnosticsView
      fixed={fixed}
      diagnostics={diagnostics}
      description="A hypothetical, editable-slider projection of this film's whole run, in isolation - same model, same inputs as the Box Office card above, just every intermediate step instead of only the totals."
    />
  );
}

/**
 * The "As Released" view - replays a real film's actual settled weeks using
 * the real per-week competitivePressure history now recorded on
 * BoxOfficeWeek (types/index.ts), instead of a fresh hypothetical
 * projection. `weeks` is a real Film's boxOfficeRun.weeks - however many
 * weeks have actually settled so far for a still-running film, or its whole
 * real run for a finished one. Missing competitivePressure on any week
 * (saves from before this field existed) falls back to 0 for the replay
 * itself, but `note` calls that out explicitly rather than silently
 * presenting an assumed 0 as a known fact.
 */
export function AsReleasedDiagnostics({ fixed, weeks }: { fixed: AudienceSimulationFixedState; weeks: BoxOfficeWeek[] }) {
  const competitivePressureByWeek = weeks.map((w) => w.competitivePressure ?? 0);
  const hasUnrecordedWeeks = weeks.some((w) => w.competitivePressure === undefined);
  const { diagnostics } = replaySettledWeeksWithDiagnostics(fixed, competitivePressureByWeek);
  return (
    <WeeklyDiagnosticsView
      fixed={fixed}
      diagnostics={diagnostics}
      description="Exactly what really happened, week by week, for this release - replayed from its real inputs and real competitive pressure history, not a fresh projection."
      note={
        hasUnrecordedWeeks
          ? "Competitive pressure wasn't recorded for one or more of these weeks (released before this tracking existed) - shown as 0.0% there, not a confirmed reading."
          : undefined
      }
    />
  );
}
