import type { Genre } from '../types';

// Word banks used to procedurally suggest a script title per genre.
// Titles are flavor only; they don't affect scoring.
export const SCRIPT_TITLE_WORDS: Record<Genre, { adjectives: string[]; nouns: string[] }> = {
  Action: {
    adjectives: ['Last', 'Broken', 'Silent', 'Iron', 'Final', 'Rogue'],
    nouns: ['Protocol', 'Reckoning', 'Strike', 'Vendetta', 'Convoy', 'Gauntlet'],
  },
  Comedy: {
    adjectives: ['Awkward', 'Accidental', 'Unlikely', 'Reluctant', 'Terrible', 'Lucky'],
    nouns: ['Wedding', 'Roommates', 'Heist', 'Reunion', 'Internship', 'Getaway'],
  },
  Drama: {
    adjectives: ['Quiet', 'Distant', 'Unspoken', 'Fading', 'Ordinary', 'Longest'],
    nouns: ['Harvest', 'Letters', 'Homecoming', 'Season', 'Inheritance', 'River'],
  },
  Horror: {
    adjectives: ['Hollow', 'Whispering', 'Cursed', 'Buried', 'Nameless', 'Rotting'],
    nouns: ['Hollow', 'Basement', 'Static', 'Orchard', 'Lodge', 'Tenants'],
  },
  Romance: {
    adjectives: ['Sweet', 'Almost', 'Second', 'Endless', 'Quiet', 'One More'],
    nouns: ['Summer', 'Letter', 'Chance', 'Encore', 'Distance', 'Promise'],
  },
  'Sci-Fi': {
    adjectives: ['Distant', 'Fractured', 'Last', 'Silent', 'Beyond', 'Null'],
    nouns: ['Horizon', 'Signal', 'Colony', 'Singularity', 'Drift', 'Ascension'],
  },
  Fantasy: {
    adjectives: ['Forgotten', 'Ember', 'Shattered', 'Ancient', 'Hidden', 'Last'],
    nouns: ['Kingdom', 'Throne', 'Prophecy', 'Wilds', 'Covenant', 'Realm'],
  },
  Thriller: {
    adjectives: ['Silent', 'Perfect', 'Final', 'Cold', 'Deep', 'Blind'],
    nouns: ['Witness', 'Alibi', 'Pursuit', 'Deception', 'Countdown', 'Informant'],
  },
};
