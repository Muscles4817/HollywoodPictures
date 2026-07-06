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
  Action: { popularity: 75, vfxImportance: 0.8, practicalEffectsImportance: 0.5, actingImportance: 0.4, scriptImportance: 0.3, lowBudgetFriendly: 0.2 },
  Comedy: { popularity: 65, vfxImportance: 0.1, practicalEffectsImportance: 0.1, actingImportance: 0.8, scriptImportance: 0.7, lowBudgetFriendly: 0.6 },
  Drama: { popularity: 45, vfxImportance: 0.05, practicalEffectsImportance: 0.1, actingImportance: 0.85, scriptImportance: 0.85, lowBudgetFriendly: 0.7 },
  Horror: { popularity: 55, vfxImportance: 0.2, practicalEffectsImportance: 0.6, actingImportance: 0.3, scriptImportance: 0.6, lowBudgetFriendly: 0.9 },
  Romance: { popularity: 50, vfxImportance: 0.05, practicalEffectsImportance: 0.1, actingImportance: 0.75, scriptImportance: 0.7, lowBudgetFriendly: 0.65 },
  'Sci-Fi': { popularity: 68, vfxImportance: 0.85, practicalEffectsImportance: 0.4, actingImportance: 0.4, scriptImportance: 0.5, lowBudgetFriendly: 0.15 },
  Fantasy: { popularity: 62, vfxImportance: 0.8, practicalEffectsImportance: 0.45, actingImportance: 0.4, scriptImportance: 0.5, lowBudgetFriendly: 0.15 },
  Thriller: { popularity: 60, vfxImportance: 0.25, practicalEffectsImportance: 0.3, actingImportance: 0.6, scriptImportance: 0.7, lowBudgetFriendly: 0.55 },
};
