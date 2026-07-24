import type { FilmResults, Genre, OutcomeLabel } from '../types';
import { genreSignatureDepartment } from './genreWeights';
import { explainBrandChange, explainPrestigeChange } from './reputation';

/**
 * Qualitative presentation of a finished film's results - the "teach the
 * player through observation, not raw stat values" layer the Premiere screen
 * is being grown toward (see the Film Premiere UX brief and CLAUDE.md's
 * "presentation is qualitative, never raw internal stat values"). Everything
 * here is a pure, deterministic reading of already-settled FilmResults: no
 * RNG (these run at render time and must be stable across re-renders), no
 * React, no hidden state. The raw numbers still exist on FilmResults for the
 * dev/debug panel and tests; this module is what the player actually reads.
 */

// --- Overall verdict --------------------------------------------------------

export type VerdictTone = 'triumph' | 'good' | 'mixed' | 'poor' | 'disaster';

export interface Verdict {
  /** A short, evocative one-liner - complements the outcome badge, never just restates it. */
  headline: string;
  tone: VerdictTone;
}

// Evocative one-liners that complement the outcome badge rather than restate
// it ("A blockbuster." next to a "Blockbuster" badge reads as an echo).
const VERDICT_BY_OUTCOME: Record<OutcomeLabel, Verdict> = {
  Phenomenon: { headline: 'Everyone is talking about this one.', tone: 'triumph' },
  Blockbuster: { headline: 'A monster at the box office.', tone: 'triumph' },
  Masterpiece: { headline: 'One for the ages.', tone: 'triumph' },
  'Cult Hit': { headline: 'It found its people.', tone: 'good' },
  Hit: { headline: 'A real crowd-pleaser.', tone: 'good' },
  'Modest Success': { headline: 'A quiet win.', tone: 'mixed' },
  Weak: { headline: 'It never found its audience.', tone: 'poor' },
  Flop: { headline: 'One to forget.', tone: 'disaster' },
};

/** The hero verdict line + a tone for styling. `null` outcome = still playing. */
export function deriveVerdict(outcome: OutcomeLabel | null): Verdict {
  if (outcome === null) return { headline: 'The opening numbers are in.', tone: 'mixed' };
  return VERDICT_BY_OUTCOME[outcome];
}

// --- Reception read (critics vs audiences) ----------------------------------

export interface ReceptionRead {
  critics: string;
  audiences: string;
  /** When the two voices meaningfully diverge, the story that tells - else null. */
  divergence: string | null;
}

function criticsLine(score: number): string {
  if (score >= 80) return 'Critics were won over almost across the board.';
  if (score >= 65) return 'Critics came away largely positive.';
  if (score >= 50) return 'Critics were divided.';
  if (score >= 35) return 'Critics were mostly unconvinced.';
  return 'Critics panned it.';
}

function audiencesLine(score: number): string {
  if (score >= 80) return 'Audiences loved it.';
  if (score >= 65) return 'Audiences had a great time.';
  if (score >= 50) return 'Audiences were satisfied, if not blown away.';
  if (score >= 35) return 'Audiences came away cold.';
  return 'Audiences rejected it.';
}

const DIVERGENCE_GAP = 15;

export function deriveReceptionRead(criticScore: number, audienceScore: number): ReceptionRead {
  let divergence: string | null = null;
  if (audienceScore - criticScore >= DIVERGENCE_GAP) {
    divergence = 'Audiences embraced it far more warmly than critics did.';
  } else if (criticScore - audienceScore >= DIVERGENCE_GAP) {
    divergence = 'Critics rated it well above the general audience.';
  }
  return {
    critics: criticsLine(criticScore),
    audiences: audiencesLine(audienceScore),
    divergence,
  };
}

// --- Department strengths & weaknesses --------------------------------------

export type DepartmentName = 'Screenplay' | 'Direction' | 'Acting' | 'Production' | 'Post-Production';

export interface DepartmentInsight {
  department: DepartmentName;
  /** A qualitative note - never a number. */
  note: string;
}

export interface FilmInsights {
  strengths: DepartmentInsight[];
  weaknesses: DepartmentInsight[];
}

// A department earns a callout only when it clearly stands apart from the
// middle of the pack. Everything between WEAK and STRONG is "fine" and stays
// unremarked - the point is to surface a film's real highs and lows, not to
// rank five bars the player was never meant to read as numbers.
const STANDOUT = 78;
const STRONG = 66;
const WEAK = 45;
const POOR = 30;

type DeptKey = 'script' | 'direction' | 'acting' | 'production' | 'postProduction';

interface DeptSpec {
  key: DeptKey;
  name: DepartmentName;
  score: (r: FilmResults) => number;
}

const DEPARTMENTS: DeptSpec[] = [
  { key: 'script', name: 'Screenplay', score: (r) => r.scriptScore },
  { key: 'direction', name: 'Direction', score: (r) => r.directionScore },
  { key: 'acting', name: 'Acting', score: (r) => r.actingScore },
  { key: 'production', name: 'Production', score: (r) => r.productionScore },
  { key: 'postProduction', name: 'Post-Production', score: (r) => r.postProductionScore },
];

const STRENGTH_NOTES: Record<DeptKey, { strong: string; standout: string }> = {
  script: {
    strong: 'Its structure and dialogue consistently landed.',
    standout: 'The writing was singled out again and again.',
  },
  direction: {
    strong: 'Confident, assured work behind the camera.',
    standout: 'A director in complete command of the material.',
  },
  acting: {
    strong: 'The performances resonated on screen.',
    standout: 'The cast was firing on all cylinders.',
  },
  production: {
    strong: 'Handsome, well-mounted production values.',
    standout: 'Every pound of the budget is up there on screen.',
  },
  postProduction: {
    strong: 'A tight cut and effective post polish.',
    standout: 'The edit and finish are impeccable.',
  },
};

const WEAKNESS_NOTES: Record<DeptKey, { weak: string; poor: string }> = {
  script: {
    weak: 'The writing never quite came together.',
    poor: 'A thin, undercooked screenplay undercut everything else.',
  },
  direction: {
    weak: 'The direction lacked confidence and consistency.',
    poor: 'Flat, aimless direction drained the film of energy.',
  },
  acting: {
    weak: 'The performances never fully convinced.',
    poor: 'Wooden performances dragged scene after scene down.',
  },
  production: {
    weak: 'Production values occasionally looked thin.',
    poor: 'Cut-rate sets and effects showed in every frame.',
  },
  postProduction: {
    weak: 'The edit and post felt rushed.',
    poor: 'Choppy editing and a forgettable finish did it no favours.',
  },
};

/**
 * A film's clear highs and lows, department by department, as prose the
 * player reads instead of five numeric bars. Genre-signature departments
 * (the craft this genre's audience cares about most) sort first within their
 * list, so the callout the player learns to watch for surfaces at the top.
 */
export function deriveFilmInsights(results: FilmResults, genre: Genre): FilmInsights {
  const signature = genreSignatureDepartment(genre);

  const rank = (a: DeptSpec, b: DeptSpec): number => {
    const aSig = a.key === signature ? 1 : 0;
    const bSig = b.key === signature ? 1 : 0;
    return bSig - aSig;
  };

  const strengths: DepartmentInsight[] = DEPARTMENTS.filter((d) => d.score(results) >= STRONG)
    .sort((a, b) => rank(a, b) || b.score(results) - a.score(results))
    .map((d) => ({
      department: d.name,
      note: d.score(results) >= STANDOUT ? STRENGTH_NOTES[d.key].standout : STRENGTH_NOTES[d.key].strong,
    }));

  const weaknesses: DepartmentInsight[] = DEPARTMENTS.filter((d) => d.score(results) < WEAK)
    .sort((a, b) => rank(a, b) || a.score(results) - b.score(results))
    .map((d) => ({
      department: d.name,
      note: d.score(results) < POOR ? WEAKNESS_NOTES[d.key].poor : WEAKNESS_NOTES[d.key].weak,
    }));

  return { strengths, weaknesses };
}

// --- Studio impact narrative ------------------------------------------------

/**
 * How this one film moved the studio, in plain language - the "this movie
 * changed your studio" story rather than a bare "Brand +6 / Prestige +1".
 * Grounded in the same brand/prestige change the reducer actually applied,
 * so the narrative never drifts from the numbers behind it. Returns 1-2
 * sentences; empty only in the (rare) case a film moved neither stat.
 */
export function deriveStudioImpact(results: FilmResults, studioName: string): string[] {
  const lines: string[] = [];
  const studio = studioName || 'the studio';
  const brand = results.brandChange ?? 0;
  const prestige = results.prestigeChange ?? 0;

  if (brand >= 6) lines.push(`Audiences are starting to associate ${studio} with movies worth showing up for.`);
  else if (brand >= 3) lines.push(`A commercial win like this builds ${studio}'s standing with audiences.`);
  else if (brand >= 1) lines.push(`A modest lift to ${studio}'s commercial reputation.`);
  else if (brand <= -6) lines.push(`A miss this size makes audiences think twice about the ${studio} name.`);
  else if (brand <= -3) lines.push(`This dented ${studio}'s commercial reputation.`);
  else if (brand <= -1) lines.push(`A small knock to ${studio}'s standing with audiences.`);

  if (prestige >= 3) lines.push(`Critics are starting to take ${studio} seriously as a creative force.`);
  else if (prestige >= 1) lines.push(`A film like this earns ${studio} a little more critical respect.`);
  else if (prestige <= -3) lines.push(`Reviews this weak chip away at how the industry sees ${studio}.`);
  else if (prestige <= -1) lines.push(`Not the kind of notices that build ${studio}'s critical reputation.`);

  if (lines.length === 0) lines.push(`${studio} moves on to its next picture, standing unchanged.`);
  return lines;
}

/**
 * The grounded "why" behind each stat's change, reused from engine/reputation
 * so the dev panel and the narrative agree. Kept here so the Premiere screen
 * has a single import surface for everything it renders.
 */
export function brandChangeReason(results: FilmResults): string {
  return explainBrandChange({
    profit: results.profit ?? 0,
    totalCost: results.totalCost,
    totalBoxOffice: results.totalBoxOffice ?? 0,
    audienceScore: results.audienceScore,
  });
}

export function prestigeChangeReason(results: FilmResults): string {
  return explainPrestigeChange({ criticScore: results.criticScore, qualityScore: results.qualityScore });
}

// --- Achievements & records -------------------------------------------------

export interface Achievement {
  id: string;
  label: string;
  detail?: string;
}

/** The comparable facts of one released film - built from FilmResults by the caller. */
export interface AchievementFacts {
  openingWeekend: number;
  audienceScore: number;
  criticScore: number;
  profit: number | null;
  totalBoxOffice: number | null;
  legs: number | null;
  prestigeChange: number | null;
}

const CRITICAL_HIT_SCORE = 75;

function maxOf<T>(items: T[], get: (item: T) => number | null): number | null {
  const values = items.map(get).filter((v): v is number => v !== null);
  return values.length > 0 ? Math.max(...values) : null;
}

/**
 * The celebratory milestones this film just set for the studio - "biggest
 * opening", "first profitable film", "one of your strongest audience
 * reactions", and so on. Records that beat a previous best need at least one
 * prior film to beat; "first ever" milestones fire on qualification alone, so
 * a debut film can still light up. Money-based milestones only appear once the
 * run has `finished`; opening-weekend and reception milestones land at the
 * premiere. Deliberately capped so the banner celebrates, never overwhelms.
 */
export function deriveAchievements(current: AchievementFacts, prior: AchievementFacts[], finished: boolean): Achievement[] {
  const found: Achievement[] = [];
  const hasPrior = prior.length > 0;

  // Biggest opening weekend (known at premiere).
  const bestOpening = maxOf(prior, (f) => f.openingWeekend);
  if (hasPrior && bestOpening !== null && current.openingWeekend > bestOpening) {
    found.push({ id: 'biggest-opening', label: 'Biggest opening weekend yet', detail: 'A new studio record.' });
  }

  // First critical hit / strongest reviews.
  const priorCriticHit = prior.some((f) => f.criticScore >= CRITICAL_HIT_SCORE);
  if (current.criticScore >= CRITICAL_HIT_SCORE && !priorCriticHit) {
    found.push({ id: 'first-critical-hit', label: 'Your first critical hit', detail: 'Critics are taking notice.' });
  }

  // Strongest audience reaction (known at premiere).
  const bestAudience = maxOf(prior, (f) => f.audienceScore);
  if (hasPrior && bestAudience !== null && current.audienceScore > bestAudience) {
    found.push({ id: 'best-audience', label: 'Your strongest audience reaction', detail: 'They loved this one.' });
  }

  if (finished) {
    // First profitable film ever.
    const priorProfit = prior.some((f) => (f.profit ?? 0) > 0);
    if ((current.profit ?? 0) > 0 && !priorProfit) {
      found.push({ id: 'first-profit', label: 'Your first profitable film', detail: 'The studio is in the black.' });
    }

    // Biggest box office to date.
    const bestGross = maxOf(prior, (f) => f.totalBoxOffice);
    if (hasPrior && bestGross !== null && current.totalBoxOffice !== null && current.totalBoxOffice > bestGross) {
      found.push({ id: 'biggest-gross', label: 'Your highest-grossing film', detail: 'A new box-office high.' });
    }

    // Longest legs - the run that held on longest.
    const bestLegs = maxOf(prior, (f) => f.legs);
    if (hasPrior && bestLegs !== null && current.legs !== null && current.legs > bestLegs) {
      found.push({ id: 'longest-legs', label: 'Your longest theatrical run', detail: 'Word of mouth carried it.' });
    }

    // Biggest prestige gain.
    const bestPrestige = maxOf(prior, (f) => f.prestigeChange);
    if (
      hasPrior &&
      bestPrestige !== null &&
      current.prestigeChange !== null &&
      current.prestigeChange > bestPrestige &&
      current.prestigeChange > 0
    ) {
      found.push({ id: 'biggest-prestige', label: 'Your biggest prestige gain', detail: 'Your most respected film yet.' });
    }
  }

  return found;
}
