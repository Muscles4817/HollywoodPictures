import { useState } from 'react';
import { useStudio } from '../../state/StudioContext';
import { MANDATORY_TALENT_ROLES, OPTIONAL_TALENT_ROLES, ROLE_GENERATION_PROFILES } from '../../data/talentGeneration';
import { logAmount } from '../../engine/interpolate';
import { computeCommittedSpend } from '../../state/selectors';
import { BudgetTracker } from '../common/BudgetTracker';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { RangeSlider } from '../common/RangeSlider';
import { Money, formatMoney } from '../common/Money';
import { WizardSteps } from '../common/WizardSteps';
import type { Talent, TalentRole } from '../../types';

const VFX_RECOMMENDED_GENRES = new Set(['Action', 'Sci-Fi', 'Fantasy']);

const MASTER_BUDGET_RANGE = { min: 300_000, max: 30_000_000 };
const DEFAULT_MASTER_BUDGET = 3_000_000;

/** How many candidates (closest to the target price) to actually display per role. */
const VISIBLE_CANDIDATE_COUNT = 6;

export function HireTalent() {
  const { state, dispatch } = useStudio();
  const draft = state.draft!;
  const [masterBudget, setMasterBudget] = useState(DEFAULT_MASTER_BUDGET);

  function talentForRole(role: TalentRole): Talent | undefined {
    return draft.talent.find((t) => t.role === role);
  }

  function selectTalent(role: TalentRole, talent: Talent) {
    const current = talentForRole(role);
    dispatch({ type: 'SET_TALENT_FOR_ROLE', role, talent: current?.id === talent.id ? null : talent });
  }

  const totalSalary = draft.talent.reduce((sum, t) => sum + t.salary, 0);
  const missingMandatory = MANDATORY_TALENT_ROLES.filter((role) => !talentForRole(role));
  const committedSpend = computeCommittedSpend(draft);
  const canAfford = state.studio.cash >= committedSpend;
  const canContinue = missingMandatory.length === 0 && canAfford;

  function handleMasterBudgetChange(value: number) {
    setMasterBudget(value);
    dispatch({ type: 'SET_TALENT_BUDGET_SPLIT', totalBudget: value });
  }

  function renderRoleSection(role: TalentRole, optional: boolean) {
    const range = ROLE_GENERATION_PROFILES[role].salaryRange;
    const targetPrice = draft.talentTargetPriceByRole[role] ?? logAmount(0.5, range);
    const candidates = draft.talentCandidatesByRole[role] ?? [];
    const hired = talentForRole(role);
    const showVfxHint = role === 'VFX Supervisor' && draft.genre && VFX_RECOMMENDED_GENRES.has(draft.genre);

    const sortedByProximity = [...candidates].sort(
      (a, b) => Math.abs(a.salary - targetPrice) - Math.abs(b.salary - targetPrice),
    );
    const visible = sortedByProximity.slice(0, VISIBLE_CANDIDATE_COUNT);
    // Never let the currently hired pick silently vanish from view just because the slider moved on.
    const displayList = hired && !visible.some((c) => c.id === hired.id) ? [hired, ...visible] : visible;

    return (
      <RangeSlider
        key={role}
        label={`${role}${optional ? ' (optional)' : ''}`}
        min={range.min}
        max={range.max}
        logScale
        value={targetPrice}
        onChange={(price) => dispatch({ type: 'SET_TALENT_TARGET_PRICE', role, price })}
        formatValue={formatMoney}
        description="Drag to set how much you're willing to pay for this role - the candidates shown update to match."
        lowLabel="Cheap"
        highLabel="Star Power"
        extra={
          <>
            <div className="row-between">
              <span style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>
                Showing candidates closest to your target price.
              </span>
              <Button onClick={() => dispatch({ type: 'REROLL_TALENT_CANDIDATES', role })}>Reroll Candidates</Button>
            </div>
            {showVfxHint && <p style={{ margin: 0 }}>This genre benefits strongly from VFX - consider hiring a supervisor.</p>}
            <div className="grid">
              {displayList.map((talent) => {
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
                    {selected && <p style={{ color: 'var(--green)', marginTop: 6 }}>Hired</p>}
                  </Card>
                );
              })}
            </div>
          </>
        }
      />
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

      <RangeSlider
        label="Target Cast & Crew Budget"
        min={MASTER_BUDGET_RANGE.min}
        max={MASTER_BUDGET_RANGE.max}
        logScale
        value={masterBudget}
        onChange={handleMasterBudgetChange}
        formatValue={formatMoney}
        description="Splits evenly across the six mandatory roles below - tilt any of them up or down afterward to spend more here, less there."
        lowLabel="Shoestring"
        highLabel="Big Budget"
      />

      {MANDATORY_TALENT_ROLES.map((role) => renderRoleSection(role, false))}
      {OPTIONAL_TALENT_ROLES.map((role) => renderRoleSection(role, true))}

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
        <Button variant="primary" disabled={!canContinue} onClick={() => dispatch({ type: 'GO_TO_STEP', step: 'production-planning' })}>
          Confirm Cast & Continue
        </Button>
      </div>
    </div>
  );
}
