import { useEffect, useState } from 'react';
import { useStudio } from '../../state/StudioContext';
import { ROLE_GENERATION_PROFILES } from '../../data/talentGeneration';
import { TALENT_PRESENTATION, type RoleCategory } from '../../data/talentPresentation';
import { effectiveRoleCapacity, characterForRoleSlot } from '../../engine/castRequirements';
import { logAmount } from '../../engine/interpolate';
import { findCandidatesNearPrice } from '../../engine/talentFilter';
import { deriveBookedUntil, getTypicalSalaryForRole } from '../../engine/person';
import { formatGameDate } from '../../engine/calendar';
import { deriveFocusedDraft } from '../../state/selectors';
import { professionForProductionRole } from '../../data/helpers';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { RangeSlider } from '../common/RangeSlider';
import { formatMoney } from '../common/Money';
import { TalentStats } from '../common/TalentStats';
import type { Person, ProductionRole, Script, ScriptCharacter } from '../../types';

const VFX_RECOMMENDED_GENRES = new Set(['Action', 'Sci-Fi', 'Fantasy']);
const VISIBLE_CANDIDATE_COUNT = 9;
const MAX_PINNED = 2;
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
  selected: boolean;
  disabled: boolean;
  booked: boolean;
  pinned: boolean;
  pinCapped: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
}

function CandidateCard({ person, role, category, script, character, selected, disabled, booked, pinned, pinCapped, onSelect, onTogglePin }: CandidateCardProps) {
  const bookedUntil = deriveBookedUntil(person.availability.commitments);
  return (
    <Card selectable selected={selected} disabled={disabled} onClick={onSelect}>
      <div className="card-title">{person.identity.name}</div>
      <TalentStats person={person} role={role} category={category} script={script} character={character} />
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
        {pinned ? 'Unpin from Compare' : 'Pin to Compare'}
      </Button>
      {selected && <p style={{ color: 'var(--green)', marginTop: 6 }}>Hired</p>}
      {!selected && booked && (
        <p style={{ color: 'var(--text-muted)', marginTop: 6 }}>Filming elsewhere until {formatGameDate(bookedUntil!)}</p>
      )}
      {!selected && !booked && disabled && <p style={{ color: 'var(--text-muted)', marginTop: 6 }}>Cast full</p>}
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
  const [pinnedTalentIds, setPinnedTalentIds] = useState<string[]>([]);

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
  const candidates = state.talentPool[professionForProductionRole(role)].filter((t) => !hiredElsewhereIds.has(t.id));
  const hired = draft.talent.filter((a) => a.role === role).map((a) => a.person);
  const atCap = hired.length >= capacity.max;
  const showVfxHint = role === 'VFX Supervisor' && draft.genre && VFX_RECOMMENDED_GENRES.has(draft.genre);

  const { candidates: visible, toleranceUsed } = findCandidatesNearPrice(candidates, role, targetPrice, VISIBLE_CANDIDATE_COUNT);
  const hiredNotVisible = hired.filter((h) => !visible.some((v) => v.id === h.id));
  const displayList = [...hiredNotVisible, ...visible].sort((person) => getTypicalSalaryForRole(person, role));
  const tolerancePercent = Math.round(toleranceUsed * 100);

  const allTalent = Object.values(state.talentPool).flat();
  const pinnedTalent = pinnedTalentIds.map((id) => allTalent.find((t) => t.id === id)).filter((t): t is Person => t !== undefined);

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

  function togglePin(person: Person) {
    setPinnedTalentIds((prev) => {
      if (prev.includes(person.id)) return prev.filter((id) => id !== person.id);
      if (prev.length >= MAX_PINNED) return prev;
      return [...prev, person.id];
    });
  }

  function selectPerson(person: Person) {
    if (capacity.max === 1) {
      const current = hired[0];
      const wasEmpty = !current;
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

  const roleLabel = capacity.max > 1 ? `${role} - ${hired.length}/${capacity.max} hired` : role;

  return (
    <>
      <div className="role-drawer-backdrop" onClick={onClose} />
      <div className="role-drawer stack" role="dialog" aria-label={`Hire ${role}`}>
        <div className="row-between">
          <div>
            <h2 style={{ margin: 0 }}>{roleLabel}</h2>
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
        {showVfxHint && <p style={{ margin: 0 }}>This genre benefits strongly from VFX - consider hiring a supervisor.</p>}

        <div className="grid grid-wide">
          {displayList.map((person) => {
            const selected = hired.some((h) => h.id === person.id);
            const bookedUntil = deriveBookedUntil(person.availability.commitments);
            const booked = !selected && !!bookedUntil && bookedUntil > state.totalDays;
            const disabled = !selected && (atCap || booked);
            const pinned = pinnedTalentIds.includes(person.id);
            const pinCapped = pinnedTalentIds.length >= MAX_PINNED;
            return (
              <CandidateCard
                key={person.id}
                person={person}
                role={role}
                category={profile.category}
                script={draft.script}
                character={characterForCandidate(person)}
                selected={selected}
                disabled={disabled}
                booked={booked}
                pinned={pinned}
                pinCapped={pinCapped}
                onSelect={() => selectPerson(person)}
                onTogglePin={() => togglePin(person)}
              />
            );
          })}
        </div>

        {pinnedTalentIds.length > 0 && (
          <div className="stack">
            <h3 style={{ margin: 0 }}>Comparing</h3>
            <div className={pinnedTalentIds.length >= MAX_PINNED ? 'compare-slots compare-slots-double' : 'compare-slots'}>
              {pinnedTalent.map((person) => {
                const talentHired = hired.some((h) => h.id === person.id);
                return (
                  <div className="card compare-slot" key={person.id}>
                    <div className="row-between">
                      <div className="card-title" style={{ marginBottom: 0 }}>{person.identity.name}</div>
                      <Button variant="text" onClick={() => togglePin(person)}>Unpin</Button>
                    </div>
                    <TalentStats person={person} role={role} category={profile.category} script={draft.script} character={characterForCandidate(person)} />
                    <Button
                      variant="primary"
                      style={{ marginTop: 8 }}
                      disabled={!talentHired && atCap}
                      onClick={() => selectPerson(person)}
                    >
                      {talentHired ? 'Hired' : atCap ? 'Cast Full' : 'Hire'}
                    </Button>
                  </div>
                );
              })}
              {pinnedTalentIds.length < MAX_PINNED && (
                <div className="card compare-slot-empty">Pin another candidate to compare it here.</div>
              )}
            </div>
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
