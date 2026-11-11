import { useSyncExternalStore } from 'react';
import { flushSave, getSaveStatus, subscribeSaveStatus } from '../../state/persistence';
import { Button } from './Button';

/**
 * Tells the player when the studio is not being saved.
 *
 * Saving happens on the background tick, so it falls under the notification
 * contract (docs/DESIGN_notification_contract.md): a save that fails while the
 * player is looking elsewhere has to reach them, offer the one thing they can
 * do about it, and stop once it is resolved. Before this existed a failed
 * write was swallowed and the player lost everything since the last one that
 * worked. Renders nothing while saving is healthy.
 */
export function SaveStatusBanner() {
  const status = useSyncExternalStore(subscribeSaveStatus, getSaveStatus, getSaveStatus);
  if (status.kind === 'ok') return null;

  return (
    <div className="save-status-banner" role="alert">
      <p>
        <strong>Your studio is not being saved.</strong> {status.reason} You can keep playing, but closing or
        reloading this tab will lose everything since the last successful save.
      </p>
      <Button onClick={() => void flushSave()}>Try saving again</Button>
    </div>
  );
}
