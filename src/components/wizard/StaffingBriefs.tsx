import { useState } from 'react';
import { useStudio } from '../../state/StudioContext';
import { Button } from '../common/Button';
import { Money } from '../common/Money';
import { TalentStats } from '../common/TalentStats';
import { TALENT_PRESENTATION } from '../../data/talentPresentation';
import { professionForProductionRole } from '../../data/helpers';
import { MAX_BRIEFS_PER_ROLE } from '../../data/producers';
import {
  briefsRemainingForRole,
  canDelegateRole,
  eligibleBriefProducers,
  draftBriefs,
  quoteBrief,
} from '../../engine/staffingBriefs';
import { getProducerCareer } from '../../engine/producers';
import type { FilmDraft, Person, ProductionRole, StaffingBrief } from '../../types';

/**
 * Delegated Staffing (docs/DESIGN_REVIEW_delegated_staffing.md) - the player's
 * whole side of handing a crew slot to an attached Line Producer: the confirm
 * panel for issuing a brief, the status of one that's out, and the accept/veto
 * card for one that's come back.
 *
 * Lives under the staffing board rather than inside the hiring drawer on
 * purpose. Delegation is the alternative to opening that drawer, not a mode
 * within it, and keeping it out means the drawer - the game's richest loop -
 * is completely untouched by this feature.
 */
export function StaffingBriefsPanel({
  draft,
  briefingRole,
  onBrief,
}: {
  draft: FilmDraft;
  /** The role whose confirm panel is open, driven by the board row's own button. */
  briefingRole: ProductionRole | null;
  onBrief: (role: ProductionRole | null) => void;
}) {
  const { state } = useStudio();
  const producers = eligibleBriefProducers(draft, state.producerPool ?? []);
  const briefs = draftBriefs(draft);
  const live = briefs.filter((b) => b.status === 'out');
  const returned = briefs.filter((b) => b.status === 'returned');

  // Nothing to say at all until the player has a Line Producer on this film -
  // and then only if something is actually happening or being offered.
  if (producers.length === 0 && live.length === 0 && returned.length === 0) return null;

  return (
    <div className="staffing-briefs stack">
      {returned.map((brief) => (
        <ReturnedBriefCard key={brief.id} draft={draft} brief={brief} producers={producers} />
      ))}
      {live.map((brief) => (
        <LiveBriefRow key={brief.id} brief={brief} producers={producers} today={state.totalDays} />
      ))}
      {briefingRole && (
        <BriefConfirmPanel draft={draft} role={briefingRole} producers={producers} onClose={() => onBrief(null)} />
      )}
    </div>
  );
}

/** Whether the board should offer a "hand it over" button on this row at all. */
export function delegableProducerFor(draft: FilmDraft, state: ReturnType<typeof useStudio>['state'], role: ProductionRole): Person | null {
  const producers = eligibleBriefProducers(draft, state.producerPool ?? []);
  return producers.find((p) => canDelegateRole(draft, state.studio, state.producerPool ?? [], role, p.id)) ?? null;
}

// --- Issuing ---------------------------------------------------------------

function BriefConfirmPanel({
  draft,
  role,
  producers,
  onClose,
}: {
  draft: FilmDraft;
  role: ProductionRole;
  producers: Person[];
  onClose: () => void;
}) {
  const { state, dispatch } = useStudio();
  const planned = draft.talentTargetPriceByRole[role] ?? 0;
  const [allocation, setAllocation] = useState(planned);
  const [producerId, setProducerId] = useState(producers[0]?.id ?? '');
  const producer = producers.find((p) => p.id === producerId) ?? producers[0];
  if (!producer) return null;

  const quote = quoteBrief(producer, role, allocation, draft, state.talentPool, state.totalDays);
  const remaining = briefsRemainingForRole(draft, role);
  const legal = canDelegateRole(draft, state.studio, state.producerPool ?? [], role, producer.id);

  return (
    <div className="card stack staffing-brief-confirm">
      <h2 style={{ margin: 0 }}>Hand {role} to {producer.identity.name}</h2>
      {producers.length > 1 && (
        <label className="row" style={{ gap: 8 }}>
          <span>Producer</span>
          <select value={producerId} onChange={(e) => setProducerId(e.target.value)}>
            {producers.map((p) => (
              <option key={p.id} value={p.id}>{p.identity.name}</option>
            ))}
          </select>
        </label>
      )}

      {/* The allocation IS the brief - there is no separate priority dial.
          Telling a line producer the number is telling them what you want. */}
      <label className="row" style={{ gap: 8 }}>
        <span>Budget for the slot</span>
        <input
          type="number"
          min={0}
          step={10_000}
          value={allocation}
          onChange={(e) => setAllocation(Math.max(0, Number(e.target.value) || 0))}
          aria-label={`Budget handed over for ${role}`}
        />
        <Money amount={allocation} />
      </label>

      <p className="choice-description" style={{ margin: 0 }}>
        <em>“{quote.read}”</em>
      </p>
      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85em' }}>
        They reckon about <strong>{quote.estimatedDays} days</strong>. Time only passes away from this screen — leave the
        project and they'll get on with it. {remaining === MAX_BRIEFS_PER_ROLE ? (
          <>You get {MAX_BRIEFS_PER_ROLE} briefs on this slot; turning down what they bring you spends one.</>
        ) : (
          <>This is your last brief on this slot.</>
        )}
      </p>

      <div className="row">
        <Button
          variant="primary"
          disabled={!legal}
          onClick={() => {
            dispatch({ type: 'ISSUE_STAFFING_BRIEF', role, producerId: producer.id, allocation });
            onClose();
          }}
        >
          Hand it over
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

// --- Out -------------------------------------------------------------------

function LiveBriefRow({ brief, producers, today }: { brief: StaffingBrief; producers: Person[]; today: number }) {
  const { dispatch } = useStudio();
  const name = producers.find((p) => p.id === brief.producerId)?.identity.name ?? 'Your producer';
  const due = brief.issuedOnDay + brief.estimatedDays;
  const daysLeft = due - today;
  return (
    <div className="card row-between staffing-brief-live">
      <span>
        <strong>{name}</strong> is out looking for a {brief.role.toLowerCase()} —{' '}
        {daysLeft > 0 ? `back in about ${daysLeft} day${daysLeft === 1 ? '' : 's'}` : 'overdue'}. Budget{' '}
        <Money amount={brief.allocation} />.
      </span>
      <Button className="btn-sm" onClick={() => dispatch({ type: 'WITHDRAW_STAFFING_BRIEF', briefId: brief.id })}>
        Pull the brief
      </Button>
    </div>
  );
}

// --- Back ------------------------------------------------------------------

function ReturnedBriefCard({ draft, brief, producers }: { draft: FilmDraft; brief: StaffingBrief; producers: Person[] }) {
  const { state, dispatch } = useStudio();
  // May be absent: the producer can have been fired between coming back with a
  // name and the player answering. The pick stands - it is already made - but
  // everything that reads THEM has to tolerate their absence.
  const producer = producers.find((p) => p.id === brief.producerId);
  const name = producer?.identity.name ?? 'Your producer';
  const candidate = brief.candidate;
  const person = candidate
    ? (state.talentPool[professionForProductionRole(brief.role)] ?? []).find((p) => p.id === candidate.personId)
    : undefined;
  const remainingAfter = briefsRemainingForRole(draft, brief.role);

  // Came back empty-handed: nothing in the pool came in at the allocation. A
  // real, legible failure - and it still cost the days.
  if (!candidate || !person) {
    return (
      <div className="card stack staffing-brief-returned">
        <h2 style={{ margin: 0 }}>{name} came back empty-handed</h2>
        <p className="choice-description" style={{ margin: 0 }}>
          <em>“Nobody worth having would take the {brief.role.toLowerCase()} job at <Money amount={brief.allocation} />.
          Raise it or I'll keep wasting your time.”</em>
        </p>
        <div className="row">
          <Button onClick={() => dispatch({ type: 'REJECT_BRIEF_CANDIDATE', briefId: brief.id })}>
            Understood
          </Button>
        </div>
      </div>
    );
  }

  const under = brief.allocation - candidate.fee;
  const career = producer ? getProducerCareer(producer) : null;

  return (
    <div className="card stack staffing-brief-returned">
      <h2 style={{ margin: 0 }}>
        {name} has a {brief.role.toLowerCase()} for you
      </h2>
      {/* The same read the drawer would have given, name included: delegation
          costs you the SEARCH, never the judgement. */}
      <div className="card-title">{person.identity.name}</div>
      <TalentStats
        person={person}
        role={brief.role}
        category={TALENT_PRESENTATION[brief.role].category}
        script={draft.script}
        totalDays={state.totalDays}
      />
      <ul className="producer-effect-lines">
        {candidate.pitch.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p style={{ margin: 0 }}>
        <strong><Money amount={candidate.fee} /></strong>{' '}
        {under > 0 ? (
          <span style={{ color: 'var(--green, #2e7d32)' }}>(<Money amount={under} /> under the brief)</span>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>(at the brief)</span>
        )}
        {career?.specialty === 'Line' && <span style={{ color: 'var(--text-muted)' }}> · a line producer buys value, not fit — check the department read above.</span>}
      </p>
      <div className="row">
        <Button variant="primary" onClick={() => dispatch({ type: 'ACCEPT_BRIEF_CANDIDATE', briefId: brief.id })}>
          Take them
        </Button>
        <Button onClick={() => dispatch({ type: 'REJECT_BRIEF_CANDIDATE', briefId: brief.id })}>
          {remainingAfter > 0 ? 'Pass — send them back out' : "Pass — that's their last brief"}
        </Button>
      </div>
    </div>
  );
}
