import { useEffect, useRef, useState } from 'react';
import { useStudio } from '../../state/StudioContext';
import { computeStaticProductionRisk, computeRecommendedShootDays, computeSchedulePressure } from '../../engine/production';
import { computeTalentCost, computeProductionBudgetCost } from '../../engine/cost';
import { computeTalentCompatibility } from '../../engine/compatibility';
import { ALL_TALENT_ROLES } from '../../data/talentGeneration';
import { Button } from '../common/Button';
import { Money } from '../common/Money';
import { StatTile } from '../common/StatTile';
import { ScoreBar } from '../common/ScoreBar';
import { SeverityBadge } from '../common/SeverityBadge';
import { WizardHeader } from '../common/WizardHeader';
import { nearestLabel } from './ProductionPlanning';
import type { TalentRole } from '../../types';

const TICK_INTERVAL_MS = 500;

export function ProductionRun() {
  const { state, dispatch } = useStudio();
  const draft = state.draft!;
  const photography = draft.photography;

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
  useEffect(() => {
    if (photography?.status !== 'in-progress' || awaitingContinueDecision) return;
    const timer = setInterval(() => dispatch({ type: 'ADVANCE_SHOOTING_DAY' }), TICK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [photography?.status, awaitingContinueDecision, dispatch]);

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
  const involvedTalent = pendingChoice?.involvedTalentId
    ? draft.talent.find((t) => t.id === pendingChoice.involvedTalentId)
    : undefined;
  const involvedStat = involvedTalent
    ? 'skill' in involvedTalent
      ? `Skill ${involvedTalent.skill}`
      : draft.script
        ? `Compatibility ${computeTalentCompatibility(involvedTalent, draft.script) ?? '-'}`
        : null
    : null;
  // Recast choices (data/productionEvents.ts:offersReplacementFor) get shown
  // as candidate cards in a dedicated side panel instead of plain buttons,
  // alongside who they'd be replacing - everything else stays a normal
  // choice button in the main column.
  const replacementChoices = pendingChoice?.choices.filter((c) => c.replacementCandidateId !== undefined) ?? [];
  const regularChoices = pendingChoice?.choices.filter((c) => c.replacementCandidateId === undefined) ?? [];

  const totalCostDelta = photography ? photography.events.reduce((sum, e) => sum + e.costDelta, 0) : 0;
  const totalQualityDelta = photography ? photography.events.reduce((sum, e) => sum + e.qualityDelta, 0) : 0;
  const totalBuzzDelta = photography ? photography.events.reduce((sum, e) => sum + e.buzzDelta, 0) : 0;
  const finalSchedulePressure = photography ? computeSchedulePressure(photography.daysElapsed, photography.recommendedDays) : 0;

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
              <div>
                <Button variant="primary" onClick={() => dispatch({ type: 'BEGIN_PHOTOGRAPHY' })}>
                  Begin Principal Photography
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {photography && (
        <div className="stack">
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
                <Button variant="primary" onClick={() => dispatch({ type: 'FINISH_PHOTOGRAPHY' })}>
                  Finish Principal Photography
                </Button>
              </div>
            </div>
          )}

          {photography.status === 'awaiting-choice' && pendingChoice && (
            <div className="card stack" style={{ borderColor: 'var(--primary)' }}>
              <div className="row-between">
                <h2 style={{ margin: 0 }}>A Decision Is Needed</h2>
                <SeverityBadge severity={pendingChoice.severity} />
              </div>
              {involvedTalent && replacementChoices.length === 0 && (
                <div className="row-between event-involved-talent" style={{ fontSize: '0.9em', color: 'var(--text-muted)' }}>
                  <span>{involvedTalent.name} &middot; {pendingChoice.involvedRole}</span>
                  {involvedStat && <span>{involvedStat}</span>}
                </div>
              )}
              <p style={{ margin: 0 }}>{pendingChoice.situation}</p>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85em' }}>Filming is paused until you pick.</p>
              <div className={replacementChoices.length > 0 ? 'event-decision-layout' : undefined}>
                <div className="stack">
                  {regularChoices.map((choice) => (
                    <button
                      key={choice.id}
                      className="event-choice-button"
                      onClick={() => dispatch({ type: 'RESOLVE_EVENT_CHOICE', choiceId: choice.id })}
                    >
                      <span className="event-choice-label-row">
                        <span className="event-choice-label">{choice.label}</span>
                      </span>
                      <span className="event-choice-description">{choice.description}</span>
                    </button>
                  ))}
                </div>

                {replacementChoices.length > 0 && (
                  <div className="stack event-people-panel">
                    <h3 style={{ margin: 0 }}>People Involved</h3>
                    {involvedTalent && (
                      <div className="card">
                        <div className="card-title">{involvedTalent.name}</div>
                        <div className="card-subtitle">Currently {pendingChoice.involvedRole}</div>
                        {involvedStat && (
                          <div style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>{involvedStat}</div>
                        )}
                      </div>
                    )}
                    <div className="stat-label">Replace with</div>
                    {replacementChoices.map((choice) => (
                      <div className="card" key={choice.id}>
                        <div className="card-title">{choice.replacementCandidateName}</div>
                        {choice.replacementCandidateSalary !== undefined && (
                          <div className="card-subtitle"><Money amount={choice.replacementCandidateSalary} /></div>
                        )}
                        <p style={{ margin: '6px 0', fontSize: '0.85em' }}>{choice.description}</p>
                        <Button
                          variant="primary"
                          className="btn-sm"
                          onClick={() => dispatch({ type: 'RESOLVE_EVENT_CHOICE', choiceId: choice.id })}
                        >
                          {choice.label}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
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
                  <Button onClick={handleFastForward}>Fast Forward to Day {photography.recommendedDays}</Button>
                  <Button variant="primary" onClick={() => dispatch({ type: 'FINISH_PHOTOGRAPHY' })}>
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
