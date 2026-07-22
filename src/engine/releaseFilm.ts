import type {
  FilmResults,
  Genre,
  MarketingChoices,
  PostProductionChoices,
  ProductionChoices,
  ProductionEvent,
  Script,
  TalentAssignment,
  TargetAudience,
} from '../types';
import { computeAudienceScore, computeBuzzScore, computeCriticScore, computeQualityBreakdown, combineProductionEvents } from './scoring';
import { computeEventsCostDelta, computeMarketingCost, computeProductionBudgetCost, computeTalentCost } from './cost';
import { deriveAudienceSimulationFixedState, type SupportedReleaseType } from './audienceSimulationInputs';
import { campaignAngleEffect, effectiveMarketingReach, NEUTRAL_ANGLE_EFFECT } from './marketing';
import { CAMPAIGN_ANGLE_PROFILES, LEGS_AUDIENCE_POINTS } from '../data/marketing';
import type { CampaignAngle } from '../types';
import { deriveCommercialProfile } from './commercialProfile';
import { advanceOneWeek } from './audienceSimulationStep';
import { AVERAGE_TICKET_PRICE } from './boxOfficeRun';
import { computeInternationalAppeal, domesticKeepShareForFilm, splitBoxOfficeGross } from './distribution';
import { pickReviewBlurbs, pickDepartmentBlurb, pickScoredReviews } from './reviews';
import { generateStoryReport } from './storyReport';
import { mitigateEventQualityImpact, NEUTRAL_PRODUCER_EFFECTS, type ProducerEffects } from './producers';
import { pressTourBuzzDelta, pressTourCost } from './pressTour';
import { clamp, type RandomFn } from './random';
import type { AudienceSimulationFixedState } from './audienceSimulation';

function averageFame(talent: TalentAssignment[], role: TalentAssignment['role']): number {
  const matching = talent.filter((t) => t.role === role);
  if (matching.length === 0) return 0;
  return matching.reduce((sum, t) => sum + t.person.reputation.fame, 0) / matching.length;
}

/** The 0-100 film metric a campaign angle is judged against - how well the film actually delivers on what it's selling. */
function deliveredScoreForAngle(angle: CampaignAngle, production: number, script: number, suspense: number, leadFame: number): number {
  switch (CAMPAIGN_ANGLE_PROFILES[angle].dimension) {
    case 'production': return production;
    case 'script': return script;
    case 'suspense': return suspense;
    case 'leadFame': return leadFame;
    default: return 100; // 'none' (faithful) - no shortfall is possible
  }
}

export interface ReleaseComputationInput {
  title: string;
  genre: Genre;
  targetAudience: TargetAudience;
  script: Script;
  talent: TalentAssignment[];
  productionChoices: ProductionChoices;
  postProductionChoices: PostProductionChoices;
  marketingChoices: MarketingChoices;
  /** On-set events only (PhotographyState.events) - see postProductionEvents below for the separate collection. */
  events: ProductionEvent[];
  // Architecture cleanup (post-Phase-B post-production redesign) - the
  // resolved test-screening outcome (FilmDraft.postProductionEvents),
  // combined with `events` above (engine/scoring.ts:combineProductionEvents)
  // for the quality/buzz reads below, but deliberately NOT summed into
  // `events` itself and NOT included when computeEventsCostDelta reads
  // `events` for productionCost's photography-cost term - its own cost was
  // already charged immediately, at RESOLVE_TEST_SCREENING_CHOICE, and is
  // folded into productionCost separately, below, for reporting only.
  postProductionEvents: ProductionEvent[];
  // Contingency's actual daily-burn total from principal photography
  // (PhotographyState.runningCost) - not part of computeProductionBudgetCost
  // any more, since it's no longer a flat lump sum (see engine/cost.ts).
  photographyCost: number;
  // daysElapsed / recommendedDays from the finished shoot - feeds shooting
  // quality (engine/productionDials.ts:shootingQualityFromRatio) the way a
  // pre-set pace slider used to.
  shootingRatio: number;
  /** Studio.brand (Brand Recognition, engine/reputation.ts) - never Prestige, see computeBuzzScore/deriveAudienceSimulationFixedState's own doc comments for why. */
  studioBrand: number;
  /** engine/releaseCrowding.ts:computeCompetitiveCrowding's output, 0-1 - pre-resolved by the caller (engine/scheduledReleases.ts, engine/rivalStudios.ts), since this orchestration point never sees a raw releaseDay itself. Threaded straight into deriveAudienceSimulationFixedState - see ReleaseSimulationInputs.competitiveCrowding's own doc comment for why it dents initialAvailabilityFraction only. */
  competitiveCrowding: number;
  /**
   * Combined boost from producers attached to this film
   * (docs/DESIGN_REVIEW_production_office.md). Optional - absent (rivals, older
   * call sites) means NEUTRAL_PRODUCER_EFFECTS, i.e. no change.
   */
  producerEffects?: ProducerEffects;
  /**
   * Total per-film fees for the attached producers, folded into productionCost
   * (and therefore totalCost) so it's charged once, at release, alongside
   * marketing - never in the greenlight upfront charge, so it isn't in
   * resolvePlayerRelease's alreadyCharged either. Optional; defaults to 0.
   */
  producerFees?: number;
  /**
   * A resolved press-tour moment (engine/pressTourMoments.ts), rolled at
   * settlement (resolvePlayerRelease) and passed in as plain data so this
   * function stays pure and deterministic. Its buzzDelta lifts/saps Buzz and its
   * storyBeat is appended to the story report. Optional/absent - a quiet tour,
   * no tour, or the Marketing-screen projection (which must never see the
   * surprise) - so the forecast path is unchanged.
   */
  pressTourMoment?: { buzzDelta: number; storyBeat: string | null };
  /**
   * The campaign's rollout-momentum multiplier (>= 1) from its runway
   * (engine/marketing.ts:marketingRolloutMultiplier, resolved by the caller from
   * the frozen campaignStartDay + releaseDay). Scales the realised marketing
   * reach that feeds both Buzz and the opening, so a release given time to build
   * a campaign lands harder than one rushed straight out. Optional/absent
   * defaults to 1 (neutral) - a same-day release, a rival, a pre-rollout save,
   * or the projection path when no runway is assumed - so behaviour is unchanged
   * there. See docs/DESIGN_REVIEW_marketing_rollout.md.
   */
  marketingRolloutMultiplier?: number;
}

export interface ReleaseComputationResult {
  results: FilmResults;
  // The film's release-day-fixed audience-simulation state, for seeding its
  // BoxOfficeRun (state/studioReducer.ts:RELEASE_FILM) - not part of
  // FilmResults since it's a run-mechanics input (probabilities, ceilings),
  // not a result the player reads directly (the weekly numbers it drives
  // are what they actually see).
  fixed: AudienceSimulationFixedState;
}

/**
 * The single orchestration point that turns a fully-assembled film draft
 * into its release-day-knowable results. Everything it calls is a pure
 * function, so this stays easy to unit test and easy to extend (e.g.
 * awards, franchises) later. Deliberately does NOT compute totalBoxOffice/
 * studioRevenue/profit/outcome/brandChange/prestigeChange - those depend on
 * the whole theatrical run, which hasn't happened yet at the moment a film releases
 * (see engine/boxOfficeRun.ts and docs/DESIGN.md 5.19); they come back null
 * here and get filled in once the run finishes.
 */
export function computeReleaseResults(input: ReleaseComputationInput, rng: RandomFn): ReleaseComputationResult {
  // Quality/buzz read on-set and post-production events as one combined
  // history (engine/scoring.ts:combineProductionEvents) - a test screening's
  // resolved outcome is just as real a part of "what happened to this film"
  // as an on-set event, even though it's stored separately (see
  // ReleaseComputationInput.postProductionEvents's own comment).
  const producerEffects = input.producerEffects ?? NEUTRAL_PRODUCER_EFFECTS;
  const producerFees = input.producerFees ?? 0;

  const allEvents = combineProductionEvents(input.events, input.postProductionEvents);
  // Fixer softens the quality damage from bad events only (costs are settled
  // elsewhere - see mitigateEventQualityImpact). Buzz keeps reading the raw
  // events; a Fixer isn't a hype mechanic.
  const qualityEvents = mitigateEventQualityImpact(allEvents, producerEffects.eventNegativeImpactMultiplier);
  const quality = computeQualityBreakdown(
    input.script,
    input.talent,
    input.genre,
    input.productionChoices,
    input.postProductionChoices,
    qualityEvents,
    input.shootingRatio,
    producerEffects.postProductionDelta, // Creative
  );
  const criticScore = computeCriticScore(quality, input.script, input.postProductionChoices);
  const audienceScore = computeAudienceScore(
    quality,
    input.script,
    input.talent,
    input.genre,
    input.productionChoices,
    input.postProductionChoices,
  );
  // Marketing campaign (docs/DESIGN_REVIEW_marketing_campaign.md): the channel
  // mix rolls up into an audience-weighted effective reach; the angle boosts
  // the opening and, if the film doesn't back up what it sold, dents the legs.
  // Both fall back to neutral (the flat marketingSpend, no angle) when no
  // campaign is built - rivals and pre-overhaul saves - so behaviour is
  // unchanged there.
  const baseMarketingReach = input.marketingChoices.channelSpend
    ? effectiveMarketingReach(input.marketingChoices.channelSpend, input.targetAudience)
    : input.marketingChoices.marketingSpend;
  // Marketing rollout (docs/DESIGN_REVIEW_marketing_rollout.md): a campaign
  // given runway to build lands harder. The multiplier (>= 1, resolved by the
  // caller from the frozen campaignStartDay -> releaseDay runway) lifts the
  // realised reach that both Buzz and the opening read below; 1 (neutral) for a
  // same-day release, a rival, or the projection's default, leaving those
  // unchanged.
  const marketingReach = baseMarketingReach * (input.marketingRolloutMultiplier ?? 1);
  const angle = input.marketingChoices.campaignAngle;
  const angleEffect = angle
    ? campaignAngleEffect(
        angle,
        deliveredScoreForAngle(angle, quality.productionScore, quality.scriptScore, input.script.toneProfile.suspense, averageFame(input.talent, 'Lead Actor')),
      )
    : NEUTRAL_ANGLE_EFFECT;
  // The legs penalty saps the sim's word-of-mouth (audience) score only; the
  // reported audienceScore below is untouched.
  const simAudienceScore = clamp(audienceScore - angleEffect.legsPenalty * LEGS_AUDIENCE_POINTS, 0, 100);

  // Executive adds flat Buzz (the marketing-efficiency half is applied to the
  // sim's marketing spend below).
  const rawBuzz = computeBuzzScore(
    input.script,
    input.talent,
    allEvents,
    input.postProductionChoices,
    marketingReach,
    input.studioBrand,
  );
  // Press tour (docs/DESIGN_REVIEW_marketing_campaign.md): the cast sent on tour
  // add a deterministic Buzz delta, fame lifted and media-risk discounted - a
  // volatile roster delivers little, a famous loose cannon can even net
  // negative. Zero when nobody tours, so behaviour is unchanged for rivals and
  // pre-tour saves.
  const pressTourBuzz = pressTourBuzzDelta(input.talent, input.marketingChoices.pressTourCast);
  // A rolled press-tour moment (rare, personality-driven - resolvePlayerRelease)
  // swings Buzz on top of the deterministic tour delta. 0 for a quiet tour or
  // the projection path.
  const pressTourMomentBuzz = input.pressTourMoment?.buzzDelta ?? 0;
  const buzzScore = clamp(rawBuzz + producerEffects.flatBuzzDelta + pressTourBuzz + pressTourMomentBuzz, 0, 100);

  const talentCost = computeTalentCost(input.talent);
  // Line trims the production budget (sets/practical/VFX). Charged in full at
  // greenlight, so the reduction lands as a release-time credit via
  // resolvePlayerRelease's totalCost - alreadyCharged netting - the arithmetic
  // works out to the player paying the reduced amount overall.
  const productionBudgetCost = computeProductionBudgetCost(input.productionChoices) * producerEffects.productionCostMultiplier;
  // Post-Production Redesign, Phase B - the old flat testScreeningCost term
  // is gone. A real test screening's resolved cost is now charged
  // immediately, at RESOLVE_TEST_SCREENING_CHOICE (state/studioReducer.ts),
  // the same way GREENLIGHT_PROJECT already charges talent/production cash
  // up front rather than deferring it - not summed again here, which would
  // double-charge it.
  const eventsCostDelta = computeEventsCostDelta(input.events);
  // Architecture cleanup (post-Phase-B) - a resolved post-production
  // intervention's cost was ALSO already charged immediately, the same as
  // the on-set eventsCostDelta term above is deliberately excluded from
  // being charged twice. Unlike that term, though, this one IS folded into
  // productionCost below - purely for reporting (a film's totalCost should
  // read as its true all-in cost regardless of when each piece was actually
  // charged, same as talentCost/productionBudgetCost above, both already
  // charged at GREENLIGHT_PROJECT and still summed here for the same
  // reason). The caller (engine/marketSettlement.ts:resolvePlayerRelease)
  // is what keeps this honest - its own alreadyCharged calculation includes
  // this exact same amount, so the settlement-time cash charge nets out to
  // never re-deduct it.
  const postProductionInterventionCost = computeEventsCostDelta(input.postProductionEvents);
  // input.script.cost is deliberately NOT part of this sum - it's charged
  // once, immediately, at Opportunity acquisition (ACQUIRE_OPPORTUNITY,
  // state/studioReducer.ts), long before a Project (let alone a release)
  // might ever exist for that script - see
  // docs/DESIGN_REVIEW_development_pipeline.md. Including it here again
  // would double-charge every film's production cost by its own script's
  // price.
  const productionCost = Math.max(
    0,
    talentCost + productionBudgetCost + input.photographyCost + eventsCostDelta + postProductionInterventionCost + producerFees,
  );
  // The press tour is a promotional expense - folded into the reported
  // marketingCost (and therefore totalCost) so it reads as part of the campaign.
  // Never in resolvePlayerRelease's alreadyCharged (which excludes marketing),
  // so like the rest of marketing it's charged once, at release.
  const marketingCost = computeMarketingCost(input.marketingChoices) + pressTourCost(input.talent, input.marketingChoices.pressTourCast);
  const totalCost = productionCost + marketingCost;

  // Release-day-fixed audience-simulation state (docs/DESIGN.md 5.34,
  // Milestones 1-3) - computed once, here, and carried forward by the
  // caller into Film.boxOfficeRun.fixed, never recomputed. Streaming was
  // removed as a release option (types/index.ts:ReleaseType) specifically
  // so marketingChoices.releaseType is always a SupportedReleaseType here,
  // no runtime check needed.
  const commercialProfile = deriveCommercialProfile(input.script);
  const fixed = deriveAudienceSimulationFixedState({
    buzzScore,
    // Effective reach (audience-weighted channel mix), lifted by the campaign
    // angle's opening hype and the Executive producer's marketing-efficiency
    // half - each makes a pound of the real spend behave like more when
    // converting into an opening, without changing the cash marketingCost.
    marketingSpend: marketingReach * angleEffect.openingMultiplier * producerEffects.marketingEfficiencyMultiplier,
    directorFame: averageFame(input.talent, 'Director'),
    leadFame: averageFame(input.talent, 'Lead Actor'),
    studioBrand: input.studioBrand,
    scriptAccessibility: commercialProfile.accessibility,
    scriptHookStrength: commercialProfile.hookStrength,
    scriptCrossoverPotential: commercialProfile.crossoverPotential,
    scriptSpectacle: input.script.toneProfile.spectacle,
    scriptIntendedAudience: input.script.intendedAudience,
    targetAudience: input.targetAudience,
    genre: input.genre,
    releaseWindow: input.marketingChoices.releaseWindow,
    releaseType: input.marketingChoices.releaseType as SupportedReleaseType,
    competitiveCrowding: input.competitiveCrowding,
    // The distribution deal's Wide screen ceiling (engine/distribution.ts),
    // frozen onto marketingChoices at SCHEDULE_RELEASE. Absent for non-Wide,
    // rivals, and the live pre-schedule projection's default path.
    wideAvailabilityCeiling: input.marketingChoices.distributionBreadth,
    criticScore,
    audienceScore: simAudienceScore,
  });
  // Week 1 is deterministic (the new model has no randomness at all) and
  // release-day-knowable, so it's safe to compute here for
  // FilmResults.openingWeekend - engine/boxOfficeRun.ts's settlement pass
  // (called immediately after RELEASE_FILM constructs the film, same as it
  // always has been) independently arrives at the exact same week 1 the
  // moment it catches this film up, since it starts from the same `fixed`
  // and an empty history. Not a second algorithm, just the one pure step
  // function called twice - see advanceOneWeek's own determinism guarantee.
  const week1 = advanceOneWeek(fixed, []);
  // The sim's opening admissions are worldwide potential; report only what
  // actually plays (domestic + realised international), rounded the exact same
  // way engine/boxOfficeRun.ts settles week 1 so the two always agree.
  const worldwideOpeningGross = Math.round(week1.cumulativeTicketsSold * AVERAGE_TICKET_PRICE);
  const openingSplit = splitBoxOfficeGross(
    worldwideOpeningGross,
    computeInternationalAppeal({ genre: input.genre }),
    input.marketingChoices.internationalReachFraction ?? 0,
    domesticKeepShareForFilm(input.marketingChoices.distributionKeepShare),
  );
  const openingWeekend = Math.round(openingSplit.domesticGross) + Math.round(openingSplit.internationalGross);

  const departmentBlurb = pickDepartmentBlurb(quality, input.genre, rng);
  const reviewBlurbs = [...pickReviewBlurbs(criticScore, audienceScore, rng), ...(departmentBlurb ? [departmentBlurb] : [])];
  // The story report accretes independently-resolved beats (see
  // engine/storyReport.ts). A press-tour moment, when one fired, is one such
  // beat - appended after the trajectory narrative.
  const storyReport = [
    generateStoryReport({ title: input.title, buzzScore, criticScore, audienceScore }, rng),
    input.pressTourMoment?.storyBeat,
  ]
    .filter(Boolean)
    .join(' ');
  // Individually-rated critic/audience quotes for the Premiere Reveal
  // (components/wizard/PremiereReveal.tsx) - separate from reviewBlurbs
  // above, which stays the historical dossier's own shared-pool quotes.
  const criticReviews = pickScoredReviews(criticScore, 'critic', rng, 3);
  const audienceReviews = pickScoredReviews(audienceScore, 'audience', rng, 3);

  const results: FilmResults = {
    productionCost,
    marketingCost,
    totalCost,
    openingWeekend,
    totalBoxOffice: null,
    studioRevenue: null,
    // The studio's box-office keep for this film - reduced for a rented Wide
    // release (the distributor's fee), frozen from the deal at SCHEDULE_RELEASE.
    // Absent keeps the default DOMESTIC_KEEP_SHARE (engine/distribution.ts).
    distributionKeepShare: input.marketingChoices.distributionKeepShare,
    // Frozen international reach - box-office settlement reads this, never the
    // studio's live tier, so a post-release upgrade never lifts this film.
    internationalReachFraction: input.marketingChoices.internationalReachFraction,
    profit: null,
    outcome: null,
    brandChange: null,
    prestigeChange: null,
    criticScore: Math.round(criticScore),
    audienceScore: Math.round(audienceScore),
    buzzScore: Math.round(buzzScore),
    qualityScore: Math.round(quality.qualityScore),
    scriptScore: Math.round(quality.scriptScore),
    directionScore: Math.round(quality.directionScore),
    actingScore: Math.round(quality.actingScore),
    productionScore: Math.round(quality.productionScore),
    postProductionScore: Math.round(quality.postProductionScore),
    eventsScore: Math.round(quality.eventsScore),
    reviewBlurbs,
    storyReport,
    criticReviews,
    audienceReviews,
  };

  return { results, fixed };
}
