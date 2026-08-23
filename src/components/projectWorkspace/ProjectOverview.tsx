import { useMemo, useState } from 'react';
import { useStudio } from '../../state/StudioContext';
import { deriveFocusedDraft, deriveGreenlightCommitment } from '../../state/selectors';
import { deriveProjectReadiness } from '../../engine/projectReadiness';
import { TARGET_AUDIENCES, AUDIENCE_PROFILES } from '../../data/audiences';
import { pluckDescriptions } from '../../data/describe';
import { synthesizeProductionIdentity } from '../../engine/productionIdentity';
import { explainEffectsStrategy, explainEnvironmentStrategy } from '../../engine/recommendation';
import { findAssignedPerson } from '../../data/helpers';
import { getDirectorCareer } from '../../engine/person';
import { ChoiceGroup } from '../common/ChoiceGroup';
import { Button } from '../common/Button';
import { Money } from '../common/Money';
import { ScriptDetails } from '../common/ScriptDetails';
import { GreenlightConfirmation } from './GreenlightConfirmation';
import { describeCreativeDemand, describeDemandCompetence, describeDirectorPatience } from '../../engine/creativeDemands';
import { computeRelationship, NO_RELATIONSHIP, PLAYER_STUDIO_ID } from '../../engine/relationships';
import type { DevelopmentReadinessBand } from '../../engine/projectReadiness';
import { computeCompetitiveCrowding, crowdingBandKey, describeCrowdingBand, type UpcomingRelease } from '../../engine/releaseCrowding';
import { announcedAsUpcomingRelease, asUpcomingRelease } from '../../engine/scheduledReleases';
import { announcedPlayerDrafts, rivalProductionsInProgress, scheduledPlayerReleases } from '../../engine/project';
import { rivalAsUpcomingRelease } from '../../engine/rivalStudios';
import { genreIdentityFor } from '../../engine/studioIdentity';
import { formatGameDateWithMonth, formatGameMonthYear, monthYearOf, totalDaysForMonth } from '../../engine/calendar';
import type { ProjectWorkspaceSection } from '../../types';

const AUDIENCE_DESCRIPTIONS = pluckDescriptions(AUDIENCE_PROFILES);

const SECTION_LABELS: Record<ProjectWorkspaceSection, string> = {
  overview: 'Overview',
  'cast-and-crew': 'Cast & Crew',
  production: 'Production',
  producers: 'Producers',
  finance: 'Finance',
};

// The qualitative development-phase gauge (engine/projectReadiness.ts:DevelopmentReadinessBand).
const BAND_LABELS: Record<DevelopmentReadinessBand, string> = {
  stalled: 'Stalled',
  warming: 'Warming up',
  packaged: 'Packaged - financing outstanding',
  greenlightable: 'Ready to greenlight',
};

/**
 * The Producer Workspace's landing page (PRODUCER_WORKSPACE_DESIGN.md) -
 * film identity (absorbed from the retired DevelopFilm.tsx), a production
 * vision summary once a director's hired, a financial summary, and the
 * single readiness panel that drives the Greenlight button. Everything here
 * reads engine/projectReadiness.ts and state/selectors.ts's
 * deriveGreenlightCommitment rather than computing its own version of
 * either, so this page can never disagree with the workspace nav's status
 * indicators or the Finance tab's own numbers.
 */
/**
 * Claiming a release date, well before the film exists (section 9 of
 * docs/DESIGN_REVIEW_project_clocks_and_script_openness.md).
 *
 * This is an ANNOUNCEMENT, not a booking. Nothing stops a rival opening the same
 * day; what the claim does is put the date where they can see it, so they can
 * decide whether to steer around it. The crowding reading shown here is the same
 * computation settlement will use, including this film's own strength in the
 * matchup, so a window can never look clearer here than it turns out to be.
 */
function ReleaseAnnouncementCard() {
  const { state, dispatch } = useStudio();
  const draft = deriveFocusedDraft(state)!;

  const known = useMemo<UpcomingRelease[]>(
    () => [
      ...scheduledPlayerReleases(state.projects).map(asUpcomingRelease),
      ...rivalProductionsInProgress(state.projects).map(rivalAsUpcomingRelease),
      // Other announcements of the player's own crowd this one too - but never
      // this film against itself.
      ...announcedPlayerDrafts(state.projects)
        .filter((d) => d.id !== draft.id)
        .map((d) => announcedAsUpcomingRelease(d, d.genre ? genreIdentityFor(state.studio.genreIdentity, d.genre) : 0))
        .filter((u): u is UpcomingRelease => u !== null),
    ],
    [state.projects, state.studio.genreIdentity, draft.id],
  );

  // This film's own strength in the matchup. It must never be undefined: that
  // falls back to matchupWeight's candidate-blind weight of 1, while settlement
  // uses the real matchup - and since a weak film feels MORE than neutral
  // crowding, the grid would read "Some competition" for a day that settles as
  // "Crowded". Reading it off the same announced-release conversion rivals see
  // keeps the card and the settlement in step, including before the project is
  // planned (see announcedReleaseStrength).
  const ownStrength = useMemo(() => {
    if (!draft.genre) return undefined;
    const identity = genreIdentityFor(state.studio.genreIdentity, draft.genre);
    // Read against a placeholder day so a project that has not announced yet
    // still gets a strength - the reading is independent of the day.
    const asUpcoming = announcedAsUpcomingRelease({ ...draft, announcedReleaseDay: draft.announcedReleaseDay ?? 1 }, identity);
    return asUpcoming?.strength;
  }, [draft, state.studio.genreIdentity]);

  // A year of months from next month on - a claim on a past or current month is
  // not a claim anyone can believe.
  const months = useMemo(() => {
    const { year, monthIndex } = monthYearOf(state.totalDays);
    return Array.from({ length: 18 }, (_, i) => {
      const m = (monthIndex + 1 + i) % 12;
      const y = year + Math.floor((monthIndex + 1 + i) / 12);
      return { year: y, monthIndex: m, day: totalDaysForMonth(y, m) };
    });
  }, [state.totalDays]);

  const announced = draft.announcedReleaseDay;
  const crowdingFor = (day: number) =>
    draft.genre && draft.targetAudience
      ? computeCompetitiveCrowding({ releaseDay: day, genre: draft.genre, targetAudience: draft.targetAudience }, known, ownStrength)
      : 0;

  return (
    <div className="card stack">
      <h3 style={{ margin: 0 }}>Release Date</h3>
      <p style={{ margin: 0, fontSize: '0.85em', color: 'var(--text-muted)' }}>
        Announcing a date stakes a public claim on it. It reserves nothing — a rival can still open
        against you — but it puts the date where they can see it, and the stronger your picture looks,
        the more likely they are to move.
      </p>

      {draft.committedStartDay !== undefined && (
        <p style={{ margin: 0, fontSize: '0.85em' }}>
          Photography committed to begin <strong>{formatGameDateWithMonth(draft.committedStartDay)}</strong>
          {announced !== undefined && (
            <> — <strong>{Math.max(0, announced - draft.committedStartDay)}</strong> days between the camera rolling and the date you have claimed.</>
          )}
        </p>
      )}

      {announced !== undefined ? (
        <div className="row-between">
          <span>
            Announced for <strong>{formatGameMonthYear(announced)}</strong> ·{' '}
            <span style={{ color: 'var(--text-muted)' }}>{describeCrowdingBand(crowdingFor(announced))}</span>
          </span>
          <Button className="btn-sm" onClick={() => dispatch({ type: 'ANNOUNCE_RELEASE_DATE', releaseDay: null })}>
            Withdraw
          </Button>
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: '0.85em' }}>
          No date announced. The film keeps full flexibility and takes whatever the calendar leaves it.
        </p>
      )}

      <div className="release-month-grid">
        {months.map((m) => {
          const crowding = crowdingFor(m.day);
          const isAnnounced = announced !== undefined && monthYearOf(announced).monthIndex === m.monthIndex && monthYearOf(announced).year === m.year;
          return (
            <button
              key={`${m.year}-${m.monthIndex}`}
              type="button"
              className={`release-month-cell${isAnnounced ? ' release-month-cell--claimed' : ''}`}
              onClick={() => dispatch({ type: 'ANNOUNCE_RELEASE_DATE', releaseDay: m.day })}
            >
              <span className="release-month-cell__label">{formatGameMonthYear(m.day)}</span>
              <span className={`release-month-cell__crowding release-month-cell__crowding--${crowdingBandKey(crowding)}`}>
                {describeCrowdingBand(crowding)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ProjectOverview() {
  const { state, dispatch } = useStudio();
  const draft = deriveFocusedDraft(state)!;
  const script = draft.script!;
  const [confirming, setConfirming] = useState(false);

  const readiness = deriveProjectReadiness(draft, state.studio.cash);
  const commitment = deriveGreenlightCommitment(draft, state.studio.cash);
  const daysInDevelopment = draft.development ? state.totalDays - draft.development.startedOnDay : null;

  const director = findAssignedPerson(draft.talent, 'Director');
  const directorCareer = director && getDirectorCareer(director);
  // Director creative demands (Phase 2b) - shown only while still in development.
  const relationship = director ? computeRelationship(state.collaborations ?? [], PLAYER_STUDIO_ID, director.id) : NO_RELATIONSHIP;
  const pendingDemands = (draft.development?.demands ?? []).filter((d) => !d.resolution);
  const patience = director ? describeDirectorPatience(draft.development?.demands, director, relationship) : null;
  const identity =
    directorCareer && script
      ? synthesizeProductionIdentity(script, explainEnvironmentStrategy(script, directorCareer), explainEffectsStrategy(script, directorCareer))
      : null;

  return (
    <div className="stack">
      {confirming && <GreenlightConfirmation onClose={() => setConfirming(false)} />}

      <div className="card stack">
        <h3 style={{ margin: 0 }}>Title</h3>
        <input
          type="text"
          placeholder="Working title..."
          value={draft.title}
          onChange={(e) => dispatch({ type: 'SET_TITLE', title: e.target.value })}
          style={{ maxWidth: 360 }}
        />
      </div>

      <ReleaseAnnouncementCard />

      <div className="card stack">
        <div className="card-title">{script.title}</div>
        <ScriptDetails script={script} />
      </div>

      <ChoiceGroup
        label="Target Audience"
        options={TARGET_AUDIENCES}
        value={draft.targetAudience}
        onChange={(targetAudience) => dispatch({ type: 'SET_TARGET_AUDIENCE', targetAudience })}
        descriptions={AUDIENCE_DESCRIPTIONS}
        hint={`Pre-filled from "${script.title}"'s intended audience - change it if you'd rather position the film differently.`}
      />

      <div className="card stack">
        <h3 style={{ margin: 0 }}>Production Vision</h3>
        <p className="production-identity" style={{ margin: 0 }}>
          {identity ?? 'Hire a director (Cast & Crew tab) to see how this production is taking shape.'}
        </p>
      </div>

      <div className="card stack">
        <h3 style={{ margin: 0 }}>Financial Summary</h3>
        <div className="row-between"><span>Total Commitment</span><Money amount={commitment.totalCommitment} /></div>
        <div className="row-between" style={{ fontWeight: 600 }}>
          <span>Studio Cash (after Greenlight)</span>
          <Money amount={commitment.cashAfter} signColor />
        </div>
      </div>

      {director && pendingDemands.length > 0 && (
        <div className="card stack">
          <h3 style={{ margin: 0 }}>Director's Creative Demands</h3>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            {director.identity.name} wants control over parts of the film. Cede a craft they command and it lifts the
            picture; cede one they're weak at and it can drag it down. Settle each before greenlighting.
          </p>
          {patience && patience.band !== 'content' && (
            <p style={{ margin: 0, color: patience.band === 'on-the-brink' ? 'var(--red)' : 'var(--amber, var(--text-muted))' }}>
              {patience.text}
            </p>
          )}
          {pendingDemands.map((demand) => {
            const read = describeDemandCompetence(director, demand, relationship);
            return (
              <div key={demand.id} className="card stack" style={{ gap: 6 }}>
                <div style={{ fontWeight: 600 }}>{describeCreativeDemand(demand)}</div>
                <div style={{ color: 'var(--text-muted)' }}>{read.text}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button onClick={() => dispatch({ type: 'RESOLVE_CREATIVE_DEMAND', demandId: demand.id, accept: true })}>
                    Give them control
                  </Button>
                  <Button onClick={() => dispatch({ type: 'RESOLVE_CREATIVE_DEMAND', demandId: demand.id, accept: false })}>
                    Keep control
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card stack">
        <h3 style={{ margin: 0 }}>Greenlight Readiness</h3>
        <div className="row-between">
          <span style={{ fontWeight: 600 }}>{BAND_LABELS[readiness.band]}</span>
          {daysInDevelopment !== null && (
            <span style={{ color: 'var(--text-muted)' }}>
              In development {daysInDevelopment} {daysInDevelopment === 1 ? 'day' : 'days'}
            </span>
          )}
        </div>
        {readiness.ready ? (
          <p style={{ margin: 0, color: 'var(--green)' }}>Everything's in place - ready to greenlight.</p>
        ) : (
          <ul className="recommendation-reasons">
            {readiness.blockers.map((b) => (
              <li key={b.code} style={{ color: 'var(--red)' }}>{b.message}</li>
            ))}
          </ul>
        )}
        {readiness.warnings.length > 0 && (
          <ul className="recommendation-reasons">
            {readiness.warnings.map((w) => (
              <li key={w.code}>{w.message}</li>
            ))}
          </ul>
        )}
        {!readiness.ready && readiness.recommendedNextSection && (
          <Button onClick={() => dispatch({ type: 'OPEN_PROJECT_WORKSPACE_SECTION', section: readiness.recommendedNextSection! })}>
            Go to {SECTION_LABELS[readiness.recommendedNextSection]}
          </Button>
        )}
      </div>

      <div className="row-between">
        <span />
        <Button variant="primary" disabled={!readiness.ready} onClick={() => setConfirming(true)}>
          Greenlight
        </Button>
      </div>
    </div>
  );
}
