import { useStudio } from '../../state/StudioContext';
import { TALENT_BY_ROLE } from '../../data/talentPool';
import { computeCommittedSpend } from '../../state/selectors';
import { BudgetTracker } from '../common/BudgetTracker';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Money } from '../common/Money';
import { WizardSteps } from '../common/WizardSteps';
import type { Talent, TalentRole } from '../../types';

const MANDATORY_ROLES: TalentRole[] = ['Director', 'Lead Actor', 'Supporting Actor', 'Writer', 'Composer', 'Editor'];
const OPTIONAL_ROLES: TalentRole[] = ['VFX Supervisor'];

const VFX_RECOMMENDED_GENRES = new Set(['Action', 'Sci-Fi', 'Fantasy']);

export function HireTalent() {
  const { state, dispatch } = useStudio();
  const draft = state.draft!;

  function talentForRole(role: TalentRole): Talent | undefined {
    return draft.talent.find((t) => t.role === role);
  }

  function selectTalent(role: TalentRole, talent: Talent) {
    const current = talentForRole(role);
    dispatch({ type: 'SET_TALENT_FOR_ROLE', role, talent: current?.id === talent.id ? null : talent });
  }

  const totalSalary = draft.talent.reduce((sum, t) => sum + t.salary, 0);
  const missingMandatory = MANDATORY_ROLES.filter((role) => !talentForRole(role));
  const committedSpend = computeCommittedSpend(draft);
  const canAfford = state.studio.cash >= committedSpend;
  const canContinue = missingMandatory.length === 0 && canAfford;

  function handleContinue() {
    dispatch({ type: 'GO_TO_STEP', step: 'production-planning' });
  }

  function renderRoleSection(role: TalentRole, optional: boolean) {
    const hired = talentForRole(role);
    const showVfxHint = role === 'VFX Supervisor' && draft.genre && VFX_RECOMMENDED_GENRES.has(draft.genre);
    return (
      <div className="card stack" key={role}>
        <h2>
          {role} {optional && <span style={{ fontWeight: 400, fontSize: '0.7em', color: 'var(--text-muted)' }}>(optional)</span>}
        </h2>
        {showVfxHint && <p>This genre benefits strongly from VFX - consider hiring a supervisor.</p>}
        <div className="grid">
          {TALENT_BY_ROLE[role]?.map((talent) => {
            const selected = hired?.id === talent.id;
            const affinity = draft.genre ? talent.genreAffinities[draft.genre] ?? 50 : null;
            return (
              <Card key={talent.id} selectable selected={selected} onClick={() => selectTalent(role, talent)}>
                <div className="card-title">{talent.name}</div>
                <div className="card-subtitle"><Money amount={talent.salary} /></div>
                <div style={{ fontSize: '0.85em' }}>
                  <div>Fame: {talent.fame}</div>
                  <div>Skill: {talent.skill}</div>
                  <div>Reliability: {talent.reliability}</div>
                  <div>Ego: {talent.ego}</div>
                  {affinity !== null && <div>Genre Affinity ({draft.genre}): {affinity}</div>}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <WizardSteps current="talent" />
      <BudgetTracker />
      <h1>Hire Talent</h1>
      <p className="choice-description">
        Fame boosts box office appeal - especially your lead actor's. Skill drives quality, most directly through your
        director and cast. Genre Affinity shows how well someone suits this specific genre, and matters most for your
        director and lead actor. Reliability and Ego apply across everyone you hire: an unreliable, high-ego crew
        raises the odds of a costly incident once filming starts.
      </p>

      {MANDATORY_ROLES.map((role) => renderRoleSection(role, false))}
      {OPTIONAL_ROLES.map((role) => renderRoleSection(role, true))}

      <div className="card">
        <div className="stat-label">Total Cast Salary</div>
        <div className="stat-value"><Money amount={totalSalary} /></div>
      </div>

      {missingMandatory.length > 0 && (
        <p style={{ color: 'var(--red)' }}>Still need to hire: {missingMandatory.join(', ')}</p>
      )}
      {!canAfford && <p style={{ color: 'var(--red)' }}>You can't afford this so far. Adjust your picks.</p>}

      <div className="row-between">
        <Button onClick={() => dispatch({ type: 'GO_TO_STEP', step: 'develop' })}>Back</Button>
        <Button variant="primary" disabled={!canContinue} onClick={handleContinue}>
          Confirm Cast & Continue
        </Button>
      </div>
    </div>
  );
}
