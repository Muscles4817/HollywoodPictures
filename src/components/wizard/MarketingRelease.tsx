import { useEffect } from 'react';
import { useStudio } from '../../state/StudioContext';
import { MARKETING_SPEND_PROFILES, RELEASE_TYPE_PROFILES, RELEASE_WINDOW_GENRE_BONUS, RELEASE_WINDOW_DESCRIPTIONS } from '../../data/release';
import { pluckDescriptions } from '../../data/describe';
import { computeMarketingCost } from '../../engine/cost';
import { ChoiceGroup } from '../common/ChoiceGroup';
import { Button } from '../common/Button';
import { Money } from '../common/Money';
import { WizardHeader } from '../common/WizardHeader';
import type { MarketingChoices, MarketingSpend, ReleaseType, ReleaseWindow } from '../../types';

const MARKETING_SPENDS = Object.keys(MARKETING_SPEND_PROFILES) as MarketingSpend[];
const RELEASE_TYPES = Object.keys(RELEASE_TYPE_PROFILES) as ReleaseType[];
const RELEASE_WINDOWS = Object.keys(RELEASE_WINDOW_GENRE_BONUS) as ReleaseWindow[];

const MARKETING_SPEND_DESCRIPTIONS = pluckDescriptions(MARKETING_SPEND_PROFILES);
const RELEASE_TYPE_DESCRIPTIONS = pluckDescriptions(RELEASE_TYPE_PROFILES);

const DEFAULT_CHOICES: MarketingChoices = {
  marketingSpend: 'Medium',
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
  const weakMarketingWarning = releaseTypeProfile.needsMarketing && (choices.marketingSpend === 'None' || choices.marketingSpend === 'Low');
  const genreBonus = draft.genre ? RELEASE_WINDOW_GENRE_BONUS[choices.releaseWindow][draft.genre] : undefined;

  return (
    <div className="stack">
      <WizardHeader current="marketing" />
      <h1>Marketing &amp; Release</h1>

      <ChoiceGroup
        label="Marketing Spend"
        options={MARKETING_SPENDS}
        value={choices.marketingSpend}
        onChange={(v) => update('marketingSpend', v)}
        descriptions={MARKETING_SPEND_DESCRIPTIONS}
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
        <Button onClick={() => dispatch({ type: 'GO_TO_STEP', step: 'post-production' })}>Back</Button>
        <Button variant="primary" onClick={() => dispatch({ type: 'RELEASE_FILM' })}>
          Release Film
        </Button>
      </div>
    </div>
  );
}
