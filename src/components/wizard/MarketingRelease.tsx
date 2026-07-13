import { useEffect, useState } from 'react';
import { useStudio } from '../../state/StudioContext';
import { MARKETING_SPEND_RANGE, RELEASE_TYPE_PROFILES, RELEASE_WINDOW_GENRE_BONUS, RELEASE_WINDOW_DESCRIPTIONS } from '../../data/release';
import { pluckDescriptions } from '../../data/describe';
import { computeMarketingCost } from '../../engine/cost';
import { marketingDescription } from '../../engine/productionDials';
import { logAmount } from '../../engine/interpolate';
import { formatGameMonthYear, monthYearOf, totalDaysForMonth, MONTH_NAMES } from '../../engine/calendar';
import { STAGE_DURATIONS } from '../../data/schedule';
import { ChoiceGroup } from '../common/ChoiceGroup';
import { RangeSlider } from '../common/RangeSlider';
import { Button } from '../common/Button';
import { Money, formatMoney } from '../common/Money';
import { WizardHeader } from '../common/WizardHeader';
import { ScriptSummaryCard } from '../common/ScriptSummaryCard';
import { deriveFocusedDraft } from '../../state/selectors';
import type { MarketingChoices, ReleaseType, ReleaseWindow } from '../../types';

// How many calendar years out the Year dropdown below offers - a bound on
// the picker, not a real game-design limit; roadmap Phase 7.2's whole point
// is picking a date beyond the old always-immediate minimum, not an
// unbounded one.
const MAX_HOLD_YEARS = 2;

const RELEASE_TYPES = Object.keys(RELEASE_TYPE_PROFILES) as ReleaseType[];
const RELEASE_WINDOWS = Object.keys(RELEASE_WINDOW_GENRE_BONUS) as ReleaseWindow[];

const RELEASE_TYPE_DESCRIPTIONS = pluckDescriptions(RELEASE_TYPE_PROFILES);

const DEFAULT_CHOICES: MarketingChoices = {
  marketingSpend: logAmount(0.4, MARKETING_SPEND_RANGE),
  releaseType: 'Wide',
  releaseWindow: 'Quiet Month',
};

export function MarketingRelease() {
  const { state, dispatch } = useStudio();
  const draft = deriveFocusedDraft(state)!;
  const choices = draft.marketingChoices ?? DEFAULT_CHOICES;
  // The earliest day this film can actually go out - the same fixed
  // marketing-campaign lead time (data/schedule.ts) the old, always-
  // immediate RELEASE_FILM action already charged; picking exactly the
  // month that day falls in reproduces that same-day behavior exactly
  // (SCHEDULE_RELEASE's own clamp handles a month whose 1st lands before
  // this - see state/studioReducer.ts). Holding for later is the new
  // capability (roadmap Phase 7.2); the underlying day counter never
  // changes shape, only how it's presented and picked (Year/Month, not an
  // exact day - see engine/calendar.ts).
  const minReleaseDay = state.totalDays + (STAGE_DURATIONS.marketing ?? 0);
  const { year: minYear, monthIndex: minMonthIndex } = monthYearOf(minReleaseDay);
  const [year, setYear] = useState(minYear);
  const [monthIndex, setMonthIndex] = useState(minMonthIndex);
  const releaseDay = totalDaysForMonth(year, monthIndex);
  const holdMonths = (year - minYear) * 12 + (monthIndex - minMonthIndex);

  const yearOptions = Array.from({ length: MAX_HOLD_YEARS + 1 }, (_, i) => minYear + i);
  const monthOptions = MONTH_NAMES
    .map((name, i) => ({ name, i }))
    .filter(({ i }) => year > minYear || i >= minMonthIndex);

  function handleYearChange(newYear: number) {
    setYear(newYear);
    if (newYear === minYear && monthIndex < minMonthIndex) setMonthIndex(minMonthIndex);
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
  const genreBonus = draft.genre ? RELEASE_WINDOW_GENRE_BONUS[choices.releaseWindow][draft.genre] : undefined;

  return (
    <div className="stack">
      <WizardHeader current="marketing" />
      <h1>Marketing &amp; Release</h1>
      {draft.script && <ScriptSummaryCard script={draft.script} />}

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
      <ChoiceGroup
        label="Release Window"
        options={RELEASE_WINDOWS}
        value={choices.releaseWindow}
        onChange={(v) => update('releaseWindow', v)}
        descriptions={RELEASE_WINDOW_DESCRIPTIONS}
      />

      {weakMarketingWarning && (
        <p style={{ color: 'var(--red)' }}>A wide release with little marketing behind it will badly underperform.</p>
      )}
      {genreBonus && genreBonus > 1 && (
        <p style={{ color: 'var(--green)' }}>{choices.releaseWindow} is a strong window for {draft.genre} - box office bonus expected.</p>
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
        <div className="row" style={{ gap: 12 }}>
          <label className="stack" style={{ gap: 4 }}>
            <span className="stat-label">Year</span>
            <select value={year} onChange={(e) => handleYearChange(Number(e.target.value))}>
              {yearOptions.map((y) => (
                <option key={y} value={y}>Year {y}</option>
              ))}
            </select>
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="stat-label">Month</span>
            <select value={monthIndex} onChange={(e) => setMonthIndex(Number(e.target.value))}>
              {monthOptions.map(({ name, i }) => (
                <option key={i} value={i}>{name}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="choice-description">
          {holdMonths === 0
            ? 'As soon as the marketing campaign is ready - the earliest possible month.'
            : `Held ${holdMonths} month${holdMonths === 1 ? '' : 's'} past the earliest possible date - check the Dashboard's Release Calendar beforehand to see what else is coming out around then.`}
        </p>
      </div>

      <div className="row-between">
        <div className="row">
          <Button onClick={() => dispatch({ type: 'GO_TO_STEP', step: 'post-production' })}>Back</Button>
          <Button onClick={() => dispatch({ type: 'RETURN_TO_DASHBOARD' })}>Back to Dashboard</Button>
        </div>
        <Button variant="primary" onClick={() => dispatch({ type: 'SCHEDULE_RELEASE', releaseDay })}>
          {holdMonths === 0 ? 'Release Film' : `Schedule for ${formatGameMonthYear(releaseDay)}`}
        </Button>
      </div>
    </div>
  );
}
