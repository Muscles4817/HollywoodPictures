import type { Genre } from '../types';

// Word banks used to procedurally build a script title per genre. Titles are
// flavor only; they don't affect scoring. The generator (engine/titleGenerator.ts)
// draws these through a set of weighted *structural* templates - single word,
// "The ___", "___ of the ___", possessive, colon subtitle, and so on - rather
// than the single "Adjective Noun" shape it used to be limited to, so a slate
// reads with the structural variety real film titles have. See
// engine/titleGenerator.ts for the templates each bank feeds.
export interface GenreTitleBank {
  /** Standalone one-word titles - the single most common real shape (Jaws, Whiplash, Gravity). */
  singles: string[];
  /** Modifiers for "[The] {adjective} {noun}" / "A {adjective} {noun}" shapes. */
  adjectives: string[];
  /** Head nouns for "The {noun}", "{adjective} {noun}", "{noun} of the ___", possessives, prepositions. */
  nouns: string[];
  /** Reads well after "... of the ___" (substantivized: "of the Damned", "of the Fallen"). */
  ofTails: string[];
  /** Reads well in "{pair} and {pair}" (Blood and Iron, Love and Letters). */
  pairs: string[];
}

export const SCRIPT_TITLE_WORDS: Record<Genre, GenreTitleBank> = {
  Action: {
    singles: ['Ronin', 'Vendetta', 'Fallout', 'Crossfire', 'Extraction', 'Lockdown', 'Aftermath', 'Manhunt', 'Overkill', 'Warpath', 'Blindside', 'Kingpin'],
    adjectives: ['Last', 'Broken', 'Silent', 'Iron', 'Final', 'Rogue', 'Savage', 'Brutal', 'Relentless', 'Merciless', 'Scorched', 'Fractured'],
    nouns: ['Protocol', 'Reckoning', 'Strike', 'Vendetta', 'Convoy', 'Gauntlet', 'Ambush', 'Warzone', 'Offensive', 'Payback', 'Blitz', 'Siege'],
    ofTails: ['Damned', 'Fallen', 'Forsaken', 'Lost', 'Hunted', 'Wicked', 'Doomed', 'Condemned'],
    pairs: ['Blood', 'Iron', 'Fire', 'Ash', 'Steel', 'Dust', 'Smoke', 'Lead'],
  },
  Comedy: {
    singles: ['Meltdown', 'Overboard', 'Sidekicks', 'Freeloaders', 'Newlyweds', 'Layover', 'Misfire', 'Rebound', 'Mayhem', 'Shenanigans', 'Roomies', 'Unhinged'],
    adjectives: ['Awkward', 'Accidental', 'Unlikely', 'Reluctant', 'Terrible', 'Lucky', 'Clumsy', 'Ridiculous', 'Chaotic', 'Hopeless', 'Questionable', 'Improbable'],
    nouns: ['Wedding', 'Roommates', 'Heist', 'Reunion', 'Internship', 'Getaway', 'Disaster', 'Vacation', 'Proposal', 'Startup', 'Roadtrip', 'Makeover'],
    ofTails: ['Clueless', 'Desperate', 'Hopeless', 'Unqualified', 'Unprepared', 'Reluctant', 'Ridiculous', 'Bewildered'],
    pairs: ['Love', 'Chaos', 'Lies', 'Money', 'Trouble', 'Mayhem', 'Nonsense', 'Disaster'],
  },
  Drama: {
    singles: ['Homecoming', 'Inheritance', 'Undertow', 'Threshold', 'Aftermath', 'Kinfolk', 'Provenance', 'Remnants', 'Nightfall', 'Reckoning', 'Driftwood', 'Estrangement'],
    adjectives: ['Quiet', 'Distant', 'Unspoken', 'Fading', 'Ordinary', 'Longest', 'Fragile', 'Unfinished', 'Weathered', 'Hushed', 'Lingering', 'Broken'],
    nouns: ['Harvest', 'Letters', 'Homecoming', 'Season', 'Inheritance', 'River', 'Silence', 'Departure', 'Vigil', 'Absence', 'Threshold', 'Reckoning'],
    ofTails: ['Forgotten', 'Faithful', 'Fallen', 'Departed', 'Silent', 'Broken', 'Weary', 'Bereaved'],
    pairs: ['Salt', 'Ash', 'Rain', 'Stone', 'Dust', 'Smoke', 'Bone', 'Grief'],
  },
  Horror: {
    singles: ['Nightfall', 'Rot', 'Dread', 'Revenant', 'Infestation', 'Contagion', 'Malignant', 'Wraith', 'Undergrowth', 'Hush', 'Blight', 'Vermin'],
    adjectives: ['Hollow', 'Whispering', 'Cursed', 'Buried', 'Nameless', 'Rotting', 'Silent', 'Feral', 'Unseen', 'Forsaken', 'Crawling', 'Withered'],
    nouns: ['Basement', 'Static', 'Orchard', 'Lodge', 'Tenants', 'Cellar', 'Marsh', 'Attic', 'Sanatorium', 'Nursery', 'Hollow', 'Crypt'],
    ofTails: ['Damned', 'Forsaken', 'Buried', 'Nameless', 'Feral', 'Restless', 'Unclean', 'Cursed'],
    pairs: ['Blood', 'Bone', 'Ash', 'Salt', 'Dust', 'Rot', 'Dark', 'Frost'],
  },
  Romance: {
    singles: ['Serendipity', 'Afterglow', 'Rendezvous', 'Devotion', 'Sunlit', 'Homeward', 'Beloved', 'Encore', 'Longing', 'Wildflower', 'Moonrise', 'Belonging'],
    adjectives: ['Sweet', 'Almost', 'Second', 'Endless', 'Quiet', 'Unexpected', 'Tender', 'Fleeting', 'Familiar', 'Golden', 'Gentle', 'Belated'],
    nouns: ['Summer', 'Letter', 'Chance', 'Encore', 'Distance', 'Promise', 'Reunion', 'Heartbeat', 'Vow', 'Season', 'Rendezvous', 'Goodbye'],
    ofTails: ['Faithful', 'Fleeting', 'Tender', 'Reckless', 'Lonely', 'Yearning', 'Devoted', 'Lovelorn'],
    pairs: ['Love', 'Rain', 'Roses', 'Wine', 'Summer', 'Letters', 'Autumn', 'Gold'],
  },
  'Sci-Fi': {
    singles: ['Ascension', 'Singularity', 'Eventide', 'Terminus', 'Divergence', 'Cryosleep', 'Exodus', 'Redshift', 'Aftermath', 'Halcyon', 'Interstice', 'Nadir'],
    adjectives: ['Distant', 'Fractured', 'Last', 'Silent', 'Beyond', 'Null', 'Frozen', 'Synthetic', 'Forgotten', 'Quantum', 'Dying', 'Endless'],
    nouns: ['Horizon', 'Signal', 'Colony', 'Singularity', 'Drift', 'Ascension', 'Protocol', 'Frontier', 'Anomaly', 'Genesis', 'Eclipse', 'Vector'],
    ofTails: ['Void', 'Stars', 'Fallen', 'Forgotten', 'Machine', 'Deep', 'Silence', 'Ancients'],
    pairs: ['Dust', 'Ice', 'Iron', 'Light', 'Static', 'Ash', 'Void', 'Signal'],
  },
  Fantasy: {
    singles: ['Everdark', 'Wyrmwood', 'Ashfall', 'Thornwood', 'Nevermore', 'Grimhold', 'Duskfall', 'Ironwild', 'Starfall', 'Ravensworn', 'Wildreach', 'Emberfell'],
    adjectives: ['Forgotten', 'Ember', 'Shattered', 'Ancient', 'Hidden', 'Last', 'Silver', 'Cursed', 'Eternal', 'Wandering', 'Sacred', 'Broken'],
    nouns: ['Kingdom', 'Throne', 'Prophecy', 'Wilds', 'Covenant', 'Realm', 'Crown', 'Legend', 'Oath', 'Citadel', 'Relic', 'Descent'],
    ofTails: ['Fallen', 'Forgotten', 'Ancients', 'Damned', 'Lost', 'Nameless', 'Fae', 'Wicked'],
    pairs: ['Steel', 'Ash', 'Frost', 'Ember', 'Bone', 'Gold', 'Thorn', 'Shadow'],
  },
  Thriller: {
    singles: ['Vanished', 'Aftermath', 'Pursuit', 'Countdown', 'Blackout', 'Undertow', 'Deadfall', 'Fracture', 'Deadlock', 'Manhunt', 'Nightfall', 'Ransom'],
    adjectives: ['Silent', 'Perfect', 'Final', 'Cold', 'Deep', 'Blind', 'Quiet', 'Fractured', 'Precise', 'Buried', 'Calculated', 'Vanishing'],
    nouns: ['Witness', 'Alibi', 'Pursuit', 'Deception', 'Countdown', 'Informant', 'Suspect', 'Surveillance', 'Confession', 'Blackout', 'Trigger', 'Leverage'],
    ofTails: ['Guilty', 'Innocent', 'Hunted', 'Missing', 'Silent', 'Damned', 'Forsaken', 'Wicked'],
    pairs: ['Blood', 'Lies', 'Ash', 'Smoke', 'Dust', 'Ice', 'Steel', 'Shadow'],
  },
};
