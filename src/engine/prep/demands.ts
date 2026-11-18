// The breakdown: what a film demands of its pre-production
// (docs/DESIGN_REVIEW_preproduction_realism.md §4.1,
// docs/IMPLEMENTATION_PLAN_preproduction_realism.md Phase 2).
//
// A real prep is several parallel chains - design and build, costume, locations,
// casting, action, effects - each owned by a department, plus the core every
// film has: breakdown, schedule, budget, the production meeting
// (docs/domain/04-preproduction.md §1.3). How much of each a film needs follows
// from its MOVING PARTS, not its budget: "a $40M two-hander in one house needs
// less prep than a $6M period film with forty speaking parts" (04 §16).
//
// Pure and derived (SIMULATION_PHILOSOPHY Principle 8): nothing here is stored.
// It reads only data the game already has - the requirement profile, the
// setting archetype, the cast and the plan.
import type { Distribution, EnvironmentMethodKey, Person, ProductionChoices, Script, TalentAssignment } from '../../types';
import { computeVfxAmbition } from '../vfxFacet';
import { computePracticalAmbition } from '../practicalFacet';
import { deriveTraits } from '../personTraits';
import { SETTING_ARCHETYPE_PROFILES } from '../../data/settings';
import { deriveRequirementProfile, type RequirementLeafKey } from '../requirementProfile';
import { computeSetsAmbition, defaultDesignPrepDays, NO_DESIGNER_SKILL } from '../setsFacet';
import { computeCreativeTension } from '../creativeTension';
import { clamp } from '../random';
import { getCrewCareer } from '../person';
import { PREP_FRONT_CHAIN, PREP_CORE_DAYS, PREP_FRONT_LIVE_THRESHOLD, PREP_FRONTS, PREP_SCALE_FACTOR, type PrepFront } from '../../data/prep';

export type { PrepFront } from '../../data/prep';

export interface FrontDemand {
  front: PrepFront;
  /** 0..1 - how much this film asks of the front. */
  demand: number;
  /** Player-facing, qualitative: what makes the front heavy. Never a number. */
  reasons: string[];
}

export interface PrepDemandInput {
  script: Script;
  talent: TalentAssignment[];
  choices: ProductionChoices;
  /** The plan's environment strategy (FilmDraft.environmentStrategy); absent/null = the screenplay's own lean. */
  environmentStrategy?: Distribution<EnvironmentMethodKey> | null;
}

/** A leaf's weight in a front: how much of the film it is, raised by how hard it is to do. */
function leafLoad(present: Map<RequirementLeafKey, { magnitude: number; complexity: number }>, key: RequirementLeafKey): number {
  const leaf = present.get(key);
  return leaf ? clamp(leaf.magnitude * (0.55 + 0.45 * leaf.complexity), 0, 1) : 0;
}

/**
 * A front is paced by its biggest demand, with the next ones adding a little:
 * one hero build sets the design chain; a second adds some load, a fifth not
 * much more. (Summing them, or treating them as independent odds, saturated
 * every film with several moderate demands - a dinner-party drama read as an
 * action film.)
 */
function combine(loads: number[]): number {
  const sorted = loads.map((l) => clamp(l, 0, 1)).sort((a, b) => b - a);
  const [first = 0, second = 0, ...rest] = sorted;
  return clamp(first + 0.3 * second + 0.1 * rest.reduce((a, b) => a + b, 0), 0, 1);
}

function findPerson(talent: TalentAssignment[], role: TalentAssignment['role']): Person | undefined {
  return talent.find((a) => a.role === role)?.person;
}

/**
 * How decisively a director commits, 0..1 - derived, not stored. The reference's
 * costliest director habit is "staying open": every department's lead time waits
 * on a decision, and an undecided director's departments "default to the most
 * expensive interpretation" (04 §13.4). Read from professionalism and handling of
 * pressure, a director who keeps adapting (and so keeps options open), and
 * experience in the chair. (The plan named productionStyle too; that field holds
 * only environment and effects methods, nothing about deciding.)
 */
export function directorDecisiveness(director: Person | undefined): number {
  if (!director) return 0.5;
  const career = director.careers.director;
  const experience = clamp((career?.experience ?? 0) / 100, 0, 1);
  const p = director.personality;
  return clamp(0.35 * (p.professionalism / 100) + 0.25 * (p.pressureHandling / 100) + 0.2 * (1 - p.adaptability / 100) + 0.2 * experience, 0, 1);
}

/** Every front's demand for this film, in PREP_FRONTS order. */
export function derivePrepDemands({ script, talent, choices, environmentStrategy }: PrepDemandInput): FrontDemand[] {
  const setting = SETTING_ARCHETYPE_PROFILES[script.primarySetting];
  const profile = deriveRequirementProfile(script);
  const present = new Map(profile.map((leaf) => [leaf.key, leaf]));
  const load = (key: RequirementLeafKey) => leafLoad(present, key);
  const speaking = script.cast.length;
  const leads = script.cast.filter((c) => c.prominence === 'Lead').length;
  const leadPhysical = Math.max(0, ...script.cast.filter((c) => c.prominence === 'Lead').map((c) => c.traits.physicalDemand)) / 100;
  const scriptSoundness = (script.structure + script.characters) / 200;
  const strategy = environmentStrategy ?? script.environmentStrategy;

  const fronts: Record<PrepFront, { demand: number; reasons: string[] }> = {
    breakdown: { demand: 0, reasons: [] },
    design: { demand: 0, reasons: [] },
    costume: { demand: 0, reasons: [] },
    locations: { demand: 0, reasons: [] },
    casting: { demand: 0, reasons: [] },
    action: { demand: 0, reasons: [] },
    effects: { demand: 0, reasons: [] },
    visual: { demand: 0, reasons: [] },
  };

  // Breakdown, schedule and budget - every film has it. It grows with the
  // number of physical things the script implies (04 §2.6) and with a script
  // that is not really finished (03 §13: "script not locked" is the root cause
  // of most overruns).
  const impliedElements = combine([load('extras'), load('crowdWork'), load('animals'), load('vehicleAction') * 0.6, script.productionRequirements.vehicles ? 0.25 : 0]);
  const physicalBreadth = clamp(profile.length / 10, 0, 1);
  fronts.breakdown.demand = clamp(0.2 + 0.35 * impliedElements + 0.2 * physicalBreadth + 0.35 * (1 - scriptSoundness), 0, 1);
  if (impliedElements > 0.4) fronts.breakdown.reasons.push('The script takes a lot for granted - crowds, vehicles, animals - that someone has to find and cost.');
  if (scriptSoundness < 0.55) fronts.breakdown.reasons.push("The script isn't really finished; expect pages to keep changing under everyone.");

  // Design and build - the longest serial chain on a heavy film (04 §1.3, §6).
  const studioLean = strategy.studio ?? 0;
  fronts.design.demand = combine([load('studioBuild'), load('periodArchitecture'), (computeSetsAmbition(script) / 100) * 0.6, setting.setConstructionDemand * studioLean * 0.5]);
  if (load('periodArchitecture') > 0.3) fronts.design.reasons.push('Period builds with long lead times.');
  else if (fronts.design.demand > 0.45) fronts.design.reasons.push('Sets that have to be designed and built before anyone can shoot on them.');

  // Costume, hair and makeup - blocked on casting; prosthetics and period are
  // the long chains (04 §7.2). Prosthetic lead time is read only where the film
  // really has makeup effects - a creature or a horror film. The profile's
  // prostheticsMakeup leaf is driven by characters' transformationDemand, which
  // is an ACTING trait (an arc to play); read alone it put prosthetics on 86% of
  // generated films (docs/DESIGN_REVIEW_preproduction_realism.md, As built).
  const makeupFx = script.genre === 'Horror' || script.cast.some((c) => c.archetype === 'MonsterOrCreature');
  fronts.costume.demand = combine([load('periodCostume'), makeupFx ? load('prostheticsMakeup') : 0, load('creatureEmbodiment') * 0.8, clamp((speaking - 4) / 30, 0, 0.4)]);
  if (load('prostheticsMakeup') > 0.3 || load('creatureEmbodiment') > 0.3) fronts.costume.reasons.push('Prosthetics or creature work that takes months to make.');
  else if (load('periodCostume') > 0.3) fronts.costume.reasons.push('A period wardrobe, much of it made rather than bought.');

  // Locations - securing and logistics (04 §5, §14).
  const locationLean = strategy.location ?? 0;
  fronts.locations.demand = combine([load('locationWork'), setting.locationComplexity * 0.7, setting.travelDemand * 0.5, setting.practicalLogisticsDemand * 0.4 * (0.5 + locationLean)]);
  if (setting.travelDemand > 0.5) fronts.locations.reasons.push('Many places, far apart, each with its own permits and logistics.');
  else if (fronts.locations.demand > 0.45) fronts.locations.reasons.push('Locations that have to be found, secured and permitted.');

  // Casting - the speaking parts below the leads, and the pairings that only a
  // read can test (04 §8).
  const difficultLead = talent.some((a) => a.role === 'Lead Actor' && deriveTraits(a.person).includes('DifficultToWorkWith'));
  fronts.casting.demand = combine([clamp((speaking - 3) / 20, 0, 0.6), leads >= 2 ? 0.25 : 0, script.genre === 'Romance' ? 0.25 : 0, difficultLead ? 0.3 : 0]);
  if (difficultLead) fronts.casting.reasons.push('A lead known to be hard to work with.');
  if (speaking > 12) fronts.casting.reasons.push('A large speaking cast to find and fit.');
  if (leads >= 2 || script.genre === 'Romance') fronts.casting.reasons.push('The film lives on a central pairing that has to work together.');

  // Action - designed, rehearsed and rigged in prep, never on the day (04 §10.5).
  fronts.action.demand = combine([load('combatStunts'), load('vehicleAction'), load('practicalDestruction'), load('danceChoreography') * 0.7, leadPhysical * 0.3, (computePracticalAmbition(script.genre, script) / 100) * 0.4]);
  if (fronts.action.demand > 0.4) fronts.action.reasons.push('Action that has to be designed, rehearsed and made safe before the shoot.');

  // Effects - methodology and previs; on an effects-led film the design IS the
  // VFX design (04 §1.1, §10.4).
  fronts.effects.demand = combine([load('digitalEnvironments'), load('creatureAnimation'), load('compositingVfx'), load('digitalDoubles') * 0.8, (computeVfxAmbition(script.genre, script) / 100) * 0.4]);
  if (fronts.effects.demand > 0.4) fronts.effects.reasons.push('Effects work whose method has to be settled shot by shot.');

  // The visual plan - director, DP and designer seeing the same film (04 §13.1,
  // §9.7), and a director who decides early enough for others to act.
  const tension = computeCreativeTension(talent) / 100;
  const decisiveness = directorDecisiveness(findPerson(talent, 'Director'));
  fronts.visual.demand = clamp(0.15 + 0.5 * tension + 0.35 * (1 - decisiveness), 0, 1);
  if (tension > 0.4) fronts.visual.reasons.push('Key creatives who do not see the same film.');
  if (decisiveness < 0.4) fronts.visual.reasons.push('A director who keeps options open, so departments wait on decisions.');

  // The plan's money is deliberately not read: the game has no norm for what a
  // film's work "should" cost to compare a budget against, so a budget gap is
  // a problem the breakdown finds (data/prep.ts:PREP_PROBLEMS['budget-gap']),
  // not a demand. `choices` stays in the input for the design window.
  void choices;
  return PREP_FRONTS.map((front) => ({ front, demand: fronts[front].demand, reasons: fronts[front].reasons }));
}

/** Days a front's chain needs at this demand (data/prep.ts:PREP_FRONT_CHAIN). 0 for a front that is not live. */
export function frontChainDays(front: PrepFront, demand: number): number {
  if (demand < PREP_FRONT_LIVE_THRESHOLD) return 0;
  const chain = PREP_FRONT_CHAIN[front];
  // Lead times are not linear in demand: a few bespoke costumes or a modest
  // build fit inside an ordinary prep; only heavy specialist work - prosthetic
  // characters, creature suits, hero sets - runs to months (04 §1.3).
  return chain.minDays + chain.spanDays * demand * demand;
}

/**
 * Recommended prep: the core every film needs, plus the longest live chain
 * (prep runs as long as its slowest department - 04 §1.3). The design chain is
 * the production designer's own ask, or the design window the player granted
 * (ProductionChoices.designPrepDays), which may be shorter than the chain: a
 * rushed design is a real choice whose cost lands on the sets.
 */
export function recommendedPrepDays(demands: FrontDemand[], designAskDays: number, grantedDesignDays?: number, scale: Script['scale'] = 'Medium'): number {
  const factor = PREP_SCALE_FACTOR[scale];
  const chains = demands.map((d) => {
    if (d.front !== 'design') return frontChainDays(d.front, d.demand) * factor;
    const chain = frontChainDays('design', d.demand) * factor;
    // The design window the player granted is read as a share of the
    // designer's own ask (the Sets facet's units - its timeRatio), applied to
    // the design chain: granting the ask leaves the chain as it is, half the ask
    // halves it - and the Sets facet pays for the rush.
    if (grantedDesignDays !== undefined && designAskDays > 0) return chain * clamp(grantedDesignDays / designAskDays, 0.25, 3);
    return chain;
  });
  return Math.round(PREP_CORE_DAYS * factor + Math.max(0, ...chains));
}

/** The production designer's own ask for the design window (the Sets facet's needed days). */
export function designAskDays(script: Script, talent: TalentAssignment[]): number {
  const designer = findPerson(talent, 'Production Designer');
  const skill = designer ? getCrewCareer(designer, 'Production Designer')?.skill : undefined;
  return defaultDesignPrepDays(computeSetsAmbition(script), skill ?? NO_DESIGNER_SKILL);
}

/** Player-facing outlook: one line per live front, heaviest first. Qualitative only. */
export function prepOutlook(demands: FrontDemand[]): Array<{ front: PrepFront; weight: 'light' | 'moderate' | 'heavy'; line: string }> {
  return demands
    .filter((d) => d.demand >= PREP_FRONT_LIVE_THRESHOLD)
    .sort((a, b) => b.demand - a.demand)
    .map((d) => {
      const weight = d.demand >= 0.6 ? 'heavy' : d.demand >= 0.35 ? 'moderate' : 'light';
      return { front: d.front, weight, line: d.reasons[0] ?? FRONT_DEFAULT_LINE[d.front] };
    });
}

const FRONT_DEFAULT_LINE: Record<PrepFront, string> = {
  breakdown: 'The usual work of breaking down, scheduling and budgeting the script.',
  design: 'Some building and dressing to do.',
  costume: 'A wardrobe to assemble and fit.',
  locations: 'A few places to find and secure.',
  casting: 'Supporting parts to cast.',
  action: 'Some physical work to plan.',
  effects: 'Some effects to plan.',
  visual: 'The look of the film to agree.',
};
