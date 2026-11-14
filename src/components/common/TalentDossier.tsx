import { FAIR_CONFIDENCE, type AttributeRead, type TalentKnowledge } from '../../engine/talentKnowledge';

// The talent card's evidence section (docs/DESIGN_talent_model.md §4.5, stage 4):
// the films first, then a read per attribute in words with its own confidence,
// as a bar whose width is the doubt - narrow and dark for what you saw on your
// own set, wide and grey for a second-hand guess, dashed for never tested. No
// numbers anywhere: the bar's position is the read, not a score.

const MAX_ROWS = 4;

function ReadBar({ read }: { read: AttributeRead }) {
  if (read.tier === 'untested') {
    return <span className="dossier-bar dossier-bar--untested" role="img" aria-label="Never tested" />;
  }
  // Dark only for what you have properly seen yourself; a glimpse is still a guess.
  const solid = (read.source === 'own' || read.source === 'audition') && read.confidence >= FAIR_CONFIDENCE;
  return (
    <span className="dossier-bar" role="img" aria-label={`${read.verdict}, ${solid ? 'seen first-hand' : 'a second-hand read'}`}>
      <span
        className={`dossier-bar-fill${solid ? ' dossier-bar-fill--seen' : ''}`}
        style={{ marginLeft: `${read.low}%`, width: `${Math.max(3, read.high - read.low)}%` }}
      />
    </span>
  );
}

/** "14 films · 3 for you" - the size of the record the reads stand on. */
export function describeRecordSize(knowledge: TalentKnowledge): string {
  const films = knowledge.totalFilms;
  const filmWord = films === 1 ? '1 film' : `${films} films`;
  const own = knowledge.ownFilms === 0 ? 'none for you' : `${knowledge.ownFilms} for you`;
  return films === 0 ? 'No films yet' : `${filmWord} · ${own}`;
}

export function TalentDossier({ knowledge }: { knowledge: TalentKnowledge }) {
  const rows = knowledge.trackRecord.slice(0, MAX_ROWS);
  const earlier = knowledge.totalFilms - knowledge.trackRecord.length;
  return (
    <div className="dossier">
      <div className="dossier-section">
        <div className="dossier-heading">
          <span>Track record</span>
        </div>
        {rows.length > 0 ? (
          <ul className="dossier-films">
            {rows.map((row) => (
              <li key={row.filmId} className="dossier-film">
                <span className="dossier-film-year">Y{row.year}</span>
                <span className="dossier-film-main">
                  <span className="dossier-film-title">
                    {row.title}
                    {row.own && <span className="dossier-yours">Yours</span>}
                  </span>
                  <span className="dossier-film-part">{row.part}</span>
                </span>
                <span className={`dossier-film-outcome dossier-film-outcome--${row.outcomeTone}`}>
                  {row.outcome}
                  {row.personal && ` · ${row.personal}`}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {earlier > 0 && (
          <p className="dossier-note">
            {rows.length > 0 ? `And ${earlier} earlier film${earlier === 1 ? '' : 's'}` : `${earlier} film${earlier === 1 ? '' : 's'}`} before your time, known only by reputation.
          </p>
        )}
        {knowledge.totalFilms === 0 && <p className="dossier-note">Nothing yet. Nobody has seen what they can do.</p>}
      </div>

      {knowledge.reads.length > 0 && (
        <div className="dossier-section">
          <div className="dossier-heading">
            <span>What you know</span>
          </div>
          <ul className="dossier-reads">
            {knowledge.reads.map((read) => (
              <li key={read.key} className="dossier-read">
                <span className="dossier-read-text">
                  <span className="dossier-read-line">
                    <strong>{read.label}</strong> · {read.verdict}
                  </span>
                  <span className="dossier-read-basis">{read.basis}</span>
                </span>
                <ReadBar read={read} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** The single most useful thing to know before making an offer. */
export function DossierCaveat({ text }: { text: string }) {
  return (
    <div className="dossier-caveat">
      <span className="dossier-caveat-label">Before you offer</span>
      <p className="dossier-caveat-text">{text}</p>
    </div>
  );
}
