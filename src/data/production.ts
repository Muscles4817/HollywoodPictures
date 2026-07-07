import type {
  BudgetLevel,
  ShootingStyle,
  SetQuality,
  EffectsLevel,
  VfxSpend,
  RuntimeTarget,
} from '../types';

// Every production lever contributes both a cost and a 0-100 "quality score"
// component (and sometimes a risk score used for production-event odds),
// plus a plain-English description shown to the player when they select it.
// Tune these tables to rebalance production planning.

export const BUDGET_LEVEL_PROFILES: Record<
  BudgetLevel,
  { baseCost: number; qualityScore: number; riskScore: number; description: string }
> = {
  // Kept low enough that a shoestring first film (cheap script + cheapest
  // mandatory cast) always fits comfortably inside the £5M starting cash.
  Cheap: {
    baseCost: 900_000, qualityScore: 30, riskScore: 60,
    description: 'Bare-bones budget. Cheapest option by far, but low quality and a rushed, risk-prone shoot.',
  },
  Standard: {
    baseCost: 6_000_000, qualityScore: 55, riskScore: 35,
    description: 'A normal, well-resourced production. Balanced cost, quality and risk.',
  },
  Premium: {
    baseCost: 15_000_000, qualityScore: 75, riskScore: 20,
    description: 'A serious budget that buys real quality and a safer shoot - but the cost is serious too.',
  },
  Excessive: {
    baseCost: 35_000_000, qualityScore: 85, riskScore: 30,
    // Excessive budgets buy quality but invite hubris/bloat risk to creep back up.
    description: 'Money-no-object filmmaking. The highest quality ceiling, but bloat and hubris creep the risk back up - and it needs a genuine hit to pay off.',
  },
};

export const SHOOTING_STYLE_PROFILES: Record<
  ShootingStyle,
  { costMultiplier: number; qualityScore: number; riskScore: number; description: string }
> = {
  Fast: {
    costMultiplier: 0.8, qualityScore: 40, riskScore: 55,
    description: 'Shoot quick and cheap. Cuts cost, but rushed schedules mean more can go wrong on set.',
  },
  Balanced: {
    costMultiplier: 1.0, qualityScore: 60, riskScore: 30,
    description: 'A normal shooting pace - no cost discount, no particular rush.',
  },
  Perfectionist: {
    costMultiplier: 1.35, qualityScore: 85, riskScore: 15,
    description: 'Take after take until it’s right. Costs more and takes longer, but the safest, highest-quality way to shoot.',
  },
};

export const SET_QUALITY_PROFILES: Record<SetQuality, { cost: number; qualityScore: number; description: string }> = {
  Basic: { cost: 150_000, qualityScore: 35, description: 'Minimal sets and locations. Cheap, but it shows on screen.' },
  Good: { cost: 1_000_000, qualityScore: 60, description: 'Solid, professional-looking sets at a moderate cost.' },
  Great: { cost: 2_500_000, qualityScore: 85, description: 'Lavish, detailed sets - expensive, but they elevate every scene.' },
};

export const PRACTICAL_EFFECTS_PROFILES: Record<EffectsLevel, { cost: number; qualityScore: number; description: string }> = {
  Low: { cost: 100_000, qualityScore: 30, description: 'Bare minimum practical effects work - fine for genres that don’t lean on it.' },
  Medium: { cost: 800_000, qualityScore: 60, description: 'Solid stunts, makeup and physical effects work.' },
  High: { cost: 2_000_000, qualityScore: 85, description: 'Top-tier practical effects - the genre that needs this will really show it off.' },
};

export const VFX_SPEND_PROFILES: Record<VfxSpend, { cost: number; qualityScore: number; description: string }> = {
  None: { cost: 0, qualityScore: 10, description: 'No visual effects budget at all. Fine for grounded stories, a real problem for anything that needs spectacle.' },
  Low: { cost: 1_000_000, qualityScore: 40, description: 'A handful of simple effects shots - noticeable, but not spectacular.' },
  Medium: { cost: 4_000_000, qualityScore: 65, description: 'A real visual effects budget capable of convincing set-pieces.' },
  High: { cost: 10_000_000, qualityScore: 90, description: 'Blockbuster-grade VFX. Very expensive, but it can carry a whole film on spectacle alone.' },
};

export const RUNTIME_TARGET_PROFILES: Record<
  RuntimeTarget,
  { costMultiplier: number; marketabilityDelta: number; description: string }
> = {
  Short: { costMultiplier: 0.9, marketabilityDelta: -5, description: 'A tight runtime. Cheaper to make, but feels slight and hurts marketability a touch.' },
  Standard: { costMultiplier: 1.0, marketabilityDelta: 5, description: 'A conventional feature length - the safest choice for marketability.' },
  Long: { costMultiplier: 1.15, marketabilityDelta: 0, description: 'An epic runtime. Costs more to shoot and edit, with no particular marketability upside.' },
};
