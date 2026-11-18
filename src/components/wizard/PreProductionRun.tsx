import { useEffect } from 'react';
import { useStudio } from '../../state/StudioContext';
import { Button } from '../common/Button';
import { Money } from '../common/Money';
import { StatTile } from '../common/StatTile';
import { ScoreBar } from '../common/ScoreBar';
import { OnSetDecisionCard } from '../common/OnSetDecisionCard';
import { PREP_PAUSED_MESSAGE } from '../common/decisionText';
import { ScriptSummaryCard } from '../common/ScriptSummaryCard';
import { asPlayerDraft, findProject } from '../../engine/project';
import { formatGameDateWithMonth } from '../../engine/calendar';
import { derivePrepDemands } from '../../engine/prep/demands';
import { readinessChecklist } from '../../engine/prep/handoff';
import { PREP_ACTIVITIES, PREP_ACTIVITY_LABEL, PREP_FRONT_LIVE_THRESHOLD } from '../../data/prep';
import { PrepCheckpointBriefing } from '../prep/PrepCheckpointBriefing';

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
  const liveFronts = draft.script && draft.productionChoices
    ? derivePrepDemands({ script: draft.script, talent: draft.talent, choices: draft.productionChoices, environmentStrategy: draft.environmentStrategy })
        .filter((d) => d.demand >= PREP_FRONT_LIVE_THRESHOLD)
        .map((d) => d.front)
    : [];
  const checklist = readinessChecklist(prep, liveFronts);
  const stateWord = { ready: 'Ready', open: 'Open problems', unchecked: 'Not checked' } as const;
  const stateColor = { ready: 'var(--green)', open: 'var(--danger)', unchecked: 'var(--amber)' } as const;
  const skipped = PREP_ACTIVITIES.filter((a) => !prep.activities[a]);

  function handleFastForward() {
    for (let i = 0; i < daysLeft; i++) dispatch({ type: 'ADVANCE_PREPRODUCTION_DAY' });
  }

  return (
    <div className="stack">
      <h1>Pre-Production</h1>
      {draft.script && <ScriptSummaryCard script={draft.script} />}

      <div className="stack">
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85em' }}>
          Breaking the script down, building, scouting, testing, rehearsing - the weeks before a frame is shot. Prep
          cannot make the film better than its people and its money allow; it finds what would go wrong on the shoot
          while it is still cheap to fix.
        </p>
        <div className="row">
          <StatTile label="Prep Day" value={`${prep.daysElapsed} of ~${prep.recommendedDays}`} />
          <StatTile label="Prep Spend" value={<Money amount={prep.runningCost} />} />
          <StatTile label="Decisions" value={prep.delegated ? 'Production team' : 'You'} />
        </div>
        <ScoreBar label="Pre-Production Progress" value={pctElapsed} />

        {prep.status === 'awaiting-checkpoint' && prep.pendingCheckpoint && <PrepCheckpointBriefing draft={draft} />}

        <div className="card stack">
          <div className="row-between">
            <h2 style={{ margin: 0 }}>Readiness</h2>
            <label className="row" style={{ gap: 6, fontSize: '0.9em' }}>
              <input
                type="checkbox"
                checked={prep.delegated}
                disabled={prep.status === 'finished'}
                onChange={(e) => dispatch({ type: 'SET_PREP_DELEGATION', productionId: draft.id, delegated: e.target.checked })}
              />
              The production team makes prep's decisions
            </label>
          </div>
          {checklist.map((row) => (
            <div key={row.front} className="row-between" style={{ fontSize: '0.9em' }}>
              <span>{row.label}</span>
              <span style={{ color: stateColor[row.state] }}>{stateWord[row.state]}</span>
            </div>
          ))}
          {skipped.length > 0 && (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85em' }}>
              Not being done on this prep: {skipped.map((a) => PREP_ACTIVITY_LABEL[a].toLowerCase()).join('; ')}. What only
              that work would find, the shoot will find instead.
            </p>
          )}
        </div>

        {prep.status === 'awaiting-choice' && prep.pendingChoice && (
          <OnSetDecisionCard
            pendingChoice={prep.pendingChoice}
            talent={draft.talent.map((a) => a.person)}
            talentPool={state.talentPool}
            script={draft.script}
            totalDays={state.totalDays}
            pausedMessage={PREP_PAUSED_MESSAGE}
            showChoiceCosts
            onChoose={(choiceId) => dispatch({ type: 'RESOLVE_PREPRODUCTION_CHOICE', choiceId, productionId: draft.id })}
          />
        )}

        <div className="card stack">
          <h2>Prep Log</h2>
          {prep.log.length === 0 && <p style={{ margin: 0, color: 'var(--text-muted)' }}>Nothing found yet.</p>}
          {prep.log.map((entry, i) => (
            <div key={i} className="row event-reveal" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 6, gap: 8, fontSize: '0.9em' }}>
              <span style={{ color: 'var(--text-muted)', minWidth: 56 }}>Day {entry.day}</span>
              <span style={{ fontWeight: entry.kind === 'checkpoint' ? 600 : undefined }}>{entry.text}</span>
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
          {(prep.status === 'awaiting-choice' || prep.status === 'awaiting-checkpoint') && (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85em' }}>Waiting on your decisions above...</p>
          )}
        </div>
      </div>
    </div>
  );
}
