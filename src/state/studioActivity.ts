/**
 * The neutral activity vocabulary shared by the Dashboard "What's happening"
 * feed and the Inbox (components/common/ActivityCard.tsx renders it for both).
 *
 * Deliberately NOT a single cross-surface selector: the Dashboard and the Inbox
 * legitimately present the same underlying condition differently (a wrapped film
 * is an "Open project" route card on the Dashboard but a "Continue to
 * Post-Production" resume card in the Inbox), so forcing one derivation to feed
 * both would force identical content the two surfaces don't want. What IS shared
 * is (a) the underlying condition derivations (engine/project.ts:deriveInboxItems,
 * state/selectors.ts award/box-office helpers), (b) this presentation type, and
 * (c) the ActivityCard renderer. Each surface maps conditions -> StudioActivity
 * itself, choosing what to show and how to route.
 */

export type ActivityTone = 'urgent' | 'warning' | 'positive' | 'neutral';

/**
 * What kind of beat this is, driving where it belongs and how the Inbox groups
 * it:
 *  - 'attention' - something is waiting on the player (a decision, a shoot ready
 *    to pick back up). The Inbox's "Needs you" group.
 *  - 'update' - informational; nothing is blocked, but the player should know
 *    (box office closed, awards resolved, a bid settled). The Inbox's "While you
 *    were away" group.
 *  - 'status' - ambient Dashboard context (next release, films in theatres) that
 *    is useful on the Dashboard but is NOT catch-up, so it never appears in the
 *    Inbox. This is the distinction that keeps the Inbox from becoming a second
 *    Dashboard.
 */
export type ActivityCategory = 'attention' | 'update' | 'status';

export interface StudioActivity {
  id: string;
  tone: ActivityTone;
  category: ActivityCategory;
  /** Short kicker above the title, e.g. "Decision required", "Awards night". */
  eyebrow: string;
  title: string;
  detail: string;
}

/**
 * The action a card offers. `onClick` is supplied by the surface, since the
 * Dashboard and Inbox route the same activity to different places; omit it (and
 * set `note`) when the action is temporarily unavailable - e.g. a background
 * shoot can't be resumed while another project is focused, so the Inbox shows a
 * "finish what you're doing first" note instead of a live button.
 */
export interface ActivityAction {
  label: string;
  onClick?: () => void;
  note?: string;
}

/** One rendered card: the neutral activity plus this surface's action for it. */
export interface ActivityEntry {
  activity: StudioActivity;
  action?: ActivityAction;
}
