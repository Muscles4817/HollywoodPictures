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

// --- Milestones & records ---------------------------------------------------

export interface Achievement {
  id: string;
  label: string;
  detail?: string;
  icon?: string;
}

/** The comparable facts of one released film, built from a Film by the caller (see state/selectors.ts:milestoneFactsFromFilm). */
export interface MilestoneFacts {
  filmId: string;
  title: string;
  /** Release day, for chronological ordering of who earned a "first" milestone. */
  day: number;
  finished: boolean;
  outcome: OutcomeLabel | null;
  openingWeekend: number;
  audienceScore: number;
  criticScore: number;
  worldwide: number | null;
  profit: number | null;
  legs: number | null;
  prestigeChange: number | null;
  hasInternational: boolean;
}

export type MilestoneCategory = 'commercial' | 'critical' | 'audience' | 'scale' | 'studio';

/** How a record milestone's value should be formatted for the page. */
export type MilestoneValueKind = 'money' | 'score' | 'multiplier';

interface MilestoneDef {
  id: string;
  label: string;
  icon: string;
  category: MilestoneCategory;
  /** Higher = more impressive; orders the premiere banner and floats the best chips to the top. */
  priority: number;
  kind: 'first' | 'record';
  /** Money/box-office milestones aren't knowable until the run finishes. */
  needsFinished: boolean;
  /** What earning this represents - shown on the Milestones page, especially while still locked. */
  description: string;
  /** Short congratulatory subtext once earned. */
  earnedNote: string;
  /** 'first' kind: does this film qualify at all? */
  qualifies?: (f: MilestoneFacts) => boolean;
  /** 'record' kind: the metric to maximise; null when not yet knowable for this film. */
  metric?: (f: MilestoneFacts) => number | null;
  /** 'record' kind: the holder's metric must clear this floor to count as a real milestone. */
  floor?: number;
  /** 'record' kind: how to render the held value on the page. */
  valueKind?: MilestoneValueKind;
}

const HIT_OUTCOMES: OutcomeLabel[] = ['Hit', 'Blockbuster', 'Phenomenon'];
const BLOCKBUSTER_OUTCOMES: OutcomeLabel[] = ['Blockbuster', 'Phenomenon'];
const CRITICAL_HIT_SCORE = 75;
const CROWD_PLEASER_SCORE = 85;

/**
 * The studio's milestone catalog - the achievements the Premiere banner
 * celebrates in the moment and the Milestones page tracks over a career. Two
 * kinds: "first" milestones are earned permanently by the earliest film to
 * qualify; "record" milestones are held by the current best film and change
 * hands as the studio tops itself. Everything is derived from released films
 * (see deriveStudioMilestones / deriveFilmMilestones), never stored - the same
 * "derive, don't persist" approach as engine reputation history.
 */
export const MILESTONES: MilestoneDef[] = [
  // --- First-of-a-kind -----------------------------------------------------
  {
    id: 'first-release', label: 'First Film Released', icon: '🎬', category: 'studio', priority: 5,
    kind: 'first', needsFinished: false,
    description: 'Release your studio’s very first film.', earnedNote: 'Where it all began.',
    qualifies: () => true,
  },
  {
    id: 'first-profit', label: 'First Profit', icon: '💰', category: 'commercial', priority: 20,
    kind: 'first', needsFinished: true,
    description: 'Turn a profit on a film.', earnedNote: 'The studio is in the black.',
    qualifies: (f) => (f.profit ?? 0) > 0,
  },
  {
    id: 'first-hit', label: 'First Hit', icon: '🎟️', category: 'commercial', priority: 35,
    kind: 'first', needsFinished: true,
    description: 'Land a film that lands as a commercial hit.', earnedNote: 'A genuine crowd-puller.',
    qualifies: (f) => f.outcome !== null && HIT_OUTCOMES.includes(f.outcome),
  },
  {
    id: 'first-critical-hit', label: 'First Critical Hit', icon: '⭐', category: 'critical', priority: 35,
    kind: 'first', needsFinished: false,
    description: 'Win the critics over with a strongly-reviewed film.', earnedNote: 'Critics are taking notice.',
    qualifies: (f) => f.criticScore >= CRITICAL_HIT_SCORE,
  },
  {
    id: 'first-crowd-pleaser', label: 'First Crowd-Pleaser', icon: '❤️', category: 'audience', priority: 35,
    kind: 'first', needsFinished: false,
    description: 'Delight audiences with a film they adore.', earnedNote: 'Audiences adored it.',
    qualifies: (f) => f.audienceScore >= CROWD_PLEASER_SCORE,
  },
  {
    id: 'first-cult-hit', label: 'First Cult Hit', icon: '🖤', category: 'critical', priority: 40,
    kind: 'first', needsFinished: true,
    description: 'Make a film that finds a devoted following.', earnedNote: 'It found its people.',
    qualifies: (f) => f.outcome === 'Cult Hit',
  },
  {
    id: 'first-international', label: 'First International Release', icon: '🌍', category: 'scale', priority: 25,
    kind: 'first', needsFinished: false,
    description: 'Take a film to overseas markets.', earnedNote: 'The studio goes global.',
    qualifies: (f) => f.hasInternational,
  },
  {
    id: 'first-hundred-million', label: 'Crossed £100M', icon: '💯', category: 'scale', priority: 45,
    kind: 'first', needsFinished: true,
    description: 'Gross over £100M worldwide with a single film.', earnedNote: 'Nine figures.',
    qualifies: (f) => (f.worldwide ?? 0) >= 100_000_000,
  },
  {
    id: 'first-blockbuster', label: 'First Blockbuster', icon: '💥', category: 'scale', priority: 60,
    kind: 'first', needsFinished: true,
    description: 'Release a full-blown blockbuster.', earnedNote: 'You made a giant.',
    qualifies: (f) => f.outcome !== null && BLOCKBUSTER_OUTCOMES.includes(f.outcome),
  },
  {
    id: 'first-quarter-billion', label: 'Crossed £250M', icon: '🚀', category: 'scale', priority: 65,
    kind: 'first', needsFinished: true,
    description: 'Gross over £250M worldwide with a single film.', earnedNote: 'A quarter-billion and climbing.',
    qualifies: (f) => (f.worldwide ?? 0) >= 250_000_000,
  },
  {
    id: 'first-masterpiece', label: 'First Masterpiece', icon: '🏛️', category: 'critical', priority: 70,
    kind: 'first', needsFinished: true,
    description: 'Make a film hailed as a masterpiece.', earnedNote: 'One for the ages.',
    qualifies: (f) => f.outcome === 'Masterpiece',
  },

  // --- Records (current holder) -------------------------------------------
  {
    id: 'biggest-opening', label: 'Biggest Opening Weekend', icon: '📈', category: 'commercial', priority: 50,
    kind: 'record', needsFinished: false, valueKind: 'money',
    description: 'Your largest opening weekend.', earnedNote: 'A new studio record.',
    metric: (f) => f.openingWeekend, floor: 0,
  },
  {
    id: 'highest-gross', label: 'Highest-Grossing Film', icon: '🏆', category: 'commercial', priority: 55,
    kind: 'record', needsFinished: true, valueKind: 'money',
    description: 'Your highest worldwide gross.', earnedNote: 'Your biggest ever.',
    metric: (f) => f.worldwide, floor: 0,
  },
  {
    id: 'most-profitable', label: 'Most Profitable Film', icon: '🤑', category: 'commercial', priority: 50,
    kind: 'record', needsFinished: true, valueKind: 'money',
    description: 'Your largest profit on a single film.', earnedNote: 'Your best return yet.',
    metric: (f) => f.profit, floor: 1,
  },
  {
    id: 'best-reviewed', label: 'Best Reviewed', icon: '📝', category: 'critical', priority: 45,
    kind: 'record', needsFinished: false, valueKind: 'score',
    description: 'Your best-reviewed film by the critics.', earnedNote: 'Your critical high-water mark.',
    metric: (f) => f.criticScore, floor: 65,
  },
  {
    id: 'best-loved', label: 'Best-Loved by Audiences', icon: '😍', category: 'audience', priority: 45,
    kind: 'record', needsFinished: false, valueKind: 'score',
    description: 'Your strongest audience reaction.', earnedNote: 'They loved this one most.',
    metric: (f) => f.audienceScore, floor: 70,
  },
  {
    id: 'longest-legs', label: 'Longest Legs', icon: '🦵', category: 'audience', priority: 40,
    kind: 'record', needsFinished: true, valueKind: 'multiplier',
    description: 'Your longest-legged run - the film word of mouth carried furthest past its opening.', earnedNote: 'Word of mouth carried it furthest.',
    metric: (f) => f.legs, floor: 2,
  },
  {
    id: 'biggest-prestige', label: 'Biggest Prestige Leap', icon: '🎖️', category: 'studio', priority: 50,
    kind: 'record', needsFinished: true, valueKind: 'score',
    description: 'The film that raised your studio’s prestige the most.', earnedNote: 'Your most respected film yet.',
    metric: (f) => f.prestigeChange, floor: 1,
  },
];

const MILESTONE_PRIORITY = new Map(MILESTONES.map((m) => [m.id, m.priority]));

/** The record metric for a film only when it counts - respects needsFinished so a still-running film can't hold a money record. */
function recordMetric(def: MilestoneDef, f: MilestoneFacts): number | null {
  if (def.needsFinished && !f.finished) return null;
  const v = def.metric!(f);
  if (v === null || v < (def.floor ?? -Infinity)) return null;
  return v;
}

/**
 * The milestones THIS film just earned for the studio, for the Premiere
 * banner. "First" milestones fire when this film is the earliest to qualify;
 * "record" milestones fire only when this film genuinely beats a prior holder
 * (a debut trivially "holds" every record, but that isn't a record *moment* -
 * its firsts carry the celebration instead). Sorted most-impressive first; the
 * caller caps how many chips to show.
 */
export function deriveFilmMilestones(current: MilestoneFacts, prior: MilestoneFacts[]): Achievement[] {
  const out: Achievement[] = [];
  for (const def of MILESTONES) {
    if (def.needsFinished && !current.finished) continue;

    if (def.kind === 'first') {
      if (!def.qualifies!(current)) continue;
      const alreadyEarned = prior.some((f) => (!def.needsFinished || f.finished) && def.qualifies!(f));
      if (alreadyEarned) continue;
      out.push({ id: def.id, label: def.label, detail: def.earnedNote, icon: def.icon });
    } else {
      const value = recordMetric(def, current);
      if (value === null) continue;
      const priorBest = prior.reduce<number | null>((best, f) => {
        const v = recordMetric(def, f);
        return v !== null && (best === null || v > best) ? v : best;
      }, null);
      // No prior holder = a debut trivially "sets" the record; not a record moment.
      if (priorBest === null || value <= priorBest) continue;
      out.push({ id: def.id, label: def.label, detail: def.earnedNote, icon: def.icon });
    }
  }
  return out.sort((a, b) => (MILESTONE_PRIORITY.get(b.id) ?? 0) - (MILESTONE_PRIORITY.get(a.id) ?? 0));
}

export interface StudioMilestone {
  id: string;
  label: string;
  icon: string;
  category: MilestoneCategory;
  description: string;
  earnedNote: string;
  earned: boolean;
  /** The film that earned/holds this milestone, when earned. */
  filmId: string | null;
  filmTitle: string | null;
  day: number | null;
  /** For a held record: the value and how to format it. Null for "first" milestones. */
  value: number | null;
  valueKind: MilestoneValueKind | null;
}

/**
 * The whole milestone catalog resolved against the studio's released films -
 * the data behind the Milestones page. Every milestone appears, earned or not;
 * an earned one names the film that holds it (the earliest qualifier for a
 * "first", the current record holder for a "record"). Pure and derived, never
 * stored.
 */
export function deriveStudioMilestones(films: MilestoneFacts[]): StudioMilestone[] {
  const chrono = [...films].sort((a, b) => a.day - b.day || (a.filmId < b.filmId ? -1 : 1));

  return MILESTONES.map((def): StudioMilestone => {
    const base = {
      id: def.id, label: def.label, icon: def.icon, category: def.category,
      description: def.description, earnedNote: def.earnedNote,
      valueKind: def.kind === 'record' ? (def.valueKind ?? null) : null,
    };

    if (def.kind === 'first') {
      const earner = chrono.find((f) => (!def.needsFinished || f.finished) && def.qualifies!(f)) ?? null;
      return earner
        ? { ...base, earned: true, filmId: earner.filmId, filmTitle: earner.title, day: earner.day, value: null }
        : { ...base, earned: false, filmId: null, filmTitle: null, day: null, value: null };
    }

    // Record: the current holder among films that clear the floor (ties -> earliest, since we replace only on strictly greater).
    let best: { f: MilestoneFacts; v: number } | null = null;
    for (const f of chrono) {
      const v = recordMetric(def, f);
      if (v === null) continue;
      if (best === null || v > best.v) best = { f, v };
    }
    return best
      ? { ...base, earned: true, filmId: best.f.filmId, filmTitle: best.f.title, day: best.f.day, value: best.v }
      : { ...base, earned: false, filmId: null, filmTitle: null, day: null, value: null };
  });
}
