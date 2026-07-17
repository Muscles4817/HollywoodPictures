import { computeTalentCompatibility, computeActorCharacterCompatibility, ACTING_STYLE_TO_CHARACTER_TRAIT } from '../../engine/compatibility';
import { dominantLean } from '../../engine/recommendation';
import { getCareerForRole } from '../../engine/person';
import { deriveTraits, TRAIT_LABELS, TRAIT_DESCRIPTIONS } from '../../engine/personTraits';
import { gameDateFromTotalDays } from '../../engine/calendar';
import { toneProfileBreakdown } from '../../data/tones';
import { ENV_LEAN_SHORT, EFFECTS_LEAN_SHORT } from '../../data/productionStyleLabels';
import { ACTING_STYLE_AXES, ACTING_STYLE_LABELS } from '../../data/actingStyle';
import { CHARACTER_ARCHETYPE_LABELS } from '../../data/scriptTagLabels';
import type { RoleCategory } from '../../data/talentPresentation';
import { Money } from './Money';
import { CompatibilityBadge } from './CompatibilityBadge';
import { getPersonAge } from '../../types';
import type { DirectorCareer, Person, ProductionRole, Script, ScriptCharacter } from '../../types';

// A card only has room for a couple of traits before it starts reading as a
// stat dump rather than a quick read - same "top few, not everything"
// judgment call engine/castingPresentation.ts:describeApplicantInterest
// already makes for appeal factors (APPEAL_MAX_NOTES). Order in
// deriveTraits isn't meaningful, so this is just "first N", not "top N."
const MAX_DISPLAYED_TRAITS = 3;

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

/** The specific Character's own trait demands, in the same shape/order as talentBreakdown's ActingStyle rows, so the "what does this role need" badge lines up axis-for-axis with the "what does this actor bring" badge above it (engine/compatibility.ts:ACTING_STYLE_TO_CHARACTER_TRAIT). */
function characterTraitBreakdown(character: ScriptCharacter): Array<{ label: string; value: number }> {
  return ACTING_STYLE_AXES.map((axis) => ({
    label: ACTING_STYLE_LABELS[axis],
    value: character.traits[ACTING_STYLE_TO_CHARACTER_TRAIT[axis]],
  }));
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
 *
 * `character` - which specific Lead/Supporting Character (script.cast) this
 * candidate is being evaluated to play, if the role/slot resolves to one
 * (engine/castRequirements.ts:characterForRoleSlot) - shows a second,
 * role-specific fit badge alongside the whole-script one above it, per
 * docs/CHARACTER_AND_SETTING_FOUNDATIONS.md section 7: casting should
 * reflect the specific role an actor would play, not just the script as a
 * whole. null for every non-actor role and for a script with no matching
 * character at that slot (e.g. hiring past requiredLeads).
 */
export function TalentStats({ person, role, category, script, character = null, totalDays }: { person: Person; role: ProductionRole; category: RoleCategory; script: Script | null; character?: ScriptCharacter | null; totalDays: number }) {
  const compatInfo = talentBreakdown(person, role);
  const compatScore = script ? computeTalentCompatibility(person, role, script) : null;
  const characterScore = character ? computeActorCharacterCompatibility(person, character) : null;
  const career = getCareerForRole(person, role);
  const skill = career && 'skill' in career ? career.skill : undefined;

  // Both optional (see PersonIdentity's own comment, types/index.ts) - real,
  // handcrafted people deliberately carry neither rather than a fabricated
  // guess, so this line renders only what's actually known, or not at all.
  const age = getPersonAge(person.identity.dateOfBirth, gameDateFromTotalDays(totalDays));
  const identityLine = [age !== undefined ? `${age}` : null, person.identity.gender ?? null].filter((v) => v !== null).join(' · ');

  const traits = deriveTraits(person).slice(0, MAX_DISPLAYED_TRAITS);

  return (
    <>
      {identityLine && <div className="candidate-identity-line">{identityLine}</div>}
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

      {category === 'actor' && character && (
        <div className="candidate-headline">
          <div className="candidate-headline-stat">
            Up for: {character.name} ({character.prominence} {CHARACTER_ARCHETYPE_LABELS[character.archetype]})
          </div>
          <CompatibilityBadge
            score={characterScore ?? undefined}
            breakdown={characterTraitBreakdown(character)}
            defaultLabel="Role Demands"
          />
        </div>
      )}

      <div className="candidate-secondary-stats">
        {(category === 'director' || category === 'crew') && <div>Fame: {person.reputation.fame}</div>}
        <div>Ego: {person.personality.ego}</div>
      </div>

      {traits.length > 0 && (
        <div className="candidate-traits">
          {traits.map((trait) => (
            <span key={trait} className="candidate-trait-tag" title={TRAIT_DESCRIPTIONS[trait]}>
              {TRAIT_LABELS[trait]}
            </span>
          ))}
        </div>
      )}
    </>
  );
}
