import { TalentStats } from './TalentStats';
import { TALENT_PRESENTATION } from '../../data/talentPresentation';
import { Button } from './Button';
import { Money } from './Money';
import { SeverityBadge } from './SeverityBadge';
import { professionForProductionRole } from '../../data/helpers';
import type { PendingEventChoice, Person, Script, TalentProfession } from '../../types';

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
export function OnSetDecisionCard({ pendingChoice, talent, talentPool, script, totalDays, onChoose }: OnSetDecisionCardProps) {
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
      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85em' }}>Filming is paused until you pick.</p>

      <div className="stack">
        {regularChoices.map((choice) => (
          <button key={choice.id} className="event-choice-button" onClick={() => onChoose(choice.id)}>
            <span className="event-choice-label-row">
              <span className="event-choice-label">{choice.label}</span>
            </span>
            <span className="event-choice-description">{choice.description}</span>
          </button>
        ))}
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
