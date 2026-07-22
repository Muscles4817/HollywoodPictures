import { useMemo } from 'react';
import { useStudio } from '../state/StudioContext';
import { playerReleasedFilms } from '../engine/project';
import { formatGameDateWithMonth } from '../engine/calendar';
import { SETTING_LABELS, CHARACTER_ARCHETYPE_LABELS } from '../data/scriptTagLabels';

/**
 * The studio's owned Intellectual Property - the persistent creative assets the
 * player has deliberately promoted released Films into (see
 * types/index.ts:IntellectualProperty and engine/intellectualProperty.ts). A
 * plain read-only roster for this first milestone: each IP's promoted
 * Characters and its Setting, plus which Film it came from. A Dashboard detour,
 * the same shape as the Talent Database / Asset Library screens; the global
 * Header handles getting back.
 */
export function IpLibrary() {
  const { state } = useStudio();
  const ips = state.studio.intellectualProperties;

  // Source-film titles, looked up by id - the IP only stores the reference, not
  // a copy of the Film (which lives on in the catalogue).
  const filmTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const film of playerReleasedFilms(state.projects)) map.set(film.id, film.title);
    return map;
  }, [state.projects]);

  return (
    <div className="stack ip-library">
      <div>
        <h1 style={{ margin: 0 }}>Intellectual Property</h1>
        <p className="td-database__summary">
          {ips.length === 0 ? 'Nothing promoted yet' : `${ips.length} owned IP${ips.length === 1 ? '' : 's'}`}
        </p>
      </div>

      {ips.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0 }}>
            You don't own any intellectual property yet. Open a released film's dossier from your Studio History and
            choose <strong>Promote to IP</strong> to turn its characters and setting into a persistent creative asset
            you can build future projects around.
          </p>
        </div>
      ) : (
        <div className="stack">
          {ips.map((ip) => (
            <section className="card stack" key={ip.id}>
              <div className="row-between">
                <h2 style={{ margin: 0 }}>{ip.name}</h2>
                <span style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>Promoted {formatGameDateWithMonth(ip.createdOnDay)}</span>
              </div>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85em' }}>
                From <strong>{filmTitleById.get(ip.sourceFilmId) ?? 'a released film'}</strong> · Setting: {SETTING_LABELS[ip.setting.archetype]}
              </p>
              <div>
                <div className="stat-label">Characters</div>
                {ip.characters.length === 0 ? (
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85em' }}>Setting only — no characters were included.</p>
                ) : (
                  <div className="stack" style={{ gap: 2 }}>
                    {ip.characters.map((c) => (
                      <div key={c.id} style={{ fontSize: '0.9em' }}>
                        <strong>{c.name}</strong> — {c.prominence} {CHARACTER_ARCHETYPE_LABELS[c.archetype]}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
