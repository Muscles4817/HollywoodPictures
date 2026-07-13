import { useStudio } from '../../state/StudioContext';
import { computeTalentCost, computeProductionBudgetCost } from '../../engine/cost';
import { ALL_TALENT_ROLES } from '../../data/talentGeneration';
import { Button } from '../common/Button';
import { Money } from '../common/Money';
import { WizardHeader } from '../common/WizardHeader';
import { ScriptSummaryCard } from '../common/ScriptSummaryCard';
import { nearestLabel } from './ProductionPlanning';
import { deriveFocusedDraft } from '../../state/selectors';
import type { TalentRole } from '../../types';

/**
 * The explicit business decision the development-pipeline doc is about -
 * everything up to here (talent selection, the production plan) has been
 * provisional, no cash spent and nothing booked. Greenlighting is the one
 * moment that changes: GREENLIGHT_PROJECT (state/studioReducer.ts) commits
 * talent salary, the production budget, and the full contingency reserve in
 * one shot, reserves the cast's schedules for real, and only then moves on
 * to actually shooting.
 */
export function Greenlight() {
  const { state, dispatch } = useStudio();
  const draft = deriveFocusedDraft(state)!;
  const script = draft.script!;
  const productionChoices = draft.productionChoices!;

  const talentCost = computeTalentCost(draft.talent);
  const productionCost = computeProductionBudgetCost(productionChoices);
  const contingency = productionChoices.contingencyAmount;
  const totalCommitment = talentCost + productionCost + contingency;
  const cashAfter = state.studio.cash - totalCommitment;
  const canAfford = cashAfter >= 0;

  return (
    <div className="stack">
      <WizardHeader current="greenlight" />
      <h1>Greenlight</h1>
      <p>
        This is the moment the studio actually commits - talent salary, the production budget, and the full
        contingency reserve all leave Studio Cash the instant you greenlight, and your cast's schedules are locked in
        for the shoot. Review the whole package below before you sign off.
      </p>

      <ScriptSummaryCard script={script} />

      <div className="card stack">
        <h2 style={{ margin: 0 }}>{draft.title || 'Untitled Film'}</h2>
        <div className="row">
          <div className="stat">
            <div className="stat-label">Genre</div>
            <div className="stat-value">{draft.genre ?? '-'}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Target Audience</div>
            <div className="stat-value">{draft.targetAudience ?? '-'}</div>
          </div>
        </div>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Cast & Crew</h2>
        {ALL_TALENT_ROLES.map((role: TalentRole) => {
          const hired = draft.talent.filter((t) => t.role === role);
          if (hired.length === 0) return null;
          return (
            <div key={role}>
              <div className="stat-label">{role}{hired.length > 1 ? 's' : ''}</div>
              {hired.map((t) => (
                <div className="row-between" key={t.id}>
                  <span>{t.name}</span>
                  <Money amount={t.salary} />
                </div>
              ))}
            </div>
          );
        })}
        <div className="row-between" style={{ borderTop: '1px solid var(--border)', paddingTop: 8, fontWeight: 600 }}>
          <span>Total Cast & Crew Salary</span>
          <Money amount={talentCost} />
        </div>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Production Plan</h2>
        <div className="row-between"><span>Set Quality</span><Money amount={productionChoices.setQualityAmount} /></div>
        <div className="row-between"><span>Practical Effects</span><Money amount={productionChoices.practicalEffectsAmount} /></div>
        <div className="row-between"><span>VFX Spend</span><Money amount={productionChoices.vfxAmount} /></div>
        <div className="row-between">
          <span>Runtime Target</span>
          <span>{nearestLabel(productionChoices.runtimeIntensity, ['Short', 'Standard', 'Long'])}</span>
        </div>
        <div className="row-between" style={{ borderTop: '1px solid var(--border)', paddingTop: 8, fontWeight: 600 }}>
          <span>Production Budget</span>
          <Money amount={productionCost} />
        </div>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Total Commitment</h2>
        <div className="row-between"><span>Cast & Crew Salary</span><Money amount={talentCost} /></div>
        <div className="row-between"><span>Production Budget</span><Money amount={productionCost} /></div>
        <div className="row-between"><span>Contingency Reserve</span><Money amount={contingency} /></div>
        <div className="row-between" style={{ borderTop: '1px solid var(--border)', paddingTop: 8, fontWeight: 600 }}>
          <span>Total Commitment</span>
          <Money amount={totalCommitment} />
        </div>
        <div className="row-between" style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          <span>Studio Cash (now)</span>
          <Money amount={state.studio.cash} />
        </div>
        <div className="row-between" style={{ fontWeight: 600 }}>
          <span>Studio Cash (after Greenlight)</span>
          <Money amount={cashAfter} signColor />
        </div>
      </div>

      {!canAfford && (
        <p style={{ color: 'var(--red)' }}>
          The studio can't afford this commitment right now - trim the production plan or wait until you have more
          cash on hand.
        </p>
      )}
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9em' }}>
        Once greenlit, abandoning this project will not refund any of the money committed here.
      </p>

      <div className="row-between">
        <div className="row">
          <Button onClick={() => dispatch({ type: 'GO_TO_STEP', step: 'production-planning' })}>Back</Button>
          <Button onClick={() => dispatch({ type: 'ABANDON_PROJECT' })}>Abandon Project</Button>
        </div>
        <Button variant="primary" disabled={!canAfford} onClick={() => dispatch({ type: 'GREENLIGHT_PROJECT' })}>
          Greenlight
        </Button>
      </div>
    </div>
  );
}
