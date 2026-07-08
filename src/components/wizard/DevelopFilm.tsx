import { useStudio } from '../../state/StudioContext';
import { GENRES, GENRE_PROFILES } from '../../data/genres';
import { TARGET_AUDIENCES, AUDIENCE_PROFILES } from '../../data/audiences';
import { pluckDescriptions } from '../../data/describe';
import { Card } from '../common/Card';
import { ChoiceGroup } from '../common/ChoiceGroup';
import { Button } from '../common/Button';
import { Money } from '../common/Money';
import { WizardHeader } from '../common/WizardHeader';
import { CompatibilityBadge } from '../common/CompatibilityBadge';
import { TONES, TONE_LABELS } from '../../data/tones';
import type { Script } from '../../types';

function toneBreakdown(script: Script) {
  return TONES.map((tone) => ({ label: TONE_LABELS[tone], value: script.toneProfile[tone] }));
}

const GENRE_DESCRIPTIONS = pluckDescriptions(GENRE_PROFILES);
const AUDIENCE_DESCRIPTIONS = pluckDescriptions(AUDIENCE_PROFILES);

export function DevelopFilm() {
  const { state, dispatch } = useStudio();
  const draft = state.draft!;

  const canContinue = Boolean(
    draft.title.trim() && draft.genre && draft.targetAudience && draft.script && state.studio.cash >= draft.script.cost,
  );

  function handleContinue() {
    dispatch({ type: 'GO_TO_STEP', step: 'talent' });
  }

  return (
    <div className="stack">
      <WizardHeader current="develop" />
      <h1>Develop Your Film</h1>

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

      <ChoiceGroup
        label="Genre"
        options={GENRES}
        value={draft.genre}
        onChange={(genre) => dispatch({ type: 'SET_GENRE', genre })}
        descriptions={GENRE_DESCRIPTIONS}
      />

      <ChoiceGroup
        label="Target Audience"
        options={TARGET_AUDIENCES}
        value={draft.targetAudience}
        onChange={(targetAudience) => dispatch({ type: 'SET_TARGET_AUDIENCE', targetAudience })}
        descriptions={AUDIENCE_DESCRIPTIONS}
      />

      {draft.genre && (
        <div className="card stack">
          <div className="row-between">
            <h3 style={{ margin: 0 }}>Script Options</h3>
            <Button onClick={() => dispatch({ type: 'REROLL_SCRIPTS' })}>Reroll Scripts</Button>
          </div>
          <p style={{ margin: 0 }}>
            Genre Fit and Marketability drive audience appeal and box office reach. Originality and Direction quality
            matter most to critics. Structure and Dialogue are overall craft. Higher Complexity raises production risk.
            Each script also has its own Tone Profile (click or hover to see it) - that's what determines which
            director and cast actually suit it once you're hiring.
          </p>
          <div className="grid">
            {draft.scriptOptions.map((script) => {
              const selected = draft.script?.id === script.id;
              const affordable = state.studio.cash >= script.cost;
              return (
                <Card
                  key={script.id}
                  selectable
                  selected={selected}
                  onClick={() => dispatch({ type: 'SELECT_SCRIPT', script })}
                >
                  <div className="card-title">{script.title}</div>
                  <div className="card-subtitle">Cost: <Money amount={script.cost} /></div>
                  <div style={{ fontSize: '0.85em' }}>
                    <div>Genre Fit: {script.genreFit}</div>
                    <div>Originality: {script.originality}</div>
                    <div>Structure: {script.structure}</div>
                    <div>Dialogue: {script.dialogue}</div>
                    <div>Marketability: {script.marketability}</div>
                    <div>Complexity: {script.complexity}</div>
                  </div>
                  <CompatibilityBadge breakdown={toneBreakdown(script)} />
                  {!affordable && (
                    <p style={{ color: 'var(--red)', marginTop: 6 }}>Can't afford this script</p>
                  )}
                  {selected && <p style={{ color: 'var(--green)', marginTop: 6 }}>Selected</p>}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <div className="row-between">
        <Button onClick={() => dispatch({ type: 'RETURN_TO_DASHBOARD' })}>Cancel</Button>
        <Button variant="primary" disabled={!canContinue} onClick={handleContinue}>
          Continue to Hire Talent
        </Button>
      </div>
    </div>
  );
}
