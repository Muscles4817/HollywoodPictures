/**
 * Empirical diagnostic for the acceptance test in
 * docs/DESIGN_REVIEW_delegated_staffing.md §6 and §8:
 *
 *   Is handing a crew slot to your Line Producer ever the WRONG call?
 *
 * The whole design rests on delegation being a trade - cheaper and cheaper to
 * think about, but worse on how well the head suits what this film actually
 * asks of their department. If delegation turns out to be at least as good as
 * hand-staffing on BOTH axes, then a rational player delegates every slot every
 * time, the game's richest loop is hollow, and the tuning in data/producers.ts
 * (BRIEF_VALUE_WEIGHT / BRIEF_FIT_WEIGHT above all) is what has to move.
 *
 * So this sweeps many scripts x many producers and reports, per role:
 *
 *   - what a delegated hire costs vs. what the player's own best-fit hire
 *     within the same allocation costs (delegation should WIN);
 *   - how the delegated head's specialty-weighted fit for the film compares
 *     (delegation should LOSE);
 *   - how often the producer happens to land on the fit-optimal candidate
 *     anyway (should be well short of always - otherwise there is no gamble).
 *
 * Skipped in the normal suite - run it deliberately with:
 *
 *   DELEGATION_DIAGNOSTIC=1 npx vitest run src/engine/delegatedStaffing.diagnostic.test.ts --disable-console-intercept
 */
import { describe, it, expect } from 'vitest';
import { producerCandidatePick, eligibleBriefCandidates } from './staffingBriefs';
import { crewSpecialtyCapability, specialtyDepartmentForRole, isSpecialtyDepartment, specialtyWeightedCapability } from './crewSpecialty';
import { deriveDepartmentWorkloadsForScript } from './departmentWorkload';
import { getCrewCareer, getTypicalSalaryForRole } from './person';
import { buildStateWithReadyDraft } from '../state/testFixtures';
import { asPlayerDraft, findProject } from './project';
import { createRng } from './random';
import { DELEGABLE_CREW_ROLES } from '../data/producers';
import { professionForProductionRole } from '../data/helpers';
import type { FilmDraft, Person, ProductionRole, TalentProfession } from '../types';

const diagnosticEnabled = Boolean(
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.DELEGATION_DIAGNOSTIC,
);

const FILMS = 24;
const ALLOCATION = 6_000_000;

function makeProducer(id: string, skill: number): Person {
  return {
    id,
    identity: { name: `Producer ${id}`, appearanceTags: [] },
    personality: { professionalism: 60, ambition: 55, loyalty: 50, ego: 30, temperament: 50, pressureHandling: 55, controversy: 18, adaptability: 55 },
    reputation: { fame: 40, prestige: 40, industryRespect: 60, reliability: 80, currentHeat: 40 },
    primaryRole: 'Producer',
    careers: { producer: { specialty: 'Line', skill, genreAffinity: [], typicalSalary: 300_000 } },
    availability: { commitments: [] },
    traits: [],
  };
}

/** How well this head suits what THIS film asks of their department (0-100). */
function fitFor(person: Person, role: ProductionRole, draft: FilmDraft): number {
  const overall = getCrewCareer(person, role as Parameters<typeof getCrewCareer>[1])?.skill ?? 50;
  const department = specialtyDepartmentForRole(role);
  if (!department || !draft.script || !isSpecialtyDepartment(department)) return overall;
  const workload = deriveDepartmentWorkloadsForScript(draft.script).find((w) => w.department === department);
  if (!workload) return overall;
  const caps = crewSpecialtyCapability(person, role, department, overall);
  return specialtyWeightedCapability(caps, workload.contributions, overall).skill;
}

interface Tally {
  samples: number;
  emptyHanded: number;
  feeDelta: number;
  fitDelta: number;
  /** The worst single fit gap seen - the tail is where the gamble actually lives. */
  worstFitDelta: number;
  matchedBest: number;
}

function blank(): Tally {
  return { samples: 0, emptyHanded: 0, feeDelta: 0, fitDelta: 0, worstFitDelta: 0, matchedBest: 0 };
}

// A spread of producers, because "do I trust THIS one" is the decision the
// player actually makes. The design claims skill sets the SPREAD of the
// outcome, not just its mean - so the tail matters more than the average here.
const SKILL_BANDS: ReadonlyArray<readonly [string, number]> = [
  ['poor (20)', 20],
  ['fair (45)', 45],
  ['good (70)', 70],
  ['top (95)', 95],
];

const money = (m: number) => `£${(m / 1_000_000).toFixed(2)}M`;

describe.skipIf(!diagnosticEnabled)('delegated staffing - is it ever the wrong call?', () => {
  it('reports cost and fit against hand-staffing the same slot', () => {
    const byRole = new Map<ProductionRole, Tally>(DELEGABLE_CREW_ROLES.map((r) => [r, blank()]));
    const bySkill = new Map<string, Tally>(SKILL_BANDS.map(([label]) => [label, blank()]));

    for (let film = 0; film < FILMS; film++) {
      const base = buildStateWithReadyDraft(1000 + film);
      const ready = asPlayerDraft(findProject(base.projects, base.focusedProjectId))!;
      const talentPool = base.talentPool as Record<TalentProfession, Person[]>;

      for (const role of DELEGABLE_CREW_ROLES) {
        const draft: FilmDraft = { ...ready, photography: null, talent: ready.talent.filter((a) => a.role !== role) };

        // What the player would do with the same money: the best fit they can
        // afford. The honest comparison - a player browsing the drawer sorts by
        // fit, not by value - and a deliberately generous upper bound.
        const affordable = eligibleBriefCandidates(draft, talentPool, role, base.totalDays)
          .map((p) => ({ p, fee: getTypicalSalaryForRole(p, role), fit: fitFor(p, role, draft) }))
          .filter((c) => c.fee <= ALLOCATION);
        if (affordable.length === 0) continue;
        const handPick = affordable.reduce((a, b) => (b.fit > a.fit ? b : a));

        for (const [label, skill] of SKILL_BANDS) {
          const producer = makeProducer(`p-${skill}`, skill);
          const pick = producerCandidatePick(producer, role, ALLOCATION, draft, talentPool, base.totalDays, createRng(film * 100 + skill));
          const tallies = [byRole.get(role)!, bySkill.get(label)!];
          for (const t of tallies) t.samples++;
          if (!pick) {
            for (const t of tallies) t.emptyHanded++;
            continue;
          }
          const person = talentPool[professionForProductionRole(role)].find((p) => p.id === pick.personId)!;
          const feeDelta = pick.fee - handPick.fee;
          const fitDelta = fitFor(person, role, draft) - handPick.fit;
          for (const t of tallies) {
            t.feeDelta += feeDelta;
            t.fitDelta += fitDelta;
            t.worstFitDelta = Math.min(t.worstFitDelta, fitDelta);
            if (person.id === handPick.p.id) t.matchedBest++;
          }
        }
      }
    }

    const report = (title: string, rows: Map<string, Tally>) => {
      // eslint-disable-next-line no-console
      console.log(`\n${title}`);
      // eslint-disable-next-line no-console
      console.log('                       n   fee saved   mean fit cost   worst fit cost   found the best pick   empty-handed');
      for (const [label, t] of rows) {
        const n = t.samples - t.emptyHanded;
        if (n === 0) continue;
        // eslint-disable-next-line no-console
        console.log(
          `${label.padEnd(20)} ${String(n).padStart(3)}   ${money(-t.feeDelta / n).padStart(9)}   ` +
            `${(t.fitDelta / n).toFixed(1).padStart(13)}   ${t.worstFitDelta.toFixed(1).padStart(14)}   ` +
            `${((t.matchedBest / n) * 100).toFixed(0).padStart(19)}%   ${String(t.emptyHanded).padStart(12)}`,
        );
      }
    };

    // eslint-disable-next-line no-console
    console.log('\n=== Delegated staffing vs. hand-staffing the same slot ===');
    // eslint-disable-next-line no-console
    console.log('(positive "fee saved" = delegation is cheaper; negative "fit cost" = delegation is a worse fit)');
    report('By role', new Map([...byRole].map(([r, t]) => [r as string, t])));
    report('By producer skill', bySkill);

    const all = [...byRole.values()].reduce(
      (acc, t) => ({
        n: acc.n + (t.samples - t.emptyHanded),
        fee: acc.fee + t.feeDelta,
        fit: acc.fit + t.fitDelta,
        matched: acc.matched + t.matchedBest,
      }),
      { n: 0, fee: 0, fit: 0, matched: 0 },
    );
    // eslint-disable-next-line no-console
    console.log(
      `\nOverall: delegation saves ${money(-all.fee / all.n)} a slot and costs ${(-all.fit / all.n).toFixed(1)} points of ` +
        `department fit, landing the fit-optimal head ${((all.matched / all.n) * 100).toFixed(0)}% of the time.\n` +
        `Verdict: ${all.fee < 0 && all.fit < 0 ? 'A REAL TRADE.' : 'NOT A TRADE - retune BRIEF_PRICE_PENALTY / BRIEF_FIT_WEIGHT in data/producers.ts.'}\n`,
    );

    // The two halves of the trade. Either failing means delegation has stopped
    // being a decision and the tuning has to move.
    expect(all.fee).toBeLessThan(0); // cheaper
    expect(all.fit).toBeLessThan(0); // a worse fit
  });
});
