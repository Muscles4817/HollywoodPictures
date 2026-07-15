import { useStudio } from '../../state/StudioContext';
import { TARGET_AUDIENCES, AUDIENCE_PROFILES } from '../../data/audiences';
import { pluckDescriptions } from '../../data/describe';
import { ChoiceGroup } from '../common/ChoiceGroup';
import { Button } from '../common/Button';
import { WizardHeader } from '../common/WizardHeader';
import { ScriptDetails } from '../common/ScriptDetails';
import { deriveFocusedDraft } from '../../state/selectors';

const AUDIENCE_DESCRIPTIONS = pluckDescriptions(AUDIENCE_PROFILES);

/**
 * The script is inherited wholesale from the Asset this Project was created
 * from (development-pipeline doc) - no more in-wizard genre picking or
 * script-slate/reroll UI, since that "pick" already happened back at
 * Opportunity acquisition (see components/OpportunityMarket.tsx). This
 * screen is now just the title and Target Audience, plus a read-only look
 * at the script the film is actually built around.
 */
export function DevelopFilm() {
  const { state, dispatch } = useStudio();
  const draft = deriveFocusedDraft(state)!;
  const script = draft.script!;

  const canContinue = Boolean(draft.title.trim() && draft.targetAudience);

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

      <div className="row-between">
        <Button onClick={() => dispatch({ type: 'ABANDON_PROJECT' })}>Abandon Project</Button>
        <Button variant="primary" disabled={!canContinue} onClick={handleContinue}>
          Continue to Hire Talent
        </Button>
      </div>
    </div>
  );
}
