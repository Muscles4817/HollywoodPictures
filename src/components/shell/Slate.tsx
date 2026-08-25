import { useStudio } from '../../state/StudioContext';
import { collectProjectCards, type ProjectCardData, type ProjectStage } from '../../state/selectors';
import { projectOpenIntent } from '../../state/projectNavigation';
import { formatGameDateWithMonth } from '../../engine/calendar';
import { Money } from '../common/Money';

/**
 * The second navigation axis: the films in flight. A project is a *context*,
 * not a peer of "Dashboard" - which is what a page list cannot express, and
 * why the Projects screen used to be the only way to see more than one at once.
 *
 * Horizontal, below the spine, deliberately on a different axis from the rail:
 * places read as a list, films in flight read as a row of cards, and the shape
 * is what tells them apart before any label does. It hides entirely when there
 * is nothing in flight rather than showing an empty strip.
 *
 * Each card carries the one fact that actually matters about that film right
 * now - days shot, the date it opens, what it has grossed - rather than a
 * generic stage badge repeated eight times.
 */

/** Films that are finished and filed carry no live decision, so they stay off the slate. */
const IN_FLIGHT: ProjectStage[] = ['in-development', 'pre-production', 'filming', 'post-production', 'scheduled', 'in-cinemas'];

const STAGE_LABELS: Record<ProjectStage, string> = {
  'in-development': 'Development',
  'pre-production': 'Pre-production',
  filming: 'Filming',
  'post-production': 'Post',
  scheduled: 'Scheduled',
  'in-cinemas': 'In cinemas',
  archived: 'Archived',
  shelved: 'Shelved',
};

/** The single most useful live number for a film at this stage, in words. */
function stateLine(card: ProjectCardData, totalDays: number): React.ReactNode {
  if (card.shootProgress) {
    const { daysElapsed, recommendedDays } = card.shootProgress;
    return `Day ${daysElapsed} of ${recommendedDays}`;
  }
  if (card.boxOffice) {
    return <>Gross <Money amount={card.boxOffice.cumulativeGross} /></>;
  }
  if (card.scheduledReleaseDay !== null) {
    const weeks = Math.max(0, Math.round((card.scheduledReleaseDay - totalDays) / 7));
    return weeks === 0 ? 'Opens this week' : `Opens in ${weeks} week${weeks === 1 ? '' : 's'}`;
  }
  if (card.shootStartsOnDay !== null) return `Shoots ${formatGameDateWithMonth(card.shootStartsOnDay)}`;
  if (card.director) return card.director;
  return 'No director attached';
}

export function Slate() {
  const { state, dispatch } = useStudio();
  const cards = collectProjectCards(state).filter((c) => IN_FLIGHT.includes(c.stage));
  if (cards.length === 0) return null;

  function open(card: ProjectCardData) {
    const intent = projectOpenIntent(card, state);
    // The slate navigates; it deliberately does not open the dossier or the
    // scheduled-release modal. Those belong to the Projects page, which owns
    // that modal state - from here they route to Projects instead of teaching
    // the shell to own two more overlays.
    if (intent.kind === 'navigate' || intent.kind === 'resume') intent.actions.forEach(dispatch);
    else if (intent.kind === 'dossier' || intent.kind === 'scheduled') dispatch({ type: 'VIEW_PROJECTS' });
  }

  return (
    <div className="slate">
      <span className="slate-label">Slate</span>
      {cards.map((card) => {
        const intent = projectOpenIntent(card, state);
        return (
          <button
            key={card.projectId}
            type="button"
            className="slate-proj"
            aria-current={card.isFocused ? 'true' : undefined}
            disabled={intent.kind === 'blocked'}
            title={intent.kind === 'blocked' ? 'Finish or leave the project you have open first' : undefined}
            onClick={() => open(card)}
          >
            <span className="slate-proj__stage">{STAGE_LABELS[card.stage]}</span>
            <span className="slate-proj__title typed">{card.title}</span>
            <span className="slate-proj__state">{stateLine(card, state.totalDays)}</span>
          </button>
        );
      })}
    </div>
  );
}
