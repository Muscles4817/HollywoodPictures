import { useStudio } from '../../state/StudioContext';
import { Button } from './Button';
import { Money } from './Money';
import { OnSetDecisionCard } from './OnSetDecisionCard';
import { backgroundedPlayerDrafts, deriveInboxItems } from '../../engine/project';
import { highestBid } from '../../engine/opportunities';
import type { BidNotification } from '../../types';

interface InboxProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Global notification center for the player's own backgrounded shoots
 * (docs/DESIGN.md 5.x) - every 'player-in-progress' GameState.projects
 * entry except the currently-focused one (see engine/project.ts:backgroundedPlayerDrafts).
 * The toggle button/badge lives in Header.tsx now (it's a piece of
 * persistent chrome, same as the Dashboard button); this component is just
 * the overlay itself, controlled by `open`. Three kinds of item need
 * attention here:
 *  - 'awaiting-choice': an on-set event paused that specific production -
 *    resolving it here (OnSetDecisionCard, same component ProductionRun.tsx
 *    uses for the focused project) unpauses just that one.
 *  - 'wrapped' (photography finished, post-production not started): ready
 *    to be picked up for post-production.
 *  - 'parked' (post-production also done, roadmap Phase 7.1/7.3): every
 *    creative decision is made, it just needs a release day - resuming it
 *    goes straight to Marketing & Release instead of back through
 *    post-production choices that are already locked in. Distinct from
 *    'scheduled' (engine/project.ts) - a parked project hasn't picked a
 *    release day yet, so it's still an ordinary backgrounded
 *    'player-in-progress' project, not its own kind.
 *  - 'casting' (Casting Redesign, Phase C, extended Phase D) - a still-in-
 *    Development project (no photography yet) with new casting applicants
 *    waiting on a Character that isn't cast yet
 *    (engine/castingCalls.ts:castingCallsAwaitingReview) - both Open Casting
 *    responses and InterestedTalent arrivals (the latter called out by name,
 *    section 6). Read-only here -
 *    resolving it means going back into Cast & Crew, not something the
 *    Inbox itself can do, since casting decisions are per-Character (see
 *    components/wizard/CastingDrawer.tsx), not a single yes/no this list
 *    can surface directly. Only the focused draft's own applicants are
 *    invisible while it's showing on its own screen already - the same
 *    "the currently-focused project never needs a second, redundant entry
 *    here" rule the other three kinds already follow.
 * Both wrapped and parked items are only actionable while the player isn't
 * already mid-wizard on something else (state.focusedProjectId !== null),
 * so this can never silently take over unrelated in-progress work. Opening
 * the Inbox pauses the real-time day tick (see App.tsx's `ticking`), the
 * same way the Dashboard's manual pause button already does - a slow
 * decision in here shouldn't cost the player time either.
 */
export function Inbox({ open, onClose }: InboxProps) {
  const { state, dispatch } = useStudio();
  if (!open) return null;

  // Inbox is mounted globally, including mid-wizard while something is
  // focused (unlike Dashboard, where RETURN_TO_DASHBOARD guarantees
  // focusedProjectId is null) - deriveInboxItems excludes that focused one
  // internally, so it's never shown here a second time: its own screen
  // (ProductionRun.tsx/MarketingRelease.tsx) is where it belongs, not the
  // Inbox. The exact same derivation Header.tsx's badge count reads
  // (engine/project.ts:inboxBadgeCount), so the two can never drift apart.
  const { awaitingChoice, wrapped, parked, casting } = deriveInboxItems(state.projects, state.focusedProjectId);
  // Every backgrounded draft, regardless of category - the "N productions
  // in the background" reassurance line below, distinct from badgeCount
  // (only the ones actually needing attention).
  const productions = backgroundedPlayerDrafts(state.projects, state.focusedProjectId);
  const badgeCount = awaitingChoice.length + wrapped.length + parked.length + casting.length;

  // Bid "emails" (engine/bidNotifications.ts) - stored newest-first. An
  // 'outbid' is still actionable only while its opportunity is genuinely live
  // and the player still isn't leading it; once the weekly tick resolves it,
  // the opportunity is gone and raising is no longer possible.
  const bidNotifications = state.bidNotifications ?? [];
  const isOutbidActionable = (n: BidNotification): boolean => {
    if (n.kind !== 'outbid') return false;
    const opp = state.opportunities.find((o) => o.id === n.opportunityId && o.expiresOnDay > state.totalDays);
    return !!opp && highestBid(opp)?.bidderId !== 'player';
  };
  const bidMessage = (n: BidNotification): string => {
    const title = n.scriptTitle || 'an untitled script';
    switch (n.kind) {
      case 'won':
        return `You won the rights to “${title}”. It's in your Asset Library, ready to develop.`;
      case 'lost':
        return `You were outbid on “${title}” — ${n.rivalName ?? 'a rival'} took it.`;
      case 'outbid':
        return `${n.rivalName ?? 'A rival'} has outbid you on “${title}”.`;
    }
  };

  const openMarket = () => {
    dispatch({ type: 'VIEW_OPPORTUNITY_MARKET' });
    onClose();
  };

  const nothingAtAll = badgeCount === 0 && bidNotifications.length === 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content stack" onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <h2 style={{ margin: 0 }}>Inbox</h2>
          <Button onClick={onClose}>Close</Button>
        </div>

        {nothingAtAll && (
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            Nothing needs your attention right now - background shoots keep going on their own.
          </p>
        )}

        {bidNotifications.length > 0 && (
          <div className="stack">
            <h3 style={{ margin: 0 }}>Bid updates</h3>
            {bidNotifications.map((n) => {
              const actionable = isOutbidActionable(n);
              return (
                <div className="card stack" key={n.id}>
                  <p style={{ margin: 0 }}>{bidMessage(n)}</p>
                  {(n.kind === 'lost' || n.kind === 'outbid') && (
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85em' }}>
                      {n.rivalName ?? 'A rival'} bid <Money amount={n.amount} />.
                    </p>
                  )}
                  {actionable && (
                    <div>
                      <Button variant="primary" onClick={openMarket}>
                        Raise your bid
                      </Button>
                    </div>
                  )}
                  {n.kind === 'outbid' && !actionable && (
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85em' }}>
                      The auction has since closed.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {awaitingChoice.map((production) => {
          if (production.photography?.pendingChoice) {
            return (
              <div className="stack" key={production.id}>
                <h3 style={{ margin: 0 }}>{production.title || 'Untitled Film'}</h3>
                <OnSetDecisionCard
                  pendingChoice={production.photography.pendingChoice}
                  talent={production.talent.map((a) => a.person)}
                  talentPool={state.talentPool}
                  script={production.script}
                  totalDays={state.totalDays}
                  onChoose={(choiceId) => dispatch({ type: 'RESOLVE_EVENT_CHOICE', choiceId, productionId: production.id })}
                />
              </div>
            );
          }
          if (production.testScreeningPendingChoice) {
            return (
              <div className="stack" key={production.id}>
                <h3 style={{ margin: 0 }}>{production.title || 'Untitled Film'}</h3>
                <OnSetDecisionCard
                  pendingChoice={production.testScreeningPendingChoice}
                  talent={production.talent.map((a) => a.person)}
                  talentPool={state.talentPool}
                  script={production.script}
                  totalDays={state.totalDays}
                  pausedMessage="Post-production can't wrap until you respond to the test screening."
                  showChoiceCosts
                  onChoose={(choiceId) => dispatch({ type: 'RESOLVE_TEST_SCREENING_CHOICE', choiceId, productionId: production.id })}
                />
              </div>
            );
          }
          return null;
        })}

        {wrapped.map((production) => (
          <div className="card stack" key={production.id}>
            <div className="card-title">{production.title || 'Untitled Film'}</div>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              Principal photography wrapped
              {production.photography ? <> at <Money amount={production.photography.runningCost} /> spent</> : null} - ready
              for post-production.
            </p>
            {state.focusedProjectId ? (
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85em' }}>
                Finish or leave what you're currently working on before picking this back up.
              </p>
            ) : (
              <div>
                <Button variant="primary" onClick={() => dispatch({ type: 'RESUME_PROJECT', projectId: production.id })}>
                  Continue to Post-Production
                </Button>
              </div>
            )}
          </div>
        ))}

        {parked.map((production) => {
          // A parked film has its post-production choices locked in, but its
          // mandatory test screening may not have come back yet - in which case
          // it genuinely can't be scheduled, no matter what the player does, so
          // don't imply it "just needs a release day" (it doesn't; it needs the
          // screening first). See components/wizard/MarketingRelease.tsx, where
          // the Release button stays disabled for exactly this reason.
          const recutInProgress = production.postProductionEditingUntilDay !== null;
          const awaitingScreening = !production.testScreeningResolved;
          return (
            <div className="card stack" key={production.id}>
              <div className="card-title">{production.title || 'Untitled Film'}</div>
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                {recutInProgress
                  ? "A re-cut is underway in the editing bay. You can't lock a release date until it's done and you've seen the next test screening - you'll be notified here the moment it's in."
                  : awaitingScreening
                    ? "Post-production is still wrapping up - its test screening isn't in yet. You can't lock a release date until you've seen it and responded; you'll be notified here the moment it's ready."
                    : 'Post-production is done - this film just needs a release day.'}
              </p>
              {state.focusedProjectId ? (
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85em' }}>
                  Finish or leave what you're currently working on before picking this back up.
                </p>
              ) : (
                <div>
                  <Button variant="primary" onClick={() => dispatch({ type: 'RESUME_PROJECT', projectId: production.id })}>
                    {awaitingScreening ? 'Check on it' : 'Continue to Marketing & Release'}
                  </Button>
                </div>
              )}
            </div>
          );
        })}

        {casting.map(({ production, calls }) => {
          // Phase D (docs/DESIGN_REVIEW_casting_redesign.md section 6) -
          // an InterestedTalent applicant reached out on their own, unprompted,
          // rather than answering an Open Casting call - worth calling out by
          // name here rather than folding into the same generic line.
          const interestedNames = calls
            .flatMap((call) => call.applicants.filter((a) => a.channel === 'InterestedTalent'))
            .map((a) => a.person.identity.name);
          return (
            <div className="card stack" key={production.id}>
              <div className="card-title">{production.title || 'Untitled Film'}</div>
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                New casting applicants waiting on{' '}
                {calls
                  .map((call) => production.script?.cast.find((c) => c.id === call.characterId)?.name ?? 'a role')
                  .join(', ')}
                .
              </p>
              {interestedNames.length > 0 && (
                <p style={{ margin: 0, color: 'var(--primary)', fontWeight: 600 }}>
                  {interestedNames.join(', ')} reached out directly, interested in joining.
                </p>
              )}
              {state.focusedProjectId ? (
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85em' }}>
                  Finish or leave what you're currently working on before picking this back up.
                </p>
              ) : (
                <div>
                  <Button variant="primary" onClick={() => dispatch({ type: 'RESUME_PROJECT', projectId: production.id })}>
                    Continue Casting
                  </Button>
                </div>
              )}
            </div>
          );
        })}

        {productions.length > 0 && (
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85em' }}>
            {productions.length} production{productions.length === 1 ? '' : 's'} in the background.
          </p>
        )}
      </div>
    </div>
  );
}
