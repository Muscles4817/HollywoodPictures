import { useEffect } from 'react';
import { useStudio } from '../../state/StudioContext';
import { deriveFocusedDraft } from '../../state/selectors';
import { findAssignedPerson, professionForProductionRole } from '../../data/helpers';
import { ROLE_GENERATION_PROFILES } from '../../data/talentGeneration';
import { logAmount } from '../../engine/interpolate';
import { computeActorAppeal } from '../../engine/castingAppeal';
import { describeApplicantInterest } from '../../engine/castingPresentation';
import { deriveBookedUntil, getTypicalSalaryForRole } from '../../engine/person';
import { formatGameDate } from '../../engine/calendar';
import { CHARACTER_ARCHETYPE_LABELS } from '../../data/scriptTagLabels';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Money } from '../common/Money';
import { CompatibilityBadge } from '../common/CompatibilityBadge';
import { ACTING_STYLE_AXES, ACTING_STYLE_LABELS } from '../../data/actingStyle';
import type { CastingApplicant, Person, ScriptCharacter } from '../../types';

interface OpenCastingDrawerProps {
  character: ScriptCharacter;
  role: 'Lead Actor' | 'Supporting Actor';
  slotIndex: number;
  onClose: () => void;
}

/**
 * One applicant's own card - Suitability (starred, same 5-axis breakdown as
 * a candidate's own ActingStyle), Fame, salary ask, availability, and a
 * one-line reason they applied (engine/castingPresentation.ts) - the
 * balance the player is meant to weigh (Casting Redesign Additional Notes,
 * point 2), not just "who's the biggest star."
 */
function ApplicantCard({
  applicant,
  role,
  overall,
  canCast,
  onCast,
}: {
  applicant: CastingApplicant;
  role: 'Lead Actor' | 'Supporting Actor';
  overall: ReturnType<typeof computeActorAppeal>;
  canCast: boolean;
  onCast: () => void;
}) {
  const { person } = applicant;
  const career = person.careers.actor;
  const bookedUntil = deriveBookedUntil(person.availability.commitments);
  const available = !bookedUntil;

  return (
    <Card>
      <div className="card-title">{person.identity.name}</div>
      <div className="card-subtitle"><Money amount={career ? getTypicalSalaryForRole(person, role) : 0} /></div>
      <div className="candidate-headline">
        <div className="candidate-headline-stat">Fame {person.reputation.fame}</div>
        {career && (
          <CompatibilityBadge
            score={overall?.suitability}
            breakdown={ACTING_STYLE_AXES.map((axis) => ({ label: ACTING_STYLE_LABELS[axis], value: career.actingStyle[axis] }))}
            defaultLabel="Acting Style"
          />
        )}
        <div className="candidate-headline-stat">{available ? 'Available now' : `Booked until ${formatGameDate(bookedUntil!)}`}</div>
      </div>
      <p style={{ margin: '6px 0 0', fontSize: '0.85em', color: 'var(--text-muted)' }}>
        {overall ? describeApplicantInterest(overall) : ''}
      </p>
      <Button
        variant="primary"
        className="btn-sm"
        style={{ marginTop: 8 }}
        disabled={!canCast}
        onClick={onCast}
      >
        Cast
      </Button>
    </Card>
  );
}

/**
 * The Open Casting workflow for one specific Character - shows its
 * accumulating applicant list (engine/castingCalls.ts:tickCastingCalls
 * fills this in weekly) once a call is open, or a call-to-action to open
 * one. Deliberately separate from RoleHiringDrawer.tsx (Director/crew still
 * use that unchanged) - Open Casting's per-Character, time-accruing
 * applicant pool is a genuinely different browsing model from that
 * drawer's live snapshot of the whole static talent pool near a price
 * target, not a variant of the same thing.
 */
export function OpenCastingDrawer({ character, role, slotIndex, onClose }: OpenCastingDrawerProps) {
  const { state, dispatch } = useStudio();
  const draft = deriveFocusedDraft(state)!;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const call = draft.castingCalls.find((c) => c.characterId === character.id) ?? null;
  const director = findAssignedPerson(draft.talent, 'Director');
  const hired = draft.talent.filter((a) => a.role === role).map((a) => a.person);
  const alreadyCast = slotIndex < hired.length;
  // Casting stays append-order for now (see docs/DESIGN_REVIEW_casting_redesign.md's
  // own note on why slot-targeted recasting is out of scope this phase) -
  // an applicant can only actually be *cast* once every earlier same-
  // prominence character already is, even though a call can be opened and
  // accrue applicants for any of them in any order.
  const canCastFromHere = !alreadyCast && slotIndex === hired.length;

  const range = ROLE_GENERATION_PROFILES[professionForProductionRole(role)].salaryRange;
  const offeredSalary = draft.talentTargetPriceByRole[role] ?? logAmount(0.5, range);

  function castApplicant(person: Person) {
    if (!canCastFromHere) return;
    dispatch({ type: 'TOGGLE_TALENT_FOR_ROLE', role, person });
    onClose();
  }

  // Computed once per applicant, not re-derived on every sort comparison or
  // render - computeActorAppeal is pure, but there's no reason to call it
  // three times over for the same person.
  const appealByPersonId = new Map(
    (call?.applicants ?? []).map((a) => [
      a.person.id,
      draft.script ? computeActorAppeal(a.person, character, draft.script, state.studio, director, draft.talent, offeredSalary, state.totalDays) : null,
    ]),
  );
  const sortedApplicants = call
    ? [...call.applicants].sort((a, b) => (appealByPersonId.get(b.person.id)?.overall ?? 0) - (appealByPersonId.get(a.person.id)?.overall ?? 0))
    : [];

  return (
    <>
      <div className="role-drawer-backdrop" onClick={onClose} />
      <div className="role-drawer stack" role="dialog" aria-label={`Cast ${character.name}`}>
        <div className="row-between">
          <div>
            <h2 style={{ margin: 0 }}>Casting: {character.name}</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>
              {character.prominence} &middot; {CHARACTER_ARCHETYPE_LABELS[character.archetype]}
            </p>
          </div>
          <Button onClick={onClose}>Close</Button>
        </div>

        {alreadyCast && (
          <p style={{ margin: 0 }}>Already cast: {hired[slotIndex].identity.name}. Recasting isn't supported yet.</p>
        )}
        {!alreadyCast && !canCastFromHere && (
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            Cast earlier {character.prominence.toLowerCase()} roles in this section first - applicants can still apply here in the meantime.
          </p>
        )}

        {!call ? (
          <div className="card stack">
            <p style={{ margin: 0 }}>
              No casting call open yet. Opening one lets applicants apply over the coming weeks, weighted by how well
              they'd suit this character, your studio's reputation, and what you're offering.
            </p>
            <Button variant="primary" onClick={() => dispatch({ type: 'OPEN_CASTING_CALL', characterId: character.id, role })}>
              Open Casting
            </Button>
          </div>
        ) : call.applicants.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            Casting is open - no applicants yet. Check back as time passes.
          </p>
        ) : (
          <div className="grid grid-wide">
            {sortedApplicants.map((applicant) => (
              <ApplicantCard
                key={applicant.person.id}
                applicant={applicant}
                role={role}
                overall={appealByPersonId.get(applicant.person.id) ?? null}
                canCast={canCastFromHere}
                onCast={() => castApplicant(applicant.person)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
