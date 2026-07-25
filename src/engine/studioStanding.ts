// A prose "state of the studio" synthesis for the Studio page - where a studio
// sits in the industry, read from its commercial standing (Brand), critical
// standing (Prestige), what it's known for (genre identity, engine/studioIdentity
// .ts), and its own notable hits and misfires. Qualitative and template-based,
// the same plain-declarative voice as engine/productionIdentity.ts - never raw
// stat values (docs/CLAUDE.md: player-facing presentation is qualitative).
//
// Pure: slim data in, strings out. The caller (the Studio page) assembles the
// input from Studio + its released Films.

import type { Genre } from '../types';
import { primaryGenre } from './studioIdentity';

/** One released film, reduced to what the standing summary needs to pick out notable successes and failures. */
export interface StandingFilm {
  title: string;
  genre: Genre;
  profit: number;
  totalCost: number;
  audienceScore: number;
}

export interface StudioStandingInput {
  brand: number;
  prestige: number;
  genreIdentity: Partial<Record<Genre, number>> | undefined;
  /** Every film the studio has released whose run has finished (profit known). Order doesn't matter. */
  films: StandingFilm[];
}

export interface StudioStanding {
  /** A short chip-sized label, e.g. "Established Horror studio" or "Fledgling studio". */
  headline: string;
  /** A one-to-three sentence narrative of where the studio sits. */
  body: string;
}

function band(value: number, bands: { max: number; label: string }[]): string {
  return (bands.find((b) => value < b.max) ?? bands[bands.length - 1]).label;
}

const COMMERCIAL_BANDS = [
  { max: 25, label: 'a little-known newcomer' },
  { max: 45, label: 'a growing studio' },
  { max: 65, label: 'an established studio' },
  { max: 82, label: 'a major player' },
  { max: Infinity, label: 'a household name' },
];

const CRITICAL_BANDS = [
  { max: 25, label: 'little critical regard' },
  { max: 45, label: 'a modest critical reputation' },
  { max: 65, label: 'solid critical standing' },
  { max: 82, label: 'real critical respect' },
  { max: Infinity, label: 'a reputation as a critical powerhouse' },
];

const HEADLINE_COMMERCIAL = [
  { max: 25, label: 'Fledgling' },
  { max: 45, label: 'Up-and-coming' },
  { max: 65, label: 'Established' },
  { max: 82, label: 'Major' },
  { max: Infinity, label: 'Powerhouse' },
];

// Identity strength bands for the "known for" line - primaryGenre already gates
// on the established threshold; below it we look for an emerging leaning.
const EMERGING_THRESHOLD = 20;

function bestFilmBy(films: StandingFilm[], score: (f: StandingFilm) => number): StandingFilm | null {
  if (films.length === 0) return null;
  return films.reduce((best, f) => (score(f) > score(best) ? f : best));
}

/** The genre a studio is only *starting* to lean into (top identity between the emerging and established thresholds), or null. */
function emergingGenre(identity: Partial<Record<Genre, number>> | undefined): Genre | null {
  if (!identity) return null;
  let best: { genre: Genre; strength: number } | null = null;
  for (const [g, v] of Object.entries(identity) as [Genre, number][]) {
    if (v >= EMERGING_THRESHOLD && (!best || v > best.strength)) best = { genre: g, strength: v };
  }
  return best?.genre ?? null;
}

/**
 * Synthesise where a studio sits in the industry. Commercial + critical standing
 * always lead; a genre identity, a defining hit, and a cautionary misfire are
 * folded in when the studio's history supports them - so a struggling studio's
 * summary honestly leads on its losses, and an established specialist's on its
 * territory.
 */
export function synthesizeStudioStanding(input: StudioStandingInput): StudioStanding {
  const commercial = band(input.brand, COMMERCIAL_BANDS);
  const critical = band(input.prestige, CRITICAL_BANDS);
  const known = primaryGenre(input.genreIdentity);
  const emerging = known ? null : emergingGenre(input.genreIdentity);

  const headlineTier = band(input.brand, HEADLINE_COMMERCIAL);
  const headline = known ? `${headlineTier} ${known.genre} studio` : `${headlineTier} studio`;

  // Standing sentence: commercial standing, with critical standing folded in.
  const sentences: string[] = [`The studio is ${commercial} with ${critical}.`];

  // Identity sentence.
  if (known) {
    sentences.push(`It has made its name in ${known.genre.toLowerCase()}, its signature genre.`);
  } else if (emerging) {
    sentences.push(`It is starting to build a name in ${emerging.toLowerCase()}, though nothing is yet its signature.`);
  } else if (input.films.length > 0) {
    sentences.push(`It has yet to settle on a signature genre.`);
  }

  // Notable success + misfire, drawn from real history.
  const biggestHit = bestFilmBy(input.films, (f) => f.profit);
  const biggestFlop = bestFilmBy(input.films, (f) => -f.profit);
  const hitIsReal = biggestHit && biggestHit.profit > 0 && biggestHit.totalCost > 0 && biggestHit.profit / biggestHit.totalCost >= 0.5;
  const flopIsReal = biggestFlop && biggestFlop.totalCost > 0 && biggestFlop.profit / biggestFlop.totalCost <= -0.4;
  const struggling = input.brand < 40 && (!hitIsReal || (flopIsReal ?? false));

  if (struggling && flopIsReal) {
    sentences.push(`It is finding the going hard - ${biggestFlop!.title} was a costly misfire it is still recovering from.`);
    if (hitIsReal && biggestHit!.title !== biggestFlop!.title) {
      sentences.push(`Its brightest moment remains ${biggestHit!.title}.`);
    }
  } else {
    if (hitIsReal) sentences.push(`Its defining success is ${biggestHit!.title}.`);
    if (flopIsReal && (!hitIsReal || biggestFlop!.title !== biggestHit!.title)) {
      sentences.push(`Not everything has landed - ${biggestFlop!.title} was a painful loss.`);
    }
  }

  return { headline, body: sentences.join(' ') };
}
