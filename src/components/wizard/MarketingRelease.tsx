import { useState } from 'react';
import { useStudio } from '../../state/StudioContext';
import { MARKETING_SPEND_PROFILES, RELEASE_TYPE_PROFILES, RELEASE_WINDOW_GENRE_BONUS } from '../../data/release';
import { computeMarketingCost } from '../../engine/cost';
import { computeCommittedSpend } from '../../state/selectors';
import { ChoiceGroup } from '../common/ChoiceGroup';
import { Button } from '../common/Button';
import { Money } from '../common/Money';
import { WizardSteps } from '../common/WizardSteps';
import type { MarketingChoices, MarketingSpend, ReleaseType, ReleaseWindow } from '../../types';

const MARKETING_SPENDS = Object.keys(MARKETING_SPEND_PROFILES) as MarketingSpend[];
const RELEASE_TYPES = Object.keys(RELEASE_TYPE_PROFILES) as ReleaseType[];
const RELEASE_WINDOWS = Object.keys(RELEASE_WINDOW_GENRE_BONUS) as ReleaseWindow[];

const DEFAULT_CHOICES: MarketingChoices = {
  marketingSpend: 'Medium',
  releaseType: 'Wide',
  releaseWindow: 'Quiet Month',
};

export function MarketingRelease() {
  const { state, dispatch } = useStudio();
  const draft = state.draft!;
  const [choices, setChoices] = useState<MarketingChoices>(draft.marketingChoices ?? DEFAULT_CHOICES);

  function update<K extends keyof MarketingChoices>(key: K, value: MarketingChoices[K]) {
    setChoices((prev) => ({ ...prev, [key]: value }));
  }

  const marketingCost = computeMarketingCost(choices);
  const committedSoFar = computeCommittedSpend(draft);
  const projectedCash = state.studio.cash - committedSoFar - marketingCost;

  const releaseTypeProfile = RELEASE_TYPE_PROFILES[choices.releaseType];
  const weakMarketingWarning = releaseTypeProfile.needsMarketing && (choices.marketingSpend === 'None' || choices.marketingSpend === 'Low');
  const genreBonus = draft.genre ? RELEASE_WINDOW_GENRE_BONUS[choices.releaseWindow][draft.genre] : undefined;

  function handleRelease() {
    dispatch({ type: 'SET_MARKETING_CHOICES', choices });
    dispatch({ type: 'RELEASE_FILM' });
  }

  return (
    <div className="stack">
      <WizardSteps current="marketing" />
      <h1>Marketing &amp; Release</h1>

      <div className="card stack">
        <ChoiceGroup label="Marketing Spend" options={MARKETING_SPENDS} value={choices.marketingSpend} onChange={(v) => update('marketingSpend', v)} />
        <ChoiceGroup
          label="Release Type"
          options={RELEASE_TYPES}
          value={choices.releaseType}
          onChange={(v) => update('releaseType', v)}
          hint="Wide needs strong marketing behind it. Festival First helps critics. Streaming is lower upside but safer. Limited is cheaper but caps revenue."
        />
        <ChoiceGroup
          label="Release Window"
          options={RELEASE_WINDOWS}
          value={choices.releaseWindow}
          onChange={(v) => update('releaseWindow', v)}
          hint="Halloween boosts Horror. Summer boosts Action/Sci-Fi/Fantasy. Christmas boosts Fantasy/Romance/Comedy. Awards Season boosts Drama/Thriller."
        />
      </div>

      {weakMarketingWarning && (
        <p style={{ color: 'var(--red)' }}>A wide release with little marketing behind it will badly underperform.</p>
      )}
      {genreBonus && genreBonus > 1 && (
        <p style={{ color: 'var(--green)' }}>{choices.releaseWindow} is a strong window for {draft.genre} - box office bonus expected.</p>
      )}

      <div className="card row-between">
        <div>
          <div className="stat-label">Marketing Cost</div>
          <div className="stat-value"><Money amount={marketingCost} /></div>
        </div>
        <div>
          <div className="stat-label">Cash After This Film So Far</div>
          <div className="stat-value">
            <Money amount={projectedCash} signColor />
          </div>
        </div>
      </div>

      <div className="row-between">
        <Button onClick={() => dispatch({ type: 'GO_TO_STEP', step: 'post-production' })}>Back</Button>
        <Button variant="primary" onClick={handleRelease}>
          Release Film
        </Button>
      </div>
    </div>
  );
}
