import { useStudio } from '../../state/StudioContext';
import { deriveFocusedDraft, deriveGreenlightCommitment } from '../../state/selectors';
import { ALL_TALENT_ROLES } from '../../data/talentGeneration';
import { Money } from '../common/Money';
import { nearestLabel } from '../wizard/ProductionPlanning';
import type { ProductionRole } from '../../types';

/**
 * The full Greenlight cost breakdown - absorbed from the retired
 * Greenlight.tsx screen (PRODUCER_WORKSPACE_DESIGN.md), now readable at any
 * point instead of only as the last step before committing. Reads
 * deriveGreenlightCommitment (state/selectors.ts) rather than computing its
 * own totals, so this tab, the Overview summary, and the Greenlight
 * confirmation modal can never disagree on what this project actually
 * costs.
 */
export function ProjectFinance() {
  const { state } = useStudio();
  const draft = deriveFocusedDraft(state)!;
  const commitment = deriveGreenlightCommitment(draft, state.studio.cash);

  return (
    <div className="stack">
      <h1>Finance</h1>
      <p className="choice-description">
        Nothing here is charged yet - talent salary, the production budget, and the contingency reserve all leave
        Studio Cash the instant you greenlight (see the Overview tab), not before.
      </p>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Cast & Crew</h2>
        {draft.talent.length === 0 && <p style={{ margin: 0, color: 'var(--text-muted)' }}>Nobody hired yet.</p>}
        {ALL_TALENT_ROLES.map((role: ProductionRole) => {
          const hired = draft.talent.filter((a) => a.role === role).map((a) => a.talent);
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
          <Money amount={commitment.talentCost} />
        </div>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Production Plan</h2>
        {draft.productionChoices ? (
          <>
            <div className="row-between"><span>Set Quality</span><Money amount={draft.productionChoices.setQualityAmount} /></div>
            <div className="row-between"><span>Practical Effects</span><Money amount={draft.productionChoices.practicalEffectsAmount} /></div>
            <div className="row-between"><span>VFX Spend</span><Money amount={draft.productionChoices.vfxAmount} /></div>
            <div className="row-between">
              <span>Runtime Target</span>
              <span>{nearestLabel(draft.productionChoices.runtimeIntensity, ['Short', 'Standard', 'Long'])}</span>
            </div>
          </>
        ) : (
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>No production plan yet - visit the Production tab.</p>
        )}
        <div className="row-between" style={{ borderTop: '1px solid var(--border)', paddingTop: 8, fontWeight: 600 }}>
          <span>Production Budget</span>
          <Money amount={commitment.productionCost} />
        </div>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Total Commitment</h2>
        <div className="row-between"><span>Cast & Crew Salary</span><Money amount={commitment.talentCost} /></div>
        <div className="row-between"><span>Production Budget</span><Money amount={commitment.productionCost} /></div>
        <div className="row-between"><span>Contingency Reserve</span><Money amount={commitment.contingency} /></div>
        <div className="row-between" style={{ borderTop: '1px solid var(--border)', paddingTop: 8, fontWeight: 600 }}>
          <span>Total Commitment</span>
          <Money amount={commitment.totalCommitment} />
        </div>
        <div className="row-between" style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          <span>Studio Cash (now)</span>
          <Money amount={state.studio.cash} />
        </div>
        <div className="row-between" style={{ fontWeight: 600 }}>
          <span>Studio Cash (after Greenlight)</span>
          <Money amount={commitment.cashAfter} signColor />
        </div>
      </div>

      {!commitment.canAfford && (
        <p style={{ color: 'var(--red)' }}>
          The studio can't afford this commitment right now - trim the production plan, hire more cheaply, or wait
          until you have more cash on hand.
        </p>
      )}
    </div>
  );
}
