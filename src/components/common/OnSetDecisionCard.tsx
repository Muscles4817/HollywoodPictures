import { TalentStats } from './TalentStats';
import { TALENT_PRESENTATION } from '../../data/talentPresentation';
import { Button } from './Button';
import { Money } from './Money';
import { SeverityBadge } from './SeverityBadge';
import { professionForProductionRole } from '../../data/helpers';
import type { EventChoiceTemplate, PendingEventChoice, Person, Script, TalentProfession } from '../../types';
import type { ReshootConstraint } from '../../engine/reshootAvailability';

/**
 * The cost and time an option will take, shown up front so the player can weigh
 * each one before committing (used by the test-screening decision - see
 * components/wizard/PostProduction.tsx). Both are ranges, since the outcome is
 * rolled; a zero-ranged option (accept the cut, revert) reads as free/instant.
 */
function ChoiceCostMeta({ choice, surcharge = 0 }: { choice: EventChoiceTemplate; surcharge?: number }) {
  // The buy-out is quoted INSIDE the total rather than beside it - the player is
  // choosing between whole prices, not doing arithmetic.
  const [costMin, costMax] = [choice.costRange[0] + surcharge, choice.costRange[1] + surcharge];
  const dMin = Math.max(0, Math.round(choice.delayDaysRange[0]));
  const dMax = Math.max(0, Math.round(choice.delayDaysRange[1]));
  return (
    <span className="event-choice-meta">
      <span className="event-choice-meta__item">
        {costMax <= 0 ? (
          'No added cost'
        ) : costMin === costMax ? (
          <>Cost: <Money amount={costMax} /></>
        ) : (
          <>Cost: <Money amount={costMin} />–<Money amount={costMax} /></>
        )}
      </span>
      <span className="event-choice-meta__item">
        {dMax <= 0 ? 'No delay' : `Time: ${dMin === dMax ? dMax : `${dMin}–${dMax}`} day${dMax === 1 ? '' : 's'}`}
      </span>
      {surcharge > 0 && (
        <span className="event-choice-meta__item">including <Money amount={surcharge} /> to release the cast</span>
      )}
    </span>
  );
}

interface OnSetDecisionCardProps {
  pendingChoice: PendingEventChoice;
  talent: Person[];
  // The studio's full talent pool, keyed by profession - needed to resolve a
  // recast candidate's full stats (data/productionEvents.ts's
  // EventChoiceTemplate only carries replacementCandidateId/Name/Salary,
  // not the whole Person record) so the comparison below can show the same
  // depth of profile for a candidate as for the person currently in the
  // role, rather than a name and a salary.
  talentPool: Record<TalentProfession, Person[]>;
  script: Script | null;
  totalDays: number;
  onChoose: (choiceId: string) => void;
  // Overrides the default "Filming is paused..." line for reuse outside an
  // active shoot (e.g. a test-screening decision, where photography has
  // already finished) - see components/wizard/PostProduction.tsx.
  pausedMessage?: string;
  // When set, each regular choice shows its cost and time up front (the
  // test-screening decision, where those trade-offs are the whole point).
  showChoiceCosts?: boolean;
  // Choice id -> what stands in its way right now: either a hard refusal or a
  // surcharge it can still be taken at (engine/reshootAvailability.ts). Either
  // way the choice stays VISIBLE with its reason shown rather than vanishing -
  // the player needs to understand that a reshoot is off the table, or newly
  // expensive, and why (SIMULATION_PHILOSOPHY.md Principle 3). Computed by the
  // caller, which knows the draft.
  choiceConstraints?: Record<string, ReshootConstraint>;
}

/**
 * The interactive on-set event decision UI - situation text, regular choice
 * buttons, and a "People Involved" panel for choices that offer a
 * replacement hire. Extracted out of ProductionRun.tsx so the same markup
 * serves both the live draft's shoot (ProductionRun.tsx) and a backgrounded
 * one being resolved from the Inbox (components/common/Inbox.tsx) - see
 * docs/DESIGN.md 5.x.
 *
 * Both the currently-involved person and every recast candidate render as a
 * full TalentStats profile card (docs/DESIGN.md - QoL pass: "events that
 * involve talent or crew should always show the people in question's
 * profiles") rather than a single line of text - a fair side-by-side
 * comparison needs the same depth of information on both sides. On a touch
 * device the comparison row becomes a horizontally swipeable, snap-scrolling
 * strip (`.talent-compare-row`'s `@media (pointer: coarse)` override, see
 * index.css) instead of a cramped multi-column squeeze, so comparing two or
 * three full profiles on a small screen is still one full card at a time
 * rather than illegibly shrunk text.
 */
export function OnSetDecisionCard({ pendingChoice, talent, talentPool, script, totalDays, onChoose, pausedMessage, showChoiceCosts, choiceConstraints }: OnSetDecisionCardProps) {
  const involvedTalent = pendingChoice.involvedTalentId ? talent.find((t) => t.id === pendingChoice.involvedTalentId) : undefined;
  const involvedCategory = pendingChoice.involvedRole ? TALENT_PRESENTATION[pendingChoice.involvedRole].category : null;

  const replacementChoices = pendingChoice.choices.filter((c) => c.replacementCandidateId !== undefined);
  const regularChoices = pendingChoice.choices.filter((c) => c.replacementCandidateId === undefined);

  const replacementRole = pendingChoice.replacementRole;
  const replacementPool = replacementRole ? (talentPool[professionForProductionRole(replacementRole)] ?? []) : [];
  const replacementCategory = replacementRole ? TALENT_PRESENTATION[replacementRole].category : null;

  return (
    <div className="card stack" style={{ borderColor: 'var(--primary)' }}>
      <div className="row-between">
        <h2 style={{ margin: 0 }}>A Decision Is Needed</h2>
        <SeverityBadge severity={pendingChoice.severity} />
      </div>

      {involvedTalent && involvedCategory && pendingChoice.involvedRole && replacementChoices.length === 0 && (
        <div className="card">
          <div className="card-title">{involvedTalent.identity.name}</div>
          <div className="card-subtitle">Currently {pendingChoice.involvedRole}</div>
          <TalentStats person={involvedTalent} role={pendingChoice.involvedRole} category={involvedCategory} script={script} totalDays={totalDays} />
        </div>
      )}

      <p style={{ margin: 0 }}>{pendingChoice.situation}</p>
      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85em' }}>{pausedMessage ?? 'Filming is paused until you pick.'}</p>

      <div className="stack">
        {regularChoices.map((choice) => {
          const constraint = choiceConstraints?.[choice.id];
          const blocked = constraint?.blocked === true;
          return (
            <button
              key={choice.id}
              className={`event-choice-button${blocked ? ' event-choice-button--blocked' : ''}`}
              disabled={blocked}
              title={constraint?.note}
              onClick={() => onChoose(choice.id)}
            >
              <span className="event-choice-label-row">
                <span className="event-choice-label">{choice.label}</span>
                {blocked && <span className="event-choice-blocked-badge">Unavailable</span>}
                {constraint?.surcharge !== undefined && <span className="event-choice-surcharge-badge">Buy-out required</span>}
              </span>
              <span className="event-choice-description">{choice.description}</span>
              {constraint && <span className="event-choice-blocked-reason">{constraint.note}</span>}
              {showChoiceCosts && !blocked && <ChoiceCostMeta choice={choice} surcharge={constraint?.surcharge} />}
            </button>
          );
        })}
      </div>

      {replacementChoices.length > 0 && (
        <div className="stack event-people-panel">
          <h3 style={{ margin: 0 }}>People Involved - compare before you choose</h3>
          <div className="talent-compare-row">
            {involvedTalent && involvedCategory && pendingChoice.involvedRole && (
              <div className="card talent-compare-card">
                <div className="card-title">{involvedTalent.identity.name}</div>
                <div className="card-subtitle">Currently {pendingChoice.involvedRole}</div>
                <TalentStats person={involvedTalent} role={pendingChoice.involvedRole} category={involvedCategory} script={script} totalDays={totalDays} />
              </div>
            )}
            {replacementChoices.map((choice) => {
              const candidate = replacementPool.find((t) => t.id === choice.replacementCandidateId);
              return (
                <div className="card talent-compare-card" key={choice.id}>
                  <div className="card-title">{choice.replacementCandidateName}</div>
                  {candidate && replacementCategory && replacementRole ? (
                    <TalentStats person={candidate} role={replacementRole} category={replacementCategory} script={script} totalDays={totalDays} />
                  ) : (
                    choice.replacementCandidateSalary !== undefined && (
                      <div className="card-subtitle"><Money amount={choice.replacementCandidateSalary} /></div>
                    )
                  )}
                  <p style={{ margin: '6px 0', fontSize: '0.85em' }}>{choice.description}</p>
                  <Button variant="primary" className="btn-sm" onClick={() => onChoose(choice.id)}>
                    {choice.label}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
