import { useStudio } from '../../state/StudioContext';
import { Button } from './Button';
import { formatMoney } from './Money';
import { ActivityCard } from './ActivityCard';
import { OnSetDecisionCard } from './OnSetDecisionCard';
import { reshootChoiceConstraints } from '../../engine/reshootAvailability';
import { backgroundedPlayerDrafts, deriveInboxItems, isParkedActionable } from '../../engine/project';
import { unseenApplicants } from '../../engine/castingCalls';
import { derivePostProductionStatus, describePostProductionWait } from '../../engine/postProductionStatus';
import { highestBid } from '../../engine/opportunities';
import { responsesForPolarity } from '../../engine/pressTourMoments';
import { unacknowledgedAwardHighlights } from '../../state/selectors';
import type { ActivityAction } from '../../state/studioActivity';
import type { AuditionRecord, BidNotification, CastingApplicant, FilmDraft, Person } from '../../types';

/** Shown in place of a routing button while the player is mid-wizard on something else - the same rule RESUME_PROJECT itself enforces (state/studioReducer.ts). */
const BUSY_NOTE = "Finish or leave what you're currently working on before picking this back up.";

/** How many applicants a card lists by name before summarising the rest - enough to recognise a beat, short enough to stay a notification rather than a second casting screen. */
const MAX_LISTED_APPLICANTS = 4;

/** "Mercedes · Supporting role" - what the card is about, since a per-Character card's title is the role, not the film (the film is in the eyebrow). */
function characterHeading(characterName: string | undefined, role: 'Lead Actor' | 'Supporting Actor'): string {
  const roleLabel = role === 'Lead Actor' ? 'Lead role' : 'Supporting role';
  return characterName ? `${characterName} · ${roleLabel}` : roleLabel;
}

/** One readable line per new candidate, saying which door they came through - an InterestedTalent arrival sought the studio out (design review section 6), an Open Casting applicant answered the call. */
function applicantLines(applicants: CastingApplicant[]): string[] {
  const lines = applicants
    .slice(0, MAX_LISTED_APPLICANTS)
    .map((applicant) =>
      applicant.channel === 'InterestedTalent'
        ? `${applicant.person.identity.name} — approached you directly, interested in the part`
        : `${applicant.person.identity.name} — answered your open casting call`,
    );
  const remaining = applicants.length - lines.length;
  return remaining > 0 ? [...lines, `…and ${remaining} more`] : lines;
}

/** Ready screen tests regrouped per Character, so each role's read gets its own card (and its own route into that role's drawer) instead of one card lumping several roles together. */
function groupAuditionsByCharacter(
  production: FilmDraft,
  auditions: AuditionRecord[],
  actorPool: Person[] = [],
): Array<{ production: FilmDraft; characterId: string; characterName: string | undefined; role: 'Lead Actor' | 'Supporting Actor'; actorNames: string[] }> {
  const byCharacter = new Map<string, AuditionRecord[]>();
  for (const audition of auditions) {
    byCharacter.set(audition.characterId, [...(byCharacter.get(audition.characterId) ?? []), audition]);
  }
  return [...byCharacter.entries()].map(([characterId, records]) => ({
    production,
    characterId,
    characterName: production.script?.cast.find((c) => c.id === characterId)?.name,
    role: records[0].role,
    actorNames: records.map(
      (record) =>
        production.talent.find((t) => t.person.id === record.personId)?.person.identity.name
        ?? actorPool.find((p) => p.id === record.personId)?.identity.name
        ?? 'A candidate',
    ),
  }));
}

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
 *    responses and InterestedTalent arrivals. One card per Character, not
 *    per project: the decision is per-Character (see
 *    components/wizard/CastingDrawer.tsx), so the card names the role, lists
 *    who's new, and routes straight into that Character's drawer
 *    (REVIEW_CASTING_CALL) rather than dropping the player on the project's
 *    Overview to hunt for it.
 *  - 'directorPitches' (docs/DESIGN_director_pitch_and_bakeoff.md Phase B2) -
 *    an open bake-off whose pitches have landed. They arrive on their own
 *    due-days during the background tick, so this is the only place the
 *    player finds out a round has come in; it routes into the Director
 *    drawer's bake-off panel (REVIEW_DIRECTOR_PITCHES).
 *  - 'auditionsReady' - completed screen tests, likewise one card per
 *    Character and routing into that Character's drawer.
 * Those last three are read-state driven: each clears when the player opens
 * the drawer it points at, not when the underlying casting decision is finally
 * made, so a card pings once per genuinely new arrival instead of repeating an
 * identical message forever. That's also why they're the only categories shown
 * for the CURRENTLY-FOCUSED project too (see engine/project.ts:deriveInboxItems)
 * - they can't nag, and the drawer they point at isn't on screen just because
 * the project is. Every other category stays hidden for the focused project,
 * since each of those routes to the screen it's already showing.
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
  // focusedProjectId is null) - deriveInboxItems drops that focused project
  // from every category whose card would only route to the screen already
  // showing it (ProductionRun.tsx/MarketingRelease.tsx is where those belong,
  // not the Inbox), and keeps it for the three read-state Cast & Crew beats,
  // which point at drawers that aren't on screen. The exact same derivation
  // Header.tsx's badge count reads (engine/project.ts:inboxBadgeCount), so the
  // two can never drift apart.
  const { awaitingChoice, wrapped, parked, casting, directorPitches, auditionsReady, pressTourIncidents, nowPlaying, boxOfficeFinished } = deriveInboxItems(state.projects, state.focusedProjectId, state.totalDays);
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

  // Every routing action also closes the Inbox: it's a full-screen overlay, so
  // leaving it up would leave the player staring at the very list they just
  // clicked out of, with the screen they asked for hidden behind it.
  const routed = (run: () => void) => () => {
    run();
    onClose();
  };
  // A backgrounded shoot can only be resumed while nothing else is focused
  // (the same rule the cards always followed) - otherwise the card shows a
  // note in place of the button rather than silently taking over other work.
  const resumeAction = (production: FilmDraft, label: string): ActivityAction =>
    state.focusedProjectId
      ? { label, note: BUSY_NOTE }
      : { label, onClick: routed(() => dispatch({ type: 'RESUME_PROJECT', projectId: production.id })) };

  /**
   * A card that routes into one specific Cast & Crew drawer rather than merely
   * into the project (REVIEW_CASTING_CALL / REVIEW_DIRECTOR_PITCHES) - "take me
   * to the thing this message is about." Blocked only by a DIFFERENT project
   * being focused (the reducer enforces the same rule): these beats now surface
   * for the focused project too, and jumping to a drawer within the project
   * you're already in is exactly what the card is for.
   */
  const reviewAction = (productionId: string, label: string, run: () => void): ActivityAction =>
    state.focusedProjectId && state.focusedProjectId !== productionId
      ? { label, note: BUSY_NOTE }
      : { label, onClick: routed(run) };

  // Two groups, per the unified-inbox design: "Needs you" is everything
  // waiting on the player (a decision, a shoot to pick back up, a live outbid),
  // "While you were away" is everything that just happened and is only worth
  // knowing about (box office, awards, settled bids). The interactive on-set /
  // test-screening / press-tour cards stay bespoke (they resolve in place);
  // everything else routes to its system-of-record via a shared ActivityCard.
  // One card per casting CALL and per audition CHARACTER, not per production -
  // "new applicants for Mercedes" and "Bruno's screen test is in" are separate
  // things to act on, and each routes to its own drawer.
  const castingCards = casting.flatMap(({ production, calls }) => calls.map((call) => ({ production, call })));
  const auditionCards = auditionsReady.flatMap(({ production, auditions }) => groupAuditionsByCharacter(production, auditions, state.talentPool.Actor));
  const needsYouCount =
    awaitingChoice.length +
    pressTourIncidents.length +
    wrapped.length +
    parked.length +
    castingCards.length +
    directorPitches.length +
    auditionCards.length +
    nowPlaying.length +
    attentionBids.length;
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
                      choiceConstraints={reshootChoiceConstraints(production, state.talentPool, state.totalDays)}
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

            {wrapped.map((production) => {
              // Photography has wrapped and the edit is already underway - frame
              // it as the live, timed phase it is (with its screening countdown),
              // not a static "ready for post-production" to-do. Setting the
              // edit/music/final-cut approach is optional polish you can do any
              // time before release, so this reads as a status, not a demand.
              const pp = derivePostProductionStatus(production, state.totalDays);
              return (
                <ActivityCard
                  key={production.id}
                  activity={{
                    id: `${production.id}-wrapped`,
                    tone: 'neutral',
                    category: 'status',
                    eyebrow: 'In post-production',
                    title: production.title || 'Untitled Film',
                    detail: `${describePostProductionWait(pp)}. Photography wrapped${production.photography ? ` at ${formatMoney(production.photography.runningCost)} spent` : ''} — set this film's edit, music and final-cut approach whenever you like.`,
                  }}
                  action={resumeAction(production, 'Open the edit bay')}
                />
              );
            })}

            {parked.map((production) => {
              // A parked film has its post-production choices locked in, but its
              // mandatory test screening may not have come back yet - in which
              // case it genuinely can't be scheduled, so the copy distinguishes
              // "just needs a release day" from "still wrapping up" and the
              // button (when shown) reads accordingly.
              const recutInProgress = production.postProductionEditingUntilDay !== null;
              const awaitingScreening = !production.testScreeningResolved;
              const actionable = isParkedActionable(production);
              const pp = derivePostProductionStatus(production, state.totalDays);
              const detail = recutInProgress
                ? `${describePostProductionWait(pp)}. You can't lock a release date until the re-cut is done and you've seen the next screening — you'll be notified here the moment it's in.`
                : awaitingScreening
                  ? `${describePostProductionWait(pp)}. You can't lock a release date until the test screening is in and you've responded — you'll be notified here the moment it's ready.`
                  : 'Post-production is done — this film just needs a release day.';
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

            {castingCards.map(({ production, call }) => {
              // One card per Character with unseen applicants (Casting Redesign,
              // Phase C/D). Named by the role it's about, with each new applicant
              // on its own line - "new applicants on three roles" in one run-on
              // sentence was unreadable, and unactionable besides: the card now
              // routes straight into THIS Character's casting drawer
              // (REVIEW_CASTING_CALL) rather than dropping the player on the
              // project's Overview to find it themselves.
              const character = production.script?.cast.find((c) => c.id === call.characterId);
              const fresh = unseenApplicants(call);
              return (
                <ActivityCard
                  key={`${production.id}-casting-${call.id}`}
                  activity={{
                    id: `${production.id}-casting-${call.id}`,
                    tone: 'neutral',
                    category: 'attention',
                    eyebrow: `Casting · ${production.title || 'Untitled Film'}`,
                    title: characterHeading(character?.name, call.role),
                    detail:
                      fresh.length === 1
                        ? 'One new candidate is waiting on this role.'
                        : `${fresh.length} new candidates are waiting on this role.`,
                    bullets: applicantLines(fresh),
                  }}
                  action={reviewAction(production.id, 'Review candidates', () =>
                    dispatch({ type: 'REVIEW_CASTING_CALL', projectId: production.id, characterId: call.characterId }),
                  )}
                />
              );
            })}

            {directorPitches.map(({ production, pitches }) => {
              // Director bake-off (docs/DESIGN_director_pitch_and_bakeoff.md
              // Phase B2). Pitches land on their own due-days during the
              // background tick, so without this card a round could come in
              // and sit there unread - the player had no way to find out short
              // of reopening the Director drawer on the off-chance.
              const stillComing = production.directorPitches?.pending.length ?? 0;
              const names = pitches
                .map((pitch) => state.talentPool.Director.find((d) => d.id === pitch.directorId)?.identity.name)
                .filter((name): name is string => name !== undefined);
              return (
                <ActivityCard
                  key={`${production.id}-director-pitches`}
                  activity={{
                    id: `${production.id}-director-pitches`,
                    tone: 'positive',
                    category: 'attention',
                    eyebrow: `Director bake-off · ${production.title || 'Untitled Film'}`,
                    title: pitches.length === 1 ? 'A director pitch is in' : `${pitches.length} director pitches are in`,
                    detail: stillComing > 0
                      ? `Read their take on the film and pick one — or wait, ${stillComing} more ${stillComing === 1 ? 'is' : 'are'} still being prepared.`
                      : 'Read their take on the film and pick one, or pass on the round.',
                    bullets: names,
                  }}
                  action={reviewAction(production.id, 'Read the pitches', () =>
                    dispatch({ type: 'REVIEW_DIRECTOR_PITCHES', projectId: production.id }),
                  )}
                />
              );
            })}

            {auditionCards.map(({ production, characterId, characterName, role, actorNames }) => {
              // "Your screen test came back." Named by character, with the actors
              // listed - a concrete, diegetic beat rather than a silent card
              // update the player would only find by reopening the drawer
              // (casting QOL). Routes into that Character's own drawer, which is
              // also what marks the read acknowledged.
              return (
                <ActivityCard
                  key={`${production.id}-auditions-${characterId}`}
                  activity={{
                    id: `${production.id}-auditions-${characterId}`,
                    tone: 'positive',
                    category: 'attention',
                    eyebrow: `Screen test · ${production.title || 'Untitled Film'}`,
                    title: characterHeading(characterName, role),
                    detail:
                      actorNames.length === 1
                        ? "The screen test is in — you've now got a confident read on the part."
                        : `${actorNames.length} screen tests are in — you've now got a confident read on each.`,
                    bullets: actorNames,
                  }}
                  action={reviewAction(production.id, 'See the read', () =>
                    dispatch({ type: 'REVIEW_CASTING_CALL', projectId: production.id, characterId }),
                  )}
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
                onDismiss={() => dispatch({ type: 'DISMISS_BID_NOTIFICATION', id: n.id })}
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
                  onDismiss={() => dispatch({ type: 'DISMISS_BID_NOTIFICATION', id: n.id })}
                />
              );
            })}
          </div>
        )}

        {bidNotifications.length > 1 && (
          <div className="row-between">
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85em' }}>
              {bidNotifications.length} bid message{bidNotifications.length === 1 ? '' : 's'}.
            </span>
            <Button className="btn-sm" variant="secondary" onClick={() => dispatch({ type: 'DISMISS_ALL_BID_NOTIFICATIONS' })}>
              Clear all bid messages
            </Button>
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
