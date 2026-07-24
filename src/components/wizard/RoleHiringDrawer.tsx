import { useEffect, useState } from 'react';
import { useStudio } from '../../state/StudioContext';
import { ROLE_GENERATION_PROFILES } from '../../data/talentGeneration';
import { TALENT_PRESENTATION, type RoleCategory } from '../../data/talentPresentation';
import { effectiveRoleCapacity, characterForRoleSlot } from '../../engine/castRequirements';
import { actorMeetsCharacterGender, castingGenderLabel } from '../../engine/casting';
import { logAmount } from '../../engine/interpolate';
import { findCandidatesNearPrice } from '../../engine/talentFilter';
import { deriveBookedUntil, getTypicalSalaryForRole, isAvailableImmediately } from '../../engine/person';
import { computeDirectorAppeal, resolveDirectorOfferResponse, type DirectorOfferResponse } from '../../engine/directorAppeal';
import { playerRelationshipWith } from '../../engine/relationships';
import { describeDirectorRejection, directorStrengthSignals, type CandidateSignal } from '../../engine/castingPresentation';
import { deriveFocusedDraft, computeCommittedSpend } from '../../state/selectors';
import { professionForProductionRole } from '../../data/helpers';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { RangeSlider } from '../common/RangeSlider';
import { formatMoney } from '../common/Money';
import { TalentStats } from '../common/TalentStats';
import { TalentComparison, type CompareSlot } from '../common/TalentComparison';
import { useComparePins, MAX_PINNED } from '../common/useComparePins';
import { CheckboxToggle } from '../common/CheckboxToggle';
import type { Person, ProductionRole, Script, ScriptCharacter } from '../../types';

const VFX_RECOMMENDED_GENRES = new Set(['Action', 'Sci-Fi', 'Fantasy']);
const VISIBLE_CANDIDATE_COUNT = 9;
// How long a single-slot hire lingers, showing "Hired", before the drawer
// auto-closes and returns the player to the hub - long enough to register
// as confirmation, short enough that it still feels immediate.
const AUTO_CLOSE_DELAY_MS = 500;

interface CandidateCardProps {
  person: Person;
  role: ProductionRole;
  category: RoleCategory;
  script: Script | null;
  character: ScriptCharacter | null;
  totalDays: number;
  selected: boolean;
  disabled: boolean;
  booked: boolean;
  pinned: boolean;
  pinCapped: boolean;
  affordable: boolean;
  /** Candidate reasoning chips (docs/DESIGN_REVIEW_casting_ux.md) - a director's standout draws and any blocker/warning (prestige gate, below salary floor). Empty for roles with no appeal model (most crew). */
  signals: CandidateSignal[];
  onSelect: () => void;
  onTogglePin: () => void;
}

function CandidateCard({ person, role, category, script, character, totalDays, selected, disabled, booked, pinned, pinCapped, affordable, signals, onSelect, onTogglePin }: CandidateCardProps) {
  const isActor = category === 'actor';
  return (
    <Card selectable selected={selected} disabled={disabled} onClick={onSelect}>
      <div className="card-title">{person.identity.name}</div>
      {/* TalentStats' own Availability section already says "Busy until X" -
          the drawer only needs to add its own casting-flow state on top
          (Cast/Hired, or Fully cast once the role's at capacity), not repeat
          the calendar read a second time. */}
      <TalentStats person={person} role={role} category={category} script={script} character={character} totalDays={totalDays} availabilityMode="blocked" affordable={affordable} />
      {signals.length > 0 && (
        <div className="candidate-signals">
          {signals.map((signal) => (
            <span key={signal.label} className={`candidate-signal candidate-signal--${signal.tone}`}>{signal.label}</span>
          ))}
        </div>
      )}
      <Button
        className="btn-sm"
        variant={pinned ? 'primary' : 'secondary'}
        style={{ marginTop: 8 }}
        disabled={!pinned && pinCapped}
        onClick={(e) => {
          e.stopPropagation();
          onTogglePin();
        }}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {pinned ? 'Pinned' : 'Pin to Compare'}
      </Button>
      {selected && <p style={{ color: 'var(--green)', marginTop: 6 }}>{isActor ? 'Cast' : 'Hired'}</p>}
      {!selected && !booked && disabled && <p style={{ color: 'var(--text-muted)', marginTop: 6 }}>{isActor ? 'Fully cast' : 'Cast full'}</p>}
    </Card>
  );
}

interface RoleHiringDrawerProps {
  role: ProductionRole;
  onClose: () => void;
}

/**
 * Slides in over the Cast & Crew hub (HireTalent.tsx) rather than
 * navigating to it - the player is meant to feel like they never left the
 * production they're assembling, just focused in on one hire. Closes
 * itself automatically a beat after a single-slot role gets a fresh hire;
 * stays open for a multi-slot role (Supporting Actor) so several people can
 * be hired in one visit, tracked live via "X/Y hired".
 */
export function RoleHiringDrawer({ role, onClose }: RoleHiringDrawerProps) {
  const { state, dispatch } = useStudio();
  const draft = deriveFocusedDraft(state)!;
  const pins = useComparePins();
  const [availableOnly, setAvailableOnly] = useState(false);

  // Body scroll lock + Escape-to-close, same conventions any overlay needs.
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

  const profile = TALENT_PRESENTATION[role];
  const range = ROLE_GENERATION_PROFILES[professionForProductionRole(role)].salaryRange;
  const capacity = effectiveRoleCapacity(role, draft.script);
  const targetPrice = draft.talentTargetPriceByRole[role] ?? logAmount(0.5, range);
  // Excludes anyone already cast into a *different* role on this draft - the
  // shared Actor pool means the same real person could otherwise show up as
  // selectable for both Lead Actor and Supporting Actor at once.
  const hiredElsewhereIds = new Set(draft.talent.filter((a) => a.role !== role).map((a) => a.person.id));
  const hired = draft.talent.filter((a) => a.role === role).map((a) => a.person);
  const atCap = hired.length >= capacity.max;
  // The Character the next hire would fill (null for non-actor roles / once
  // every slot is taken). Its castingGender gates who can even appear as a
  // candidate below - a hard block, so an ineligible actor never shows up
  // for a role they can't play (matches the reducer's own assignment guard).
  const nextCharacter = draft.script && !atCap ? characterForRoleSlot(draft.script, role, hired.length) : null;
  const candidates = state.talentPool[professionForProductionRole(role)].filter(
    (t) => !hiredElsewhereIds.has(t.id) && (!nextCharacter || actorMeetsCharacterGender(t.identity.gender, nextCharacter.castingGender)),
  );
  const showVfxHint = role === 'VFX Supervisor' && draft.genre && VFX_RECOMMENDED_GENRES.has(draft.genre);
  const isActor = profile.category === 'actor';
  // Casting Appeal Rework - Director is the only role with a real interest
  // step (engine/directorAppeal.ts); every other role keeps today's
  // instant-hire behavior. Needs a script to evaluate scriptFit against -
  // without one there's nothing to gate on, so hiring stays instant.
  const isDirectorRole = profile.category === 'director';
  const [lastDirectorResponse, setLastDirectorResponse] = useState<{ personName: string; response: DirectorOfferResponse } | null>(null);
  // Which specific Character the *next* hire would fill - same slot-index
  // contract as characterForCandidate below, surfaced once in the drawer's
  // own header rather than only per-candidate-card, so opening "Cast
  // Supporting Actor" reads as "Casting: Mercedes (Supporting)" (Casting
  // Redesign, Additional Notes point 1 - "we're still looking for our
  // villain," not "Character #4 isn't assigned").

  const { candidates: visible, toleranceUsed } = findCandidatesNearPrice(candidates, role, targetPrice, VISIBLE_CANDIDATE_COUNT);
  const hiredNotVisible = hired.filter((h) => !visible.some((v) => v.id === h.id));
  const displayList = [...hiredNotVisible, ...visible].sort((person) => getTypicalSalaryForRole(person, role));
  const tolerancePercent = Math.round(toleranceUsed * 100);
  // "Available now only" filter: a booked hire is already disabled below (you
  // can't clear their commitments in time), so hiding them declutters the list
  // to people you can actually hire today. Anyone already on this production is
  // never hidden. Defaults off. isAvailableImmediately matches the exact reading
  // TalentStats shows ("Available immediately" vs "Busy until X").
  const onThisDraftIds = new Set(draft.talent.map((a) => a.person.id));
  const shownList = availableOnly
    ? displayList.filter((person) => onThisDraftIds.has(person.id) || isAvailableImmediately(person, state.totalDays))
    : displayList;
  const availabilityHiddenCount = displayList.length - shownList.length;

  // Affordability (a soft warning - talent salary is charged at greenlight, not
  // here): a candidate reads "over budget" if hiring them would put committed
  // spend past cash. A single-slot role currently filled frees that salary on
  // replacement; already-hired people are always affordable.
  const committedSpend = computeCommittedSpend(draft, state.producerPool ?? []);
  const slotFreedSalary = capacity.max === 1 && hired[0] ? getTypicalSalaryForRole(hired[0], role) : 0;
  const remainingBudget = state.studio.cash - committedSpend + slotFreedSalary;
  const isAffordable = (person: Person) =>
    hired.some((h) => h.id === person.id) || getTypicalSalaryForRole(person, role) <= remainingBudget;

  // Candidate reasoning chips. The Director is the one role with a real appeal
  // model (engine/directorAppeal.ts) - its strengths and hard gates (prestige,
  // salary floor) surface as chips, the director-drawer counterpart of the actor
  // card. Every role gets the over-budget warning. Returns the chips plus whether
  // a hard gate should also disable the hire (a doomed offer, like a booked one).
  function candidateReasoning(person: Person): { signals: CandidateSignal[]; hardBlocked: boolean } {
    const signals: CandidateSignal[] = [];
    const appeal = directorAppealByPersonId.get(person.id);
    let hardBlocked = false;
    if (appeal === 'prestige-gate') {
      signals.push({ label: 'Wants more prestige', tone: 'blocked' });
      hardBlocked = true;
    } else if (appeal) {
      signals.push(...directorStrengthSignals(appeal));
      if (appeal.belowSalaryFloor) {
        signals.push({ label: 'Wants more pay', tone: 'blocked' });
        hardBlocked = true;
      }
    }
    // Over-budget now reads off TalentStats' salary affordability dot (Talent
    // Card UX Redesign), so it's no longer duplicated as a chip here.
    return { signals, hardBlocked };
  }

  const allTalent = Object.values(state.talentPool).flat();
  const pinnedTalent = pins.pinnedIds.map((id) => allTalent.find((t) => t.id === id)).filter((t): t is Person => t !== undefined);
  const comparing = pinnedTalent.length >= MAX_PINNED;

  // Casting Appeal Rework - computed once per candidate shown, not
  // re-derived per render pass, so the prestige-gate hint below and
  // selectPerson's own resolution never disagree on the same person.
  // Talent Relationship History (engine/relationships.ts) - a director's
  // persistent standing with the studio, read into their interest score and
  // accept/decline so a loyal filmmaker is easier (and cheaper) to bring back.
  const relationshipFor = (person: Person) => playerRelationshipWith(state.collaborations ?? [], person);

  const directorAppealByPersonId = new Map(
    isDirectorRole && draft.script
      ? displayList.map((person) => [person.id, computeDirectorAppeal(person, draft.script!, state.studio, targetPrice, state.totalDays, relationshipFor(person))] as const)
      : [],
  );

  // Which specific script.cast Character a candidate is being sized up
  // against - an already-hired person keeps the slot they actually filled,
  // an unhired candidate is evaluated against whichever slot they'd fill
  // *next* (hired.length), matching characterForRoleSlot's own
  // fill-in-order contract (engine/castRequirements.ts). null for every
  // non-actor role and once a role's Character slots are exhausted.
  function characterForCandidate(person: Person): ReturnType<typeof characterForRoleSlot> | null {
    if (!draft.script) return null;
    const selected = hired.some((h) => h.id === person.id);
    const slotIndex = selected ? hired.findIndex((h) => h.id === person.id) : hired.length;
    return characterForRoleSlot(draft.script, role, slotIndex);
  }

  function selectPerson(person: Person) {
    if (capacity.max === 1) {
      const current = hired[0];
      const wasEmpty = !current;

      // Casting Appeal Rework - only a genuinely new director hire goes
      // through the interest check; deselecting the current one shouldn't
      // (there's no offer being made). Without a script there's nothing to
      // gate on, so hiring stays instant, same as every other role.
      if (wasEmpty && isDirectorRole && draft.script) {
        const outcome = computeDirectorAppeal(person, draft.script, state.studio, targetPrice, state.totalDays, relationshipFor(person));
        const response = resolveDirectorOfferResponse(outcome, person, relationshipFor(person));
        if (response) setLastDirectorResponse({ personName: person.identity.name, response });
        if (response && response.status !== 'accepted') return;
      }

      dispatch({ type: 'SET_TALENT_FOR_ROLE', role, person: current?.id === person.id ? null : person });
      // Only auto-close on a genuinely new hire, not on deselecting one -
      // a player who just cleared this role almost certainly wants to pick
      // someone else immediately, not get bounced back to the hub.
      if (wasEmpty) {
        setTimeout(onClose, AUTO_CLOSE_DELAY_MS);
      }
      return;
    }
    // Multi-hire role: stays open regardless, so several people can be
    // hired in one visit - see "X/Y hired" below.
    dispatch({ type: 'TOGGLE_TALENT_FOR_ROLE', role, person });
  }

  // Whether a pinned candidate's Cast/Hire action should be disabled in the
  // comparison view - the same hard gates the grid card already respects (role
  // at capacity, booked elsewhere, or a doomed director offer).
  const slotBlocked = (person: Person): boolean => {
    if (hired.some((h) => h.id === person.id)) return false;
    const booked = !!deriveBookedUntil(person.availability.commitments) && deriveBookedUntil(person.availability.commitments)! > state.totalDays;
    return atCap || booked || candidateReasoning(person).hardBlocked;
  };
  const compareSlots: CompareSlot[] = comparing
    ? pinnedTalent.map((person) => ({
        person,
        role,
        category: profile.category,
        script: draft.script,
        character: characterForCandidate(person),
        affordable: isAffordable(person),
        actionLabel: isActor ? 'Cast' : 'Hire',
        actionDisabled: slotBlocked(person),
        onAct: () => selectPerson(person),
        onUnpin: () => pins.toggle(person.id),
      }))
    : [];

  const roleLabel = capacity.max > 1 ? `${role} - ${hired.length}/${capacity.max} ${isActor ? 'cast' : 'hired'}` : role;

  return (
    <>
      <div className="role-drawer-backdrop" onClick={onClose} />
      <div className="role-drawer stack" role="dialog" aria-label={`${isActor ? 'Cast' : 'Hire'} ${role}`}>
        <div className="row-between">
          <div>
            <h2 style={{ margin: 0 }}>{roleLabel}</h2>
            {nextCharacter && (
              <p style={{ margin: '2px 0 0', fontWeight: 600 }}>
                Casting: {nextCharacter.name} ({nextCharacter.prominence})
                {nextCharacter.castingGender && nextCharacter.castingGender !== 'Any' && (
                  <span className="badge" style={{ marginLeft: 8 }}>
                    {castingGenderLabel(nextCharacter.castingGender)}
                  </span>
                )}
              </p>
            )}
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>{profile.blurb}</p>
          </div>
          <Button onClick={onClose}>Close</Button>
        </div>

        <RangeSlider
          label="Target Price"
          min={range.min}
          max={range.max}
          logScale
          value={targetPrice}
          onChange={(price) => dispatch({ type: 'SET_TALENT_TARGET_PRICE', role, price })}
          formatValue={formatMoney}
          description="Drag to set how much you're willing to pay - the candidates shown update to match."
          lowLabel="Cheap"
          highLabel="Star Power"
        />

        <span style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>
          Showing candidates within {tolerancePercent}% of your target price.
          {capacity.max > 1 && ` Hire up to ${capacity.max} for this role.`}
          {displayList.length === 0 && ' Nobody in the studio roster is available at this price - try adjusting the slider.'}
        </span>
        {displayList.length > 0 && (
          <CheckboxToggle
            checked={availableOnly}
            onChange={setAvailableOnly}
            label="Available now only"
            hint={availableOnly && availabilityHiddenCount > 0 ? `${availabilityHiddenCount} booked hidden` : ''}
          />
        )}
        {showVfxHint && <p style={{ margin: 0 }}>This genre benefits strongly from VFX - consider hiring a supervisor.</p>}

        {lastDirectorResponse && (
          <div className={lastDirectorResponse.response.status === 'accepted' ? 'card' : 'card production-tension'} style={{ margin: 0 }}>
            {lastDirectorResponse.response.status === 'accepted'
              ? `${lastDirectorResponse.personName} accepted.`
              : `${lastDirectorResponse.personName}: ${describeDirectorRejection(lastDirectorResponse.response.reason)}`}
          </div>
        )}

        {availableOnly && shownList.length === 0 && displayList.length > 0 && (
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            Every candidate at this price is booked elsewhere. Turn off &ldquo;Available now only&rdquo; to see them.
          </p>
        )}

        {comparing ? (
          compareSlots.length === MAX_PINNED && (
            <div className="stack">
              <h3 style={{ margin: 0 }}>Comparing two candidates</h3>
              <TalentComparison a={compareSlots[0]} b={compareSlots[1]} totalDays={state.totalDays} />
            </div>
          )
        ) : (
          <div className="grid grid-wide">
            {[...shownList.filter((p) => pins.isPinned(p.id)), ...shownList.filter((p) => !pins.isPinned(p.id))].map((person) => {
              const selected = hired.some((h) => h.id === person.id);
              const bookedUntil = deriveBookedUntil(person.availability.commitments);
              const booked = !selected && !!bookedUntil && bookedUntil > state.totalDays;
              const { signals, hardBlocked } = candidateReasoning(person);
              const disabled = !selected && (atCap || booked || hardBlocked);
              return (
                <CandidateCard
                  key={person.id}
                  person={person}
                  role={role}
                  category={profile.category}
                  script={draft.script}
                  character={characterForCandidate(person)}
                  totalDays={state.totalDays}
                  selected={selected}
                  disabled={disabled}
                  booked={booked}
                  pinned={pins.isPinned(person.id)}
                  pinCapped={pins.isFull}
                  affordable={isAffordable(person)}
                  signals={signals}
                  onSelect={() => selectPerson(person)}
                  onTogglePin={() => pins.toggle(person.id)}
                />
              );
            })}
          </div>
        )}

        {capacity.max > 1 && (
          <div className="row-between">
            <span />
            <Button variant="primary" onClick={onClose}>Done</Button>
          </div>
        )}
      </div>
    </>
  );
}
