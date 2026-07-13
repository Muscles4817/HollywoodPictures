import { useEffect, useRef, useState } from 'react';
import { useStudio } from '../../state/StudioContext';
import { computeRecommendedShootDays, computeSchedulePressure } from '../../engine/production';
import { Button } from '../common/Button';
import { Money } from '../common/Money';
import { StatTile } from '../common/StatTile';
import { ScoreBar } from '../common/ScoreBar';
import { SeverityBadge } from '../common/SeverityBadge';
import { OnSetDecisionCard } from '../common/OnSetDecisionCard';
import { WizardHeader } from '../common/WizardHeader';
import { ScriptSummaryCard } from '../common/ScriptSummaryCard';
import { TimeTickIndicator } from '../common/TimeTickIndicator';
import { asPlayerDraft, findProject } from '../../engine/project';
import type { TickSpeedMultiplier } from '../../constants';

const TICK_INTERVAL_MS = 500;

interface ProductionRunProps {
  // The background day-tick's own pause/speed state (App.tsx's Screens()) -
  // only meaningful while *viewing* a backgrounded production
  // (viewingProductionId set below), since that's the only case actually
  // driven by this tick; the live draft's own shoot always runs on its own
  // faster, dedicated interval further down, unaffected by any of these.
  paused: boolean;
  onTogglePause: () => void;
  tickNonce: number;
  speedMultiplier: TickSpeedMultiplier;
  onSetSpeedMultiplier: (speed: TickSpeedMultiplier) => void;
}

export function ProductionRun({ paused, onTogglePause, tickNonce, speedMultiplier, onSetSpeedMultiplier }: ProductionRunProps) {
  const { state, dispatch } = useStudio();
  // GameState.viewingProductionId set (Dashboard's Shooting card) means
  // "show this backgrounded production instead of the focused one" - only
  // ever reachable from the Dashboard, where focusedProjectId is already
  // null, so this never shadows or competes with unrelated in-progress work
  // (see GameState.viewingProductionId's own comment). null means today's
  // only behavior: show the focused project. Every project - focused or
  // backgrounded - lives in the same GameState.projects array (roadmap
  // Phase 5), so this is a single by-id lookup either way.
  const viewingProductionId = state.viewingProductionId;
  const shownId = viewingProductionId ?? state.focusedProjectId;
  const source = asPlayerDraft(findProject(state.projects, shownId));
  // Nullable - photography doesn't exist until GREENLIGHT_PROJECT sets it
  // (development-pipeline doc), and these two hooks have to run
  // unconditionally, before the guards below narrow it for good.
  const livePhotography = source?.photography ?? null;

  // Pure UI pause (never persisted, mirrors Dashboard's manual pause) - set
  // the first time daysElapsed crosses recommendedDays, so the shoot stops
  // and asks rather than ticking on past the estimate unattended. Tracked by
  // comparing against the previous daysElapsed rather than exact equality,
  // since a delay event can jump straight past the threshold in one tick.
  const [awaitingContinueDecision, setAwaitingContinueDecision] = useState(false);
  const prevDaysElapsedRef = useRef(livePhotography?.daysElapsed ?? 0);

  useEffect(() => {
    if (!livePhotography) return;
    const prev = prevDaysElapsedRef.current;
    const curr = livePhotography.daysElapsed;
    prevDaysElapsedRef.current = curr;
    if (livePhotography.status === 'in-progress' && prev < livePhotography.recommendedDays && curr >= livePhotography.recommendedDays) {
      setAwaitingContinueDecision(true);
    }
  }, [livePhotography?.daysElapsed, livePhotography?.status, livePhotography?.recommendedDays]);

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
    if (viewingProductionId || livePhotography?.status !== 'in-progress' || awaitingContinueDecision) return;
    const timer = setInterval(() => dispatch({ type: 'ADVANCE_SHOOTING_DAY' }), TICK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [viewingProductionId, livePhotography?.status, awaitingContinueDecision, dispatch]);

  if (!source) {
    return (
      <div className="stack">
        <h1>Production</h1>
        <p>This production isn't available any more - it may have already been picked up from the Inbox.</p>
        <Button onClick={() => dispatch({ type: 'RETURN_TO_DASHBOARD' })}>Back to Dashboard</Button>
      </div>
    );
  }
  if (!source.photography) {
    // Unreachable through the normal wizard flow - GREENLIGHT_PROJECT is
    // what sets photography, and it's also what first sends the focused
    // project to this screen (development-pipeline doc); Dashboard's own
    // Shooting card (VIEW_PRODUCTION) only ever offers a backgrounded
    // production that already has one too. Kept as a defensive fallback
    // rather than a non-null assertion, same reasoning as the `!source`
    // guard just above.
    return (
      <div className="stack">
        <h1>Production</h1>
        <p>This project hasn't been greenlit yet.</p>
        <Button onClick={() => dispatch({ type: 'RETURN_TO_DASHBOARD' })}>Back to Dashboard</Button>
      </div>
    );
  }
  const draft = source;
  // Non-null assertion, not TS narrowing that doesn't survive `source` being
  // rebound to `draft` - the guard just above already verified this.
  const photography = draft.photography!;

  const recommendedDays = draft.script && draft.productionChoices
    ? computeRecommendedShootDays(draft.talent, draft.script, draft.productionChoices)
    : 0;

  function handleFastForward() {
    const remaining = Math.max(0, recommendedDays - photography.daysElapsed);
    for (let i = 0; i < remaining; i++) dispatch({ type: 'ADVANCE_SHOOTING_DAY' });
  }

  const pendingChoice = photography.pendingChoice;

  const totalCostDelta = photography.events.reduce((sum, e) => sum + e.costDelta, 0);
  const totalQualityDelta = photography.events.reduce((sum, e) => sum + e.qualityDelta, 0);
  const totalBuzzDelta = photography.events.reduce((sum, e) => sum + e.buzzDelta, 0);
  const finalSchedulePressure = computeSchedulePressure(photography.daysElapsed, photography.recommendedDays);
  // Positive = unspent Contingency Reserve credited back to Studio Cash when
  // this shoot wrapped; negative = it ran over the reserve and the excess
  // was charged instead - see FINISH_PHOTOGRAPHY, state/studioReducer.ts.
  const contingencySettlement =
    draft.productionChoices ? draft.productionChoices.contingencyAmount - photography.runningCost : 0;
  // The same reserve, framed live during the shoot rather than only once it
  // wraps - photography.runningCost is entirely contingency burn (see
  // engine/cost.ts:computeDailyContingencyBurn), so this is a direct,
  // always-current reading of how much of the reserve is left, not an
  // estimate.
  const contingencyRemaining =
    draft.productionChoices ? draft.productionChoices.contingencyAmount - photography.runningCost : 0;
  const contingencyPercentConsumed =
    draft.productionChoices && draft.productionChoices.contingencyAmount > 0
      ? (photography.runningCost / draft.productionChoices.contingencyAmount) * 100
      : 0;

  return (
    <div className="stack">
      <WizardHeader current="production" />
      <h1>Production</h1>
      {viewingProductionId && (
        <TimeTickIndicator
          paused={paused}
          onTogglePause={onTogglePause}
          tickNonce={tickNonce}
          speedMultiplier={speedMultiplier}
          onSetSpeedMultiplier={onSetSpeedMultiplier}
        />
      )}
      {draft.script && <ScriptSummaryCard script={draft.script} />}

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
            <StatTile label="Contingency Remaining" value={<Money amount={Math.max(0, contingencyRemaining)} />} />
            {photography.status === 'in-progress' && (
              <StatTile label="Schedule Pressure" value={`${computeSchedulePressure(photography.daysElapsed, photography.recommendedDays)}/100`} />
            )}
          </div>
          {photography.status !== 'finished' && (
            <ScoreBar label="Contingency Reserve Consumed" value={contingencyPercentConsumed} />
          )}
          {contingencyRemaining < 0 && photography.status !== 'finished' && (
            <p style={{ color: 'var(--red)', margin: 0 }}>
              Contingency Reserve exhausted - <Money amount={-contingencyRemaining} /> over, charged when you wrap.
            </p>
          )}
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
                  onClick={() => dispatch({ type: 'FINISH_PHOTOGRAPHY', productionId: shownId! })}
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
              talentPool={state.talentPool}
              script={draft.script}
              onChoose={(choiceId) => dispatch({ type: 'RESOLVE_EVENT_CHOICE', choiceId, productionId: shownId! })}
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
                    onClick={() => dispatch({ type: 'FINISH_PHOTOGRAPHY', productionId: shownId! })}
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
                      ? dispatch({ type: 'RESUME_PROJECT', projectId: viewingProductionId })
                      : dispatch({ type: 'GO_TO_STEP', step: 'post-production' })
                  }
                >
                  Continue to Post-Production
                </Button>
              </div>
            </>
          )}
        </div>
    </div>
  );
}
