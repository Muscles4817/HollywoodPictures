import type { GameState } from './gameState';
import { createInitialStudio } from './gameState';
import { studioReducer } from './studioReducer';
import { createRng, forkSeed } from '../engine/random';
import { withReplayableIds } from '../engine/identity';
import { generateProducerPool, generateTalentPool } from '../engine/talentGenerator';
import { generateRivalStudios } from '../engine/rivalStudios';
import { generateStuntTeamPool } from '../engine/stuntTeams';
import { firstDayOfYear } from '../engine/calendar';
import { asPlayerDraft, findProject, playerReleasedFilms, projectId, scheduledPlayerReleases } from '../engine/project';
import { availableCandidatesForRole, getCareerForRole, getDirectorCareer, getTypicalSalaryForRole } from '../engine/person';
import { personMeetsCharacterAge, personMeetsCharacterGender } from '../engine/casting';
import { characterForRoleSlot, effectiveRoleCapacity } from '../engine/castRequirements';
import { computeActorCharacterCompatibility, computeTalentCompatibility } from '../engine/compatibility';
import {
  recommendEffectsAmbition,
  recommendEffectsStrategy,
  recommendEnvironmentAmbition,
  recommendEnvironmentStrategy,
} from '../engine/recommendation';
import { footageLowerBound } from '../engine/production';
import { computeDailyPrepBurn } from '../engine/cost';
import { deriveProjectReadiness } from '../engine/projectReadiness';
import { MANDATORY_TALENT_ROLES } from '../data/talentGeneration';
import { professionForProductionRole } from '../data/helpers';
import { SHOOTING_BUDGET_RANGE } from '../data/production';
import { GENERATED_TALENT_DB } from '../data/talentDatabases';
import { CAMPAIGN_FULL_ROLLOUT_WEEKS } from '../data/marketing';
import type { DifficultyTier } from '../data/difficulty';
import type { Film, FilmDraft, Opportunity, Person, ProductionRole, ReleaseType, Script } from '../types';

/**
 * A scripted player, for measuring the player's economy.
 *
 * Every calibration gate before this one measured rival films
 * (engine/diagnosticPlans.ts). Nothing measured what happens to a *player*
 * studio over a career: does a competent player snowball, does a careless one
 * go broke, how long before either, and what does "broke" even look like in a
 * game with no fail state. This drives a studio through the real reducer - the
 * same actions a player's clicks dispatch, so every cost is charged and every
 * rule applies - under a fixed strategy, and records what happened.
 *
 * The bot is deliberately a plain, honest player, not an optimiser:
 *  - it buys an uncontested screenplay from the Opportunity Market (it never
 *    bids, commissions, rewrites or makes sequels, and never touches the free
 *    founding test scripts);
 *  - it hires every mandatory role at each person's quoted fee (no negotiation,
 *    no backend deals, no optional crew, no producers, no stunt team);
 *  - it takes the engine's own recommended production plan for the director;
 *  - it answers every on-set, prep and test-screening decision with the first
 *    option offered;
 *  - it releases a full campaign runway after the final cut, and never runs an
 *    awards campaign or a press tour.
 * So its results are a floor for a player using the same strategy with more
 * care - which is what makes it useful for sizing stakes: a line the bot stays
 * above is one a real player will too.
 *
 * Pure: plain data in, plain data out, deterministic for a given seed.
 */

export interface BotStrategy {
  name: string;
  /** What this strategy is meant to stand for, in a line. */
  description: string;
  /** Share of cash on hand a single film may commit, all-in (script, cast, shoot, reserve, marketing). */
  filmBudgetShare: number;
  /** Films allowed in flight (development through scheduled) at once. */
  maxConcurrent: number;
  /** Share of a film's negative cost that goes to cast and crew. */
  talentShare: number;
  /** Marketing spend as a multiple of negative cost. */
  marketingRatio: number;
  /** How the screenplay is chosen among the affordable ones. */
  scriptBy: 'quality' | 'cheapest';
  /** How a role is filled among the affordable candidates. */
  castBy: 'fit' | 'fame' | 'cheapest';
  /** 'auto' goes Wide once the film's negative cost passes `wideAbove`. */
  release: ReleaseType | 'auto';
  wideAbove: number;
  /** Buy a facility upgrade when it costs no more than this share of cash; null never upgrades. */
  upgradeShare: number | null;
  /**
   * Whether the strategy sets pre-production overhead aside before budgeting a
   * film. A player who does not will greenlight films the studio cannot carry
   * through prep - which is how cash ends up below zero.
   */
  budgetsForOverhead: boolean;
}

export const BOT_STRATEGIES: BotStrategy[] = [
  {
    name: 'Careful',
    description: 'One modest film at a time, cast for fit, most of the money kept back.',
    filmBudgetShare: 0.3,
    maxConcurrent: 1,
    talentShare: 0.4,
    marketingRatio: 0.5,
    scriptBy: 'quality',
    castBy: 'fit',
    release: 'auto',
    wideAbove: 15_000_000,
    upgradeShare: 0.1,
    budgetsForOverhead: true,
  },
  {
    name: 'Steady',
    description: 'Two films in flight, half the cash at work, cast for fit.',
    filmBudgetShare: 0.3,
    maxConcurrent: 2,
    talentShare: 0.4,
    marketingRatio: 0.6,
    scriptBy: 'quality',
    castBy: 'fit',
    release: 'auto',
    wideAbove: 15_000_000,
    upgradeShare: 0.15,
    budgetsForOverhead: true,
  },
  {
    name: 'Swing big',
    description: 'Most of the cash on one film, famous names, always wide, heavy marketing.',
    filmBudgetShare: 0.8,
    maxConcurrent: 1,
    talentShare: 0.55,
    marketingRatio: 1,
    scriptBy: 'quality',
    castBy: 'fame',
    release: 'Wide',
    wideAbove: 0,
    upgradeShare: 0.1,
    budgetsForOverhead: true,
  },
  {
    name: 'Careless',
    description: 'Cheapest script, cheapest people, token marketing, no allowance for overhead - no judgement at all.',
    filmBudgetShare: 0.4,
    maxConcurrent: 1,
    talentShare: 0.3,
    marketingRatio: 0.15,
    scriptBy: 'cheapest',
    castBy: 'cheapest',
    release: 'auto',
    wideAbove: 15_000_000,
    upgradeShare: null,
    budgetsForOverhead: false,
  },
];

/** Below this negative cost a film cannot be mounted at all: the smallest shoot plus anyone to make it. */
const MIN_FILM_BUDGET = 250_000;
/** A draft that has not moved for this long is stuck; the bot records it and abandons it. */
const STUCK_AFTER_DAYS = 240;
/** Idle and unable to afford a film for this long, with nothing in flight: the studio has stalled. */
const STALLED_AFTER_DAYS = 365;
const RELEASE_RUNWAY_DAYS = CAMPAIGN_FULL_ROLLOUT_WEEKS * 7;

export interface BotYear {
  year: number;
  cashEnd: number;
  cashMin: number;
  brand: number;
  prestige: number;
  filmsReleased: number;
}

export interface BotFilm {
  title: string;
  releasedOnDay: number;
  totalCost: number;
  boxOffice: number | null;
  profit: number | null;
  outcome: string | null;
  quality: number;
  critic: number;
  releaseType: ReleaseType;
}

export interface BotRun {
  strategy: string;
  tier: string;
  seed: number;
  years: BotYear[];
  films: BotFilm[];
  /** The day the studio stalled (idle, broke, nothing in flight for a year), or null if it never did. */
  stalledOnDay: number | null;
  /** Days spent with no film in flight and too little cash to start one. */
  idleBrokeDays: number;
  /**
   * Days a finished, screened film sat unreleased because the reducer refused
   * to schedule it at any marketing spend, down to zero. In practice: cash was
   * below zero, which blocks a release outright.
   */
  releaseBlockedDays: number;
  /** The first day that happened, or null. */
  releaseFirstBlockedOnDay: number | null;
  /** Drafts the bot could not move forward, with where they jammed - a pipeline defect, not an economy result. */
  stuck: string[];
  /** Projects started but dropped because the greenlight could not be afforded. */
  abandoned: number;
  awardWins: number;
  awardNominations: number;
  facilityUpgrades: number;
  /** Films mounted on a stretch (most of the cash on hand) because the usual share could not fund one. */
  stretchedFilms: number;
  finalState: GameState;
}

/** A new studio at a difficulty tier, generated the way a real new game is, but from a fixed seed and with no free test scripts. */
export function createBotStudio(seed: number, tier: DifficultyTier): GameState {
  const rng = createRng(seed);
  const talentPool = generateTalentPool(rng, GENERATED_TALENT_DB);
  const rivalStudios = generateRivalStudios(rng);
  const producerPool = generateProducerPool(rng);
  const stuntTeamPool = generateStuntTeamPool(rng);
  return {
    studio: { ...createInitialStudio(tier.cash, tier.brand, tier.prestige), assets: [] },
    screen: 'dashboard',
    projects: [],
    focusedProjectId: null,
    projectWorkspaceSection: 'sheet',
    rngSeed: forkSeed(rng),
    totalDays: 1,
    talentPool,
    talentDatabaseId: GENERATED_TALENT_DB.id,
    rivalStudios,
    producerPool,
    stuntTeamPool,
    opportunities: [],
    nextOpportunityCheckDay: 1,
    collaborations: [],
    talentPairings: [],
    awards: { history: [], season: null, nextSeasonDay: firstDayOfYear(2) },
    bidNotifications: [],
    viewingRivalStudioName: null,
    viewingProductionId: null,
  };
}

function playerDraftsOf(state: GameState): FilmDraft[] {
  return state.projects.flatMap((p) => (p.kind === 'player-in-progress' ? [p.draft] : []));
}

function filmsInFlight(state: GameState): number {
  return playerDraftsOf(state).length + scheduledPlayerReleases(state.projects).length;
}

function scriptQuality(script: Script): number {
  return (script.originality + script.hook + script.emotionalPremise + script.structure + script.characters + script.dialogue) / 6;
}

/**
 * Pre-production burns a fixed overhead every day whatever the film cost
 * (engine/cost.ts), so it has to come off the top before anything else is
 * budgeted - on a small film it is the largest single line.
 */
const PREP_DAYS_ALLOWANCE = 55;

/**
 * The negative cost (screenplay, cast, shoot, reserve) the strategy allows a
 * film of this scale started today: the all-in share of cash, less the prep
 * overhead, less the marketing that has to be left for the release.
 */
function negativeBudgetFor(cash: number, strategy: BotStrategy, scale: Script['scale'], share = strategy.filmBudgetShare): number {
  const overhead = strategy.budgetsForOverhead ? computeDailyPrepBurn(scale) * PREP_DAYS_ALLOWANCE : 0;
  return (cash * share - overhead) / (1 + strategy.marketingRatio);
}

/**
 * With nothing in flight a studio has to make something: when its usual share
 * of cash cannot mount a film, it stretches to this much rather than sit idle.
 */
const STRETCH_SHARE = 0.85;

/** The smallest negative cost at which a film of this scale is worth mounting at all. */
const MIN_NEGATIVE_BY_SCALE: Record<Script['scale'], number> = {
  Intimate: MIN_FILM_BUDGET,
  Medium: 4_000_000,
  Epic: 40_000_000,
};

function canMount(cash: number, strategy: BotStrategy, scale: Script['scale'], share = strategy.filmBudgetShare): boolean {
  return cash > 0 && negativeBudgetFor(cash, strategy, scale, share) >= MIN_NEGATIVE_BY_SCALE[scale];
}

function chooseScript(state: GameState, strategy: BotStrategy, share: number): Opportunity | null {
  const affordable = state.opportunities.filter(
    (o) =>
      o.bids.length === 0 &&
      o.expiresOnDay > state.totalDays &&
      canMount(state.studio.cash, strategy, o.script.scale, share) &&
      // A screenplay is a slice of the film, not the film: never more than a fifth of what the film may cost.
      o.acquisitionCost <= negativeBudgetFor(state.studio.cash, strategy, o.script.scale, share) * 0.2,
  );
  if (affordable.length === 0) return null;
  const ranked =
    strategy.scriptBy === 'cheapest'
      ? [...affordable].sort((a, b) => a.acquisitionCost - b.acquisitionCost)
      : [...affordable].sort((a, b) => scriptQuality(b.script) - scriptQuality(a.script));
  return ranked[0];
}

/** How a film's talent money is split across its mandatory roles: the people who carry the film take most of it. */
const ROLE_WEIGHT: Partial<Record<ProductionRole, number>> = {
  Director: 0.22,
  'Lead Actor': 0.34,
  'Supporting Actor': 0.2,
};
const CREW_WEIGHT_TOTAL = 0.24;

function slotBudgets(script: Script, talentBudget: number): Array<{ role: ProductionRole; slot: number; budget: number }> {
  const crewRoles = MANDATORY_TALENT_ROLES.filter((role) => ROLE_WEIGHT[role] === undefined);
  const slots: Array<{ role: ProductionRole; slot: number; budget: number }> = [];
  for (const role of MANDATORY_TALENT_ROLES) {
    const need = Math.max(1, effectiveRoleCapacity(role, script).min);
    const roleShare = ROLE_WEIGHT[role] ?? CREW_WEIGHT_TOTAL / crewRoles.length;
    for (let slot = 0; slot < need; slot++) slots.push({ role, slot, budget: (talentBudget * roleShare) / need });
  }
  return slots;
}

function candidateScore(person: Person, role: ProductionRole, script: Script, slot: number, strategy: BotStrategy): number {
  if (strategy.castBy === 'cheapest') return -getTypicalSalaryForRole(person, role);
  if (strategy.castBy === 'fame') return person.reputation.fame;
  if (role === 'Lead Actor' || role === 'Supporting Actor') {
    const character = characterForRoleSlot(script, role, slot);
    return (character ? computeActorCharacterCompatibility(person, character) : null) ?? 0;
  }
  const career = getCareerForRole(person, role) as { skill?: number } | null;
  const skill = career?.skill ?? 0;
  // A director is judged on taste for this script as much as on craft; crew on craft alone.
  return role === 'Director' ? (skill + (computeTalentCompatibility(person, role, script) ?? 0)) / 2 : skill;
}

/** Hire every mandatory role on the focused draft. Returns the state after the hires that took. */
function hireCastAndCrew(state: GameState, strategy: BotStrategy, talentBudget: number): GameState {
  let s = state;
  const script = asPlayerDraft(findProject(s.projects, s.focusedProjectId))!.script!;
  for (const { role, slot, budget } of slotBudgets(script, talentBudget)) {
    const draft = asPlayerDraft(findProject(s.projects, s.focusedProjectId))!;
    const taken = new Set(draft.talent.map((a) => a.person.id));
    const character = characterForRoleSlot(script, role, slot);
    const pool = availableCandidatesForRole(s.talentPool[professionForProductionRole(role)] ?? [], role, s.totalDays).filter(
      (person) =>
        !taken.has(person.id) &&
        personMeetsCharacterGender(person, character) &&
        personMeetsCharacterAge(person, character, s.totalDays),
    );
    if (pool.length === 0) continue;
    const withinBudget = pool.filter((person) => getTypicalSalaryForRole(person, role) <= budget);
    // Nobody at the price: take the cheapest there is rather than leave the role empty.
    const shortlist = withinBudget.length > 0 ? withinBudget : [...pool].sort((a, b) => getTypicalSalaryForRole(a, role) - getTypicalSalaryForRole(b, role)).slice(0, 1);
    const ranked = [...shortlist].sort((a, b) => candidateScore(b, role, script, slot, strategy) - candidateScore(a, role, script, slot, strategy));
    // The reducer can still refuse a hire (a rule this filter does not model); try down the list.
    for (const person of ranked.slice(0, 8)) {
      const next = studioReducer(s, { type: 'TOGGLE_TALENT_FOR_ROLE', role, person, characterId: character?.id });
      if (next !== s) {
        s = next;
        break;
      }
    }
  }
  return s;
}

function clampShootBudget(amount: number): number {
  return Math.round(Math.min(SHOOTING_BUDGET_RANGE.max, Math.max(SHOOTING_BUDGET_RANGE.min, amount)));
}

/** Buy a screenplay and take it from a blank project to a greenlit one, all on the same day. */
function startFilm(state: GameState, strategy: BotStrategy, run: BotRun): GameState {
  // The usual share of cash; or, with nothing else in flight and the usual
  // share too small to mount anything, a stretch.
  const usual = canMount(state.studio.cash, strategy, 'Intimate');
  const share = usual ? strategy.filmBudgetShare : STRETCH_SHARE;
  if (!usual && (filmsInFlight(state) > 0 || !canMount(state.studio.cash, strategy, 'Intimate', share))) return state;
  const opportunity = chooseScript(state, strategy, share);
  if (!opportunity) return state;
  const negativeBudget = negativeBudgetFor(state.studio.cash, strategy, opportunity.script.scale, share);
  if (!usual) run.stretchedFilms += 1;

  let s = studioReducer(state, { type: 'ACQUIRE_OPPORTUNITY', opportunityId: opportunity.id });
  if (s === state) return state;
  s = studioReducer(s, { type: 'CREATE_PROJECT_FROM_ASSET', assetId: opportunity.id });
  if (!s.focusedProjectId) return s;
  s = studioReducer(s, { type: 'SET_TARGET_AUDIENCE', targetAudience: opportunity.script.intendedAudience });

  const productionBudget = negativeBudget - opportunity.acquisitionCost;
  s = hireCastAndCrew(s, strategy, productionBudget * strategy.talentShare);

  const draft = asPlayerDraft(findProject(s.projects, s.focusedProjectId))!;
  const director = draft.talent.find((a) => a.role === 'Director')?.person;
  const directorCareer = director ? getDirectorCareer(director) : null;
  let shootMoney = productionBudget * (1 - strategy.talentShare);
  // 1 = the ambition the screenplay calls for; trimmed toward 0 if the package cannot be afforded.
  let ambitionScale = 1;
  const focusedDraft = () => asPlayerDraft(findProject(s.projects, s.focusedProjectId))!;
  const setPlan = () => {
    s = studioReducer(s, {
      type: 'SET_PRODUCTION_PLAN',
      environmentStrategy: directorCareer ? recommendEnvironmentStrategy(draft.script!, directorCareer).value : draft.script!.environmentStrategy,
      environmentAmbition: recommendEnvironmentAmbition(draft.script!).value * ambitionScale,
      effectsStrategy: directorCareer ? recommendEffectsStrategy(draft.script!, directorCareer).value : draft.script!.effectsStrategy,
      effectsAmbition: recommendEffectsAmbition(draft.script!).value * ambitionScale,
      shootingBudgetAmount: clampShootBudget(shootMoney * 0.85),
      contingencyReserveAmount: Math.round(shootMoney * 0.15),
      runtimeIntensity: 0.5,
    });
  };
  setPlan();

  // A director with strong convictions makes demands that must each be settled
  // before greenlight. The bot gives the director what they ask for.
  for (const demand of focusedDraft().development?.demands ?? []) {
    if (!demand.resolution) s = studioReducer(s, { type: 'RESOLVE_CREATIVE_DEMAND', demandId: demand.id, accept: true });
  }

  // The plan's real cost (sets, effects) is only known once it is set. If the
  // package turns out unaffordable, trim the shoot and then the ambition
  // rather than walk away - down to the cheapest version of this film there is.
  for (let trim = 0; trim < 6; trim++) {
    const blockers = deriveProjectReadiness(focusedDraft(), s.studio.cash).blockers;
    if (!blockers.some((b) => b.code === 'cannot-afford-greenlight')) break;
    shootMoney *= 0.5;
    ambitionScale = Math.max(0, ambitionScale - 0.25);
    setPlan();
  }

  const beforeGreenlight = s;
  s = studioReducer(s, { type: 'GREENLIGHT_PROJECT' });
  if (asPlayerDraft(findProject(s.projects, s.focusedProjectId))?.greenlitOnDay == null) {
    // Could not be greenlit (unaffordable once real fees were known, or a role
    // nobody could fill). A player would walk away; so does the bot.
    const readiness = deriveProjectReadiness(asPlayerDraft(findProject(beforeGreenlight.projects, beforeGreenlight.focusedProjectId))!, beforeGreenlight.studio.cash);
    run.abandoned += 1;
    if (readiness.blockers.length > 0 && run.stuck.length < 40) {
      run.stuck.push(`day ${s.totalDays}: could not greenlight "${opportunity.script.title}" - ${readiness.blockers.map((b) => b.code).join(', ')}`);
    }
    s = studioReducer(s, { type: 'ABANDON_PROJECT' });
  }
  return studioReducer(s, { type: 'RETURN_TO_DASHBOARD' });
}

function releaseTypeFor(draft: FilmDraft, strategy: BotStrategy): ReleaseType {
  if (strategy.release !== 'auto') return strategy.release;
  const negative = draft.talent.reduce((sum, a) => sum + getTypicalSalaryForRole(a.person, a.role), 0) + (draft.productionChoices?.shootingBudgetAmount ?? 0);
  return negative >= strategy.wideAbove ? 'Wide' : 'Limited';
}

/** With a project focused, set the campaign and date the release. Falls back to cheaper campaigns if the studio cannot pay. */
function scheduleRelease(state: GameState, draft: FilmDraft, strategy: BotStrategy): GameState {
  const negative = draft.talent.reduce((sum, a) => sum + getTypicalSalaryForRole(a.person, a.role), 0) + (draft.productionChoices?.shootingBudgetAmount ?? 0);
  const releaseDay = Math.max(state.totalDays, draft.postProductionFinalReadyDay ?? state.totalDays) + RELEASE_RUNWAY_DAYS;
  const wanted = Math.min(negative * strategy.marketingRatio, state.studio.cash * 0.9);
  const releaseType = releaseTypeFor(draft, strategy);
  const attempts: Array<{ spend: number; type: ReleaseType }> = [
    { spend: wanted, type: releaseType },
    { spend: wanted * 0.5, type: releaseType },
    { spend: wanted * 0.2, type: 'Limited' },
    { spend: 0, type: 'Limited' },
  ];
  for (const attempt of attempts) {
    let s = studioReducer(state, {
      type: 'SET_MARKETING_CHOICES',
      choices: { marketingSpend: Math.round(attempt.spend), releaseType: attempt.type, releaseWindow: 'Quiet Month' },
    });
    const before = s;
    s = studioReducer(s, { type: 'SCHEDULE_RELEASE', releaseDay });
    if (s !== before) return s;
  }
  return state;
}

/**
 * Move every film that is waiting on the player: answer its pending decision,
 * wrap its shoot, set its post-production, date its release.
 */
function tendProjects(state: GameState, strategy: BotStrategy, run: BotRun): GameState {
  let s = state;
  for (const id of playerDraftsOf(s).map((d) => d.id)) {
    const draft = asPlayerDraft(findProject(s.projects, id));
    if (!draft || draft.greenlitOnDay == null) continue;

    const prep = draft.preProduction;
    if (prep?.status === 'awaiting-choice' && prep.pendingChoice) {
      s = studioReducer(s, { type: 'RESOLVE_PREPRODUCTION_CHOICE', choiceId: prep.pendingChoice.choices[0].id, productionId: id });
      continue;
    }
    const photo = draft.photography;
    if (photo?.status === 'awaiting-choice' && photo.pendingChoice) {
      s = studioReducer(s, { type: 'RESOLVE_EVENT_CHOICE', choiceId: photo.pendingChoice.choices[0].id, productionId: id });
      continue;
    }
    if (photo?.status === 'in-progress' && photo.daysElapsed >= Math.max(photo.recommendedDays, footageLowerBound(photo.recommendedDays))) {
      s = studioReducer(s, { type: 'FINISH_PHOTOGRAPHY', productionId: id });
      continue;
    }
    if (photo?.status !== 'finished') continue;

    if (draft.testScreeningPendingChoice) {
      s = studioReducer(s, { type: 'RESOLVE_TEST_SCREENING_CHOICE', choiceId: 'release-as-is', productionId: id });
      continue;
    }
    if (!draft.postProductionChoices) {
      s = studioReducer(s, { type: 'RETURN_TO_DASHBOARD' });
      s = studioReducer(s, { type: 'RESUME_PROJECT', projectId: id });
      s = studioReducer(s, { type: 'GO_TO_STEP', step: 'post-production' });
      s = studioReducer(s, {
        type: 'SET_POST_PRODUCTION_CHOICES',
        choices: { editStyle: 'Balanced', musicFocus: 'Standard', finalCutFocus: 'Trailer-focused' },
      });
      s = studioReducer(s, { type: 'RETURN_TO_DASHBOARD' });
      continue;
    }
    if (draft.testScreeningResolved) {
      s = studioReducer(s, { type: 'RETURN_TO_DASHBOARD' });
      s = studioReducer(s, { type: 'RESUME_PROJECT', projectId: id });
      s = studioReducer(s, { type: 'GO_TO_STEP', step: 'marketing' });
      const focused = asPlayerDraft(findProject(s.projects, id));
      if (focused) {
        const scheduled = scheduleRelease(s, focused, strategy);
        if (scheduled === s) {
          run.releaseBlockedDays += 1;
          run.releaseFirstBlockedOnDay ??= s.totalDays;
        }
        s = scheduled;
      }
      s = studioReducer(s, { type: 'RETURN_TO_DASHBOARD' });
    }
  }
  return s;
}

const FACILITY_ACTIONS = [
  { type: 'UNLOCK_PRODUCTION_OFFICE' },
  { type: 'UNLOCK_DISTRIBUTION_ARM' },
  { type: 'UPGRADE_DISTRIBUTION_ARM' },
  { type: 'UPGRADE_INTERNATIONAL_DISTRIBUTION' },
  { type: 'UPGRADE_MARKET_RESEARCH' },
  { type: 'UPGRADE_PRODUCTION_OFFICE' },
] as const;

/** Buy at most one facility step a day, and only when it is a small part of the cash on hand. */
function maybeUpgrade(state: GameState, strategy: BotStrategy, run: BotRun): GameState {
  if (strategy.upgradeShare === null) return state;
  for (const action of FACILITY_ACTIONS) {
    const next = studioReducer(state, action);
    if (next === state) continue;
    const cost = state.studio.cash - next.studio.cash;
    if (cost <= state.studio.cash * strategy.upgradeShare) {
      run.facilityUpgrades += 1;
      return next;
    }
  }
  return state;
}

/** A short signature of where a draft is in the pipeline, to notice one that has stopped moving. */
function progressSignature(draft: FilmDraft): string {
  return [
    draft.greenlitOnDay ?? 'dev',
    draft.preProduction?.status,
    draft.preProduction?.daysElapsed,
    draft.photography?.status,
    draft.photography?.daysElapsed,
    draft.postProductionChoices ? 'post' : '',
    draft.testScreeningResolved ? 'screened' : '',
    draft.testScreeningPendingChoice ? 'screening' : '',
  ].join('|');
}

function toBotFilm(film: Film): BotFilm {
  return {
    title: film.title,
    releasedOnDay: film.releasedOnDay,
    totalCost: film.results.totalCost,
    boxOffice: film.results.totalBoxOffice,
    profit: film.results.profit,
    outcome: film.results.outcome,
    quality: film.results.qualityScore,
    critic: film.results.criticScore,
    releaseType: film.marketingChoices.releaseType,
  };
}

/**
 * Play one studio for `years` in-game years under one strategy. Reproducible:
 * the same arguments always give the same career (engine/identity.ts).
 */
export function runBot(seed: number, tier: DifficultyTier, strategy: BotStrategy, years: number): BotRun {
  return withReplayableIds(() => playCareer(seed, tier, strategy, years));
}

function playCareer(seed: number, tier: DifficultyTier, strategy: BotStrategy, years: number): BotRun {
  let s = createBotStudio(seed, tier);
  const run: BotRun = {
    strategy: strategy.name,
    tier: tier.label,
    seed,
    years: [],
    films: [],
    stalledOnDay: null,
    idleBrokeDays: 0,
    releaseBlockedDays: 0,
    releaseFirstBlockedOnDay: null,
    stuck: [],
    abandoned: 0,
    awardWins: 0,
    awardNominations: 0,
    facilityUpgrades: 0,
    stretchedFilms: 0,
    finalState: s,
  };

  const lastProgress = new Map<string, { signature: string; day: number }>();
  let consecutiveIdleBroke = 0;
  let cashMin = s.studio.cash;
  const endDay = firstDayOfYear(years + 1);

  while (s.totalDays < endDay) {
    s = tendProjects(s, strategy, run);
    if (filmsInFlight(s) < strategy.maxConcurrent) s = startFilm(s, strategy, run);
    s = maybeUpgrade(s, strategy, run);

    // Stuck drafts: a pipeline the bot cannot move is a defect to report, not a result to average in.
    for (const draft of playerDraftsOf(s)) {
      const signature = progressSignature(draft);
      const seen = lastProgress.get(draft.id);
      if (!seen || seen.signature !== signature) {
        lastProgress.set(draft.id, { signature, day: s.totalDays });
      } else if (draft.testScreeningResolved) {
        // Finished and waiting on a release the studio cannot pay for: not a
        // pipeline defect. Counted in releaseBlockedDays; the bot keeps waiting
        // for income to lift it, as a player would.
      } else if (s.totalDays - seen.day > STUCK_AFTER_DAYS) {
        if (run.stuck.length < 40) run.stuck.push(`day ${s.totalDays}: "${draft.title}" stopped at ${signature}`);
        s = studioReducer(s, { type: 'RETURN_TO_DASHBOARD' });
        s = studioReducer(s, { type: 'RESUME_PROJECT', projectId: draft.id });
        s = studioReducer(s, { type: 'ABANDON_PROJECT' });
        s = studioReducer(s, { type: 'RETURN_TO_DASHBOARD' });
        lastProgress.delete(draft.id);
      }
    }

    const running = playerReleasedFilms(s.projects).some((f) => f.boxOfficeRun.status === 'running');
    const idleBroke = filmsInFlight(s) === 0 && !canMount(s.studio.cash, strategy, 'Intimate', STRETCH_SHARE);
    if (idleBroke) run.idleBrokeDays += 1;
    consecutiveIdleBroke = idleBroke && !running ? consecutiveIdleBroke + 1 : 0;
    if (consecutiveIdleBroke >= STALLED_AFTER_DAYS && run.stalledOnDay === null) run.stalledOnDay = s.totalDays - STALLED_AFTER_DAYS;

    if (s.focusedProjectId) s = studioReducer(s, { type: 'RETURN_TO_DASHBOARD' });
    s = studioReducer(s, { type: 'ADVANCE_DAY' });
    cashMin = Math.min(cashMin, s.studio.cash);

    // Close out each year the clock has now passed. A `while`, not an `if`
    // against the day before the tick: other actions move the calendar too (a
    // resolved decision's delay days, a wizard step), so a year boundary can be
    // crossed anywhere in the loop body.
    while (run.years.length < years && s.totalDays >= firstDayOfYear(run.years.length + 2)) {
      const year = run.years.length + 1;
      const yearStart = firstDayOfYear(year);
      const yearEnd = firstDayOfYear(year + 1);
      run.years.push({
        year,
        cashEnd: s.studio.cash,
        cashMin,
        brand: s.studio.brand,
        prestige: s.studio.prestige,
        filmsReleased: playerReleasedFilms(s.projects).filter((f) => f.releasedOnDay >= yearStart && f.releasedOnDay < yearEnd).length,
      });
      cashMin = s.studio.cash;
    }
  }

  const playerFilms = playerReleasedFilms(s.projects);
  const playerFilmIds = new Set(playerFilms.map((f) => f.id));
  for (const ceremony of s.awards?.history ?? []) {
    for (const nominations of Object.values(ceremony.categories)) {
      for (const nomination of nominations ?? []) {
        if (!playerFilmIds.has(nomination.filmId)) continue;
        run.awardNominations += 1;
        if (nomination.won) run.awardWins += 1;
      }
    }
  }
  run.films = playerFilms.map(toBotFilm).sort((a, b) => a.releasedOnDay - b.releasedOnDay);
  run.finalState = s;
  return run;
}

/**
 * Buy a screenplay and greenlight a film from it, leaving nothing focused -
 * one step of the bot, exposed so a test can set up a backgrounded production.
 * Returns the state unchanged if no film could be started today.
 */
export function botStartFilm(state: GameState, strategy: BotStrategy): GameState {
  const scratch = { abandoned: 0, stuck: [], stretchedFilms: 0 } as unknown as BotRun;
  return startFilm(state, strategy, scratch);
}

/** Whether every project in the state has a distinct id - the bot's own sanity check on the pipeline. */
export function hasUniqueProjectIds(state: GameState): boolean {
  const ids = state.projects.map(projectId);
  return new Set(ids).size === ids.length;
}
