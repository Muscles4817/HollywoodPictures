import { useEffect, useRef, useState } from 'react';
import { StudioProvider, useStudio } from './state/StudioContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ActionFeedbackProvider } from './components/common/ActionFeedback';
import { Chrome } from './components/shell/Chrome';
import { Spine } from './components/shell/Spine';
import { DestinationRail } from './components/shell/DestinationRail';
import { Slate } from './components/shell/Slate';
import { CommandPalette } from './components/shell/CommandPalette';
import type { DevTool } from './components/shell/devTools';
import { GameGuide } from './components/common/GameGuide';
import { Inbox } from './components/common/Inbox';
import { Dashboard } from './components/Dashboard';
import { RivalStudioPage } from './components/RivalStudioPage';
import { StatsPage } from './components/StatsPage';
import { AwardsPage } from './components/AwardsPage';
import { TalentDatabase } from './components/TalentDatabase';
import { ReleaseCalendar } from './components/ReleaseCalendar';
import { RecommendationInspector } from './components/dev/RecommendationInspector';
import { RequirementProfileInspector } from './components/dev/RequirementProfileInspector';
import { OutcomeInspector } from './components/dev/OutcomeInspector';
import { RivalFinancesInspector } from './components/dev/RivalFinancesInspector';
import { ProjectWorkspace } from './components/projectWorkspace/ProjectWorkspace';
import { PreProductionRun } from './components/wizard/PreProductionRun';
import { ProductionRun } from './components/wizard/ProductionRun';
import { PostProduction } from './components/wizard/PostProduction';
import { MarketingRelease } from './components/wizard/MarketingRelease';
import { ReleaseResults } from './components/wizard/ReleaseResults';
import { OpportunityMarket } from './components/OpportunityMarket';
import { AssetLibrary } from './components/AssetLibrary';
import { ProjectsPage } from './components/ProjectsPage';
import { MilestonesPage } from './components/MilestonesPage';
import { IpLibrary } from './components/IpLibrary';
// Aliased: `TalentDatabase` is already the name of the screen component above.
import type { ProjectWorkspaceSection, Screen, TalentDatabase as TalentRoster } from './types';
import { DAY_TICK_MS, type TickSpeedMultiplier } from './constants';
import { timeCriticalUnreadBidCount } from './engine/bidNotifications';
import { asFilm, asPlayerDraft, findProject } from './engine/project';
import { derivePostProductionStatus, isPostProductionAdvancing } from './engine/postProductionStatus';
import { FilmDetailModal } from './components/common/FilmDetailModal';
import { DifficultyPicker } from './components/common/DifficultyPicker';
import { MainMenu } from './components/MainMenu';
import { Button } from './components/common/Button';
import { hasSavedGame } from './state/persistence';

// Every wizard screen where the player is setting choices with no clock
// pressure of its own - paused here so a slow decision never costs real
// calendar time. 'production' is excluded too, but for a different reason:
// it already runs its own faster, dedicated tick the moment photography
// begins (ProductionRun.tsx) - this background tick would otherwise double
// up with it, or fire uselessly while the player is just reviewing the
// pre-shoot risk profile.
const PLANNING_SCREENS = new Set<Screen>(['workspace', 'pre-production', 'production', 'post-production', 'marketing']);

/**
 * Whether the background ADVANCE_DAY tick should be running right now - a
 * pure function (not inlined in Screens() below) specifically so this can
 * be unit-tested directly, without mounting the whole app and juggling fake
 * timers. 'production' is a genuine exception to PLANNING_SCREENS' own
 * exclusion when the player is merely *viewing* a backgrounded production
 * (viewingProductionId set, reachable only from Dashboard's Shooting card -
 * see ProductionRun.tsx) rather than running their own live draft's shoot:
 * a backgrounded production has no dedicated tick of its own while it's
 * being looked at (ProductionRun.tsx's local interval deliberately refuses
 * to start when viewingProductionId is set - it only ever advances the live
 * draft), so it only ever progresses via this background tick. Without this
 * carve-out, simply opening the page to check on a background shoot froze
 * its day count for as long as the player stayed there - a "pure read-only
 * detour" that should cost no calendar time, missed here because
 * 'production' is normally excluded for the opposite reason (own-draft
 * filming already ticks fast enough on its own). Viewing your own live draft's shoot
 * (viewingProductionId === null on 'production') is unaffected -
 * PLANNING_SCREENS still pauses this background tick there, exactly as
 * before.
 */
export function isViewingBackgroundProduction(screen: Screen, viewingProductionId: string | null): boolean {
  return screen === 'production' && viewingProductionId !== null;
}

export function computeTicking(
  screen: Screen,
  viewingProductionId: string | null,
  paused: boolean,
  inboxOpen: boolean,
  postProductionEditingActive: boolean = false,
): boolean {
  const backgroundProductionViewed = isViewingBackgroundProduction(screen, viewingProductionId);
  // The Post-Production screen is normally a planning screen (paused), but while
  // an editing window is actively running (the initial cut or a recut heading
  // to its next test screening) the calendar advances there too - so the edit
  // visibly progresses on its own screen, the same way Principal Photography
  // does, instead of the player being told to leave and wait on the Dashboard.
  // Reuses the shared tick (honouring the pause button, the speed control, and
  // the inbox pause); it stops the instant the screening surfaces, since the
  // status is no longer "advancing" then.
  const postProductionAdvancing = screen === 'post-production' && postProductionEditingActive;
  return (!PLANNING_SCREENS.has(screen) || backgroundProductionViewed || postProductionAdvancing) && !paused && !inboxOpen;
}

/**
 * The resume-guard predicate (bid-inbox feature): resuming the real-time clock
 * should ask the player to confirm first only when they are un-pausing (the
 * clock is currently paused) while a genuinely time-critical bid update is still
 * unread - an active outbid they can still respond to
 * (engine/bidNotifications.ts:timeCriticalUnreadBidCount). Winning/losing an
 * auction is informational and never guards resume. Pausing, or resuming with
 * nothing time-critical outstanding, passes straight through. Pure so it can be
 * unit-tested without mounting the app, same as computeTicking above.
 */
export function shouldConfirmResume(paused: boolean, timeCriticalUnread: number): boolean {
  return paused && timeCriticalUnread > 0;
}

// The full "which page is the player on" reading - every field the browser
// history wiring below (and state/gameState.ts:RESTORE_NAVIGATION) treats as
// one navigable "page." Mirrors exactly the five GameState fields TOGGLE/
// VIEW_*/OPEN_PROJECT_WORKSPACE_SECTION actions themselves set, since
// restoring a workspace tab or a detour view on Back/Forward needs the same
// fields a normal in-game navigation does.
interface NavigationSnapshot {
  screen: Screen;
  focusedProjectId: string | null;
  projectWorkspaceSection: ProjectWorkspaceSection;
  viewingRivalStudioName: string | null;
  viewingProductionId: string | null;
}

function navigationSnapshotOf(state: NavigationSnapshot): NavigationSnapshot {
  return {
    screen: state.screen,
    focusedProjectId: state.focusedProjectId,
    projectWorkspaceSection: state.projectWorkspaceSection,
    viewingRivalStudioName: state.viewingRivalStudioName,
    viewingProductionId: state.viewingProductionId,
  };
}

function AppShell() {
  const { state, dispatch } = useStudio();
  // A manual pause on the background day-tick (Header's pause button) -
  // deliberately not persisted anywhere. It stays engaged until the player
  // explicitly resumes (the header button, spacebar, or the resume-confirm
  // dialog); navigation never forces it off. That's safe because the pause
  // control and its "Paused" indicator live in the global header, visible on
  // every screen, so a pause can't silently strand the clock on a screen the
  // player has moved away from - the old fear that justified resetting it on
  // every screen change, back when the control was screen-scoped.
  const [paused, setPaused] = useState(false);
  // Bumped every real tick so the tick-progress bar (Header) can restart
  // its CSS animation in sync with the actual interval, instead of running
  // its own separate, potentially-drifting timer.
  const [tickNonce, setTickNonce] = useState(0);
  // Whether the Inbox overlay is open - folded into `ticking` below so
  // resolving a background shoot's paused decision doesn't cost real time
  // either, the same reasoning as the manual pause button.
  const [inboxOpen, setInboxOpen] = useState(false);
  // The released-film dossier the Inbox routed to (a finished box-office run's
  // "View box office"). App owns this overlay because the Inbox is mounted here,
  // above the screen switch; it's the same FilmDetailModal + local-state pattern
  // Dashboard/StatsPage already use, just reachable from the global Inbox too.
  const [dossierFilmId, setDossierFilmId] = useState<string | null>(null);
  // Shown when the player tries to resume the clock while bid "emails" are
  // still unread (engine/bidNotifications.ts) - the resume-guard the player
  // asked for. Not game state; a pure UI gate on un-pausing.
  const [resumeConfirmOpen, setResumeConfirmOpen] = useState(false);
  // A fast-forward multiplier for the background tick, same session-only
  // lifetime as `paused` - it's a "how fast am I watching this right now"
  // preference, not game state, so it never persists to a save.
  // Selecting it doesn't reset on screen change like `paused` does: the
  // header is always showing it, so there's nothing to silently leave
  // engaged on "another screen" the way there was when this control only
  // existed on the Dashboard.
  const [speedMultiplier, setSpeedMultiplier] = useState<TickSpeedMultiplier>(1);
  // A developer-only detour, not part of the game's own screen/navigation
  // system on purpose (see components/dev/RecommendationInspector.tsx,
  // components/dev/OutcomeInspector.tsx and
  // components/dev/RivalFinancesInspector.tsx) - never mutates GameState
  // (RivalFinancesInspector reads it read-only, to inspect a real save;
  // Recommendation/Outcome Inspector don't touch it at all), never
  // persisted, reachable from any screen via the header.
  const [devTool, setDevTool] = useState<DevTool>('none');
  // Shell-owned overlays. The palette is the chassis's answer to a roster no
  // menu can reach; the guide moved off the Dashboard's retired button row and
  // has to live somewhere global now that the rail can open it from anywhere.
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  // On a genuine first launch (no save existed when the app mounted) offer the
  // same starting-stature choice a Reset gives, so a new player begins how they
  // want instead of silently landing on the legacy default studio. Read once,
  // lazily, so it captures whether a save existed *before* StudioContext's
  // auto-save effect writes the freshly-generated default back (which happens
  // right after this first render commits). Session-only UI state - never
  // persisted, and it stays dismissed for the rest of the session once the
  // player picks a tier or skips.
  // Two steps on a fresh launch: the main menu (which roster?) then the tier
  // picker (which studio?). `pendingDatabase` carries the first answer into the
  // second, since RESET_SAVE needs both at once.
  const [showMainMenu, setShowMainMenu] = useState(() => !hasSavedGame());
  const [pendingDatabase, setPendingDatabase] = useState<TalentRoster | null>(null);
  const showStartPicker = pendingDatabase !== null;

  // How many unread bid "emails" are still time-critical - an active outbid the
  // player can still respond to before the weekly close. This (not the raw
  // unread count) drives the auto-pause and resume-guard: winning or losing an
  // auction is informational and must never stop the simulation, only a live
  // outbid should (engine/bidNotifications.ts).
  const timeCriticalUnread = timeCriticalUnreadBidCount(state.bidNotifications ?? [], state.opportunities, state.totalDays);

  // Resuming the clock (pause -> running) while a live outbid is unread opens
  // the confirm dialog instead; every other toggle passes straight through.
  // Held in a ref so the global spacebar listener below can call the latest
  // version without re-subscribing on every render.
  const requestTogglePauseRef = useRef<() => void>(() => {});
  requestTogglePauseRef.current = () => {
    if (shouldConfirmResume(paused, timeCriticalUnread)) setResumeConfirmOpen(true);
    else setPaused((p) => !p);
  };

  // Opening the Inbox marks bid mail read (clearing the badge and the
  // resume-guard) and pauses the tick via inboxOpen, same as any other
  // Inbox open.
  function openInbox() {
    setInboxOpen(true);
    dispatch({ type: 'MARK_BID_NOTIFICATIONS_READ' });
  }

  // A new *active outbid* auto-pauses the clock so it can't tick past the moment
  // the player might want to respond (raise a bid before the weekly close).
  // Fires only on an increase in the time-critical count - reading the Inbox
  // (which marks bid mail read, dropping it to 0) never re-pauses, and a win/
  // loss or an auction that has since closed doesn't pause at all.
  const prevTimeCriticalRef = useRef(timeCriticalUnread);
  useEffect(() => {
    if (timeCriticalUnread > prevTimeCriticalRef.current) setPaused(true);
    prevTimeCriticalRef.current = timeCriticalUnread;
  }, [timeCriticalUnread]);

  // Spacebar toggles the same manual pause the header's own Pause/Resume
  // button does - a common enough game convention that it's worth wiring up
  // globally rather than only from that one button. Skipped while focus is
  // on an interactive element (a text field, a range slider, a button, ...)
  // so it doesn't hijack space's own native behavior there (typing a space,
  // dragging a slider, activating a focused button) - a focused Pause button
  // in particular would otherwise double-toggle: once from the browser's own
  // "space activates the focused button" behavior, once from this handler.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space') return;
      const active = document.activeElement;
      const isInteractive =
        active instanceof HTMLElement &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.tagName === 'SELECT' ||
          active.tagName === 'BUTTON' ||
          active.isContentEditable);
      if (isInteractive) return;
      e.preventDefault(); // stop the page from scrolling on space
      requestTogglePauseRef.current();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Ctrl-K / Cmd-K opens the command palette from anywhere, including from
  // inside a text field - unlike spacebar above, which must yield to typing.
  // The browser's own Ctrl-K (focus the address bar) is worth overriding here:
  // this is an app, and the shortcut is the near-universal convention for
  // exactly this control.
  useEffect(() => {
    function handlePaletteKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== 'k' || !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setPaletteOpen((o) => !o);
    }
    window.addEventListener('keydown', handlePaletteKey);
    return () => window.removeEventListener('keydown', handlePaletteKey);
  }, []);

  // Every screen switch (forward or back) starts scrolled to the top - a
  // long wizard screen doesn't otherwise reset scroll position on
  // navigation, which left the player dropped mid-page on whatever the
  // previous screen's scroll happened to be. Only fires on a genuine
  // screen change, not on every re-render within one screen (e.g. a
  // photography day ticking doesn't change state.screen).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [state.screen]);

  // Makes the browser's own Back/Forward buttons move through the game's
  // in-game navigation history instead of leaving the app (or doing nothing,
  // with no history entries of our own). Every distinct screen/focused-
  // project/workspace-tab/detour combination pushes its own history entry,
  // carrying the full NavigationSnapshot as history.state rather than just a
  // screen name; RESTORE_NAVIGATION (state/studioReducer.ts) is what
  // actually applies it once popped. Guarded by lastPushedSnapshotRef so
  // this doesn't push a *second* entry for the same navigation it's already
  // pushed one for, and - critically - doesn't push at all when the state
  // change it's reacting to was itself a pop (see the popstate handler
  // below, which updates the ref before dispatching).
  const lastPushedSnapshotRef = useRef<string | null>(null);
  const isFirstNavigationRef = useRef(true);
  useEffect(() => {
    const snapshot = navigationSnapshotOf(state);
    const key = JSON.stringify(snapshot);
    if (key === lastPushedSnapshotRef.current) return;
    lastPushedSnapshotRef.current = key;
    // The very first entry (the page's own initial load) has no state of
    // ours on it yet - replace it in place rather than pushing on top, so
    // Back from the second "page" lands on a real snapshot (the starting
    // Dashboard) instead of an empty one.
    if (isFirstNavigationRef.current) {
      isFirstNavigationRef.current = false;
      window.history.replaceState(snapshot, '');
    } else {
      window.history.pushState(snapshot, '');
    }
  }, [state.screen, state.focusedProjectId, state.projectWorkspaceSection, state.viewingRivalStudioName, state.viewingProductionId]);

  useEffect(() => {
    function handlePopState(e: PopStateEvent) {
      const snapshot = e.state as NavigationSnapshot | null;
      if (!snapshot) return; // predates our own history entries - nothing to restore
      lastPushedSnapshotRef.current = JSON.stringify(snapshot);
      dispatch({ type: 'RESTORE_NAVIGATION', ...snapshot });
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [dispatch]);

  // While the player sits on the Post-Production screen of a film whose edit is
  // still running, let the shared clock tick so the progress bar fills and the
  // test screening surfaces in place (see computeTicking). Only the focused
  // draft's own post-production drives this; a locked cut or a pending decision
  // reads as not-advancing and the screen falls back to paused.
  const focusedForTick = state.screen === 'post-production' ? asPlayerDraft(findProject(state.projects, state.focusedProjectId)) : null;
  const postProductionEditingActive = focusedForTick
    ? isPostProductionAdvancing(derivePostProductionStatus(focusedForTick, state.totalDays))
    : false;
  const ticking = computeTicking(state.screen, state.viewingProductionId, paused, inboxOpen, postProductionEditingActive);
  // The film whose dossier the Inbox routed to, if any (resolved defensively -
  // a stale id just renders nothing, same tolerance as RESTORE_NAVIGATION).
  const dossierFilm = dossierFilmId ? asFilm(findProject(state.projects, dossierFilmId)) : null;

  // The selected speed applies on any screen where the background tick is
  // actually running - the control lives in the header now, always visible,
  // so there's no "screen actually showing the indicator" to restrict it to
  // any more (that restriction existed only because the indicator itself
  // used to be screen-scoped, see docs/DESIGN.md 5.22/5.24 history - the
  // header consolidation superseded it).
  const effectiveTickMs = DAY_TICK_MS / speedMultiplier;

  // Time keeps passing on its own outside the wizard - the Dashboard and
  // the post-release results screen both just sit there otherwise, with no
  // player action available to advance the calendar (and therefore settle
  // an older film's box office) until they start something new. Paused on
  // every planning screen above so a slow decision never costs a day, and
  // pausable by hand from the Dashboard.
  useEffect(() => {
    if (!ticking) return;
    const timer = setInterval(() => {
      dispatch({ type: 'ADVANCE_DAY' });
      setTickNonce((n) => n + 1);
    }, effectiveTickMs);
    return () => clearInterval(timer);
  }, [ticking, effectiveTickMs, dispatch]);

  function renderScreen() {
    switch (state.screen) {
      case 'dashboard':
        return <Dashboard />;
      case 'workspace':
        return <ProjectWorkspace />;
      case 'pre-production':
        return <PreProductionRun />;
      case 'production':
        return <ProductionRun />;
      case 'post-production':
        return <PostProduction />;
      case 'marketing':
        return <MarketingRelease />;
      case 'results':
        return <ReleaseResults />;
      case 'rival-studio':
        return <RivalStudioPage />;
      case 'stats':
        return <StatsPage />;
      case 'release-calendar':
        return <ReleaseCalendar />;
      case 'opportunity-market':
        return <OpportunityMarket />;
      case 'asset-library':
        return <AssetLibrary />;
      case 'projects':
        return <ProjectsPage />;
      case 'awards':
        return <AwardsPage />;
      case 'talent-database':
        return <TalentDatabase />;
      case 'ip-library':
        return <IpLibrary />;
      case 'milestones':
        return <MilestonesPage />;
      default:
        return <Dashboard />;
    }
  }

  // The menu stands in front of the game rather than floating over it: on a
  // fresh launch there is a studio the player has not chosen yet, and showing
  // it behind a modal was always a small lie about what had happened.
  if (showMainMenu) {
    return (
      <MainMenu
        hasSave={hasSavedGame()}
        onContinue={() => setShowMainMenu(false)}
        onNewGame={(database) => {
          setPendingDatabase(database);
          setShowMainMenu(false);
        }}
      />
    );
  }

  return (
    <>
      <Chrome>
        <Spine
          paused={paused}
          onTogglePause={() => requestTogglePauseRef.current()}
          tickNonce={tickNonce}
          speedMultiplier={speedMultiplier}
          onSetSpeedMultiplier={setSpeedMultiplier}
          inboxOpen={inboxOpen}
          onOpenInbox={() => (inboxOpen ? setInboxOpen(false) : openInbox())}
          onOpenPalette={() => setPaletteOpen(true)}
          timeCriticalUnread={timeCriticalUnread}
          onResumeAnyway={() => setPaused(false)}
        />
        <Slate />
      </Chrome>
      <Inbox
        open={inboxOpen}
        onClose={() => setInboxOpen(false)}
        onViewFilmDossier={(filmId) => {
          setInboxOpen(false);
          setDossierFilmId(filmId);
        }}
      />
      {dossierFilm && <FilmDetailModal film={dossierFilm} onClose={() => setDossierFilmId(null)} />}
      {showStartPicker && (
        <DifficultyPicker
          firstRun
          studioName={state.studio.name}
          onCancel={() => setPendingDatabase(null)}
          onConfirm={({ startingCash, brand, prestige }) => {
            dispatch({ type: 'RESET_SAVE', startingCash, brand, prestige, talentDatabase: pendingDatabase ?? undefined });
            setPendingDatabase(null);
          }}
        />
      )}
      {resumeConfirmOpen && (
        <div className="modal-overlay" onClick={() => setResumeConfirmOpen(false)}>
          <div className="modal-content stack" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h2 style={{ margin: 0 }}>Still outbid</h2>
            <p style={{ margin: 0 }}>
              A rival is outbidding you on {timeCriticalUnread} open auction{timeCriticalUnread === 1 ? '' : 's'} you can
              still win. Resume time anyway? {timeCriticalUnread === 1 ? 'It' : 'They'} could close before you get another
              chance to raise.
            </p>
            <div className="row" style={{ gap: '0.5rem' }}>
              <Button
                variant="primary"
                onClick={() => {
                  setResumeConfirmOpen(false);
                  openInbox();
                }}
              >
                Open Inbox
              </Button>
              <Button
                onClick={() => {
                  setResumeConfirmOpen(false);
                  setPaused(false);
                }}
              >
                Resume anyway
              </Button>
            </div>
          </div>
        </div>
      )}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      {guideOpen && <GameGuide onBack={() => setGuideOpen(false)} />}

      {/* The chassis: destinations on one edge, the screen beside them. The
          rail is persistent and never modal, which is the thing the old
          Dashboard-only button row could not be. */}
      <div className="shell">
        <DestinationRail devTool={devTool} onSetDevTool={setDevTool} onOpenGuide={() => setGuideOpen(true)} />
        <main className="shell-main">
          {devTool === 'recommendation' && <RecommendationInspector />}
          {devTool === 'outcome' && <OutcomeInspector />}
          {devTool === 'rival-finances' && <RivalFinancesInspector />}
          {devTool === 'requirement-profile' && <RequirementProfileInspector />}
          {devTool === 'none' && renderScreen()}
        </main>
      </div>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <StudioProvider>
        {/* Inside StudioProvider: an action receipt quotes the resulting cash
            balance, which it reads from studio state (see ActionFeedback.tsx). */}
        <ActionFeedbackProvider>
          <AppShell />
        </ActionFeedbackProvider>
      </StudioProvider>
    </ErrorBoundary>
  );
}

export default App;
