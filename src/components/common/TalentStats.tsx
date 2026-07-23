import {
  computeTalentCompatibility,
  computeActorCharacterCompatibility,
  computeTalentCompatibilityBreakdown,
  computeCharacterCompatibilityBreakdown,
} from '../../engine/compatibility';
import { dominantLean } from '../../engine/recommendation';
import { describeActorCraft, describeDirectorTouch, describeDirectorActorPairing } from '../../engine/castingPresentation';
import { getCareerForRole, deriveBookedUntil } from '../../engine/person';
import { deriveTraits, TRAIT_LABELS, TRAIT_DESCRIPTIONS } from '../../engine/personTraits';
import { gameDateFromTotalDays, formatGameDateWithMonth } from '../../engine/calendar';
import { TONE_LABELS } from '../../data/tones';
import { ENV_LEAN_SHORT, EFFECTS_LEAN_SHORT } from '../../data/productionStyleLabels';
import { ACTING_STYLE_LABELS } from '../../data/actingStyle';
import { CHARACTER_ARCHETYPE_LABELS } from '../../data/scriptTagLabels';
import type { RoleCategory } from '../../data/talentPresentation';
import { Money } from './Money';
import { StarRating } from './StarRating';
import { MatchBreakdown } from './MatchBreakdown';
import { deriveHiringVerdict } from '../../utils/StarRatingConversion';
import { getPersonAge } from '../../types';
import type { DirectorCareer, Person, ProductionRole, Script, ScriptCharacter } from '../../types';

// A card only has room for a couple of traits before it starts reading as a
// stat dump rather than a quick read - same "top few, not everything"
// judgment call engine/castingPresentation.ts:describeApplicantInterest
// already makes for appeal factors (APPEAL_MAX_NOTES). Order in
// deriveTraits isn't meaningful, so this is just "first N", not "top N."
const MAX_DISPLAYED_TRAITS = 3;

/** A director's own production leanings, compact enough for a candidate card - "Leans location, practical effects." See engine/recommendation.ts:dominantLean, the same math Plan Production's cards use. */
export function describeProductionStyle(director: DirectorCareer): string {
  const env = dominantLean(director.productionStyle.environmentStrategy);
  const fx = dominantLean(director.productionStyle.effectsStrategy);
  return `Leans ${ENV_LEAN_SHORT[env.key]}, ${EFFECTS_LEAN_SHORT[fx.key]}`;
}

/**
 * The single "should I hire this person" reading the card leads with
 * (Talent Card UX Redesign) - reuses whichever existing compatibility
 * calculation is most specific to what's actually being decided, never a
 * new scoring formula:
 *  - an actor being sized up against a specific Character uses that
 *    character-fit score (the most specific reading there is);
 *  - an actor with no Character context, or a director, falls back to
 *    whole-script tone compatibility;
 *  - crew has no compatibility concept at all today (see
 *    engine/compatibility.ts) - skill is the only "how good a hire is this"
 *    number that exists for them, so it doubles as the fit score here.
 * null when nothing above is computable (no script and no character to
 * compare against) - the summary section simply doesn't render rather than
 * showing a meaningless number.
 */
function deriveOverallScore(person: Person, role: ProductionRole, category: RoleCategory, script: Script | null, character: ScriptCharacter | null): number | null {
  if (category === 'actor' && character) {
    return computeActorCharacterCompatibility(person, character);
  }
  if (category === 'crew') {
    const career = getCareerForRole(person, role);
    return career && 'skill' in career ? career.skill : null;
  }
  return script ? computeTalentCompatibility(person, role, script) : null;
}

/**
 * The per-dimension match breakdown backing the summary score above -
 * replaces the old pattern of two side-by-side raw-stat blocks ("Actor's
 * Acting Style" vs "Role Demands") the player had to compare by eye
 * (Talent Card UX Redesign) with one row per dimension, already scored as
 * "how well does this match." Character-fit (the more specific reading)
 * wins when a Character is known; otherwise falls back to the same
 * whole-script tone breakdown deriveOverallScore does. null for crew (no
 * per-axis dimensions exist for them) and for an actor/director with
 * nothing to compare against.
 */
function deriveRoleFitBreakdown(
  person: Person,
  role: ProductionRole,
  category: RoleCategory,
  script: Script | null,
  character: ScriptCharacter | null,
): { title: string; rows: Array<{ label: string; matchScore: number }> } | null {
  if (category === 'actor' && character) {
    const actorCareer = person.careers.actor;
    if (!actorCareer) return null;
    const breakdown = computeCharacterCompatibilityBreakdown(actorCareer.actingStyle, character.traits);
    return { title: 'Role Fit', rows: breakdown.map((a) => ({ label: ACTING_STYLE_LABELS[a.axis], matchScore: a.matchScore })) };
  }
  if (script && (category === 'actor' || category === 'director')) {
    const breakdown = computeTalentCompatibilityBreakdown(person, role, script);
    if (!breakdown) return null;
    return { title: 'Tone Fit', rows: breakdown.map((t) => ({ label: TONE_LABELS[t.tone], matchScore: 100 - t.gap })) };
  }
  return null;
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="talent-stat-row">
      <span>{label}</span>
      <StarRating value={value} />
    </div>
  );
}

/**
 * The full stat display for one person under a specific role - shared by
 * every screen that needs to show "should I hire this person": Hire
 * Talent's candidate grid/comparison slots, and on-set decisions that
 * involve a specific hired or replacement person
 * (components/common/OnSetDecisionCard.tsx). Extracted from
 * components/wizard/RoleHiringDrawer.tsx once a second consumer needed the
 * identical treatment, rather than a second, thinner one-line implementation
 * drifting from it (docs/DESIGN.md). `role` (not just `category`) is what
 * determines which career's stats actually show - the same person could in
 * principle hold more than one career (see PERSON_MODEL_REDESIGN.md).
 *
 * Talent Card UX Redesign - reorganized end to end around "should I hire
 * this person," answerable in about three seconds, rather than a flat list
 * of every stat the simulation tracks: identity (age/gender/salary - name
 * itself is the caller's own card-title, directly above this), a single
 * "Overall Hiring Summary" verdict as the card's focal point, a
 * conversational availability read, a per-dimension role-fit breakdown
 * (replacing two raw stat blocks the player used to have to compare
 * themselves), then Industry (how the business sees them) and Risk Profile
 * (what they're like to work with) as their own grouped sections, with
 * traits closing out the story. The underlying simulation is unchanged -
 * this is purely a presentation reorganization.
 *
 * `character` - which specific Lead/Supporting Character (script.cast) this
 * candidate is being evaluated to play, if the role/slot resolves to one
 * (engine/castRequirements.ts:characterForRoleSlot) - drives the
 * character-specific "Role Fit" reading above the whole-script "Tone Fit"
 * one, per docs/CHARACTER_AND_SETTING_FOUNDATIONS.md section 7: casting
 * should reflect the specific role an actor would play, not just the script
 * as a whole. null for every non-actor role and for a script with no
 * matching character at that slot (e.g. hiring past requiredLeads).
 */
export function TalentStats({ person, role, category, script, character = null, totalDays, availabilityMode = 'delay', pairedDirector = null }: { person: Person; role: ProductionRole; category: RoleCategory; script: Script | null; character?: ScriptCharacter | null; totalDays: number; availabilityMode?: 'delay' | 'blocked'; pairedDirector?: Person | null }) {
  const career = getCareerForRole(person, role);
  const overallScore = deriveOverallScore(person, role, category, script, character);
  const roleFit = deriveRoleFitBreakdown(person, role, category, script, character);

  // Both optional (see PersonIdentity's own comment, types/index.ts) - real,
  // handcrafted people deliberately carry neither rather than a fabricated
  // guess, so this line renders only what's actually known, or not at all.
  const age = getPersonAge(person.identity.dateOfBirth, gameDateFromTotalDays(totalDays));
  const identityLine = [age !== undefined ? `${age}` : null, person.identity.gender ?? null].filter((v) => v !== null).join(' · ');

  const bookedUntil = deriveBookedUntil(person.availability.commitments);
  const isBusy = !!bookedUntil && bookedUntil > totalDays;
  const delayDays = isBusy ? bookedUntil! - totalDays : 0;

  const traits = deriveTraits(person).slice(0, MAX_DISPLAYED_TRAITS);

  return (
    <>
      {identityLine && <div className="candidate-identity-line">{identityLine}</div>}
      <div className="card-subtitle"><Money amount={career?.typicalSalary ?? 0} /></div>

      {category === 'director' && career && 'productionStyle' in career && (
        <>
          <p className="talent-flavor-line">{describeProductionStyle(career)}</p>
          <p className="talent-flavor-line">{describeDirectorTouch(person)}</p>
        </>
      )}

      {overallScore !== null && (
        <div className="hiring-verdict">
          <StarRating value={overallScore} />
          <span className="hiring-verdict-label">{deriveHiringVerdict(overallScore)}</span>
        </div>
      )}

      <div className="talent-availability">
        {isBusy ? (
          <>
            <div className="talent-availability-status">Busy until {formatGameDateWithMonth(bookedUntil!)}.</div>
            <div className="talent-availability-detail">
              {/* 'blocked' - a hiring/casting context, where a booked person
                  simply can't be taken on today (the schedule gate hard-rejects
                  the offer, engine/castingAppeal.ts). The old "would delay
                  production by N days" copy promised a delayed-hire flow that
                  doesn't exist and read as castable when it isn't. 'delay' stays
                  the default for other contexts (e.g. on-set replacements, whose
                  own delay is the event's, not this booking's). */}
              {availabilityMode === 'blocked'
                ? `You can't ${category === 'actor' ? 'cast' : 'hire'} them until then - their existing commitments won't clear in time.`
                : `Hiring them would delay production by ${delayDays} day${delayDays === 1 ? '' : 's'}.`}
            </div>
          </>
        ) : (
          <>
            <div className="talent-availability-status talent-availability-available">✓ Available immediately</div>
            <div className="talent-availability-detail">Ready to begin as soon as you are.</div>
          </>
        )}
      </div>

      {category === 'actor' && character && (
        <p className="talent-flavor-line">
          Up for: {character.name} ({character.prominence} {CHARACTER_ARCHETYPE_LABELS[character.archetype]})
        </p>
      )}

      {category === 'actor' && (
        <>
          <p className="talent-flavor-line">{describeActorCraft(person)}</p>
          {pairedDirector && <p className="talent-flavor-line">{describeDirectorActorPairing(pairedDirector, person)}</p>}
        </>
      )}

      {roleFit && <MatchBreakdown title={roleFit.title} rows={roleFit.rows} />}

      <div className="talent-section">
        <div className="stat-group-title">Industry</div>
        <StatRow label="Fame" value={person.reputation.fame} />
        <StatRow label="Prestige" value={person.reputation.prestige} />
        <StatRow label="Reliability" value={person.reputation.reliability} />
      </div>

      <div className="talent-section">
        <div className="stat-group-title">Risk Profile</div>
        <StatRow label="Professionalism" value={person.personality.professionalism} />
        <StatRow label="Temperament" value={person.personality.temperament} />
        <StatRow label="Ego" value={person.personality.ego} />
        <StatRow label="Controversy" value={person.personality.controversy} />
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
