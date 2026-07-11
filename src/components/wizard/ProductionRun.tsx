import { useEffect, useRef, useState } from 'react';
import { useStudio } from '../../state/StudioContext';
import { computeStaticProductionRisk, computeRecommendedShootDays, computeSchedulePressure } from '../../engine/production';
import { computeTalentCost, computeProductionBudgetCost } from '../../engine/cost';
import { ALL_TALENT_ROLES } from '../../data/talentGeneration';
import { Button } from '../common/Button';
import { Money } from '../common/Money';
import { StatTile } from '../common/StatTile';
import { ScoreBar } from '../common/ScoreBar';
import { SeverityBadge } from '../common/SeverityBadge';
import { OnSetDecisionCard } from '../common/OnSetDecisionCard';
import { WizardHeader } from '../common/WizardHeader';
import { nearestLabel } from './ProductionPlanning';
import type { FilmDraft, TalentRole } from '../../types';

const TICK_INTERVAL_MS = 500;

export function ProductionRun() {
  const { state, dispatch } = useStudio();
  // GameState.viewingProductionId set (Dashboard's Shooting card) means
  // "show this backgrounded production instead of the live draft" - only
  // ever reachable from the Dashboard, where `draft` is already null, so
  // this never shadows or competes with unrelated in-progress work (see
  // GameState.viewingProductionId's own comment). null means today's only
  // behavior: show the live draft.
  const viewingProductionId = state.viewingProductionId;
  const source: FilmDraft | null = viewingProductionId
    ? (state.studio.productionsInProgress.find((p) => p.id === viewingProductionId) ?? null)
    : state.draft;
  const photography = source?.photography ?? null;

  // Pure UI pause (never persisted, mirrors Dashboard's manual pause) - set
  // the first time daysElapsed crosses recommendedDays, so the shoot stops
  // and asks rather than ticking on past the estimate unattended. Tracked by
  // comparing against the previous daysElapsed rather than exact equality,
  // since a delay event can jump straight past the threshold in one tick.
  const [awaitingContinueDecision, setAwaitingContinueDecision] = useState(false);
  const prevDaysElapsedRef = useRef(photography?.daysElapsed ?? 0);

  useEffect(() => {
    if (!photography) return;
    const prev = prevDaysElapsedRef.current;
    const curr = photography.daysElapsed;
    prevDaysElapsedRef.current = curr;
    if (photography.status === 'in-progress' && prev < photography.recommendedDays && curr >= photography.recommendedDays) {
      setAwaitingContinueDecision(true);
    }
  }, [photography?.daysElapsed, photography?.status, photography?.recommendedDays]);

  // Ticks one real day of principal photography at a time while it's
  // running - each tick is a genuine dispatched action (ADVANCE_SHOOTING_DAY),
  // not a local animation, so the shoot survives a refresh exactly where it
  // left off, same as everything else in this app. Also stops while the
  // player is deciding whether to keep going past the recommended schedule.
  // Live-draft only (ADVANCE_SHOOTING_DAY has no productionId - a
  // backgrounded production being viewed here only advances the normal
  // "chunky" way, via the shared calendar, same as when nobody's looking at
  // it - see engine/productionsInProgress.ts).
  useEffect(() => {
    if (viewingProductionId || photography?.status !== 'in-progress' || awaitingContinueDecision) return;
    const timer = setInterval(() => dispatch({ type: 'ADVANCE_SHOOTING_DAY' }), TICK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [viewingProductionId, photography?.status, awaitingContinueDecision, dispatch]);

  if (!source) {
    return (
      <div className="stack">
        <h1>Production</h1>
        <p>This production isn't available any more - it may have already been picked up from the Inbox.</p>
        <Button onClick={() => dispatch({ type: 'RETURN_TO_DASHBOARD' })}>Back to Dashboard</Button>
      </div>
    );
  }
  const draft = source;

  const staticRisk = draft.script && draft.productionChoices && draft.genre
    ? computeStaticProductionRisk(draft.talent, draft.script, draft.productionChoices, draft.genre)
    : null;
  const recommendedDays = draft.script && draft.productionChoices
    ? computeRecommendedShootDays(draft.talent, draft.script, draft.productionChoices)
    : 0;

  function handleFastForward() {
    if (!photography) return;
    const remaining = Math.max(0, recommendedDays - photography.daysElapsed);
    for (let i = 0; i < remaining; i++) dispatch({ type: 'ADVANCE_SHOOTING_DAY' });
  }

  const pendingChoice = photography?.pendingChoice ?? null;

  const totalCostDelta = photography ? photography.events.reduce((sum, e) => sum + e.costDelta, 0) : 0;
  const totalQualityDelta = photography ? photography.events.reduce((sum, e) => sum + e.qualityDelta, 0) : 0;
  const totalBuzzDelta = photography ? photography.events.reduce((sum, e) => sum + e.buzzDelta, 0) : 0;
  const finalSchedulePressure = photography ? computeSchedulePressure(photography.daysElapsed, photography.recommendedDays) : 0;
  // Positive = unspent Contingency Reserve credited back to Studio Cash when
  // this shoot wrapped; negative = it ran over the reserve and the excess
  // was charged instead - see FINISH_PHOTOGRAPHY, state/studioReducer.ts.
  const contingencySettlement =
    photography && draft.productionChoices ? draft.productionChoices.contingencyAmount - photography.runningCost : 0;

  return (
    <div className="stack">
      <WizardHeader current="production" />
      <h1>Production</h1>

      {!photography && (
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

          {staticRisk && (
            <div className="card stack">
              <h2 style={{ margin: 0 }}>Production Risk Profile</h2>
              <ScoreBar label="Morale Risk" value={staticRisk.moraleRisk} />
              <ScoreBar label="Safety Risk" value={staticRisk.safetyRisk} />
              <ScoreBar label="Technical Complexity" value={staticRisk.technicalComplexity} />
              <ScoreBar label="Budget Risk" value={staticRisk.budgetRisk} />
              <p style={{ margin: 0 }}>
                Recommended principal photography: <strong>~{recommendedDays} days</strong>, burning your Contingency
                Reserve at <Money amount={draft.productionChoices ? draft.productionChoices.contingencyAmount / recommendedDays : 0} />/day
                (<Money amount={draft.productionChoices?.contingencyAmount ?? 0} /> total if you wrap on schedule).
                Once you begin, you'll watch the shoot happen one day at a time and can wrap it whenever you choose -
                cut it short to save money, or let it run long to give the team more room to work, at that same
                daily cost with no cap. Schedule Pressure will depend on whichever you pick.
              </p>
              <p style={{ margin: 0 }}>
                Cast/crew salaries and the production budget (
                <Money amount={computeTalentCost(draft.talent) + (draft.productionChoices ? computeProductionBudgetCost(draft.productionChoices) : 0)} />
                ), plus the full Contingency Reserve above, come out of Studio Cash the moment you begin - that money is
                committed for the duration of the shoot. Salary and the production budget are spent for good; whatever
                Contingency Reserve isn't actually burned comes back when you finish principal photography.
              </p>
              <div>
                <Button variant="primary" onClick={() => dispatch({ type: 'BEGIN_PHOTOGRAPHY' })}>
                  Begin Principal Photography
                </Button>
              </div>
            </div>
          )}

          <div className="row-between">
            <div className="row">
              <Button onClick={() => dispatch({ type: 'GO_TO_STEP', step: 'production-planning' })}>Back</Button>
              <Button onClick={() => dispatch({ type: 'RETURN_TO_DASHBOARD' })}>Back to Dashboard</Button>
            </div>
          </div>
        </div>
      )}

      {photography && (
        <div className="stack">
          <div className="row-between">
            {!viewingProductionId && (
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85em' }}>
                The shoot keeps going in the background - head back to the Dashboard to start another film.
              </p>
            )}
            <Button onClick={() => dispatch({ type: 'RETURN_TO_DASHBOARD' })}>Back to Dashboard</Button>
          </div>
          <div className="row">
            <StatTile label="Day" value={`${photography.daysElapsed} of ~${photography.recommendedDays} recommended`} />
            <StatTile label="Spent So Far" value={<Money amount={photography.runningCost} />} />
            {photography.status === 'in-progress' && (
              <StatTile label="Schedule Pressure" value={`${computeSchedulePressure(photography.daysElapsed, photography.recommendedDays)}/100`} />
            )}
          </div>
          {photography.status === 'in-progress' && photography.daysElapsed > photography.recommendedDays && (
            <p style={{ color: 'var(--red)', margin: 0 }}>
              Past the recommended schedule - every extra day now costs beyond the original estimate, with no cap.
            </p>
          )}

          {photography.status === 'in-progress' && awaitingContinueDecision && (
            <div className="card stack" style={{ borderColor: 'var(--primary)' }}>
              <h2 style={{ margin: 0 }}>Recommended Schedule Reached</h2>
              <p style={{ margin: 0 }}>
                You've hit the recommended ~{photography.recommendedDays} days for this shoot. Keep filming for a
                chance at more polish - at the same daily cost, with no cap - or wrap it here?
              </p>
              <div className="row">
                <Button onClick={() => setAwaitingContinueDecision(false)}>Keep Filming</Button>
                <Button
                  variant="primary"
                  onClick={() => dispatch({ type: 'FINISH_PHOTOGRAPHY', productionId: viewingProductionId ?? undefined })}
                >
                  Finish Principal Photography
                </Button>
              </div>
            </div>
          )}

          {photography.status === 'awaiting-choice' && pendingChoice && (
            <OnSetDecisionCard
              pendingChoice={pendingChoice}
              talent={draft.talent}
              script={draft.script}
              onChoose={(choiceId) => dispatch({ type: 'RESOLVE_EVENT_CHOICE', choiceId, productionId: viewingProductionId ?? undefined })}
            />
          )}

          <div className="card stack">
            <h2>On-Set Events</h2>
            {photography.events.length === 0 && (
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>Nothing notable yet.</p>
            )}
            {photography.events.map((event, i) => (
              <div
                key={`${event.id}-${i}`}
                className="row-between event-reveal"
                style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}
              >
                <span className="row" style={{ gap: 8 }}>
                  <SeverityBadge severity={event.severity} />
                  <span>{event.description}</span>
                </span>
                <span style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>
                  Cost <Money amount={event.costDelta} signColor invertColor showSign /> &middot; Quality {event.qualityDelta >= 0 ? '+' : ''}{event.qualityDelta.toFixed(1)} &middot; Buzz {event.buzzDelta >= 0 ? '+' : ''}{event.buzzDelta.toFixed(1)}
                  {event.delayDaysDelta > 0 ? <> &middot; +{event.delayDaysDelta}d</> : null}
                </span>
              </div>
            ))}
            {photography.status === 'in-progress' && !awaitingContinueDecision && (
              <div className="row-between">
                <span className="filming-status">
                  Filming<span className="filming-dot">.</span><span className="filming-dot">.</span><span className="filming-dot">.</span>
                </span>
                <div className="row">
                  {!viewingProductionId && (
                    <Button onClick={handleFastForward}>Fast Forward to Day {photography.recommendedDays}</Button>
                  )}
                  <Button
                    variant="primary"
                    onClick={() => dispatch({ type: 'FINISH_PHOTOGRAPHY', productionId: viewingProductionId ?? undefined })}
                  >
                    Finish Principal Photography
                  </Button>
                </div>
              </div>
            )}
            {photography.status === 'in-progress' && awaitingContinueDecision && (
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85em' }}>Paused - decide above whether to keep filming.</p>
            )}
            {photography.status === 'awaiting-choice' && (
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85em' }}>Waiting on your decision above...</p>
            )}
          </div>

          {photography.status === 'finished' && (
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
                <div className="stat">
                  <div className="stat-label">Final Schedule Pressure</div>
                  <div className="stat-value">{finalSchedulePressure}/100</div>
                </div>
                <div className="stat">
                  <div className="stat-label">{contingencySettlement >= 0 ? 'Contingency Refunded' : 'Contingency Overrun Charged'}</div>
                  <div className="stat-value"><Money amount={Math.abs(contingencySettlement)} /></div>
                </div>
              </div>

              <div className="row-between">
                <span />
                <Button
                  variant="primary"
                  onClick={() =>
                    viewingProductionId
                      ? dispatch({ type: 'RESUME_FOR_POST_PRODUCTION', productionId: viewingProductionId })
                      : dispatch({ type: 'GO_TO_STEP', step: 'post-production' })
                  }
                >
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
