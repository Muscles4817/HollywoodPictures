import { useStudio } from '../../state/StudioContext';
import { GENRES } from '../../data/genres';
import { TARGET_AUDIENCES } from '../../data/audiences';
import { BudgetTracker } from '../common/BudgetTracker';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Money } from '../common/Money';
import { WizardSteps } from '../common/WizardSteps';
import type { Genre, TargetAudience } from '../../types';

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
      <WizardSteps current="develop" />
      <BudgetTracker />
      <h1>Develop Your Film</h1>

      <div className="card stack">
        <h2>Title</h2>
        <input
          type="text"
          placeholder="Working title..."
          value={draft.title}
          onChange={(e) => dispatch({ type: 'SET_TITLE', title: e.target.value })}
          style={{ maxWidth: 360 }}
        />
      </div>

      <div className="card stack">
        <h2>Genre</h2>
        <div className="row">
          {GENRES.map((genre: Genre) => (
            <Button
              key={genre}
              variant={draft.genre === genre ? 'primary' : 'secondary'}
              onClick={() => dispatch({ type: 'SET_GENRE', genre })}
            >
              {genre}
            </Button>
          ))}
        </div>
      </div>

      <div className="card stack">
        <h2>Target Audience</h2>
        <div className="row">
          {TARGET_AUDIENCES.map((audience: TargetAudience) => (
            <Button
              key={audience}
              variant={draft.targetAudience === audience ? 'primary' : 'secondary'}
              onClick={() => dispatch({ type: 'SET_TARGET_AUDIENCE', targetAudience: audience })}
            >
              {audience}
            </Button>
          ))}
        </div>
      </div>

      {draft.genre && (
        <div className="card stack">
          <div className="row-between">
            <h2>Script Options</h2>
            <Button onClick={() => dispatch({ type: 'REROLL_SCRIPTS' })}>Reroll Scripts</Button>
          </div>
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
