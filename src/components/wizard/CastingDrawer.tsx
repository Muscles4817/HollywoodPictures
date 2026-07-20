import { useEffect, useState } from 'react';
import { useStudio } from '../../state/StudioContext';
import { deriveFocusedDraft } from '../../state/selectors';
import { findAssignedPerson, professionForProductionRole } from '../../data/helpers';
import { ROLE_GENERATION_PROFILES } from '../../data/talentGeneration';
import { logAmount } from '../../engine/interpolate';
import { findCandidatesNearPrice } from '../../engine/talentFilter';
import { actorMeetsCharacterGender } from '../../engine/casting';
import { computeActorAppeal, resolveOfferResponse, type OfferResponse } from '../../engine/castingAppeal';
import { describeApplicantInterest, describeOfferRejection } from '../../engine/castingPresentation';
import { formatMoney } from '../common/Money';
import { CHARACTER_ARCHETYPE_LABELS } from '../../data/scriptTagLabels';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { RangeSlider } from '../common/RangeSlider';
import { TalentStats } from '../common/TalentStats';
import type { CastingChannel, Person, Script, ScriptCharacter } from '../../types';

type CastingTab = 'open-casting' | 'direct-approach';

// How long an accepted offer lingers, showing "accepted," before the
// drawer auto-closes - same beat components/wizard/RoleHiringDrawer.tsx's
// own AUTO_CLOSE_DELAY_MS uses.
const AUTO_CLOSE_DELAY_MS = 500;

interface CastingDrawerProps {
  character: ScriptCharacter;
  role: 'Lead Actor' | 'Supporting Actor';
  slotIndex: number;
  onClose: () => void;
}

/**
 * One candidate's own card, shared by both tabs below - built on the same
 * TalentStats every other hiring/casting screen uses (RoleHiringDrawer.tsx,
 * OnSetDecisionCard.tsx) rather than a second, thinner one-line
 * implementation that had quietly drifted from it (no Reliability, no Ego,
 * no age/gender/traits - the exact gap a UI review of this screen surfaced).
 * `character` gets TalentStats' own character-specific "Role Demands"
 * badge, the same computeActorCharacterCompatibility score
 * engine/castingAppeal.ts:ActorAppealFactors.suitability already reads for
 * `overall` below - never two different numbers claiming to be
 * "suitability" on the same card. Availability, the InterestedTalent tag,
 * and the one-line appeal reason (engine/castingPresentation.ts) stay
 * layered on top, specific to casting rather than hiring in general.
 * `actionLabel` differs by tab ("Cast" vs "Make Offer") - the underlying
 * resolution (engine/castingAppeal.ts:resolveOfferResponse) is identical
 * either way (design review TL;DR - "one appeal function, three front
 * doors").
 */
function CandidateCard({
  person,
  role,
  script,
  character,
  totalDays,
  overall,
  channel,
  actionLabel,
  canAct,
  onAct,
}: {
  person: Person;
  role: 'Lead Actor' | 'Supporting Actor';
  script: Script | null;
  character: ScriptCharacter;
  totalDays: number;
  overall: ReturnType<typeof computeActorAppeal>;
  channel?: CastingChannel;
  actionLabel: string;
  canAct: boolean;
  onAct: () => void;
}) {
  return (
    <Card>
      <div className="card-title">{person.identity.name}</div>
      {/* TalentStats' own Availability section already covers "available
          now" vs "busy until X" - no need to repeat it here. */}
      <TalentStats person={person} role={role} category="actor" script={script} character={character} totalDays={totalDays} />
      {channel === 'InterestedTalent' && (
        <p style={{ margin: '6px 0 0', fontSize: '0.8em', color: 'var(--primary)', fontWeight: 600 }}>
          Reached out to you directly
        </p>
      )}
      <p style={{ margin: '6px 0 0', fontSize: '0.85em', color: 'var(--text-muted)' }}>
        {overall ? describeApplicantInterest(overall) : ''}
      </p>
      <Button variant="primary" className="btn-sm" style={{ marginTop: 8 }} disabled={!canAct} onClick={onAct}>
        {actionLabel}
      </Button>
    </Card>
  );
}

/**
 * The character-scoped casting workflow, Open Casting and Direct Approach
 * together (Casting Redesign, Phase C - Additional Notes point 6, "Direct
 * Approach should remain a viable alternative"). Deliberately separate
 * from RoleHiringDrawer.tsx (Director/crew still use that unchanged) -
 * per-Character casting is a genuinely different browsing model from that
 * drawer's live snapshot of the whole static talent pool near a price
 * target, not a variant of the same thing.
 */
export function CastingDrawer({ character, role, slotIndex, onClose }: CastingDrawerProps) {
  const { state, dispatch } = useStudio();
  const draft = deriveFocusedDraft(state)!;
  const [tab, setTab] = useState<CastingTab>('open-casting');
  const [lastResponse, setLastResponse] = useState<{ personName: string; response: OfferResponse } | null>(null);

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
  // No hint once one's hired - Casting Director's effect (wider, better-
  // curated batches) is already visible in the applicant list itself by
  // then; the hint is only useful before that, to explain why hiring one
  // would help (docs/DESIGN_REVIEW_casting_redesign.md section 11).
  const showCastingDirectorHint = !findAssignedPerson(draft.talent, 'Casting Director');
  const hired = draft.talent.filter((a) => a.role === role).map((a) => a.person);
  const alreadyCast = slotIndex < hired.length;
  // Casting stays append-order for now (see docs/DESIGN_REVIEW_casting_redesign.md's
  // own note on why slot-targeted recasting is out of scope this phase) -
  // an applicant can only actually be *cast* once every earlier same-
  // prominence character already is, even though a call can be opened (and
  // Direct Approach attempted) for any of them in any order. Named
  // explicitly (blockingCharacter), not just "cast earlier roles first" -
  // a player shouldn't have to guess which one.
  const canActFromHere = !alreadyCast && slotIndex === hired.length;
  const blockingCharacter =
    !alreadyCast && !canActFromHere
      ? (draft.script?.cast.filter((c) => c.prominence === character.prominence)[hired.length] ?? null)
      : null;

  const range = ROLE_GENERATION_PROFILES[professionForProductionRole(role)].salaryRange;
  const offeredSalary = draft.talentTargetPriceByRole[role] ?? logAmount(0.5, range);
  const rejectionCount = call?.rejectionCount ?? 0;

  function appealFor(person: Person) {
    return draft.script
      ? computeActorAppeal(person, character, draft.script, state.studio, director, draft.talent, offeredSalary, state.totalDays)
      : null;
  }

  /** Shared by both tabs - resolves the offer, then either finalizes the assignment or records the rejection, per engine/castingAppeal.ts:resolveOfferResponse. */
  function attemptToAttach(person: Person) {
    if (!canActFromHere) return;
    const appeal = appealFor(person);
    if (!appeal) return;
    const response = resolveOfferResponse(appeal, person);
    setLastResponse({ personName: person.identity.name, response });
    if (response.status === 'accepted') {
      dispatch({ type: 'TOGGLE_TALENT_FOR_ROLE', role, person });
      // Same beat RoleHiringDrawer's own AUTO_CLOSE_DELAY_MS uses - long
      // enough for the "accepted" message above to actually register
      // before the drawer closes out from under it.
      setTimeout(onClose, AUTO_CLOSE_DELAY_MS);
    } else {
      dispatch({ type: 'RECORD_CASTING_REJECTION', characterId: character.id, role });
    }
  }

  // Computed once per applicant, not re-derived on every sort comparison or
  // render - computeActorAppeal is pure, but there's no reason to call it
  // three times over for the same person.
  const appealByPersonId = new Map((call?.applicants ?? []).map((a) => [a.person.id, appealFor(a.person)]));
  const sortedApplicants = call
    ? [...call.applicants].sort((a, b) => (appealByPersonId.get(b.person.id)?.overall ?? 0) - (appealByPersonId.get(a.person.id)?.overall ?? 0))
    : [];

  const hiredElsewhereIds = new Set(draft.talent.filter((a) => a.role !== role).map((a) => a.person.id));
  // Only surface actors who can actually play this character - matching the
  // gender it's written for (engine/casting.ts), exactly as Open Casting's
  // own applicant generation already does (engine/castingCalls.ts) and as the
  // reducer's hire guard enforces. Without this, Direct Approach for a
  // gendered role listed every actor regardless of gender, and offering one
  // who didn't match would read as "accepted" and then silently fail to cast
  // (the reducer no-ops the mismatch). 'Any' roles are unfiltered.
  const directCandidates = findCandidatesNearPrice(
    state.talentPool.Actor.filter((t) => !hiredElsewhereIds.has(t.id) && actorMeetsCharacterGender(t.identity.gender, character.castingGender)),
    role,
    offeredSalary,
    9,
  ).candidates;

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
        {!alreadyCast && !canActFromHere && (
          <div className="card production-tension" style={{ margin: 0 }}>
            Cast {blockingCharacter?.name ?? 'an earlier role'} first - {character.prominence.toLowerCase()} roles cast
            in order. Applicants can still apply here, and offers can still be made, in the meantime; nobody can
            actually be confirmed until it's {character.name}'s turn.
          </div>
        )}

        <RangeSlider
          label="Offered Salary"
          min={range.min}
          max={range.max}
          logScale
          value={offeredSalary}
          onChange={(price) => dispatch({ type: 'SET_TALENT_TARGET_PRICE', role, price })}
          formatValue={formatMoney}
          description="What you're offering for this role - shapes who applies to Open Casting and how any offer, direct or otherwise, is received."
          lowLabel="Cheap"
          highLabel="Star Power"
        />

        {rejectionCount > 0 && (
          <p style={{ margin: 0, fontSize: '0.85em', color: 'var(--text-muted)' }}>
            Turned down {rejectionCount} time{rejectionCount === 1 ? '' : 's'} so far - the search has widened: more
            applicants, including some who wouldn't otherwise have floated to the top.
          </p>
        )}

        {lastResponse && (
          <div className={lastResponse.response.status === 'accepted' ? 'card' : 'card production-tension'} style={{ margin: 0 }}>
            {lastResponse.response.status === 'accepted'
              ? `${lastResponse.personName} accepted.`
              : `${lastResponse.personName}: ${describeOfferRejection(lastResponse.response.reason)}`}
          </div>
        )}

        <div className="row">
          <Button variant={tab === 'open-casting' ? 'primary' : 'secondary'} onClick={() => setTab('open-casting')}>
            Open Casting
          </Button>
          <Button variant={tab === 'direct-approach' ? 'primary' : 'secondary'} onClick={() => setTab('direct-approach')}>
            Direct Approach
          </Button>
        </div>

        {tab === 'open-casting' && (
          <>
            {!call ? (
              <div className="card stack">
                <p style={{ margin: 0 }}>
                  No casting call open yet. Opening one lets applicants apply over the coming weeks, weighted by how
                  well they'd suit this character, your studio's reputation, and what you're offering.
                </p>
                <Button variant="primary" onClick={() => dispatch({ type: 'OPEN_CASTING_CALL', characterId: character.id, role })}>
                  Open the Call
                </Button>
              </div>
            ) : (
              <>
                {showCastingDirectorHint && (
                  <p style={{ margin: 0 }}>
                    Hiring a Casting Director brings in more applicants and better-suited ones - and every so often,
                    a promising unknown a wider net alone wouldn't have found.
                  </p>
                )}
                {call.applicants.length === 0 ? (
                  <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                    Casting is open - no applicants yet. Check back as time passes.
                  </p>
                ) : (
                  <div className="grid grid-wide">
                    {sortedApplicants.map((applicant) => (
                      <CandidateCard
                        key={applicant.person.id}
                        person={applicant.person}
                        role={role}
                        script={draft.script}
                        character={character}
                        totalDays={state.totalDays}
                        overall={appealByPersonId.get(applicant.person.id) ?? null}
                        channel={applicant.channel}
                        actionLabel="Cast"
                        canAct={canActFromHere}
                        onAct={() => attemptToAttach(applicant.person)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === 'direct-approach' && (
          <>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85em' }}>
              Target a specific actor directly, rather than waiting for Open Casting to surface them - the same
              acceptance math applies either way.
            </p>
            <div className="grid grid-wide">
              {directCandidates.map((person) => (
                <CandidateCard
                  key={person.id}
                  person={person}
                  role={role}
                  script={draft.script}
                  character={character}
                  totalDays={state.totalDays}
                  overall={appealFor(person)}
                  actionLabel="Make Offer"
                  canAct={canActFromHere}
                  onAct={() => attemptToAttach(person)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
