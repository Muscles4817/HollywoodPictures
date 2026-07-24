import { Button } from './Button';
import type { ActivityAction, StudioActivity } from '../../state/studioActivity';

/**
 * The one card that renders a StudioActivity, shared by the Dashboard
 * "What's happening" feed and the Inbox (state/studioActivity.ts). Uses the
 * existing `.dashboard-activity` styling (globally bundled, so it works on both
 * surfaces) - the class prefix is historical; this is the shared activity card
 * now, not a Dashboard-only one.
 *
 * The action's onClick is passed in by the caller because the same activity
 * routes differently per surface; when an action is present but has no onClick,
 * it renders as a muted note (e.g. "finish what you're working on first")
 * instead of a live button.
 */
export function ActivityCard({ activity, action }: { activity: StudioActivity; action?: ActivityAction }) {
  return (
    <article className={`dashboard-activity dashboard-activity-${activity.tone}`}>
      <span className="dashboard-activity-dot" aria-hidden="true" />
      <div className="dashboard-activity-copy">
        <span className="dashboard-activity-eyebrow">{activity.eyebrow}</span>
        <strong>{activity.title}</strong>
        <p>{activity.detail}</p>
        {action?.note && <p className="dashboard-activity-note">{action.note}</p>}
      </div>
      {action?.onClick && (
        <Button className="btn-sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </article>
  );
}
