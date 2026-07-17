import { CompatibilityBadge } from './CompatibilityBadge';
import { toneProfileBreakdown } from '../../data/tones';
import { ARCHETYPE_LABELS, STORY_TYPE_LABELS, SETTING_LABELS, SCALE_LABELS } from '../../data/scriptTagLabels';
import { productionRequirementTags } from '../../engine/scriptPresentation';
import type { Script } from '../../types';

/**
 * A compact "what film are we making" reminder - title, concept badges,
 * synopsis, production-requirement tags, and tone profile. The screenplay
 * itself was previously only shown on Develop Film and Hire Talent - every
 * later wizard step (Production Planning, filming, Post-Production,
 * Marketing) still makes decisions that depend on what the script actually
 * calls for, but had no way to check it without navigating back. Shown
 * consistently across all of them instead (docs/DESIGN.md).
 *
 * Deliberately not the *full* Develop Film card (`ScriptDetails` there
 * keeps the quality-stat groups and Screenplay Cost, both fixed and no
 * longer actionable by this point) - just the concept identity, what it
 * will require on set, and what it "feels like" (tone), which is what stays
 * relevant to every downstream decision.
 */
export function ScriptSummaryCard({ script }: { script: Script }) {
  return (
    <div className="card stack">
      <div className="card-title">{script.title}</div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <span className="badge">{ARCHETYPE_LABELS[script.archetype]}</span>
        {script.storyType !== 'Original' && <span className="badge">{STORY_TYPE_LABELS[script.storyType]}</span>}
        <span className="badge">{SETTING_LABELS[script.primarySetting]}</span>
        <span className="badge">{SCALE_LABELS[script.scale]}</span>
      </div>
      <p className="card-synopsis" style={{ margin: 0 }}>{script.synopsis}</p>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        {productionRequirementTags(script).map((tag) => (
          <span className="badge" key={tag}>{tag}</span>
        ))}
      </div>
      <CompatibilityBadge breakdown={toneProfileBreakdown(script.toneProfile)} />
    </div>
  );
}
