import { computeTalentCompatibility } from '../../engine/compatibility';
import { dominantLean } from '../../engine/recommendation';
import { toneProfileBreakdown } from '../../data/tones';
import { ENV_LEAN_SHORT, EFFECTS_LEAN_SHORT } from '../../data/productionStyleLabels';
import { ACTING_STYLE_AXES, ACTING_STYLE_LABELS } from '../../data/actingStyle';
import type { RoleCategory } from '../../data/talentPresentation';
import { Money } from './Money';
import { CompatibilityBadge } from './CompatibilityBadge';
import type { CrewTalent, DirectorTalent, Script, Talent } from '../../types';

/** Director and crew roles have a plain Skill rating; Actors don't (see types/index.ts). */
export function hasSkill(t: Talent): t is DirectorTalent | CrewTalent {
  return t.role !== 'Lead Actor' && t.role !== 'Supporting Actor';
}

export function talentBreakdown(talent: Talent): { breakdown: Array<{ label: string; value: number }>; defaultLabel: string } | null {
  if (talent.role === 'Director') {
    return { breakdown: toneProfileBreakdown(talent.toneProfile), defaultLabel: 'Tone Profile' };
  }
  if (talent.role === 'Lead Actor' || talent.role === 'Supporting Actor') {
    return {
      breakdown: ACTING_STYLE_AXES.map((axis) => ({ label: ACTING_STYLE_LABELS[axis], value: talent.actingStyle[axis] })),
      defaultLabel: 'Acting Style',
    };
  }
  return null;
}

/** A director's own production leanings, compact enough for a candidate card - "Leans location, practical effects." See engine/recommendation.ts:dominantLean, the same math Plan Production's cards use. */
export function describeProductionStyle(director: DirectorTalent): string {
  const env = dominantLean(director.productionStyle.environmentStrategy);
  const fx = dominantLean(director.productionStyle.effectsStrategy);
  return `Leans ${ENV_LEAN_SHORT[env.key]}, ${EFFECTS_LEAN_SHORT[fx.key]}`;
}

/**
 * The full stat display for one person - headline row (role-category-aware)
 * plus a small secondary block - shared by every screen that needs to show
 * "who is this and how do they suit this script": Hire Talent's candidate
 * grid/comparison slots, and on-set decisions that involve a specific
 * hired or replacement talent (components/common/OnSetDecisionCard.tsx).
 * Extracted from components/wizard/RoleHiringDrawer.tsx once a second
 * consumer needed the identical treatment, rather than a second, thinner
 * one-line implementation drifting from it (docs/DESIGN.md).
 */
export function TalentStats({ talent, category, script }: { talent: Talent; category: RoleCategory; script: Script | null }) {
  const compatInfo = talentBreakdown(talent);
  const compatScore = script ? computeTalentCompatibility(talent, script) : null;

  return (
    <>
      <div className="card-subtitle"><Money amount={talent.salary} /></div>

      <div className="candidate-headline">
        {category === 'director' && (
          <>
            <div className="candidate-headline-stat">{describeProductionStyle(talent as DirectorTalent)}</div>
            {compatInfo && <CompatibilityBadge score={compatScore ?? undefined} breakdown={compatInfo.breakdown} defaultLabel={compatInfo.defaultLabel} />}
            <div className="candidate-headline-stat">Reliability {talent.reliability}</div>
          </>
        )}
        {category === 'actor' && (
          <>
            <div className="candidate-headline-stat">Fame {talent.fame}</div>
            {compatInfo && <CompatibilityBadge score={compatScore ?? undefined} breakdown={compatInfo.breakdown} defaultLabel={compatInfo.defaultLabel} />}
            <div className="candidate-headline-stat">Reliability {talent.reliability}</div>
          </>
        )}
        {category === 'crew' && (
          <>
            <div className="candidate-headline-stat">Skill {hasSkill(talent) ? talent.skill : '-'}</div>
            <div className="candidate-headline-stat">Reliability {talent.reliability}</div>
          </>
        )}
      </div>

      <div className="candidate-secondary-stats">
        {(category === 'director' || category === 'crew') && <div>Fame: {talent.fame}</div>}
        <div>Ego: {talent.ego}</div>
      </div>
    </>
  );
}
