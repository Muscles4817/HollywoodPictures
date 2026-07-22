// Turns a writer's hidden numeric creative profile into the qualitative copy
// the player actually reads (Phase 2) - the same "internal precision, external
// description" philosophy engine/scriptPresentation.ts already uses for scripts.
// Nothing here exposes a raw stat: standing becomes a tier word, and the
// craft/tone/genre numbers become a single "known for ..." phrase.
import type { Genre, Person, Script, Tone, WriterCraft, WriterCreativeProfile } from '../types';
import type { ToneProfile } from '../types';
import { getWriterCareer } from './person';
import { writerStanding } from './writers';
import { rewriteAxisRoom, type RewriteKind } from './rewrite';

const TIER_BANDS: { min: number; label: string }[] = [
  { min: 84, label: 'Elite' },
  { min: 66, label: 'Acclaimed' },
  { min: 46, label: 'Established' },
  { min: 28, label: 'Working' },
  { min: 0, label: 'Emerging' },
];

export function writerTierLabel(standing: number): string {
  return (TIER_BANDS.find((b) => standing >= b.min) ?? TIER_BANDS[TIER_BANDS.length - 1]).label;
}

// A genre as a natural noun-phrase, so "known for ... thrillers" reads cleanly
// where the raw enum ("Thriller"/"Sci-Fi") would not.
const GENRE_NOUN: Record<Genre, string> = {
  Action: 'action films',
  Comedy: 'comedies',
  Drama: 'dramas',
  Horror: 'horror',
  Romance: 'romances',
  'Sci-Fi': 'sci-fi',
  Fantasy: 'fantasies',
  Thriller: 'thrillers',
};

const TONE_ADJECTIVE: Record<Tone, string> = {
  action: 'action-driven',
  comedy: 'comedic',
  romance: 'romantic',
  suspense: 'tense',
  drama: 'dramatic',
  spectacle: 'spectacle-heavy',
};

const CRAFT_ADJECTIVE: Record<keyof WriterCraft, string> = {
  originality: 'boldly original',
  structure: 'tightly plotted',
  characters: 'character-driven',
  dialogue: 'dialogue-driven',
};

function argMax<K extends string>(record: Record<K, number>): K {
  const keys = Object.keys(record) as K[];
  return keys.reduce((best, k) => (record[k] > record[best] ? k : best), keys[0]);
}

export interface WriterDescription {
  /** e.g. "Emerging writer", "Elite writer". */
  tier: string;
  /** e.g. "known for tense, character-driven thrillers". */
  knownFor: string;
}

/** A short, number-free read on a writer's identity for the Opportunity Market and hiring surfaces. Null if the person has no writer career. */
export function describeWriter(person: Person): WriterDescription | null {
  const career = getWriterCareer(person);
  if (!career) return null;

  const tier = `${writerTierLabel(writerStanding(person))} writer`;
  const genre = argMax<Genre>(career.genreAffinity);
  const toneAdj = TONE_ADJECTIVE[argMax<Tone>(career.toneProfile as ToneProfile)];
  const craftAdj = CRAFT_ADJECTIVE[argMax(career.craft) as keyof WriterCraft];

  return { tier, knownFor: `known for ${toneAdj}, ${craftAdj} ${GENRE_NOUN[genre]}` };
}

const CRAFT_AXIS_NOUN: Record<keyof WriterCraft, string> = {
  originality: 'originality',
  structure: 'structure',
  characters: 'the characters',
  dialogue: 'the dialogue',
};

// Below this a writer has too little room on an axis for the projection to
// bother naming it - keeps the phrase to the one or two things that matter.
const NOTABLE_ROOM = 8;

/**
 * A number-free read on what a given writer's Rewrite/Polish pass is likely to
 * do to a script, for the commission panel - names the one or two craft axes
 * with the most room, plus a reliability hint from consistency. Never promises
 * a guaranteed result (the pass is a gamble - see engine/rewrite.ts).
 */
export function describeRewriteProjection(writer: WriterCreativeProfile, script: Script, kind: RewriteKind): string {
  const room = rewriteAxisRoom(writer, script);
  const ranked = (Object.keys(room) as (keyof WriterCraft)[])
    .filter((axis) => room[axis] >= NOTABLE_ROOM)
    .sort((a, b) => room[b] - room[a]);

  const passWord = kind === 'polish' ? 'polish' : 'rewrite';
  const base = ranked.length === 0
    ? `Little room left to improve — a speculative ${passWord}`
    : `Likely to strengthen ${ranked.slice(0, 2).map((axis) => CRAFT_AXIS_NOUN[axis]).join(' and ')}`;

  if (writer.consistency < 40) return `${base}; results are unpredictable`;
  if (writer.consistency > 75) return `${base}; a dependable pair of hands`;
  return base;
}
