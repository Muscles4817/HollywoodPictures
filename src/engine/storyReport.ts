import {
  TRAJECTORY_BEATS,
  DEPARTMENT_HIGHLIGHTS,
  DIVERGENCE_BEATS,
  openingTier,
  receptionTier,
} from '../data/storyBeats';
import type { Department } from '../data/reviewBlurbs';
import type { DepartmentScores } from './reviews';
import { pick, type RandomFn } from './random';

/**
 * The Results screen's narrated "Studio Report" - a short trade-press writeup
 * built from independently-resolved "beats" rather than a table of numbers.
 * Each beat is chosen from what actually happened, never at random - the
 * randomness is only in *which phrasing* of a given outcome gets used:
 *
 *  - a trajectory beat (how the opening met its reception),
 *  - an optional department beat naming the craft reviewers kept returning to
 *    (the omniscient mirror of the in-quote department callouts), and
 *  - an optional divergence beat when critics and audiences clearly split.
 *
 * The result reads the way a real writeup does and teaches the same lessons the
 * premiere reviews do - which is the whole point of the redesign.
 */
export interface StoryReportInput {
  title: string;
  buzzScore: number;
  criticScore: number;
  audienceScore: number;
  departments: DepartmentScores;
}

// The same standout thresholds the reviews and the "Reaction" card use, so the
// three never contradict each other about what stood out.
const STANDOUT_STRONG = 68;
const STANDOUT_WEAK = 45;
const DIVERGENCE_GAP = 15;

function trajectoryBeat(input: StoryReportInput, rng: RandomFn): string {
  const opening = openingTier(input.buzzScore);
  const reception = receptionTier(input.criticScore, input.audienceScore);
  const lines = TRAJECTORY_BEATS[opening][reception];
  return pick(rng, lines).replace('{title}', input.title || 'The film');
}

/** Names the single clearest standout department - the strongest if it's genuinely strong, else the weakest if it's genuinely weak. Null when the film is evenly balanced. */
function departmentBeat(departments: DepartmentScores, rng: RandomFn): string | null {
  const entries: Array<{ department: Department; score: number }> = [
    { department: 'script', score: departments.scriptScore },
    { department: 'direction', score: departments.directionScore },
    { department: 'acting', score: departments.actingScore },
    { department: 'production', score: departments.productionScore },
    { department: 'postProduction', score: departments.postProductionScore },
  ];
  const strongest = entries.reduce((best, e) => (e.score > best.score ? e : best));
  const weakest = entries.reduce((worst, e) => (e.score < worst.score ? e : worst));

  if (strongest.score >= STANDOUT_STRONG) return pick(rng, DEPARTMENT_HIGHLIGHTS[strongest.department].praise);
  if (weakest.score < STANDOUT_WEAK) return pick(rng, DEPARTMENT_HIGHLIGHTS[weakest.department].criticism);
  return null;
}

function divergenceBeat(criticScore: number, audienceScore: number, rng: RandomFn): string | null {
  if (audienceScore - criticScore >= DIVERGENCE_GAP) return pick(rng, DIVERGENCE_BEATS.audienceAhead);
  if (criticScore - audienceScore >= DIVERGENCE_GAP) return pick(rng, DIVERGENCE_BEATS.criticAhead);
  return null;
}

export function generateStoryReport(input: StoryReportInput, rng: RandomFn): string {
  const beats = [
    trajectoryBeat(input, rng),
    departmentBeat(input.departments, rng),
    divergenceBeat(input.criticScore, input.audienceScore, rng),
  ];
  return beats.filter(Boolean).join(' ');
}
