import { TRAJECTORY_BEATS, openingTier, receptionTier } from '../data/storyBeats';
import { pick, type RandomFn } from './random';

/**
 * The Results screen's narrated "Studio Report" - a short paragraph built
 * from independently-resolved "beats" (trajectory now, critic/audience
 * highlights and studio milestones planned as later additions) joined into
 * one summary, the way a trade-press writeup reads rather than a table of
 * numbers. Each beat is chosen from what actually happened, not at random -
 * the randomness is only in *which phrasing* of a given outcome gets used.
 */
export interface StoryReportInput {
  title: string;
  buzzScore: number;
  criticScore: number;
  audienceScore: number;
}

function trajectoryBeat(input: StoryReportInput, rng: RandomFn): string {
  const opening = openingTier(input.buzzScore);
  const reception = receptionTier(input.criticScore, input.audienceScore);
  const lines = TRAJECTORY_BEATS[opening][reception];
  return pick(rng, lines).replace('{title}', input.title || 'The film');
}

export function generateStoryReport(input: StoryReportInput, rng: RandomFn): string {
  const beats = [trajectoryBeat(input, rng)];
  return beats.join(' ');
}
