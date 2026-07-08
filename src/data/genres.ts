import type { Genre, TargetAudience, ToneProfile } from '../types';

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
  // hard category. Kept off the 1/100 extremes on purpose (roughly a 20-80
  // spread rather than 10-95) so a coarse 5-star display (see 5.11) still
  // has room to show texture instead of every axis reading as "empty" or
  // "full."
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
    canonicalTone: { action: 80, comedy: 30, romance: 25, suspense: 60, drama: 35, spectacle: 70 },
  },
  Comedy: {
    popularity: 65, vfxImportance: 0.1, practicalEffectsImportance: 0.1, actingImportance: 0.8, scriptImportance: 0.7, lowBudgetFriendly: 0.6,
    description: 'Lives or dies on cast charisma and sharp dialogue. Cheap sets are fine as long as the writing and actors land.',
    canonicalTone: { action: 25, comedy: 80, romance: 40, suspense: 20, drama: 30, spectacle: 30 },
  },
  Drama: {
    popularity: 45, vfxImportance: 0.05, practicalEffectsImportance: 0.1, actingImportance: 0.85, scriptImportance: 0.85, lowBudgetFriendly: 0.7,
    description: 'Smaller built-in audience, but critics reward great acting and writing here more than almost anywhere else.',
    canonicalTone: { action: 20, comedy: 25, romance: 35, suspense: 30, drama: 80, spectacle: 25 },
  },
  Horror: {
    popularity: 55, vfxImportance: 0.2, practicalEffectsImportance: 0.6, actingImportance: 0.3, scriptImportance: 0.6, lowBudgetFriendly: 0.9,
    description: 'The classic low-budget breakout genre - an original, well-made cheap horror film can still turn a serious profit.',
    canonicalTone: { action: 35, comedy: 20, romance: 20, suspense: 75, drama: 45, spectacle: 40 },
  },
  Romance: {
    popularity: 50, vfxImportance: 0.05, practicalEffectsImportance: 0.1, actingImportance: 0.75, scriptImportance: 0.7, lowBudgetFriendly: 0.65,
    description: 'Character chemistry and script quality carry it. Doesn’t need a big budget, but does need good leads.',
    canonicalTone: { action: 20, comedy: 35, romance: 80, suspense: 25, drama: 45, spectacle: 25 },
  },
  'Sci-Fi': {
    popularity: 68, vfxImportance: 0.85, practicalEffectsImportance: 0.4, actingImportance: 0.4, scriptImportance: 0.5, lowBudgetFriendly: 0.15,
    description: 'High popularity ceiling but expects real VFX spend to look the part - cheap sci-fi struggles to convince anyone.',
    canonicalTone: { action: 55, comedy: 25, romance: 30, suspense: 45, drama: 35, spectacle: 75 },
  },
  Fantasy: {
    popularity: 62, vfxImportance: 0.8, practicalEffectsImportance: 0.45, actingImportance: 0.4, scriptImportance: 0.5, lowBudgetFriendly: 0.15,
    description: 'Similar to Sci-Fi: strong audience appeal, but the world needs VFX and set/practical-effects money to sell it.',
    canonicalTone: { action: 50, comedy: 30, romance: 30, suspense: 40, drama: 40, spectacle: 80 },
  },
  Thriller: {
    popularity: 60, vfxImportance: 0.25, practicalEffectsImportance: 0.3, actingImportance: 0.6, scriptImportance: 0.7, lowBudgetFriendly: 0.55,
    description: 'A dependable mid-budget genre - decent writing and acting go a long way, and it tolerates a leaner budget reasonably well.',
    canonicalTone: { action: 45, comedy: 20, romance: 25, suspense: 80, drama: 45, spectacle: 35 },
  },
};

// Which target audiences a script in this genre would plausibly be written
// for (engine/scriptGenerator.ts picks one at random per script) - a rough
// real-world sense of who each genre is typically aimed at, not a hard
// rule. The player can always override Target Audience after picking a
// script; this only sets where it starts.
export const GENRE_TYPICAL_AUDIENCES: Record<Genre, TargetAudience[]> = {
  Action: ['Mass Market', 'Teens'],
  Comedy: ['Mass Market', 'Teens', 'Families'],
  Drama: ['Critics', 'Adults'],
  Horror: ['Teens', 'Adults', 'Niche'],
  Romance: ['Adults', 'Mass Market'],
  'Sci-Fi': ['Mass Market', 'Teens', 'Niche'],
  Fantasy: ['Families', 'Teens', 'Mass Market'],
  Thriller: ['Adults', 'Mass Market'],
};
