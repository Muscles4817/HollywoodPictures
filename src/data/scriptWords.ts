import type { Genre } from '../types';

// Word banks used to procedurally suggest a script title per genre.
// Titles are flavor only; they don't affect scoring. Kept fairly large
// (12x12 = 144 combinations per genre) so a 12-script slate doesn't run
// into heavy repetition - engine/scriptGenerator.ts also dedupes titles
// within a single slate on top of this.
export const SCRIPT_TITLE_WORDS: Record<Genre, { adjectives: string[]; nouns: string[] }> = {
  Action: {
    adjectives: ['Last', 'Broken', 'Silent', 'Iron', 'Final', 'Rogue', 'Savage', 'Brutal', 'Relentless', 'Merciless', 'Scorched', 'Fractured'],
    nouns: ['Protocol', 'Reckoning', 'Strike', 'Vendetta', 'Convoy', 'Gauntlet', 'Ambush', 'Warzone', 'Offensive', 'Payback', 'Blitz', 'Siege'],
  },
  Comedy: {
    adjectives: ['Awkward', 'Accidental', 'Unlikely', 'Reluctant', 'Terrible', 'Lucky', 'Clumsy', 'Ridiculous', 'Chaotic', 'Hopeless', 'Questionable', 'Improbable'],
    nouns: ['Wedding', 'Roommates', 'Heist', 'Reunion', 'Internship', 'Getaway', 'Disaster', 'Vacation', 'Proposal', 'Startup', 'Roadtrip', 'Makeover'],
  },
  Drama: {
    adjectives: ['Quiet', 'Distant', 'Unspoken', 'Fading', 'Ordinary', 'Longest', 'Fragile', 'Unfinished', 'Weathered', 'Hushed', 'Lingering', 'Broken'],
    nouns: ['Harvest', 'Letters', 'Homecoming', 'Season', 'Inheritance', 'River', 'Silence', 'Departure', 'Vigil', 'Absence', 'Threshold', 'Reckoning'],
  },
  Horror: {
    adjectives: ['Hollow', 'Whispering', 'Cursed', 'Buried', 'Nameless', 'Rotting', 'Silent', 'Feral', 'Unseen', 'Forsaken', 'Crawling', 'Withered'],
    nouns: ['Basement', 'Static', 'Orchard', 'Lodge', 'Tenants', 'Cellar', 'Marsh', 'Attic', 'Sanatorium', 'Nursery', 'Hollow', 'Crypt'],
  },
  Romance: {
    adjectives: ['Sweet', 'Almost', 'Second', 'Endless', 'Quiet', 'Unexpected', 'Tender', 'Fleeting', 'Familiar', 'Golden', 'Gentle', 'Belated'],
    nouns: ['Summer', 'Letter', 'Chance', 'Encore', 'Distance', 'Promise', 'Reunion', 'Heartbeat', 'Vow', 'Season', 'Rendezvous', 'Goodbye'],
  },
  'Sci-Fi': {
    adjectives: ['Distant', 'Fractured', 'Last', 'Silent', 'Beyond', 'Null', 'Frozen', 'Synthetic', 'Forgotten', 'Quantum', 'Dying', 'Endless'],
    nouns: ['Horizon', 'Signal', 'Colony', 'Singularity', 'Drift', 'Ascension', 'Protocol', 'Frontier', 'Anomaly', 'Genesis', 'Eclipse', 'Vector'],
  },
  Fantasy: {
    adjectives: ['Forgotten', 'Ember', 'Shattered', 'Ancient', 'Hidden', 'Last', 'Silver', 'Cursed', 'Eternal', 'Wandering', 'Sacred', 'Broken'],
    nouns: ['Kingdom', 'Throne', 'Prophecy', 'Wilds', 'Covenant', 'Realm', 'Crown', 'Legend', 'Oath', 'Citadel', 'Relic', 'Descent'],
  },
  Thriller: {
    adjectives: ['Silent', 'Perfect', 'Final', 'Cold', 'Deep', 'Blind', 'Quiet', 'Fractured', 'Precise', 'Buried', 'Calculated', 'Vanishing'],
    nouns: ['Witness', 'Alibi', 'Pursuit', 'Deception', 'Countdown', 'Informant', 'Suspect', 'Surveillance', 'Confession', 'Blackout', 'Trigger', 'Leverage'],
  },
};
