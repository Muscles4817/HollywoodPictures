// Stunt Team entity (docs/DESIGN_REVIEW_production_redesign.md §5.2) — the head of
// the Practical Effects facet. Generation of the world roster + the pure reads
// scoring/UI need: the team by id, its effective skill on a given film, and its
// per-film fee. A Stunt Team is a contracted team/vendor, NOT a Person — the
// first non-Person entity attached to a draft (mirrors the producer roster
// lifecycle, minus the Person coupling and the separate release-effects: a
// team's whole effect IS being the Practical facet's skill axis + swing tilt).
import type { Genre, StuntTeam } from '../types';
import {
  GENRE_FAVORED_STUNT_SPECIALTIES,
  STUNT_SPECIALTIES,
  STUNT_SPECIALTY_MATCH_BONUS,
  STUNT_TEAM_NAME_PREFIXES,
  STUNT_TEAM_NAME_SUFFIXES,
  STUNT_TEAM_POOL_SIZE,
  STUNT_TEAM_SALARY_RANGE,
} from '../data/stuntTeams';
import { logAmount } from './interpolate';
import { clamp, pick, pickMany, randFloat, randInt, type RandomFn } from './random';

let nextStuntTeamId = 1;

function generateStuntTeam(rng: RandomFn, t: number): StuntTeam {
  // t is the 0-1 position along the pay/skill spread (stratified) — a cheap
  // scrappy unit at 0, a marquee coordination house near 1.
  const salary = Math.round(logAmount(t, STUNT_TEAM_SALARY_RANGE) / 1000) * 1000;
  const skill = clamp(Math.round(30 + 55 * t + randFloat(rng, -12, 12)), 1, 100);
  const name = `${pick(rng, STUNT_TEAM_NAME_PREFIXES)} ${pick(rng, STUNT_TEAM_NAME_SUFFIXES)}`;
  const specialties = pickMany(rng, STUNT_SPECIALTIES, randInt(rng, 1, 2));
  return { id: `stunt-${nextStuntTeamId++}`, name, skill, specialties, typicalSalary: salary };
}

/** The hireable Stunt Team roster, generated once at game start. */
export function generateStuntTeamPool(rng: RandomFn, count = STUNT_TEAM_POOL_SIZE): StuntTeam[] {
  return Array.from({ length: count }, (_, i) => generateStuntTeam(rng, randFloat(rng, i / count, (i + 1) / count)));
}

export function stuntTeamById(pool: StuntTeam[] | undefined, id: string | null | undefined): StuntTeam | undefined {
  if (!pool || !id) return undefined;
  return pool.find((team) => team.id === id);
}

/** Whether any of the team's specialties fits what this genre's practical work leans on. */
export function stuntTeamFitsGenre(team: StuntTeam, genre: Genre): boolean {
  const favored = GENRE_FAVORED_STUNT_SPECIALTIES[genre] ?? [];
  return team.specialties.some((s) => favored.includes(s));
}

/**
 * The team's EFFECTIVE skill on a given film: its base skill plus a bump when one
 * of its specialties fits the genre. This is the Practical facet's skill axis and
 * its execution-swing tilt (engine/practicalFacet.ts) — so hiring the right team
 * for the kind of stunts a film needs genuinely pays off.
 */
export function stuntTeamEffectiveSkill(team: StuntTeam, genre: Genre): number {
  return clamp(team.skill + (stuntTeamFitsGenre(team, genre) ? STUNT_SPECIALTY_MATCH_BONUS : 0), 0, 100);
}

/** The per-film fee for attaching this team (0 if none). */
export function stuntTeamFee(team: StuntTeam | undefined): number {
  return team?.typicalSalary ?? 0;
}
