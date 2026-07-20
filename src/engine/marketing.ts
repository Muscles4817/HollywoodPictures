// Marketing Campaigns - pure logic (docs/DESIGN_REVIEW_marketing_campaign.md).
// Plain data in, plain data out, no React, no state - the same discipline as
// the rest of engine/. Tunables live in data/marketing.ts. This module is the
// increment-1 foundation: it operates on channel/angle inputs directly and is
// not yet wired into the live MarketingChoices shape (that's increment 2).
import type { CampaignAngle, MarketingChannel, Money, TargetAudience } from '../types';
import {
  CAMPAIGN_ANGLE_PROFILES,
  CHANNEL_AUDIENCE_EFFICIENCY,
  LEGS_PENALTY_SCALE,
  MARKETING_CHANNELS,
  OPENING_HYPE_SCALE,
  REACH_PER_CHANNEL,
  SATURATION_SCALE,
} from '../data/marketing';

export type ChannelSpend = Record<MarketingChannel, number>;

/** Total cash across all channels - what the marketing budget actually costs (before the release-type multiplier). */
export function totalMarketingSpend(channelSpend: ChannelSpend): Money {
  return MARKETING_CHANNELS.reduce((sum, channel) => sum + Math.max(0, channelSpend[channel] ?? 0), 0);
}

/** One channel's concave, saturating effective reach at a given spend (before audience efficiency). */
function saturate(spend: number): number {
  return REACH_PER_CHANNEL * (1 - Math.exp(-Math.max(0, spend) / SATURATION_SCALE));
}

/**
 * The audience-aware "effective marketing reach" a channel mix produces for a
 * film aimed at `targetAudience`. Each channel saturates on its own (so
 * concentrating everything in one channel diminishes) and is weighted by how
 * well it fits the audience. This single number is what replaces the raw
 * marketingSpend in the awareness/Buzz pipeline once wired (increment 2).
 */
export function effectiveMarketingReach(channelSpend: ChannelSpend, targetAudience: TargetAudience): number {
  return MARKETING_CHANNELS.reduce((reach, channel) => {
    const efficiency = CHANNEL_AUDIENCE_EFFICIENCY[channel][targetAudience];
    return reach + efficiency * saturate(channelSpend[channel] ?? 0);
  }, 0);
}

export interface CampaignAngleEffect {
  /** Multiplies the opening (awareness) - >= 1, biggest for the loudest angles. */
  openingMultiplier: number;
  /** A retention / word-of-mouth dampener applied to the post-opening weeks - 0 when the film backs up its angle. */
  legsPenalty: number;
}

export const NEUTRAL_ANGLE_EFFECT: CampaignAngleEffect = { openingMultiplier: 1, legsPenalty: 0 };

/**
 * How a campaign angle plays out, given how well the film actually delivers on
 * the dimension it's selling (`deliveredScore`, 0-100 - resolved from the film
 * by the caller). A loud angle always lifts the opening; the legs only suffer
 * to the extent the film fails to live up to the promise. `faithful` is
 * neutral. See docs/DESIGN_REVIEW_marketing_campaign.md §3.
 */
export function campaignAngleEffect(angle: CampaignAngle, deliveredScore: number): CampaignAngleEffect {
  const profile = CAMPAIGN_ANGLE_PROFILES[angle];
  if (profile.hype <= 0) return NEUTRAL_ANGLE_EFFECT;

  const openingMultiplier = 1 + profile.hype * OPENING_HYPE_SCALE;
  const shortfall = Math.max(0, profile.promise - clamp(deliveredScore, 0, 100)) / 100;
  const legsPenalty = profile.hype * shortfall * LEGS_PENALTY_SCALE;
  return { openingMultiplier, legsPenalty };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
