import { useState } from 'react';
import { useStudio } from '../../state/StudioContext';
import { MANDATORY_TALENT_ROLES, OPTIONAL_TALENT_ROLES } from '../../data/talentGeneration';
import { TALENT_PRESENTATION, type RoleCategory } from '../../data/talentPresentation';
import { effectiveRoleCapacity } from '../../engine/castRequirements';
import { computeCommittedSpend, deriveFocusedDraft } from '../../state/selectors';
import { computeTalentCompatibility } from '../../engine/compatibility';
import { dominantLean, explainEffectsStrategy, explainEnvironmentStrategy } from '../../engine/recommendation';
import { synthesizeProductionIdentity } from '../../engine/productionIdentity';
import { toneProfileBreakdown } from '../../data/tones';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { RangeSlider } from '../common/RangeSlider';
import { ScoreBar } from '../common/ScoreBar';
import { Money, formatMoney } from '../common/Money';
import { WizardHeader } from '../common/WizardHeader';
import { CompatibilityBadge } from '../common/CompatibilityBadge';
import { RoleHiringDrawer } from './RoleHiringDrawer';
import { findAssignedTalent } from '../../data/helpers';
import type { DirectorTalent, EffectsMethodKey, EnvironmentMethodKey, ProductionRole, Talent } from '../../types';

const MASTER_BUDGET_RANGE = { min: 300_000, max: 30_000_000 };
const DEFAULT_MASTER_BUDGET = 3_000_000;

const ENV_LEAN_SHORT: Record<EnvironmentMethodKey, string> = { studio: 'studio', location: 'location', digital: 'digital worldbuilding' };
const EFFECTS_LEAN_SHORT: Record<EffectsMethodKey, string> = { practical: 'practical effects', digital: 'digital effects' };

/** A one-line tile summary of whoever's hired, role-category-aware - a condensed cousin of RoleHiringDrawer's fuller candidate stats. */
function tileHeadline(talent: Talent, category: RoleCategory): string {
  if (category === 'director') {
    const t = talent as DirectorTalent;
    const env = dominantLean(t.productionStyle.environmentStrategy);
    const fx = dominantLean(t.productionStyle.effectsStrategy);
    return `Leans ${ENV_LEAN_SHORT[env.key]}, ${EFFECTS_LEAN_SHORT[fx.key]}`;
  }
  if (category === 'actor') return `Fame ${talent.fame}`;
  return 'skill' in talent ? `Skill ${talent.skill}` : '';
}

function RoleTile({ role, optional, onOpen }: { role: ProductionRole; optional: boolean; onOpen: () => void }) {
  const { state } = useStudio();
  const draft = deriveFocusedDraft(state)!;
  const profile = TALENT_PRESENTATION[role];
  const capacity = effectiveRoleCapacity(role, draft.script);
  const hired = draft.talent.filter((a) => a.role === role).map((a) => a.talent);
  const isMulti = capacity.max > 1;
  const filled = hired.length >= capacity.min;

  return (
    <Card selectable onClick={onOpen}>
      <div className="row-between">
        <div className="card-title">{role}{optional ? ' (optional)' : ''}</div>
        {isMulti && <span className="badge">{hired.length}/{capacity.max}</span>}
      </div>
      {hired.length === 0 ? (
        <>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 8px', fontSize: '0.85em' }}>{profile.hook}</p>
          <p style={{ margin: 0, color: filled ? 'var(--text)' : 'var(--red)' }}>{optional ? 'Not hired' : 'Not yet hired'}</p>
        </>
      ) : isMulti ? (
        <div className="stack" style={{ gap: 2 }}>
          {hired.map((h) => (
            <div key={h.id} className="row-between">
              <span>{h.name}</span>
              <span style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>{tileHeadline(h, profile.category)}</span>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="card-title" style={{ fontSize: '1em', marginBottom: 2 }}>{hired[0].name}</div>
          <div style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>
            {tileHeadline(hired[0], profile.category)} &middot; <Money amount={hired[0].salary} />
          </div>
        </>
      )}
    </Card>
  );
}

export function HireTalent() {
  const { state, dispatch } = useStudio();
  const draft = deriveFocusedDraft(state)!;
  const [masterBudget, setMasterBudget] = useState(DEFAULT_MASTER_BUDGET);
  const [openRole, setOpenRole] = useState<ProductionRole | null>(null);

  function talentsForRole(role: ProductionRole): Talent[] {
    return draft.talent.filter((a) => a.role === role).map((a) => a.talent);
  }

  // Role-agnostic aggregates - flattened once, ignoring which slot each hire is in.
  const allTalent = draft.talent.map((a) => a.talent);

  const totalSalary = allTalent.reduce((sum, t) => sum + t.salary, 0);
  const missingMandatory = MANDATORY_TALENT_ROLES.filter(
    (role) => talentsForRole(role).length < effectiveRoleCapacity(role, draft.script).min,
  );
  const filledMandatoryCount = MANDATORY_TALENT_ROLES.length - missingMandatory.length;
  const committedSpend = computeCommittedSpend(draft);
  const canAfford = state.studio.cash >= committedSpend;
  const canContinue = missingMandatory.length === 0 && canAfford;

  function handleMasterBudgetChange(value: number) {
    setMasterBudget(value);
    dispatch({ type: 'SET_TALENT_BUDGET_SPLIT', totalBudget: value });
  }

  // Evolving Production Identity - the exact same synthesis Plan Production
  // uses later (engine/productionIdentity.ts), shown as soon as it's
  // computable (script + a director) rather than waiting for that screen -
  // both Strategy recommendations only ever needed those two things.
  const director = findAssignedTalent(draft.talent, 'Director') as DirectorTalent | undefined;
  const identity =
    draft.script && director
      ? synthesizeProductionIdentity(draft.script, explainEnvironmentStrategy(draft.script, director), explainEffectsStrategy(draft.script, director))
      : null;

  // Soft quality warnings - informational, never block Continue (missing
  // roles and affordability already do that below). Both need at least a
  // couple of hires before they mean anything, so an almost-empty cast
  // doesn't trip a false alarm.
  const compatScores = allTalent
    .map((t) => (draft.script ? computeTalentCompatibility(t, draft.script) : null))
    .filter((s): s is number => s !== null);
  const avgCompat = compatScores.length > 0 ? compatScores.reduce((a, b) => a + b, 0) / compatScores.length : null;
  const lowCompatWarning = compatScores.length >= 2 && avgCompat !== null && avgCompat < 45;

  const avgReliability = allTalent.length > 0 ? allTalent.reduce((s, t) => s + t.reliability, 0) / allTalent.length : null;
  const avgEgo = allTalent.length > 0 ? allTalent.reduce((s, t) => s + t.ego, 0) / allTalent.length : null;
  const temperamentWarning =
    allTalent.length >= 2 && avgReliability !== null && avgEgo !== null && (avgReliability < 45 || avgEgo > 65);

  return (
    <div className="stack">
      <WizardHeader current="talent" />
      <h1>Cast & Crew</h1>
      <p className="choice-description">
        Assemble your production one hire at a time. Fame boosts box office appeal - especially your lead actor's.
        Your director and crew have a Skill rating; actors instead have five specific Acting Style strengths - there's
        no single "acting skill," just how well their particular strengths suit this script. Reliability and Ego apply
        across everyone you hire: an unreliable, high-ego crew raises the odds of a costly incident once filming starts.
      </p>

      <div className="row">
        <div className="card stack" style={{ flex: 2 }}>
          <h3 style={{ margin: 0 }}>Casting For</h3>
          {draft.script ? (
            <>
              <div className="card-title">{draft.script.title}</div>
              <p className="card-synopsis">{draft.script.synopsis}</p>
              <div style={{ fontSize: '0.85em' }}>
                <div>Leads: {draft.script.requiredLeads}</div>
                <div>Supporting Roles: {draft.script.requiredSupporting}</div>
                <div>Intended Audience: {draft.script.intendedAudience}</div>
              </div>
              <CompatibilityBadge breakdown={toneProfileBreakdown(draft.script.toneProfile)} defaultLabel="Tone Profile" />
            </>
          ) : (
            <p style={{ margin: 0 }}>No script selected.</p>
          )}
        </div>

        <div className="card stack" style={{ flex: 3 }}>
          <h3 style={{ margin: 0 }}>Production Overview</h3>
          <ScoreBar label="Cast &amp; Crew Progress" value={(filledMandatoryCount / MANDATORY_TALENT_ROLES.length) * 100} />
          <div className="row">
            <div className="stat">
              <div className="stat-label">Roles Filled</div>
              <div className="stat-value">{filledMandatoryCount}/{MANDATORY_TALENT_ROLES.length}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Current Payroll</div>
              <div className="stat-value"><Money amount={totalSalary} /></div>
            </div>
          </div>
          <p className="production-identity" style={{ fontSize: '0.95em' }}>
            {identity ?? 'Hire a director to see how this production is taking shape.'}
          </p>
          {lowCompatWarning && (
            <div className="card production-tension" style={{ margin: 0 }}>
              This cast doesn't fit the script especially well overall - worth checking compatibility before you lock it in.
            </div>
          )}
          {temperamentWarning && (
            <div className="card production-tension" style={{ margin: 0 }}>
              This team's temperament (reliability/ego) raises the odds of on-set friction once filming starts.
            </div>
          )}
        </div>
      </div>

      <RangeSlider
        label="Target Cast & Crew Budget"
        min={MASTER_BUDGET_RANGE.min}
        max={MASTER_BUDGET_RANGE.max}
        logScale
        value={masterBudget}
        onChange={handleMasterBudgetChange}
        formatValue={formatMoney}
        description="Splits evenly per person you need to cast, not per role - a script needing 3 leads gets 3 times the budget share of a 1-hire role. Open any role below to tilt its own price up or down afterward."
        lowLabel="Shoestring"
        highLabel="Big Budget"
      />

      <div className="grid">
        {MANDATORY_TALENT_ROLES.map((role) => (
          <RoleTile key={role} role={role} optional={false} onOpen={() => setOpenRole(role)} />
        ))}
        {OPTIONAL_TALENT_ROLES.map((role) => (
          <RoleTile key={role} role={role} optional onOpen={() => setOpenRole(role)} />
        ))}
      </div>

      {openRole && <RoleHiringDrawer role={openRole} onClose={() => setOpenRole(null)} />}

      <div className="sticky-footer">
        <div className="row-between">
          <div>
            <div className="stat-label">Total Cast Salary</div>
            <div className="stat-value"><Money amount={totalSalary} /></div>
          </div>
          <div className="row">
            <Button onClick={() => dispatch({ type: 'GO_TO_STEP', step: 'develop' })}>Back</Button>
            <Button onClick={() => dispatch({ type: 'ABANDON_PROJECT' })}>Abandon Project</Button>
            <Button onClick={() => dispatch({ type: 'RETURN_TO_DASHBOARD' })}>Save & Exit</Button>
            <Button variant="primary" disabled={!canContinue} onClick={() => dispatch({ type: 'GO_TO_STEP', step: 'production-planning' })}>
              Confirm Cast & Continue
            </Button>
          </div>
        </div>
        {missingMandatory.length > 0 && (
          <p style={{ color: 'var(--red)', margin: '8px 0 0' }}>Still need to hire: {missingMandatory.join(', ')}</p>
        )}
        {!canAfford && <p style={{ color: 'var(--red)', margin: '8px 0 0' }}>You can't afford this so far. Adjust your picks.</p>}
      </div>
    </div>
  );
}
