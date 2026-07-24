import { useStudio } from '../../state/StudioContext';
import { Button } from './Button';
import { formatMoney } from './Money';
import { ActivityCard } from './ActivityCard';
import { OnSetDecisionCard } from './OnSetDecisionCard';
import { backgroundedPlayerDrafts, deriveInboxItems, isParkedActionable } from '../../engine/project';
import { highestBid } from '../../engine/opportunities';
import { responsesForPolarity } from '../../engine/pressTourMoments';
import { unacknowledgedAwardHighlights } from '../../state/selectors';
import type { ActivityAction } from '../../state/studioActivity';
import type { BidNotification, FilmDraft } from '../../types';

interface InboxProps {
  open: boolean;
  onClose: () => void;
  /**
   * Opens the released-film dossier (components/common/FilmDetailModal.tsx) for
   * a finished box-office run - the Inbox routes the player there rather than
   * reproducing the numbers. Wired from App.tsx, which owns the dossier overlay
   * (the same local-state pattern Dashboard/StatsPage already use to show it).
   */
  onViewFilmDossier?: (filmId: string) => void;
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
export function Inbox({ open, onClose, onViewFilmDossier }: InboxProps) {
  const { state, dispatch } = useStudio();
  if (!open) return null;

  // Inbox is mounted globally, including mid-wizard while something is
  // focused (unlike Dashboard, where RETURN_TO_DASHBOARD guarantees
  // focusedProjectId is null) - deriveInboxItems excludes that focused one
  // internally, so it's never shown here a second time: its own screen
  // (ProductionRun.tsx/MarketingRelease.tsx) is where it belongs, not the
  // Inbox. The exact same derivation Header.tsx's badge count reads
  // (engine/project.ts:inboxBadgeCount), so the two can never drift apart.
  const { awaitingChoice, wrapped, parked, casting, pressTourIncidents, nowPlaying, boxOfficeFinished } = deriveInboxItems(state.projects, state.focusedProjectId);
  // Recently-resolved award ceremonies the player hasn't clicked through yet
  // (state/selectors.ts) - awards settle silently in the background tick, so
  // this is the Inbox's "Awards night" catch-up beat.
  const awardHighlights = unacknowledgedAwardHighlights(state);
  // Every backgrounded draft, regardless of category - the "N productions
  // in the background" reassurance line below.
  const productions = backgroundedPlayerDrafts(state.projects, state.focusedProjectId);

  // Bid "emails" (engine/bidNotifications.ts) - stored newest-first. An
  // 'outbid' is still actionable only while its opportunity is genuinely live
  // and the player still isn't leading it; once the weekly tick resolves it,
  // the opportunity is gone and raising is no longer possible. That split is
  // exactly the "Needs you" (still-actionable) vs "While you were away"
  // (settled, informational) grouping below.
  const bidNotifications = state.bidNotifications ?? [];
  const isOutbidActionable = (n: BidNotification): boolean => {
    if (n.kind !== 'outbid') return false;
    const opp = state.opportunities.find((o) => o.id === n.opportunityId && o.expiresOnDay > state.totalDays);
    return !!opp && highestBid(opp)?.bidderId !== 'player';
  };
  const attentionBids = bidNotifications.filter(isOutbidActionable);
  const updateBids = bidNotifications.filter((n) => !isOutbidActionable(n));

  const openMarket = () => {
    dispatch({ type: 'VIEW_OPPORTUNITY_MARKET' });
    onClose();
  };

  // A backgrounded shoot can only be resumed while nothing else is focused
  // (the same rule the cards always followed) - otherwise the card shows a
  // note in place of the button rather than silently taking over other work.
  const resumeAction = (production: FilmDraft, label: string): ActivityAction =>
    state.focusedProjectId
      ? { label, note: "Finish or leave what you're currently working on before picking this back up." }
      : { label, onClick: () => dispatch({ type: 'RESUME_PROJECT', projectId: production.id }) };

  // Two groups, per the unified-inbox design: "Needs you" is everything
  // waiting on the player (a decision, a shoot to pick back up, a live outbid),
  // "While you were away" is everything that just happened and is only worth
  // knowing about (box office, awards, settled bids). The interactive on-set /
  // test-screening / press-tour cards stay bespoke (they resolve in place);
  // everything else routes to its system-of-record via a shared ActivityCard.
  const needsYouCount =
    awaitingChoice.length + pressTourIncidents.length + wrapped.length + parked.length + casting.length + nowPlaying.length + attentionBids.length;
  const updatesCount = boxOfficeFinished.length + awardHighlights.length + updateBids.length;
  const nothingAtAll = needsYouCount === 0 && updatesCount === 0;

  const groupHeading = (label: string, count: number) => (
    <h3 style={{ margin: '0.25rem 0 0' }}>
      {label} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {count}</span>
    </h3>
  );

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

        {needsYouCount > 0 && (
          <div className="stack">
            {groupHeading('Needs you', needsYouCount)}

            {awaitingChoice.map((production) => {
              if (production.photography?.pendingChoice) {
                return (
                  <div className="stack" key={production.id}>
                    <h4 style={{ margin: 0 }}>{production.title || 'Untitled Film'}</h4>
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
                    <h4 style={{ margin: 0 }}>{production.title || 'Untitled Film'}</h4>
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

            {pressTourIncidents.map((production) => {
              const incident = production.pressTourIncident!;
              const releaseNote = 'This is happening now, during the release campaign - your response is baked in when the film opens.';
              return (
                <div className="card stack" key={production.id}>
                  <span className="dashboard-section-kicker">Press tour · {production.title || 'Untitled Film'}</span>
                  <div className="card-title">{incident.base.headline}</div>
                  <p style={{ margin: 0, color: 'var(--text-muted)' }}>{incident.situation}</p>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85em' }}>{releaseNote}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {responsesForPolarity(incident.polarity).map((response) => (
                      <div key={response.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Button
                          className="btn-sm"
                          variant={response.id === 'apologize' || response.id === 'stay-humble' ? 'primary' : undefined}
                          onClick={() => dispatch({ type: 'RESOLVE_PRESS_TOUR_INCIDENT', choiceId: response.id, productionId: production.id })}
                        >
                          {response.label}
                        </Button>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.82em' }}>{response.description.replaceAll('{name}', incident.base.personName)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {wrapped.map((production) => (
              <ActivityCard
                key={production.id}
                activity={{
                  id: `${production.id}-wrapped`,
                  tone: 'warning',
                  category: 'attention',
                  eyebrow: 'Post-production ready',
                  title: production.title || 'Untitled Film',
                  detail: `Principal photography wrapped${production.photography ? ` at ${formatMoney(production.photography.runningCost)} spent` : ''} — ready for post-production.`,
                }}
                action={resumeAction(production, 'Continue to Post-Production')}
              />
            ))}

            {parked.map((production) => {
              // A parked film has its post-production choices locked in, but its
              // mandatory test screening may not have come back yet - in which
              // case it genuinely can't be scheduled, so the copy distinguishes
              // "just needs a release day" from "still wrapping up" and the
              // button (when shown) reads accordingly.
              const recutInProgress = production.postProductionEditingUntilDay !== null;
              const awaitingScreening = !production.testScreeningResolved;
              const actionable = isParkedActionable(production);
              const detail = recutInProgress
                ? "A re-cut is underway in the editing bay. You can't lock a release date until it's done and you've seen the next test screening - you'll be notified here the moment it's in."
                : awaitingScreening
                  ? "Post-production is still wrapping up - its test screening isn't in yet. You can't lock a release date until you've seen it and responded; you'll be notified here the moment it's ready."
                  : 'Post-production is done - this film just needs a release day.';
              return (
                <ActivityCard
                  key={production.id}
                  activity={{
                    id: `${production.id}-parked`,
                    tone: actionable ? 'warning' : 'neutral',
                    category: 'attention',
                    eyebrow: 'Release scheduling',
                    title: production.title || 'Untitled Film',
                    detail,
                  }}
                  action={resumeAction(production, awaitingScreening ? 'Check on it' : 'Continue to Marketing & Release')}
                />
              );
            })}

            {casting.map(({ production, calls }) => {
              // Phase D (docs/DESIGN_REVIEW_casting_redesign.md section 6) - an
              // InterestedTalent applicant reached out on their own, unprompted,
              // rather than answering an Open Casting call - called out by name.
              const interestedNames = calls
                .flatMap((call) => call.applicants.filter((a) => a.channel === 'InterestedTalent'))
                .map((a) => a.person.identity.name);
              const roles = calls
                .map((call) => production.script?.cast.find((c) => c.id === call.characterId)?.name ?? 'a role')
                .join(', ');
              const detail = `New casting applicants waiting on ${roles}.${interestedNames.length > 0 ? ` ${interestedNames.join(', ')} reached out directly, interested in joining.` : ''}`;
              return (
                <ActivityCard
                  key={production.id}
                  activity={{
                    id: `${production.id}-casting`,
                    tone: 'neutral',
                    category: 'attention',
                    eyebrow: 'Casting',
                    title: production.title || 'Untitled Film',
                    detail,
                  }}
                  action={resumeAction(production, 'Continue Casting')}
                />
              );
            })}

            {nowPlaying.map((film) => (
              <ActivityCard
                key={film.id}
                activity={{
                  id: `${film.id}-now-playing`,
                  tone: 'positive',
                  category: 'attention',
                  eyebrow: 'Now playing',
                  title: `🎬 ${film.title || 'Untitled Film'} has opened`,
                  detail: 'Your film is in theaters — watch how opening night went.',
                }}
                action={{
                  label: 'View Premiere',
                  onClick: () => {
                    dispatch({ type: 'VIEW_PREMIERE', filmId: film.id });
                    onClose();
                  },
                }}
              />
            ))}

            {attentionBids.map((n) => (
              <ActivityCard
                key={n.id}
                activity={{
                  id: n.id,
                  tone: 'urgent',
                  category: 'attention',
                  eyebrow: 'Outbid',
                  title: `“${n.scriptTitle || 'Untitled script'}”`,
                  detail: `${n.rivalName ?? 'A rival'} outbid you at ${formatMoney(n.amount)}. The auction is still open — you can still raise.`,
                }}
                action={{ label: 'Raise your bid', onClick: openMarket }}
              />
            ))}
          </div>
        )}

        {updatesCount > 0 && (
          <div className="stack">
            {groupHeading('While you were away', updatesCount)}

            {boxOfficeFinished.map((film) => {
              // Informational catch-up: the run is over, nothing is blocked.
              // Brief qualitative summary, then route to the film's own dossier
              // (FilmDetailModal) for the full breakdown - the Inbox is a
              // catch-up surface, not a second results screen. Opening the
              // dossier marks it reviewed (ACKNOWLEDGE_BOX_OFFICE_RESULTS), so it
              // stays unread until the player actually looks.
              const outcome = film.results.outcome;
              const detail = `Its theatrical run is over${outcome ? `, finishing as a ${outcome}` : ''}${film.results.totalBoxOffice != null ? ` at ${formatMoney(film.results.totalBoxOffice)}` : ''}. See how it played out.`;
              return (
                <ActivityCard
                  key={`${film.id}-box-office`}
                  activity={{
                    id: `${film.id}-box-office`,
                    tone: 'neutral',
                    category: 'update',
                    eyebrow: 'Box office',
                    title: `🎬 ${film.title || 'Untitled Film'}`,
                    detail,
                  }}
                  action={{
                    label: 'View box office',
                    onClick: () => {
                      dispatch({ type: 'ACKNOWLEDGE_BOX_OFFICE_RESULTS', filmId: film.id });
                      onViewFilmDossier?.(film.id);
                    },
                  }}
                />
              );
            })}

            {awardHighlights.map((highlight) => {
              const detail = `${highlight.wins > 0 ? `${highlight.wins} win${highlight.wins === 1 ? '' : 's'} from ` : ''}${highlight.nominations} nomination${highlight.nominations === 1 ? '' : 's'}${highlight.payout > 0 ? ` — ${formatMoney(highlight.payout)} in prize money` : ''}.`;
              return (
                <ActivityCard
                  key={highlight.id}
                  activity={{
                    id: highlight.id,
                    tone: 'positive',
                    category: 'update',
                    eyebrow: 'Awards night',
                    title: `🏆 ${highlight.showName} · Year ${highlight.year}`,
                    detail,
                  }}
                  action={{
                    label: 'View awards',
                    onClick: () => {
                      dispatch({ type: 'ACKNOWLEDGE_AWARD_CEREMONY', ceremonyId: highlight.id });
                      dispatch({ type: 'VIEW_AWARDS' });
                      onClose();
                    },
                  }}
                />
              );
            })}

            {updateBids.map((n) => {
              const closedOutbid = n.kind === 'outbid';
              const detail =
                n.kind === 'won'
                  ? "You won the rights — it's in your Asset Library, ready to develop."
                  : n.kind === 'lost'
                    ? `${n.rivalName ?? 'A rival'} took it at ${formatMoney(n.amount)}.`
                    : `${n.rivalName ?? 'A rival'} outbid you at ${formatMoney(n.amount)}. The auction has since closed.`;
              return (
                <ActivityCard
                  key={n.id}
                  activity={{
                    id: n.id,
                    tone: n.kind === 'won' ? 'positive' : 'neutral',
                    category: 'update',
                    eyebrow: n.kind === 'won' ? 'Bid won' : closedOutbid ? 'Outbid' : 'Bid lost',
                    title: `“${n.scriptTitle || 'Untitled script'}”`,
                    detail,
                  }}
                />
              );
            })}
          </div>
        )}

        {productions.length > 0 && (
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85em' }}>
            {productions.length} production{productions.length === 1 ? '' : 's'} in the background.
          </p>
        )}
      </div>
    </div>
  );
}
