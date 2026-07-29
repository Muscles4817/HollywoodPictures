// Workstream I, Phase 2 - the live Cast & Crew staffing board. A pure derivation
// of every role's staffing state from the draft, built to be EXTENSIBLE rather
// than casting-specific: every role (actor character or crew head) reports the
// same lifecycle, so the later production-requirements systems (suitability,
// compatibility, department workload/problems) can hang new sections off the
// same rows without reshaping the hub. Extension points are left explicitly
// undefined here rather than mocked with placeholder data.
import type { FilmDraft, GameDay, ProductionRole, Money, StaffingEvent } from '../types';
import { MANDATORY_TALENT_ROLES, OPTIONAL_TALENT_ROLES } from '../data/talentGeneration';
import { TALENT_PRESENTATION, type RoleCategory } from '../data/talentPresentation';
import { effectiveRoleCapacity } from '../engine/castRequirements';
import { assignmentCost } from '../engine/person';

// The shared staffing lifecycle every role moves through. Crew skip the middle
// stages (they're an instant hire), but they report the SAME vocabulary, so the
// hub renders one consistent lifecycle for the whole production.
export type StaffingStage =
  | 'unstaffed'   // nothing started
  | 'searching'   // a call is open / a shortlist exists, no applicants yet
  | 'candidates'  // applicants/contenders available to consider
  | 'evaluating'  // auditioning or comparing
  | 'negotiating' // an offer is live (a counter is on the table)
  | 'attached';   // filled

export const STAFFING_STAGE_ORDER: StaffingStage[] = ['unstaffed', 'searching', 'candidates', 'evaluating', 'negotiating', 'attached'];

// Warnings surfaced on a row. `over-budget` is derived now; `schedule` and
// `expiring` are recognised secondary states whose data lands with later phases
// (real availability windows; counter-offer expiry) - listed here so the hub can
// render them the moment those systems populate them, no shape change needed.
export type StaffingWarning = 'over-budget' | 'schedule' | 'expiring';

export interface StaffingCounts {
  applicants: number;   // open-call applicants waiting
  shortlist: number;    // contenders tracked
  auditions: number;    // screen tests arranged
  auditionsReady: number; // of those, completed
  negotiations: number; // live offers out (a counter awaiting your response)
  counters: number;     // of those, ones that countered
}

export interface StaffingRow {
  key: string;
  label: string;
  role: ProductionRole;
  category: RoleCategory;
  /** For an actor row, the Character being cast (drives navigation into the CastingDrawer). */
  characterId?: string;
  optional: boolean;
  stage: StaffingStage;
  /** Names of whoever's attached in this slot (usually 0 or 1; multi for a shared crew slot). */
  attached: string[];
  /** An Open Casting call is open for this character. */
  activeSearch: boolean;
  counts: StaffingCounts;
  warnings: StaffingWarning[];
  budget: { planned: Money; committed: Money; remaining: Money; locked: boolean };
  // --- Workstream II extension points ---------------------------------------
  // Deliberately absent until those systems exist. The row renderer shows each
  // section only when present, so wiring them later needs no hub change and no
  // fake data now.
  suitability?: unknown;
  compatibility?: unknown;
  workload?: unknown;
}

export interface StaffingBoard {
  rows: StaffingRow[];
  /** Days the shoot start is pushed from today to wait on booked talent (Phase 6); 0 = as soon as cast. */
  plannedStartOffsetDays: number;
  totalPlanned: Money;
  totalCommitted: Money;
  totalRemaining: Money;
}

// Non-actor heads, in a sensible reading order: Director first, then the rest of
// the mandatory crew, then the optional roles.
const CREW_ROLE_ORDER: ProductionRole[] = [
  ...MANDATORY_TALENT_ROLES.filter((r) => r !== 'Lead Actor' && r !== 'Supporting Actor'),
  ...OPTIONAL_TALENT_ROLES,
];

function stageFor(attached: number, counts: StaffingCounts, activeSearch: boolean): StaffingStage {
  if (attached > 0) return 'attached';
  if (counts.negotiations > 0) return 'negotiating';
  if (counts.auditions > 0 || counts.shortlist >= 2) return 'evaluating';
  if (counts.applicants > 0) return 'candidates';
  if (activeSearch || counts.shortlist >= 1) return 'searching';
  return 'unstaffed';
}

const NO_COUNTS: StaffingCounts = { applicants: 0, shortlist: 0, auditions: 0, auditionsReady: 0, negotiations: 0, counters: 0 };

export function deriveStaffingBoard(draft: FilmDraft, totalDays: GameDay): StaffingBoard {
  const script = draft.script;
  const perHead = (role: ProductionRole): Money => draft.talentTargetPriceByRole[role] ?? 0;
  const locked = new Set(draft.lockedRoleBudgets ?? []);
  const rows: StaffingRow[] = [];

  // Actor rows - one per castable Character (per-character casting).
  const characters = script?.cast.filter((c) => c.prominence === 'Lead' || c.prominence === 'Supporting') ?? [];
  for (const character of characters) {
    const role: ProductionRole = character.prominence === 'Lead' ? 'Lead Actor' : 'Supporting Actor';
    const attachedAssignment = draft.talent.find((a) => a.characterId === character.id);
    const call = (draft.castingCalls ?? []).find((c) => c.characterId === character.id);
    const auditions = (draft.auditions ?? []).filter((a) => a.characterId === character.id);
    const negotiations = (draft.negotiations ?? []).filter((n) => n.characterId === character.id && n.status === 'countered');
    const counts: StaffingCounts = {
      applicants: call?.applicants.length ?? 0,
      shortlist: (draft.shortlist ?? []).filter((s) => s.characterId === character.id).length,
      auditions: auditions.length,
      auditionsReady: auditions.filter((a) => totalDays >= a.readyOnDay).length,
      negotiations: negotiations.length,
      counters: negotiations.length,
    };
    const attached = attachedAssignment ? [attachedAssignment.person.identity.name] : [];
    const planned = perHead(role); // one head per character
    const committed = attachedAssignment ? assignmentCost(attachedAssignment) : 0;
    // Over budget if the signed fee, or a live counter you'd need to meet, tops the allocation.
    const highestCounter = negotiations.reduce((m, n) => Math.max(m, n.counterSalary ?? 0), 0);
    const warnings: StaffingWarning[] = [];
    if (committed > planned || highestCounter > planned) warnings.push('over-budget');
    rows.push({
      key: character.id,
      label: `${character.name} (${character.prominence})`,
      role,
      category: 'actor',
      characterId: character.id,
      optional: false,
      stage: stageFor(attached.length, counts, !!call),
      attached,
      activeSearch: !!call,
      counts,
      warnings,
      budget: { planned, committed, remaining: Math.max(0, planned - committed), locked: locked.has(role) },
    });
  }

  // Director + crew rows - one per head slot. Instant hire, so only unstaffed vs
  // attached, but reported on the same lifecycle.
  for (const role of CREW_ROLE_ORDER) {
    const category = TALENT_PRESENTATION[role].category;
    const attachedAssignments = draft.talent.filter((a) => a.role === role);
    const capacity = effectiveRoleCapacity(role, script).max;
    const planned = perHead(role) * capacity;
    const committed = attachedAssignments.reduce((sum, a) => sum + assignmentCost(a), 0);
    const attached = attachedAssignments.map((a) => a.person.identity.name);
    const warnings: StaffingWarning[] = committed > planned && committed > 0 ? ['over-budget'] : [];
    rows.push({
      key: role,
      label: role,
      role,
      category,
      optional: OPTIONAL_TALENT_ROLES.includes(role),
      stage: attached.length > 0 ? 'attached' : 'unstaffed',
      attached,
      activeSearch: false,
      counts: NO_COUNTS,
      warnings,
      budget: { planned, committed, remaining: Math.max(0, planned - committed), locked: locked.has(role) },
    });
  }

  const totalPlanned = rows.reduce((s, r) => s + r.budget.planned, 0);
  const totalCommitted = rows.reduce((s, r) => s + r.budget.committed, 0);
  return {
    rows,
    plannedStartOffsetDays: draft.plannedStartOffsetDays ?? 0,
    totalPlanned,
    totalCommitted,
    totalRemaining: Math.max(0, totalPlanned - totalCommitted),
  };
}

// Phase 2b - how many staffing events the feed keeps (the most recent). Small: a
// curated read of what just changed, not an audit trail.
export const STAFFING_LOG_CAP = 40;

/**
 * Append a meaningful staffing event to the draft's feed, capping to the most
 * recent STAFFING_LOG_CAP. Pure. Callers decide what counts as meaningful - this
 * only ever records what it's handed (never trivial UI churn).
 */
export function appendStaffingEvent(draft: FilmDraft, event: StaffingEvent): FilmDraft {
  const log = [...(draft.staffingLog ?? []), event];
  return { ...draft, staffingLog: log.length > STAFFING_LOG_CAP ? log.slice(log.length - STAFFING_LOG_CAP) : log };
}

/** Labels for each lifecycle stage, player-facing. */
export const STAFFING_STAGE_LABELS: Record<StaffingStage, string> = {
  unstaffed: 'Unstaffed',
  searching: 'Searching',
  candidates: 'Candidates',
  evaluating: 'Evaluating',
  negotiating: 'Negotiating',
  attached: 'Attached',
};
