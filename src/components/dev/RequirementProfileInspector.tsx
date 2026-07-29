import { useRef, useState } from 'react';
import { GENRES } from '../../data/genres';
import { REFERENCE_SCRIPTS } from '../../data/dev/referenceScripts';
import { generateScriptOptions } from '../../engine/scriptGenerator';
import { createRng } from '../../engine/random';
import {
  deriveRequirementProfile,
  requirementsInCategory,
  categoryPressure,
  type RequirementCategory,
  type RequirementProfile,
} from '../../engine/requirementProfile';
import { deriveDepartmentWorkloads, type DepartmentWorkload } from '../../engine/departmentWorkload';
import {
  deriveDefaultStrategy,
  relevantStrategyAxes,
  STRATEGY_AXIS_META,
  type ExecutionStrategy,
} from '../../engine/executionStrategy';
import { Button } from '../common/Button';
import { ScoreBar } from '../common/ScoreBar';
import type { Genre, Script } from '../../types';

// Developer-only tool for inspecting the narrative Requirement Profile
// (engine/requirementProfile.ts, Workstream II Layer 1) directly against
// generated and real reference scripts. Read-only: this reads a script into its
// requirement leaves and shows the raw scalars. It feeds neither cost nor
// scoring - it exists to eyeball that the six archetypes separate. Not reachable
// from normal play, not persisted, generates its own scripts from a local RNG.

const CATEGORY_ORDER: { key: RequirementCategory; label: string }[] = [
  { key: 'environments', label: 'Physical Environments' },
  { key: 'transformation', label: 'Character Transformation' },
  { key: 'action', label: 'Action / Movement' },
  { key: 'digital', label: 'Digital Imagery' },
  { key: 'logistics', label: 'Logistical Scale' },
];

function LeafRow({ profile, category }: { profile: RequirementProfile; category: RequirementCategory }) {
  const leaves = requirementsInCategory(profile, category);
  if (leaves.length === 0) return null;
  return (
    <div className="card stack" style={{ flex: 1, minWidth: 260 }}>
      <div className="row-between">
        <h3 style={{ margin: 0 }}>{CATEGORY_ORDER.find((c) => c.key === category)!.label}</h3>
        <span className="badge">pressure {Math.round(categoryPressure(profile, category) * 100)}%</span>
      </div>
      {leaves.map((l) => (
        <div key={l.key} style={{ marginBottom: 6 }}>
          <div className="row-between" style={{ fontSize: '0.9em' }}>
            <strong>{l.label}</strong>
            <span style={{ color: 'var(--text-muted)' }}>{l.permittedApproaches.join(' · ')}</span>
          </div>
          <ScoreBar label="magnitude" value={l.magnitude * 100} />
          <ScoreBar label="frequency" value={l.frequency * 100} />
          <ScoreBar label="complexity" value={l.complexity * 100} />
          <ScoreBar label="criticality" value={l.criticality * 100} />
        </div>
      ))}
    </div>
  );
}

function DepartmentWorkloadPanel({ workloads }: { workloads: DepartmentWorkload[] }) {
  return (
    <div className="card stack">
      <h2 style={{ margin: 0 }}>Department workload (Layer 3)</h2>
      <p style={{ margin: 0, color: 'var(--text-muted)' }}>
        Derived from the requirements above, routed by approach. The fit-read floor reads this.
      </p>
      {workloads.length === 0 ? (
        <p style={{ margin: 0 }}>No modelled department is meaningfully loaded.</p>
      ) : (
        <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {workloads.map((w) => (
            <div key={w.department} className="card stack" style={{ flex: 1, minWidth: 240 }}>
              <h3 style={{ margin: 0 }}>{w.label}</h3>
              <ScoreBar label="load" value={w.magnitude * 100} />
              <ScoreBar label="complexity" value={w.complexity * 100} />
              <ScoreBar label="criticality" value={w.criticality * 100} />
              <div style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>
                {w.contributions.map((c) => `${c.label} (${Math.round(c.load * 100)})`).join(' · ')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function RequirementProfileInspector() {
  const rngRef = useRef(createRng(Date.now()));
  const [genre, setGenre] = useState<Genre>('Action');
  const [script, setScript] = useState<Script>(REFERENCE_SCRIPTS[0]);
  // null = follow the script's lean-derived default; otherwise a chosen override.
  const [strategyOverride, setStrategyOverride] = useState<Partial<ExecutionStrategy> | null>(null);

  function chooseScript(s: Script) {
    setScript(s);
    setStrategyOverride(null); // a fresh script re-defaults its methods
  }
  function rerollScript(forGenre: Genre = genre) {
    chooseScript(generateScriptOptions(forGenre, rngRef.current, 1)[0]);
  }

  const defaultStrategy = deriveDefaultStrategy(script);
  const strategy: ExecutionStrategy = { ...defaultStrategy, ...(strategyOverride ?? {}) };
  const axes = relevantStrategyAxes(script);
  const profile = deriveRequirementProfile(script, strategy);
  const workloads = deriveDepartmentWorkloads(profile);

  return (
    <div className="stack">
      <div>
        <h1 style={{ margin: 0 }}>Requirement Profile Inspector</h1>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>
          Developer tool - Workstream II Layer 1. Reads a script into its narrative requirements. Read-only: feeds no cost or scoring.
        </p>
      </div>

      <div className="row">
        <select
          value={genre}
          onChange={(e) => {
            const g = e.target.value as Genre;
            setGenre(g);
            rerollScript(g);
          }}
        >
          {GENRES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <Button onClick={() => rerollScript()}>New Script</Button>
        <span className="stat-label" style={{ margin: 0 }}>Reference (real films)</span>
        <select
          value={script.id}
          onChange={(e) => {
            const found = REFERENCE_SCRIPTS.find((s) => s.id === e.target.value);
            if (found) chooseScript(found);
          }}
        >
          <option value="" disabled>
            Load a real script...
          </option>
          {REFERENCE_SCRIPTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} ({s.genre})
            </option>
          ))}
        </select>
      </div>

      <div className="card stack">
        <div className="row-between">
          <h2 style={{ margin: 0 }}>Execution strategy (Layer 2)</h2>
          <span className="badge">{strategyOverride ? 'overridden' : 'lean default'}</span>
        </div>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>
          The producer's method choices - they re-route the requirements below and the department workloads.
        </p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {axes.map((axis) => (
            <label key={axis} className="stack" style={{ gap: 2 }}>
              <span className="stat-label" style={{ margin: 0 }}>{STRATEGY_AXIS_META[axis].label}</span>
              <select
                value={strategy[axis]}
                onChange={(e) => setStrategyOverride({ ...strategy, [axis]: e.target.value })}
              >
                {STRATEGY_AXIS_META[axis].options.map((o) => (
                  <option key={o.value} value={o.value} title={o.blurb}>{o.label}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </div>

      <div className="card stack">
        <p style={{ margin: 0 }}>
          <strong>{script.title}</strong> &middot; {script.genre} / {script.storyType} / {script.primarySetting} / {script.scale}
          {' '}&middot; complexity {script.complexity} &middot; effects {Math.round(script.effectsStrategy.practical * 100)}% practical /{' '}
          {Math.round(script.effectsStrategy.digital * 100)}% digital
        </p>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>
          {profile.length} requirement{profile.length === 1 ? '' : 's'} present.
        </p>
      </div>

      {profile.length === 0 ? (
        <div className="card">No significant production requirements.</div>
      ) : (
        <>
          <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {CATEGORY_ORDER.map((c) => (
              <LeafRow key={c.key} profile={profile} category={c.key} />
            ))}
          </div>
          <DepartmentWorkloadPanel workloads={workloads} />
        </>
      )}
    </div>
  );
}
