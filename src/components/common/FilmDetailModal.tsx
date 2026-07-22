import { formatGameDateWithMonth } from '../../engine/calendar';
import { computeTalentCompatibility } from '../../engine/compatibility';
import { ALL_TALENT_ROLES } from '../../data/talentGeneration';
import { toneProfileBreakdown } from '../../data/tones';
import { ARCHETYPE_LABELS, CHARACTER_ARCHETYPE_LABELS, STORY_TYPE_LABELS, SETTING_LABELS, SCALE_LABELS } from '../../data/scriptTagLabels';
import { productionRequirementTags, describeSettingImplication, describeCharacterDemands } from '../../engine/scriptPresentation';
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
import { filmMarketBreakdown } from '../../engine/boxOfficeRun';
import { getCareerForRole } from '../../engine/person';
import { useMemo, useState } from 'react';
import { useStudio } from '../../state/StudioContext';
import { ipForSourceFilm } from '../../engine/intellectualProperty';
import { evaluateIpViability } from '../../engine/ipViability';
import type { Film, Person, ProductionRole } from '../../types';

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
        <span className="badge">{SETTING_LABELS[script.primarySetting]}</span>
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

      <div>
        <div className="stat-label">Setting: {SETTING_LABELS[script.primarySetting]}</div>
        <p style={{ margin: '2px 0 0', fontSize: '0.85em', color: 'var(--text-muted)' }}>{describeSettingImplication(script.primarySetting)}</p>
      </div>

      {script.cast.filter((c) => c.prominence !== 'Minor').length > 0 && (
        <div>
          <div className="stat-label">Cast</div>
          <div className="stack" style={{ gap: 2 }}>
            {script.cast
              .filter((c) => c.prominence !== 'Minor')
              .map((character) => (
                <div key={character.id} style={{ fontSize: '0.85em' }}>
                  <strong>{character.name}</strong> — {character.prominence} {CHARACTER_ARCHETYPE_LABELS[character.archetype]}
                  <div style={{ color: 'var(--text-muted)' }}>{describeCharacterDemands(character)}</div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** A person's role-appropriate "how good/how well they fit" reading - skill for crew, script compatibility for actors/director. */
function talentStatLine(person: Person, role: ProductionRole, script: Film['script']): string {
  const career = getCareerForRole(person, role);
  if (career && 'skill' in career) return `Skill ${career.skill}`;
  const compat = computeTalentCompatibility(person, role, script);
  return compat === null ? '' : `Compatibility ${Math.round(compat)}`;
}

function CastCrewSection({ film }: { film: Film }) {
  return (
    <div className="card stack">
      <h3 style={{ margin: 0 }}>Cast &amp; Crew</h3>
      {ALL_TALENT_ROLES.map((role) => {
        const hired = film.talent.filter((a) => a.role === role).map((a) => a.person);
        if (hired.length === 0) return null;
        return (
          <div key={role}>
            <div className="stat-label">{role}{hired.length > 1 ? 's' : ''}</div>
            {hired.map((p) => {
              const career = getCareerForRole(p, role);
              return (
                <div className="row-between" key={p.id}>
                  <span>{p.identity.name}</span>
                  <span style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>
                    {talentStatLine(p, role, film.script)} &middot; Fame {p.reputation.fame} &middot; Reliability {p.reputation.reliability} &middot; Ego {p.personality.ego} &middot; <Money amount={career?.typicalSalary ?? 0} />
                  </span>
                </div>
              );
            })}
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
  const markets = filmMarketBreakdown(film);
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
      {markets.total > 0 && (
        <div className="row">
          <StatTile label="Domestic" value={<Money amount={markets.domestic} />} />
          <StatTile
            label="International"
            value={markets.hasInternational ? <Money amount={markets.international} /> : 'None'}
          />
        </div>
      )}
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

/** The resolved test-screening outcome (Post-Production Redesign, Phase B) - kept in its own section/collection from on-set events, since it happened after photography had already wrapped. Absent entirely for a film released before this system existed. */
function PostProductionEventsSection({ film }: { film: Film }) {
  if (film.postProductionEvents.length === 0) return null;
  return (
    <div className="card stack">
      <h3 style={{ margin: 0 }}>Test Screening Outcome</h3>
      {film.postProductionEvents.map((event, i) => (
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
 * The franchise-viability read for a released film (engine/ipViability.ts) -
 * shown for the player's own films whether or not an IP exists yet, so the
 * player understands *why* a film is or isn't a good franchise candidate before
 * deciding to establish one. Purely a read: it never creates or touches an IP.
 * Deliberately sits above the Promote panel below it.
 */
function IpAssessmentPanel({ film }: { film: Film }) {
  const { state } = useStudio();
  const assessment = useMemo(
    () => evaluateIpViability(film, state.studio, { talentPool: state.talentPool }, state.totalDays),
    [film, state.studio, state.talentPool, state.totalDays],
  );

  return (
    <div className="card stack">
      <h3 style={{ margin: 0 }}>IP Assessment</h3>
      <div className="row" style={{ gap: 12, alignItems: 'center' }}>
        <StarRating value={assessment.overallScore} />
        <strong>{assessment.verdict}</strong>
      </div>
      <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
        <StatTile label="Inherent Potential" value={`${Math.round(assessment.inherentPotential)} / 100`} />
        <StatTile label="Current Opportunity" value={`${Math.round(assessment.currentOpportunity)} / 100`} />
      </div>
      {assessment.strengths.length > 0 && (
        <div>
          <div className="stat-label">Strengths</div>
          <ul style={{ margin: '2px 0 0', paddingLeft: 18 }}>
            {assessment.strengths.map((s) => (
              <li key={s} style={{ fontSize: '0.9em' }}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {assessment.concerns.length > 0 && (
        <div>
          <div className="stat-label">Concerns</div>
          <ul style={{ margin: '2px 0 0', paddingLeft: 18 }}>
            {assessment.concerns.map((c) => (
              <li key={c} style={{ fontSize: '0.9em' }}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Promote-to-IP panel, shown only for the player's own released films (never a
 * rival's - see the modal's own gate on releasedBy). Before promotion it lets
 * the player pick which characters to lift into a new persistent IP alongside
 * the film's setting; once promoted it becomes a read-only readout of that IP.
 * Self-contained (reads/writes the store directly) so the modal itself stays a
 * plain presentational component and nothing has to be threaded through its
 * three call sites.
 */
function FilmIpPanel({ film }: { film: Film }) {
  const { state, dispatch } = useStudio();
  const existing = ipForSourceFilm(state.studio, film.id);
  // Minor roles aren't recognisable IP - only Lead/Supporting characters are
  // offered for promotion (the setting always comes along regardless).
  const promotable = film.script.cast.filter((c) => c.prominence !== 'Minor');
  const [name, setName] = useState(film.title);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(promotable.map((c) => c.id)));

  if (existing) {
    return (
      <div className="card stack">
        <h3 style={{ margin: 0 }}>Intellectual Property</h3>
        <p style={{ margin: 0 }}>
          This film has been promoted to the IP <strong>{existing.name}</strong>.
        </p>
        <div>
          <div className="stat-label">Characters</div>
          {existing.characters.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85em' }}>Setting only — no characters were included.</p>
          ) : (
            <div className="stack" style={{ gap: 2 }}>
              {existing.characters.map((c) => (
                <div key={c.id} style={{ fontSize: '0.85em' }}>
                  <strong>{c.name}</strong> — {c.prominence} {CHARACTER_ARCHETYPE_LABELS[c.archetype]}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="stat-label">Setting: {SETTING_LABELS[existing.setting.archetype]}</div>
      </div>
    );
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="card stack">
      <h3 style={{ margin: 0 }}>Promote to Intellectual Property</h3>
      <p className="choice-description" style={{ margin: 0 }}>
        Turn this film's characters and setting into a persistent creative asset you can build future projects around later.
        Nothing about the film itself changes.
      </p>
      <label className="stack" style={{ gap: 4 }}>
        <span className="stat-label">IP name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} aria-label="IP name" />
      </label>
      <div>
        <div className="stat-label">Characters to include</div>
        {promotable.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85em' }}>
            This film has no notable characters — the IP will carry just its setting.
          </p>
        ) : (
          <div className="stack" style={{ gap: 2 }}>
            {promotable.map((c) => (
              <label key={c.id} className="row" style={{ gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                <span style={{ fontSize: '0.85em' }}>
                  <strong>{c.name}</strong> — {c.prominence} {CHARACTER_ARCHETYPE_LABELS[c.archetype]}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
      <div className="stat-label">Setting: {SETTING_LABELS[film.script.primarySetting]} (always included)</div>
      <div>
        <Button
          variant="primary"
          disabled={promotable.length > 0 && selected.size === 0}
          onClick={() => dispatch({ type: 'PROMOTE_FILM_TO_IP', filmId: film.id, characterIds: [...selected], name })}
        >
          Promote to IP
        </Button>
      </div>
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
              {film.genre} &middot; Released {formatGameDateWithMonth(film.releasedOnDay)}
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
        <PostProductionEventsSection film={film} />
        <ReceptionSection film={film} />
        <FinancialsSection film={film} />
        <ReviewsSection film={film} />
        {/* Only the player's own films get an IP assessment / promotion - a
            rival's film (releasedBy set) is never the player's to exploit. The
            assessment shows whether or not an IP exists yet, so the player can
            weigh the decision before establishing one. */}
        {film.releasedBy === undefined && (
          <>
            <IpAssessmentPanel film={film} />
            <FilmIpPanel film={film} />
          </>
        )}

        <div className="row-between">
          <span />
          <Button variant="primary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
