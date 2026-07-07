import type { Range, ScaleAnchor } from '../engine/interpolate';

// Every production dial is a continuous slider from 0 (cheapest/fastest/
// shortest) to 1 (priciest/most-meticulous/longest), or for the four spend
// dials, a currency amount on a log scale (so the cheap end - where a real
// indie budget lives - gets just as much slider resolution as the expensive
// end). Anchors calibrate quality/risk/cost-multiplier at a few reference
// points; engine/productionDials.ts interpolates between them for every
// point in between, so nothing here "jumps" - see docs/DESIGN.md.

export const BUDGET_RANGE: Range = { min: 100_000, max: 40_000_000 };

export const BUDGET_ANCHORS: ScaleAnchor<'quality' | 'risk'>[] = [
  {
    t: 0, values: { quality: 22, risk: 68 },
    description: 'Guerrilla filmmaking - the cheapest possible shoot. Quality suffers and things are more likely to go wrong, but a true indie hit can still come from here.',
  },
  {
    t: 0.35, values: { quality: 52, risk: 38 },
    description: 'A modest, normal production. Balanced cost, quality and risk.',
  },
  {
    t: 0.65, values: { quality: 76, risk: 20 },
    description: 'A serious, well-resourced budget. Real quality and a safer shoot - at a real cost.',
  },
  {
    t: 1, values: { quality: 88, risk: 34 },
    // Excessive budgets buy quality but invite hubris/bloat risk to creep back up.
    description: 'Money-no-object filmmaking. The highest quality ceiling, but bloat and hubris creep the risk back up - and it needs a genuine hit to pay off.',
  },
];

export const SHOOTING_ANCHORS: ScaleAnchor<'quality' | 'risk' | 'costMultiplier'>[] = [
  {
    t: 0, values: { quality: 40, risk: 55, costMultiplier: 0.75 },
    description: 'Shoot fast and loose. Cuts cost, but rushed schedules mean more can go wrong on set.',
  },
  {
    t: 0.5, values: { quality: 60, risk: 30, costMultiplier: 1.0 },
    description: 'A normal shooting pace - no particular rush, no particular luxury.',
  },
  {
    t: 1, values: { quality: 85, risk: 15, costMultiplier: 1.4 },
    description: 'Take after take until it’s right. Costs more and takes longer, but the safest, highest-quality way to shoot.',
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
