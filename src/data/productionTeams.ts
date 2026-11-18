// Production team roster tuning (docs/IMPLEMENTATION_PLAN_preproduction_realism.md
// Phase 3): the line producer & 1st AD pairs who run a film's prep. Fees follow
// docs/domain/04-preproduction.md §9.3's weekly ranges over a prep and a shoot -
// from a lean indie pair to the team a studio trusts with a tentpole.
import type { ProductionTeamSpecialty } from '../types';
import type { PrepFront } from './prep';
import type { Range } from '../engine/interpolate';

export const PRODUCTION_TEAM_POOL_SIZE = 20;

/** Per-film fee spread (log-scaled). */
export const PRODUCTION_TEAM_SALARY_RANGE: Range = { min: 40_000, max: 1_500_000 };

/** The studio's own production office, when no team is hired: competent, ordinary, no specialty. */
export const NO_PRODUCTION_TEAM_SKILL = 40;
export const NO_PRODUCTION_TEAM_RELIABILITY = 55;

export const PRODUCTION_TEAM_SPECIALTIES: readonly ProductionTeamSpecialty[] = ['Locations', 'PeriodAndBuild', 'Action', 'Effects', 'Ensemble'];

export const PRODUCTION_TEAM_SPECIALTY_LABEL: Record<ProductionTeamSpecialty, string> = {
  Locations: 'Locations & logistics',
  PeriodAndBuild: 'Period & big builds',
  Action: 'Action & stunt shows',
  Effects: 'Effects-led films',
  Ensemble: 'Big ensembles',
};

/** Which prep fronts each specialty knows its way around (they are worked as if the team were this much better). */
export const PRODUCTION_TEAM_SPECIALTY_FRONTS: Record<ProductionTeamSpecialty, PrepFront[]> = {
  Locations: ['locations'],
  PeriodAndBuild: ['design', 'costume'],
  Action: ['action'],
  Effects: ['effects'],
  Ensemble: ['casting'],
};
export const PRODUCTION_TEAM_SPECIALTY_BONUS = 12;
