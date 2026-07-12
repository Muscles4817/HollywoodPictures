import { useStudio } from '../../state/StudioContext';
import { formatGameDate } from '../../engine/calendar';
import { Button } from './Button';
import { Money } from './Money';
import { OnSetDecisionCard } from './OnSetDecisionCard';

interface InboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Global notification center for Studio.productionsInProgress - the
 * player's own shoots running in the background (docs/DESIGN.md 5.x).
 * Fixed-position, mounted once alongside DateBar/ThemeToggle so it's
 * reachable from any screen, including mid-wizard while planning a second
 * film. Two kinds of item need attention here:
 *  - 'awaiting-choice': an on-set event paused that specific production -
 *    resolving it here (OnSetDecisionCard, same component ProductionRun.tsx
 *    uses for the live draft) unpauses just that one.
 *  - 'finished': photography wrapped and is waiting to be picked up for
 *    post-production - only actionable while the player isn't already
 *    mid-wizard on something else (state.draft !== null), so this can never
 *    silently take over unrelated in-progress work.
 * Opening the Inbox pauses the real-time day tick (see App.tsx's `ticking`),
 * the same way the Dashboard's manual pause button already does - a slow
 * decision in here shouldn't cost the player time either.
 */
export function Inbox({ open, onOpenChange }: InboxProps) {
  const { state, dispatch } = useStudio();
  const productions = state.studio.productionsInProgress;
  const awaitingChoice = productions.filter((p) => p.photography?.status === 'awaiting-choice');
  const finished = productions.filter((p) => p.photography?.status === 'finished');
  const badgeCount = awaitingChoice.length + finished.length;

  return (
    <>
      <div className="inbox-toggle-fixed">
        <Button onClick={() => onOpenChange(!open)} aria-label="Open Inbox">
          Inbox{badgeCount > 0 ? ` (${badgeCount})` : ''}
        </Button>
      </div>

      {open && (
        <div className="modal-overlay" onClick={() => onOpenChange(false)}>
          <div className="modal-content stack" onClick={(e) => e.stopPropagation()}>
            <div className="row-between">
              <h2 style={{ margin: 0 }}>Inbox</h2>
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            </div>

            {badgeCount === 0 && (
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                Nothing needs your attention right now - background shoots keep going on their own.
              </p>
            )}

            {awaitingChoice.map((production) =>
              production.photography?.pendingChoice ? (
                <div className="stack" key={production.id}>
                  <h3 style={{ margin: 0 }}>{production.title || 'Untitled Film'}</h3>
                  <OnSetDecisionCard
                    pendingChoice={production.photography.pendingChoice}
                    talent={production.talent}
                    talentPool={state.talentPool}
                    script={production.script}
                    onChoose={(choiceId) => dispatch({ type: 'RESOLVE_EVENT_CHOICE', choiceId, productionId: production.id })}
                  />
                </div>
              ) : null,
            )}

            {finished.map((production) => (
              <div className="card stack" key={production.id}>
                <div className="card-title">{production.title || 'Untitled Film'}</div>
                <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                  Principal photography wrapped
                  {production.photography ? <> at <Money amount={production.photography.runningCost} /> spent</> : null} - ready
                  for post-production.
                </p>
                {state.draft ? (
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85em' }}>
                    Finish or leave what you're currently working on before picking this back up.
                  </p>
                ) : (
                  <div>
                    <Button variant="primary" onClick={() => dispatch({ type: 'RESUME_FOR_POST_PRODUCTION', productionId: production.id })}>
                      Continue to Post-Production
                    </Button>
                  </div>
                )}
              </div>
            ))}

            {productions.length > 0 && (
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85em' }}>
                {formatGameDate(state.totalDays)} &middot; {productions.length} production{productions.length === 1 ? '' : 's'} in
                the background.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
