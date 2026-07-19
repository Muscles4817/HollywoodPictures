import type { Genre } from '../types';
import { SCRIPT_TITLE_WORDS, type GenreTitleBank } from '../data/scriptWords';
import { TALENT_FIRST_NAMES, TALENT_LAST_NAMES } from '../data/talentNames';
import { pick, type RandomFn } from './random';

// Structural title templates, weighted to roughly match the real-film title
// distribution measured across the hand-authored Test Scripts (single word and
// "The ___" dominate; a long tail of possessives, colon subtitles, "___ of
// the ___", prepositional phrases, and so on). The generator used to be a
// single "{adjective} {noun}" shape - a structure that is actually a *minority*
// pattern in real titles - so every generated slate read the same way. Each
// build() draws from the genre's own word banks (data/scriptWords.ts).

function articleFor(word: string): string {
  return /^[aeiou]/i.test(word) ? 'An' : 'A';
}

const PREPOSITIONS = ['Into the', 'Beyond the', 'Beneath the', 'After the', 'Before the', 'Under the'];

interface TitleTemplate {
  /** For docs/tests: the structural shape this template produces. */
  readonly shape: string;
  readonly weight: number;
  build(bank: GenreTitleBank, rng: RandomFn): string;
}

const TEMPLATES: readonly TitleTemplate[] = [
  { shape: 'single', weight: 27, build: (b, r) => pick(r, b.singles) },
  { shape: 'the-noun', weight: 14, build: (b, r) => `The ${pick(r, b.nouns)}` },
  { shape: 'the-adj-noun', weight: 8, build: (b, r) => `The ${pick(r, b.adjectives)} ${pick(r, b.nouns)}` },
  { shape: 'adj-noun', weight: 8, build: (b, r) => `${pick(r, b.adjectives)} ${pick(r, b.nouns)}` },
  {
    shape: 'of-phrase',
    weight: 8,
    build: (b, r) => {
      const lead = r() < 0.5 ? '' : 'The ';
      return `${lead}${pick(r, b.nouns)} of the ${pick(r, b.ofTails)}`;
    },
  },
  { shape: 'subtitle', weight: 8, build: (b, r) => `${pick(r, b.singles)}: ${pick(r, b.adjectives)} ${pick(r, b.nouns)}` },
  { shape: 'prepositional', weight: 6, build: (b, r) => `${pick(r, PREPOSITIONS)} ${pick(r, b.nouns)}` },
  { shape: 'possessive', weight: 5, build: (b, r) => `${pick(r, TALENT_LAST_NAMES)}'s ${pick(r, b.nouns)}` },
  {
    shape: 'a-adj-noun',
    weight: 4,
    build: (b, r) => {
      const adjective = pick(r, b.adjectives);
      return `${articleFor(adjective)} ${adjective} ${pick(r, b.nouns)}`;
    },
  },
  {
    shape: 'pair-and-pair',
    weight: 4,
    build: (b, r) => {
      const first = pick(r, b.pairs);
      const second = pick(r, b.pairs.filter((w) => w !== first));
      return `${first} and ${second}`;
    },
  },
  { shape: 'proper-name', weight: 4, build: (_b, r) => `${pick(r, TALENT_FIRST_NAMES)} ${pick(r, TALENT_LAST_NAMES)}` },
];

const TOTAL_WEIGHT = TEMPLATES.reduce((sum, t) => sum + t.weight, 0);

/** All structural shapes the generator can produce - exported for tests/introspection. */
export const TITLE_SHAPES = TEMPLATES.map((t) => t.shape);

/** One procedurally-built title for the genre, across the full range of structural templates. */
export function generateTitle(genre: Genre, rng: RandomFn): string {
  const bank = SCRIPT_TITLE_WORDS[genre];
  let roll = rng() * TOTAL_WEIGHT;
  for (const template of TEMPLATES) {
    if (roll < template.weight) return template.build(bank, rng);
    roll -= template.weight;
  }
  return TEMPLATES[0].build(bank, rng); // unreachable; float-safety fallback
}

const TITLE_RETRY_LIMIT = 20;

/** Re-rolls on a collision so one slate never shows the same title twice (engine/scriptGenerator.ts). */
export function uniqueTitle(genre: Genre, rng: RandomFn, usedTitles: Set<string>): string {
  for (let attempt = 0; attempt < TITLE_RETRY_LIMIT; attempt++) {
    const title = generateTitle(genre, rng);
    if (!usedTitles.has(title)) {
      usedTitles.add(title);
      return title;
    }
  }
  const title = generateTitle(genre, rng);
  usedTitles.add(title);
  return title;
}
