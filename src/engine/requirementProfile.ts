// Workstream II, Phase B — Layer 1 of the production-requirements model
// (docs/DESIGN_production_requirements_model.md). A *narrative* requirement
// profile: what a film must contain, story-level and execution-agnostic, derived
// purely from the script.
//
// This is the SCAFFOLDING slice: types + a pure derivation + a read-only summary.
// It changes neither cost nor scoring — nothing here feeds box office yet, so it
// is calibration-safe by construction. Later phases hang Execution Strategy
// (Layer 2), Department Workload (Layer 3) and Department Simulation (Layer 4)
// off this floor, and eventually make the existing coarse `ProductionRequirements`
// a derived VIEW of this finer profile. Until then this reads the coarse
// requirements (plus setting/story/tone signals) rather than replacing them.
//
// Taxonomy discipline (design Addition #5): a leaf earns its place only if it
// (a) affects ≥2 systems and (b) creates a real production decision. The set
// below is the mid-grained v1 ceiling — rich enough to separate grounded drama ·
// period drama · action · creature horror · effects-heavy sci-fi · large-scale
// war, disciplined enough to resist explosion. New leaves require passing that
// test in review; prefer magnitude on a parent over a new leaf.
import type { Script, ScriptCharacter, Tone } from '../types';
import { SETTING_ARCHETYPE_PROFILES } from '../data/settings';
import { clamp } from './random';

/** The five broad categories every requirement leaf belongs to. */
export type RequirementCategory =
  | 'environments' // Physical Environments
  | 'transformation' // Character Transformation
  | 'action' // Action / Movement
  | 'digital' // Digital Imagery
  | 'logistics'; // Logistical Scale

/**
 * The ways a requirement *could* be achieved. This is the seam where Layer 1
 * (narrative) meets Layer 2 (execution strategy): a leaf declares the approaches
 * that are legitimate for it; a later strategy layer CHOOSES among them and that
 * choice routes the workload to different departments (a CG dragon → VFX; a
 * suit-and-miniature dragon → Creature + Practical + Production Design). Strategy
 * selection itself is out of scope for this scaffolding slice.
 */
export type ExecutionApproach =
  | 'practical'
  | 'prosthetic'
  | 'animatronic'
  | 'miniature'
  | 'studio'
  | 'location'
  | 'virtualProduction'
  | 'cg';

/** Stable identifiers for the v1 leaf set. */
export type RequirementLeafKey =
  // Physical Environments
  | 'periodArchitecture'
  | 'studioBuild'
  | 'locationWork'
  // Character Transformation
  | 'periodCostume'
  | 'prostheticsMakeup'
  | 'creatureEmbodiment'
  | 'digitalDoubles'
  // Action / Movement
  | 'combatStunts'
  | 'vehicleAction'
  | 'practicalDestruction'
  | 'danceChoreography'
  // Digital Imagery
  | 'digitalEnvironments'
  | 'creatureAnimation'
  | 'compositingVfx'
  // Logistical Scale
  | 'extras'
  | 'crowdWork'
  | 'animals';

/**
 * One narrative requirement present in a film. All four scalars are 0-1.
 * - magnitude: screen weight when present (how much of the film it is).
 * - frequency: how often it recurs across the film.
 * - complexity: inherent technical difficulty of realising it.
 * - criticality: how central it is to the film landing — a marketed set-piece
 *   vs. background texture. Drives how much a mismatch HURTS later, not how much
 *   it costs.
 */
export interface RequirementLeaf {
  key: RequirementLeafKey;
  category: RequirementCategory;
  label: string;
  magnitude: number;
  frequency: number;
  complexity: number;
  criticality: number;
  permittedApproaches: ExecutionApproach[];
}

/**
 * A film's narrative requirements — only the leaves actually PRESENT (magnitude
 * above the floor), so a grounded drama yields a short profile and a war epic a
 * long one. Sorted most-critical first. Matches the design's stated shape
 * (`type RequirementProfile = RequirementLeaf[]`).
 */
export type RequirementProfile = RequirementLeaf[];

// A leaf is only emitted once it carries at least this much screen weight;
// below it, the requirement is folded into the film's texture rather than being
// its own tracked production concern.
export const REQUIREMENT_PRESENCE_FLOOR = 0.15;

// --- Signals ---------------------------------------------------------------
// A flat read of the script into the raw numbers the leaf derivers key off.
// Everything is 0-1 so the leaf formulas compose cleanly.
interface RequirementSignals {
  pr: Script['productionRequirements'];
  setting: (typeof SETTING_ARCHETYPE_PROFILES)[keyof typeof SETTING_ARCHETYPE_PROFILES];
  tone: Script['toneProfile'];
  scaleWeight: number; // Intimate 0.3 · Medium 0.55 · Epic 0.85
  complexityWeight: number; // script.complexity / 100
  digitalBias: number; // effectsStrategy.digital, 0-1
  practicalBias: number; // effectsStrategy.practical, 0-1
  // Steep routing gains for approach-forked requirements (a creature realised
  // in suits vs CG). 0 below a ~0.35 lean, ramping to 1 by ~0.8, so a
  // practical-leaning production suppresses the CG route and vice versa — the
  // design's "same requirement, different departments by approach" crux.
  practicalRoute: number;
  digitalRoute: number;
  envDigitalRoute: number; // environmentStrategy.digital, ramped — how much of the world is built digitally
  isHorror: boolean;
  isWar: boolean;
  hasCreature: boolean;
  maxPhysical: number; // strongest character physicalDemand, 0-1
  maxTransform: number; // strongest character transformationDemand, 0-1
  action: number; // tone.action, 0-1
}

const SCALE_WEIGHT: Record<Script['scale'], number> = { Intimate: 0.3, Medium: 0.55, Epic: 0.85 };

function maxTrait(cast: ScriptCharacter[], pick: (t: ScriptCharacter['traits']) => number): number {
  if (cast.length === 0) return 0;
  return clamp(Math.max(...cast.map((c) => pick(c.traits))) / 100, 0, 1);
}

// Ramp: 0 at or below `lo`, 1 at or above `hi`, linear between.
function ramp(value: number, lo: number, hi: number): number {
  return clamp((value - lo) / (hi - lo), 0, 1);
}

function readSignals(script: Script): RequirementSignals {
  const digitalBias = clamp(script.effectsStrategy.digital, 0, 1);
  const practicalBias = clamp(script.effectsStrategy.practical, 0, 1);
  return {
    pr: script.productionRequirements,
    setting: SETTING_ARCHETYPE_PROFILES[script.primarySetting],
    tone: script.toneProfile,
    scaleWeight: SCALE_WEIGHT[script.scale],
    complexityWeight: clamp(script.complexity / 100, 0, 1),
    digitalBias,
    practicalBias,
    practicalRoute: ramp(practicalBias, 0.35, 0.8),
    digitalRoute: ramp(digitalBias, 0.35, 0.8),
    envDigitalRoute: ramp(script.environmentStrategy.digital, 0.3, 0.8),
    isHorror: script.genre === 'Horror',
    isWar: script.storyType === 'War',
    hasCreature: script.cast.some((c) => c.archetype === 'MonsterOrCreature'),
    maxPhysical: maxTrait(script.cast, (t) => t.physicalDemand),
    maxTransform: maxTrait(script.cast, (t) => t.transformationDemand),
    action: clamp(script.toneProfile.action / 100, 0, 1),
  };
}

// --- Leaf definitions ------------------------------------------------------
// Each leaf authors its static identity (category, label, permitted approaches,
// inherent craft difficulty, and which tone signals its centrality) plus a pure
// `magnitude` read of the signals. The other three scalars follow from uniform
// rules (below) rather than per-leaf magic numbers:
//   frequency   = magnitude spread wider on bigger productions
//   complexity  = the leaf's inherent difficulty, lifted by the script's own
//                 complexity scalar
//   criticality = magnitude weighted by how tonally central the leaf is
interface LeafDefinition {
  key: RequirementLeafKey;
  category: RequirementCategory;
  label: string;
  permittedApproaches: ExecutionApproach[];
  baseComplexity: number; // 0-1 inherent craft difficulty
  criticalTone: Tone; // which tone axis signals this leaf's centrality
  magnitude: (s: RequirementSignals) => number;
}

const c01 = (n: number) => clamp(n, 0, 1);

const LEAF_DEFINITIONS: LeafDefinition[] = [
  // Physical Environments
  {
    key: 'periodArchitecture', category: 'environments', label: 'Period architecture',
    permittedApproaches: ['studio', 'location', 'cg'], baseComplexity: 0.55, criticalTone: 'drama',
    magnitude: (s) => (s.pr.periodSetting ? c01(0.45 + 0.4 * s.setting.setConstructionDemand + 0.2 * s.scaleWeight) : 0),
  },
  {
    key: 'studioBuild', category: 'environments', label: 'Constructed sets',
    permittedApproaches: ['studio', 'cg'], baseComplexity: 0.5, criticalTone: 'spectacle',
    magnitude: (s) => c01(s.setting.setConstructionDemand * (0.7 + 0.4 * s.scaleWeight)),
  },
  {
    key: 'locationWork', category: 'environments', label: 'Location shooting',
    permittedApproaches: ['location'], baseComplexity: 0.4, criticalTone: 'drama',
    magnitude: (s) => c01(Math.max(s.pr.locations, s.setting.locationComplexity, s.setting.travelDemand) * (0.7 + 0.4 * s.scaleWeight)),
  },
  // Character Transformation
  {
    key: 'periodCostume', category: 'transformation', label: 'Period costume',
    permittedApproaches: ['practical'], baseComplexity: 0.45, criticalTone: 'drama',
    magnitude: (s) => (s.pr.periodSetting ? c01(0.5 + 0.3 * s.scaleWeight) : 0),
  },
  {
    key: 'prostheticsMakeup', category: 'transformation', label: 'Prosthetics & makeup',
    permittedApproaches: ['prosthetic', 'practical'], baseComplexity: 0.55, criticalTone: 'suspense',
    // Ordinary characters carry a low transformationDemand as texture; only
    // genuine transformation (heavy makeup, prosthetic work) clears the floor.
    magnitude: (s) => c01(0.95 * ramp(s.maxTransform, 0.3, 0.9) + (s.isHorror ? 0.2 : 0)),
  },
  {
    key: 'creatureEmbodiment', category: 'transformation', label: 'Practical creature',
    permittedApproaches: ['animatronic', 'prosthetic', 'practical'], baseComplexity: 0.7, criticalTone: 'spectacle',
    // Present only when a creature is written AND execution leans practical — the
    // same creature routed digitally lands on `creatureAnimation` instead.
    magnitude: (s) => (s.hasCreature ? c01((0.55 + 0.5 * s.pr.practicalEffects + 0.3 * s.maxTransform) * s.practicalRoute) : 0),
  },
  {
    key: 'digitalDoubles', category: 'transformation', label: 'Digital doubles',
    permittedApproaches: ['cg'], baseComplexity: 0.7, criticalTone: 'spectacle',
    magnitude: (s) => c01(s.pr.vfx * s.maxPhysical * (0.4 + 0.9 * s.digitalBias)),
  },
  // Action / Movement
  {
    key: 'combatStunts', category: 'action', label: 'Combat & stunts',
    permittedApproaches: ['practical', 'cg'], baseComplexity: 0.55, criticalTone: 'action',
    // Baseline physicality / a mild action tone is ordinary movement, not stunt
    // work; it has to be pronounced before it becomes its own requirement.
    magnitude: (s) => c01(Math.max(s.pr.stunts, ramp(s.maxPhysical, 0.35, 0.9), ramp(s.action, 0.45, 0.95))),
  },
  {
    key: 'vehicleAction', category: 'action', label: 'Vehicle action',
    permittedApproaches: ['practical', 'cg'], baseComplexity: 0.6, criticalTone: 'action',
    magnitude: (s) => (s.pr.vehicles ? c01(0.4 + 0.5 * Math.max(s.pr.stunts, s.action)) : 0),
  },
  {
    key: 'practicalDestruction', category: 'action', label: 'Practical destruction & SFX',
    permittedApproaches: ['practical', 'miniature', 'cg'], baseComplexity: 0.6, criticalTone: 'spectacle',
    magnitude: (s) => c01(s.pr.practicalEffects * (0.7 + 0.4 * s.scaleWeight) + (s.isWar ? 0.2 : 0)),
  },
  {
    key: 'danceChoreography', category: 'action', label: 'Dance & choreography',
    permittedApproaches: ['practical'], baseComplexity: 0.45, criticalTone: 'spectacle',
    magnitude: (s) => c01(s.pr.choreography),
  },
  // Digital Imagery
  {
    key: 'digitalEnvironments', category: 'digital', label: 'Digital environments',
    permittedApproaches: ['cg', 'virtualProduction'], baseComplexity: 0.65, criticalTone: 'spectacle',
    // Driven by an actual digital world-building lean (environmentStrategy),
    // amplified by how much the setting needs it — not by the setting's latent
    // demand alone (a period city shot practically is not a digital environment).
    magnitude: (s) => c01(Math.max(s.setting.vfxEnvironmentDemand, s.pr.vfx) * s.envDigitalRoute * (0.8 + 0.3 * s.scaleWeight)),
  },
  {
    key: 'creatureAnimation', category: 'digital', label: 'CG creatures',
    permittedApproaches: ['cg'], baseComplexity: 0.75, criticalTone: 'spectacle',
    // The digital counterpart to `creatureEmbodiment`: a written creature realised
    // through VFX under a digital-leaning strategy.
    magnitude: (s) => (s.hasCreature ? c01((0.45 + 0.6 * s.pr.vfx) * s.digitalRoute) : 0),
  },
  {
    key: 'compositingVfx', category: 'digital', label: 'Compositing & VFX shots',
    permittedApproaches: ['cg'], baseComplexity: 0.5, criticalTone: 'spectacle',
    magnitude: (s) => c01(s.pr.vfx * (0.6 + 0.6 * s.digitalBias)),
  },
  // Logistical Scale
  {
    key: 'extras', category: 'logistics', label: 'Background extras',
    permittedApproaches: ['practical'], baseComplexity: 0.3, criticalTone: 'spectacle',
    magnitude: (s) => c01(Math.max(s.pr.extras, 0.8 * s.setting.extrasDemand)),
  },
  {
    key: 'crowdWork', category: 'logistics', label: 'Crowd & battle coordination',
    permittedApproaches: ['practical', 'cg'], baseComplexity: 0.5, criticalTone: 'spectacle',
    magnitude: (s) => c01(s.pr.crowdWork + (s.isWar ? 0.15 : 0)),
  },
  {
    key: 'animals', category: 'logistics', label: 'Animal work',
    permittedApproaches: ['practical', 'cg'], baseComplexity: 0.5, criticalTone: 'drama',
    magnitude: (s) => (s.pr.animals ? 0.5 : 0),
  },
];

function buildLeaf(def: LeafDefinition, s: RequirementSignals): RequirementLeaf | null {
  const magnitude = c01(def.magnitude(s));
  if (magnitude < REQUIREMENT_PRESENCE_FLOOR) return null;
  const frequency = c01(magnitude * (0.7 + 0.5 * s.scaleWeight));
  const complexity = c01(def.baseComplexity * (0.6 + 0.5 * s.complexityWeight));
  const toneCentrality = c01(s.tone[def.criticalTone] / 100);
  const criticality = c01(magnitude * (0.55 + 0.6 * toneCentrality));
  return {
    key: def.key,
    category: def.category,
    label: def.label,
    magnitude,
    frequency,
    complexity,
    criticality,
    permittedApproaches: def.permittedApproaches,
  };
}

/**
 * Derive a film's narrative requirement profile from its script. Pure — no
 * scoring, no cost, no side effects. Only present leaves are returned, most
 * critical first.
 */
export function deriveRequirementProfile(script: Script): RequirementProfile {
  const signals = readSignals(script);
  return LEAF_DEFINITIONS
    .map((def) => buildLeaf(def, signals))
    .filter((leaf): leaf is RequirementLeaf => leaf !== null)
    .sort((a, b) => b.criticality - a.criticality || b.magnitude - a.magnitude);
}

/** The present leaves in a given category, most critical first. */
export function requirementsInCategory(profile: RequirementProfile, category: RequirementCategory): RequirementLeaf[] {
  return profile.filter((leaf) => leaf.category === category);
}

/**
 * A single 0-1 read of how demanding a category is for this film — the
 * criticality-weighted magnitude of its present leaves. A convenience for
 * dev inspection and, later, department-workload derivation; not a scoring input
 * on its own.
 */
export function categoryPressure(profile: RequirementProfile, category: RequirementCategory): number {
  const leaves = requirementsInCategory(profile, category);
  if (leaves.length === 0) return 0;
  const weighted = leaves.reduce((sum, l) => sum + l.magnitude * (0.5 + 0.5 * l.criticality), 0);
  return clamp(weighted / leaves.length, 0, 1);
}

const CATEGORY_LABELS: Record<RequirementCategory, string> = {
  environments: 'Physical Environments',
  transformation: 'Character Transformation',
  action: 'Action / Movement',
  digital: 'Digital Imagery',
  logistics: 'Logistical Scale',
};

/**
 * A plain-text, read-only summary of a requirement profile — for the dev
 * inspector and debugging. Reads raw scalars (dev/test surface only; not
 * player-facing presentation).
 */
export function summarizeRequirementProfile(profile: RequirementProfile): string {
  if (profile.length === 0) return 'No significant production requirements.';
  const pct = (n: number) => `${Math.round(n * 100)}`;
  const order: RequirementCategory[] = ['environments', 'transformation', 'action', 'digital', 'logistics'];
  const lines: string[] = [];
  for (const category of order) {
    const leaves = requirementsInCategory(profile, category);
    if (leaves.length === 0) continue;
    lines.push(`${CATEGORY_LABELS[category]} (${pct(categoryPressure(profile, category))}%)`);
    for (const l of leaves) {
      lines.push(`  · ${l.label} — mag ${pct(l.magnitude)} · freq ${pct(l.frequency)} · cplx ${pct(l.complexity)} · crit ${pct(l.criticality)}`);
    }
  }
  return lines.join('\n');
}
