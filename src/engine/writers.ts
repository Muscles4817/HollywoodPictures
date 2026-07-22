// Writer-domain helpers (Phase 2: writers become authors) - the seam between
// the talent model (a writer is a Person with a WriterCareer) and screenplay
// generation (which reads only a plain WriterCreativeProfile). Kept out of
// engine/scriptGenerator.ts so that generator stays decoupled from Person, and
// out of engine/opportunities.ts so the "which writer, given the source"
// judgement lives in one named place a future commissions system can reuse.
import type { Genre, OpportunitySource, Person, WriterCreativeProfile, WriterGenreAffinity } from '../types';
import { GENRES } from '../data/genres';
import { getWriterCareer } from './person';
import { clamp, weightedPick, type RandomFn } from './random';

/** The creative inputs screenplay generation reads from a writer - a plain projection of their WriterCareer, so scriptGenerator never needs the Person model. Null if this person has no writer career. */
export function writerProfileFromPerson(person: Person): WriterCreativeProfile | null {
  const career = getWriterCareer(person);
  if (!career) return null;
  const { skill, craft, toneProfile, genreAffinity, commercialLean, consistency } = career;
  return { skill, craft, toneProfile, genreAffinity, commercialLean, consistency };
}

/** A writer's overall standing, 0-100 - how established they are. Skill-led (an elite writer is elite regardless of reputation noise) with a fame contribution. Drives how an opportunity's source biases writer selection. */
export function writerStanding(person: Person): number {
  const skill = getWriterCareer(person)?.skill ?? 0;
  return clamp(0.7 * skill + 0.3 * person.reputation.fame, 0, 100);
}

/** A triangular "peak at `at`" shape mapping [0,1] -> [0,1], for sources that favour a mid-range standing rather than an extreme. */
function peakAt(x: number, at: number): number {
  return 1 - Math.abs(x - at) / Math.max(at, 1 - at);
}

/**
 * How strongly a source favours a given writer standing - the Hollywood logic
 * that stops elite writers routinely posting anonymous spec scripts:
 *   Spec Screenplay  -> emerging/unknown writers (favours LOW standing)
 *   Agent Package    -> established, agency-repped writers (peaks mid-high)
 *   Publisher Rights -> proven names attached to known material (peaks mid-high)
 *   Studio Original  -> commissioned elites (favours HIGH standing)
 * Always strictly positive, so any writer *can* appear via any source, just
 * rarely against type - probabilistic bias, never a hard gate.
 */
export function sourceStandingWeight(source: OpportunitySource, standing: number): number {
  const s = standing / 100;
  switch (source) {
    case 'Spec Screenplay': return 0.15 + (1 - s) * 1.6;
    case 'Agent Package': return 0.2 + Math.max(0, peakAt(s, 0.65)) * 1.3;
    case 'Publisher Rights': return 0.2 + Math.max(0, peakAt(s, 0.7)) * 1.3;
    case 'Studio Original': return 0.15 + s * 1.6;
  }
}

/** Selects a writer from the pool, weighted by how well their standing fits the opportunity's source. Returns null only for an empty pool. */
export function selectWriterForSource(writers: Person[], source: OpportunitySource, rng: RandomFn): Person | null {
  if (writers.length === 0) return null;
  const weights: Record<string, number> = {};
  for (const w of writers) weights[w.id] = Math.max(0.01, sourceStandingWeight(source, writerStanding(w)));
  const chosenId = weightedPick(rng, writers.map((w) => w.id), weights);
  return writers.find((w) => w.id === chosenId) ?? writers[0];
}

/** Picks a genre weighted by the writer's genre-affinity profile ("mostly thrillers, sometimes drama"). */
export function pickGenreForAffinity(rng: RandomFn, affinity: WriterGenreAffinity): Genre {
  return weightedPick(rng, GENRES, affinity);
}
