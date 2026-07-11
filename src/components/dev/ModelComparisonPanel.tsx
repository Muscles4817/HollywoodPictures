import {
  compareModels,
  runOldModel,
  runNewModel,
  REPRESENTATIVE_SCENARIO_MATRIX,
  type ComparisonScenario,
  type ModelRunResult,
} from '../../engine/audienceSimulationReporting';
import type { SupportedReleaseType } from '../../engine/audienceSimulationInputs';
import { Money } from '../common/Money';
import type { ReleaseType } from '../../types';

function ComparisonRow({ name, description, oldResult, newResult }: { name: string; description: string; oldResult: ModelRunResult; newResult: ModelRunResult }) {
  return (
    <tr>
      <td>
        <div style={{ fontWeight: 600 }}>{name}</div>
        <div style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>{description}</div>
      </td>
      <td><Money amount={oldResult.openingGross} /></td>
      <td><Money amount={newResult.openingGross} /></td>
      <td><Money amount={oldResult.totalGross} /></td>
      <td><Money amount={newResult.totalGross} /></td>
      <td>{oldResult.legs.toFixed(2)}x</td>
      <td>{newResult.legs.toFixed(2)}x</td>
      <td>{oldResult.runWeeks}</td>
      <td>{newResult.runWeeks}</td>
    </tr>
  );
}

/**
 * Milestone 4: "the comparison must happen before the old model is
 * removed." Runs engine/boxOffice.ts (old, fixed Opening/Legs formula)
 * and Milestones 1-3's audience simulation (new) against the exact same
 * inputs and lays the results side by side - a fixed representative
 * scenario matrix (always the same five shapes, so a comparison run
 * doesn't drift week to week) plus, when the caller supplies one, the
 * currently-loaded/edited film's own inputs as a live sixth row. Doesn't
 * change which model a real release uses - engine/boxOffice.ts is still
 * what state/studioReducer.ts runs; this only reads both models side by
 * side for validation. See docs/DESIGN.md's Milestone 4 note for the
 * actual findings and which differences are considered intentional.
 */
export function ModelComparisonPanel({ thisFilmScenario }: { thisFilmScenario?: Omit<ComparisonScenario, 'releaseType'> & { releaseType: ReleaseType } }) {
  const matrixComparisons = compareModels(REPRESENTATIVE_SCENARIO_MATRIX);
  const thisFilmSupported = thisFilmScenario && thisFilmScenario.releaseType !== 'Streaming';

  let thisFilmOld: ModelRunResult | null = null;
  let thisFilmNew: ModelRunResult | null = null;
  if (thisFilmSupported) {
    const scenario: ComparisonScenario = { ...thisFilmScenario, releaseType: thisFilmScenario.releaseType as SupportedReleaseType };
    thisFilmOld = runOldModel(scenario);
    thisFilmNew = runNewModel(scenario);
  }

  return (
    <div className="card stack">
      <div>
        <h2 style={{ margin: 0 }}>Old vs. New Model Comparison</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>
          engine/boxOffice.ts's fixed Opening Weekend/Legs formula (still what a real release uses) against the new
          audience simulation, run against identical inputs. Kept here only as a temporary diagnostic path - see
          docs/DESIGN.md 5.34 Milestone 4 for the analysis of every material difference below.
        </p>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th rowSpan={2} style={{ verticalAlign: 'bottom' }}>Scenario</th>
              <th colSpan={2} style={{ textAlign: 'center' }}>Opening</th>
              <th colSpan={2} style={{ textAlign: 'center' }}>Total Gross</th>
              <th colSpan={2} style={{ textAlign: 'center' }}>Legs</th>
              <th colSpan={2} style={{ textAlign: 'center' }}>Run (weeks)</th>
            </tr>
            <tr>
              <th>Old</th>
              <th>New</th>
              <th>Old</th>
              <th>New</th>
              <th>Old</th>
              <th>New</th>
              <th>Old</th>
              <th>New</th>
            </tr>
          </thead>
          <tbody>
            {matrixComparisons.map((c) => (
              <ComparisonRow key={c.scenario.name} name={c.scenario.name} description={c.scenario.description} oldResult={c.old} newResult={c.new} />
            ))}
            {thisFilmOld && thisFilmNew && (
              <ComparisonRow name="This film (current edits)" description="The working copy above, run through both models." oldResult={thisFilmOld} newResult={thisFilmNew} />
            )}
          </tbody>
        </table>
      </div>
      {thisFilmScenario && !thisFilmSupported && (
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85em' }}>
          This film's Release Type is Streaming - not supported by the new model yet, so it's left out of the "This
          film" row above.
        </p>
      )}
    </div>
  );
}
