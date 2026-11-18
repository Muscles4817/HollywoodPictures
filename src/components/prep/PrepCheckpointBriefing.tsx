import { useState } from 'react';
import type { FilmDraft } from '../../types';
import type { PrepFixKind, ShootImpact } from '../../data/prep';
import { PREP_FRONT_LABEL, PREP_PROBLEMS } from '../../data/prep';
import { useStudio } from '../../state/StudioContext';
import { prepRunFor } from '../../engine/prep/context';
import { carriedCost, checkpointShare, checkpointTitle, fixOptions, type PricedFix } from '../../engine/prep/checkpoints';
import { Button } from '../common/Button';
import { Money } from '../common/Money';

const DEPARTMENT: Record<ShootImpact, string> = {
  performances: 'the performances',
  coverage: 'what the edit has to work with',
  sets: 'the sets',
  vfx: 'the effects',
  practical: 'the stunts and practical effects',
  visual: 'the look',
  pacing: 'the pacing',
  script: 'the script',
  general: 'the film',
};

/** How much a chosen cut costs on screen, in words (never the number). */
function scopeWords(loss: number, impact: ShootImpact | undefined): string {
  const size = Math.abs(loss) < 1.5 ? 'a little' : Math.abs(loss) < 3 ? 'noticeably' : 'a lot';
  return `costs ${impact ? DEPARTMENT[impact] : 'the film'} ${size}`;
}

function OptionCost({ fix, shootDaysLost, overrun }: { fix: PricedFix; shootDaysLost: number; overrun: number }) {
  const parts: React.ReactNode[] = [];
  if (fix.kind === 'carry') {
    parts.push(shootDaysLost > 0 ? `risks about ${shootDaysLost} lost shooting day${shootDaysLost === 1 ? '' : 's'}` : 'risks the work on screen');
    if (overrun > 0) parts.push(<>and <Money amount={overrun} /> over</>);
  } else {
    if (fix.money > 0) parts.push(<Money amount={fix.money} />);
    if (fix.contingency > 0) parts.push(<><Money amount={fix.contingency} /> from the contingency</>);
    if (fix.prepDays > 0) parts.push(`${fix.prepDays} more prep day${fix.prepDays === 1 ? '' : 's'} (the shoot starts later)`);
    if (fix.qualityLoss < 0) parts.push(scopeWords(fix.qualityLoss, fix.impact));
    if (fix.residual > 0) parts.push('helps, but may not cure it');
  }
  return (
    <span style={{ color: 'var(--text-muted)', fontSize: '0.85em' }}>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 ? ' · ' : ''}
          {p}
        </span>
      ))}
    </span>
  );
}

/**
 * A paused prep checkpoint (engine/prep/run.ts): each problem found and not yet
 * answered, in plain words, with every fix still open to it and what each costs
 * - money, prep days, or what it takes off the screen. "Carry it" is always
 * there. One confirm resolves the lot (unanswered = carried); handing the prep
 * to the production team lets them answer it instead.
 */
export function PrepCheckpointBriefing({ draft }: { draft: FilmDraft }) {
  const { state, dispatch } = useStudio();
  const prep = draft.preProduction!;
  const pending = prep.pendingCheckpoint!;
  const run = prepRunFor(draft, { stuntTeamPool: state.stuntTeamPool, talentPairings: state.talentPairings, cash: state.studio.cash });
  const [choices, setChoices] = useState<Record<string, PrepFixKind>>({});
  if (!run) return null;
  const share = checkpointShare(pending.index);
  const problems = prep.problems.filter((p) => pending.problemIds.includes(p.id));

  return (
    <div className="card stack" style={{ borderColor: 'var(--amber)' }}>
      <h2 style={{ margin: 0 }}>{checkpointTitle(pending.index)}</h2>
      <p style={{ margin: 0, color: 'var(--text-muted)' }}>
        Prep has stopped for your decisions. Each problem below has been found; what you do about it now is cheaper than
        what it will cost on the shoot.
      </p>
      {problems.map((problem) => {
        const options = fixOptions(problem, run.ctx, share);
        const carried = carriedCost(problem, run.ctx);
        const chosen = choices[problem.id] ?? 'carry';
        return (
          <div key={problem.id} className="stack" style={{ borderTop: '1px solid var(--border)', paddingTop: 8, gap: 6 }}>
            <div>
              <strong>{PREP_FRONT_LABEL[problem.front]}:</strong> {PREP_PROBLEMS[problem.kind].found}
            </div>
            {options.map((fix) => (
              <label key={fix.kind} className="row" style={{ gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name={`prep-${problem.id}`}
                  checked={chosen === fix.kind}
                  onChange={() => setChoices((c) => ({ ...c, [problem.id]: fix.kind }))}
                />
                <span className="stack" style={{ gap: 2 }}>
                  <span>
                    <strong>{fix.label}</strong> - {fix.kind === 'carry' ? `If it happens: ${fix.text.toLowerCase()}` : fix.text}
                  </span>
                  <OptionCost fix={fix} shootDaysLost={carried.delayDays} overrun={carried.overrunMoney} />
                </span>
              </label>
            ))}
          </div>
        );
      })}
      <div className="row-between">
        <Button onClick={() => dispatch({ type: 'SET_PREP_DELEGATION', productionId: draft.id, delegated: true })}>
          Hand the rest of prep to the production team
        </Button>
        <Button variant="primary" onClick={() => dispatch({ type: 'RESOLVE_PREP_CHECKPOINT', productionId: draft.id, choices })}>
          Confirm and resume prep
        </Button>
      </div>
    </div>
  );
}
