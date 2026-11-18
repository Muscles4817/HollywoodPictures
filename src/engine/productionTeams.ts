// Production teams (docs/IMPLEMENTATION_PLAN_preproduction_realism.md Phase 3):
// the line producer & 1st AD pair who run a film's prep. Generation of the world
// roster plus the pure reads prep needs. A contracted unit, not a Person -
// mirrors engine/stuntTeams.ts, and adds nothing to talent generation.
import { nextSequence } from './identity';
import type { ProductionTeam } from '../types';
import { TALENT_FIRST_NAMES, TALENT_LAST_NAMES } from '../data/talentNames';
import {
  NO_PRODUCTION_TEAM_RELIABILITY,
  NO_PRODUCTION_TEAM_SKILL,
  PRODUCTION_TEAM_POOL_SIZE,
  PRODUCTION_TEAM_SALARY_RANGE,
  PRODUCTION_TEAM_SPECIALTIES,
  PRODUCTION_TEAM_SPECIALTY_BONUS,
  PRODUCTION_TEAM_SPECIALTY_FRONTS,
} from '../data/productionTeams';
import type { PrepFront } from '../data/prep';
import { logAmount } from './interpolate';
import { clamp, pick, pickMany, randFloat, randInt, type RandomFn } from './random';

function personName(rng: RandomFn): string {
  return `${pick(rng, TALENT_FIRST_NAMES)} ${pick(rng, TALENT_LAST_NAMES)}`;
}

function generateProductionTeam(rng: RandomFn, t: number): ProductionTeam {
  // t is the 0-1 position along the pay/skill spread (stratified): a lean
  // first-timer pair at 0, the team a studio trusts with a tentpole near 1.
  const typicalSalary = Math.round(logAmount(t, PRODUCTION_TEAM_SALARY_RANGE) / 1000) * 1000;
  const skill = clamp(Math.round(28 + 60 * t + randFloat(rng, -12, 12)), 1, 100);
  const reliability = clamp(Math.round(45 + 35 * t + randFloat(rng, -20, 20)), 1, 100);
  const specialties = pickMany(rng, PRODUCTION_TEAM_SPECIALTIES, randInt(rng, 1, 2));
  return { id: `prodteam-${nextSequence('productionTeam')}`, name: `${personName(rng)} & ${personName(rng)}`, skill, reliability, specialties, typicalSalary };
}

/** The hireable roster, generated once at game start. */
export function generateProductionTeamPool(rng: RandomFn, count = PRODUCTION_TEAM_POOL_SIZE): ProductionTeam[] {
  return Array.from({ length: count }, (_, i) => generateProductionTeam(rng, randFloat(rng, i / count, (i + 1) / count)));
}

export function productionTeamById(pool: ProductionTeam[] | undefined, id: string | null | undefined): ProductionTeam | undefined {
  if (!pool || !id) return undefined;
  return pool.find((team) => team.id === id);
}

/** The team's skill on one prep front: its base skill, raised where a specialty fits. With no team, the studio's own production office. */
export function productionTeamFrontSkill(team: ProductionTeam | undefined, front: PrepFront): number {
  if (!team) return NO_PRODUCTION_TEAM_SKILL;
  const fits = team.specialties.some((s) => PRODUCTION_TEAM_SPECIALTY_FRONTS[s].includes(front));
  return clamp(team.skill + (fits ? PRODUCTION_TEAM_SPECIALTY_BONUS : 0), 0, 100);
}

export function productionTeamReliability(team: ProductionTeam | undefined): number {
  return team?.reliability ?? NO_PRODUCTION_TEAM_RELIABILITY;
}

/** The per-film fee (0 with no team). */
export function productionTeamFee(team: ProductionTeam | undefined): number {
  return team?.typicalSalary ?? 0;
}
