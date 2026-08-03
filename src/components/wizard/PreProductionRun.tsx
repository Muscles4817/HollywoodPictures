import { useEffect } from 'react';
import { useStudio } from '../../state/StudioContext';
import { computePrepRiskDelta } from '../../engine/production';
import { Button } from '../common/Button';
import { Money } from '../common/Money';
import { StatTile } from '../common/StatTile';
import { ScoreBar } from '../common/ScoreBar';
import { SeverityBadge } from '../common/SeverityBadge';
import { OnSetDecisionCard } from '../common/OnSetDecisionCard';
import { ScriptSummaryCard } from '../common/ScriptSummaryCard';
import { asPlayerDraft, findProject } from '../../engine/project';
import { formatGameDateWithMonth } from '../../engine/calendar';

const TICK_INTERVAL_MS = 500;

// The live day-by-day pre-production phase (types/index.ts:PreProductionState) -
// the prep analogue of ProductionRun, for the focused project the player is
// actively watching. Leaving this screen no longer freezes prep: it keeps
// advancing on the global ADVANCE_DAY tick in the background
// (engine/productionsInProgress.ts:settlePreProductionsInProgress). When prep
// finishes the reducer flips the screen to 'production', so this component
// unmounts on its own.
export function PreProductionRun() {
  const { state, dispatch } = useStudio();
  const draft = asPlayerDraft(findProject(state.projects, state.focusedProjectId));
  const prep = draft?.preProduction ?? null;

  // One real day of prep per tick - a genuine dispatched action, so it survives
  // a refresh exactly like the shoot. Pauses while an interactive decision is up.
  useEffect(() => {
    if (prep?.status !== 'in-progress') return;
    const timer = setInterval(() => dispatch({ type: 'ADVANCE_PREPRODUCTION_DAY' }), TICK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [prep?.status, dispatch]);

  if (!draft || !prep) {
    return (
      <div className="stack">
        <h1>Pre-Production</h1>
        <p>This project isn't in pre-production.</p>
      </div>
    );
  }

  // Deferred Start: the film is greenlit but held in development until a cast
  // member you waited for is free. Prep hasn't begun; the player advances to the
  // scheduled shoot start when ready.
  if (prep.status === 'scheduled') {
    const startDay = draft.shootStartsOnDay ?? state.totalDays;
    const daysUntil = Math.max(0, startDay - state.totalDays);
    return (
      <div className="stack">
        <h1>Pre-Production</h1>
        {draft.script && <ScriptSummaryCard script={draft.script} />}
        <div className="card stack">
          <h2>In development</h2>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            A cast member you waited for is still finishing other work, so the shoot is scheduled to begin{' '}
            <strong>{formatGameDateWithMonth(startDay)}</strong>
            {daysUntil > 0 ? ` — in ${daysUntil} day${daysUntil === 1 ? '' : 's'}` : ''}. The film is greenlit and the
            deals are signed; pre-production begins when the shoot starts.
          </p>
          <div className="row">
            <Button variant="primary" onClick={() => dispatch({ type: 'ADVANCE_TO_SHOOT_START' })}>
              {daysUntil > 0 ? `Advance to the shoot start (${formatGameDateWithMonth(startDay)})` : 'Begin pre-production'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const pctElapsed = prep.recommendedDays > 0 ? Math.min(100, (prep.daysElapsed / prep.recommendedDays) * 100) : 0;
  const daysLeft = Math.max(0, prep.recommendedDays - prep.daysElapsed);
  // Negative prep-risk delta = prep has lowered the shoot's starting risk. Kept
  // qualitative for the player (the sim's own presentation rule), read live.
  const prepDelta = computePrepRiskDelta(prep);
  const readiness = prepDelta <= -6 ? 'Ahead of the game' : prepDelta >= 6 ? 'Behind and scrambling' : 'On track';
  const readinessColor = prepDelta <= -6 ? 'var(--green, #2e7d32)' : prepDelta >= 6 ? 'var(--danger)' : 'var(--text-muted)';

  function handleFastForward() {
    for (let i = 0; i < daysLeft; i++) dispatch({ type: 'ADVANCE_PREPRODUCTION_DAY' });
  }

  return (
    <div className="stack">
      <h1>Pre-Production</h1>
      {draft.script && <ScriptSummaryCard script={draft.script} />}

      <div className="stack">
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85em' }}>
          Locking deals, scouting and building, rehearsing - the weeks before a frame is shot. How prep goes sets the
          footing the shoot starts on, and the odd creative win here can carry all the way to the finished film.
        </p>
        <div className="row">
          <StatTile label="Prep Day" value={`${prep.daysElapsed} of ~${prep.recommendedDays}`} />
          <StatTile label="Prep Spend" value={<Money amount={prep.runningCost} />} />
          <StatTile label="Readiness" value={<span style={{ color: readinessColor }}>{readiness}</span>} />
        </div>
        <ScoreBar label="Pre-Production Progress" value={pctElapsed} />

        {prep.status === 'awaiting-choice' && prep.pendingChoice && (
          <OnSetDecisionCard
            pendingChoice={prep.pendingChoice}
            talent={draft.talent.map((a) => a.person)}
            talentPool={state.talentPool}
            script={draft.script}
            totalDays={state.totalDays}
            onChoose={(choiceId) => dispatch({ type: 'RESOLVE_PREPRODUCTION_CHOICE', choiceId, productionId: draft.id })}
          />
        )}

        <div className="card stack">
          <h2>Pre-Production Events</h2>
          {prep.events.length === 0 && <p style={{ margin: 0, color: 'var(--text-muted)' }}>Nothing notable yet.</p>}
          {prep.events.map((event, i) => (
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
                {event.costDelta !== 0 ? <>Cost <Money amount={event.costDelta} signColor invertColor showSign /></> : null}
                {event.qualityDelta !== 0 ? <> &middot; Quality {event.qualityDelta >= 0 ? '+' : ''}{event.qualityDelta.toFixed(1)}</> : null}
                {event.delayDaysDelta > 0 ? <> &middot; +{event.delayDaysDelta}d</> : null}
              </span>
            </div>
          ))}
          {prep.status === 'in-progress' && (
            <div className="row-between">
              <span className="filming-status">
                Prepping<span className="filming-dot">.</span><span className="filming-dot">.</span><span className="filming-dot">.</span>
              </span>
              <div className="row">
                <Button onClick={handleFastForward}>Fast Forward to the Shoot</Button>
                <Button variant="primary" onClick={handleFastForward}>Begin Principal Photography</Button>
              </div>
            </div>
          )}
          {prep.status === 'awaiting-choice' && (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85em' }}>Waiting on your decision above...</p>
          )}
        </div>
      </div>
    </div>
  );
}
