import { useEffect, useState } from 'react';
import { useStudio } from '../../state/StudioContext';
import { SHOOTING_BUDGET_RANGE } from '../../data/production';
import { shootingBudgetDescription, runtimeDescription } from '../../engine/productionDials';
import { logAmount } from '../../engine/interpolate';
import { GENRE_PROFILES } from '../../data/genres';
import { computeProductionBudgetCost, computeDailyShootBurn } from '../../engine/cost';
import { computeRecommendedShootDays, computeStaticProductionRisk } from '../../engine/production';
import { topCreativeClash } from '../../engine/creativeTension';
import { adaptRecommendationsToProductionChoices } from '../../engine/productionChoicesAdapter';
import {
  explainEffectsStrategy,
  explainEnvironmentStrategy,
  recommendEffectsAmbition,
  recommendEnvironmentAmbition,
  totalVariationDistance,
  type StrategyBreakdown,
} from '../../engine/recommendation';
import { synthesizeProductionIdentity, findBiggestTension } from '../../engine/productionIdentity';
import { computeCommittedSpend, deriveFocusedDraft } from '../../state/selectors';
import { findAssignedPerson } from '../../data/helpers';
import { getDirectorCareer, getCrewCareer } from '../../engine/person';
import {
  computeSetsAmbition,
  computeSetsFacet,
  designerAsk,
  designerConfidence,
  setsOutlook,
  NO_DESIGNER_SKILL,
  type DesignerConfidence,
  type SetsOutlook,
} from '../../engine/setsFacet';
import { computeVfxFacet, vfxOutlook, vfxSupervisorSkill } from '../../engine/vfxFacet';
import { computePracticalFacet, practicalOutlook, NO_STUNT_TEAM_SKILL } from '../../engine/practicalFacet';
import { facetConfidence, type FacetOutlook } from '../../engine/facetModel';
import { stuntTeamById, stuntTeamEffectiveSkill, stuntTeamFitsGenre } from '../../engine/stuntTeams';
import { STUNT_SPECIALTY_LABEL } from '../../data/stuntTeams';
import { DistributionEditor } from '../common/DistributionEditor';
import { RangeSlider } from '../common/RangeSlider';
import { Button } from '../common/Button';
import { ScoreBar } from '../common/ScoreBar';
import { Money, formatMoney } from '../common/Money';
import { ScriptSummaryCard } from '../common/ScriptSummaryCard';
import type {
  Distribution,
  EffectsMethodKey,
  EnvironmentMethodKey,
  NormalizedScalar,
  ProductionChoices,
  Recommendation,
  Script,
  TalentAssignment,
} from '../../types';

const DEFAULT_SHOOTING_BUDGET = logAmount(0.5, SHOOTING_BUDGET_RANGE);
// A modest starting buffer (~15% of the way up the log range) so new players
// begin with real downside protection they can dial up or down.
const DEFAULT_CONTINGENCY_RESERVE = logAmount(0.15, SHOOTING_BUDGET_RANGE);
const DEFAULT_RUNTIME_INTENSITY = 0.5;

// Production Redesign, Sets facet — the designer's live confidence read,
// rendered in character as the conversation's qualitative forecast.
const CONFIDENCE_PRESENTATION: Record<DesignerConfidence, { label: string; color: string }> = {
  confident: { label: 'Confident we can deliver this', color: 'var(--green, #2e7d32)' },
  workable: { label: 'We can work with this', color: 'var(--text-muted)' },
  'a-stretch': { label: 'This is a stretch — no promises', color: 'var(--warn, #b8860b)' },
  'set-up-to-fail': { label: "We're set up to fail here", color: 'var(--danger)' },
};

function ambitionWord(a: number): string {
  return a >= 75 ? 'a hugely demanding' : a >= 50 ? 'a demanding' : a >= 30 ? 'a moderate' : 'a modest';
}

/**
 * The designer's boom-or-bust read, in their own voice (spec §3.3). A tight
 * spread reads as dependable and needs no gamble framing (returns null). A
 * moderate/wide spread is a bet whose odds the designer's skill tips — a strong
 * designer makes it worth taking, a weak one makes it a warning.
 */
function describeSetsOutlook(outlook: SetsOutlook, designerName: string | undefined): string | null {
  if (outlook.spread === 'tight') return null;
  const who = designerName ?? 'The art department';
  const gamble = outlook.spread === 'wide' ? 'a real gamble' : 'no sure thing';
  if (outlook.lean === 'promising') {
    return `${who}: “This is ${gamble} — but give me this and if it comes together it'll be a highlight. I'll take that bet.” A strong designer is who you want swinging for it.`;
  }
  if (outlook.lean === 'precarious') {
    return `This is ${gamble}, and the art department isn't equipped to tip it your way — if the shoot fights the build, it will show. A stronger Production Designer would make the same bet worth taking.`;
  }
  return `${who}: “This is ${gamble} — it could come together beautifully or slip, depending on how the shoot goes.”`;
}

/**
 * A generic head's boom-or-bust read (spec §3.3), used for the VFX and Practical
 * conversation cards. Same shape as describeSetsOutlook, parameterised by voice:
 * a tight plan needs no gamble framing (null); a stretched one is a bet the
 * head's skill tips. `name` is the hired head (or a generic stand-in).
 */
function describeHeadOutlook(outlook: FacetOutlook, opts: { name: string; unmanaged: string; strongHire: string }): string | null {
  if (outlook.spread === 'tight') return null;
  const gamble = outlook.spread === 'wide' ? 'a real gamble' : 'no sure thing';
  if (outlook.lean === 'promising') {
    return `${opts.name}: “This is ${gamble} — but with this plan, if it comes together it'll be a highlight. I'll take that bet.”`;
  }
  if (outlook.lean === 'precarious') {
    return `This is ${gamble}, and ${opts.unmanaged} can't tip it your way — if the shoot fights it, it'll show. ${opts.strongHire}`;
  }
  return `${opts.name}: “This is ${gamble} — it could come together or slip, depending on how the shoot goes.”`;
}

/** A qualitative word for a head's skill — presentation stays qualitative (CLAUDE.md), never the raw number. */
function skillWord(skill: number): string {
  return skill >= 80 ? 'Elite' : skill >= 62 ? 'Seasoned' : skill >= 45 ? 'Capable' : 'Journeyman';
}

const ENVIRONMENT_METHOD_KEYS: readonly EnvironmentMethodKey[] = ['studio', 'location', 'digital'];
const EFFECTS_METHOD_KEYS: readonly EffectsMethodKey[] = ['practical', 'digital'];
const ENVIRONMENT_LABELS: Record<EnvironmentMethodKey, string> = { studio: 'Studio', location: 'Location', digital: 'Digital' };
const EFFECTS_LABELS: Record<EffectsMethodKey, string> = { practical: 'Practical', digital: 'Digital' };

// Below this, a card's Strategy value and the recommendation are close
// enough to call "following it" rather than "adjusted" - a small buffer
// rather than exact equality, since dragging always produces a fresh
// object even for a barely-perceptible move.
const FOLLOWING_TOLERANCE = 0.03;

// Below this Strategy confidence (see engine/recommendation.ts), the card's
// Strategy section renders visually muted - the same false-precision
// principle the engine's own damping encodes, carried into the UI's visual
// weight rather than left as a footnote only.
const MUTED_CONFIDENCE_THRESHOLD = 0.5;

/** Picks a rough qualitative label for a 0-1 "pace" dial without needing bespoke text for every point. */
export function nearestLabel(t: number, labels: readonly [string, string, string]): string {
  if (t < 1 / 3) return labels[0];
  if (t < 2 / 3) return labels[1];
  return labels[2];
}

function ambitionLabel(value: NormalizedScalar): string {
  if (value >= 0.65) return 'Substantial';
  if (value >= 0.35) return 'Moderate';
  return 'Minimal';
}

/** Cost/schedule this card's current values are responsible for - "current plan" minus "current plan with this card's contribution zeroed out," the same counterfactual idea the recommendation engine already uses for reason-ordering. */
function consequenceOf(current: ProductionChoices, withoutThisCard: ProductionChoices, talent: TalentAssignment[], script: Script) {
  const costDelta = computeProductionBudgetCost(current) - computeProductionBudgetCost(withoutThisCard);
  const daysDelta = computeRecommendedShootDays(talent, script, current) - computeRecommendedShootDays(talent, script, withoutThisCard);
  return { costDelta, daysDelta };
}

interface RecommendationCardProps<K extends string> {
  title: string;
  order: readonly K[];
  labels: Record<K, string>;
  breakdown: StrategyBreakdown<K>;
  strategyValue: Distribution<K>;
  onStrategyChange: (next: Distribution<K>) => void;
  ambitionRec: Recommendation<NormalizedScalar>;
  ambitionValue: NormalizedScalar;
  onAmbitionChange: (next: NormalizedScalar) => void;
  consequence: { costDelta: number; daysDelta: number };
}

function RecommendationCard<K extends string>({
  title,
  order,
  labels,
  breakdown,
  strategyValue,
  onStrategyChange,
  ambitionRec,
  ambitionValue,
  onAmbitionChange,
  consequence,
}: RecommendationCardProps<K>) {
  const [reasonsExpanded, setReasonsExpanded] = useState(false);
  const [ambitionExpanded, setAmbitionExpanded] = useState(false);

  const followingStrategy = totalVariationDistance(strategyValue, breakdown.recommendation.value) < FOLLOWING_TOLERANCE;
  const followingAmbition = Math.abs(ambitionValue - ambitionRec.value) < FOLLOWING_TOLERANCE;
  const adjusted = !followingStrategy || !followingAmbition;
  const muted = breakdown.confidence < MUTED_CONFIDENCE_THRESHOLD;

  const reasons = breakdown.recommendation.reasons;
  const visibleReasons = reasonsExpanded ? reasons : reasons.slice(0, 2);
  const hiddenReasonCount = reasons.length - visibleReasons.length;

  return (
    <div className={`card stack ${muted ? 'recommendation-card-muted' : ''}`}>
      <div className="recommendation-card-header">
        <h2 style={{ margin: 0 }}>{title}</h2>
        <span className="badge">{adjusted ? 'Adjusted' : 'Following Recommendation'}</span>
      </div>

      <div>
        <div className="stat-label">Recommended</div>
        <DistributionEditor order={order} value={breakdown.recommendation.value} labels={labels} disabled />
      </div>

      <div>
        <div className="stat-label">Why?</div>
        <ul className="recommendation-reasons">
          {visibleReasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
        {hiddenReasonCount > 0 && (
          <Button className="btn-sm" variant="text" onClick={() => setReasonsExpanded(true)}>
            {hiddenReasonCount} more reason{hiddenReasonCount > 1 ? 's' : ''}
          </Button>
        )}
      </div>

      <div>
        <div className="row-between">
          <div className="stat-label">Your Plan</div>
          {!followingStrategy && (
            <Button className="btn-sm" variant="text" onClick={() => onStrategyChange(breakdown.recommendation.value)}>
              Reset
            </Button>
          )}
        </div>
        <DistributionEditor
          order={order}
          value={strategyValue}
          labels={labels}
          onChange={onStrategyChange}
          recommended={breakdown.recommendation.value}
        />
      </div>

      <div>
        <button
          className="row-between"
          style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', font: 'inherit' }}
          onClick={() => setAmbitionExpanded((e) => !e)}
        >
          <span className="stat-label">Investment: {ambitionLabel(ambitionValue)}</span>
          <span aria-hidden>{ambitionExpanded ? '▾' : '▸'}</span>
        </button>
        {ambitionExpanded && (
          <div className="stack" style={{ marginTop: 8 }}>
            <div className="stat-label">Recommended: {ambitionLabel(ambitionRec.value)}</div>
            <ul className="recommendation-reasons">
              {ambitionRec.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>

            <div className="row-between">
              <div className="stat-label">Your Plan</div>
              {!followingAmbition && (
                <Button className="btn-sm" variant="text" onClick={() => onAmbitionChange(ambitionRec.value)}>
                  Reset
                </Button>
              )}
            </div>
            <input
              type="range"
              className="tier-slider"
              min={0}
              max={100}
              step={1}
              value={Math.round(ambitionValue * 100)}
              onChange={(e) => onAmbitionChange(Number(e.target.value) / 100)}
              aria-label={`${title} investment level`}
            />
            <div className="tier-slider-ticks">
              <span>Minimal</span>
              <span>Substantial</span>
            </div>
          </div>
        )}
      </div>

      <div className="recommendation-consequence">
        This choice: <Money amount={consequence.costDelta} />
        {consequence.daysDelta !== 0 && (
          <>
            {' '}
            &middot; {consequence.daysDelta > 0 ? '+' : ''}
            {consequence.daysDelta} shoot days
          </>
        )}
      </div>
    </div>
  );
}

export function ProductionPlanning() {
  const { state, dispatch } = useStudio();
  const draft = deriveFocusedDraft(state)!;
  const script = draft.script!;
  const genre = draft.genre!;
  const director = findAssignedPerson(draft.talent, 'Director');
  const directorCareer = director && getDirectorCareer(director);

  const envBreakdown = directorCareer ? explainEnvironmentStrategy(script, directorCareer) : null;
  const fxBreakdown = directorCareer ? explainEffectsStrategy(script, directorCareer) : null;
  const envAmbitionRec = recommendEnvironmentAmbition(script);
  const fxAmbitionRec = recommendEffectsAmbition(script);

  const environmentStrategyOrNull = draft.environmentStrategy ?? envBreakdown?.recommendation.value ?? null;
  const environmentAmbition = draft.environmentAmbition ?? envAmbitionRec.value;
  const effectsStrategyOrNull = draft.effectsStrategy ?? fxBreakdown?.recommendation.value ?? null;
  const effectsAmbition = draft.effectsAmbition ?? fxAmbitionRec.value;
  const shootingBudgetAmount = draft.productionChoices?.shootingBudgetAmount ?? DEFAULT_SHOOTING_BUDGET;
  const contingencyReserveAmount = draft.productionChoices?.contingencyReserveAmount ?? DEFAULT_CONTINGENCY_RESERVE;
  const runtimeIntensity = draft.productionChoices?.runtimeIntensity ?? DEFAULT_RUNTIME_INTENSITY;

  // Production Redesign, Sets facet: the Production Designer, the script's design
  // ambition, and the designer's build ask (money + prep days). designPrepDays is
  // the facet's TIME lever; absent, it defaults to the designer's recommendation.
  const setsAmbition = computeSetsAmbition(script);
  const productionDesigner = findAssignedPerson(draft.talent, 'Production Designer');
  const designerSkill = (productionDesigner && getCrewCareer(productionDesigner, 'Production Designer')?.skill) ?? NO_DESIGNER_SKILL;
  const designerAskValue = designerAsk(setsAmbition, designerSkill);
  const designPrepDays = draft.productionChoices?.designPrepDays ?? designerAskValue.neededDays;

  // Seed the draft with the recommendation as a starting point the first
  // time this screen is visited - so every other screen reading the draft
  // sees real values from the first render, same reasoning the old
  // DEFAULT_CHOICES seed had, just following the recommendation instead of
  // a flat midpoint. Hooks must run unconditionally (rules of hooks), so
  // the "no director" guard below has to come after this, not before -
  // this effect just no-ops if there's genuinely nothing to seed yet.
  useEffect(() => {
    if (!draft.environmentStrategy && environmentStrategyOrNull && effectsStrategyOrNull) {
      dispatch({
        type: 'SET_PRODUCTION_PLAN',
        environmentStrategy: environmentStrategyOrNull,
        environmentAmbition,
        effectsStrategy: effectsStrategyOrNull,
        effectsAmbition,
        shootingBudgetAmount,
        contingencyReserveAmount,
        runtimeIntensity,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guaranteed by Hire Talent (Director is mandatory), but guard rather than
  // assume - a defensive render instead of a crash if that ever changes.
  if (!director || !envBreakdown || !fxBreakdown || !environmentStrategyOrNull || !effectsStrategyOrNull) {
    return (
      <div className="stack">
        <p>No director hired yet - hire one from the Cast & Crew tab first.</p>
      </div>
    );
  }

  // Rebind to explicitly non-null consts - TS's control-flow narrowing from
  // the guard above doesn't carry into updatePlan's nested closure below,
  // even though these are never reassigned.
  const environmentStrategy: Distribution<EnvironmentMethodKey> = environmentStrategyOrNull;
  const effectsStrategy: Distribution<EffectsMethodKey> = effectsStrategyOrNull;

  function updatePlan(overrides: {
    environmentStrategy?: Distribution<EnvironmentMethodKey>;
    environmentAmbition?: NormalizedScalar;
    effectsStrategy?: Distribution<EffectsMethodKey>;
    effectsAmbition?: NormalizedScalar;
    shootingBudgetAmount?: number;
    contingencyReserveAmount?: number;
    runtimeIntensity?: number;
    designPrepDays?: number;
  }) {
    dispatch({
      type: 'SET_PRODUCTION_PLAN',
      environmentStrategy,
      environmentAmbition,
      effectsStrategy,
      effectsAmbition,
      shootingBudgetAmount,
      contingencyReserveAmount,
      runtimeIntensity,
      designPrepDays,
      ...overrides,
    });
  }

  const currentChoices: ProductionChoices =
    draft.productionChoices ??
    adaptRecommendationsToProductionChoices(environmentAmbition, effectsStrategy, effectsAmbition, shootingBudgetAmount, runtimeIntensity, contingencyReserveAmount);

  // The Sets facet as it stands with the current money (setQualityAmount) + the
  // granted prep time + the designer's skill - drives the designer's live
  // confidence read below.
  const setsFacet = computeSetsFacet({ ambition: setsAmbition, moneyAmount: currentChoices.setQualityAmount, prepDays: designPrepDays, designerSkill });
  const setsConfidence = designerConfidence(setsFacet);
  // The boom-or-bust read: an over-reaching plan becomes a gamble the designer's
  // skill tips (spec §3.3). Only voiced when the plan actually is a gamble (the
  // spread isn't tight); a comfortably-funded build needs no such warning.
  const setsOutlookText = describeSetsOutlook(setsOutlook(setsFacet, designerSkill), productionDesigner?.identity.name);

  // VFX facet (Production Redesign) — the VFX Supervisor's live read on the
  // current VFX plan (money from the effects allocation; post-time not a lever yet).
  const vfxSupervisor = findAssignedPerson(draft.talent, 'VFX Supervisor');
  const vfxSkill = vfxSupervisorSkill(draft.talent);
  const vfxFacet = computeVfxFacet(currentChoices.vfxAmount, draft.talent, genre, script);
  const vfxConf = facetConfidence(vfxFacet);
  const vfxOutlookText = describeHeadOutlook(vfxOutlook(vfxFacet, vfxSkill), {
    name: vfxSupervisor?.identity.name ?? 'The VFX vendor',
    unmanaged: 'an unmanaged, outsourced pipeline',
    strongHire: 'A VFX Supervisor would make the same bet worth taking.',
  });

  // Practical Effects facet — the hired Stunt Team's read. Time is filming time,
  // unknown at planning (neutral), money is the practical allocation.
  const stuntTeam = stuntTeamById(state.stuntTeamPool, draft.stuntTeamId);
  const stuntTeamSkill = stuntTeam ? stuntTeamEffectiveSkill(stuntTeam, genre) : NO_STUNT_TEAM_SKILL;
  const practicalFacet = computePracticalFacet(currentChoices.practicalEffectsAmount, genre, script, 1, stuntTeamSkill);
  const practicalConf = facetConfidence(practicalFacet);
  const practicalOutlookText = describeHeadOutlook(practicalOutlook(practicalFacet, stuntTeamSkill), {
    name: stuntTeam?.name ?? 'The pickup stunt crew',
    unmanaged: 'an ad-hoc stunt crew',
    strongHire: 'A dedicated Stunt Team would make the same bet worth taking.',
  });
  const stuntTeamOptions = [...(state.stuntTeamPool ?? [])].sort((a, b) => b.skill - a.skill);

  const estimatedCost = computeProductionBudgetCost(currentChoices);
  const canAfford = state.studio.cash - computeCommittedSpend(draft, state.producerPool ?? [], state.stuntTeamPool ?? []) >= 0;
  const genreProfile = GENRE_PROFILES[genre];
  const recommendedDays = computeRecommendedShootDays(draft.talent, script, currentChoices);
  const dailyShootCost = computeDailyShootBurn(currentChoices.shootingBudgetAmount, recommendedDays);
  const totalEstimatedCost = estimatedCost + currentChoices.shootingBudgetAmount + (currentChoices.contingencyReserveAmount ?? 0);
  const staticRisk = computeStaticProductionRisk(draft.talent, script, currentChoices, genre);
  // The specific clashing pairing behind an elevated Morale Risk, if any -
  // named so the risk is legible before greenlight, not just a bar (SIMULATION_PHILOSOPHY.md
  // Principle 3). Only surfaced when the friction is real (a meaningful tension).
  const creativeClash = topCreativeClash(draft.talent);
  const notableClash = creativeClash && creativeClash.tension >= 30 ? creativeClash : null;

  const identity = synthesizeProductionIdentity(script, envBreakdown, fxBreakdown);
  const biggestTension = findBiggestTension([
    { label: 'Environment Strategy', agreementState: envBreakdown.agreementState, distance: envBreakdown.distance },
    { label: 'Effects Strategy', agreementState: fxBreakdown.agreementState, distance: fxBreakdown.distance },
  ]);

  const environmentConsequence = consequenceOf(
    currentChoices,
    adaptRecommendationsToProductionChoices(0, effectsStrategy, effectsAmbition, shootingBudgetAmount, runtimeIntensity, contingencyReserveAmount),
    draft.talent,
    script,
  );
  const effectsConsequence = consequenceOf(
    currentChoices,
    adaptRecommendationsToProductionChoices(environmentAmbition, effectsStrategy, 0, shootingBudgetAmount, runtimeIntensity, contingencyReserveAmount),
    draft.talent,
    script,
  );

  return (
    <div className="stack">
      <h1>Production Planning</h1>
      <ScriptSummaryCard script={script} />

      <p className="production-identity">{identity}</p>

      {biggestTension ? (
        <div className="card production-tension">
          <strong>Biggest Tension:</strong> your director and this screenplay disagree on {biggestTension.label}.
          See that card below for the details.
        </div>
      ) : (
        <div className="card production-tension-aligned">The team is broadly aligned on approach - no major creative tensions to resolve.</div>
      )}

      <RecommendationCard
        title="Environment Strategy"
        order={ENVIRONMENT_METHOD_KEYS}
        labels={ENVIRONMENT_LABELS}
        breakdown={envBreakdown}
        strategyValue={environmentStrategy}
        onStrategyChange={(next) => updatePlan({ environmentStrategy: next })}
        ambitionRec={envAmbitionRec}
        ambitionValue={environmentAmbition}
        onAmbitionChange={(next) => updatePlan({ environmentAmbition: next })}
        consequence={environmentConsequence}
      />

      {/* Production Design conversation (Production Redesign, Sets facet) - the
          designer reads the script's ambition, states an ask, and reacts as you
          move the design budget (Environment Ambition, above) and prep time. */}
      <div className="card stack">
        <div className="row-between">
          <h3 style={{ margin: 0 }}>Production Design</h3>
          <span style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>
            {productionDesigner ? productionDesigner.identity.name : 'No Production Designer hired'}
          </span>
        </div>
        <p style={{ margin: 0 }}>
          {productionDesigner
            ? `${productionDesigner.identity.name} is running the look of the film — sets, locations, dressing, props.`
            : 'With no Production Designer, an unmanaged art department handles the look — workable, rarely inspired. Hire one from the Cast & Crew tab to get the most out of your design budget and prep time.'}{' '}
          This is {ambitionWord(setsAmbition)} world to build. To hit it comfortably they'd want around{' '}
          <Money amount={designerAskValue.neededMoney} /> of design budget and about {designerAskValue.neededDays} days of prep.
          Trading budget for prep time (or the reverse) is the lever — on a modest film a skilled designer can make a lean
          budget sing given the weeks, but a spectacle genuinely needs the spend.
        </p>
        <RangeSlider
          label="Design Prep Time"
          min={3}
          max={Math.max(designerAskValue.neededDays * 2, 24)}
          value={designPrepDays}
          onChange={(v) => updatePlan({ designPrepDays: Math.round(v) })}
          formatValue={(v) => `${Math.round(v)} days`}
          description="Longer prep lets the designer realise more of the build — but every prep day burns overhead and pushes your release later."
          lowLabel="Rushed"
          highLabel="Ample"
        />
        <p style={{ margin: 0, fontWeight: 600, color: CONFIDENCE_PRESENTATION[setsConfidence].color }}>
          {productionDesigner ? productionDesigner.identity.name : 'The art department'}: “{CONFIDENCE_PRESENTATION[setsConfidence].label}.”
        </p>
        {setsOutlookText && (
          <p style={{ margin: 0, fontSize: '0.9em', color: 'var(--text-muted)' }}>{setsOutlookText}</p>
        )}
      </div>

      <RecommendationCard
        title="Effects Strategy"
        order={EFFECTS_METHOD_KEYS}
        labels={EFFECTS_LABELS}
        breakdown={fxBreakdown}
        strategyValue={effectsStrategy}
        onStrategyChange={(next) => updatePlan({ effectsStrategy: next })}
        ambitionRec={fxAmbitionRec}
        ambitionValue={effectsAmbition}
        onAmbitionChange={(next) => updatePlan({ effectsAmbition: next })}
        consequence={effectsConsequence}
      />

      {/* Visual Effects conversation (Production Redesign, VFX facet) - the VFX
          Supervisor reads the current effects plan and gives a confidence + a
          boom-or-bust outlook. The money is the digital slice of the effects
          allocation above; the VFX Supervisor is hired on the Cast & Crew tab. */}
      <div className="card stack">
        <div className="row-between">
          <h3 style={{ margin: 0 }}>Visual Effects</h3>
          <span style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>
            {vfxSupervisor ? `${vfxSupervisor.identity.name} · ${skillWord(vfxSkill)}` : 'No VFX Supervisor hired'}
          </span>
        </div>
        <p style={{ margin: 0 }}>
          {vfxSupervisor
            ? `${vfxSupervisor.identity.name} is supervising the digital work.`
            : 'With no VFX Supervisor, the digital work is an unmanaged, outsourced pipeline — rougher than a supervised one. Hire one on the Cast & Crew tab to get more from the same VFX spend.'}{' '}
          How convincing the effects read depends on the digital spend (your Effects Strategy and Ambition, above) against how much this film leans on VFX.
        </p>
        <p style={{ margin: 0, fontWeight: 600, color: CONFIDENCE_PRESENTATION[vfxConf].color }}>
          {vfxSupervisor ? vfxSupervisor.identity.name : 'The VFX vendor'}: “{CONFIDENCE_PRESENTATION[vfxConf].label}.”
        </p>
        {vfxOutlookText && <p style={{ margin: 0, fontSize: '0.9em', color: 'var(--text-muted)' }}>{vfxOutlookText}</p>}
      </div>

      {/* Stunts & Practical Effects conversation (Production Redesign, Practical
          facet). The head is a contracted Stunt Team chosen here — a specialty
          that fits the film's genre lifts their effective skill. */}
      <div className="card stack">
        <div className="row-between">
          <h3 style={{ margin: 0 }}>Stunts &amp; Practical Effects</h3>
          <span style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>
            {stuntTeam ? `${skillWord(stuntTeamSkill)}${stuntTeamFitsGenre(stuntTeam, genre) ? ' · fits this film' : ''}` : 'No Stunt Team hired'}
          </span>
        </div>
        <p style={{ margin: 0 }}>
          Pick the Stunt Team that will run the physical spectacle — stunts, rigs, pyro, practical creatures. A team whose
          specialty fits this {genre} film works to a higher standard for the same money.
        </p>
        <label className="stack" style={{ gap: 4 }}>
          <span style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>Stunt Team</span>
          <select
            value={draft.stuntTeamId ?? ''}
            onChange={(e) => dispatch({ type: 'SET_STUNT_TEAM', stuntTeamId: e.target.value || null })}
          >
            <option value="">— No dedicated team (pickup crew) —</option>
            {stuntTeamOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {skillWord(t.skill)}{stuntTeamFitsGenre(t, genre) ? ' · fits' : ''} · {formatMoney(t.typicalSalary)}
              </option>
            ))}
          </select>
        </label>
        {stuntTeam && (
          <p style={{ margin: 0, fontSize: '0.9em', color: 'var(--text-muted)' }}>
            Specialties: {stuntTeam.specialties.map((s) => STUNT_SPECIALTY_LABEL[s]).join(', ')}. Fee <Money amount={stuntTeam.typicalSalary} /> (charged at release).
          </p>
        )}
        <p style={{ margin: 0, fontWeight: 600, color: CONFIDENCE_PRESENTATION[practicalConf].color }}>
          {stuntTeam ? stuntTeam.name : 'The pickup crew'}: “{CONFIDENCE_PRESENTATION[practicalConf].label}.”
        </p>
        {practicalOutlookText && <p style={{ margin: 0, fontSize: '0.9em', color: 'var(--text-muted)' }}>{practicalOutlookText}</p>}
      </div>

      <RangeSlider
        label="Shooting Budget"
        min={SHOOTING_BUDGET_RANGE.min}
        max={SHOOTING_BUDGET_RANGE.max}
        logScale
        value={shootingBudgetAmount}
        onChange={(v) => updatePlan({ shootingBudgetAmount: v })}
        formatValue={formatMoney}
        description={shootingBudgetDescription(shootingBudgetAmount)}
        lowLabel="Shoestring"
        highLabel="Deep Pockets"
      />
      <RangeSlider
        label="Contingency Reserve"
        min={0}
        max={SHOOTING_BUDGET_RANGE.max}
        logScale
        value={contingencyReserveAmount}
        onChange={(v) => updatePlan({ contingencyReserveAmount: v })}
        formatValue={formatMoney}
        description="A true safety buffer, set aside up front. It is only spent if the shoot runs past its recommended schedule; a clean, on-schedule shoot returns it in full. Overruns beyond it come straight out of studio cash. It buys no quality — it is pure insurance."
        lowLabel="No buffer"
        highLabel="Well-cushioned"
      />
      <RangeSlider
        label="Runtime Target"
        min={0}
        max={1}
        value={runtimeIntensity}
        onChange={(v) => updatePlan({ runtimeIntensity: v })}
        formatValue={(v) => nearestLabel(v, ['Short', 'Standard', 'Long'])}
        description={runtimeDescription(runtimeIntensity)}
        lowLabel="Short"
        highLabel="Long"
      />

      {!canAfford && <p style={{ color: 'var(--red)' }}>This plan costs more than the studio has on hand.</p>}

      <div className="card stack">
        <h3 style={{ margin: 0 }}>Production Risk Profile</h3>
        <p style={{ margin: 0 }}>
          A preview of how this plan (plus your cast's reliability, ego, temperament and how well the key creatives
          get on) shapes what's likely to happen on set - higher isn't automatically bad news, but it opens the door
          to worse events and closes the door on the better ones. Schedule Pressure isn't shown here - it depends on
          how photography actually goes, not on anything you can set in advance.
        </p>
        <ScoreBar label="Morale Risk" value={staticRisk.moraleRisk} />
        {notableClash && (
          <p style={{ margin: '-4px 0 0', fontSize: '0.85em', color: 'var(--danger)' }}>
            ⚠ {notableClash.director.identity.name} and {notableClash.actor.identity.name} are both strong-willed and
            set in their ways - expect creative friction on set, and the on-set clashes that come with it.
          </p>
        )}
        <ScoreBar label="Safety Risk" value={staticRisk.safetyRisk} />
        <ScoreBar label="Technical Complexity" value={staticRisk.technicalComplexity} />
        <ScoreBar label="Budget Risk" value={staticRisk.budgetRisk} />
      </div>

      <div className="plan-consequence-strip row-between">
        <div className="row">
          <div className="stat">
            <div className="stat-label">Set/Effects/VFX Cost</div>
            <div className="stat-value"><Money amount={estimatedCost} /></div>
          </div>
          <div className="stat">
            <div className="stat-label">Recommended Principal Photography</div>
            <div className="stat-value">~{recommendedDays} days</div>
          </div>
          <div className="stat">
            <div className="stat-label">Daily Shoot Cost</div>
            <div className="stat-value"><Money amount={dailyShootCost} /></div>
          </div>
          <div className="stat">
            <div className="stat-label">Estimated Total Cost (on schedule)</div>
            <div className="stat-value"><Money amount={totalEstimatedCost} /></div>
          </div>
        </div>
      </div>
      <p className="choice-description" style={{ margin: 0 }}>
        {genreProfile.description} Principal photography draws your Shooting Budget at{' '}
        <Money amount={dailyShootCost} />/day — over ~{recommendedDays} recommended days that's the full{' '}
        <Money amount={shootingBudgetAmount} /> shooting budget. Wrapping early spends less; every day over runs into your{' '}
        <Money amount={contingencyReserveAmount} /> Contingency Reserve, and anything past that comes out of studio cash.
      </p>
    </div>
  );
}
