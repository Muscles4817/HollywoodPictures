import { Money } from './Money';
import { StatGroup } from './StatGroup';
import { CompatibilityBadge } from './CompatibilityBadge';
import { toneProfileBreakdown } from '../../data/tones';
import { SCRIPT_ARCHETYPE_PROFILES } from '../../data/scriptArchetypes';
import { STORY_TYPE_PROFILES } from '../../data/storyTypes';
import { SETTING_PROFILES } from '../../data/settings';
import { ARCHETYPE_LABELS, STORY_TYPE_LABELS, SETTING_LABELS, SCALE_LABELS } from '../../data/scriptTagLabels';
import { productionRequirementTags, describeCommercialAppeal, describeCostDrivers } from '../../engine/scriptPresentation';
import type { Script } from '../../types';

/**
 * The stat block + tone breakdown for a single script - shared by
 * DevelopFilm.tsx's read-only display of an already-owned Asset's script
 * and OpportunityMarket.tsx's candidate cards (development-pipeline doc).
 * Extracted from what used to be DevelopFilm.tsx's own in-wizard
 * script-slate grid, back when a fresh script was picked inside the wizard
 * itself - that picking now happens once, at Opportunity acquisition.
 */
export function ScriptDetails({ script }: { script: Script }) {
  const archetypeProfile = SCRIPT_ARCHETYPE_PROFILES[script.archetype];
  const storyProfile = STORY_TYPE_PROFILES[script.storyType];
  const settingProfile = SETTING_PROFILES[script.setting];
  return (
    <>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', margin: '2px 0 6px' }}>
        <span className="badge">{ARCHETYPE_LABELS[script.archetype]}</span>
        {script.storyType !== 'Original' && <span className="badge">{STORY_TYPE_LABELS[script.storyType]}</span>}
        <span className="badge">{SETTING_LABELS[script.setting]}</span>
        <span className="badge">{SCALE_LABELS[script.scale]}</span>
      </div>
      <p className="card-synopsis">{script.synopsis}</p>
      <p style={{ margin: '0 0 6px', fontSize: '0.85em', color: 'var(--text-muted)' }}>
        {archetypeProfile.description} {script.storyType !== 'Original' && storyProfile.description} {settingProfile.description}
      </p>
      <div className="card-subtitle">Screenplay Cost: <Money amount={script.cost} /></div>
      <p style={{ margin: '0 0 6px', fontSize: '0.85em' }}>{describeCostDrivers(script)}</p>
      <p style={{ margin: '0 0 6px', fontSize: '0.85em' }}>{describeCommercialAppeal(script)}</p>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', margin: '6px 0' }}>
        {productionRequirementTags(script).map((tag) => (
          <span className="badge" key={tag}>{tag}</span>
        ))}
      </div>
      <div className="row" style={{ gap: 16, flexWrap: 'wrap', margin: '0 0 6px' }}>
        <StatGroup
          title="Writing"
          stats={[
            { label: 'Dialogue', value: script.dialogue },
            { label: 'Characters', value: script.characters },
            { label: 'Structure', value: script.structure },
          ]}
        />
        <StatGroup
          title="Creative"
          stats={[
            { label: 'Originality', value: script.originality },
            { label: 'Complexity', value: script.complexity },
          ]}
        />
      </div>
      <div style={{ fontSize: '0.85em' }}>
        <div>Leads: {script.requiredLeads}</div>
        <div>Supporting Roles: {script.requiredSupporting}</div>
        <div>Intended Audience: {script.intendedAudience}</div>
      </div>
      <CompatibilityBadge breakdown={toneProfileBreakdown(script.toneProfile)} />
    </>
  );
}
