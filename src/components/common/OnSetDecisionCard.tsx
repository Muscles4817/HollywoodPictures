import { computeTalentCompatibility } from '../../engine/compatibility';
import { Button } from './Button';
import { Money } from './Money';
import { SeverityBadge } from './SeverityBadge';
import type { PendingEventChoice, Script, Talent } from '../../types';

interface OnSetDecisionCardProps {
  pendingChoice: PendingEventChoice;
  talent: Talent[];
  script: Script | null;
  onChoose: (choiceId: string) => void;
}

/**
 * The interactive on-set event decision UI - situation text, regular choice
 * buttons, and a "People Involved" recast panel for choices that offer a
 * replacement hire. Extracted out of ProductionRun.tsx so the same markup
 * serves both the live draft's shoot (ProductionRun.tsx) and a backgrounded
 * one being resolved from the Inbox (components/common/Inbox.tsx) - see
 * docs/DESIGN.md 5.x.
 */
export function OnSetDecisionCard({ pendingChoice, talent, script, onChoose }: OnSetDecisionCardProps) {
  const involvedTalent = pendingChoice.involvedTalentId ? talent.find((t) => t.id === pendingChoice.involvedTalentId) : undefined;
  const involvedStat = involvedTalent
    ? 'skill' in involvedTalent
      ? `Skill ${involvedTalent.skill}`
      : script
        ? `Compatibility ${computeTalentCompatibility(involvedTalent, script) ?? '-'}`
        : null
    : null;
  const replacementChoices = pendingChoice.choices.filter((c) => c.replacementCandidateId !== undefined);
  const regularChoices = pendingChoice.choices.filter((c) => c.replacementCandidateId === undefined);

  return (
    <div className="card stack" style={{ borderColor: 'var(--primary)' }}>
      <div className="row-between">
        <h2 style={{ margin: 0 }}>A Decision Is Needed</h2>
        <SeverityBadge severity={pendingChoice.severity} />
      </div>
      {involvedTalent && replacementChoices.length === 0 && (
        <div className="row-between event-involved-talent" style={{ fontSize: '0.9em', color: 'var(--text-muted)' }}>
          <span>{involvedTalent.name} &middot; {pendingChoice.involvedRole}</span>
          {involvedStat && <span>{involvedStat}</span>}
        </div>
      )}
      <p style={{ margin: 0 }}>{pendingChoice.situation}</p>
      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85em' }}>Filming is paused until you pick.</p>
      <div className={replacementChoices.length > 0 ? 'event-decision-layout' : undefined}>
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
            <h3 style={{ margin: 0 }}>People Involved</h3>
            {involvedTalent && (
              <div className="card">
                <div className="card-title">{involvedTalent.name}</div>
                <div className="card-subtitle">Currently {pendingChoice.involvedRole}</div>
                {involvedStat && <div style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>{involvedStat}</div>}
              </div>
            )}
            <div className="stat-label">Replace with</div>
            {replacementChoices.map((choice) => (
              <div className="card" key={choice.id}>
                <div className="card-title">{choice.replacementCandidateName}</div>
                {choice.replacementCandidateSalary !== undefined && (
                  <div className="card-subtitle"><Money amount={choice.replacementCandidateSalary} /></div>
                )}
                <p style={{ margin: '6px 0', fontSize: '0.85em' }}>{choice.description}</p>
                <Button variant="primary" className="btn-sm" onClick={() => onChoose(choice.id)}>
                  {choice.label}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
