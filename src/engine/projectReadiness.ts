import type { FilmDraft, ProjectWorkspaceSection } from '../types';
import { MANDATORY_TALENT_ROLES } from '../data/talentGeneration';
import { SETTING_ARCHETYPE_PROFILES } from '../data/settings';
import { SETTING_LABELS } from '../data/scriptTagLabels';
import { findAssignedPerson } from '../data/helpers';
import { getDirectorCareer } from './person';
import { effectiveRoleCapacity } from './castRequirements';
import { computeTalentCost, computeProductionBudgetCost } from './cost';
import { computeStaticProductionRisk } from './production';
import { overallSpendT } from './productionDials';
import { explainEffectsStrategy, explainEnvironmentStrategy } from './recommendation';

export type ProjectReadinessIssueCode =
  | 'missing-director'
  | 'missing-lead-cast'
  | 'missing-supporting-cast'
  | 'missing-mandatory-crew'
  | 'production-plan-incomplete'
  | 'cannot-afford-greenlight';

export type ProjectReadinessWarningCode =
  | 'low-cash-reserve'
  | 'director-production-disagreement'
  | 'optional-vfx-supervisor-missing'
  | 'high-production-risk'
  | 'setting-underfunded'
  | 'cast-before-director';

export interface ProjectReadinessIssue {
  code: ProjectReadinessIssueCode | ProjectReadinessWarningCode;
  message: string;
}

export interface SectionReadiness {
  status: 'complete' | 'incomplete' | 'warning';
  detail: string;
}

export interface ProjectReadiness {
  ready: boolean;
  blockers: ProjectReadinessIssue[];
  warnings: ProjectReadinessIssue[];
  sections: {
    castAndCrew: SectionReadiness;
    production: SectionReadiness;
    finance: SectionReadiness;
  };
  /** Where to send the player next to make the most progress toward Greenlight - null once ready. */
  recommendedNextSection: ProjectWorkspaceSection | null;
}

// Crew roles - MANDATORY_TALENT_ROLES minus Director/Lead Actor/Supporting
// Actor, which each get their own dedicated blocker code below so the
// message can name the specific missing role instead of a generic "crew".
const MANDATORY_CREW_ROLES = MANDATORY_TALENT_ROLES.filter(
  (role) => role !== 'Director' && role !== 'Lead Actor' && role !== 'Supporting Actor',
);

// Below this post-Greenlight cash cushion, still-affordable is worth a
// warning (not a blocker - the studio CAN pay, just barely) - an early
// signal before FINISH_PHOTOGRAPHY's own contingency burn can catch the
// studio flat broke mid-shoot.
const LOW_CASH_RESERVE_THRESHOLD = 250_000;

// Average of the four StaticProductionRisk dimensions above which it's
// worth flagging before Greenlight, not just once photography exposes the
// consequences - same 0-100 scale ProductionPlanning.tsx's own risk bars
// already use, just averaged into one number here.
const HIGH_PRODUCTION_RISK_THRESHOLD = 65;

// How far overall spend can trail a Setting Archetype's own production-
// pressure reading before it's worth a dedicated, setting-named warning -
// same 0-1 scale computeStaticProductionRisk's own budgetRisk term already
// compares settingAmbition against spendT with, just a coarser pass/fail
// cut rather than a continuous risk contribution. Deliberately never a
// blocker (see docs/CHARACTER_AND_SETTING_FOUNDATIONS.md section 8 - "the
// player should retain full control") - underfunding an ambitious setting
// is a real, allowed choice, just one the player should see coming.
const SETTING_UNDERFUNDED_GAP = 0.35;

/**
 * The single source of truth for whether a pre-greenlight project is
 * actually ready to greenlight, and what's missing if not - replaces the
 * scattered per-screen `canContinue`/`canAfford` checks the old linear
 * wizard used (components/wizard/HireTalent.tsx, ProductionPlanning.tsx,
 * Greenlight.tsx each computed their own slice of this and only the
 * *next* screen's Continue button ever enforced it). Under the Producer
 * Workspace's free navigation there's no "next screen" to gate on, so this
 * is read directly by the Greenlight button, the workspace nav's per-tab
 * status indicators, and the Overview readiness panel - all three always
 * agree, because all three call this.
 *
 * Blockers make `ready` false and must be cleared before Greenlight is
 * allowed at all (state/studioReducer.ts:GREENLIGHT_PROJECT re-checks this
 * defensively, since the UI is only the first line of defense). Warnings
 * never block - they're informational, surfaced the same way HireTalent's
 * old low-compatibility/temperament notices were.
 */
export function deriveProjectReadiness(draft: FilmDraft, studioCash: number): ProjectReadiness {
  const blockers: ProjectReadinessIssue[] = [];
  const warnings: ProjectReadinessIssue[] = [];

  const talentForRole = (role: (typeof MANDATORY_TALENT_ROLES)[number]) =>
    draft.talent.filter((a) => a.role === role).map((a) => a.person);

  const hasDirector = talentForRole('Director').length >= effectiveRoleCapacity('Director', draft.script).min;
  if (!hasDirector) blockers.push({ code: 'missing-director', message: 'Hire a director.' });

  const hasLeadCast = talentForRole('Lead Actor').length >= effectiveRoleCapacity('Lead Actor', draft.script).min;
  if (!hasLeadCast) blockers.push({ code: 'missing-lead-cast', message: 'Cast your lead role(s).' });

  const hasSupportingCast =
    talentForRole('Supporting Actor').length >= effectiveRoleCapacity('Supporting Actor', draft.script).min;
  if (!hasSupportingCast) blockers.push({ code: 'missing-supporting-cast', message: 'Cast your supporting role(s).' });

  // Casting Redesign, Phase A (docs/DESIGN_REVIEW_casting_redesign.md
  // section 8) - never a blocker (the Producer Workspace's free navigation
  // deliberately doesn't force a fixed order), just a nudge that casting
  // will read as more attractive to actors once a director is attached.
  if (draft.script && !hasDirector && (!hasLeadCast || !hasSupportingCast)) {
    warnings.push({
      code: 'cast-before-director',
      message: "No director attached yet - actors read a studio's pitch more strongly once one is.",
    });
  }

  const missingCrew = MANDATORY_CREW_ROLES.filter(
    (role) => talentForRole(role).length < effectiveRoleCapacity(role, draft.script).min,
  );
  if (missingCrew.length > 0) {
    blockers.push({ code: 'missing-mandatory-crew', message: `Hire your remaining crew: ${missingCrew.join(', ')}.` });
  }

  const hasProductionPlan = draft.productionChoices !== null;
  if (!hasProductionPlan) {
    blockers.push({ code: 'production-plan-incomplete', message: 'Set your production plan.' });
  }

  const talentCost = computeTalentCost(draft.talent);
  const productionCost = hasProductionPlan ? computeProductionBudgetCost(draft.productionChoices!) : 0;
  const contingency = hasProductionPlan ? draft.productionChoices!.contingencyAmount : 0;
  const totalCommitment = talentCost + productionCost + contingency;
  const cashAfter = studioCash - totalCommitment;
  const canAfford = cashAfter >= 0;
  if (!canAfford) blockers.push({ code: 'cannot-afford-greenlight', message: "The studio can't afford this commitment yet." });
  else if (cashAfter < LOW_CASH_RESERVE_THRESHOLD) {
    warnings.push({ code: 'low-cash-reserve', message: 'Cash reserves will be thin after greenlighting.' });
  }

  if (draft.talent.length === 0 || !draft.script) {
    // Nothing hired yet - too early for the optional-crew warning to mean anything.
  } else if (!draft.talent.some((a) => a.role === 'VFX Supervisor')) {
    warnings.push({ code: 'optional-vfx-supervisor-missing', message: 'No VFX Supervisor hired - optional, but this script may want one.' });
  }

  if (draft.script && draft.genre && hasProductionPlan) {
    const risk = computeStaticProductionRisk(draft.talent, draft.script, draft.productionChoices!, draft.genre);
    const avgRisk = (risk.moraleRisk + risk.safetyRisk + risk.technicalComplexity + risk.budgetRisk) / 4;
    if (avgRisk >= HIGH_PRODUCTION_RISK_THRESHOLD) {
      warnings.push({ code: 'high-production-risk', message: 'This plan carries substantial production risk - review the risk profile before greenlighting.' });
    }

    const settingProfile = SETTING_ARCHETYPE_PROFILES[draft.script.primarySetting];
    const settingAmbition = (settingProfile.environmentScale + settingProfile.setConstructionDemand + settingProfile.vfxEnvironmentDemand) / 3;
    const spendT = overallSpendT(draft.productionChoices!);
    if (settingAmbition - spendT >= SETTING_UNDERFUNDED_GAP) {
      warnings.push({
        code: 'setting-underfunded',
        message: `${SETTING_LABELS[draft.script.primarySetting]} is an ambitious setting for this budget - expect lower production quality and added risk unless you spend to match it.`,
      });
    }
  }

  const director = findAssignedPerson(draft.talent, 'Director');
  const directorCareer = director && getDirectorCareer(director);
  if (draft.script && directorCareer) {
    const envBreakdown = explainEnvironmentStrategy(draft.script, directorCareer);
    const fxBreakdown = explainEffectsStrategy(draft.script, directorCareer);
    if (envBreakdown.agreementState === 'disagree' || fxBreakdown.agreementState === 'disagree') {
      warnings.push({ code: 'director-production-disagreement', message: 'Your director and this screenplay disagree on approach.' });
    }
  }

  const castAndCrewComplete = hasDirector && hasLeadCast && hasSupportingCast && missingCrew.length === 0;
  const castAndCrew: SectionReadiness = castAndCrewComplete
    ? { status: 'complete', detail: 'Cast and crew fully hired.' }
    : { status: 'incomplete', detail: 'Still hiring.' };

  const production: SectionReadiness = hasProductionPlan
    ? { status: 'complete', detail: 'Production plan set.' }
    : { status: 'incomplete', detail: 'No production plan yet.' };

  const finance: SectionReadiness = !canAfford
    ? { status: 'incomplete', detail: "Can't afford the current plan." }
    : cashAfter < LOW_CASH_RESERVE_THRESHOLD
      ? { status: 'warning', detail: 'Affordable, but reserves will be thin.' }
      : { status: 'complete', detail: 'Affordable.' };

  let recommendedNextSection: ProjectWorkspaceSection | null = null;
  if (!castAndCrewComplete) recommendedNextSection = 'cast-and-crew';
  else if (!hasProductionPlan) recommendedNextSection = 'production';
  else if (!canAfford) recommendedNextSection = 'finance';

  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
    sections: { castAndCrew, production, finance },
    recommendedNextSection,
  };
}
