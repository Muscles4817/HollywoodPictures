// Who works each prep front, and the film's own money units - the context every
// prep read takes (docs/IMPLEMENTATION_PLAN_preproduction_realism.md Phase 4).
//
// Front owners (design §4.8): the production team for the breakdown and the
// locations; the production designer for design; director and designer for
// costume (no costume designer is modelled); the casting director for casting;
// the stunt team for action; the VFX supervisor for effects; director,
// cinematographer and designer together for the visual plan. A director who has
// worked with a front's owner before finds that front's problems more easily -
// they know how each other work (familiarity, from the pairing history).
import type { Person, ProductionRole, ProductionTeam, StuntTeam, TalentAssignment, TalentPairing, Genre } from '../../types';
import { PREP_FIND_SHARE, PREP_FRONTS, type PrepFront } from '../../data/prep';
import { filterAssignedPeople } from '../../data/helpers';
import { getCareerForRole } from '../person';
import { productionTeamFrontSkill, productionTeamReliability } from '../productionTeams';
import { stuntTeamEffectiveSkill } from '../stuntTeams';
import { NO_STUNT_TEAM_SKILL } from '../practicalFacet';
import { clamp } from '../random';

/** An absent department head's stand-in: the studio's general staff doing the job. */
const NO_HEAD_SKILL = 40;

export interface PrepContext {
  /** 0..100: how well each front's owner finds and handles its problems. */
  ownerSkill: Record<PrepFront, number>;
  /** 0..100: the production team's reliability (the studio office's with none). */
  reliability: number;
  /** The film's shooting day, in money - "a lost day" (04 §1.4). */
  dailyShootBurn: number;
  /** The film's prep day, in money. */
  dailyPrepBurn: number;
  /** Recommended shooting days. */
  shootDays: number;
  /** Contingency still in reserve, for a fix drawn from it. */
  contingencyAvailable: number;
  /** 0..1: how tight the decider's money is (weighs cash against time and risk). */
  cashPressure: number;
  /** A release date already fixed makes prep time dearer. */
  datedRelease: boolean;
}

export interface PrepContextInput {
  talent: TalentAssignment[];
  genre: Genre | null;
  team: ProductionTeam | null | undefined;
  stuntTeam?: StuntTeam | null;
  pairings?: TalentPairing[];
  dailyShootBurn: number;
  dailyPrepBurn: number;
  shootDays: number;
  contingencyAvailable: number;
  cashPressure?: number;
  datedRelease?: boolean;
}

function skillOf(person: Person | undefined, role: ProductionRole): number | null {
  if (!person) return null;
  const career = getCareerForRole(person, role);
  return career && 'skill' in career ? career.skill : 50;
}

const mean = (xs: Array<number | null>, fallback = NO_HEAD_SKILL) => {
  const present = xs.map((x) => x ?? fallback);
  return present.reduce((s, x) => s + x, 0) / present.length;
};

function workedTogether(pairings: TalentPairing[] | undefined, a: Person | undefined, b: Person | undefined): boolean {
  if (!pairings || !a || !b || a.id === b.id) return false;
  const [lo, hi] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
  return pairings.some((p) => p.personA === lo && p.personB === hi);
}

export function buildPrepContext(input: PrepContextInput): PrepContext {
  const one = (role: ProductionRole) => filterAssignedPeople(input.talent, role)[0];
  const director = one('Director');
  const designer = one('Production Designer');
  const dp = one('Cinematographer');
  const caster = one('Casting Director');
  const vfx = one('VFX Supervisor');
  const team = input.team ?? undefined;
  const fam = (other: Person | undefined) => (workedTogether(input.pairings, director, other) ? PREP_FIND_SHARE.familiarityBonus : 0);
  const d = skillOf(director, 'Director');
  const pd = skillOf(designer, 'Production Designer');

  const ownerSkill = {} as Record<PrepFront, number>;
  for (const front of PREP_FRONTS) {
    let skill: number;
    switch (front) {
      case 'breakdown':
      case 'locations':
        skill = productionTeamFrontSkill(team, front);
        break;
      case 'design':
        skill = (pd ?? NO_HEAD_SKILL) + fam(designer);
        break;
      case 'costume':
        skill = mean([d, pd]) + fam(designer);
        break;
      case 'casting':
        skill = (skillOf(caster, 'Casting Director') ?? NO_HEAD_SKILL) + fam(caster);
        break;
      case 'action':
        skill = input.stuntTeam && input.genre ? stuntTeamEffectiveSkill(input.stuntTeam, input.genre) : NO_STUNT_TEAM_SKILL;
        break;
      case 'effects':
        skill = (skillOf(vfx, 'VFX Supervisor') ?? NO_HEAD_SKILL) + fam(vfx);
        break;
      case 'visual':
        skill = mean([d, skillOf(dp, 'Cinematographer'), pd]) + (fam(dp) + fam(designer)) / 2;
        break;
    }
    ownerSkill[front] = clamp(skill, 0, 100);
  }

  return {
    ownerSkill,
    reliability: productionTeamReliability(team),
    dailyShootBurn: Math.max(1, input.dailyShootBurn),
    dailyPrepBurn: Math.max(1, input.dailyPrepBurn),
    shootDays: Math.max(1, input.shootDays),
    contingencyAvailable: Math.max(0, input.contingencyAvailable),
    cashPressure: clamp(input.cashPressure ?? 0, 0, 1),
    datedRelease: input.datedRelease ?? false,
  };
}

// --- A player film's context -------------------------------------------------

import type { FilmDraft } from '../../types';
import { computeDailyPrepBurn, computeDailyShootBurn, draftNegativeCost } from '../cost';
import { computeRecommendedShootDays } from '../production';
import { stuntTeamById } from '../stuntTeams';
import { prepContingencyUsed } from './checkpoints';
import { NO_PRODUCTION_TEAM_SKILL } from '../../data/productionTeams';
import type { Decider } from './delegation';

export interface PrepWorld {
  stuntTeamPool?: StuntTeam[];
  talentPairings?: TalentPairing[];
  /** The studio's cash, for how hard money weighs in a delegated decision. */
  cash: number;
}

/** Everything prep needs to run a player draft's next day or checkpoint. Null when the draft has no plan to prep. */
export function prepRunFor(draft: FilmDraft, world: PrepWorld): { ctx: PrepContext; decider: Decider } | null {
  if (!draft.script || !draft.productionChoices) return null;
  const choices = draft.productionChoices;
  const shootDays = computeRecommendedShootDays(draft.talent, draft.script, choices);
  const negative = draftNegativeCost(draft);
  const dailyShootBurn = computeDailyShootBurn(choices.shootingBudgetAmount, shootDays);
  const team = draft.preProduction?.team ?? null;
  const ctx = buildPrepContext({
    talent: draft.talent,
    genre: draft.genre,
    team,
    stuntTeam: stuntTeamById(world.stuntTeamPool, draft.stuntTeamId) ?? null,
    pairings: world.talentPairings,
    dailyShootBurn,
    dailyPrepBurn: computeDailyPrepBurn(dailyShootBurn),
    shootDays,
    contingencyAvailable: (choices.contingencyReserveAmount ?? 0) - prepContingencyUsed(draft.preProduction),
    // Money weighs more the less of it the studio has against the film's size.
    cashPressure: 1 - world.cash / Math.max(1, negative),
    datedRelease: false,
  });
  return { ctx, decider: { skill: team?.skill ?? NO_PRODUCTION_TEAM_SKILL, seed: draft.preProduction?.seed ?? 0 } };
}

/** A draft's daily prep burn (before its revealing work's extra): the core prep team, priced from its own shooting day (engine/cost.ts). */
export function draftDailyPrepBurn(draft: Pick<FilmDraft, 'talent' | 'script' | 'productionChoices'>): number {
  if (!draft.script || !draft.productionChoices) return computeDailyPrepBurn(0);
  const shootDays = computeRecommendedShootDays(draft.talent, draft.script, draft.productionChoices);
  return computeDailyPrepBurn(computeDailyShootBurn(draft.productionChoices.shootingBudgetAmount, shootDays));
}
