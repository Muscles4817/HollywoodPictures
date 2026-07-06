import type {
  BudgetLevel,
  ShootingStyle,
  SetQuality,
  EffectsLevel,
  VfxSpend,
  RuntimeTarget,
} from '../types';

// Every production lever contributes both a cost and a 0-100 "quality score"
// component (and sometimes a risk score used for production-event odds).
// Tune these tables to rebalance production planning.

export const BUDGET_LEVEL_PROFILES: Record<
  BudgetLevel,
  { baseCost: number; qualityScore: number; riskScore: number }
> = {
  // Kept low enough that a shoestring first film (cheap script + cheapest
  // mandatory cast) always fits comfortably inside the £5M starting cash.
  Cheap: { baseCost: 900_000, qualityScore: 30, riskScore: 60 },
  Standard: { baseCost: 6_000_000, qualityScore: 55, riskScore: 35 },
  Premium: { baseCost: 15_000_000, qualityScore: 75, riskScore: 20 },
  // Excessive budgets buy quality but invite hubris/bloat risk to creep back up.
  Excessive: { baseCost: 35_000_000, qualityScore: 85, riskScore: 30 },
};

export const SHOOTING_STYLE_PROFILES: Record<
  ShootingStyle,
  { costMultiplier: number; qualityScore: number; riskScore: number }
> = {
  Fast: { costMultiplier: 0.8, qualityScore: 40, riskScore: 55 },
  Balanced: { costMultiplier: 1.0, qualityScore: 60, riskScore: 30 },
  Perfectionist: { costMultiplier: 1.35, qualityScore: 85, riskScore: 15 },
};

export const SET_QUALITY_PROFILES: Record<SetQuality, { cost: number; qualityScore: number }> = {
  Basic: { cost: 150_000, qualityScore: 35 },
  Good: { cost: 1_000_000, qualityScore: 60 },
  Great: { cost: 2_500_000, qualityScore: 85 },
};

export const PRACTICAL_EFFECTS_PROFILES: Record<EffectsLevel, { cost: number; qualityScore: number }> = {
  Low: { cost: 100_000, qualityScore: 30 },
  Medium: { cost: 800_000, qualityScore: 60 },
  High: { cost: 2_000_000, qualityScore: 85 },
};

export const VFX_SPEND_PROFILES: Record<VfxSpend, { cost: number; qualityScore: number }> = {
  None: { cost: 0, qualityScore: 10 },
  Low: { cost: 1_000_000, qualityScore: 40 },
  Medium: { cost: 4_000_000, qualityScore: 65 },
  High: { cost: 10_000_000, qualityScore: 90 },
};

export const RUNTIME_TARGET_PROFILES: Record<
  RuntimeTarget,
  { costMultiplier: number; marketabilityDelta: number }
> = {
  Short: { costMultiplier: 0.9, marketabilityDelta: -5 },
  Standard: { costMultiplier: 1.0, marketabilityDelta: 5 },
  Long: { costMultiplier: 1.15, marketabilityDelta: 0 },
};
