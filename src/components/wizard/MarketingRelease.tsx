import { useEffect, useMemo, useState } from 'react';
import { useStudio } from '../../state/StudioContext';
import { MARKETING_SPEND_RANGE, RELEASE_TYPE_PROFILES, RELEASE_WINDOW_GENRE_BONUS } from '../../data/release';
import { pluckDescriptions } from '../../data/describe';
import { computeMarketingCost } from '../../engine/cost';
import { formatGameDateWithMonth, formatGameMonthYear, monthYearOf, totalDaysForMonth, deriveReleaseWindowFromDay, MONTH_NAMES } from '../../engine/calendar';
import { computeCompetitiveCrowding, type UpcomingRelease } from '../../engine/releaseCrowding';
import { asUpcomingRelease } from '../../engine/scheduledReleases';
import { rivalAsUpcomingRelease } from '../../engine/rivalStudios';
import { scheduledPlayerReleases, rivalProductionsInProgress } from '../../engine/project';
import { ChoiceGroup } from '../common/ChoiceGroup';
import { RangeSlider } from '../common/RangeSlider';
import { Button } from '../common/Button';
import { Money, formatMoney } from '../common/Money';
import { WizardHeader } from '../common/WizardHeader';
import { ScriptSummaryCard } from '../common/ScriptSummaryCard';
import { OnSetDecisionCard } from '../common/OnSetDecisionCard';
import { deriveFocusedDraft, deriveUpcomingReleaseEntries } from '../../state/selectors';
import {
  CAMPAIGN_ANGLE_LABEL,
  CAMPAIGN_ANGLE_PROFILES,
  CHANNEL_AUDIENCE_EFFICIENCY,
  MARKETING_CHANNELS,
  MARKETING_CHANNEL_BLURB,
  MARKETING_CHANNEL_LABEL,
} from '../../data/marketing';
import { totalMarketingSpend, type ChannelSpend } from '../../engine/marketing';
import { marketResearchTier, trackingBand } from '../../engine/marketResearch';
import { MARKET_RESEARCH_TIER_LABEL } from '../../data/marketResearch';
import {
  personMediaRisk,
  pressTourBuzzDelta,
  pressTourCost,
  pressTourCostForPerson,
  pressTourVolatility,
} from '../../engine/pressTour';
import { PRESS_TOUR_BAND_VOLATILITY_WIDEN } from '../../data/pressTour';
import { computeReleaseResults } from '../../engine/releaseFilm';
import { computeProducerEffects, producersByIds, totalAttachedPerFilmFees } from '../../engine/producers';
import { createRng } from '../../engine/random';
import type { CampaignAngle, MarketingChannel, MarketingChoices, PersonId, ReleaseType } from '../../types';
import './MarketingRelease.css';

// How many calendar years out the month grid below offers - a bound on the
// picker, not a real game-design limit; roadmap Phase 7.2's whole point is
// picking a date beyond the old always-immediate minimum, not an unbounded
// one.
const MAX_HOLD_YEARS = 2;

const RELEASE_TYPES = Object.keys(RELEASE_TYPE_PROFILES) as ReleaseType[];

const RELEASE_TYPE_DESCRIPTIONS = pluckDescriptions(RELEASE_TYPE_PROFILES);

// releaseWindow is a placeholder here - it's always overridden the moment a
// real release actually gets scheduled (state/studioReducer.ts:SCHEDULE_RELEASE
// derives it from the chosen day, see engine/calendar.ts:deriveReleaseWindowFromDay)
// so a stale default here can never contradict the real calendar date the
// way an independently-picked one used to.
// A modest starter split (mostly trailers) - the player reallocates from here.
const DEFAULT_CHANNEL_SPEND: ChannelSpend = { trailers: 2_000_000, tv: 0, digital: 1_000_000, press: 0 };

const DEFAULT_CHOICES: MarketingChoices = {
  channelSpend: DEFAULT_CHANNEL_SPEND,
  marketingSpend: totalMarketingSpend(DEFAULT_CHANNEL_SPEND),
  campaignAngle: 'faithful',
  releaseType: 'Wide',
  releaseWindow: 'Quiet Month',
};

// Each channel slider runs 0 (skip it) up to this.
const CHANNEL_MAX = 60_000_000;

const CAMPAIGN_ANGLES = Object.keys(CAMPAIGN_ANGLE_PROFILES) as CampaignAngle[];

const ANGLE_DESCRIPTIONS: Record<CampaignAngle, string> = {
  spectacle: 'Sell scale and effects. The biggest opening - but weak legs if the film isn’t actually a spectacle.',
  starPower: 'Sell the cast. Loud, unless your leads aren’t famous enough to carry it.',
  mystery: 'Sell intrigue. Moderate hype; punished if there’s no real suspense to back it up.',
  story: 'Sell emotion and craft. Gentle hype and the safest of the loud angles.',
  faithful: 'An honest, genre-faithful cut. No opening boost, and no risk to your legs.',
};

/** A plain-language read on how well a channel reaches this film's target audience. */
function channelFitFor(efficiency: number): { label: string; className: string } {
  if (efficiency >= 0.9) return { label: 'Great fit', className: 'channel-fit--great' };
  if (efficiency >= 0.6) return { label: 'Decent fit', className: 'channel-fit--ok' };
  return { label: 'Weak fit', className: 'channel-fit--weak' };
}

/** A plain-language read on how much of a media liability a tourer (or the whole roster) is. */
function mediaRiskReading(risk: number): { label: string; className: string } {
  if (risk < 0.33) return { label: 'Safe', className: 'media-risk--safe' };
  if (risk < 0.66) return { label: 'Some risk', className: 'media-risk--some' };
  return { label: 'Volatile', className: 'media-risk--volatile' };
}

function crowdingReading(score: number): { label: string; className: string } {
  if (score < 0.15) return { label: 'Clear window', className: 'month-cell__crowding--clear' };
  if (score < 0.4) return { label: 'Some competition', className: 'month-cell__crowding--moderate' };
  return { label: 'Crowded', className: 'month-cell__crowding--high' };
}

export function MarketingRelease() {
  const { state, dispatch } = useStudio();
  const draft = deriveFocusedDraft(state)!;
  const choices = draft.marketingChoices ?? DEFAULT_CHOICES;
  // The earliest day this film can actually go out. Post-Production
  // Redesign, Phase C (docs/DESIGN_REVIEW_post_production_redesign.md
  // section 4) - no longer a flat marketing-campaign lead time
  // (STAGE_DURATIONS.marketing, retired), but the film's own current
  // post-production completion estimate: postProductionFinalReadyDay once
  // the test screening has resolved, postProductionScreeningReadyDay
  // before that. Picking exactly the month that day falls in reproduces
  // "release the moment post-production is ready" (SCHEDULE_RELEASE's own
  // clamp handles a month whose 1st lands before this - see
  // state/studioReducer.ts). Holding for later is the existing capability
  // (roadmap Phase 7.2); the underlying day counter never changes shape,
  // only how it's presented and picked (a month grid, not an exact day -
  // see engine/calendar.ts).
  //
  // A film can't be scheduled until its (mandatory) test screening is
  // resolved - see state/studioReducer.ts:SCHEDULE_RELEASE, the
  // authoritative guard. Until then the release button is disabled and the
  // pending decision (or the date it's expected) is surfaced below.
  // A recut in progress (postProductionEditingUntilDay) pushes the earliest
  // possible release out to when it wraps - a film can't be scheduled before
  // its final cut is locked, and locking waits on the next screening.
  const postProductionEstimate = draft.postProductionEditingUntilDay ?? draft.postProductionFinalReadyDay ?? draft.postProductionScreeningReadyDay ?? state.totalDays;
  const minReleaseDay = Math.max(state.totalDays, postProductionEstimate);
  const screeningResolved = draft.testScreeningResolved;
  const pendingScreening = draft.testScreeningPendingChoice;
  const { year: minYear, monthIndex: minMonthIndex } = monthYearOf(minReleaseDay);
  const [year, setYear] = useState(minYear);
  const [monthIndex, setMonthIndex] = useState(minMonthIndex);
  const releaseDay = totalDaysForMonth(year, monthIndex);
  const holdMonths = (year - minYear) * 12 + (monthIndex - minMonthIndex);
  // The one source of truth for this release's window - see
  // engine/calendar.ts:deriveReleaseWindowFromDay's own doc comment for why
  // this can no longer be picked independently of the date.
  const releaseWindow = deriveReleaseWindowFromDay(releaseDay);

  const candidateMonths = useMemo(() => {
    const months: Array<{ year: number; monthIndex: number; releaseDay: number }> = [];
    for (let y = minYear; y <= minYear + MAX_HOLD_YEARS; y++) {
      const startMonth = y === minYear ? minMonthIndex : 0;
      for (let m = startMonth; m < 12; m++) {
        months.push({ year: y, monthIndex: m, releaseDay: totalDaysForMonth(y, m) });
      }
    }
    return months;
  }, [minYear, minMonthIndex]);

  // Every other release already on the shared calendar - the player's own
  // scheduled projects plus every rival's in-progress production, exactly
  // the same aggregation the full Release Calendar page uses
  // (state/selectors.ts:deriveUpcomingReleaseEntries), surfaced inline here
  // instead of requiring a separate page visit.
  const upcomingEntries = useMemo(
    () => deriveUpcomingReleaseEntries(state.projects, state.rivalStudios, state.studio.name),
    [state.projects, state.rivalStudios, state.studio.name],
  );
  // The same data, reduced to what computeCompetitiveCrowding needs (real
  // strength, not just a display label) - the exact converters
  // state/studioReducer.ts:SCHEDULE_RELEASE and engine/rivalStudios.ts use
  // for the real box-office penalty, so this preview can never promise a
  // clearer window than settlement actually delivers.
  const knownUpcoming = useMemo<UpcomingRelease[]>(
    () => [...scheduledPlayerReleases(state.projects).map(asUpcomingRelease), ...rivalProductionsInProgress(state.projects).map(rivalAsUpcomingRelease)],
    [state.projects],
  );

  function crowdingFor(candidateReleaseDay: number): number {
    if (!draft.genre || !draft.targetAudience) return 0;
    return computeCompetitiveCrowding({ releaseDay: candidateReleaseDay, genre: draft.genre, targetAudience: draft.targetAudience }, knownUpcoming);
  }

  function slatedCountFor(y: number, m: number): number {
    return upcomingEntries.filter((entry) => {
      const entryMonth = monthYearOf(entry.releaseDay);
      return entryMonth.year === y && entryMonth.monthIndex === m;
    }).length;
  }

  useEffect(() => {
    if (!draft.marketingChoices) {
      dispatch({ type: 'SET_MARKETING_CHOICES', choices: DEFAULT_CHOICES });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update<K extends keyof MarketingChoices>(key: K, value: MarketingChoices[K]) {
    dispatch({ type: 'SET_MARKETING_CHOICES', choices: { ...choices, [key]: value } });
  }

  const channelSpend: ChannelSpend = choices.channelSpend ?? DEFAULT_CHANNEL_SPEND;
  // Adjusting a channel keeps marketingSpend (the canonical total the cost and
  // crowding systems read) in sync with the channel breakdown.
  function updateChannel(channel: MarketingChannel, value: number) {
    const nextChannels = { ...channelSpend, [channel]: value };
    dispatch({
      type: 'SET_MARKETING_CHOICES',
      choices: { ...choices, channelSpend: nextChannels, marketingSpend: totalMarketingSpend(nextChannels) },
    });
  }

  // Press tour (docs/DESIGN_REVIEW_marketing_campaign.md): a subset of the cast
  // sent out to build Buzz. Its cash cost joins the marketing total shown here,
  // matching what releaseFilm folds into marketingCost at settlement.
  const pressTourCastIds = choices.pressTourCast ?? [];
  const tourCost = pressTourCost(draft.talent, pressTourCastIds);
  const tourBuzzDelta = pressTourBuzzDelta(draft.talent, pressTourCastIds);
  const tourVolatility = pressTourVolatility(draft.talent, pressTourCastIds);
  function toggleTourer(id: PersonId) {
    const next = pressTourCastIds.includes(id) ? pressTourCastIds.filter((x) => x !== id) : [...pressTourCastIds, id];
    update('pressTourCast', next);
  }
  // One row per assigned person, de-duped (a person holds at most one tour seat
  // even if cast in two roles - the first role is shown).
  const eligibleTourers = draft.talent.filter(
    (assignment, index) => draft.talent.findIndex((other) => other.person.id === assignment.person.id) === index,
  );

  const marketingCost = computeMarketingCost(choices) + tourCost;
  // The full marketing spend (channels + press tour) is charged when the
  // release settles, so a campaign costing more than the studio has on hand
  // would push cash negative (state/studioReducer.ts:SCHEDULE_RELEASE is the
  // authoritative guard that rejects it). Gate the Release button on it too,
  // and say why, rather than letting the player build a plan the action will
  // silently refuse.
  const canAffordMarketing = marketingCost <= state.studio.cash;
  const releaseTypeProfile = RELEASE_TYPE_PROFILES[choices.releaseType];
  const weakMarketingWarning = releaseTypeProfile.needsMarketing && choices.marketingSpend <= MARKETING_SPEND_RANGE.min * 3;
  const genreBonus = draft.genre ? RELEASE_WINDOW_GENRE_BONUS[releaseWindow][draft.genre] : undefined;
  const selectedCrowding = crowdingFor(releaseDay);
  const selectedCrowdingReading = crowdingReading(selectedCrowding);

  // A live tracking readout: what the current channel mix + campaign angle
  // project for opening weekend, computed the exact same way settlement will
  // (engine/marketSettlement.ts:resolvePlayerRelease) so the preview can never
  // promise a number release day won't deliver. Deterministic seed - this is a
  // projection the player can compare across choices, not the real jittered
  // draw. Guarded: a draft still missing a piece (or any transient bad input)
  // just hides the readout rather than throwing.
  const projectedOpening = useMemo(() => {
    if (
      !draft.script || !draft.genre || !draft.targetAudience || !draft.productionChoices ||
      !draft.photography || !draft.postProductionChoices
    ) {
      return null;
    }
    try {
      const producerPool = state.producerPool ?? [];
      const attachedIds = draft.attachedProducerIds ?? [];
      const photography = draft.photography;
      const { results } = computeReleaseResults(
        {
          title: draft.title || 'Untitled',
          genre: draft.genre,
          targetAudience: draft.targetAudience,
          script: draft.script,
          talent: draft.talent,
          productionChoices: draft.productionChoices,
          postProductionChoices: draft.postProductionChoices,
          marketingChoices: choices,
          events: photography.events,
          postProductionEvents: draft.postProductionEvents,
          photographyCost: photography.runningCost,
          shootingRatio: photography.recommendedDays > 0 ? photography.daysElapsed / photography.recommendedDays : 1,
          studioBrand: state.studio.brand,
          competitiveCrowding: selectedCrowding,
          producerEffects: computeProducerEffects(producersByIds(producerPool, attachedIds), draft.genre),
          producerFees: totalAttachedPerFilmFees(producerPool, attachedIds),
        },
        createRng(1),
      );
      return results.openingWeekend;
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, choices, selectedCrowding, state.studio.brand, state.producerPool]);

  // Tracking-as-a-service (F3): the true projection is never shown as a single
  // number - it's bracketed by a band whose width is set by the studio's Market
  // Research level (engine/marketResearch.ts). Everyone gets the wide baseline;
  // buying research in the Production Office tightens it toward the real figure.
  const researchTier = marketResearchTier(state.studio);
  // A volatile press-tour roster makes the opening genuinely harder to call, so
  // it widens the projection band on top of the research level (D1b).
  const openingBand =
    projectedOpening != null
      ? trackingBand(researchTier, projectedOpening, tourVolatility * PRESS_TOUR_BAND_VOLATILITY_WIDEN)
      : null;

  return (
    <div className="stack">
      <WizardHeader current="marketing" />
      <h1>Marketing &amp; Release</h1>
      {draft.script && <ScriptSummaryCard script={draft.script} />}

      {!screeningResolved && pendingScreening && (
        <div className="stack">
          <p className="choice-description" style={{ margin: 0, fontWeight: 600, color: 'var(--primary)' }}>
            Your test screening results are in. Respond to them before you can lock a release date.
          </p>
          <OnSetDecisionCard
            pendingChoice={pendingScreening}
            talent={draft.talent.map((a) => a.person)}
            talentPool={state.talentPool}
            script={draft.script}
            totalDays={state.totalDays}
            pausedMessage="You can't schedule a release until you respond to the test screening."
            showChoiceCosts
            onChoose={(choiceId) => dispatch({ type: 'RESOLVE_TEST_SCREENING_CHOICE', choiceId, productionId: draft.id })}
          />
        </div>
      )}

      {!screeningResolved && !pendingScreening && (
        <div className="card" style={{ borderColor: 'var(--primary)' }}>
          <div className="stat-label">
            {draft.postProductionEditingUntilDay !== null ? 'Re-cut in progress' : 'Post-Production still underway'}
          </div>
          <div className="stat-value">
            {draft.postProductionEditingUntilDay !== null ? 'Next screening around ' : 'Test screening expected around '}
            {formatGameDateWithMonth(postProductionEstimate)}
          </div>
          <p style={{ margin: '6px 0 0', fontSize: '0.85em', color: 'var(--text-muted)' }}>
            A film can't be scheduled for release until you've locked its final cut - the earliest month below moves
            with this date. Head to Post-Production to check on it, or just wait here; you'll be notified in the Inbox
            the moment the next screening is in.
          </p>
        </div>
      )}

      <div className="card stack">
        <div className="row-between">
          <h3 style={{ margin: 0 }}>Marketing Channels</h3>
          <span style={{ fontSize: '0.95em', fontWeight: 700, color: 'var(--primary)' }}>{formatMoney(choices.marketingSpend)} total</span>
        </div>
        <p className="choice-description" style={{ margin: 0 }}>
          Split your spend across channels. Each one reaches your target audience differently -
          {draft.targetAudience ? ` for a ${draft.targetAudience} film, put money where the fit is strong.` : ' pick your audience first to see how well each fits.'}
        </p>
        {MARKETING_CHANNELS.map((channel) => {
          const efficiency = draft.targetAudience ? CHANNEL_AUDIENCE_EFFICIENCY[channel][draft.targetAudience] : 1;
          const fit = channelFitFor(efficiency);
          return (
            <RangeSlider
              key={channel}
              label={MARKETING_CHANNEL_LABEL[channel]}
              min={0}
              max={CHANNEL_MAX}
              value={channelSpend[channel]}
              onChange={(v) => updateChannel(channel, v)}
              formatValue={(v) => (v <= 0 ? 'Skip' : formatMoney(v))}
              description={MARKETING_CHANNEL_BLURB[channel]}
              extra={
                draft.targetAudience ? (
                  <span className={`channel-fit ${fit.className}`}>{fit.label} for {draft.targetAudience}</span>
                ) : null
              }
            />
          );
        })}
      </div>

      <div className="card stack">
        <h3 style={{ margin: 0 }}>Campaign Angle</h3>
        <p className="choice-description" style={{ margin: 0 }}>
          How you sell the film. A louder angle opens bigger - but overselling a film that can't deliver
          burns your legs once word gets out.
        </p>
        <div className="angle-picker">
          {CAMPAIGN_ANGLES.map((angle) => (
            <Button
              key={angle}
              variant={choices.campaignAngle === angle ? 'primary' : undefined}
              onClick={() => update('campaignAngle', angle)}
            >
              {CAMPAIGN_ANGLE_LABEL[angle]}
            </Button>
          ))}
        </div>
        <p className="choice-description" style={{ margin: 0 }}>
          {ANGLE_DESCRIPTIONS[choices.campaignAngle ?? 'faithful']}
        </p>
      </div>

      <div className="card stack">
        <div className="row-between">
          <h3 style={{ margin: 0 }}>Press Tour</h3>
          {pressTourCastIds.length > 0 && (
            <span style={{ fontSize: '0.95em', fontWeight: 700, color: 'var(--primary)' }}>{formatMoney(tourCost)}</span>
          )}
        </div>
        <p className="choice-description" style={{ margin: 0 }}>
          Send cast out to build pre-release buzz. A famous name lifts buzz - but the more of a media risk they are
          (controversial, unprofessional, cracks under pressure), the less it lands, and a real loose cannon can do
          more harm than good.
        </p>
        {eligibleTourers.length === 0 ? (
          <p className="choice-description" style={{ margin: 0, color: 'var(--text-muted)' }}>Cast your film first to send anyone on tour.</p>
        ) : (
          <>
            <div className="press-tour-list">
              {eligibleTourers.map(({ person, role }) => {
                const on = pressTourCastIds.includes(person.id);
                const risk = mediaRiskReading(personMediaRisk(person));
                return (
                  <button
                    key={person.id}
                    type="button"
                    className={`press-tour-row${on ? ' press-tour-row--on' : ''}`}
                    onClick={() => toggleTourer(person.id)}
                    aria-pressed={on}
                  >
                    <span className="press-tour-check">{on ? '✓' : '+'}</span>
                    <span className="press-tour-name">
                      <strong>{person.identity.name}</strong>
                      <small>{role} · Fame {Math.round(person.reputation.fame)}</small>
                    </span>
                    <span className={`media-risk ${risk.className}`}>{risk.label}</span>
                    <span className="press-tour-cost"><Money amount={pressTourCostForPerson(person)} /></span>
                  </button>
                );
              })}
            </div>
            {pressTourCastIds.length > 0 && (
              <div className="press-tour-totals">
                <span>
                  Projected buzz{' '}
                  <strong className={tourBuzzDelta < 0 ? 'press-tour-buzz--bad' : 'press-tour-buzz--good'}>
                    {tourBuzzDelta >= 0 ? '+' : ''}{Math.round(tourBuzzDelta)}
                  </strong>
                </span>
                <span>
                  Roster risk <span className={`media-risk ${mediaRiskReading(tourVolatility).className}`}>{mediaRiskReading(tourVolatility).label}</span>
                </span>
              </div>
            )}
          </>
        )}
      </div>

      <ChoiceGroup
        label="Release Type"
        options={RELEASE_TYPES}
        value={choices.releaseType}
        onChange={(v) => update('releaseType', v)}
        descriptions={RELEASE_TYPE_DESCRIPTIONS}
      />

      {weakMarketingWarning && (
        <p style={{ color: 'var(--red)' }}>A wide release with little marketing behind it will badly underperform.</p>
      )}

      <div className="card cost-projection">
        <div>
          <div className="stat-label">Marketing Cost</div>
          <div className="stat-value"><Money amount={marketingCost} /></div>
          {!canAffordMarketing && (
            <div className="tracking-note" style={{ color: 'var(--red)' }}>
              Over budget - you have <Money amount={state.studio.cash} />. Lower your channel spend to release.
            </div>
          )}
        </div>
        {openingBand != null && (
          <div>
            <div className="stat-label">Projected Opening Weekend</div>
            <div className="stat-value">
              <Money amount={openingBand.low} /> – <Money amount={openingBand.high} />
            </div>
            <div className="tracking-note">
              {researchTier === 0
                ? `${MARKET_RESEARCH_TIER_LABEL[0]} (±${Math.round(openingBand.fraction * 100)}%) — buy Market Research in the Production Office to tighten this.`
                : `${MARKET_RESEARCH_TIER_LABEL[researchTier]} (±${Math.round(openingBand.fraction * 100)}%)`}
              {tourVolatility > 0.05 && ' · widened by press-tour risk'}
            </div>
          </div>
        )}
      </div>

      <div className="card stack">
        <div className="row-between">
          <h3 style={{ margin: 0 }}>Release Date</h3>
          <span style={{ fontSize: '0.95em', fontWeight: 700, color: 'var(--primary)' }}>{formatGameMonthYear(releaseDay)}</span>
        </div>

        <p className="choice-description" style={{ margin: 0 }}>
          Release Window is set automatically from the month you pick below - {releaseWindow}
          {genreBonus && genreBonus > 1 ? `, a strong window for ${draft.genre}` : ''}. The competitive picture can
          still shift before this date actually arrives - other studios can schedule into it in the meantime.
        </p>

        <div className="month-grid">
          {candidateMonths.map(({ year: y, monthIndex: m, releaseDay: candidateDay }) => {
            const window = deriveReleaseWindowFromDay(candidateDay);
            const bonus = draft.genre ? RELEASE_WINDOW_GENRE_BONUS[window][draft.genre] : undefined;
            const crowding = crowdingFor(candidateDay);
            const reading = crowdingReading(crowding);
            const slated = slatedCountFor(y, m);
            const isSelected = y === year && m === monthIndex;
            return (
              <button
                key={`${y}-${m}`}
                type="button"
                className={`month-cell${isSelected ? ' month-cell--selected' : ''}`}
                onClick={() => {
                  setYear(y);
                  setMonthIndex(m);
                }}
              >
                <strong className="month-cell__label">{MONTH_NAMES[m]} Year {y}</strong>
                <span className="month-cell__window">
                  {window}
                  {bonus && bonus > 1 ? ' ★' : ''}
                </span>
                <span className={`month-cell__crowding ${reading.className}`}>{reading.label}</span>
                {slated > 0 && (
                  <span className="month-cell__slated">{slated} other release{slated === 1 ? '' : 's'}</span>
                )}
              </button>
            );
          })}
        </div>

        <p className="choice-description" style={{ margin: 0 }}>
          {holdMonths === 0
            ? 'As soon as post-production is ready - the earliest possible month.'
            : `Held ${holdMonths} month${holdMonths === 1 ? '' : 's'} past the earliest possible date.`}{' '}
          <span className={selectedCrowdingReading.className}>{selectedCrowdingReading.label}</span> for this exact date.
        </p>
      </div>

      {/* A disabled <button>'s `title` tooltip doesn't surface in most
          browsers (disabled elements swallow pointer events), so the reason the
          Release button is locked has to be said in visible copy right next to
          it - not only in the card higher up the page. The blocker is always
          the test screening, never the release month (which always has a
          valid default selected). */}
      {!screeningResolved && (
        <p className="choice-description" style={{ margin: 0, color: 'var(--text-muted)' }}>
          Your release month is set below. You can schedule the release once the mandatory test screening is in and
          you've responded to it{pendingScreening
            ? ' - respond to the results above to unlock it.'
            : ` - expected around ${formatGameDateWithMonth(postProductionEstimate)}. You'll be notified in the Inbox the moment it's ready.`}
        </p>
      )}

      <div className="row-between">
        <Button onClick={() => dispatch({ type: 'GO_TO_STEP', step: 'post-production' })}>Back</Button>
        <Button
          variant="primary"
          disabled={!screeningResolved || !canAffordMarketing}
          title={
            !screeningResolved
              ? 'Respond to the test screening before scheduling a release.'
              : !canAffordMarketing
                ? "Your marketing campaign costs more than the studio's cash on hand."
                : undefined
          }
          onClick={() => dispatch({ type: 'SCHEDULE_RELEASE', releaseDay })}
        >
          {holdMonths === 0 ? 'Release Film' : `Schedule for ${formatGameMonthYear(releaseDay)}`}
        </Button>
      </div>
    </div>
  );
}
