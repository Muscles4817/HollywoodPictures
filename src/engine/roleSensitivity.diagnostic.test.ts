/**
 * Empirical sensitivity diagnostic: how much does the quality of the person
 * you hire into each PRODUCTION ROLE actually move the finished film's Quality
 * Score?
 *
 * For every hireable role we take one fixed, excellent, well-resourced project
 * and swap ONLY that role's occupant between a floor hire (skill ~8) and a
 * ceiling hire (skill ~98), holding every other role at a strong baseline. We
 * then measure the quality gap two ways:
 *
 *   directDelta  - pure scoring chain, no on-set events (neutral execution).
 *                  This is the sensitivity that survives even on a perfectly
 *                  smooth shoot - i.e. the role's *structural* contribution to
 *                  computeQualityBreakdown.
 *   fullDelta    - the same swap run through many real, seeded shoots, so
 *                  skill-sensitive on-set events (data/productionEvents.ts:
 *                  involvesRole) get their chance to fire. Paired by seed, so
 *                  floor and ceiling see the identical event sequence and only
 *                  the per-event qualityDelta differs.
 *
 * We also report presenceDelta (ceiling hire vs the role left UNFILLED), which
 * asks the bluntest question of all: does having a top person in this seat beat
 * having nobody?
 *
 * Why this exists: only Director / Lead Actor / Supporting Actor feed
 * computeQualityBreakdown directly (scoring.ts). The six crew roles (Writer,
 * Cinematographer, Composer, Editor, VFX Supervisor, Casting Director) reach
 * quality ONLY through skill-sensitive events - and two of them (VFX Supervisor,
 * Casting Director) have no involvesRole event at all, so no pathway whatsoever.
 * This harness quantifies exactly how near-nil each role is, so a rebalance has
 * numbers to aim at.
 *
 * NOTE on Writer: a writer's real leverage is UPSTREAM, at script generation
 * (engine/scriptGenerator.ts) - baked into the Script's craft stats before this
 * pipeline ever runs. This harness measures only the production->quality
 * pipeline, where the Writer is crew (events only). A low fullDelta here is
 * therefore expected and by-design for Writer, unlike VFX Supervisor / Casting
 * Director, which have no route to film quality anywhere.
 *
 * Opt-in:
 *   ROLE_SENSITIVITY_DIAGNOSTIC=1 npx vitest run src/engine/roleSensitivity.diagnostic.test.ts --disable-console-intercept
 */
import { describe, it } from 'vitest';
import { buildReadyDraft } from '../state/testFixtures';
import {
  computeStaticProductionRisk,
  computeRecommendedShootDays,
  computeShootEscalation,
  rollDayEvent,
  resolveEventChoice,
} from './production';
import { computeQualityBreakdown } from './scoring';
import {
  computeExecutionProfile,
  computeExecutionResilience,
  neutralExecutionProfile,
} from './productionExecution';
import { generateTalentCandidates, generateTalentPool } from './talentGenerator';
import { CREW_CAREER_KEY } from './person';
import { professionForProductionRole } from '../data/helpers';
import { withRng, type RandomFn } from './random';
import type { FilmDraft, Person, ProductionEvent, ProductionRole, TalentAssignment } from '../types';

const SEEDS = 150;
const BASE_SEED = 4817;

// Every role the player hires into a film's cast. Ordered creative-first.
const ROLES: ProductionRole[] = [
  'Director',
  'Lead Actor',
  'Supporting Actor',
  'Writer',
  'Cinematographer',
  'Composer',
  'Editor',
  'VFX Supervisor',
  'Casting Director',
];

// Which quality pathways each role even HAS - printed alongside the measured
// deltas so the report explains itself. `direct` = appears in a compute*Score
// term inside computeQualityBreakdown; `events` = number of on-set event
// templates that name it via involvesRole (data/productionEvents.ts).
const PATHWAYS: Record<ProductionRole, { direct: boolean; events: number }> = {
  Director: { direct: true, events: 1 },
  'Lead Actor': { direct: true, events: 4 },
  'Supporting Actor': { direct: true, events: 1 },
  Writer: { direct: false, events: 2 },
  Cinematographer: { direct: false, events: 1 },
  Composer: { direct: false, events: 1 },
  Editor: { direct: false, events: 2 },
  'VFX Supervisor': { direct: false, events: 0 },
  'Casting Director': { direct: false, events: 0 },
};

type Level = 'floor' | 'strong' | 'ceil';
const LEVELS: Record<Level, { skill: number; craftFloor: number; craftHeadroom: number }> = {
  floor: { skill: 8, craftFloor: 40, craftHeadroom: 3 },
  strong: { skill: 78, craftFloor: 74, craftHeadroom: 22 },
  ceil: { skill: 98, craftFloor: 80, craftHeadroom: 45 },
};

/** Set a person's role-relevant craft/skill to a level, leaving every other field (tone, fit, fame) untouched - so the ONLY axis we vary is "how good are they." */
function setRoleLevel(person: Person, role: ProductionRole, level: Level): Person {
  const L = LEVELS[level];
  const careers = person.careers;
  if (role === 'Director') {
    if (!careers.director) return person;
    return { ...person, careers: { ...careers, director: { ...careers.director, skill: L.skill } } };
  }
  if (role === 'Lead Actor' || role === 'Supporting Actor') {
    if (!careers.actor) return person;
    return { ...person, careers: { ...careers, actor: { ...careers.actor, craftFloor: L.craftFloor, craftHeadroom: L.craftHeadroom } } };
  }
  const key = CREW_CAREER_KEY[role as Exclude<ProductionRole, 'Director' | 'Lead Actor' | 'Supporting Actor'>];
  const crew = careers[key];
  if (!crew) return person;
  return { ...person, careers: { ...careers, [key]: { ...crew, skill: L.skill } } };
}

interface Baseline {
  draft: FilmDraft;
}

/**
 * One fixed excellent project with ALL nine roles filled at a strong baseline:
 * an excellent script, a strong director/cast, and a full crew. Nothing here is
 * a bottleneck, so when we later flip a single role floor<->ceiling its full
 * sensitivity is free to propagate through the dependency chain.
 */
function buildBaseline(rng: RandomFn): Baseline {
  const base = buildReadyDraft(rng);
  const script = base.script!;
  const excellentScript = { ...script, originality: 90, structure: 90, characters: 90, dialogue: 90 };

  const crewRoles: ProductionRole[] = ['Writer', 'Cinematographer', 'Composer', 'Editor', 'VFX Supervisor', 'Casting Director'];
  const crewAssignments: TalentAssignment[] = crewRoles.map((role) => ({
    role,
    person: generateTalentCandidates(professionForProductionRole(role), rng, 1)[0],
  }));

  const talent: TalentAssignment[] = [...base.talent, ...crewAssignments].map((a) => ({
    ...a,
    person: setRoleLevel(a.person, a.role, 'strong'),
  }));

  return { draft: { ...base, script: excellentScript, talent } };
}

/** Copy the baseline draft with exactly one role set to a level, or removed entirely (level `null`). */
function withRoleAt(baseline: Baseline, role: ProductionRole, level: Level | null): FilmDraft {
  const draft = baseline.draft;
  if (level === null) {
    return { ...draft, talent: draft.talent.filter((a) => a.role !== role) };
  }
  return {
    ...draft,
    talent: draft.talent.map((a) => (a.role === role ? { ...a, person: setRoleLevel(a.person, role, level) } : a)),
  };
}

/** Quality Score on a perfectly smooth shoot - no events, neutral execution. Isolates the role's DIRECT structural contribution. */
function directQuality(draft: FilmDraft): number {
  return computeQualityBreakdown(
    draft.script!,
    draft.talent,
    draft.genre!,
    draft.productionChoices!,
    draft.postProductionChoices!,
    [],
    1,
    0,
    neutralExecutionProfile(1),
  ).qualityScore;
}

/** Quality Score after a real, seeded day-by-day shoot - so skill-sensitive on-set events get their chance to fire and shift each department. */
function shootQuality(draft: FilmDraft, seed: number): number {
  return withRng(seed, (rng: RandomFn): number => {
    const talentPool = generateTalentPool(rng);
    const staticRisk = computeStaticProductionRisk(draft.talent, draft.script!, draft.productionChoices!, draft.genre!);
    const recommendedDays = computeRecommendedShootDays(draft.talent, draft.script!, draft.productionChoices!);
    const resilience = computeExecutionResilience(draft.talent, draft.productionChoices!);

    const events: ProductionEvent[] = [];
    const usedIds = new Set<string>();
    let extraDays = 0;
    for (let day = 1; day <= recommendedDays; day++) {
      const escalation = computeShootEscalation(events, resilience);
      const rolled = rollDayEvent(staticRisk, day, recommendedDays, draft.genre!, usedIds, draft.talent, draft.script!, talentPool as never, rng, escalation);
      if (!rolled) continue;
      if ('event' in rolled) {
        events.push(rolled.event);
        usedIds.add(rolled.event.id);
        extraDays += rolled.event.delayDaysDelta;
      } else {
        const choice = rolled.pendingChoice.choices[Math.floor(rng() * rolled.pendingChoice.choices.length)];
        const resolved = resolveEventChoice(rolled.pendingChoice, choice.id, rng);
        events.push(resolved);
        usedIds.add(resolved.id);
        extraDays += resolved.delayDaysDelta;
      }
    }
    const shootingRatio = (recommendedDays + extraDays) / recommendedDays;
    const profile = computeExecutionProfile({ events, shootingRatio, talent: draft.talent, productionChoices: draft.productionChoices! });
    return computeQualityBreakdown(draft.script!, draft.talent, draft.genre!, draft.productionChoices!, draft.postProductionChoices!, events, shootingRatio, 0, profile).qualityScore;
  }).result;
}

function mean(xs: number[]): number { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }
function stdev(xs: number[]): number { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); }

interface RoleResult {
  role: ProductionRole;
  directDelta: number;
  fullDelta: number;
  fullDeltaSd: number;
  presenceDelta: number;
  floorQ: number;
  ceilQ: number;
  absentQ: number;
}

function measureRole(baseline: Baseline, role: ProductionRole): RoleResult {
  const floorDraft = withRoleAt(baseline, role, 'floor');
  const ceilDraft = withRoleAt(baseline, role, 'ceil');
  const absentDraft = withRoleAt(baseline, role, null);

  const directDelta = directQuality(ceilDraft) - directQuality(floorDraft);

  const fullDeltas: number[] = [];
  const presenceDeltas: number[] = [];
  const floorQs: number[] = [];
  const ceilQs: number[] = [];
  const absentQs: number[] = [];
  for (let s = 0; s < SEEDS; s++) {
    const seed = BASE_SEED + s;
    const qFloor = shootQuality(floorDraft, seed);
    const qCeil = shootQuality(ceilDraft, seed);
    const qAbsent = shootQuality(absentDraft, seed);
    fullDeltas.push(qCeil - qFloor);
    presenceDeltas.push(qCeil - qAbsent);
    floorQs.push(qFloor);
    ceilQs.push(qCeil);
    absentQs.push(qAbsent);
  }
  return {
    role,
    directDelta,
    fullDelta: mean(fullDeltas),
    fullDeltaSd: stdev(fullDeltas),
    presenceDelta: mean(presenceDeltas),
    floorQ: mean(floorQs),
    ceilQ: mean(ceilQs),
    absentQ: mean(absentQs),
  };
}

const enabled = Boolean((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.ROLE_SENSITIVITY_DIAGNOSTIC);

// A role is flagged "near-nil" if swapping a floor hire for a ceiling one moves
// finished quality by less than this many points on the 0-100 scale.
const NIL_THRESHOLD = 1.0;

describe.skipIf(!enabled)('Hireable-role quality sensitivity diagnostic', () => {
  it('measures how much each production role moves finished Quality Score (floor hire vs ceiling hire)', () => {
    const { result: baseline } = withRng(BASE_SEED, (rng) => buildBaseline(rng));
    const results = ROLES.map((role) => measureRole(baseline, role));
    const ranked = [...results].sort((a, b) => b.fullDelta - a.fullDelta);

    const lines: string[] = [];
    lines.push(`\n=== HIREABLE-ROLE QUALITY SENSITIVITY (${SEEDS} seeded shoots per role) ===`);
    lines.push('One fixed excellent project; only the named role is swapped floor(skill~8) <-> ceiling(skill~98).');
    lines.push('directDelta = pure scoring chain, no events.  fullDelta = through real shoots (events can fire).');
    lines.push('presenceDelta = ceiling hire vs role left UNFILLED.  Quality Score is 0-100.\n');

    const hdr = `  ${'role'.padEnd(18)} ${'path(dir/evt)'.padStart(13)} ${'floorQ'.padStart(7)} ${'ceilQ'.padStart(7)} ${'absentQ'.padStart(8)} ${'directD'.padStart(8)} ${'fullD'.padStart(7)} ${'(sd)'.padStart(6)} ${'presenceD'.padStart(10)}  flag`;
    lines.push(hdr);
    for (const r of ranked) {
      const p = PATHWAYS[r.role];
      const path = `${p.direct ? 'Y' : 'n'}/${p.events}`;
      const nearNil = Math.abs(r.fullDelta) < NIL_THRESHOLD;
      const flag = !p.direct && p.events === 0 ? 'NO PATHWAY' : nearNil ? 'near-nil' : '';
      lines.push(
        `  ${r.role.padEnd(18)} ${path.padStart(13)} ${r.floorQ.toFixed(1).padStart(7)} ${r.ceilQ.toFixed(1).padStart(7)} ${r.absentQ.toFixed(1).padStart(8)} ${r.directDelta.toFixed(2).padStart(8)} ${r.fullDelta.toFixed(2).padStart(7)} ${r.fullDeltaSd.toFixed(2).padStart(6)} ${r.presenceDelta.toFixed(2).padStart(10)}  ${flag}`,
      );
    }

    const nil = ranked.filter((r) => Math.abs(r.fullDelta) < NIL_THRESHOLD);
    const noPath = ROLES.filter((role) => !PATHWAYS[role].direct && PATHWAYS[role].events === 0);
    lines.push('\nHEADLINE');
    lines.push(`  Roles whose best->worst hire moves finished quality < ${NIL_THRESHOLD.toFixed(1)} pt: ${nil.length ? nil.map((r) => r.role).join(', ') : '(none)'}`);
    lines.push(`  Roles with NO pathway to film quality at all (no direct term AND no involvesRole event): ${noPath.length ? noPath.join(', ') : '(none)'}`);
    lines.push(`  Widest sensitivity: ${ranked[0].role} (${ranked[0].fullDelta.toFixed(1)} pt)  |  Narrowest: ${ranked[ranked.length - 1].role} (${ranked[ranked.length - 1].fullDelta.toFixed(1)} pt)`);

    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
  }, 600_000);
});
