import type { FilmDraft, PrepPlan } from '../../types';
import { useStudio } from '../../state/StudioContext';
import { derivePrepDemands } from '../../engine/prep/demands';
import { activitiesDropped, defaultActivities } from '../../engine/prep/run';
import { recommendedPreProductionDaysFor } from '../../engine/prepLength';
import { PREP_ACTIVITIES, PREP_ACTIVITY_LABEL, PREP_ACTIVITY_PURPOSE, PREP_LENGTH_FACTORS } from '../../data/prep';

const LENGTH_LABEL: Record<keyof typeof PREP_LENGTH_FACTORS, string> = {
  short: 'Shorter',
  recommended: 'As recommended',
  long: 'Longer',
};

/**
 * The prep plan, set before greenlight (docs/IMPLEMENTATION_PLAN_preproduction_realism.md
 * §4.6): how long prep runs against the recommendation, which of its revealing
 * work it does, and whether the film's production team makes its decisions.
 * A shorter prep costs less and starts the shoot sooner, but long-lead work
 * cannot be compressed and the first things to go are named here, in the
 * order real productions drop them.
 */
export function PrepPlanControls({ draft }: { draft: FilmDraft }) {
  const { dispatch } = useStudio();
  if (!draft.script || !draft.productionChoices) return null;
  const demands = derivePrepDemands({ script: draft.script, talent: draft.talent, choices: draft.productionChoices, environmentStrategy: draft.environmentStrategy });
  const plan: PrepPlan = draft.prepPlan ?? { lengthFactor: 1, activities: null, delegated: true };
  const activities = plan.activities ?? defaultActivities(demands);
  const recommended = recommendedPreProductionDaysFor(draft);
  const dropped = activitiesDropped(plan.lengthFactor);
  const set = (next: Partial<PrepPlan>) => dispatch({ type: 'SET_PREP_PLAN', plan: { ...plan, ...next } });

  return (
    <div className="stack" style={{ gap: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
      <div className="stack" style={{ gap: 4 }}>
        <span style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>Prep length</span>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {(Object.keys(PREP_LENGTH_FACTORS) as Array<keyof typeof PREP_LENGTH_FACTORS>).map((key) => {
            const factor = PREP_LENGTH_FACTORS[key];
            const weeks = Math.max(1, Math.round((recommended * factor) / 7));
            return (
              <label key={key} className="row" style={{ gap: 4, cursor: 'pointer' }}>
                <input type="radio" name="prep-length" checked={plan.lengthFactor === factor} onChange={() => set({ lengthFactor: factor })} />
                {LENGTH_LABEL[key]} (about {weeks} weeks)
              </label>
            );
          })}
        </div>
        {plan.lengthFactor < 1 && (
          <p style={{ margin: 0, fontSize: '0.85em', color: 'var(--amber)' }}>
            Builds, costumes and anything else with a long lead time will be further behind, and the first work to go on a
            short prep goes: {dropped.length > 0 ? dropped.map((a) => PREP_ACTIVITY_LABEL[a].toLowerCase()).join(', then ') : 'nothing yet'}.
          </p>
        )}
        {plan.lengthFactor > 1 && (
          <p style={{ margin: 0, fontSize: '0.85em', color: 'var(--text-muted)' }}>
            Long-lead departments get their weeks, at the cost of more prep spend and a later shoot.
          </p>
        )}
      </div>

      <div className="stack" style={{ gap: 4 }}>
        <span style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>The work that finds problems</span>
        {PREP_ACTIVITIES.map((a) => (
          <label key={a} className="row" style={{ gap: 6, alignItems: 'flex-start', cursor: 'pointer', opacity: dropped.includes(a) ? 0.6 : 1 }}>
            <input
              type="checkbox"
              checked={activities[a] && !dropped.includes(a)}
              disabled={dropped.includes(a)}
              onChange={(e) => set({ activities: { ...activities, [a]: e.target.checked } })}
            />
            <span className="stack" style={{ gap: 0 }}>
              <span>{PREP_ACTIVITY_LABEL[a]}{dropped.includes(a) ? ' - no time for it on a prep this short' : ''}</span>
              <span style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>{PREP_ACTIVITY_PURPOSE[a]}</span>
            </span>
          </label>
        ))}
      </div>

      <label className="row" style={{ gap: 6, alignItems: 'flex-start', cursor: 'pointer' }}>
        <input type="checkbox" checked={plan.delegated} onChange={(e) => set({ delegated: e.target.checked })} />
        <span className="stack" style={{ gap: 0 }}>
          <span>Hand prep's decisions to the production team</span>
          <span style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>
            They decide each of prep's four checkpoints themselves, at the same costs you would face. Untick to make the
            calls yourself; prep will stop at each checkpoint for you.
          </span>
        </span>
      </label>
    </div>
  );
}
