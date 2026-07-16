import { useState } from 'react';
import { useStudio } from '../../state/StudioContext';
import { deriveFocusedDraft, deriveGreenlightCommitment } from '../../state/selectors';
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
import type { ProjectWorkspaceSection } from '../../types';

const AUDIENCE_DESCRIPTIONS = pluckDescriptions(AUDIENCE_PROFILES);

const SECTION_LABELS: Record<ProjectWorkspaceSection, string> = {
  overview: 'Overview',
  'cast-and-crew': 'Cast & Crew',
  production: 'Production',
  finance: 'Finance',
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
export function ProjectOverview() {
  const { state, dispatch } = useStudio();
  const draft = deriveFocusedDraft(state)!;
  const script = draft.script!;
  const [confirming, setConfirming] = useState(false);

  const readiness = deriveProjectReadiness(draft, state.studio.cash);
  const commitment = deriveGreenlightCommitment(draft, state.studio.cash);

  const director = findAssignedPerson(draft.talent, 'Director');
  const directorCareer = director && getDirectorCareer(director);
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

      <div className="card stack">
        <h3 style={{ margin: 0 }}>Greenlight Readiness</h3>
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
