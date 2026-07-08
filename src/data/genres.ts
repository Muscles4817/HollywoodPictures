import type { Genre, ToneProfile } from '../types';

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
  // A genre's "home" point in tone-space (see types/index.ts:Tone). Scripts
  // generated for this genre jitter around this vector rather than copying
  // it exactly (engine/scriptGenerator.ts), which is what lets a Horror
  // script occasionally land closer to horror-comedy without a separate
  // multi-genre system - genre is a starting point in tone-space, not a
  // hard category.
  canonicalTone: ToneProfile;
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
    canonicalTone: { action: 90, comedy: 20, romance: 15, suspense: 60, drama: 30, spectacle: 75 },
  },
  Comedy: {
    popularity: 65, vfxImportance: 0.1, practicalEffectsImportance: 0.1, actingImportance: 0.8, scriptImportance: 0.7, lowBudgetFriendly: 0.6,
    description: 'Lives or dies on cast charisma and sharp dialogue. Cheap sets are fine as long as the writing and actors land.',
    canonicalTone: { action: 15, comedy: 90, romance: 35, suspense: 10, drama: 20, spectacle: 20 },
  },
  Drama: {
    popularity: 45, vfxImportance: 0.05, practicalEffectsImportance: 0.1, actingImportance: 0.85, scriptImportance: 0.85, lowBudgetFriendly: 0.7,
    description: 'Smaller built-in audience, but critics reward great acting and writing here more than almost anywhere else.',
    canonicalTone: { action: 10, comedy: 15, romance: 30, suspense: 25, drama: 90, spectacle: 15 },
  },
  Horror: {
    popularity: 55, vfxImportance: 0.2, practicalEffectsImportance: 0.6, actingImportance: 0.3, scriptImportance: 0.6, lowBudgetFriendly: 0.9,
    description: 'The classic low-budget breakout genre - an original, well-made cheap horror film can still turn a serious profit.',
    canonicalTone: { action: 30, comedy: 10, romance: 10, suspense: 85, drama: 40, spectacle: 35 },
  },
  Romance: {
    popularity: 50, vfxImportance: 0.05, practicalEffectsImportance: 0.1, actingImportance: 0.75, scriptImportance: 0.7, lowBudgetFriendly: 0.65,
    description: 'Character chemistry and script quality carry it. Doesn’t need a big budget, but does need good leads.',
    canonicalTone: { action: 10, comedy: 30, romance: 90, suspense: 15, drama: 45, spectacle: 15 },
  },
  'Sci-Fi': {
    popularity: 68, vfxImportance: 0.85, practicalEffectsImportance: 0.4, actingImportance: 0.4, scriptImportance: 0.5, lowBudgetFriendly: 0.15,
    description: 'High popularity ceiling but expects real VFX spend to look the part - cheap sci-fi struggles to convince anyone.',
    canonicalTone: { action: 55, comedy: 15, romance: 20, suspense: 45, drama: 30, spectacle: 85 },
  },
  Fantasy: {
    popularity: 62, vfxImportance: 0.8, practicalEffectsImportance: 0.45, actingImportance: 0.4, scriptImportance: 0.5, lowBudgetFriendly: 0.15,
    description: 'Similar to Sci-Fi: strong audience appeal, but the world needs VFX and set/practical-effects money to sell it.',
    canonicalTone: { action: 50, comedy: 20, romance: 25, suspense: 35, drama: 35, spectacle: 90 },
  },
  Thriller: {
    popularity: 60, vfxImportance: 0.25, practicalEffectsImportance: 0.3, actingImportance: 0.6, scriptImportance: 0.7, lowBudgetFriendly: 0.55,
    description: 'A dependable mid-budget genre - decent writing and acting go a long way, and it tolerates a leaner budget reasonably well.',
    canonicalTone: { action: 45, comedy: 10, romance: 15, suspense: 90, drama: 40, spectacle: 30 },
  },
};
