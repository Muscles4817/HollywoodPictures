import { derivePrepDemands, prepOutlook } from '../../engine/prep/demands';
import { PREP_FRONT_LABEL } from '../../data/prep';
import type { ProductionChoices, Script, TalentAssignment } from '../../types';

const WEIGHT_WORD = { heavy: 'Heavy', moderate: 'Moderate', light: 'Light' } as const;

/**
 * What this film will ask of its pre-production, front by front, in words
 * (docs/DESIGN_REVIEW_preproduction_realism.md §4.2 - every risk legible before
 * greenlight, Principle 3). Reads the expected load only, never what will
 * actually go wrong.
 */
export function PrepOutlook({ script, talent, choices }: { script: Script; talent: TalentAssignment[]; choices: ProductionChoices }) {
  const outlook = prepOutlook(derivePrepDemands({ script, talent, choices }));
  if (outlook.length === 0) return null;
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="stat-label">What prep will have to deal with</div>
      <ul style={{ margin: 0, paddingLeft: '1.1em', fontSize: '0.9em' }}>
        {outlook.map((o) => (
          <li key={o.front}>
            <strong>{PREP_FRONT_LABEL[o.front]}</strong> <span style={{ color: 'var(--text-muted)' }}>({WEIGHT_WORD[o.weight]})</span> - {o.line}
          </li>
        ))}
      </ul>
    </div>
  );
}
