import { formatGameDateWithMonth } from '../../engine/calendar';
import { SETTING_LABELS, CHARACTER_ARCHETYPE_LABELS } from '../../data/scriptTagLabels';
import { describeCharacterDemands } from '../../engine/scriptPresentation';
import { Button } from './Button';
import { Money } from './Money';
import { ScoreBar } from './ScoreBar';
import { StarRating } from './StarRating';
import { StatTile } from './StatTile';
import type { Film, IntellectualProperty, IpCharacter, PendingSequelDevelopment, ScriptCharacter, TalentAssignment } from '../../types';

// The bigger, click-through view of an IP - the persistent layers a franchise
// accrues (types/index.ts:IntellectualProperty) that the IP Library roster only
// hinted at: its standing, every character it's built on with their own
// evolving standing and traits, and the reception & box-office history of each
// film in the franchise. Read-only; the roster owns the develop-sequel action.

function StandingSection({ ip, films }: { ip: IntellectualProperty; films: Film[] }) {
  return (
    <div className="card stack">
      <h3 style={{ margin: 0 }}>Franchise standing</h3>
      <ScoreBar label="Recognition" value={ip.recognition} />
      <p style={{ margin: 0, fontSize: '0.8em', color: 'var(--text-muted)' }}>
        How known this franchise is to audiences — the pre-sold draw each new entry opens on. Grows with every successful film.
      </p>
      <ScoreBar label="Prestige" value={ip.prestige} />
      <p style={{ margin: 0, fontSize: '0.8em', color: 'var(--text-muted)' }}>
        Its critical standing — inherited from the source film's reception.
      </p>
      <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
        <StatTile label="Films" value={`${films.length}`} />
        <StatTile label="Setting" value={SETTING_LABELS[ip.setting.archetype]} />
        <StatTile label="Characters" value={`${ip.characters.length}`} />
      </div>
    </div>
  );
}

function CharacterCard({ character }: { character: IpCharacter }) {
  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
      <div className="row-between">
        <strong>{character.name}</strong>
        <span className="badge">{character.prominence} · {CHARACTER_ARCHETYPE_LABELS[character.archetype]}</span>
      </div>
      <p style={{ margin: '2px 0 6px', fontSize: '0.85em', color: 'var(--text-muted)' }}>
        {describeCharacterDemands(character as unknown as ScriptCharacter)}
      </p>
      {/* Evolving standing - what the audience thinks of this character specifically. */}
      <ScoreBar label="Recognition" value={character.standing.recognition} />
      <ScoreBar label="Popularity" value={character.standing.popularity} />
      {/* The traits the IP layer reads - what makes them distinctive and marketable. */}
      <div className="row" style={{ gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <ScoreBar label="Distinctiveness" value={character.traits.distinctiveness} />
          <ScoreBar label="Accessibility" value={character.traits.audienceAccessibility} />
          <ScoreBar label="Merchandise potential" value={character.traits.merchandisePotential} />
        </div>
      </div>
    </div>
  );
}

function CharactersSection({ ip }: { ip: IntellectualProperty }) {
  return (
    <div className="card stack">
      <h3 style={{ margin: 0 }}>Characters</h3>
      {ip.characters.length === 0 ? (
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85em' }}>Setting only — no characters were promoted into this IP.</p>
      ) : (
        ip.characters.map((c) => <CharacterCard key={c.id} character={c} />)
      )}
    </div>
  );
}

/** The name of the character an actor played on a film, from the film's own cast. */
function characterNameOf(assignment: TalentAssignment, film: Film): string | undefined {
  return assignment.characterId ? film.script.cast.find((c) => c.id === assignment.characterId)?.name : undefined;
}

function FilmHistoryEntry({ film, entryNumber, onOpenFilm }: { film: Film; entryNumber: number; onOpenFilm: (film: Film) => void }) {
  const { results } = film;
  const director = film.talent.find((a) => a.role === 'Director');
  const leads = film.talent.filter((a) => a.role === 'Lead Actor' || a.role === 'Supporting Actor');
  const running = film.boxOfficeRun.status !== 'finished';
  return (
    <div className="stack" style={{ gap: 6, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
      <div className="row-between">
        <div>
          <strong>{entryNumber}. {film.title}</strong>
          <div style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>Released {formatGameDateWithMonth(film.releasedOnDay)}</div>
        </div>
        {results.outcome && (
          <span className={`badge badge-outcome-${results.outcome.replace(/\s+/g, '-')}`}>{results.outcome}</span>
        )}
      </div>

      <div className="row" style={{ gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="row" style={{ gap: 6 }}>
          <span className="score-bar-label">Critics</span>
          <StarRating value={results.criticScore} />
        </span>
        <span className="row" style={{ gap: 6 }}>
          <span className="score-bar-label">Audience</span>
          <StarRating value={results.audienceScore} />
        </span>
        <StatTile label="Box office" value={<Money amount={running ? film.boxOfficeRun.cumulativeGross : results.totalBoxOffice ?? 0} />} />
        <StatTile label="Profit / loss" value={results.profit === null ? 'Pending' : <Money amount={results.profit} signColor showSign />} />
      </div>

      <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
        <ScoreBar label="Quality" value={results.qualityScore} />
        <ScoreBar label="Buzz" value={results.buzzScore} />
      </div>

      {/* The people behind this entry - who directed it and who played whom, the
          continuity a franchise is really made of. */}
      {(director || leads.length > 0) && (
        <div style={{ fontSize: '0.85em' }}>
          {director && <div><span style={{ color: 'var(--text-muted)' }}>Directed by</span> {director.person.identity.name}</div>}
          {leads.map((a) => {
            const name = characterNameOf(a, film);
            return (
              <div key={a.person.id}>
                {a.person.identity.name}
                {name && <span style={{ color: 'var(--text-muted)' }}> as {name}</span>}
              </div>
            );
          })}
        </div>
      )}

      <div className="row-between">
        <span />
        <Button className="btn-sm" onClick={() => onOpenFilm(film)}>View full dossier</Button>
      </div>
    </div>
  );
}

function FilmHistorySection({ films, onOpenFilm }: { films: Film[]; onOpenFilm: (film: Film) => void }) {
  return (
    <div className="card stack">
      <h3 style={{ margin: 0 }}>Franchise history</h3>
      {films.length === 0 ? (
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85em' }}>No released entries on record yet.</p>
      ) : (
        films.map((film, i) => <FilmHistoryEntry key={film.id} film={film} entryNumber={i + 1} onOpenFilm={onOpenFilm} />)
      )}
    </div>
  );
}

export function IpDetailModal({
  ip,
  films,
  development,
  onClose,
  onOpenFilm,
  onDevelopSequel,
}: {
  ip: IntellectualProperty;
  /** Every released film in this IP, oldest first (resolved from ip.filmIds). */
  films: Film[];
  /** The in-flight next entry, if one is developing. */
  development: PendingSequelDevelopment | null;
  onClose: () => void;
  onOpenFilm: (film: Film) => void;
  onDevelopSequel: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content stack" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <div>
            <h2 style={{ margin: 0 }}>{ip.name}</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              {ip.genre ? `${ip.genre} franchise · ` : ''}Promoted {formatGameDateWithMonth(ip.createdOnDay)}
            </p>
          </div>
        </div>

        <StandingSection ip={ip} films={films} />
        <CharactersSection ip={ip} />
        <FilmHistorySection films={films} onOpenFilm={onOpenFilm} />

        <div className="card row-between" style={{ alignItems: 'center', gap: 12 }}>
          {development ? (
            <p style={{ margin: 0, fontSize: '0.85em', color: 'var(--text-muted)' }}>
              Next entry in development — screenplay expected {formatGameDateWithMonth(development.readyOnDay)}.
            </p>
          ) : (
            <>
              <p style={{ margin: 0, fontSize: '0.85em', color: 'var(--text-muted)' }}>
                Commission the next chapter — it carries the world, cast, and audience, and takes time to develop.
              </p>
              <Button variant="primary" onClick={onDevelopSequel}>Develop a sequel</Button>
            </>
          )}
        </div>

        <div className="row-between">
          <span />
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
