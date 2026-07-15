import { formatGameDate } from '../../engine/calendar';
import { computeTalentCompatibility } from '../../engine/compatibility';
import { ALL_TALENT_ROLES } from '../../data/talentGeneration';
import { toneProfileBreakdown } from '../../data/tones';
import { ARCHETYPE_LABELS, STORY_TYPE_LABELS, SETTING_LABELS, SCALE_LABELS } from '../../data/scriptTagLabels';
import { productionRequirementTags } from '../../engine/scriptPresentation';
import { Button } from './Button';
import { Money } from './Money';
import { ScoreBar } from './ScoreBar';
import { StarRating } from './StarRating';
import { StatTile } from './StatTile';
import { StatGroup } from './StatGroup';
import { CompatibilityBadge } from './CompatibilityBadge';
import { BoxOfficeChart } from './BoxOfficeChart';
import { SeverityBadge } from './SeverityBadge';
import { computeReportedLegs } from '../../state/selectors';
import type { Film, Talent } from '../../types';

/**
 * "What film is this" - the screenplay's own concept, craft, production
 * requirements, and tone, none of which the dossier showed at all before
 * this (docs/DESIGN.md - QoL pass). Leads the modal, ahead of Cast & Crew/
 * Reception/Financials, since knowing what kind of film this was makes
 * everything that follows (who was cast, how it was received, what it
 * cost) read as an answer to a question the player already has context
 * for, rather than a a flat list of numbers.
 */
function ScriptSection({ film }: { film: Film }) {
  const { script } = film;
  return (
    <div className="card stack">
      <h3 style={{ margin: 0 }}>Screenplay</h3>
      <div className="card-title">{script.title}</div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <span className="badge">{ARCHETYPE_LABELS[script.archetype]}</span>
        {script.storyType !== 'Original' && <span className="badge">{STORY_TYPE_LABELS[script.storyType]}</span>}
        <span className="badge">{SETTING_LABELS[script.setting]}</span>
        <span className="badge">{SCALE_LABELS[script.scale]}</span>
      </div>
      <p className="card-synopsis" style={{ margin: 0 }}>{script.synopsis}</p>
      <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
        <StatGroup
          title="Writing"
          stats={[
            { label: 'Dialogue', value: script.dialogue },
            { label: 'Characters', value: script.characters },
            { label: 'Structure', value: script.structure },
          ]}
        />
        <StatGroup
          title="Creative"
          stats={[
            { label: 'Originality', value: script.originality },
            { label: 'Complexity', value: script.complexity },
          ]}
        />
      </div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        {productionRequirementTags(script).map((tag) => (
          <span className="badge" key={tag}>{tag}</span>
        ))}
      </div>
      <CompatibilityBadge breakdown={toneProfileBreakdown(script.toneProfile)} />
    </div>
  );
}

/** A talent's role-appropriate "how good/how well they fit" reading - skill for crew, script compatibility for actors/director. */
function talentStatLine(talent: Talent, script: Film['script']): string {
  if ('skill' in talent) return `Skill ${talent.skill}`;
  const compat = computeTalentCompatibility(talent, script);
  return compat === null ? '' : `Compatibility ${Math.round(compat)}`;
}

function CastCrewSection({ film }: { film: Film }) {
  return (
    <div className="card stack">
      <h3 style={{ margin: 0 }}>Cast &amp; Crew</h3>
      {ALL_TALENT_ROLES.map((role) => {
        const hired = film.talent.filter((a) => a.role === role).map((a) => a.talent);
        if (hired.length === 0) return null;
        return (
          <div key={role}>
            <div className="stat-label">{role}{hired.length > 1 ? 's' : ''}</div>
            {hired.map((t) => (
              <div className="row-between" key={t.id}>
                <span>{t.name}</span>
                <span style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>
                  {talentStatLine(t, film.script)} &middot; Fame {t.fame} &middot; Reliability {t.reliability} &middot; Ego {t.ego} &middot; <Money amount={t.salary} />
                </span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function FinancialsSection({ film }: { film: Film }) {
  const running = film.boxOfficeRun.status === 'running';
  // Derived, not stored - see state/selectors.ts:computeReportedLegs. Only
  // shown once the run has actually finished; a still-running film's
  // eventual legs aren't knowable any earlier than its real total is.
  const legs = computeReportedLegs(film);
  return (
    <div className="card stack">
      <h3 style={{ margin: 0 }}>Financials</h3>
      <div className="row">
        <StatTile label="Production Cost" value={<Money amount={film.results.productionCost} />} />
        <StatTile label="Marketing Cost" value={<Money amount={film.results.marketingCost} />} />
        <StatTile label="Total Cost" value={<Money amount={film.results.totalCost} />} />
      </div>
      <div className="row">
        <StatTile label="Opening Weekend" value={<Money amount={film.results.openingWeekend} />} />
        {running ? (
          <StatTile label="Gross So Far" value={<Money amount={film.boxOfficeRun.cumulativeGross} />} />
        ) : (
          <>
            <StatTile label="Total Box Office" value={<Money amount={film.results.totalBoxOffice ?? 0} />} />
            <StatTile label="Studio's Share" value={<Money amount={film.results.studioRevenue ?? 0} />} />
            <StatTile label="Profit / Loss" value={<Money amount={film.results.profit ?? 0} signColor showSign />} />
            {legs !== null && <StatTile label="Legs" value={`${legs.toFixed(2)}x`} />}
          </>
        )}
      </div>
      {film.boxOfficeRun.weeks.length > 0 && <BoxOfficeChart weeks={film.boxOfficeRun.weeks} />}
    </div>
  );
}

function ReceptionSection({ film }: { film: Film }) {
  const { results } = film;
  return (
    <div className="card stack">
      <h3 style={{ margin: 0 }}>Reception</h3>
      <ScoreBar label="Quality Score" value={results.qualityScore} />
      <div className="row-between">
        <span className="score-bar-label">Critic Score</span>
        <StarRating value={results.criticScore} />
      </div>
      <div className="row-between">
        <span className="score-bar-label">Audience Score</span>
        <StarRating value={results.audienceScore} />
      </div>
      <ScoreBar label="Buzz Score" value={results.buzzScore} />
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
        <p className="choice-description" style={{ margin: '0 0 8px' }}>Department breakdown</p>
        <ScoreBar label="Screenplay" value={results.scriptScore} />
        <ScoreBar label="Direction" value={results.directionScore} />
        <ScoreBar label="Acting" value={results.actingScore} />
        <ScoreBar label="Production" value={results.productionScore} />
        <ScoreBar label="Post-Production" value={results.postProductionScore} />
        <ScoreBar label="On-Set Events" value={results.eventsScore} />
      </div>
    </div>
  );
}

function EventsSection({ film }: { film: Film }) {
  return (
    <div className="card stack">
      <h3 style={{ margin: 0 }}>On-Set Events</h3>
      {film.events.length === 0 && <p style={{ margin: 0, color: 'var(--text-muted)' }}>Nothing notable happened.</p>}
      {film.events.map((event, i) => (
        <div
          key={`${event.id}-${i}`}
          className="row-between"
          style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}
        >
          <span className="row" style={{ gap: 8 }}>
            <SeverityBadge severity={event.severity} />
            <span>{event.description}</span>
          </span>
          <span style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>
            Cost <Money amount={event.costDelta} signColor invertColor showSign /> &middot; Quality {event.qualityDelta >= 0 ? '+' : ''}{event.qualityDelta.toFixed(1)} &middot; Buzz {event.buzzDelta >= 0 ? '+' : ''}{event.buzzDelta.toFixed(1)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ReviewsSection({ film }: { film: Film }) {
  return (
    <div className="card stack">
      <h3 style={{ margin: 0 }}>Reviews &amp; Studio Report</h3>
      <p style={{ margin: 0 }}>{film.results.storyReport}</p>
      {film.results.reviewBlurbs.map((blurb, i) => (
        <p key={i} style={{ margin: 0 }}>{blurb}</p>
      ))}
    </div>
  );
}

/**
 * The full dossier for one released film - the screenplay's own concept and
 * craft, cast/crew with their stats, the on-set event log, reception,
 * financials, and reviews - opened by clicking a row in Dashboard's Studio
 * History table. Ordered to read like the film's own story: what it was
 * conceived as, who made it, what happened while making it, how it was
 * received, how it did commercially, and finally what people actually said
 * about it - rather than the flat, unordered stat dump this started as.
 * Originally pulled everything scattered across ReleaseResults/
 * BoxOfficeFinishedPopup into one place for a film the player picks, rather
 * than only ever seeing it once right after release; the Script section was
 * missing entirely until the QoL pass that added it (docs/DESIGN.md).
 */
export function FilmDetailModal({ film, onClose }: { film: Film; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content stack" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <div>
            <h2 style={{ margin: 0 }}>{film.title}</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              {film.genre} &middot; Released {formatGameDate(film.releasedOnDay)}
            </p>
          </div>
          {film.results.outcome && (
            <span className={`badge badge-outcome-${film.results.outcome.replace(/\s+/g, '-')}`} style={{ fontSize: '1.1em' }}>
              {film.results.outcome}
            </span>
          )}
        </div>

        <ScriptSection film={film} />
        <CastCrewSection film={film} />
        <EventsSection film={film} />
        <ReceptionSection film={film} />
        <FinancialsSection film={film} />
        <ReviewsSection film={film} />

        <div className="row-between">
          <span />
          <Button variant="primary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
