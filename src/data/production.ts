import type { Range, ScaleAnchor } from '../engine/interpolate';

// Every production dial is a continuous slider from 0 (cheapest/fastest/
// shortest) to 1 (priciest/most-meticulous/longest), or for the four spend
// dials, a currency amount on a log scale (so the cheap end - where a real
// indie budget lives - gets just as much slider resolution as the expensive
// end). Anchors calibrate quality/risk/cost-multiplier at a few reference
// points; engine/productionDials.ts interpolates between them for every
// point in between, so nothing here "jumps" - see docs/DESIGN.md.

export const CONTINGENCY_RANGE: Range = { min: 100_000, max: 40_000_000 };

// "Quality" here still feeds Production Score the way the old flat budget
// dial did (crew size and equipment genuinely do buy production value). The
// old single "risk" anchor is gone - contingency no longer has one built-in
// risk curve of its own, it instead offsets risk computed elsewhere
// (engine/production.ts:computeStaticProductionRisk uses contingencyT as a
// mitigating term against safety/technical/budget risk, not a standalone
// U-shaped curve). See docs/DESIGN.md 5.9 for why.
export const CONTINGENCY_ANCHORS: ScaleAnchor<'quality'>[] = [
  {
    t: 0, values: { quality: 22 },
    description: 'Guerrilla filmmaking - bare-minimum crew, equipment and insurance. A true indie hit can still come from here, but there\'s no cushion if anything ambitious goes wrong elsewhere.',
  },
  {
    t: 0.35, values: { quality: 52 },
    description: 'A modest, normal production - a working crew and a real (if thin) safety margin.',
  },
  {
    t: 0.65, values: { quality: 76 },
    description: 'A serious, well-resourced production. Real quality, and enough of a margin to absorb an ambitious effects or stunt choice elsewhere without it becoming a liability.',
  },
  {
    t: 1, values: { quality: 88 },
    description: 'Money-no-object filmmaking - the highest quality ceiling and the deepest safety margin. Still needs a genuine hit to pay off.',
  },
];

export const SET_QUALITY_RANGE: Range = { min: 20_000, max: 3_000_000 };

export const SET_QUALITY_ANCHORS: ScaleAnchor<'quality'>[] = [
  { t: 0, values: { quality: 32 }, description: 'Bare walls and borrowed locations. Cheap, but it shows on screen.' },
  { t: 0.5, values: { quality: 60 }, description: 'Solid, professional-looking sets at a moderate cost.' },
  { t: 1, values: { quality: 88 }, description: 'Lavish, detailed sets - expensive, but they elevate every scene.' },
];

export const PRACTICAL_EFFECTS_RANGE: Range = { min: 10_000, max: 2_500_000 };

export const PRACTICAL_EFFECTS_ANCHORS: ScaleAnchor<'quality'>[] = [
  { t: 0, values: { quality: 28 }, description: 'Whatever the crew can rig up for free. Fine for genres that don’t lean on it.' },
  { t: 0.5, values: { quality: 60 }, description: 'Solid stunts, makeup and physical effects work.' },
  { t: 1, values: { quality: 88 }, description: 'Top-tier practical effects - the genre that needs this will really show it off.' },
];

export const VFX_RANGE: Range = { min: 5_000, max: 12_000_000 };

export const VFX_ANCHORS: ScaleAnchor<'quality'>[] = [
  { t: 0, values: { quality: 8 }, description: 'Essentially no visual effects budget. Fine for grounded stories, a real problem for anything that needs spectacle.' },
  { t: 0.4, values: { quality: 40 }, description: 'A handful of simple effects shots - noticeable, but not spectacular.' },
  { t: 0.7, values: { quality: 65 }, description: 'A real visual effects budget capable of convincing set-pieces.' },
  { t: 1, values: { quality: 92 }, description: 'Blockbuster-grade VFX. Very expensive, but it can carry a whole film on spectacle alone.' },
];

export const RUNTIME_ANCHORS: ScaleAnchor<'costMultiplier' | 'marketabilityDelta'>[] = [
  {
    t: 0, values: { costMultiplier: 0.85, marketabilityDelta: -6 },
    description: 'A tight runtime. Cheaper to make, but feels slight and hurts marketability a touch.',
  },
  {
    t: 0.5, values: { costMultiplier: 1.0, marketabilityDelta: 5 },
    description: 'A conventional feature length - the safest choice for marketability.',
  },
  {
    t: 1, values: { costMultiplier: 1.15, marketabilityDelta: 0 },
    description: 'An epic runtime. Costs more to shoot and edit, with no particular marketability upside.',
  },
];
