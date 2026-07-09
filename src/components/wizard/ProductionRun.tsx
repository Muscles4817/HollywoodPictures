import { useEffect, useState } from 'react';
import { useStudio } from '../../state/StudioContext';
import { computeProductionRiskProfile } from '../../engine/production';
import { computeTalentCost, computeProductionBudgetCost } from '../../engine/cost';
import { ALL_TALENT_ROLES } from '../../data/talentGeneration';
import { Button } from '../common/Button';
import { Money } from '../common/Money';
import { StatTile } from '../common/StatTile';
import { ScoreBar } from '../common/ScoreBar';
import { WizardHeader } from '../common/WizardHeader';
import { nearestLabel } from './ProductionPlanning';
import type { TalentRole } from '../../types';

const REVEAL_INTERVAL_MS = 900;

export function ProductionRun() {
  const { state, dispatch } = useStudio();
  const draft = state.draft!;
  const hasFilmed = draft.events.length > 0;
  const [revealedCount, setRevealedCount] = useState(0);

  // Reset the reveal animation whenever a fresh batch of events comes in.
  useEffect(() => {
    setRevealedCount(0);
  }, [draft.events]);

  // Drip-feed the events one at a time so the shoot feels like it happens
  // over several days, rather than dumping the whole outcome at once.
  useEffect(() => {
    if (!hasFilmed || revealedCount >= draft.events.length) return;
    const timer = setTimeout(() => setRevealedCount((count) => count + 1), REVEAL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [hasFilmed, revealedCount, draft.events.length]);

  const riskProfile = draft.script && draft.productionChoices && draft.genre
    ? computeProductionRiskProfile(draft.talent, draft.script, draft.productionChoices, draft.genre)
    : null;

  const allRevealed = revealedCount >= draft.events.length;
  const visibleEvents = draft.events.slice(0, revealedCount);

  const totalCostDelta = draft.events.reduce((sum, e) => sum + e.costDelta, 0);
  const totalQualityDelta = draft.events.reduce((sum, e) => sum + e.qualityDelta, 0);
  const totalBuzzDelta = draft.events.reduce((sum, e) => sum + e.buzzDelta, 0);

  return (
    <div className="stack">
      <WizardHeader current="production" />
      <h1>Production</h1>

      {!hasFilmed && (
        <div className="stack">
          <div className="card stack">
            <h2 style={{ margin: 0 }}>Film Overview</h2>
            <div className="row">
              <StatTile label="Title" value={draft.title || 'Untitled Film'} />
              <StatTile label="Genre" value={draft.genre ?? '-'} />
              <StatTile label="Target Audience" value={draft.targetAudience ?? '-'} />
            </div>
            {draft.script && (
              <div
                className="row-between"
                style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}
              >
                <span>{draft.script.title} <span style={{ color: 'var(--text-muted)' }}>(script)</span></span>
                <Money amount={draft.script.cost} />
              </div>
            )}
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
            <div
              className="row-between"
              style={{ borderTop: '1px solid var(--border)', paddingTop: 8, fontWeight: 600 }}
            >
              <span>Total Cast & Crew Salary</span>
              <Money amount={computeTalentCost(draft.talent)} />
            </div>
          </div>

          {draft.productionChoices && (
            <div className="card stack">
              <h2 style={{ margin: 0 }}>Production Plan</h2>
              <div className="row-between"><span>Contingency Reserve</span><Money amount={draft.productionChoices.contingencyAmount} /></div>
              <div className="row-between">
                <span>Shooting Style</span>
                <span>{nearestLabel(draft.productionChoices.shootingIntensity, ['Fast', 'Balanced', 'Perfectionist'])}</span>
              </div>
              <div className="row-between"><span>Set Quality</span><Money amount={draft.productionChoices.setQualityAmount} /></div>
              <div className="row-between"><span>Practical Effects</span><Money amount={draft.productionChoices.practicalEffectsAmount} /></div>
              <div className="row-between"><span>VFX Spend</span><Money amount={draft.productionChoices.vfxAmount} /></div>
              <div className="row-between">
                <span>Runtime Target</span>
                <span>{nearestLabel(draft.productionChoices.runtimeIntensity, ['Short', 'Standard', 'Long'])}</span>
              </div>
              <div
                className="row-between"
                style={{ borderTop: '1px solid var(--border)', paddingTop: 8, fontWeight: 600 }}
              >
                <span>Estimated Production Cost</span>
                <Money amount={computeProductionBudgetCost(draft.productionChoices)} />
              </div>
            </div>
          )}

          {riskProfile && (
            <div className="card stack">
              <h2 style={{ margin: 0 }}>Production Risk Profile</h2>
              <ScoreBar label="Schedule Pressure" value={riskProfile.schedulePressure} />
              <ScoreBar label="Morale Risk" value={riskProfile.moraleRisk} />
              <ScoreBar label="Safety Risk" value={riskProfile.safetyRisk} />
              <ScoreBar label="Technical Complexity" value={riskProfile.technicalComplexity} />
              <ScoreBar label="Budget Risk" value={riskProfile.budgetRisk} />
              <p style={{ margin: 0 }}>
                Whichever of these read clearly high or low will shape what's actually likely to happen on set, on
                top of the usual mix of ordinary set drama. Roll the cameras and see what happens.
              </p>
              <div>
                <Button variant="primary" onClick={() => dispatch({ type: 'BEGIN_FILMING' })}>
                  Begin Filming
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {hasFilmed && (
        <div className="stack">
          <div className="card stack">
            <h2>On-Set Events</h2>
            {visibleEvents.map((event, i) => (
              <div
                key={`${event.id}-${i}`}
                className="row-between event-reveal"
                style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}
              >
                <span><strong>Day {i + 1}.</strong> {event.description}</span>
                <span style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>
                  Cost <Money amount={event.costDelta} signColor invertColor showSign /> &middot; Quality {event.qualityDelta >= 0 ? '+' : ''}{event.qualityDelta.toFixed(1)} &middot; Buzz {event.buzzDelta >= 0 ? '+' : ''}{event.buzzDelta.toFixed(1)}
                </span>
              </div>
            ))}
            {!allRevealed && (
              <div className="row-between">
                <span className="filming-status">
                  Filming<span className="filming-dot">.</span><span className="filming-dot">.</span><span className="filming-dot">.</span>
                </span>
                <Button onClick={() => setRevealedCount(draft.events.length)}>Skip</Button>
              </div>
            )}
          </div>

          {allRevealed && (
            <>
              <div className="row">
                <div className="stat">
                  <div className="stat-label">Net Cost Impact</div>
                  <div className="stat-value"><Money amount={totalCostDelta} signColor invertColor showSign /></div>
                </div>
                <div className="stat">
                  <div className="stat-label">Net Quality Impact</div>
                  <div className="stat-value">{totalQualityDelta >= 0 ? '+' : ''}{totalQualityDelta.toFixed(1)}</div>
                </div>
                <div className="stat">
                  <div className="stat-label">Net Buzz Impact</div>
                  <div className="stat-value">{totalBuzzDelta >= 0 ? '+' : ''}{totalBuzzDelta.toFixed(1)}</div>
                </div>
              </div>

              <div className="row-between">
                <span />
                <Button variant="primary" onClick={() => dispatch({ type: 'GO_TO_STEP', step: 'post-production' })}>
                  Continue to Post-Production
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
