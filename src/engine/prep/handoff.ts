// The end of prep (docs/DESIGN_REVIEW_preproduction_realism.md §4.5): every
// problem still standing - never found, carried by choice, or only partly
// fixed - is scheduled as an incident on the shoot day its front is reached
// (the breakdown and the look bite in week one; action and effects on their big
// days). The shoot fires them as recorded events before its own roll for that
// day (shootIncidents.ts). Also the readiness checklist prep shows (04 §12).
import type { CarriedIncident, PhotographyState, PreProductionState, ProductionEvent } from '../../types';
import { PREP_ACTIVITY_FRONTS, PREP_FRONT_LABEL, PREP_FRONT_SHOOT_SHARE, PREP_PROBLEMS, PREP_SOLVED_SEVERITY, PREP_ACTIVITIES, type PrepFront } from '../../data/prep';
import { keyedRoll } from './roll';

export function carriedIncidentsFor(prep: PreProductionState | null | undefined, shootDays: number): CarriedIncident[] {
  if (!prep?.problems) return [];
  return prep.problems
    .filter((p) => p.severity > PREP_SOLVED_SEVERITY)
    .map((p) => {
      const [a, b] = PREP_FRONT_SHOOT_SHARE[p.front];
      const share = a + (b - a) * keyedRoll(`${prep.seed}|shoot|${p.id}`);
      return { day: Math.max(1, Math.min(shootDays, Math.round(share * shootDays))), problemId: p.id, kind: p.kind, severity: p.severity };
    })
    .sort((x, y) => x.day - y.day || x.problemId.localeCompare(y.problemId));
}

/** The recorded shoot event a carried problem becomes. Its delay and overrun are real shoot days and money. */
export function incidentEvent(incident: CarriedIncident, dailyShootBurn: number): ProductionEvent {
  const inc = PREP_PROBLEMS[incident.kind].incident;
  const sev = incident.severity;
  return {
    id: `prep-incident-${incident.problemId}`,
    description: inc.text,
    severity: sev >= 0.6 ? 'high' : sev >= 0.3 ? 'medium' : 'low',
    costDelta: Math.round((inc.overrunShootDays ?? 0) * sev * dailyShootBurn),
    qualityDelta: Math.round(inc.quality * sev * 10) / 10,
    buzzDelta: 0,
    delayDaysDelta: Math.round(inc.delayDays * sev),
    impact: inc.impact,
    escalates: Math.min(1, 0.5 * sev),
  };
}

/** Incidents due on or before this shoot day, and the rest. */
export function dueIncidents(incidents: CarriedIncident[] | undefined, shootDay: number): { due: CarriedIncident[]; rest: CarriedIncident[] } {
  const all = incidents ?? [];
  return { due: all.filter((i) => i.day <= shootDay), rest: all.filter((i) => i.day > shootDay) };
}

export type ReadinessState = 'ready' | 'open' | 'unchecked';

/** The readiness checklist (04 §12): per live front, whether its known problems are answered and its revealing work was done. */
export function readinessChecklist(prep: PreProductionState, liveFronts: PrepFront[]): Array<{ front: PrepFront; label: string; state: ReadinessState }> {
  return liveFronts.map((front) => {
    const open = prep.problems.some((p) => p.front === front && p.foundOnDay !== null && p.resolution === null);
    const activity = PREP_ACTIVITIES.find((a) => PREP_ACTIVITY_FRONTS[a].includes(front));
    const unchecked = activity !== undefined && !prep.activities[activity];
    return { front, label: PREP_FRONT_LABEL[front], state: open ? 'open' : unchecked ? 'unchecked' : 'ready' };
  });
}

/**
 * Fires the carried incidents due on the shoot's next day, if any: they ARE
 * that day's events (the shoot makes no random roll of its own that day). Each
 * one's lost days run the clock and the burn like any shoot event's; its
 * overrun money is the event's cost, charged with the others at release.
 * Null when nothing is due.
 */
export function fireCarriedIncidents(photography: PhotographyState, dailyShootBurn: number): PhotographyState | null {
  const { due, rest } = dueIncidents(photography.carriedIncidents, photography.daysElapsed + 1);
  if (due.length === 0) return null;
  const events = due.map((i) => incidentEvent(i, dailyShootBurn));
  const days = 1 + events.reduce((s, e) => s + e.delayDaysDelta, 0);
  return {
    ...photography,
    carriedIncidents: rest,
    daysElapsed: photography.daysElapsed + days,
    events: [...photography.events, ...events],
    runningCost: photography.runningCost + dailyShootBurn * days,
  };
}

/**
 * A shoot wrapped before some carried problems' days: the scenes they would
 * have hit were still in the script, so the problem lands anyway - shot in a
 * hurry without the fix, or cut. Each becomes its event with no lost days (the
 * shoot is over) but its quality and overrun money intact, so an early wrap is
 * not a way round them (Phase 4 review).
 */
export function unfiredAtWrap(photography: PhotographyState, dailyShootBurn: number): ProductionEvent[] {
  return (photography.carriedIncidents ?? []).map((i) => {
    const e = incidentEvent(i, dailyShootBurn);
    return { ...e, delayDaysDelta: 0, description: `Never fixed, and the scenes it hit were rushed: ${e.description.charAt(0).toLowerCase()}${e.description.slice(1)}` };
  });
}
