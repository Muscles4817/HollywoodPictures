import { useEffect, useState } from 'react';
import { useStudio } from '../../state/StudioContext';
import { ROLE_GENERATION_PROFILES } from '../../data/talentGeneration';
import { TALENT_PRESENTATION, type RoleCategory } from '../../data/talentPresentation';
import { effectiveRoleCapacity, characterForRoleSlot } from '../../engine/castRequirements';
import { actorMeetsCharacterGender, personMeetsCharacterAge, castingGenderLabel, castingAgeBandLabel } from '../../engine/casting';
import { logAmount } from '../../engine/interpolate';
import { deriveOverallScore } from '../common/TalentStats';
import { deriveBookedUntil, getTypicalSalaryForRole, isAvailableImmediately, getCrewCareer } from '../../engine/person';
import { computeDirectorAppeal, resolveDirectorOfferResponse, type DirectorOfferResponse } from '../../engine/directorAppeal';
import { playerRelationshipWith, type RelationshipStanding } from '../../engine/relationships';
import { affordabilityTier, type AffordabilityTier } from '../../engine/affordability';
import { notableCastAffinity, type CastAffinity } from '../../engine/pairHistory';
import { describeDirectorRejection, directorStrengthSignals, type CandidateSignal } from '../../engine/castingPresentation';
import { deriveFocusedDraft, computeCommittedSpend } from '../../state/selectors';
import { professionForProductionRole, findAssignedPerson } from '../../data/helpers';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { TalentStats } from '../common/TalentStats';
import { TalentComparison, type CompareSlot } from '../common/TalentComparison';
import { useComparePins, MAX_PINNED } from '../common/useComparePins';
import { CheckboxToggle } from '../common/CheckboxToggle';
import type { Person, ProductionRole, Script, ScriptCharacter } from '../../types';

const VFX_RECOMMENDED_GENRES = new Set(['Action', 'Sci-Fi', 'Fantasy']);
// The hiring drawer is a search tool: it paginates the whole eligible pool
// rather than dumping every card (or silently capping the list). Tunable page
// size, matching CastingDrawer's DIRECT_PAGE_SIZE.
const HIRE_PAGE_SIZE = 24;
type HireSort = 'fit' | 'value' | 'fee';
const HIRE_SORT_OPTIONS: { key: HireSort; label: string }[] = [
  { key: 'fit', label: 'Fit' },
  { key: 'value', label: 'Value' },
  { key: 'fee', label: 'Fee' },
];
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
  /** Reserve-aware budget read for this candidate (engine/affordability.ts) - a coverable-but-draining fee reads amber, not green. */
  budget: AffordabilityTier;
  /** Candidate reasoning chips (docs/DESIGN_REVIEW_casting_ux.md) - a director's standout draws and any blocker/warning (prestige gate, below salary floor). Empty for roles with no appeal model (most crew). */
  signals: CandidateSignal[];
  /** The production's attached casting director skill (actors only) - sharpens the fit read (engine/talentCardPresentation.ts). */
  castingDirectorSkill: number | null;
  /** The studio's standing with this person - history sharpens the fit read too. */
  relationship: RelationshipStanding;
  /** The candidate's most notable chemistry with someone already on the cast (engine/pairHistory.ts), or null. */
  castAffinity: CastAffinity | null;
  onSelect: () => void;
  onTogglePin: () => void;
}

function CandidateCard({ person, role, category, script, character, totalDays, selected, disabled, booked, pinned, pinCapped, budget, signals, castingDirectorSkill, relationship, castAffinity, onSelect, onTogglePin }: CandidateCardProps) {
  const isActor = category === 'actor';
  return (
    <Card selectable selected={selected} disabled={disabled} onClick={onSelect}>
      <div className="card-title">{person.identity.name}</div>
      {/* TalentStats' own Availability section already says "Busy until X" -
          the drawer only needs to add its own casting-flow state on top
          (Cast/Hired, or Fully cast once the role's at capacity), not repeat
          the calendar read a second time. */}
      <TalentStats person={person} role={role} category={category} script={script} character={character} totalDays={totalDays} availabilityMode="blocked" budget={budget} castingDirectorSkill={castingDirectorSkill} relationship={relationship} castAffinity={castAffinity} />
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
  const [affordableOnly, setAffordableOnly] = useState(false);
  const [hideWontWork, setHideWontWork] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState<HireSort>('fit');

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

  // Any change to what's shown or how it's ordered resets to the first page -
  // otherwise a stale page index lands the player on an empty grid.
  useEffect(() => {
    setPage(0);
  }, [sortBy, search, availableOnly, affordableOnly, hideWontWork]);

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
    (t) =>
      !hiredElsewhereIds.has(t.id) &&
      (!nextCharacter ||
        (actorMeetsCharacterGender(t.identity.gender, nextCharacter.castingGender) &&
          personMeetsCharacterAge(t, nextCharacter, state.totalDays))),
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

  // Phase 1c - the hiring drawer is a SEARCH tool, not a price window: show the
  // whole eligible pool, ranked by the chosen sort and narrowed by the filters.
  // The role's planned allocation (targetPrice) is set on the hub allocation
  // table now, not by a slider here - so the same slider never means "offer" on
  // the casting screen and "filter" on this one.
  const fitOf = (person: Person) => deriveOverallScore(person, role, profile.category, draft.script, characterForCandidate(person)) ?? 0;
  const salaryOf = (person: Person) => getTypicalSalaryForRole(person, role);
  const sortValue = (person: Person) =>
    sortBy === 'fee'
      ? -salaryOf(person)
      : sortBy === 'value'
        ? (salaryOf(person) > 0 ? fitOf(person) / salaryOf(person) : fitOf(person))
        : fitOf(person);
  const hiredNotInPool = hired.filter((h) => !candidates.some((c) => c.id === h.id));
  const displayList = [...hiredNotInPool, ...[...candidates].sort((a, b) => sortValue(b) - sortValue(a))];
  const onThisDraftIds = new Set(draft.talent.map((a) => a.person.id));

  // Talent Relationship History (engine/relationships.ts) - a director's
  // persistent standing with the studio, read into their interest score and
  // accept/decline so a loyal filmmaker is easier (and cheaper) to bring back.
  // Defined up here (ahead of the filters) because the "won't work with me"
  // filter and the director-appeal read both lean on it.
  const relationshipFor = (person: Person) => playerRelationshipWith(state.collaborations ?? [], person);
  const castAffinityFor = (person: Person) => notableCastAffinity(person, role, draft.talent, state.talentPairings ?? []);
  // The production's attached casting director sharpens actor fit reads (TalentStats
  // gates it to actors; harmless to pass for a director/crew hire). undefined with none.
  const attachedCastingDirector = findAssignedPerson(draft.talent, 'Casting Director');
  const castingDirectorSkill = attachedCastingDirector ? getCrewCareer(attachedCastingDirector, 'Casting Director')?.skill ?? null : null;

  // Affordability (a soft warning - talent salary is charged at greenlight, not
  // here): a reserve-aware budget read (engine/affordability.ts). A candidate is
  // only "Within budget" if their fee fits what's left for this film AND leaves
  // the studio's operating reserve intact, not merely because the balance could
  // cover it. A single-slot role currently filled frees that salary on
  // replacement; already-hired people are no new outlay, so always comfortable.
  const committedSpend = computeCommittedSpend(draft, state.producerPool ?? [], state.stuntTeamPool ?? []);
  const slotFreedSalary = capacity.max === 1 && hired[0] ? getTypicalSalaryForRole(hired[0], role) : 0;
  const remainingBudget = state.studio.cash - committedSpend + slotFreedSalary;
  const budgetFor = (person: Person): AffordabilityTier =>
    hired.some((h) => h.id === person.id)
      ? 'comfortable'
      : affordabilityTier({ cost: getTypicalSalaryForRole(person, role), available: remainingBudget, cash: state.studio.cash });

  // The director appeal read for everyone in the pool (not just the shown page),
  // computed once - the "won't work with me" filter runs BEFORE pagination, so it
  // needs each candidate's hard-gate state up front. Empty for every non-director
  // role (crew hire instantly, with no interest step to gate on).
  const directorAppealByPersonId = new Map(
    isDirectorRole && draft.script
      ? displayList.map((person) => [person.id, computeDirectorAppeal(person, draft.script!, state.studio, targetPrice, state.totalDays, relationshipFor(person))] as const)
      : [],
  );

  // Candidate reasoning chips. The Director is the one role with a real appeal
  // model (engine/directorAppeal.ts) - its strengths and hard gates (prestige,
  // salary floor) surface as chips, the director-drawer counterpart of the actor
  // card. Returns the chips plus whether a hard gate should also disable the hire
  // (a doomed offer, like a booked one).
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
  // Whoever won't take this job at any offer we could plausibly make right now -
  // the director's prestige gate / salary-floor refusal (the crew roles that hire
  // instantly never trip it). The "hide who won't work with me" filter drops them.
  const wontWork = (person: Person): boolean => candidateReasoning(person).hardBlocked;

  // Filters. "Available now only" hides booked candidates (a booked hire is
  // disabled anyway); "Affordable only" keeps only picks you can COMFORTABLY
  // afford (fee leaves an operating reserve, not merely coverable); "Hide who
  // won't work with me" drops the hard-gated (a prestige-gated director). A name
  // search narrows by name. Anyone already on this production is never hidden.
  const query = search.trim().toLowerCase();
  const filteredList = displayList.filter((person) => {
    if (onThisDraftIds.has(person.id)) return true;
    if (query && !person.identity.name.toLowerCase().includes(query)) return false;
    if (availableOnly && !isAvailableImmediately(person, state.totalDays)) return false;
    if (affordableOnly && budgetFor(person) !== 'comfortable') return false;
    if (hideWontWork && wontWork(person)) return false;
    return true;
  });

  // Pagination (casting QOL): a real page window over the whole filtered pool,
  // not a silent cap with a "narrow to see the rest" nudge. Clamp the page in
  // case the result set shrank under a new filter (a stale index would show an
  // empty grid).
  const pageCount = Math.max(1, Math.ceil(filteredList.length / HIRE_PAGE_SIZE));
  const pageClamped = Math.min(page, pageCount - 1);
  const pageStart = pageClamped * HIRE_PAGE_SIZE;
  const shownList = filteredList.slice(pageStart, pageStart + HIRE_PAGE_SIZE);

  const allTalent = Object.values(state.talentPool).flat();
  const pinnedTalent = pins.pinnedIds.map((id) => allTalent.find((t) => t.id === id)).filter((t): t is Person => t !== undefined);
  const comparing = pinnedTalent.length >= MAX_PINNED;

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
        budget: budgetFor(person),
        actionLabel: isActor ? 'Cast' : 'Hire',
        actionDisabled: slotBlocked(person),
        onAct: () => selectPerson(person),
        onUnpin: () => pins.toggle(person.id),
        castingDirectorSkill,
        relationship: relationshipFor(person),
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
                {nextCharacter.castingAgeBand && nextCharacter.castingAgeBand !== 'Any' && (
                  <span className="badge" style={{ marginLeft: 8 }} title="The age this role is written for. Casting well outside it is a stretch that costs role-fit; a wildly wrong age can't be cast.">
                    {castingAgeBandLabel(nextCharacter.castingAgeBand)}
                  </span>
                )}
              </p>
            )}
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>{profile.blurb}</p>
          </div>
          <Button onClick={onClose}>Close</Button>
        </div>

        <span style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>
          Browse the roster and narrow it with the controls - the target fee for this role is set on the Cast &amp; Crew budget table; each hire is paid their own quoted salary, shown on their card.
          {capacity.max > 1 && ` Hire up to ${capacity.max} for this role.`}
        </span>
        {displayList.length > 0 && (
          <div className="casting-controls">
            <input
              type="search"
              className="casting-search"
              placeholder="Search by name"
              aria-label="Search candidates by name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <label className="casting-sort">
              <span>Sort</span>
              <select aria-label="Sort candidates" value={sortBy} onChange={(e) => setSortBy(e.target.value as HireSort)}>
                {HIRE_SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </label>
            <CheckboxToggle checked={availableOnly} onChange={setAvailableOnly} label="Available now only" />
            <CheckboxToggle checked={affordableOnly} onChange={setAffordableOnly} label="Affordable only" hint="fee leaves a reserve" />
            {isDirectorRole && (
              <CheckboxToggle checked={hideWontWork} onChange={setHideWontWork} label="Hide who won't work with me" />
            )}
          </div>
        )}
        {showVfxHint && <p style={{ margin: 0 }}>This genre benefits strongly from VFX - consider hiring a supervisor.</p>}

        {lastDirectorResponse && (
          <div className={lastDirectorResponse.response.status === 'accepted' ? 'card' : 'card production-tension'} style={{ margin: 0 }}>
            {lastDirectorResponse.response.status === 'accepted'
              ? `${lastDirectorResponse.personName} accepted.`
              : `${lastDirectorResponse.personName}: ${describeDirectorRejection(lastDirectorResponse.response.reason)}`}
          </div>
        )}

        {shownList.length === 0 && displayList.length > 0 && (
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            No candidates match your filters - clear them to see the rest.
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
                  budget={budgetFor(person)}
                  signals={signals}
                  castingDirectorSkill={castingDirectorSkill}
                  relationship={relationshipFor(person)}
                  castAffinity={castAffinityFor(person)}
                  onSelect={() => selectPerson(person)}
                  onTogglePin={() => pins.toggle(person.id)}
                />
              );
            })}
          </div>
        )}

        {!comparing && pageCount > 1 && (
          <div className="casting-pager">
            <Button
              variant="secondary"
              className="btn-sm"
              disabled={pageClamped === 0}
              onClick={() => setPage(pageClamped - 1)}
            >
              ‹ Prev
            </Button>
            <span className="casting-pager__status">
              Page {pageClamped + 1} of {pageCount} · {filteredList.length} candidate{filteredList.length === 1 ? '' : 's'}
            </span>
            <Button
              variant="secondary"
              className="btn-sm"
              disabled={pageClamped >= pageCount - 1}
              onClick={() => setPage(pageClamped + 1)}
            >
              Next ›
            </Button>
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
