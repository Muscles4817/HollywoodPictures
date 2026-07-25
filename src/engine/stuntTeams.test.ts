// Stunt Team entity (docs/DESIGN_REVIEW_production_redesign.md §5.2) — the head of
// the Practical Effects facet. Generation must be deterministic and the effective
// skill must reward hiring a team whose specialty fits the film.
import { describe, it, expect } from 'vitest';
import { withRng } from './random';
import {
  generateStuntTeamPool,
  stuntTeamById,
  stuntTeamEffectiveSkill,
  stuntTeamFee,
  stuntTeamFitsGenre,
} from './stuntTeams';
import { STUNT_TEAM_POOL_SIZE, STUNT_SPECIALTY_MATCH_BONUS } from '../data/stuntTeams';
import type { StuntTeam } from '../types';

const pool = (seed = 7) => withRng(seed, (rng) => generateStuntTeamPool(rng)).result;

describe('generateStuntTeamPool', () => {
  it('is deterministic and well-formed', () => {
    // ids come from a global counter (like the producer roster), so they differ
    // across generations; determinism lives in the rolled data, not the ids.
    const strip = (teams: StuntTeam[]) => teams.map(({ id: _id, ...rest }) => rest);
    expect(strip(pool(3))).toEqual(strip(pool(3)));
    const a = pool(3);
    expect(a).toHaveLength(STUNT_TEAM_POOL_SIZE);
    for (const team of a) {
      expect(team.specialties.length).toBeGreaterThanOrEqual(1);
      expect(team.specialties.length).toBeLessThanOrEqual(2);
      expect(new Set(team.specialties).size).toBe(team.specialties.length); // distinct
      expect(team.skill).toBeGreaterThanOrEqual(1);
      expect(team.skill).toBeLessThanOrEqual(100);
      expect(team.typicalSalary).toBeGreaterThan(0);
    }
  });

  it('spans a real skill/pay spread (a cheap scrappy unit up to a marquee house)', () => {
    const teams = pool(5);
    const skills = teams.map((t) => t.skill);
    expect(Math.max(...skills) - Math.min(...skills)).toBeGreaterThan(30);
  });
});

const team = (over: Partial<StuntTeam> = {}): StuntTeam => ({
  id: 'stunt-test', name: 'Test Unit', skill: 60, specialties: ['Vehicular'], typicalSalary: 500_000, ...over,
});

describe('stuntTeamEffectiveSkill — specialty fit pays off', () => {
  it('a team whose specialty fits the genre beats the same team on a genre it does not', () => {
    const vehicular = team({ specialties: ['Vehicular'] });
    // Action favours Vehicular; Drama favours nothing.
    const onFit = stuntTeamEffectiveSkill(vehicular, 'Action');
    const offFit = stuntTeamEffectiveSkill(vehicular, 'Drama');
    expect(stuntTeamFitsGenre(vehicular, 'Action')).toBe(true);
    expect(stuntTeamFitsGenre(vehicular, 'Drama')).toBe(false);
    expect(onFit).toBe(offFit + STUNT_SPECIALTY_MATCH_BONUS);
    expect(offFit).toBe(vehicular.skill);
  });

  it('clamps at 100 for an elite, well-fitted team', () => {
    expect(stuntTeamEffectiveSkill(team({ skill: 95, specialties: ['Creature'] }), 'Horror')).toBe(100);
  });
});

describe('helpers', () => {
  it('stuntTeamFee is the per-film salary, 0 for no team', () => {
    expect(stuntTeamFee(team({ typicalSalary: 750_000 }))).toBe(750_000);
    expect(stuntTeamFee(undefined)).toBe(0);
  });

  it('stuntTeamById resolves from the pool and is safe on null', () => {
    const teams = pool(9);
    expect(stuntTeamById(teams, teams[2].id)).toBe(teams[2]);
    expect(stuntTeamById(teams, null)).toBeUndefined();
    expect(stuntTeamById(undefined, 'stunt-1')).toBeUndefined();
  });
});
