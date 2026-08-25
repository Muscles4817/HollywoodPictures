import { useMemo, useState } from 'react';
import { useStudio } from '../../state/StudioContext';
import { deriveFocusedDraft, deriveGreenlightCommitment, deriveKnownCalendar } from '../../state/selectors';
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
import { describeCrowdingBand, type UpcomingRelease } from '../../engine/releaseCrowding';
import { estimateDelivery } from '../../engine/deliveryEstimate';
import {
  describeCampaignRunwayBand,
  describeDeliveryVerdict,
  describeReleaseDateConcern,
  describeSeason,
  describeSeasonBand,
  earliestUnrushedDay,
  readReleaseDate,
  type ReleaseDateReading,
} from '../../engine/releaseDateReading';
import { announcedAsUpcomingRelease } from '../../engine/scheduledReleases';
import { genreIdentityFor } from '../../engine/studioIdentity';
import { formatGameDateWithMonth, formatGameMonthYear, monthYearOf, totalDaysForMonth } from '../../engine/calendar';
import { describeCampaignWriteOff } from '../../engine/campaignCommitment';
import { MARKETING_SPEND_RANGE } from '../../data/release';
import type { ProjectWorkspaceSection } from '../../types';

const AUDIENCE_DESCRIPTIONS = pluckDescriptions(AUDIENCE_PROFILES);

/** A few campaign sizes to book against a date, spanning the marketing range. */
const CAMPAIGN_STEPS = [
  Math.round(MARKETING_SPEND_RANGE.min * 4),
  Math.round(MARKETING_SPEND_RANGE.max * 0.1),
  Math.round(MARKETING_SPEND_RANGE.max * 0.35),
  Math.round(MARKETING_SPEND_RANGE.max * 0.7),
];

/** How many months the announcement grid offers at minimum, and how far past a comfortable date it always reaches. */
const MIN_ANNOUNCEMENT_MONTHS = 18;
const MONTHS_OFFERED_PAST_READY = 12;

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
 * decide whether to steer around it.
 *
 * Every reading shown here - whether the film can be finished by a date, what
 * runway the campaign gets, what the season is worth to this genre, and who else
 * is opening - is the same computation settlement will use
 * (engine/releaseDateReading.ts), including this film's own strength in the
 * crowding matchup. So a date can never look better here than it turns out to be.
 */
function ReleaseAnnouncementCard() {
  const { state, dispatch } = useStudio();
  const draft = deriveFocusedDraft(state)!;

  // Locked releases, rivals in production, and the player's own OTHER
  // announcements - never this film against itself. Shared with the Marketing &
  // Release screen (state/selectors.ts:deriveKnownCalendar) so the two screens
  // that pick a date read the same calendar.
  const known = useMemo<UpcomingRelease[]>(
    () => deriveKnownCalendar(state.projects, state.studio.genreIdentity ?? {}, draft.id),
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

  // When this film is projected to actually exist. Computed once for the whole
  // grid: it does not depend on which month is being considered, so running the
  // production projection once per cell would be the same answer many times over.
  const delivery = useMemo(() => estimateDelivery(draft, state.totalDays), [draft, state.totalDays]);
  const unrushedFrom = earliestUnrushedDay(delivery.readyOnDay);

  // Months from next month on - a claim on a past or current month is not a
  // claim anyone can believe.
  //
  // Eighteen months normally, but always far enough to clear the film's own
  // schedule with room to spare: an effects-led epic can need most of two years
  // between here and a finished print, and a grid whose every cell was struck
  // through as unreachable would offer the player no real choice at all.
  const months = useMemo(() => {
    const { year, monthIndex } = monthYearOf(state.totalDays);
    const monthsToClear =
      (monthYearOf(unrushedFrom).year - year) * 12 + (monthYearOf(unrushedFrom).monthIndex - monthIndex);
    const count = Math.max(MIN_ANNOUNCEMENT_MONTHS, monthsToClear + MONTHS_OFFERED_PAST_READY);
    return Array.from({ length: count }, (_, i) => {
      const m = (monthIndex + 1 + i) % 12;
      const y = year + Math.floor((monthIndex + 1 + i) / 12);
      return { year: y, monthIndex: m, day: totalDaysForMonth(y, m) };
    });
  }, [state.totalDays, unrushedFrom]);

  const announced = draft.announcedReleaseDay;
  const commitment = draft.campaignCommitment;
  // What moving would cost right now - shown BEFORE the player picks another
  // month, not after, since that price is the whole decision (Principle 3).
  const writeOffNote = describeCampaignWriteOff(commitment, state.totalDays);

  // Every candidate month read across all four axes that should decide the
  // choice - can the film be finished, does the campaign get runway, is the
  // season any good for this genre, and who else is opening
  // (engine/releaseDateReading.ts). The grid previously showed only the last of
  // these, which is how a date two months out for an unstarted production could
  // look like a perfectly reasonable claim.
  const readingFor = (day: number): ReleaseDateReading | null =>
    draft.genre && draft.targetAudience
      ? readReleaseDate(
          day,
          delivery,
          draft.genre,
          { genre: draft.genre, targetAudience: draft.targetAudience },
          known,
          ownStrength,
        )
      : null;

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

      {/* The two dates every claim should be measured against, stated before the
          grid rather than discovered after it. Without these the grid offered
          eighteen months and said nothing about which of them the film could
          actually make. */}
      <div className="date-reading">
        <div className="date-reading__row">
          <span className="stat-label">Projected finished</span>
          <strong>{formatGameDateWithMonth(delivery.readyOnDay)}</strong>
        </div>
        <div className="date-reading__row">
          <span className="stat-label">Earliest date with a full campaign</span>
          <strong>{formatGameDateWithMonth(unrushedFrom)}</strong>
        </div>
        {delivery.remaining.length > 0 && (
          <p className="date-reading__note">
            Still ahead: {delivery.remaining.map((step) => `${step.label} (${step.days} days)`).join(' · ')}.
            {delivery.provisional ? ' Projected against an assumed production plan — the shoot has not been planned yet.' : ''}
          </p>
        )}
      </div>

      {announced !== undefined ? (
        <div className="stack" style={{ gap: 4 }}>
          <div className="row-between">
            <span>
              Announced for <strong>{formatGameMonthYear(announced)}</strong>
            </span>
            <Button className="btn-sm" onClick={() => dispatch({ type: 'ANNOUNCE_RELEASE_DATE', releaseDay: null })}>
              Withdraw
            </Button>
          </div>
          {(() => {
            const reading = readingFor(announced);
            if (!reading || !draft.genre) return null;
            const concern = describeReleaseDateConcern(reading, draft.genre);
            return (
              <div className="date-reading">
                <div className="date-reading__row">
                  <span className="stat-label">Can the film make it</span>
                  <strong className={reading.delivery === 'impossible' ? 'release-date-reading--bad' : undefined}>
                    {describeDeliveryVerdict(reading.delivery)}
                  </strong>
                </div>
                <div className="date-reading__row">
                  <span className="stat-label">Campaign runway</span>
                  <strong>{describeCampaignRunwayBand(reading.runway)}</strong>
                </div>
                <div className="date-reading__row">
                  <span className="stat-label">Season</span>
                  <strong>{describeSeasonBand(reading.season)}</strong>
                </div>
                <div className="date-reading__row">
                  <span className="stat-label">The field</span>
                  <strong>{describeCrowdingBand(reading.crowding)}</strong>
                </div>
                <p className="date-reading__note">{describeSeason(announced, draft.genre)}.</p>
                {concern && <p className="date-reading__note date-reading__note--bad">{concern}</p>}
              </div>
            );
          })()}
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: '0.85em' }}>
          No date announced. The film keeps full flexibility and takes whatever the calendar leaves it.
        </p>
      )}

      {announced !== undefined && (
        <div className="stack" style={{ gap: 6, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          {/* Same reading block as the readings above it - it is the same kind of
              label/value pair, and left as a .row-between it was the one row
              still wrapping into a floating value on a phone. */}
          <div className="date-reading">
            <div className="date-reading__row">
              <span className="stat-label">Campaign committed against this date</span>
              <strong>{commitment ? <Money amount={commitment.amount} /> : 'None'}</strong>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: '0.8em', color: 'var(--text-muted)' }}>
            Booking a campaign costs nothing now — media is paid close to air — but it is what makes the
            claim read as funded rather than as a bare date, and rivals weigh it accordingly.
            {writeOffNote ? ` ${writeOffNote}` : ''}
          </p>
          {commitment?.writtenOff ? (
            <p style={{ margin: 0, fontSize: '0.8em', color: 'var(--tint-red-ink)' }}>
              Moving this film has already written off <Money amount={commitment.writtenOff} />.
            </p>
          ) : null}
          <div className="row" style={{ gap: 6 }}>
            {CAMPAIGN_STEPS.map((amount) => (
              <Button
                key={amount}
                className="btn-sm"
                variant={commitment?.amount === amount ? 'primary' : undefined}
                onClick={() => dispatch({ type: 'COMMIT_CAMPAIGN', amount })}
              >
                <Money amount={amount} />
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="release-month-grid">
        {months.map((m) => {
          const reading = readingFor(m.day);
          const isAnnounced = announced !== undefined && monthYearOf(announced).monthIndex === m.monthIndex && monthYearOf(announced).year === m.year;
          // A month the film cannot be finished by is still CLICKABLE - studios
          // announce dates they miss, and that is the whole premise of the
          // feature (section 9.1). It is marked, not forbidden.
          const unreachable = reading?.delivery === 'impossible';
          return (
            <button
              key={`${m.year}-${m.monthIndex}`}
              type="button"
              className={
                `release-month-cell${isAnnounced ? ' release-month-cell--claimed' : ''}` +
                `${unreachable ? ' release-month-cell--unreachable' : ''}`
              }
              onClick={() => dispatch({ type: 'ANNOUNCE_RELEASE_DATE', releaseDay: m.day })}
              title={reading && draft.genre ? (describeReleaseDateConcern(reading, draft.genre) ?? describeSeason(m.day, draft.genre)) : undefined}
            >
              <span className="release-month-cell__label">{formatGameMonthYear(m.day)}</span>
              {reading && (
                <>
                  <span className={`release-month-cell__delivery release-month-cell__delivery--${reading.delivery}`}>
                    {unreachable
                      ? 'Not finished'
                      : reading.runway === 'none' || reading.runway === 'rushed'
                        ? 'No campaign time'
                        : describeDeliveryVerdict(reading.delivery)}
                  </span>
                  {/* On a month the film cannot make, everything below the
                      verdict is moot - so the band colours are dropped rather
                      than painted over, and a struck-through cell stops
                      advertising a prime season in green. Expressed in the
                      markup, not as a CSS descendant override, so the intent is
                      visible where the decision is made. */}
                  <span className={`release-month-cell__season${unreachable ? '' : ` release-month-cell__season--${reading.season}`}`}>
                    {describeSeasonBand(reading.season)}
                  </span>
                  <span className={`release-month-cell__crowding${unreachable ? '' : ` release-month-cell__crowding--${reading.crowdingBand}`}`}>
                    {describeCrowdingBand(reading.crowding)}
                  </span>
                </>
              )}
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
