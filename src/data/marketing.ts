// Tuning data for Marketing Campaigns (docs/DESIGN_REVIEW_marketing_campaign.md).
// Pure numbers; the logic that reads them lives in engine/marketing.ts.
// Rebalance here without touching the engine.
import type { CampaignAngle, MarketingChannel, TargetAudience } from '../types';

export const MARKETING_CHANNELS: readonly MarketingChannel[] = ['trailers', 'tv', 'digital', 'press'];

export const MARKETING_CHANNEL_LABEL: Record<MarketingChannel, string> = {
  trailers: 'Trailers',
  tv: 'TV spots',
  digital: 'Digital & social',
  press: 'Press & screenings',
};

export const MARKETING_CHANNEL_BLURB: Record<MarketingChannel, string> = {
  trailers: 'The broad workhorse - reaches everyone reasonably well.',
  tv: 'Mass and family reach, at a premium.',
  digital: 'Cheap, young, and a little viral.',
  press: 'Critic- and prestige-facing; junkets and screenings.',
};

// Effective reach per pound, by the film's Target Audience. Medium-sharp: a
// matched channel is ~1.0, a mismatched one ~0.3-0.4, so matching your channels
// to your audience clearly matters without a thin channel set feeling punishing.
export const CHANNEL_AUDIENCE_EFFICIENCY: Record<MarketingChannel, Record<TargetAudience, number>> = {
  trailers: { 'Mass Market': 1.0, Critics: 0.6, Teens: 0.8, Families: 0.8, Adults: 0.8, Niche: 0.6 },
  tv: { 'Mass Market': 1.0, Critics: 0.4, Teens: 0.5, Families: 1.0, Adults: 0.7, Niche: 0.3 },
  digital: { 'Mass Market': 0.7, Critics: 0.5, Teens: 1.0, Families: 0.5, Adults: 0.7, Niche: 1.0 },
  press: { 'Mass Market': 0.4, Critics: 1.0, Teens: 0.3, Families: 0.4, Adults: 0.8, Niche: 0.7 },
};

// Per-channel saturation: a channel's effective reach is
// REACH_PER_CHANNEL * (1 - e^(-spend / SATURATION_SCALE)) * efficiency. Concave,
// so pouring everything into one channel diminishes and spreading pays off.
// (How this effective-reach number ultimately feeds the awareness pipeline is
// calibrated when it's wired in - increment 2; increment 1 only needs the shape.)
export const REACH_PER_CHANNEL = 50_000_000;
export const SATURATION_SCALE = 25_000_000;

// --- Campaign angle -------------------------------------------------------
// Each loud angle boosts the opening (hype) but risks the legs if the film
// can't back up what it promised. `faithful` is the safe, hype-free baseline.
// `dimension` names the 0-100 film metric the angle is judged against - the
// wiring layer (increment 2) resolves it from the film; the pure engine takes
// that delivered score directly.
export interface CampaignAngleProfile {
  hype: number; // 0-1; drives the opening boost, and how far the legs can fall
  promise: number; // 0-100; the quality the campaign implies on its dimension
  dimension: 'production' | 'script' | 'suspense' | 'leadFame' | 'none';
}

export const CAMPAIGN_ANGLE_PROFILES: Record<CampaignAngle, CampaignAngleProfile> = {
  spectacle: { hype: 1.0, promise: 75, dimension: 'production' },
  starPower: { hype: 0.9, promise: 78, dimension: 'leadFame' },
  mystery: { hype: 0.7, promise: 72, dimension: 'suspense' },
  story: { hype: 0.6, promise: 70, dimension: 'script' },
  faithful: { hype: 0, promise: 0, dimension: 'none' },
};

export const CAMPAIGN_ANGLE_LABEL: Record<CampaignAngle, string> = {
  spectacle: 'Spectacle',
  starPower: 'Star Power',
  mystery: 'Mystery',
  story: 'Story',
  faithful: 'Genre-faithful',
};

// How hard hype pushes the opening vs. how hard an unmet promise drags the
// legs. Tuned so overselling a weak film is a real gamble whose opening gain
// does NOT, on average, offset the legs loss - the honest play stays viable
// and "sell your actual strength" is the mastery play (§3.1).
export const OPENING_HYPE_SCALE = 0.3; // hype 1 -> up to +30% opening
export const LEGS_PENALTY_SCALE = 0.6; // hype 1 with a full unmet promise -> a heavy legs dampener

// How the legs penalty (0..LEGS_PENALTY_SCALE) is applied at release: it
// subtracts up to this many points from the *simulation's* audience score (the
// word-of-mouth input that drives weekly retention), never the reported score.
// So a badly oversold film opens big and then falls off a cliff.
export const LEGS_AUDIENCE_POINTS = 30;

// --- Marketing rollout / campaign runway (docs/DESIGN_REVIEW_marketing_rollout.md) ---
// A marketing campaign isn't an instant switch flipped on release day - it's a
// rollout that takes place over the weeks leading up to a film's release.
// Trailers have to air (and re-air), word has to spread, anticipation has to
// compound. The *runway* a campaign gets - the gap between committing it
// (SCHEDULE_RELEASE) and the release day - is how much of that momentum it
// gets to build. A film rushed straight out the door realises its campaign's
// baseline reach and nothing more; one given room to breathe builds momentum,
// lifting its realised marketing reach up to CAMPAIGN_MOMENTUM_BONUS.
//
// Deliberately a *bonus for runway*, never a penalty for rushing: a same-day
// release (zero runway) is the neutral 1.0 baseline, so the entire existing
// box-office calibration is unchanged and only the new act of *holding* a
// release for its campaign moves the number. The countervailing cost of
// holding is already in the game - a longer wait lets rivals crowd your window
// (engine/releaseCrowding.ts) and keeps the film off screens earning nothing -
// so runway is a real trade-off, not a free lever, and it caps out (no reason
// to hold a film for years).
export const CAMPAIGN_FULL_ROLLOUT_WEEKS = 8; // runway at which the campaign is in full swing
export const CAMPAIGN_MOMENTUM_BONUS = 0.18; // +18% realised reach at a full rollout, vs a rushed release
