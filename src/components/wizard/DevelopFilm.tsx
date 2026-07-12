import { useEffect, useState, type CSSProperties } from 'react';
import { useStudio } from '../../state/StudioContext';
import { GENRES, GENRE_PROFILES } from '../../data/genres';
import { TARGET_AUDIENCES, AUDIENCE_PROFILES } from '../../data/audiences';
import { pluckDescriptions } from '../../data/describe';
import { Card } from '../common/Card';
import { ChoiceGroup } from '../common/ChoiceGroup';
import { Button } from '../common/Button';
import { Money } from '../common/Money';
import { WizardHeader } from '../common/WizardHeader';
import { CompatibilityBadge } from '../common/CompatibilityBadge';
import { StarRating } from '../common/StarRating';
import { toneProfileBreakdown } from '../../data/tones';
import { SCRIPT_ARCHETYPE_PROFILES } from '../../data/scriptArchetypes';
import { STORY_TYPE_PROFILES } from '../../data/storyTypes';
import { SETTING_PROFILES } from '../../data/settings';
import { ARCHETYPE_LABELS, STORY_TYPE_LABELS, SETTING_LABELS, SCALE_LABELS } from '../../data/scriptTagLabels';
import { deriveCommercialProfile } from '../../engine/commercialProfile';
import type { Script } from '../../types';

// Threshold-to-tag mapping (docs/DESIGN.md - screenplay redesign, "UI
// philosophy": enrich the card with descriptive information rather than
// more raw numbers) - drawn from the screenplay's own concept
// (ProductionRequirements plus Setting/Story Type/Scale, never randomly),
// answering "why is this production difficult or expensive" in concrete,
// actionable terms instead of the old abstract "Leans studio, practical
// effects" lean summary - once the card already leads with Archetype/Story
// Type/Setting/Scale badges and their own description sentences, that lean
// line was redundant with information the player already has.
//
// A couple of the illustrative tags from the design brief (child actors,
// underwater filming) don't have an honest source in the current model -
// nothing about a screenplay signals "shoots underwater," and Coming of Age
// implies a young cast in general, not specifically child actors - so
// they're approximated (`Young Cast`) or left out entirely rather than
// fabricated. See docs/DESIGN.md for the full list of what maps to what.
const HEAVY = 0.5;
const NOTABLE = 0.4;
function productionRequirementTags(script: Script): string[] {
  const req = script.productionRequirements;
  const tags: string[] = [];

  if (req.periodSetting) tags.push('Period Costumes', 'Period Sets');
  if (script.setting === 'Space') tags.push('Spacecraft Sets');
  else if (script.setting === 'Fantasy') tags.push('Constructed Worlds');
  else if (script.setting === 'SciFi' && req.locations >= HEAVY) tags.push('Remote Locations');

  if (req.extras >= NOTABLE) tags.push('Large Ensemble');
  if (req.crowdWork >= NOTABLE) tags.push('Crowd Scenes');
  if (script.storyType === 'ComingOfAge') tags.push('Young Cast');
  if (script.storyType === 'Documentary') tags.push('Nonfiction Format');

  if (req.stunts >= HEAVY) tags.push('Stunts');
  if (req.vehicles) tags.push('Vehicles');
  if (req.animals) tags.push('Animals');
  if (req.practicalEffects >= HEAVY) tags.push('Practical Effects');
  if (req.vfx >= HEAVY) tags.push('Heavy VFX');

  if (script.storyType === 'Musical') tags.push('Musical Numbers');
  if (req.choreography >= NOTABLE) tags.push('Choreography');

  if (!req.periodSetting && script.setting !== 'Space' && script.setting !== 'Fantasy' && req.locations >= HEAVY) {
    tags.push('Large Locations');
  }

  return tags.length > 0 ? tags : ['Contained, straightforward production'];
}

/** "Why is it commercially attractive" - one sentence derived from the screenplay's hidden commercial profile (engine/commercialProfile.ts), never a raw number (docs/DESIGN.md - screenplay redesign: "the player should infer commercial potential from the screenplay rather than reading 'Audience Reach: 91'"). */
function describeCommercialAppeal(script: Script): string {
  const profile = deriveCommercialProfile(script);
  const traits: string[] = [];
  if (profile.accessibility >= 65) traits.push('broad mainstream appeal');
  else if (profile.accessibility <= 35) traits.push('a narrow, dedicated audience');
  if (profile.hookStrength >= 65) traits.push('an easy pitch to market');
  else if (profile.hookStrength <= 35) traits.push('a tough concept to sell in a trailer');
  if (profile.crossoverPotential >= 65) traits.push('real potential to break out beyond its natural audience');
  if (traits.length === 0) return 'Middling, unremarkable commercial potential.';
  return `Commercially: ${traits.join(', ')}.`;
}

/** "Why is this script expensive" - the concrete drivers behind Screenplay Cost, rather than leaving the number to speak for itself. */
function describeCostDrivers(script: Script): string {
  const drivers: string[] = [];
  if (script.scale === 'Epic') drivers.push('its epic scale');
  if (script.complexity >= 65) drivers.push('a demanding production');
  const avgCraft = (script.originality + script.structure + script.characters + script.dialogue) / 4;
  if (avgCraft >= 70) drivers.push('exceptional craft');
  if (drivers.length === 0) return 'A modest, straightforward production.';
  return `Priced for ${drivers.join(' and ')}.`;
}

/** One labeled group of quality attributes, each read as a star rating rather than a bare number - "don't remove the underlying values, just present them in a way that feels less like a spreadsheet" (docs/DESIGN.md - screenplay redesign, presentation polish pass). Shared by the Writing/Creative groups below so both render identically. */
function StatGroup({ title, stats }: { title: string; stats: Array<{ label: string; value: number }> }) {
  return (
    <div>
      <div className="stat-group-title">{title}</div>
      {stats.map(({ label, value }) => (
        <div className="row-between" key={label} style={{ fontSize: '0.85em' }}>
          <span>{label}</span>
          <StarRating value={value} />
        </div>
      ))}
    </div>
  );
}

/** The stat block + tone breakdown shared between a script's grid card and its comparison-panel slot - title is left to each call site since the two show it differently. */
function ScriptDetails({ script }: { script: Script }) {
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
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', margin: '6px 0' }}>
        {productionRequirementTags(script).map((tag) => (
          <span className="badge" key={tag}>{tag}</span>
        ))}
      </div>
      <CompatibilityBadge breakdown={toneProfileBreakdown(script.toneProfile)} />
    </>
  );
}

const GENRE_DESCRIPTIONS = pluckDescriptions(GENRE_PROFILES);
const AUDIENCE_DESCRIPTIONS = pluckDescriptions(AUDIENCE_PROFILES);

const MAX_PINNED = 2;

export function DevelopFilm() {
  const { state, dispatch } = useStudio();
  const draft = state.draft!;
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  // A new slate (genre change or reroll) makes any pinned ids stale - start fresh rather than comparing scripts that no longer exist.
  useEffect(() => {
    setPinnedIds([]);
  }, [draft.scriptOptions]);

  const canContinue = Boolean(
    draft.title.trim() && draft.genre && draft.targetAudience && draft.script && state.studio.cash >= draft.script.cost,
  );

  function handleContinue() {
    dispatch({ type: 'GO_TO_STEP', step: 'talent' });
  }

  function togglePin(scriptId: string) {
    setPinnedIds((prev) => {
      if (prev.includes(scriptId)) return prev.filter((id) => id !== scriptId);
      if (prev.length >= MAX_PINNED) return prev;
      return [...prev, scriptId];
    });
  }

  const pinnedScripts = pinnedIds
    .map((id) => draft.scriptOptions.find((s) => s.id === id))
    .filter((s): s is Script => s !== undefined);

  return (
    <div className="stack">
      <WizardHeader current="develop" />
      <h1>Develop Your Film</h1>

      <div className="card stack">
        <h3 style={{ margin: 0 }}>Title</h3>
        <input
          type="text"
          placeholder="Working title..."
          value={draft.title}
          onChange={(e) => dispatch({ type: 'SET_TITLE', title: e.target.value })}
          style={{ maxWidth: 360 }}
        />
      </div>

      <ChoiceGroup
        label="Genre"
        options={GENRES}
        value={draft.genre}
        onChange={(genre) => dispatch({ type: 'SET_GENRE', genre })}
        descriptions={GENRE_DESCRIPTIONS}
      />

      {draft.genre && (
        <div
          className={pinnedIds.length > 0 ? 'develop-compare-layout' : undefined}
          style={
            pinnedIds.length > 0
              ? ({ '--compare-rail-width': pinnedIds.length >= MAX_PINNED ? '660px' : '320px' } as CSSProperties)
              : undefined
          }
        >
          <div className="card stack">
            <div className="row-between">
              <h3 style={{ margin: 0 }}>Script Options</h3>
              <Button onClick={() => dispatch({ type: 'REROLL_SCRIPTS' })}>Reroll Scripts</Button>
            </div>
            <p style={{ margin: 0 }}>
              Each script is built around a concept - its Archetype, Story Type, Setting and Scale - before any number
              is rolled, so its production requirements, commercial potential and Tone Profile all cohere with what
              kind of film it actually is. Writing (Dialogue, Characters, Structure) and Creative (Originality,
              Complexity) drive Critic reaction; higher Complexity also raises production risk. The tags below Cost
              show concretely why a production is difficult or expensive - period costumes, heavy VFX, large crowds,
              and so on. Picking a script also sets how many Lead and Supporting roles you'll need to cast and
              suggests a Target Audience below. Pin up to two scripts to compare them side by side.
            </p>
            <div className="grid grid-wide">
              {draft.scriptOptions.map((script) => {
                const selected = draft.script?.id === script.id;
                const affordable = state.studio.cash >= script.cost;
                const pinned = pinnedIds.includes(script.id);
                return (
                  <Card
                    key={script.id}
                    selectable
                    selected={selected}
                    onClick={() => dispatch({ type: 'SELECT_SCRIPT', script })}
                  >
                    <div className="card-title">{script.title}</div>
                    <ScriptDetails script={script} />
                    <Button
                      className="btn-sm"
                      variant={pinned ? 'primary' : 'secondary'}
                      style={{ marginTop: 8 }}
                      disabled={!pinned && pinnedIds.length >= MAX_PINNED}
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePin(script.id);
                      }}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      {pinned ? 'Unpin from Compare' : 'Pin to Compare'}
                    </Button>
                    {!affordable && (
                      <p style={{ color: 'var(--red)', marginTop: 6 }}>Can't afford this script</p>
                    )}
                    {selected && <p style={{ color: 'var(--green)', marginTop: 6 }}>Selected</p>}
                  </Card>
                );
              })}
            </div>
          </div>

          {pinnedIds.length > 0 && (
            <div className="compare-panel">
              <h3 style={{ margin: 0 }}>Comparing</h3>
              <div className={pinnedIds.length >= MAX_PINNED ? 'compare-slots compare-slots-double' : 'compare-slots'}>
                {pinnedScripts.map((script) => {
                  const selected = draft.script?.id === script.id;
                  return (
                    <div className="card compare-slot" key={script.id}>
                      <div className="row-between">
                        <div className="card-title" style={{ marginBottom: 0 }}>{script.title}</div>
                        <Button variant="text" onClick={() => togglePin(script.id)}>Unpin</Button>
                      </div>
                      <ScriptDetails script={script} />
                      <Button
                        variant="primary"
                        style={{ marginTop: 8 }}
                        onClick={() => dispatch({ type: 'SELECT_SCRIPT', script })}
                      >
                        {selected ? 'Selected' : 'Choose This Script'}
                      </Button>
                    </div>
                  );
                })}
                {pinnedIds.length < MAX_PINNED && (
                  <div className="card compare-slot-empty">Pin another script from the grid to compare it here.</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {draft.script && (
        <ChoiceGroup
          label="Target Audience"
          options={TARGET_AUDIENCES}
          value={draft.targetAudience}
          onChange={(targetAudience) => dispatch({ type: 'SET_TARGET_AUDIENCE', targetAudience })}
          descriptions={AUDIENCE_DESCRIPTIONS}
          hint={`Pre-filled from "${draft.script.title}"'s intended audience - change it if you'd rather position the film differently.`}
        />
      )}

      <div className="row-between">
        <Button onClick={() => dispatch({ type: 'RETURN_TO_DASHBOARD' })}>Cancel</Button>
        <Button variant="primary" disabled={!canContinue} onClick={handleContinue}>
          Continue to Hire Talent
        </Button>
      </div>
    </div>
  );
}
