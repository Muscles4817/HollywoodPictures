import { useStudio } from '../../state/StudioContext';
import { computeCommittedSpend, deriveFocusedDraft } from '../../state/selectors';
import { Money } from './Money';
import { StatTile } from './StatTile';

/**
 * Persistent budget strip shown across every wizard screen, so the player
 * always sees the studio's actual cash alongside what this film has
 * committed to spend so far and what cash would be left after release.
 * Nothing here is charged yet - see state/selectors.ts:computeCommittedSpend.
 */
export function BudgetTracker() {
  const { state } = useStudio();
  const draft = deriveFocusedDraft(state);
  if (!draft) return null;

  const committed = computeCommittedSpend(draft);
  const projected = state.studio.cash - committed;

  return (
    <div className="row">
      <StatTile label="Studio Cash" value={<Money amount={state.studio.cash} signColor />} />
      <StatTile label="Committed to This Film" value={<Money amount={committed} />} />
      <StatTile label="Projected Cash After Release" value={<Money amount={projected} signColor />} />
    </div>
  );
}
