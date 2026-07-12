import type { Studio } from '../types';
import { formatGameDate } from '../engine/calendar';

/**
 * Downloads the studio's full film history as a JSON file - every
 * released film's script, cast, every choice made, rolled events, and
 * final results (including the department/score breakdown that isn't
 * otherwise surfaced anywhere). This is a client-only app with no backend,
 * so "write to a file" means a browser download rather than a server-side
 * write - the whole point is having exact numbers to check a specific
 * result against, instead of reconstructing them from a screenshot.
 */
export function exportFilmHistory(studio: Studio, totalDays: number): void {
  const payload = {
    studioName: studio.name,
    reputation: studio.reputation,
    totalDays,
    currentDate: formatGameDate(totalDays),
    exportedAt: new Date().toISOString(),
    filmsReleased: studio.filmsReleased,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeName = studio.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'studio';
  link.download = `${safeName}-film-history-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
