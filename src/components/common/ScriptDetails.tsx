import { Money } from './Money';
import { StatGroup } from './StatGroup';
import { CompatibilityBadge } from './CompatibilityBadge';
import { toneProfileBreakdown } from '../../data/tones';
import { SCRIPT_ARCHETYPE_PROFILES } from '../../data/scriptArchetypes';
import { STORY_TYPE_PROFILES } from '../../data/storyTypes';
import { SETTING_ARCHETYPE_PROFILES } from '../../data/settings';
import { ARCHETYPE_LABELS, CHARACTER_ARCHETYPE_LABELS, STORY_TYPE_LABELS, SETTING_LABELS, SCALE_LABELS } from '../../data/scriptTagLabels';
import {
  productionRequirementTags,
  describeCommercialAppeal,
  describeCostDrivers,
  describeSettingImplication,
  describeCharacterDemands,
} from '../../engine/scriptPresentation';
import { castingGenderLabel } from '../../engine/casting';
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
  const settingProfile = SETTING_ARCHETYPE_PROFILES[script.primarySetting];
  return (
    <>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', margin: '2px 0 6px' }}>
        <span className="badge">{ARCHETYPE_LABELS[script.archetype]}</span>
        {script.storyType !== 'Original' && <span className="badge">{STORY_TYPE_LABELS[script.storyType]}</span>}
        <span className="badge">{SETTING_LABELS[script.primarySetting]}</span>
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

      <div style={{ margin: '6px 0 0' }}>
        <div className="stat-label">Setting: {SETTING_LABELS[script.primarySetting]}</div>
        <p style={{ margin: '2px 0 0', fontSize: '0.85em', color: 'var(--text-muted)' }}>{describeSettingImplication(script.primarySetting)}</p>
      </div>

      {script.cast.filter((c) => c.prominence !== 'Minor').length > 0 && (
        <div style={{ margin: '6px 0 0' }}>
          <div className="stat-label">Cast</div>
          <div className="stack" style={{ gap: 2 }}>
            {script.cast
              .filter((c) => c.prominence !== 'Minor')
              .map((character) => (
                <div key={character.id} style={{ fontSize: '0.85em' }}>
                  <strong>{character.name}</strong> — {character.prominence} {CHARACTER_ARCHETYPE_LABELS[character.archetype]}
                  {character.castingGender && character.castingGender !== 'Any' && (
                    <span className="badge" style={{ marginLeft: 6 }} title="Only actors of this gender can be cast in this role.">
                      {castingGenderLabel(character.castingGender)}
                    </span>
                  )}
                  <div style={{ color: 'var(--text-muted)' }}>{describeCharacterDemands(character)}</div>
                </div>
              ))}
          </div>
        </div>
      )}
    </>
  );
}
