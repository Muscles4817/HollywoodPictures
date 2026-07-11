import { useEffect } from 'react';
import { useStudio } from '../../state/StudioContext';
import { MARKETING_SPEND_RANGE, RELEASE_TYPE_PROFILES, RELEASE_WINDOW_GENRE_BONUS, RELEASE_WINDOW_DESCRIPTIONS } from '../../data/release';
import { pluckDescriptions } from '../../data/describe';
import { computeMarketingCost } from '../../engine/cost';
import { marketingDescription } from '../../engine/productionDials';
import { logAmount } from '../../engine/interpolate';
import { ChoiceGroup } from '../common/ChoiceGroup';
import { RangeSlider } from '../common/RangeSlider';
import { Button } from '../common/Button';
import { Money, formatMoney } from '../common/Money';
import { WizardHeader } from '../common/WizardHeader';
import type { MarketingChoices, ReleaseType, ReleaseWindow } from '../../types';

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
  const draft = state.draft!;
  const choices = draft.marketingChoices ?? DEFAULT_CHOICES;

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

      <div className="row-between">
        <div className="row">
          <Button onClick={() => dispatch({ type: 'GO_TO_STEP', step: 'post-production' })}>Back</Button>
          <Button onClick={() => dispatch({ type: 'RETURN_TO_DASHBOARD' })}>Back to Dashboard</Button>
        </div>
        <Button variant="primary" onClick={() => dispatch({ type: 'RELEASE_FILM' })}>
          Release Film
        </Button>
      </div>
    </div>
  );
}
