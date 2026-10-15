import { useEffect, useRef } from 'react';
import { useStudio } from '../../state/StudioContext';
import { useSettings } from '../../settings/SettingsContext';
import { audio } from '../../audio/audioEngine';
import { resolveMusicTrack } from '../../audio/music';
import { inboxBadgeCount } from '../../engine/project';
import { unreadBidCount } from '../../engine/bidNotifications';
import { unacknowledgedAwardHighlights } from '../../state/selectors';

interface SoundDirectorProps {
  onMainMenu: boolean;
  paused: boolean;
  /** Unread outbids the player can still answer - the one arrival that gets the urgent sound. */
  timeCriticalUnread: number;
}

/**
 * Turns what happens in the game into sound: which loop is playing, the chime
 * when something lands in the Inbox while the clock runs, the alarm when a
 * rival outbids you, the transport's pause and resume. Renders nothing.
 *
 * Arrivals are counted without the spine's "minus the project you're looking
 * at" exclusion: that exclusion makes the badge rise whenever the player
 * navigates *away* from a project, and a chime for leaving a page would be
 * noise. Only a genuine increase on the same underlying count sounds.
 */
export function SoundDirector({ onMainMenu, paused, timeCriticalUnread }: SoundDirectorProps) {
  const { state } = useStudio();
  const { settings } = useSettings();

  const track = resolveMusicTrack(settings.music, state.screen, onMainMenu);
  useEffect(() => {
    audio.setTrack(track);
  }, [track]);

  const arrivals =
    inboxBadgeCount(state.projects, null, state.totalDays) +
    unreadBidCount(state.bidNotifications ?? []) +
    unacknowledgedAwardHighlights(state).length;
  const prevArrivals = useRef(arrivals);
  const prevCritical = useRef(timeCriticalUnread);
  useEffect(() => {
    if (!onMainMenu) {
      if (timeCriticalUnread > prevCritical.current) audio.play('alert');
      else if (arrivals > prevArrivals.current) audio.play('notify');
    }
    prevArrivals.current = arrivals;
    prevCritical.current = timeCriticalUnread;
  }, [arrivals, timeCriticalUnread, onMainMenu]);

  const prevPaused = useRef(paused);
  useEffect(() => {
    if (paused !== prevPaused.current && !onMainMenu) audio.play(paused ? 'pause' : 'resume');
    prevPaused.current = paused;
  }, [paused, onMainMenu]);

  return null;
}
