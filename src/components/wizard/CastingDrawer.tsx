import { useEffect, useState } from 'react';
import { useStudio } from '../../state/StudioContext';
import { deriveFocusedDraft, computeCommittedSpend } from '../../state/selectors';
import { findAssignedPerson, professionForProductionRole } from '../../data/helpers';
import { ROLE_GENERATION_PROFILES } from '../../data/talentGeneration';
import { logAmount } from '../../engine/interpolate';
import { findCandidatesNearPrice } from '../../engine/talentFilter';
import { actorMeetsCharacterGender } from '../../engine/casting';
import { computeActorAppeal, resolveOfferResponse, type OfferResponse } from '../../engine/castingAppeal';
import { candidateStrengthSignals, describeOfferRejection, type CandidateSignal } from '../../engine/castingPresentation';
import { playerRelationshipWith } from '../../engine/relationships';
import { formatMoney } from '../common/Money';
import { CHARACTER_ARCHETYPE_LABELS } from '../../data/scriptTagLabels';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { RangeSlider } from '../common/RangeSlider';
import { TalentStats } from '../common/TalentStats';
import { TalentComparison, type CompareSlot } from '../common/TalentComparison';
import { useComparePins, MAX_PINNED } from '../common/useComparePins';
import { CheckboxToggle } from '../common/CheckboxToggle';
import { isAvailableImmediately, getTypicalSalaryForRole } from '../../engine/person';
import type { CastingChannel, Person, Script, ScriptCharacter } from '../../types';

type CastingTab = 'open-casting' | 'direct-approach';

// Discovery controls (docs/DESIGN_REVIEW_casting_ux.md) - the player browses by
// intent ("best available I can afford", "highest appeal", "best value"),
// so the fixed, invisible sort becomes a visible, switchable one.
type SortKey = 'appeal' | 'value' | 'price' | 'fame';
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'appeal', label: 'Appeal' },
  { key: 'value', label: 'Value' },
  { key: 'price', label: 'Price' },
  { key: 'fame', label: 'Fame' },
];
// A name search reaches past the price window; cap how many it lists.
const DIRECT_SEARCH_LIMIT = 12;

/** Pinned candidates float to the top of the list, keeping their relative order below (Talent Card UX Redesign - "they remain fixed at the top of the list"). */
function pinnedFirst<T>(items: T[], idOf: (t: T) => string, isPinned: (id: string) => boolean): T[] {
  return [...items.filter((t) => isPinned(idOf(t))), ...items.filter((t) => !isPinned(idOf(t)))];
}

// How long an accepted offer lingers, showing "accepted," before the
// drawer auto-closes - same beat components/wizard/RoleHiringDrawer.tsx's
// own AUTO_CLOSE_DELAY_MS uses.
const AUTO_CLOSE_DELAY_MS = 500;

interface CastingDrawerProps {
  character: ScriptCharacter;
  role: 'Lead Actor' | 'Supporting Actor';
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
  directorName,
  director,
  affordable,
  actionLabel,
  onAct,
  pinned,
  pinCapped,
  onTogglePin,
  onDismiss,
}: {
  person: Person;
  role: 'Lead Actor' | 'Supporting Actor';
  script: Script | null;
  character: ScriptCharacter;
  totalDays: number;
  overall: ReturnType<typeof computeActorAppeal>;
  channel?: CastingChannel;
  /** The attached director's name, so an "attachment" draw can say who (engine/castingPresentation.ts). */
  directorName?: string;
  /** The attached director (if any), so the card can surface the director<->lead pairing read (engine/actingModel.ts). */
  director?: Person | null;
  /** Whether hiring this person keeps the film within the studio's cash (a soft warning - salary is charged at greenlight, not now). */
  affordable: boolean;
  actionLabel: string;
  onAct: () => void;
  pinned: boolean;
  pinCapped: boolean;
  onTogglePin: () => void;
  // Open Casting only - lets the player clear an applicant they're not
  // interested in off the list (and keep them from re-applying). Absent for
  // Direct Approach, whose candidate list is derived from the talent pool, not
  // a stored set of applicants there'd be anything to dismiss from.
  onDismiss?: () => void;
}) {
  // A booked actor OR a below-floor offer can't actually be cast - both are hard
  // gates the sim rejects (engine/castingAppeal.ts:resolveOfferResponse), so an
  // enabled button would only lead to a guaranteed "they passed". Disable it and
  // say why up front (docs/DESIGN_REVIEW_casting_ux.md - surface the reasoning
  // before the click), matching how the crew drawer already treats a booked hire.
  const available = isAvailableImmediately(person, totalDays);
  const belowFloor = overall?.belowSalaryFloor ?? false;
  const offerBlocked = !available || belowFloor;

  // The candidate's reasoning, both directions, as scannable chips: the
  // strengths the appeal math already found, plus a direct-interest draw and the
  // decision-critical blockers/warnings - the same reads that otherwise only
  // surface as a rejection after the click.
  // Over-budget now reads off TalentStats' salary affordability dot, so it's no
  // longer duplicated as a chip here (Talent Card UX Redesign).
  const signals: CandidateSignal[] = [];
  if (channel === 'InterestedTalent') signals.push({ label: 'Sought you out', tone: 'positive' });
  if (overall) signals.push(...candidateStrengthSignals(overall, directorName));
  if (belowFloor) signals.push({ label: 'Wants more pay', tone: 'blocked' });

  const blockedTitle = !available
    ? 'Booked elsewhere - unavailable until their commitments clear.'
    : belowFloor
      ? "Below their salary floor - they won't take this offer. Raise what you're offering."
      : undefined;

  return (
    <Card>
      <div className="card-title">{person.identity.name}</div>
      {/* TalentStats' own Availability section already covers "available
          now" vs "busy until X" - no need to repeat it here. */}
      <TalentStats person={person} role={role} category="actor" script={script} character={character} totalDays={totalDays} availabilityMode="blocked" pairedDirector={director ?? null} affordable={affordable} />
      {signals.length > 0 && (
        <div className="candidate-signals">
          {signals.map((signal) => (
            <span key={signal.label} className={`candidate-signal candidate-signal--${signal.tone}`}>
              {signal.label}
            </span>
          ))}
        </div>
      )}
      <div className="row" style={{ marginTop: 8, gap: 8 }}>
        <Button
          variant="primary"
          className="btn-sm"
          onClick={onAct}
          disabled={offerBlocked}
          title={blockedTitle}
        >
          {actionLabel}
        </Button>
        <Button
          variant={pinned ? 'primary' : 'secondary'}
          className="btn-sm"
          disabled={!pinned && pinCapped}
          onClick={onTogglePin}
        >
          {pinned ? 'Pinned' : 'Pin to Compare'}
        </Button>
        {onDismiss && (
          <Button variant="secondary" className="btn-sm" onClick={onDismiss}>
            Dismiss
          </Button>
        )}
      </div>
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
export function CastingDrawer({ character, role, onClose }: CastingDrawerProps) {
  const { state, dispatch } = useStudio();
  const draft = deriveFocusedDraft(state)!;
  const [tab, setTab] = useState<CastingTab>('open-casting');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [affordableOnly, setAffordableOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('appeal');
  const [search, setSearch] = useState('');
  const [lastResponse, setLastResponse] = useState<{ personName: string; response: OfferResponse } | null>(null);
  // Pin to Compare (Talent Card UX Redesign) - now available on the actor
  // casting flow too, both Open Casting and Direct Approach, where it was
  // previously missing entirely. Two pins swap the browse grid for the
  // dedicated head-to-head comparison view.
  const pins = useComparePins();

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
  // Slot-bound casting (docs/DESIGN_REVIEW_casting_slot_binding.md): this
  // Character can be cast in any order, and casting it again recasts it. Who
  // (if anyone) currently plays it comes straight from the binding, not from
  // this row's position in the cast list.
  const castHere = draft.talent.find((a) => a.role === role && a.characterId === character.id)?.person ?? null;

  // Affordability (a soft warning - talent salary is charged at greenlight, not
  // at casting): a candidate reads "over budget" if hiring them would put the
  // draft's committed spend past the studio's cash. Recasting frees the current
  // occupant's salary, so add that back into what's available before comparing.
  const directorName = director?.identity.name;
  const committedSpend = computeCommittedSpend(draft, state.producerPool ?? []);
  const slotFreedSalary = castHere ? getTypicalSalaryForRole(castHere, role) : 0;
  const remainingBudget = state.studio.cash - committedSpend + slotFreedSalary;
  const isAffordable = (person: Person) => getTypicalSalaryForRole(person, role) <= remainingBudget;

  const range = ROLE_GENERATION_PROFILES[professionForProductionRole(role)].salaryRange;
  const offeredSalary = draft.talentTargetPriceByRole[role] ?? logAmount(0.5, range);
  const rejectionCount = call?.rejectionCount ?? 0;

  // Talent Relationship History (engine/relationships.ts) - the studio's
  // persistent standing with each candidate, read into both the appeal score
  // and the accept/decline so a loyal actor is easier (and cheaper) to land and
  // a grudge harder.
  const relationshipFor = (person: Person) => playerRelationshipWith(state.collaborations ?? [], person);

  function appealFor(person: Person) {
    return draft.script
      ? computeActorAppeal(person, character, draft.script, state.studio, director, draft.talent, offeredSalary, state.totalDays, relationshipFor(person))
      : null;
  }

  /** Shared by both tabs - resolves the offer, then either finalizes the assignment or records the rejection, per engine/castingAppeal.ts:resolveOfferResponse. */
  function attemptToAttach(person: Person) {
    const appeal = appealFor(person);
    if (!appeal) return;
    const response = resolveOfferResponse(appeal, person, relationshipFor(person));
    setLastResponse({ personName: person.identity.name, response });
    if (response.status === 'accepted') {
      dispatch({ type: 'TOGGLE_TALENT_FOR_ROLE', role, person, characterId: character.id });
      // Same beat RoleHiringDrawer's own AUTO_CLOSE_DELAY_MS uses - long
      // enough for the "accepted" message above to actually register
      // before the drawer closes out from under it.
      setTimeout(onClose, AUTO_CLOSE_DELAY_MS);
    } else {
      dispatch({ type: 'RECORD_CASTING_REJECTION', characterId: character.id, role });
    }
  }

  const hiredElsewhereIds = new Set(draft.talent.filter((a) => a.role !== role).map((a) => a.person.id));
  // Only surface actors who can actually play this character - matching the
  // gender it's written for (engine/casting.ts), exactly as Open Casting's
  // own applicant generation already does (engine/castingCalls.ts) and as the
  // reducer's hire guard enforces. 'Any' roles are unfiltered.
  const eligibleDirectActors = state.talentPool.Actor.filter(
    (t) => !hiredElsewhereIds.has(t.id) && actorMeetsCharacterGender(t.identity.gender, character.castingGender),
  );
  const query = search.trim().toLowerCase();
  // Direct Approach source: a name search reaches the whole eligible pool - the
  // escape hatch past the price window that would otherwise hide the specific
  // actor you're hunting. Without a query, the price-window shortlist as before.
  const directCandidates = query
    ? eligibleDirectActors.filter((t) => t.identity.name.toLowerCase().includes(query)).slice(0, DIRECT_SEARCH_LIMIT)
    : findCandidatesNearPrice(eligibleDirectActors, role, offeredSalary, 9).candidates;

  // Appeal for everyone we might show or sort, computed once - computeActorAppeal
  // is pure, but there's no reason to re-run it per sort comparison.
  const scored = [...(call?.applicants ?? []).map((a) => a.person), ...directCandidates];
  const appealById = new Map(scored.map((p) => [p.id, appealFor(p)]));
  const appealOverall = (person: Person) => appealById.get(person.id)?.overall ?? 0;

  // Filters. "Available now only": a booked actor can't be cast today (the offer
  // is hard-rejected on the schedule gate), so hiding them cuts the list to
  // people an offer could land. "Affordable only": hides picks that would put
  // the film over budget. A name search narrows by name. Anyone already on this
  // production is never hidden. All default off/empty, so the full roster is the
  // baseline (isAvailableImmediately matches the card's own "Available now" read).
  const onThisDraftIds = new Set(draft.talent.map((a) => a.person.id));
  const matchesQuery = (person: Person) => !query || person.identity.name.toLowerCase().includes(query);
  const passesFilters = (person: Person) => {
    if (!matchesQuery(person)) return false;
    const onDraft = onThisDraftIds.has(person.id);
    if (availableOnly && !onDraft && !isAvailableImmediately(person, state.totalDays)) return false;
    if (affordableOnly && !onDraft && !isAffordable(person)) return false;
    return true;
  };

  // Sort by the player's chosen intent. Appeal/Value read the same appeal the
  // acceptance math uses; Value is appeal per pound; Price is cheapest-first.
  const sortValue = (person: Person): number => {
    const salary = getTypicalSalaryForRole(person, role);
    switch (sortBy) {
      case 'value': return salary > 0 ? appealOverall(person) / salary : appealOverall(person);
      case 'price': return -salary;
      case 'fame': return person.reputation.fame;
      default: return appealOverall(person);
    }
  };
  const bySort = (a: Person, b: Person) => sortValue(b) - sortValue(a);

  const shownApplicants = pinnedFirst(
    (call?.applicants ?? []).filter((a) => passesFilters(a.person)).sort((a, b) => bySort(a.person, b.person)),
    (a) => a.person.id,
    pins.isPinned,
  );
  const shownDirectCandidates = pinnedFirst(directCandidates.filter(passesFilters).sort(bySort), (p) => p.id, pins.isPinned);

  // Pin to Compare wiring. A booked actor or a below-floor offer can't be cast
  // today (the same hard gates the card and its Cast button already respect),
  // so the comparison view's action is disabled for exactly those.
  const offerBlockedFor = (person: Person) =>
    !isAvailableImmediately(person, state.totalDays) || (appealById.get(person.id)?.belowSalaryFloor ?? false);
  const candidateById = new Map<string, Person>();
  for (const p of [...(call?.applicants ?? []).map((a) => a.person), ...eligibleDirectActors]) candidateById.set(p.id, p);
  const pinnedPersons = pins.pinnedIds.map((id) => candidateById.get(id)).filter((p): p is Person => p !== undefined);
  const comparing = pinnedPersons.length >= MAX_PINNED;
  const compareSlots: CompareSlot[] = comparing
    ? pinnedPersons.map((person) => ({
        person,
        role,
        category: 'actor' as const,
        script: draft.script,
        character,
        affordable: isAffordable(person),
        actionLabel: 'Cast',
        actionDisabled: offerBlockedFor(person),
        onAct: () => attemptToAttach(person),
        onUnpin: () => pins.toggle(person.id),
      }))
    : [];

  // How many the availability filter hid in the current tab (for its hint) -
  // measured over the name-searched source, so it reads against what's in view.
  const tabPersons = tab === 'open-casting' ? (call?.applicants ?? []).map((a) => a.person) : directCandidates;
  const availabilityHiddenCount = availableOnly
    ? tabPersons.filter((p) => matchesQuery(p) && !onThisDraftIds.has(p.id) && !isAvailableImmediately(p, state.totalDays)).length
    : 0;

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

        {castHere && (
          <p style={{ margin: 0 }}>
            Currently cast: {castHere.identity.name}. Casting someone below recasts the role.
          </p>
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

        {comparing && compareSlots.length === MAX_PINNED && (
          <div className="stack">
            <h3 style={{ margin: 0 }}>Comparing two candidates</h3>
            <TalentComparison a={compareSlots[0]} b={compareSlots[1]} totalDays={state.totalDays} />
          </div>
        )}

        {!comparing && (tab === 'direct-approach' || (!!call && call.applicants.length > 0)) && (
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
              <select aria-label="Sort candidates" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}>
                {SORT_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
            </label>
            <CheckboxToggle
              checked={availableOnly}
              onChange={setAvailableOnly}
              label="Available now only"
              hint={availableOnly && availabilityHiddenCount > 0 ? `${availabilityHiddenCount} hidden` : ''}
            />
            <CheckboxToggle checked={affordableOnly} onChange={setAffordableOnly} label="Affordable only" />
          </div>
        )}

        {!comparing && tab === 'open-casting' && (
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
                ) : shownApplicants.length === 0 ? (
                  <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                    No applicants match your search or filters - clear them to see the rest.
                  </p>
                ) : (
                  <div className="grid grid-wide">
                    {shownApplicants.map((applicant) => (
                      <CandidateCard
                        key={applicant.person.id}
                        person={applicant.person}
                        role={role}
                        script={draft.script}
                        character={character}
                        totalDays={state.totalDays}
                        overall={appealById.get(applicant.person.id) ?? null}
                        channel={applicant.channel}
                        directorName={directorName}
                        director={director}
                        affordable={isAffordable(applicant.person)}
                        actionLabel="Cast"
                        onAct={() => attemptToAttach(applicant.person)}
                        pinned={pins.isPinned(applicant.person.id)}
                        pinCapped={pins.isFull}
                        onTogglePin={() => pins.toggle(applicant.person.id)}
                        onDismiss={() => dispatch({ type: 'DISMISS_CASTING_APPLICANT', characterId: character.id, personId: applicant.person.id })}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {!comparing && tab === 'direct-approach' && (
          <>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85em' }}>
              Target a specific actor directly, rather than waiting for Open Casting to surface them - the same
              acceptance math applies either way.
            </p>
            {shownDirectCandidates.length === 0 ? (
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                {query
                  ? `No actors match "${search.trim()}" for this role.`
                  : directCandidates.length > 0
                    ? 'No actors match your filters - clear them to see the rest.'
                    : 'No actors near this price. Adjust the offered salary, or search by name to reach past this window.'}
              </p>
            ) : (
            <div className="grid grid-wide">
              {shownDirectCandidates.map((person) => (
                <CandidateCard
                  key={person.id}
                  person={person}
                  role={role}
                  script={draft.script}
                  character={character}
                  totalDays={state.totalDays}
                  overall={appealById.get(person.id) ?? null}
                  directorName={directorName}
                  affordable={isAffordable(person)}
                  actionLabel="Make Offer"
                  onAct={() => attemptToAttach(person)}
                  pinned={pins.isPinned(person.id)}
                  pinCapped={pins.isFull}
                  onTogglePin={() => pins.toggle(person.id)}
                />
              ))}
            </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
