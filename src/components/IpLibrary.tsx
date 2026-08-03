import { useMemo, useState } from 'react';
import { useStudio } from '../state/StudioContext';
import { playerReleasedFilms } from '../engine/project';
import { formatGameDateWithMonth } from '../engine/calendar';
import { SETTING_LABELS, CHARACTER_ARCHETYPE_LABELS } from '../data/scriptTagLabels';
import { Button } from './common/Button';
import { FilmDetailModal } from './common/FilmDetailModal';
import { IpDetailModal } from './common/IpDetailModal';
import type { Film, PendingSequelDevelopment } from '../types';

/**
 * The studio's owned Intellectual Property - the persistent creative assets the
 * player has deliberately promoted released Films into (see
 * types/index.ts:IntellectualProperty and engine/intellectualProperty.ts). The
 * roster is a lightweight index; clicking an IP opens the full IpDetailModal
 * with its standing, characters, and per-film reception & box-office history. A
 * Dashboard detour, the same shape as the Talent Database / Asset Library
 * screens; the global Header handles getting back.
 */
export function IpLibrary() {
  const { state, dispatch } = useStudio();
  const ips = state.studio.intellectualProperties;
  const [selectedIpId, setSelectedIpId] = useState<string | null>(null);
  const [selectedFilm, setSelectedFilm] = useState<Film | null>(null);

  // A franchise entry can be in timed development (Franchise stage 2) - the IP's
  // own in-flight sequel, keyed by ipId. One at a time per IP.
  const developmentByIpId = useMemo(() => {
    const map = new Map<string, PendingSequelDevelopment>();
    for (const dev of state.studio.pendingSequelDevelopments ?? []) map.set(dev.ipId, dev);
    return map;
  }, [state.studio.pendingSequelDevelopments]);

  // Every released player film by id - the IP only stores references (filmIds),
  // never a copy of the Film (which lives on in the catalogue).
  const filmById = useMemo(() => {
    const map = new Map<string, Film>();
    for (const film of playerReleasedFilms(state.projects)) map.set(film.id, film);
    return map;
  }, [state.projects]);

  const selectedIp = selectedIpId ? ips.find((ip) => ip.id === selectedIpId) ?? null : null;
  // Resolve an IP's referenced films into real Films, oldest first - the order a
  // franchise history reads in.
  const filmsFor = (filmIds: string[]): Film[] =>
    filmIds
      .map((id) => filmById.get(id))
      .filter((f): f is Film => f !== undefined)
      .sort((a, b) => a.releasedOnDay - b.releasedOnDay);

  return (
    <div className="stack ip-library">
      {selectedIp && (
        <IpDetailModal
          ip={selectedIp}
          films={filmsFor(selectedIp.filmIds)}
          development={developmentByIpId.get(selectedIp.id) ?? null}
          onClose={() => setSelectedIpId(null)}
          onOpenFilm={setSelectedFilm}
          onDevelopSequel={() => dispatch({ type: 'DEVELOP_SEQUEL', ipId: selectedIp.id })}
        />
      )}
      {selectedFilm && <FilmDetailModal film={selectedFilm} onClose={() => setSelectedFilm(null)} />}

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
          {ips.map((ip) => {
            const development = developmentByIpId.get(ip.id);
            return (
              <section className="card stack" key={ip.id}>
                <div className="row-between">
                  <button type="button" className="ip-card-title" onClick={() => setSelectedIpId(ip.id)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
                    <h2 style={{ margin: 0 }}>{ip.name}</h2>
                  </button>
                  <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>Promoted {formatGameDateWithMonth(ip.createdOnDay)}</span>
                    <Button className="btn-sm" onClick={() => setSelectedIpId(ip.id)}>View details</Button>
                  </div>
                </div>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85em' }}>
                  Setting: {SETTING_LABELS[ip.setting.archetype]} · Recognition {Math.round(ip.recognition)} · Prestige {Math.round(ip.prestige)}
                  {ip.filmIds.length > 1 && <> · <strong>{ip.filmIds.length} films</strong> in the franchise</>}
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

                {/* Franchise stage 2 - develop the next entry. The screenplay isn't
                    instant: it takes real development time before it lands in the
                    Asset Library, so while one is in flight we show its status
                    instead of a second button (one development per IP). */}
                <div className="row-between" style={{ alignItems: 'center', gap: 12 }}>
                  {development ? (
                    <p style={{ margin: 0, fontSize: '0.85em', color: 'var(--text-muted)' }}>
                      Next entry in development — screenplay expected {formatGameDateWithMonth(development.readyOnDay)}.
                    </p>
                  ) : (
                    <>
                      <p style={{ margin: 0, fontSize: '0.85em', color: 'var(--text-muted)' }}>
                        Commission the next chapter — it carries the world, cast, and audience, and takes time to develop.
                      </p>
                      <Button onClick={() => dispatch({ type: 'DEVELOP_SEQUEL', ipId: ip.id })}>Develop a sequel</Button>
                    </>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
