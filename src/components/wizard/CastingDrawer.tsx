import { useEffect, useState } from 'react';
import { useStudio } from '../../state/StudioContext';
import { deriveFocusedDraft, computeCommittedSpend } from '../../state/selectors';
import { findAssignedPerson, professionForProductionRole } from '../../data/helpers';
import { ROLE_GENERATION_PROFILES } from '../../data/talentGeneration';
import { logAmount } from '../../engine/interpolate';
import { directApproachFameFloor } from '../../engine/talentFilter';
import { actorMeetsCharacterGender, personMeetsCharacterAge } from '../../engine/casting';
import { computeActorAppeal, countActorsFreedByDelay, computeSalaryFit, overallWithSalaryFit } from '../../engine/castingAppeal';
import { estimateDeal } from '../../engine/castingEstimate';
import { deriveFitReadAssist, deriveFitRead, deriveFitReason, deriveFitConfidence, deriveRiskRead, gateKnownAxes, knownAxisCoverage } from '../../engine/talentCardPresentation';
import { deriveCastingDirectorTake, describeCastingDirectorTake, type CastingDirectorTake } from '../../engine/castingDirectorAdvice';
import { candidateStrengthSignals, describeOfferRejection, describeCounterOffer, describeAskingEstimate, describeAcceptanceOdds, describeOpenCastingForecast, describeAuditionResult, type CandidateSignal } from '../../engine/castingPresentation';
import { forecastOpenCasting } from '../../engine/castingCalls';
import { playerRelationshipWith, type RelationshipStanding } from '../../engine/relationships';
import { notableCastAffinity, type CastAffinity } from '../../engine/pairHistory';
import { formatMoney } from '../common/Money';
import { CHARACTER_ARCHETYPE_LABELS } from '../../data/scriptTagLabels';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { RangeSlider } from '../common/RangeSlider';
import { TalentStats, deriveOverallScore, deriveRoleFitBreakdown } from '../common/TalentStats';
import { TalentComparison, type CompareSlot } from '../common/TalentComparison';
import { useComparePins, MAX_PINNED } from '../common/useComparePins';
import { CheckboxToggle } from '../common/CheckboxToggle';
import { isAvailableImmediately, getTypicalSalaryForRole, getCrewCareer, getActorCareer } from '../../engine/person';
import { getPersonAge } from '../../types';
import { gameDateFromTotalDays } from '../../engine/calendar';
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
// Direct Approach can now surface the whole scoutable pool, so cap how many
// cards render at once; the honest overflow count tells the player to narrow
// with filters rather than silently hiding the rest.
const DIRECT_DISPLAY_LIMIT = 40;

// Casting Redesign, Phase 5 - Direct Approach becomes a proper search tool, not
// a sort-only list: filter the eligible pool by the facets a producer actually
// scouts on. These map to fields every Person carries, so they're always
// meaningful (age/language/awards facets that need cross-referencing filmography
// are deferred - see the design doc). 'any' is the no-op default throughout.
type GenderPick = 'any' | 'Male' | 'Female' | 'NonBinary';
type FamePick = 'any' | 'star' | 'established' | 'rising' | 'unknown';
type AgePick = 'any' | 'le25' | 'a26to35' | 'a36to45' | 'a46to60' | 'a60plus';

const GENDER_OPTIONS: { key: GenderPick; label: string }[] = [
  { key: 'any', label: 'Any gender' }, { key: 'Female', label: 'Women' }, { key: 'Male', label: 'Men' }, { key: 'NonBinary', label: 'Non-binary' },
];
const FAME_OPTIONS: { key: FamePick; label: string }[] = [
  { key: 'any', label: 'Any fame' }, { key: 'star', label: 'Star draw' }, { key: 'established', label: 'Established' }, { key: 'rising', label: 'Rising' }, { key: 'unknown', label: 'Unknown' },
];
const AGE_OPTIONS: { key: AgePick; label: string }[] = [
  { key: 'any', label: 'Any age' }, { key: 'le25', label: '25 & under' }, { key: 'a26to35', label: '26–35' }, { key: 'a36to45', label: '36–45' }, { key: 'a46to60', label: '46–60' }, { key: 'a60plus', label: '60+' },
];

/** Fame band, matching the qualitativeMagnitude cutoffs the cards already read by. */
function fameInBand(fame: number, pick: FamePick): boolean {
  switch (pick) {
    case 'star': return fame >= 62;
    case 'established': return fame >= 45 && fame < 62;
    case 'rising': return fame >= 28 && fame < 45;
    case 'unknown': return fame < 28;
    default: return true;
  }
}

function ageInGroup(age: number | undefined, pick: AgePick): boolean {
  if (pick === 'any') return true;
  if (age === undefined) return false; // an unknown age can't satisfy a specific band
  switch (pick) {
    case 'le25': return age <= 25;
    case 'a26to35': return age >= 26 && age <= 35;
    case 'a36to45': return age >= 36 && age <= 45;
    case 'a46to60': return age >= 46 && age <= 60;
    case 'a60plus': return age >= 60;
  }
}

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
  advertisedSalary,
  salaryRange,
  channel,
  directorName,
  director,
  affordable,
  actionLabel,
  onMakeOffer,
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
  onWaitForActor,
  waitAlsoFrees,
  castingDirectorTake,
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
  /** The role's advertised salary (planned allocation / what shapes Open Casting) - the default this candidate's own offer starts from. Not the fee: that's the per-candidate offer below. */
  advertisedSalary: number;
  /** The salary range for this role, so the per-candidate offer control has sensible bounds. */
  salaryRange: { min: number; max: number };
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
  /** Make this candidate's offer at the given amount (Phase 1a - the per-candidate offer, not the advertised default). */
  onMakeOffer: (amount: number) => void;
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
  /** Casting Redesign, Phase 6 - wait for a booked actor: pushes the shoot start to free them. waitAlsoFrees is how many other candidates the same delay would free (the ripple). */
  onWaitForActor?: () => void;
  waitAlsoFrees?: number;
  /** Casting Redesign, Phase 7 - the casting director's consolidated take on this candidate, or null when no CD is hired. Computed by the drawer so the card and compare view agree. */
  castingDirectorTake?: CastingDirectorTake | null;
}) {
  // A booked actor can't be cast today - the schedule gate is a hard rejection
  // (engine/castingNegotiation.ts) no offer can clear, so disable and say so.
  // A below-floor offer is NOT blocked any more: under negotiation the actor
  // simply counters (or, if it's insulting, passes), which is a useful outcome
  // to let the player provoke rather than a dead end.
  // Availability is read against the PLANNED shoot start (Phase 6), not just
  // today - so waiting for a booked actor (which pushes the start) genuinely
  // clears the gate. The appeal's schedule is computed at plannedStartDay, so
  // read it straight from there; fall back to today only when there's no appeal.
  // Phase 1a: this candidate's own offer. The top slider sets the role's
  // ADVERTISED salary (shapes Open Casting, the default here); the actual fee you
  // put to THIS actor is set per-candidate, so two shortlisted contenders can
  // carry different offers. Defaults to their live counter if they've countered
  // (so a re-offer starts at the ask), else the advertised salary; re-baselines
  // when either changes.
  const counterSalary = negotiation?.status === 'countered' ? negotiation.counterSalary : undefined;
  const defaultOffer = counterSalary ?? advertisedSalary;
  const [offer, setOffer] = useState(defaultOffer);
  useEffect(() => { setOffer(defaultOffer); }, [defaultOffer]);

  const sched = overall?.schedule ?? null;
  const available = sched ? sched.status === 'available' : isAvailableImmediately(person, totalDays);
  // Below-floor now reads against THIS candidate's offer, not the advertised
  // default (effectiveMinimum is offer-independent, so this is exact).
  const belowFloor = overall ? offer < overall.effectiveMinimum : false;
  const offerBlocked = !available;

  // `overall` is computed once at the role's ADVERTISED salary. Every read that
  // depends on the money the player is actually offering THIS candidate must use
  // the live per-candidate `offer` instead, or the card contradicts itself -
  // "Happy with the pay" while the slider sits below their floor, an odds chip
  // that never budges as you drag. salaryFit is the only offer-dependent appeal
  // factor, so recompute just that and fold it back into `overall` (a cheap,
  // exact re-derivation - overallWithSalaryFit is linear in salaryFit).
  const liveAppeal = overall
    ? (() => {
        const typicalSalary = getActorCareer(person)?.typicalSalary ?? offer;
        const salaryFit = computeSalaryFit(offer, overall.effectiveMinimum, typicalSalary);
        return { ...overall, salaryFit, overall: overallWithSalaryFit(overall, salaryFit) };
      })()
    : null;

  // The candidate's reasoning, both directions, as scannable chips: the
  // strengths the appeal math already found, plus a direct-interest draw and the
  // decision-critical blockers/warnings - the same reads that otherwise only
  // surface as a rejection after the click.
  // Over-budget now reads off TalentStats' salary affordability dot, so it's no
  // longer duplicated as a chip here (Talent Card UX Redesign).
  const signals: CandidateSignal[] = [];
  if (channel === 'InterestedTalent') signals.push({ label: 'Sought you out', tone: 'positive' });
  if (audited) signals.push({ label: '✓ Auditioned', tone: 'positive' });
  if (liveAppeal) signals.push(...candidateStrengthSignals(liveAppeal, directorName));
  if (belowFloor && !negotiation) signals.push({ label: 'Below their floor', tone: 'blocked' });

  const blockedTitle = !available ? 'Booked elsewhere - wait for them (below) to push your shoot, or pick someone free now.' : undefined;

  const countered = negotiation?.status === 'countered' && negotiation.counterSalary != null;
  const rejected = negotiation?.status === 'rejected';

  // Pre-offer read (Casting Redesign, Phase 2 - uncertainty): before any offer's
  // been made, estimate what they'll want and how this offer would land, banded
  // by how readable they are and sharpened by a hired Casting Director / history
  // (deriveFitReadAssist). Hidden once a negotiation is live - by then you have
  // their real counter, not a guess. Updates as the salary slider moves.
  const assist = deriveFitReadAssist(castingDirectorSkill, relationship, true, audited);
  const deal = liveAppeal ? estimateDeal(liveAppeal, person, offer, assist, relationship) : null;
  const estimate = deal && !negotiation ? deal : null; // the pre-offer read is hidden once a negotiation is live
  const oddsSignal = estimate ? describeAcceptanceOdds(estimate.odds) : null;

  // Casting Director's take (Phase 7): the CD's single, consolidated read on this
  // candidate - a recommendation and why, only present when a Casting Director is
  // hired (deriveCastingDirectorTake returns null otherwise) and only as sharp as
  // their skill. Computed once by the drawer (castingDirectorTakeFor) and passed
  // in, so the card and the compare view show the exact same take.
  // The screen-test report (casting QOL): when the audition has come back, lead
  // the card with the diegetic "here's how they read" beat, graded by the true
  // character fit the test now reveals - the payoff for arranging it.
  const auditionReport = audited && script
    ? (() => {
        const fitScore = deriveOverallScore(person, role, 'actor', script, character);
        return fitScore !== null ? describeAuditionResult(person.identity.name, character.name, person.id, fitScore) : null;
      })()
    : null;

  return (
    <Card>
      <div className="card-title">{person.identity.name}</div>
      {auditionReport && (
        <div className="audition-report">
          <span className="audition-report__eyebrow">🎬 Screen test</span>
          <p className="audition-report__body">{auditionReport}</p>
        </div>
      )}
      {/* TalentStats' own Availability section already covers "available
          now" vs "busy until X" - no need to repeat it here. */}
      <TalentStats person={person} role={role} category="actor" script={script} character={character} totalDays={totalDays} availabilityMode="blocked" pairedDirector={director ?? null} affordable={affordable} castingDirectorSkill={castingDirectorSkill} relationship={relationship} castAffinity={castAffinity} audited={audited} />
      {castingDirectorTake && (
        <div className={`cd-take cd-take--${castingDirectorTake.recommendation}`}>
          <span className="cd-take__label">Casting director&rsquo;s take</span>
          <span className="cd-take__body">{describeCastingDirectorTake(castingDirectorTake)}</span>
        </div>
      )}
      {signals.length > 0 && (
        <div className="candidate-signals">
          {signals.map((signal) => (
            <span key={signal.label} className={`candidate-signal candidate-signal--${signal.tone}`}>
              {signal.label}
            </span>
          ))}
        </div>
      )}
      {sched && sched.status !== 'available' && onWaitForActor && (
        <div className="candidate-schedule">
          <span className="candidate-schedule__note">
            Booked - free in {sched.delayDays} day{sched.delayDays === 1 ? '' : 's'}.
          </span>
          <Button variant="secondary" className="btn-sm" onClick={onWaitForActor}>
            Wait for them (+{sched.delayDays}d)
          </Button>
          {waitAlsoFrees ? (
            <span className="candidate-schedule__ripple">The same delay also frees {waitAlsoFrees} other candidate{waitAlsoFrees === 1 ? '' : 's'}.</span>
          ) : null}
        </div>
      )}
      {!offerBlocked && (
        <div className="candidate-offer">
          <RangeSlider
            label="Your offer"
            min={salaryRange.min}
            max={salaryRange.max}
            logScale
            value={offer}
            onChange={setOffer}
            formatValue={formatMoney}
            description="What you'll put to this actor - independent of other candidates."
          />
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
          onClick={() => onMakeOffer(offer)}
          disabled={offerBlocked}
          title={blockedTitle}
        >
          {countered || rejected ? `Re-offer ${formatMoney(offer)}` : `${actionLabel} ${formatMoney(offer)}`}
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
  // Phase 5 - Direct Approach facet filters (all default to 'any' = no-op).
  const [genderPick, setGenderPick] = useState<GenderPick>('any');
  const [famePick, setFamePick] = useState<FamePick>('any');
  const [agePick, setAgePick] = useState<AgePick>('any');
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

  // Opening this character's drawer IS the player seeing their completed screen
  // tests, so acknowledge any that have come back - that clears the "audition
  // came back" Inbox beat/badge for this character and stops it re-pinging. Only
  // fires when there's actually an unacknowledged, ready audition here, so it's a
  // no-op in the common case (the reducer also guards, returning the same state).
  const hasUnseenAudition = (draft.auditions ?? []).some(
    (a) => a.characterId === character.id && state.totalDays >= a.readyOnDay && !a.acknowledged,
  );
  useEffect(() => {
    if (hasUnseenAudition) dispatch({ type: 'ACKNOWLEDGE_AUDITIONS', characterId: character.id });
  }, [hasUnseenAudition, character.id, dispatch]);

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
  const advertisedSalary = draft.talentTargetPriceByRole[role] ?? logAmount(0.5, range);
  const rejectionCount = call?.rejectionCount ?? 0;

  // Talent Relationship History (engine/relationships.ts) - the studio's
  // persistent standing with each candidate, read into both the appeal score
  // and the accept/decline so a loyal actor is easier (and cheaper) to land and
  // a grudge harder.
  const relationshipFor = (person: Person) => playerRelationshipWith(state.collaborations ?? [], person);
  const castAffinityFor = (person: Person) => notableCastAffinity(person, role, draft.talent, state.talentPairings ?? []);

  // The planned shoot start (Phase 6): today, pushed out by any delay the player
  // has taken to wait for a booked actor. Every schedule read - the appeal gate,
  // the availability filters, the cards - measures against THIS, so waiting
  // genuinely opens up who can be cast.
  const plannedStartOffset = draft.plannedStartOffsetDays ?? 0;
  const plannedStartDay = state.totalDays + plannedStartOffset;

  function appealFor(person: Person) {
    return draft.script
      ? computeActorAppeal(person, character, draft.script, state.studio, director, draft.talent, advertisedSalary, plannedStartDay, relationshipFor(person))
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
  // Phase 1a: the offer is candidate-specific now, passed from the card's own
  // control (defaulting to the role's advertised salary). The top slider sets the
  // advertised budget, not the fee any one actor is offered.
  function makeOffer(person: Person, offeredSalary: number) {
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
  // Direct Approach is a SCOUTING screen, not a price window (casting redesign
  // follow-up): it shows the whole eligible pool you could plausibly approach by
  // name, and the salary bar is only your offer, never a filter on who's listed.
  // Who's scoutable is gated by fame and lowered by a Casting Director
  // (engine/talentFilter.ts) - below the floor sit hidden gems only a casting
  // call can surface. Anyone already on this draft stays visible regardless, so
  // you can always see and recast your own picks.
  const onThisDraftIds = new Set(draft.talent.map((a) => a.person.id));
  const directFameFloor = directApproachFameFloor(castingDirectorSkill);
  const directSourcePool = eligibleDirectActors.filter(
    (t) => onThisDraftIds.has(t.id) || t.reputation.fame >= directFameFloor,
  );
  // Eligible actors currently gated out of Direct Approach by fame - the ones a
  // (better) Casting Director would surface, or a casting call could discover.
  const hiddenByFameCount = eligibleDirectActors.filter(
    (t) => !onThisDraftIds.has(t.id) && t.reputation.fame < directFameFloor,
  ).length;

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
  const scored = [...(call?.applicants ?? []).map((a) => a.person), ...directSourcePool, ...shortlistedPersons];
  const appealById = new Map(scored.map((p) => [p.id, appealFor(p)]));
  const appealOverall = (person: Person) => appealById.get(person.id)?.overall ?? 0;

  // The casting director's consolidated take on a candidate (Phase 7), computed
  // once here so the card and the head-to-head compare view show the identical
  // read - built from the same fit/odds/risk/affordability the card shows. Null
  // when no casting director is hired (deriveCastingDirectorTake gates on it).
  const castingDirectorTakeFor = (person: Person): CastingDirectorTake | null => {
    const appeal = appealById.get(person.id) ?? appealFor(person);
    if (!appeal) return null;
    const audition = auditionFor(person);
    const audited = !!audition && state.totalDays >= audition.readyOnDay;
    const relationship = relationshipFor(person);
    const assist = deriveFitReadAssist(castingDirectorSkill, relationship, true, audited);
    const deal = estimateDeal(appeal, person, advertisedSalary, assist, relationship);
    const fitScore = deriveOverallScore(person, role, 'actor', draft.script, character);
    if (fitScore === null || !deal) return null;
    const fitBreakdown = deriveRoleFitBreakdown(person, role, 'actor', draft.script, character);
    // Read the fit exactly as the card does - through the same coverage veil - so
    // the casting director's take never claims more certainty than the card shows.
    const readTier = deriveFitConfidence(person, assist).tier;
    const gated = fitBreakdown ? gateKnownAxes(fitBreakdown.rows, readTier) : null;
    const coverage = gated ? knownAxisCoverage(gated) : 1;
    const fitRead = deriveFitRead(fitScore, person, assist, coverage);
    const fitReason = gated ? deriveFitReason(gated.filter((r) => r.known), fitBreakdown!.noun) : null;
    return deriveCastingDirectorTake({
      castingDirectorSkill,
      fit: fitRead,
      odds: deal.odds,
      risk: deriveRiskRead(person).tier,
      affordable: isAffordable(person),
      strengths: fitReason?.strengths ?? null,
      caveat: fitReason?.caveat ?? null,
    });
  };

  // Filters. "Available now only": a booked actor can't be cast today (the offer
  // is hard-rejected on the schedule gate), so hiding them cuts the list to
  // people an offer could land. "Affordable only": hides picks that would put
  // the film over budget. A name search narrows by name. Anyone already on this
  // production is never hidden. All default off/empty, so the full roster is the
  // baseline (isAvailableImmediately matches the card's own "Available now" read).
  const matchesQuery = (person: Person) => !query || person.identity.name.toLowerCase().includes(query);
  const today = gameDateFromTotalDays(state.totalDays);
  const passesFilters = (person: Person) => {
    if (!matchesQuery(person)) return false;
    const onDraft = onThisDraftIds.has(person.id);
    // Anyone already on this production is never filtered out - you must always
    // be able to see (and recast) who you've picked.
    if (onDraft) return true;
    if (availableOnly && !isAvailableImmediately(person, plannedStartDay)) return false;
    if (affordableOnly && !isAffordable(person)) return false;
    if (genderPick !== 'any' && person.identity.gender !== genderPick) return false;
    if (!fameInBand(person.reputation.fame, famePick)) return false;
    if (!ageInGroup(getPersonAge(person.identity.dateOfBirth, today), agePick)) return false;
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
  const directMatches = directSourcePool.filter(passesFilters).sort(bySort);
  const shownDirectCandidates = pinnedFirst(directMatches, (p) => p.id, pins.isPinned).slice(0, DIRECT_DISPLAY_LIMIT);
  const directOverflowCount = directMatches.length - shownDirectCandidates.length;

  // Pin to Compare wiring. Only a booked actor can't be offered today (the
  // schedule gate is the one hard rejection no offer clears); a below-floor
  // offer now just draws a counter, so it no longer disables the action.
  const offerBlockedFor = (person: Person) => !isAvailableImmediately(person, plannedStartDay);
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
        onAct: () => makeOffer(person, advertisedSalary),
        onUnpin: () => pins.toggle(person.id),
        castingDirectorSkill,
        castingDirectorTake: castingDirectorTakeFor(person),
        relationship: relationshipFor(person),
      }))
    : [];

  // How many the availability filter hid in the current tab (for its hint) -
  // measured over the name-searched source, so it reads against what's in view.
  const tabPersons = tab === 'open-casting' ? (call?.applicants ?? []).map((a) => a.person) : directSourcePool;
  const availabilityHiddenCount = availableOnly
    ? tabPersons.filter((p) => matchesQuery(p) && !onThisDraftIds.has(p.id) && !isAvailableImmediately(p, plannedStartDay)).length
    : 0;

  // One candidate card, wired identically wherever it's shown (Open Casting,
  // Direct Approach, or the Shortlist) - the fit read, pre-offer estimate,
  // negotiation state, shortlist toggle, and offer/accept/walk actions all come
  // from the same place, so a candidate reads and behaves the same in every tab.
  const renderCandidate = (person: Person, opts: { channel?: CastingChannel; onDismiss?: () => void } = {}) => {
    const audition = auditionFor(person);
    const audited = !!audition && state.totalDays >= audition.readyOnDay;
    // Phase 6 - if this candidate is booked past the planned start, waiting for
    // them means pushing the shoot to their free day; count who else that frees.
    const appeal = appealById.get(person.id) ?? appealFor(person);
    const bookedUntil = appeal && appeal.schedule.status !== 'available' ? appeal.schedule.availableFromDay : null;
    return (
      <CandidateCard
        key={person.id}
        person={person}
        role={role}
        script={draft.script}
        character={character}
        totalDays={state.totalDays}
        overall={appeal}
        advertisedSalary={advertisedSalary}
        salaryRange={range}
        channel={opts.channel}
        directorName={directorName}
        director={director}
        affordable={isAffordable(person)}
        actionLabel="Make Offer"
        onMakeOffer={(amount) => makeOffer(person, amount)}
        negotiation={negotiationFor(person)}
        onAcceptCounter={() => acceptCounter(person)}
        onWalkAway={() => walkAway(person)}
        shortlisted={isShortlisted(person.id)}
        onToggleShortlist={() => toggleShortlist(person)}
        audited={audited}
        auditioning={!!audition && !audited}
        auditionReadyInDays={audition ? Math.max(0, audition.readyOnDay - state.totalDays) : undefined}
        onAudition={() => dispatch({ type: 'REQUEST_AUDITION', characterId: character.id, role, personId: person.id, personName: person.identity.name })}
        onWaitForActor={bookedUntil ? () => dispatch({ type: 'SET_SHOOT_DELAY', offsetDays: bookedUntil - state.totalDays }) : undefined}
        waitAlsoFrees={bookedUntil ? countActorsFreedByDelay(eligibleDirectActors, plannedStartDay, bookedUntil, person.id) : 0}
        castingDirectorTake={castingDirectorTakeFor(person)}
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

        {plannedStartOffset > 0 && (
          <div className="casting-schedule-banner">
            <span>
              Shoot delayed <strong>{plannedStartOffset} day{plannedStartOffset === 1 ? '' : 's'}</strong> to wait on booked talent - now planned to start day {plannedStartDay}.
            </span>
            <Button variant="secondary" className="btn-sm" onClick={() => dispatch({ type: 'SET_SHOOT_DELAY', offsetDays: 0 })}>
              Start as soon as cast
            </Button>
          </div>
        )}

        <RangeSlider
          label="Advertised Salary for this Role"
          min={range.min}
          max={range.max}
          logScale
          value={advertisedSalary}
          onChange={(price) => dispatch({ type: 'SET_TALENT_TARGET_PRICE', role, price })}
          formatValue={formatMoney}
          description="The budget you're advertising for this role - it shapes who applies to Open Casting and sets the default for each candidate's offer. It is not the fee: you set (and can vary) the actual offer per candidate below, and the amount you finally agree is what you pay."
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
            <label className="casting-sort">
              <span>Gender</span>
              <select aria-label="Filter by gender" value={genderPick} onChange={(e) => setGenderPick(e.target.value as GenderPick)}>
                {GENDER_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </label>
            <label className="casting-sort">
              <span>Age</span>
              <select aria-label="Filter by age" value={agePick} onChange={(e) => setAgePick(e.target.value as AgePick)}>
                {AGE_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </label>
            <label className="casting-sort">
              <span>Fame</span>
              <select aria-label="Filter by fame" value={famePick} onChange={(e) => setFamePick(e.target.value as FamePick)}>
                {FAME_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
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
                {(() => {
                  const forecast = forecastOpenCasting(eligibleDirectActors, character, castingDirectorSkill);
                  const { estimate, confidence } = describeOpenCastingForecast(forecast);
                  return (
                    <div className="casting-forecast">
                      <div className="casting-forecast__estimate">{estimate}</div>
                      <div className="casting-forecast__confidence">{confidence}</div>
                    </div>
                  );
                })()}
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
              Scout a specific actor by name or narrow the field with the filters - the same acceptance math applies as
              Open Casting. The salary bar above is only your offer; it doesn't limit who's shown here.{' '}
              {castingDirector
                ? 'Your casting director is surfacing lesser-known names, not just the famous.'
                : 'Without a casting director you can only reach genuinely famous names.'}
              {hiddenByFameCount > 0 &&
                ` ${hiddenByFameCount} more ${hiddenByFameCount === 1 ? 'actor is' : 'actors are'} beyond your current reach - ${castingDirector ? 'a stronger casting director' : 'a casting director'} would surface more, and a casting call can turn up hidden gems.`}
            </p>
            {shownDirectCandidates.length === 0 ? (
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                {query
                  ? `No scoutable actors match "${search.trim()}" for this role. Hidden gems only turn up through a casting call.`
                  : directSourcePool.length > 0
                    ? 'No actors match your filters - clear them to see the rest.'
                    : castingDirector
                      ? 'No actors are scoutable for this role right now. Hold a casting call to find talent.'
                      : 'No famous actors fit this role. Hire a casting director to scout wider, or hold a casting call.'}
              </p>
            ) : (
              <>
                <div className="grid grid-wide">
                  {shownDirectCandidates.map((person) => renderCandidate(person))}
                </div>
                {directOverflowCount > 0 && (
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85em' }}>
                    Showing {DIRECT_DISPLAY_LIMIT} of {directMatches.length} - narrow with the filters to see the rest.
                  </p>
                )}
              </>
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
