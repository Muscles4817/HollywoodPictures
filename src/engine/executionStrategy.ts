// Workstream II, Phase B — Layer 2 of the production-requirements model
// (docs/DESIGN_production_requirements_model.md). EXECUTION STRATEGY: the
// production-level METHOD choices that decide HOW the film's narrative
// requirements are achieved. A single choice ripples across departments — the
// same written creature becomes a Stunts/Production-Design job (animatronic) or a
// VFX job (fully CG). Strategy is production-level and shared, not per-department.
//
// Today the "how" is collapsed into the script's effects/environment lean
// (Distribution scalars). This layer lifts it into explicit, named method axes so
// it can become a real producer decision. It is the seam between Layer 1
// (narrative requirements) and Layer 3 (department workload): the chosen method
// overrides the inferred approach routing when deriving the requirement profile.
//
// SCAFFOLDING slice, calibration-safe by the same argument as Layers 1 and 3:
// the strategy re-routes requirements → workload → the crew fit-reads (all
// non-scoring). It does NOT touch cost or box office. Persisting a chosen
// strategy on the draft and surfacing it as a production-plan decision is the
// follow-up slice; here the model, its lean-derived defaults, and the re-routing
// are established and demonstrable (dev inspector).
//
// v1 wires the two axes that Layer 1 already forks on — creature realisation and
// environment build. Destruction and action methods join when the taxonomy
// splits those requirements by approach (finer-taxonomy expansion); they are
// deliberately NOT surfaced here rather than shipped inert.
import type { Script } from '../types';
import { clamp } from './random';

/** How a written creature is realised — practical build ↔ fully digital. */
export type CreatureMethod = 'animatronic' | 'hybrid' | 'mostlyCG' | 'fullyCG';

/** How the film's world is built — on real locations ↔ fully digital. */
export type EnvironmentMethod = 'location' | 'studioBuild' | 'setExtension' | 'virtualProduction' | 'fullyDigital';

/** The production's chosen methods. Only the axes a film actually exposes matter. */
export interface ExecutionStrategy {
  creatureMethod: CreatureMethod;
  environmentMethod: EnvironmentMethod;
}

export type ExecutionStrategyAxis = keyof ExecutionStrategy;

// The practical/digital character of each method, 0 (fully practical) → 1 (fully
// digital). These drive the approach routes in the requirement derivation: the
// creature's practical vs digital split, and how much of the world is built
// digitally.
const CREATURE_DIGITAL: Record<CreatureMethod, number> = {
  animatronic: 0.0,
  hybrid: 0.5,
  mostlyCG: 0.82,
  fullyCG: 1.0,
};
const ENVIRONMENT_DIGITAL: Record<EnvironmentMethod, number> = {
  location: 0.0,
  studioBuild: 0.12,
  setExtension: 0.5,
  virtualProduction: 0.8,
  fullyDigital: 1.0,
};

/** The approach routes a chosen strategy imposes, replacing the lean-derived ones. */
export interface StrategyRoutes {
  practicalRoute: number; // creature embodiment (practical build)
  digitalRoute: number; // creature animation (CG)
  envDigitalRoute: number; // digital world-building
}

// Steep gains, matching the derivation's own ramp: a method commits the routing
// rather than leaving it half-on. Hybrid deliberately loads BOTH creature routes
// (a real hybrid build employs the practical shop and the VFX house at once).
function creatureRoutes(method: CreatureMethod): { practicalRoute: number; digitalRoute: number } {
  const d = CREATURE_DIGITAL[method];
  if (method === 'hybrid') return { practicalRoute: 0.7, digitalRoute: 0.7 };
  return { practicalRoute: clamp(1 - d * 1.25, 0, 1), digitalRoute: clamp(d * 1.25, 0, 1) };
}

export function strategyRoutes(strategy: ExecutionStrategy): StrategyRoutes {
  const { practicalRoute, digitalRoute } = creatureRoutes(strategy.creatureMethod);
  return { practicalRoute, digitalRoute, envDigitalRoute: ENVIRONMENT_DIGITAL[strategy.environmentMethod] };
}

/**
 * The default strategy for a script — the discrete method closest to the
 * script's existing effects/environment lean, so a film's pre-selected methods
 * match what it already implies. (The requirement derivation still uses the
 * continuous lean when no strategy is passed, so unengaged play is unchanged;
 * this is what the UI pre-selects once the player engages the axes.)
 */
export function deriveDefaultStrategy(script: Script): ExecutionStrategy {
  const digital = clamp(script.effectsStrategy.digital, 0, 1);
  const creatureMethod: CreatureMethod =
    digital < 0.3 ? 'animatronic' : digital < 0.55 ? 'hybrid' : digital < 0.8 ? 'mostlyCG' : 'fullyCG';

  const envDigital = clamp(script.environmentStrategy.digital, 0, 1);
  const studio = clamp(script.environmentStrategy.studio, 0, 1);
  const location = clamp(script.environmentStrategy.location, 0, 1);
  const environmentMethod: EnvironmentMethod =
    envDigital >= 0.6 ? 'fullyDigital'
      : envDigital >= 0.35 ? (studio >= location ? 'setExtension' : 'virtualProduction')
        : studio >= location ? 'studioBuild' : 'location';

  return { creatureMethod, environmentMethod };
}

/**
 * Which strategy axes this film meaningfully exposes — only offer a decision the
 * film actually contains. creatureMethod appears only when a creature is written;
 * environmentMethod whenever the film builds a world of any substance.
 */
export function relevantStrategyAxes(script: Script): ExecutionStrategyAxis[] {
  const axes: ExecutionStrategyAxis[] = [];
  if (script.cast.some((c) => c.archetype === 'MonsterOrCreature')) axes.push('creatureMethod');
  axes.push('environmentMethod'); // every film makes some environment decision
  return axes;
}

// --- Presentation metadata (labels/options for the dev inspector & later UI) ---
export interface StrategyOption<M extends string> {
  value: M;
  label: string;
  blurb: string;
}
export interface StrategyAxisMeta {
  axis: ExecutionStrategyAxis;
  label: string;
  question: string;
  options: StrategyOption<string>[];
}

export const CREATURE_METHOD_OPTIONS: StrategyOption<CreatureMethod>[] = [
  { value: 'animatronic', label: 'Animatronic', blurb: 'Practical build — loads the creature shop, stunts rigging and set integration.' },
  { value: 'hybrid', label: 'Hybrid', blurb: 'Practical build enhanced with CG — loads both the practical shop and the VFX house.' },
  { value: 'mostlyCG', label: 'Mostly CG', blurb: 'Digital creature with practical touch-points — loads VFX heavily.' },
  { value: 'fullyCG', label: 'Fully CG', blurb: 'Entirely digital — a VFX creature-animation job.' },
];
export const ENVIRONMENT_METHOD_OPTIONS: StrategyOption<EnvironmentMethod>[] = [
  { value: 'location', label: 'On location', blurb: 'Shoot the real world — loads location work, light digital.' },
  { value: 'studioBuild', label: 'Studio build', blurb: 'Built sets on stage — loads production design.' },
  { value: 'setExtension', label: 'Set extension', blurb: 'Partial builds extended digitally — splits design and VFX.' },
  { value: 'virtualProduction', label: 'Virtual production', blurb: 'LED volume / in-camera VFX — leans digital, needs the pipeline.' },
  { value: 'fullyDigital', label: 'Fully digital', blurb: 'The world is built in VFX — loads digital environments.' },
];

export const STRATEGY_AXIS_META: Record<ExecutionStrategyAxis, StrategyAxisMeta> = {
  creatureMethod: {
    axis: 'creatureMethod', label: 'Creature method', question: 'How is the creature realised?',
    options: CREATURE_METHOD_OPTIONS,
  },
  environmentMethod: {
    axis: 'environmentMethod', label: 'Environment method', question: 'How is the world built?',
    options: ENVIRONMENT_METHOD_OPTIONS,
  },
};
