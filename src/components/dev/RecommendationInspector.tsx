import { useRef, useState } from 'react';
import { GENRES } from '../../data/genres';
import { REFERENCE_SCRIPTS } from '../../data/dev/referenceScripts';
import { REFERENCE_DIRECTORS } from '../../data/dev/referenceDirectors';
import { generateScriptOptions } from '../../engine/scriptGenerator';
import { generateTalentCandidates } from '../../engine/talentGenerator';
import { createRng } from '../../engine/random';
import {
  dominantLean,
  explainEffectsStrategy,
  explainEnvironmentStrategy,
  recommendEffectsAmbition,
  recommendEnvironmentAmbition,
  type StrategyBreakdown,
} from '../../engine/recommendation';
import { Button } from '../common/Button';
import { ScoreBar } from '../common/ScoreBar';
import type { DirectorTalent, Distribution, Genre, NormalizedScalar, Recommendation, Script } from '../../types';

// Developer-only tool for inspecting the recommendation engine
// (engine/recommendation.ts) directly against dozens of generated script/
// director pairs, without needing Plan Production to exist yet - see
// docs/DESIGN.md. Not reachable from normal play, not persisted anywhere,
// and generates its own scripts/directors from a local RNG rather than
// touching the real studio's talent pool or save data.

type Strength = 'Strong' | 'Moderate' | 'Weak';

/**
 * Derived here, not stored anywhere - Recommendation<T> deliberately has no
 * "strength" concept (see docs/DESIGN.md). Normalizes the final value's
 * dominant-key lean against the maximum a distribution of this size could
 * possibly show (1 - 1/n), so a 2-key Effects split and a 3-key Environment
 * split read on the same 0-1 scale rather than Effects always looking
 * "weaker" purely because it has fewer keys to spread across.
 */
function recommendationStrength<K extends string>(value: Distribution<K>): Strength {
  const keys = Object.keys(value) as K[];
  const maxOverBaseline = 1 - 1 / keys.length;
  const normalized = maxOverBaseline > 0 ? dominantLean(value).overBaseline / maxOverBaseline : 0;
  if (normalized >= 0.5) return 'Strong';
  if (normalized >= 0.2) return 'Moderate';
  return 'Weak';
}

function DistributionBars<K extends string>({ dist }: { dist: Distribution<K> }) {
  return (
    <>
      {(Object.entries(dist) as [K, number][]).map(([key, value]) => (
        <ScoreBar key={key} label={key} value={value * 100} />
      ))}
    </>
  );
}

function ReasonsList({ reasons }: { reasons: string[] }) {
  return (
    <ol style={{ margin: 0, paddingLeft: 20 }}>
      {reasons.map((r, i) => (
        <li key={i}>{r}</li>
      ))}
    </ol>
  );
}

function StrategyPanel<K extends string>({ title, breakdown }: { title: string; breakdown: StrategyBreakdown<K> }) {
  const strength = recommendationStrength(breakdown.recommendation.value);
  return (
    <div className="card stack">
      <div className="row-between">
        <h2 style={{ margin: 0 }}>{title}</h2>
        <span className="row" style={{ gap: 8 }}>
          <span className="badge">{breakdown.agreementState}</span>
          <span className="badge">{strength}</span>
        </span>
      </div>

      <div className="row">
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 4px' }}>Script (raw)</h3>
          <DistributionBars dist={breakdown.scriptRaw} />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 4px' }}>Director (raw)</h3>
          <DistributionBars dist={breakdown.directorRaw} />
        </div>
      </div>

      <div className="row">
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 4px' }}>Blended (before damping)</h3>
          <DistributionBars dist={breakdown.blendedBeforeDamping} />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 4px' }}>Final recommendation (after damping)</h3>
          <DistributionBars dist={breakdown.recommendation.value} />
        </div>
      </div>

      <div className="row" style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>
        <span>Script/director distance: {breakdown.distance.toFixed(3)}</span>
        <span>Director influence: {breakdown.directorInfluence.toFixed(3)}</span>
        <span>Ambition: {(breakdown.ambition * 100).toFixed(0)}%</span>
        <span>Confidence: {(breakdown.confidence * 100).toFixed(0)}%</span>
      </div>

      <div>
        <h3 style={{ margin: '0 0 4px' }}>Reasons (ordered by influence)</h3>
        <ReasonsList reasons={breakdown.recommendation.reasons} />
      </div>
    </div>
  );
}

function AmbitionPanel({ title, rec }: { title: string; rec: Recommendation<NormalizedScalar> }) {
  return (
    <div className="card stack">
      <h2 style={{ margin: 0 }}>{title}</h2>
      <ScoreBar label="Value" value={rec.value * 100} />
      <ReasonsList reasons={rec.reasons} />
    </div>
  );
}

export function RecommendationInspector() {
  // One RNG instance for the whole session, advanced (never recreated) on
  // every reroll - guarantees genuinely fresh values on every click,
  // independent of the real studio's own rngSeed/save data.
  const rngRef = useRef(createRng(Date.now()));
  const [genre, setGenre] = useState<Genre>('Action');
  // Defaults to a real reference pair rather than a random one - easier to
  // start reasoning from something with a known real-world answer.
  const [script, setScript] = useState<Script>(REFERENCE_SCRIPTS[0]);
  const [director, setDirector] = useState<DirectorTalent>(REFERENCE_DIRECTORS[0]);

  function rerollScript(forGenre: Genre = genre) {
    setScript(generateScriptOptions(forGenre, rngRef.current, 1)[0]);
  }
  function rerollDirector() {
    setDirector(generateTalentCandidates('Director', rngRef.current, 1)[0] as DirectorTalent);
  }

  const envStrategy = explainEnvironmentStrategy(script, director);
  const fxStrategy = explainEffectsStrategy(script, director);
  const envAmbition = recommendEnvironmentAmbition(script);
  const fxAmbition = recommendEffectsAmbition(script);

  return (
    <div className="stack">
      <div>
        <h1 style={{ margin: 0 }}>Recommendation Inspector</h1>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>
          Developer tool - generates its own scripts/directors, doesn't touch the real studio or save data.
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
        <Button onClick={rerollDirector}>New Director</Button>
        <Button
          variant="primary"
          onClick={() => {
            rerollScript();
            rerollDirector();
          }}
        >
          New Both
        </Button>
      </div>

      <div className="row" style={{ alignItems: 'center' }}>
        <span className="stat-label" style={{ margin: 0 }}>Reference (real films/directors)</span>
        <select
          value={script.id}
          onChange={(e) => {
            const found = REFERENCE_SCRIPTS.find((s) => s.id === e.target.value);
            if (found) setScript(found);
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
        <select
          value={director.id}
          onChange={(e) => {
            const found = REFERENCE_DIRECTORS.find((d) => d.id === e.target.value);
            if (found) setDirector(found);
          }}
        >
          <option value="" disabled>
            Load a real director...
          </option>
          {REFERENCE_DIRECTORS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <div className="row">
        <div className="card stack" style={{ flex: 1 }}>
          <h2 style={{ margin: 0 }}>Script</h2>
          <p style={{ margin: 0 }}>
            <strong>{script.title}</strong> &middot; {script.genre} &middot; complexity {script.complexity}
          </p>
          <div className="row">
            <div style={{ flex: 1 }}>
              <div className="stat-label">Environment Strategy</div>
              <DistributionBars dist={script.environmentStrategy} />
              <ScoreBar label="Environment Ambition" value={script.environmentAmbition * 100} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="stat-label">Effects Strategy</div>
              <DistributionBars dist={script.effectsStrategy} />
              <ScoreBar label="Effects Ambition" value={script.effectsAmbition * 100} />
            </div>
          </div>
        </div>

        <div className="card stack" style={{ flex: 1 }}>
          <h2 style={{ margin: 0 }}>Director</h2>
          <p style={{ margin: 0 }}>
            <strong>{director.name}</strong> &middot; skill {director.skill}
          </p>
          <div className="row">
            <div style={{ flex: 1 }}>
              <div className="stat-label">Environment Strategy</div>
              <DistributionBars dist={director.productionStyle.environmentStrategy} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="stat-label">Effects Strategy</div>
              <DistributionBars dist={director.productionStyle.effectsStrategy} />
            </div>
          </div>
        </div>
      </div>

      <StrategyPanel title="Environment Strategy" breakdown={envStrategy} />
      <StrategyPanel title="Effects Strategy" breakdown={fxStrategy} />
      <div className="row">
        <div style={{ flex: 1 }}>
          <AmbitionPanel title="Environment Ambition" rec={envAmbition} />
        </div>
        <div style={{ flex: 1 }}>
          <AmbitionPanel title="Effects Ambition" rec={fxAmbition} />
        </div>
      </div>
    </div>
  );
}
