import { computeTalentCompatibility } from '../../engine/compatibility';
import { dominantLean } from '../../engine/recommendation';
import { getCareerForRole } from '../../engine/person';
import { toneProfileBreakdown } from '../../data/tones';
import { ENV_LEAN_SHORT, EFFECTS_LEAN_SHORT } from '../../data/productionStyleLabels';
import { ACTING_STYLE_AXES, ACTING_STYLE_LABELS } from '../../data/actingStyle';
import type { RoleCategory } from '../../data/talentPresentation';
import { Money } from './Money';
import { CompatibilityBadge } from './CompatibilityBadge';
import type { DirectorCareer, Person, ProductionRole, Script } from '../../types';

export function talentBreakdown(person: Person, role: ProductionRole): { breakdown: Array<{ label: string; value: number }>; defaultLabel: string } | null {
  const career = getCareerForRole(person, role);
  if (!career) return null;
  if ('toneProfile' in career) {
    return { breakdown: toneProfileBreakdown(career.toneProfile), defaultLabel: 'Tone Profile' };
  }
  if ('actingStyle' in career) {
    return {
      breakdown: ACTING_STYLE_AXES.map((axis) => ({ label: ACTING_STYLE_LABELS[axis], value: career.actingStyle[axis] })),
      defaultLabel: 'Acting Style',
    };
  }
  return null;
}

/** A director's own production leanings, compact enough for a candidate card - "Leans location, practical effects." See engine/recommendation.ts:dominantLean, the same math Plan Production's cards use. */
export function describeProductionStyle(director: DirectorCareer): string {
  const env = dominantLean(director.productionStyle.environmentStrategy);
  const fx = dominantLean(director.productionStyle.effectsStrategy);
  return `Leans ${ENV_LEAN_SHORT[env.key]}, ${EFFECTS_LEAN_SHORT[fx.key]}`;
}

/**
 * The full stat display for one person under a specific role - headline row
 * (role-category-aware) plus a small secondary block - shared by every
 * screen that needs to show "who is this and how do they suit this script":
 * Hire Talent's candidate grid/comparison slots, and on-set decisions that
 * involve a specific hired or replacement person
 * (components/common/OnSetDecisionCard.tsx). Extracted from
 * components/wizard/RoleHiringDrawer.tsx once a second consumer needed the
 * identical treatment, rather than a second, thinner one-line implementation
 * drifting from it (docs/DESIGN.md). `role` (not just `category`) is what
 * determines which career's stats actually show - the same person could in
 * principle hold more than one career (see PERSON_MODEL_REDESIGN.md).
 */
export function TalentStats({ person, role, category, script }: { person: Person; role: ProductionRole; category: RoleCategory; script: Script | null }) {
  const compatInfo = talentBreakdown(person, role);
  const compatScore = script ? computeTalentCompatibility(person, role, script) : null;
  const career = getCareerForRole(person, role);
  const skill = career && 'skill' in career ? career.skill : undefined;

  return (
    <>
      <div className="card-subtitle"><Money amount={career?.typicalSalary ?? 0} /></div>

      <div className="candidate-headline">
        {category === 'director' && career && 'productionStyle' in career && (
          <>
            <div className="candidate-headline-stat">{describeProductionStyle(career)}</div>
            {compatInfo && <CompatibilityBadge score={compatScore ?? undefined} breakdown={compatInfo.breakdown} defaultLabel={compatInfo.defaultLabel} />}
            <div className="candidate-headline-stat">Reliability {person.reputation.reliability}</div>
          </>
        )}
        {category === 'actor' && (
          <>
            <div className="candidate-headline-stat">Fame {person.reputation.fame}</div>
            {compatInfo && <CompatibilityBadge score={compatScore ?? undefined} breakdown={compatInfo.breakdown} defaultLabel={compatInfo.defaultLabel} />}
            <div className="candidate-headline-stat">Reliability {person.reputation.reliability}</div>
          </>
        )}
        {category === 'crew' && (
          <>
            <div className="candidate-headline-stat">Skill {skill ?? '-'}</div>
            <div className="candidate-headline-stat">Reliability {person.reputation.reliability}</div>
          </>
        )}
      </div>

      <div className="candidate-secondary-stats">
        {(category === 'director' || category === 'crew') && <div>Fame: {person.reputation.fame}</div>}
        <div>Ego: {person.personality.ego}</div>
      </div>
    </>
  );
}
