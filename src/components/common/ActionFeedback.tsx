import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useStudio } from '../../state/StudioContext';
import { Money } from './Money';
import './ActionFeedback.css';

/**
 * One committed player action, reported back to the player.
 *
 * The problem this exists for is a mobile one: almost every commit action in
 * the game proves itself somewhere the player cannot see at the moment they
 * take it. Acquiring a script removes its card from the Opportunity Market;
 * commissioning a rewrite closes the panel that held the button; buying a
 * facility tier charges cash that is only ever displayed on the Dashboard. On
 * a desktop viewport the surrounding page carries enough of that context to
 * make the change self-evident. On a phone, scrolled deep into a list, the
 * only visible consequence of a tap is that the thing you tapped went away -
 * which reads as a bug, not a purchase.
 *
 * So: a notice states the verb, the thing, the consequence, and - crucially -
 * the money and the resulting balance, right at the top of the viewport where
 * it is visible however far down the page the player is.
 */
export interface ActionNotice {
  /** The verb, as a short label: "Acquired", "Commissioned", "Bid placed". */
  kicker: string;
  /** What it happened to - a script title, a producer's name, a facility. */
  subject: string;
  /** One line of consequence: where the thing went, or what happens next. */
  detail?: string;
  /**
   * Signed money that moved as part of this action (negative charges the
   * studio). Omit entirely when nothing moved *yet* - a bid commits no cash
   * until it wins, and claiming otherwise in a receipt would be a lie.
   */
  amount?: number;
  /** Overrides the money line's label. Defaults to "Paid" / "Received" by sign. */
  amountLabel?: string;
  /** A single follow-up - normally "go and look at the thing that just changed". */
  action?: { label: string; onClick: () => void };
}

interface QueuedNotice extends ActionNotice {
  id: number;
}

/**
 * Notices with a follow-up button stay longer: dismissing an action the player
 * hasn't had time to reach for is worse than a slightly stale receipt.
 */
const NOTICE_TTL_MS = 7000;
const NOTICE_WITH_ACTION_TTL_MS = 10_000;

/** Older notices are dropped rather than stacked indefinitely - three is already a lot of viewport. */
const MAX_VISIBLE = 3;

const ActionFeedbackContext = createContext<((notice: ActionNotice) => void) | null>(null);

/**
 * Report a committed action to the player. Call it immediately after the
 * dispatch that did the work, describing what actually happened.
 *
 * Deliberately a no-op outside a provider rather than a throw: component tests
 * mount individual screens without the app shell, and a missing receipt should
 * never be the reason a test of unrelated behaviour fails.
 */
export function useActionFeedback(): (notice: ActionNotice) => void {
  const confirmAction = useContext(ActionFeedbackContext);
  const noop = useCallback(() => {}, []);
  return confirmAction ?? noop;
}

export function ActionFeedbackProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<QueuedNotice[]>([]);
  const nextId = useRef(0);

  const confirmAction = useCallback((notice: ActionNotice) => {
    setNotices((current) => [...current, { ...notice, id: nextId.current++ }].slice(-MAX_VISIBLE));
  }, []);

  const dismiss = useCallback((id: number) => {
    setNotices((current) => current.filter((notice) => notice.id !== id));
  }, []);

  return (
    <ActionFeedbackContext.Provider value={confirmAction}>
      {children}
      <ActionFeedbackViewport notices={notices} onDismiss={dismiss} />
    </ActionFeedbackContext.Provider>
  );
}

/**
 * The live region itself. Always in the DOM, even with nothing to say -
 * assistive technology only announces changes to a region that already
 * existed, so mounting it alongside its first notice would silently swallow
 * that first announcement.
 */
function ActionFeedbackViewport({
  notices,
  onDismiss,
}: {
  notices: QueuedNotice[];
  onDismiss: (id: number) => void;
}) {
  // Read live rather than snapshotting at confirm() time: the caller reports a
  // notice from inside its own click handler, where React state still holds
  // the *pre*-action cash. Reading here - a render later, after the reducer has
  // applied - is the only way the balance shown is the balance the player has.
  const { state } = useStudio();

  return (
    <div className="action-feedback" role="status" aria-live="polite">
      {notices.map((notice) => (
        <NoticeSlip
          key={notice.id}
          notice={notice}
          balance={state.studio.cash}
          onDismiss={() => onDismiss(notice.id)}
        />
      ))}
    </div>
  );
}

function NoticeSlip({
  notice,
  balance,
  onDismiss,
}: {
  notice: QueuedNotice;
  balance: number;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const ttl = notice.action ? NOTICE_WITH_ACTION_TTL_MS : NOTICE_TTL_MS;
    const timer = setTimeout(onDismiss, ttl);
    return () => clearTimeout(timer);
  }, [notice.action, onDismiss]);

  const moved = notice.amount !== undefined && notice.amount !== 0;
  const amountLabel = notice.amountLabel ?? ((notice.amount ?? 0) < 0 ? 'Paid' : 'Received');

  return (
    <div className="action-feedback__slip">
      <div className="action-feedback__head">
        <span className="action-feedback__kicker">{notice.kicker}</span>
        <button
          type="button"
          className="action-feedback__dismiss"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>

      <div className="action-feedback__subject">{notice.subject}</div>
      {notice.detail && <p className="action-feedback__detail">{notice.detail}</p>}

      {moved && (
        <div className="action-feedback__figures">
          <span className="action-feedback__figure">
            <span className="stat-label">{amountLabel}</span>
            <Money amount={Math.abs(notice.amount!)} />
          </span>
          <span className="action-feedback__figure action-feedback__figure--balance">
            <span className="stat-label">Balance</span>
            <Money amount={balance} />
          </span>
        </div>
      )}

      {notice.action && (
        <button
          type="button"
          className="action-feedback__action"
          onClick={() => {
            notice.action!.onClick();
            onDismiss();
          }}
        >
          {notice.action.label}
        </button>
      )}
    </div>
  );
}
