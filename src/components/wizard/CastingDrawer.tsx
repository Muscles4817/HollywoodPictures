import { useEffect, useState } from 'react';
import { useStudio } from '../../state/StudioContext';
import { deriveFocusedDraft, computeCommittedSpend } from '../../state/selectors';
import { findAssignedPerson, professionForProductionRole } from '../../data/helpers';
import { ROLE_GENERATION_PROFILES } from '../../data/talentGeneration';
import { logAmount } from '../../engine/interpolate';
import { findCandidatesNearPrice } from '../../engine/talentFilter';
import { actorMeetsCharacterGender, personMeetsCharacterAge } from '../../engine/casting';
import { computeActorAppeal } from '../../engine/castingAppeal';
import { estimateDeal } from '../../engine/castingEstimate';
import { deriveFitReadAssist } from '../../engine/talentCardPresentation';
import { candidateStrengthSignals, describeOfferRejection, describeCounterOffer, describeAskingEstimate, describeAcceptanceOdds, type CandidateSignal } from '../../engine/castingPresentation';
import { playerRelationshipWith, type RelationshipStanding } from '../../engine/relationships';
import { notableCastAffinity, type CastAffinity } from '../../engine/pairHistory';
import { formatMoney } from '../common/Money';
import { CHARACTER_ARCHETYPE_LABELS } from '../../data/scriptTagLabels';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { RangeSlider } from '../common/RangeSlider';
import { TalentStats } from '../common/TalentStats';
import { TalentComparison, type CompareSlot } from '../common/TalentComparison';
import { useComparePins, MAX_PINNED } from '../common/useComparePins';
import { CheckboxToggle } from '../common/CheckboxToggle';
import { isAvailableImmediately, getTypicalSalaryForRole, getCrewCareer } from '../../engine/person';
import type { CastingChannel, Person, RoleNegotiation, Script, ScriptCharacter } from '../../types';

type CastingTab = 'open-casting' | 'direct-approach' | 'shortlist';

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
  offeredSalary,
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
  negotiation,
  onAcceptCounter,
  onWalkAway,
  shortlisted,
  onToggleShortlist,
  audited,
  auditioning,
  auditionReadyInDays,
  onAudition,
  castingDirectorSkill,
  relationship,
  castAffinity,
}: {
  person: Person;
  role: 'Lead Actor' | 'Supporting Actor';
  script: Script | null;
  character: ScriptCharacter;
  totalDays: number;
  overall: ReturnType<typeof computeActorAppeal>;
  /** The player's current offer for this role - drives the pre-offer estimate (expected ask + odds) that updates as they move the slider. */
  offeredSalary: number;
  channel?: CastingChannel;
  /** The attached director's name, so an "attachment" draw can say who (engine/castingPresentation.ts). */
  directorName?: string;
  /** The attached director (if any), so the card can surface the director<->lead pairing read (engine/actingModel.ts). */
  director?: Person | null;
  /** Whether hiring this person keeps the film within the studio's cash (a soft warning - salary is charged at greenlight, not now). */
  affordable: boolean;
  /** The production's attached casting director skill (if any) - sharpens the fit read (engine/talentCardPresentation.ts). */
  castingDirectorSkill: number | null;
  /** The studio's standing with this actor - history sharpens the fit read the same way. */
  relationship: RelationshipStanding;
  /** The candidate's most notable chemistry with someone already on the cast (engine/pairHistory.ts), or null. */
  castAffinity: CastAffinity | null;
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
  // Casting Redesign, Phase E - this candidate's live negotiation (a standing
  // counter or a rejection), or null if no offer's been made yet. Drives the
  // counter panel and its accept/walk actions.
  negotiation?: RoleNegotiation | null;
  onAcceptCounter?: () => void;
  onWalkAway?: () => void;
  /** Casting Redesign, Phase 3 - whether this candidate is on the character's shortlist, and the toggle. Absent on cards where shortlisting doesn't apply. */
  shortlisted?: boolean;
  onToggleShortlist?: () => void;
  /** Casting Redesign, Phase 4 - screen-test state: a completed audition (audited, sharpens the read), one in progress (auditioning, with days left), and the request handler. */
  audited?: boolean;
  auditioning?: boolean;
  auditionReadyInDays?: number;
  onAudition?: () => void;
}) {
  // A booked actor can't be cast today - the schedule gate is a hard rejection
  // (engine/castingNegotiation.ts) no offer can clear, so disable and say so.
  // A below-floor offer is NOT blocked any more: under negotiation the actor
  // simply counters (or, if it's insulting, passes), which is a useful outcome
  // to let the player provoke rather than a dead end.
  const available = isAvailableImmediately(person, totalDays);
  const belowFloor = overall?.belowSalaryFloor ?? false;
  const offerBlocked = !available;

  // The candidate's reasoning, both directions, as scannable chips: the
  // strengths the appeal math already found, plus a direct-interest draw and the
  // decision-critical blockers/warnings - the same reads that otherwise only
  // surface as a rejection after the click.
  // Over-budget now reads off TalentStats' salary affordability dot, so it's no
  // longer duplicated as a chip here (Talent Card UX Redesign).
  const signals: CandidateSignal[] = [];
  if (channel === 'InterestedTalent') signals.push({ label: 'Sought you out', tone: 'positive' });
  if (audited) signals.push({ label: '✓ Auditioned', tone: 'positive' });
  if (overall) signals.push(...candidateStrengthSignals(overall, directorName));
  if (belowFloor && !negotiation) signals.push({ label: 'Below their floor', tone: 'blocked' });

  const blockedTitle = !available ? 'Booked elsewhere - unavailable until their commitments clear.' : undefined;

  const countered = negotiation?.status === 'countered' && negotiation.counterSalary != null;
  const rejected = negotiation?.status === 'rejected';

  // Pre-offer read (Casting Redesign, Phase 2 - uncertainty): before any offer's
  // been made, estimate what they'll want and how this offer would land, banded
  // by how readable they are and sharpened by a hired Casting Director / history
  // (deriveFitReadAssist). Hidden once a negotiation is live - by then you have
  // their real counter, not a guess. Updates as the salary slider moves.
  const assist = deriveFitReadAssist(castingDirectorSkill, relationship, true, audited);
  const estimate = overall && !negotiation ? estimateDeal(overall, person, offeredSalary, assist, relationship) : null;
  const oddsSignal = estimate ? describeAcceptanceOdds(estimate.odds) : null;

  return (
    <Card>
      <div className="card-title">{person.identity.name}</div>
      {/* TalentStats' own Availability section already covers "available
          now" vs "busy until X" - no need to repeat it here. */}
      <TalentStats person={person} role={role} category="actor" script={script} character={character} totalDays={totalDays} availabilityMode="blocked" pairedDirector={director ?? null} affordable={affordable} castingDirectorSkill={castingDirectorSkill} relationship={relationship} castAffinity={castAffinity} audited={audited} />
      {signals.length > 0 && (
        <div className="candidate-signals">
          {signals.map((signal) => (
            <span key={signal.label} className={`candidate-signal candidate-signal--${signal.tone}`}>
              {signal.label}
            </span>
          ))}
        </div>
      )}
      {estimate && (
        <div className="candidate-estimate">
          <div className="candidate-estimate__ask">
            {describeAskingEstimate(`${formatMoney(estimate.asking.low)}–${formatMoney(estimate.asking.high)}`, estimate.asking.confidence)}
          </div>
          {oddsSignal && (
            <span className={`candidate-signal candidate-signal--${oddsSignal.tone}`}>{oddsSignal.label}</span>
          )}
        </div>
      )}
      {countered && (
        <div className="card production-tension" style={{ margin: '8px 0 0' }}>
          {describeCounterOffer(person, formatMoney(negotiation!.counterSalary!))}
        </div>
      )}
      {rejected && negotiation?.reason && (
        <div className="card production-tension" style={{ margin: '8px 0 0' }}>
          {describeOfferRejection(negotiation.reason)}
        </div>
      )}
      <div className="row" style={{ marginTop: 8, gap: 8 }}>
        {countered && (
          <Button variant="primary" className="btn-sm" onClick={onAcceptCounter}>
            Accept {formatMoney(negotiation!.counterSalary!)}
          </Button>
        )}
        <Button
          variant={countered ? 'secondary' : 'primary'}
          className="btn-sm"
          onClick={onAct}
          disabled={offerBlocked}
          title={blockedTitle}
        >
          {countered || rejected ? 'Re-offer' : actionLabel}
        </Button>
        {negotiation && (
          <Button variant="secondary" className="btn-sm" onClick={onWalkAway}>
            Walk away
          </Button>
        )}
        {onAudition && !audited && (
          <Button
            variant="secondary"
            className="btn-sm"
            onClick={onAudition}
            disabled={auditioning || !available}
            title={auditioning ? 'Screen test in progress' : !available ? 'Booked elsewhere - audition once they free up.' : 'Arrange a screen test - takes some days and gives you a confident read on their fit.'}
          >
            {auditioning ? `Auditioning… ${auditionReadyInDays}d` : 'Audition'}
          </Button>
        )}
        {onToggleShortlist && (
          <Button variant={shortlisted ? 'primary' : 'secondary'} className="btn-sm" onClick={onToggleShortlist}>
            {shortlisted ? '★ Shortlisted' : '☆ Shortlist'}
          </Button>
        )}
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
  // The actor we last made an offer to - so an accepted sign (which the reducer
  // resolves and binds to this Character) can auto-close the drawer, the same
  // beat the old instant-accept flow did.
  const [pendingOfferId, setPendingOfferId] = useState<string | null>(null);
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
  const castingDirector = findAssignedPerson(draft.talent, 'Casting Director');
  const showCastingDirectorHint = !castingDirector;
  // The attached casting director's eye sharpens every actor read on this film -
  // narrows the fit band and sees through the reputation over/under-read on the
  // card (engine/talentCardPresentation.ts:deriveFitReadAssist), the same skill
  // that already curates the Open Casting batch. undefined with none hired.
  const castingDirectorSkill = castingDirector ? getCrewCareer(castingDirector, 'Casting Director')?.skill ?? null : null;
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
  const committedSpend = computeCommittedSpend(draft, state.producerPool ?? [], state.stuntTeamPool ?? []);
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
  const castAffinityFor = (person: Person) => notableCastAffinity(person, role, draft.talent, state.talentPairings ?? []);

  function appealFor(person: Person) {
    return draft.script
      ? computeActorAppeal(person, character, draft.script, state.studio, director, draft.talent, offeredSalary, state.totalDays, relationshipFor(person))
      : null;
  }

  // This candidate's live negotiation for this Character (a standing counter or
  // rejection), or null before any offer. Re-read from the draft every render.
  const negotiationFor = (person: Person): RoleNegotiation | null =>
    (draft.negotiations ?? []).find((n) => n.characterId === character.id && n.personId === person.id) ?? null;

  // This candidate's screen test for this Character (Phase 4). Completeness is
  // derived from the clock, not stored - audited once readyOnDay has passed.
  const auditionFor = (person: Person) => (draft.auditions ?? []).find((a) => a.characterId === character.id && a.personId === person.id) ?? null;

  /** Make (or raise) an offer at the current target salary - the reducer rolls/reuses the actor's asking price and resolves accept/counter/reject (engine/castingNegotiation.ts). */
  function makeOffer(person: Person) {
    setPendingOfferId(person.id);
    dispatch({ type: 'MAKE_OFFER', characterId: character.id, role, person, offeredSalary });
  }
  function acceptCounter(person: Person) {
    setPendingOfferId(person.id);
    dispatch({ type: 'ACCEPT_COUNTER', characterId: character.id, person });
  }
  function walkAway(person: Person) {
    dispatch({ type: 'WALK_AWAY_NEGOTIATION', characterId: character.id, personId: person.id });
  }

  // An accepted offer/counter binds the actor to this Character (castHere), and
  // clears their negotiation - close the drawer on that beat, as the old
  // instant-accept flow did. A counter or rejection leaves them uncast, so the
  // drawer stays open for the player to respond.
  useEffect(() => {
    if (pendingOfferId && castHere?.id === pendingOfferId) {
      const timer = setTimeout(onClose, AUTO_CLOSE_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [pendingOfferId, castHere, onClose]);

  const hiredElsewhereIds = new Set(draft.talent.filter((a) => a.role !== role).map((a) => a.person.id));
  // Only surface actors who can actually play this character - matching the
  // gender it's written for and not an absurd age for its band (engine/
  // casting.ts), exactly as Open Casting's own applicant generation already
  // does (engine/castingCalls.ts) and as the reducer's hire guard enforces.
  // 'Any' gender / 'Any' age roles are unfiltered; a moderate age stretch
  // still shows (it costs role-fit, not eligibility).
  const eligibleDirectActors = state.talentPool.Actor.filter(
    (t) =>
      !hiredElsewhereIds.has(t.id) &&
      actorMeetsCharacterGender(t.identity.gender, character.castingGender) &&
      personMeetsCharacterAge(t, character, state.totalDays),
  );
  const query = search.trim().toLowerCase();
  // Direct Approach source: a name search reaches the whole eligible pool - the
  // escape hatch past the price window that would otherwise hide the specific
  // actor you're hunting. Without a query, the price-window shortlist as before.
  const directCandidates = query
    ? eligibleDirectActors.filter((t) => t.identity.name.toLowerCase().includes(query)).slice(0, DIRECT_SEARCH_LIMIT)
    : findCandidatesNearPrice(eligibleDirectActors, role, offeredSalary, 9).candidates;

  // Every candidate we might resolve by id - Open Casting applicants plus the
  // whole eligible pool. Shared by the shortlist and the compare view.
  const candidatePool = new Map<string, Person>();
  for (const p of [...(call?.applicants ?? []).map((a) => a.person), ...eligibleDirectActors]) candidatePool.set(p.id, p);

  // Casting Redesign, Phase 3 - the shortlist for THIS Character: candidates the
  // player is tracking to compare and negotiate in parallel before committing
  // one. Resolved to live persons (their fit/estimate/negotiation are all
  // re-derived, never frozen on the entry).
  const shortlistedIds = new Set((draft.shortlist ?? []).filter((s) => s.characterId === character.id).map((s) => s.personId));
  const isShortlisted = (id: string) => shortlistedIds.has(id);
  const toggleShortlist = (person: Person) => dispatch({ type: 'TOGGLE_SHORTLIST', characterId: character.id, role, personId: person.id });
  const shortlistedPersons = [...shortlistedIds].map((id) => candidatePool.get(id)).filter((p): p is Person => p !== undefined);

  // Appeal for everyone we might show or sort, computed once - computeActorAppeal
  // is pure, but there's no reason to re-run it per sort comparison.
  const scored = [...(call?.applicants ?? []).map((a) => a.person), ...directCandidates, ...shortlistedPersons];
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

  // Pin to Compare wiring. Only a booked actor can't be offered today (the
  // schedule gate is the one hard rejection no offer clears); a below-floor
  // offer now just draws a counter, so it no longer disables the action.
  const offerBlockedFor = (person: Person) => !isAvailableImmediately(person, state.totalDays);
  const pinnedPersons = pins.pinnedIds.map((id) => candidatePool.get(id)).filter((p): p is Person => p !== undefined);
  const comparing = pinnedPersons.length >= MAX_PINNED;
  const compareSlots: CompareSlot[] = comparing
    ? pinnedPersons.map((person) => ({
        person,
        role,
        category: 'actor' as const,
        script: draft.script,
        character,
        affordable: isAffordable(person),
        actionLabel: 'Make Offer',
        actionDisabled: offerBlockedFor(person),
        onAct: () => makeOffer(person),
        onUnpin: () => pins.toggle(person.id),
        castingDirectorSkill,
        relationship: relationshipFor(person),
      }))
    : [];

  // How many the availability filter hid in the current tab (for its hint) -
  // measured over the name-searched source, so it reads against what's in view.
  const tabPersons = tab === 'open-casting' ? (call?.applicants ?? []).map((a) => a.person) : directCandidates;
  const availabilityHiddenCount = availableOnly
    ? tabPersons.filter((p) => matchesQuery(p) && !onThisDraftIds.has(p.id) && !isAvailableImmediately(p, state.totalDays)).length
    : 0;

  // One candidate card, wired identically wherever it's shown (Open Casting,
  // Direct Approach, or the Shortlist) - the fit read, pre-offer estimate,
  // negotiation state, shortlist toggle, and offer/accept/walk actions all come
  // from the same place, so a candidate reads and behaves the same in every tab.
  const renderCandidate = (person: Person, opts: { channel?: CastingChannel; onDismiss?: () => void } = {}) => {
    const audition = auditionFor(person);
    const audited = !!audition && state.totalDays >= audition.readyOnDay;
    return (
      <CandidateCard
        key={person.id}
        person={person}
        role={role}
        script={draft.script}
        character={character}
        totalDays={state.totalDays}
        overall={appealById.get(person.id) ?? appealFor(person)}
        offeredSalary={offeredSalary}
        channel={opts.channel}
        directorName={directorName}
        director={director}
        affordable={isAffordable(person)}
        actionLabel="Make Offer"
        onAct={() => makeOffer(person)}
        negotiation={negotiationFor(person)}
        onAcceptCounter={() => acceptCounter(person)}
        onWalkAway={() => walkAway(person)}
        shortlisted={isShortlisted(person.id)}
        onToggleShortlist={() => toggleShortlist(person)}
        audited={audited}
        auditioning={!!audition && !audited}
        auditionReadyInDays={audition ? Math.max(0, audition.readyOnDay - state.totalDays) : undefined}
        onAudition={() => dispatch({ type: 'REQUEST_AUDITION', characterId: character.id, role, personId: person.id })}
        pinned={pins.isPinned(person.id)}
        pinCapped={pins.isFull}
        onTogglePin={() => pins.toggle(person.id)}
        onDismiss={opts.onDismiss}
        castingDirectorSkill={castingDirectorSkill}
        relationship={relationshipFor(person)}
        castAffinity={castAffinityFor(person)}
      />
    );
  };

  return (
    <>
      <div className="role-drawer-backdrop" onClick={onClose} />
      <div className="role-drawer stack" role="dialog" aria-label={`Cast ${character.name}`}>
        <div className="row-between">
          <div>
            <h2 style={{ margin: 0 }}>Who plays {character.name}?</h2>
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
          label="Target Salary for this Role"
          min={range.min}
          max={range.max}
          logScale
          value={offeredSalary}
          onChange={(price) => dispatch({ type: 'SET_TALENT_TARGET_PRICE', role, price })}
          formatValue={formatMoney}
          description="Your offer for this role - it shapes who applies to Open Casting, and it's what each actor weighs when you make them an offer. They may accept, counter for more, or pass; the fee you finally agree is what you pay."
          lowLabel="Cheap"
          highLabel="Star Power"
        />

        {rejectionCount > 0 && (
          <p style={{ margin: 0, fontSize: '0.85em', color: 'var(--text-muted)' }}>
            Turned down {rejectionCount} time{rejectionCount === 1 ? '' : 's'} so far - the search has widened: more
            applicants, including some who wouldn't otherwise have floated to the top.
          </p>
        )}

        <div className="row">
          <Button variant={tab === 'open-casting' ? 'primary' : 'secondary'} onClick={() => setTab('open-casting')}>
            Open Casting
          </Button>
          <Button variant={tab === 'direct-approach' ? 'primary' : 'secondary'} onClick={() => setTab('direct-approach')}>
            Direct Approach
          </Button>
          <Button variant={tab === 'shortlist' ? 'primary' : 'secondary'} onClick={() => setTab('shortlist')}>
            Shortlist{shortlistedPersons.length > 0 ? ` (${shortlistedPersons.length})` : ''}
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
                    {shownApplicants.map((applicant) =>
                      renderCandidate(applicant.person, {
                        channel: applicant.channel,
                        onDismiss: () => dispatch({ type: 'DISMISS_CASTING_APPLICANT', characterId: character.id, personId: applicant.person.id }),
                      }),
                    )}
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
              {shownDirectCandidates.map((person) => renderCandidate(person))}
            </div>
            )}
          </>
        )}

        {!comparing && tab === 'shortlist' && (
          <>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85em' }}>
              Your shortlist for this role - track several contenders at once, open a negotiation with each, and keep
              backups alive until you commit one. Shortlisting is just bookkeeping: it makes no offer on its own.
            </p>
            {shortlistedPersons.length === 0 ? (
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                Nobody shortlisted yet. Use ☆ Shortlist on any candidate in Open Casting or Direct Approach to add them here.
              </p>
            ) : (
              <div className="grid grid-wide">
                {shortlistedPersons.map((person) => renderCandidate(person))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
