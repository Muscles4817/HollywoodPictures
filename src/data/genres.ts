import type { Genre } from '../types';

// Data-driven genre profile: describes how much each production lever matters
// for a genre, plus its baseline audience popularity. Tweak these numbers to
// rebalance the whole game without touching engine code.
export interface GenreProfile {
  popularity: number; // 0-100 base audience appeal, feeds box office
  vfxImportance: number; // 0-1, how much VFX spend contributes to genre fit
  practicalEffectsImportance: number; // 0-1
  actingImportance: number; // 0-1, how much star power/acting quality matters
  scriptImportance: number; // 0-1, how much originality/dialogue matter
  lowBudgetFriendly: number; // 0-1, how well the genre tolerates a cheap budget
  description: string; // shown to the player when they pick this genre
}

export const GENRES: Genre[] = [
  'Action',
  'Comedy',
  'Drama',
  'Horror',
  'Romance',
  'Sci-Fi',
  'Fantasy',
  'Thriller',
];

export const GENRE_PROFILES: Record<Genre, GenreProfile> = {
  Action: {
    popularity: 75, vfxImportance: 0.8, practicalEffectsImportance: 0.5, actingImportance: 0.4, scriptImportance: 0.3, lowBudgetFriendly: 0.2,
    description: 'Broad appeal and a big VFX/practical-effects payoff, but it really doesn’t work on a shoestring budget.',
  },
  Comedy: {
    popularity: 65, vfxImportance: 0.1, practicalEffectsImportance: 0.1, actingImportance: 0.8, scriptImportance: 0.7, lowBudgetFriendly: 0.6,
    description: 'Lives or dies on cast charisma and sharp dialogue. Cheap sets are fine as long as the writing and actors land.',
  },
  Drama: {
    popularity: 45, vfxImportance: 0.05, practicalEffectsImportance: 0.1, actingImportance: 0.85, scriptImportance: 0.85, lowBudgetFriendly: 0.7,
    description: 'Smaller built-in audience, but critics reward great acting and writing here more than almost anywhere else.',
  },
  Horror: {
    popularity: 55, vfxImportance: 0.2, practicalEffectsImportance: 0.6, actingImportance: 0.3, scriptImportance: 0.6, lowBudgetFriendly: 0.9,
    description: 'The classic low-budget breakout genre - an original, well-made cheap horror film can still turn a serious profit.',
  },
  Romance: {
    popularity: 50, vfxImportance: 0.05, practicalEffectsImportance: 0.1, actingImportance: 0.75, scriptImportance: 0.7, lowBudgetFriendly: 0.65,
    description: 'Character chemistry and script quality carry it. Doesn’t need a big budget, but does need good leads.',
  },
  'Sci-Fi': {
    popularity: 68, vfxImportance: 0.85, practicalEffectsImportance: 0.4, actingImportance: 0.4, scriptImportance: 0.5, lowBudgetFriendly: 0.15,
    description: 'High popularity ceiling but expects real VFX spend to look the part - cheap sci-fi struggles to convince anyone.',
  },
  Fantasy: {
    popularity: 62, vfxImportance: 0.8, practicalEffectsImportance: 0.45, actingImportance: 0.4, scriptImportance: 0.5, lowBudgetFriendly: 0.15,
    description: 'Similar to Sci-Fi: strong audience appeal, but the world needs VFX and set/practical-effects money to sell it.',
  },
  Thriller: {
    popularity: 60, vfxImportance: 0.25, practicalEffectsImportance: 0.3, actingImportance: 0.6, scriptImportance: 0.7, lowBudgetFriendly: 0.55,
    description: 'A dependable mid-budget genre - decent writing and acting go a long way, and it tolerates a leaner budget reasonably well.',
  },
};
