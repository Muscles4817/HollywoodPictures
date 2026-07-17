import { useEffect, useMemo, useState } from 'react';
import { useStudio } from '../../state/StudioContext';
import { MARKETING_SPEND_RANGE, RELEASE_TYPE_PROFILES, RELEASE_WINDOW_GENRE_BONUS } from '../../data/release';
import { pluckDescriptions } from '../../data/describe';
import { computeMarketingCost } from '../../engine/cost';
import { marketingDescription } from '../../engine/productionDials';
import { logAmount } from '../../engine/interpolate';
import { formatGameDate, formatGameMonthYear, monthYearOf, totalDaysForMonth, deriveReleaseWindowFromDay, MONTH_NAMES } from '../../engine/calendar';
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
import { deriveFocusedDraft, deriveUpcomingReleaseEntries } from '../../state/selectors';
import type { MarketingChoices, ReleaseType } from '../../types';
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
const DEFAULT_CHOICES: MarketingChoices = {
  marketingSpend: logAmount(0.4, MARKETING_SPEND_RANGE),
  releaseType: 'Wide',
  releaseWindow: 'Quiet Month',
};

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
  const postProductionEstimate = draft.postProductionFinalReadyDay ?? draft.postProductionScreeningReadyDay ?? state.totalDays;
  const minReleaseDay = Math.max(state.totalDays, postProductionEstimate);
  const screeningPending = !!draft.testScreeningPendingChoice;
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

  const marketingCost = computeMarketingCost(choices);
  const releaseTypeProfile = RELEASE_TYPE_PROFILES[choices.releaseType];
  const weakMarketingWarning = releaseTypeProfile.needsMarketing && choices.marketingSpend <= MARKETING_SPEND_RANGE.min * 3;
  const genreBonus = draft.genre ? RELEASE_WINDOW_GENRE_BONUS[releaseWindow][draft.genre] : undefined;
  const selectedCrowding = crowdingFor(releaseDay);
  const selectedCrowdingReading = crowdingReading(selectedCrowding);

  return (
    <div className="stack">
      <WizardHeader current="marketing" />
      <h1>Marketing &amp; Release</h1>
      {draft.script && <ScriptSummaryCard script={draft.script} />}

      {screeningPending && (
        <div className="card" style={{ borderColor: 'var(--red)' }}>
          <div className="stat-label">Decision needed</div>
          <p style={{ margin: '4px 0 0' }}>
            A test screening is awaiting your response. Release scheduling is on hold until it's resolved.
          </p>
          <Button
            variant="primary"
            style={{ marginTop: 8 }}
            onClick={() => dispatch({ type: 'GO_TO_STEP', step: 'post-production' })}
          >
            Go to Post-Production
          </Button>
        </div>
      )}

      <div className="card">
        <div className="stat-label">Post-Production</div>
        <div className="stat-value">
          {draft.testScreeningResolved ? 'Wraps' : 'Ready for screening'} around {formatGameDate(postProductionEstimate)}
        </div>
        <p style={{ margin: '6px 0 0', fontSize: '0.85em', color: 'var(--text-muted)' }}>
          This is the earliest this film can go out - a Test Screening choice that adds delay pushes it back, and
          moves the earliest month below along with it.
        </p>
      </div>

      <RangeSlider
        label="Marketing Spend"
        min={MARKETING_SPEND_RANGE.min}
        max={MARKETING_SPEND_RANGE.max}
        logScale
        value={choices.marketingSpend}
        onChange={(v) => update('marketingSpend', v)}
        formatValue={formatMoney}
        description={marketingDescription(choices.marketingSpend)}
        lowLabel="Word of Mouth"
        highLabel="Global Blitz"
      />
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

      <div className="card">
        <div className="stat-label">Marketing Cost</div>
        <div className="stat-value"><Money amount={marketingCost} /></div>
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

      <div className="row-between">
        <Button onClick={() => dispatch({ type: 'GO_TO_STEP', step: 'post-production' })}>Back</Button>
        <Button variant="primary" disabled={screeningPending} onClick={() => dispatch({ type: 'SCHEDULE_RELEASE', releaseDay })}>
          {holdMonths === 0 ? 'Release Film' : `Schedule for ${formatGameMonthYear(releaseDay)}`}
        </Button>
      </div>
    </div>
  );
}
