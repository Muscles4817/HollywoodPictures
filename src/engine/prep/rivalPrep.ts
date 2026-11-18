// Rivals prep on the same model (docs/IMPLEMENTATION_PLAN_preproduction_realism.md
// Phase 6; design §5): a contingency reserve, a production team from the same
// roster, prep time in their calendar and its cost, the same engine run
// headless - and a memory of their own recent shoots that moves how long they
// prep and how much contingency they carry.
//
// The memory is derived, not stored (SIMULATION_PHILOSOPHY Principle 8): it is
// read from the rival's own released films' recorded events, the carried-prep
// incidents among them. So it can never drift from what actually happened, and
// it needs no bookkeeping on the RivalStudio (the plan said "stored"; deriving
// it keeps one source of truth).
import type { Film, ProductionTeam, StudioTier } from '../../types';
import { PREP_PROBLEMS, RIVAL_CONTINGENCY_SHARE, RIVAL_PREP_MEMORY, RIVAL_TEAM_FEE_SHARE, type PrepFront, type PrepProblemKind } from '../../data/prep';
import { computeDailyShootBurn } from '../cost';
import { computeRecommendedShootDays } from '../production';
import { clamp } from '../random';

export interface RivalPrepPolicy {
  /** Prep length as a share of the recommendation. */
  lengthFactor: number;
  /** Contingency as a share of the shooting budget. */
  contingencyShare: number;
}

const kindOfIncident = (id: string): PrepProblemKind | null => {
  if (!id.startsWith('prep-incident-')) return null;
  const kind = id.slice('prep-incident-'.length).replace(/-\d+$/, '') as PrepProblemKind;
  return kind in PREP_PROBLEMS ? kind : null;
};

/** What carried prep problems cost one finished film: shoot days lost and money over, as shares of its shoot. */
export function filmPrepLosses(film: Film): { lostShare: number; overShare: number; byFront: Partial<Record<PrepFront, number>> } {
  const shootDays = Math.max(1, computeRecommendedShootDays(film.talent, film.script, film.productionChoices));
  const budget = Math.max(1, film.productionChoices.shootingBudgetAmount);
  let lost = 0;
  let over = 0;
  const byFront: Partial<Record<PrepFront, number>> = {};
  for (const e of film.events) {
    const kind = kindOfIncident(e.id);
    if (!kind) continue;
    lost += e.delayDaysDelta;
    over += e.costDelta;
    const front = PREP_PROBLEMS[kind].front;
    byFront[front] = (byFront[front] ?? 0) + e.delayDaysDelta + e.costDelta / Math.max(1, computeDailyShootBurn(budget, shootDays));
  }
  return { lostShare: lost / shootDays, overShare: over / budget, byFront };
}

/** How this rival preps its next film, from what its last few films lost to carried prep problems. */
export function rivalPrepPolicy(rivalName: string, tier: StudioTier, films: Film[]): RivalPrepPolicy {
  const base = RIVAL_CONTINGENCY_SHARE[tier];
  const own = films
    .filter((f) => f.releasedBy === rivalName)
    .sort((a, b) => b.releasedOnDay - a.releasedOnDay)
    .slice(0, RIVAL_PREP_MEMORY.films);
  if (own.length === 0) return { lengthFactor: 1, contingencyShare: base };
  const losses = own.map(filmPrepLosses);
  const meanLost = losses.reduce((s, l) => s + l.lostShare, 0) / losses.length;
  const meanOver = losses.reduce((s, l) => s + l.overShare, 0) / losses.length;
  return {
    lengthFactor: clamp(1 + RIVAL_PREP_MEMORY.lengthPerLost * (meanLost - RIVAL_PREP_MEMORY.normalLost), ...RIVAL_PREP_MEMORY.lengthRange),
    contingencyShare: base + clamp(RIVAL_PREP_MEMORY.contingencyPerOver * (meanOver - RIVAL_PREP_MEMORY.normalOver), ...RIVAL_PREP_MEMORY.contingencyRange),
  };
}

/** The best team a rival will pay for: the most skilled whose fee fits its share of the negative. None if nothing fits. */
export function chooseRivalProductionTeam(pool: ProductionTeam[] | undefined, negative: number): ProductionTeam | null {
  const cap = negative * RIVAL_TEAM_FEE_SHARE;
  const affordable = (pool ?? []).filter((t) => t.typicalSalary <= cap);
  if (affordable.length === 0) return null;
  return [...affordable].sort((a, b) => b.skill - a.skill || a.typicalSalary - b.typicalSalary || a.id.localeCompare(b.id))[0];
}
