import { useState } from 'react';
import { useStudio } from '../../state/StudioContext';
import { MANDATORY_TALENT_ROLES, OPTIONAL_TALENT_ROLES, ROLE_GENERATION_PROFILES } from '../../data/talentGeneration';
import { effectiveRoleCapacity } from '../../engine/castRequirements';
import { logAmount } from '../../engine/interpolate';
import { findCandidatesNearPrice } from '../../engine/talentFilter';
import { computeCommittedSpend } from '../../state/selectors';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { RangeSlider } from '../common/RangeSlider';
import { Money, formatMoney } from '../common/Money';
import { WizardHeader } from '../common/WizardHeader';
import { CompatibilityBadge } from '../common/CompatibilityBadge';
import { computeTalentCompatibility } from '../../engine/compatibility';
import { TONES, TONE_LABELS } from '../../data/tones';
import { ACTING_STYLE_AXES, ACTING_STYLE_LABELS } from '../../data/actingStyle';
import type { CrewTalent, DirectorTalent, Talent, TalentRole } from '../../types';

const VFX_RECOMMENDED_GENRES = new Set(['Action', 'Sci-Fi', 'Fantasy']);

const MASTER_BUDGET_RANGE = { min: 300_000, max: 30_000_000 };
const DEFAULT_MASTER_BUDGET = 3_000_000;

/** How many candidates (closest to the target price) to actually display per role. */
const VISIBLE_CANDIDATE_COUNT = 9;

/** Director and crew roles have a plain Skill rating; Actors don't (see types/index.ts). */
function hasSkill(t: Talent): t is DirectorTalent | CrewTalent {
  return t.role !== 'Lead Actor' && t.role !== 'Supporting Actor';
}

/**
 * What to show in a candidate's expandable breakdown - a Director's own
 * ToneProfile, an Actor's own ActingStyle, or nothing for crew roles that
 * have no tone-comparable stat at all (see engine/compatibility.ts).
 */
function talentBreakdown(talent: Talent): { breakdown: Array<{ label: string; value: number }>; defaultLabel: string } | null {
  if (talent.role === 'Director') {
    return {
      breakdown: TONES.map((tone) => ({ label: TONE_LABELS[tone], value: talent.toneProfile[tone] })),
      defaultLabel: 'Tone Profile',
    };
  }
  if (talent.role === 'Lead Actor' || talent.role === 'Supporting Actor') {
    return {
      breakdown: ACTING_STYLE_AXES.map((axis) => ({ label: ACTING_STYLE_LABELS[axis], value: talent.actingStyle[axis] })),
      defaultLabel: 'Acting Style',
    };
  }
  return null;
}

export function HireTalent() {
  const { state, dispatch } = useStudio();
  const draft = state.draft!;
  const [masterBudget, setMasterBudget] = useState(DEFAULT_MASTER_BUDGET);

  function talentsForRole(role: TalentRole): Talent[] {
    return draft.talent.filter((t) => t.role === role);
  }

  function selectTalent(role: TalentRole, talent: Talent) {
    const capacity = effectiveRoleCapacity(role, draft.script);
    if (capacity.max === 1) {
      const current = talentsForRole(role)[0];
      dispatch({ type: 'SET_TALENT_FOR_ROLE', role, talent: current?.id === talent.id ? null : talent });
      return;
    }
    // Multi-hire role: toggling an unhired candidate once the role is full is a no-op
    // on the reducer side too, but the UI disables those cards so this shouldn't fire.
    dispatch({ type: 'TOGGLE_TALENT_FOR_ROLE', role, talent });
  }

  const totalSalary = draft.talent.reduce((sum, t) => sum + t.salary, 0);
  const missingMandatory = MANDATORY_TALENT_ROLES.filter(
    (role) => talentsForRole(role).length < effectiveRoleCapacity(role, draft.script).min,
  );
  const committedSpend = computeCommittedSpend(draft);
  const canAfford = state.studio.cash >= committedSpend;
  const canContinue = missingMandatory.length === 0 && canAfford;

  function handleMasterBudgetChange(value: number) {
    setMasterBudget(value);
    dispatch({ type: 'SET_TALENT_BUDGET_SPLIT', totalBudget: value });
  }

  function renderRoleSection(role: TalentRole, optional: boolean) {
    const range = ROLE_GENERATION_PROFILES[role].salaryRange;
    const capacity = effectiveRoleCapacity(role, draft.script);
    const targetPrice = draft.talentTargetPriceByRole[role] ?? logAmount(0.5, range);
    const candidates = state.studio.talentPool[role];
    const hired = talentsForRole(role);
    const atCap = hired.length >= capacity.max;
    const showVfxHint = role === 'VFX Supervisor' && draft.genre && VFX_RECOMMENDED_GENRES.has(draft.genre);

    const { candidates: visible, toleranceUsed } = findCandidatesNearPrice(candidates, targetPrice, VISIBLE_CANDIDATE_COUNT);
    // Never let a currently hired pick silently vanish from view just because the slider moved on.
    const hiredNotVisible = hired.filter((h) => !visible.some((v) => v.id === h.id));
    const displayList = [...hiredNotVisible, ...visible];
    const tolerancePercent = Math.round(toleranceUsed * 100);

    const roleLabel = capacity.max > 1
      ? `${role}${optional ? ' (optional)' : ''} - ${hired.length}/${capacity.max} hired`
      : `${role}${optional ? ' (optional)' : ''}`;

    return (
      <RangeSlider
        key={role}
        label={roleLabel}
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
            <span style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>
              Showing candidates within {tolerancePercent}% of your target price.
              {capacity.max > 1 && ` Hire up to ${capacity.max} for this role.`}
              {displayList.length === 0 && ' Nobody in the studio roster is available at this price - try adjusting the slider.'}
            </span>
            {showVfxHint && <p style={{ margin: 0 }}>This genre benefits strongly from VFX - consider hiring a supervisor.</p>}
            <div className="grid">
              {displayList.map((talent) => {
                const selected = hired.some((h) => h.id === talent.id);
                const disabled = !selected && atCap;
                const compatInfo = talentBreakdown(talent);
                const compatScore = draft.script ? computeTalentCompatibility(talent, draft.script) : null;
                return (
                  <Card
                    key={talent.id}
                    selectable
                    selected={selected}
                    disabled={disabled}
                    onClick={() => selectTalent(role, talent)}
                  >
                    <div className="card-title">{talent.name}</div>
                    <div className="card-subtitle"><Money amount={talent.salary} /></div>
                    <div style={{ fontSize: '0.85em' }}>
                      <div>Fame: {talent.fame}</div>
                      {hasSkill(talent) && <div>Skill: {talent.skill}</div>}
                      <div>Reliability: {talent.reliability}</div>
                      <div>Ego: {talent.ego}</div>
                    </div>
                    {compatInfo && (
                      <CompatibilityBadge
                        score={compatScore ?? undefined}
                        breakdown={compatInfo.breakdown}
                        defaultLabel={compatInfo.defaultLabel}
                      />
                    )}
                    {selected && <p style={{ color: 'var(--green)', marginTop: 6 }}>Hired</p>}
                    {disabled && <p style={{ color: 'var(--text-muted)', marginTop: 6 }}>Cast full</p>}
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
      <WizardHeader current="talent" />
      <h1>Hire Talent</h1>
      <p className="choice-description">
        Fame boosts box office appeal - especially your lead actor's. Your director and crew have a Skill rating;
        actors instead have five specific Acting Style strengths (click or hover an actor's card to see them) - there's
        no single "acting skill," just how well their particular strengths suit this script. Compatibility shows that
        fit for both directors and actors, and matters most for your director and lead actor. Reliability and Ego
        apply across everyone you hire: an unreliable, high-ego crew raises the odds of a costly incident once filming
        starts. Supporting Actor can be an ensemble - hiring more people there averages their fit and fame together,
        it doesn't stack.
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

      <div className="sticky-footer">
        <div className="row-between">
          <div>
            <div className="stat-label">Total Cast Salary</div>
            <div className="stat-value"><Money amount={totalSalary} /></div>
          </div>
          <div className="row">
            <Button onClick={() => dispatch({ type: 'GO_TO_STEP', step: 'develop' })}>Back</Button>
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
