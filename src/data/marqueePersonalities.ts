import type { PersonPersonality } from '../types';

// Hand-authored personalities for the genuinely recognisable marquee names.
//
// The long tail of the handcrafted roster (data/handcraftedTalents.ts) has its
// personality DERIVED from its existing reputation stats at pool-assembly time
// (engine/personality.ts:resolveHandcraftedPersonality) - a coherent default,
// but a stochastic archetype draw. For the faces everyone can picture, a
// wrong-feeling personality reads as flat-out wrong, so those are authored here
// by hand and win over the derivation.
//
// Keyed by the person's stable `real-…` id. professionalism and ego repeat the
// values already in the roster data (an override replaces the whole personality
// object); the other six axes are the authoring. Axes, all 0-100:
//   ambition          drive for the next, bigger thing
//   loyalty           sticks with collaborators / a studio vs chases the deal
//   temperament       even-keeled (high) vs volatile, short-fused (low)
//   pressureHandling  calm and reliable under fire (high)
//   controversy       trouble/scandal follows (high)
//   adaptability      flexible on set (high) vs exacting, rigid, one-way (low)
//
// These feed engine/personTraits.ts, so the comment on each names the read it's
// built to produce. Unflattering is fine and intended - a demanding tyrant or a
// scandal magnet is a truer, more interesting hire than another flat saint (and
// the game ships with invented names regardless).
export const MARQUEE_PERSONALITIES: Record<string, PersonPersonality> = {
  // --- Directors -----------------------------------------------------------

  // The beloved craftsman-statesman: driven, endlessly reliable, a mentor.
  'real-director-steven-spielberg': {
    professionalism: 98, ego: 19,
    ambition: 72, loyalty: 85, temperament: 82, pressureHandling: 90, controversy: 6, adaptability: 68,
  },
  // The exacting auteur - shoots on film, no compromises. Perfectionist, not a diva.
  'real-director-christopher-nolan': {
    professionalism: 96, ego: 90,
    ambition: 88, loyalty: 72, temperament: 60, pressureHandling: 88, controversy: 10, adaptability: 15,
  },
  // The demanding genius: colossal ambition, a famously punishing set. Difficult AND perfectionist.
  'real-director-james-cameron': {
    professionalism: 88, ego: 98,
    ambition: 96, loyalty: 58, temperament: 28, pressureHandling: 86, controversy: 20, adaptability: 12,
  },
  // Passionate auteur with a loyal regular troupe; exacting but not volatile.
  'real-director-martin-scorsese': {
    professionalism: 94, ego: 82,
    ambition: 80, loyalty: 88, temperament: 64, pressureHandling: 82, controversy: 10, adaptability: 34,
  },
  // The legendary controlling perfectionist - forty takes, total command.
  'real-director-stanley-kubrick': {
    professionalism: 96, ego: 90,
    ambition: 82, loyalty: 52, temperament: 55, pressureHandling: 88, controversy: 15, adaptability: 8,
  },
  // Meticulous master of suspense; a controlling hand, a provocateur's streak.
  'real-director-alfred-hitchcock': {
    professionalism: 96, ego: 80,
    ambition: 78, loyalty: 55, temperament: 52, pressureHandling: 85, controversy: 46, adaptability: 20,
  },
  // Singular, verbose stylist with a devoted troupe and a taste for provocation.
  'real-director-quentin-tarantino': {
    professionalism: 90, ego: 88,
    ambition: 82, loyalty: 80, temperament: 56, pressureHandling: 80, controversy: 50, adaptability: 28,
  },
  // The explosive commercial machine: big, loud, and hard to be around.
  'real-director-michael-bay': {
    professionalism: 84, ego: 88,
    ambition: 90, loyalty: 44, temperament: 26, pressureHandling: 80, controversy: 40, adaptability: 48,
  },
  // Revered, gruff perfectionist - hand-drawn frame by frame, uncompromising.
  'real-director-hayao-miyazaki': {
    professionalism: 96, ego: 60,
    ambition: 70, loyalty: 82, temperament: 58, pressureHandling: 82, controversy: 6, adaptability: 14,
  },
  // Calm, collaborative world-builder with grand ambition.
  'real-director-denis-villeneuve': {
    professionalism: 94, ego: 55,
    ambition: 84, loyalty: 78, temperament: 80, pressureHandling: 86, controversy: 6, adaptability: 46,
  },
  // Warm, collaborative, ambitious - actors love the room she gives.
  'real-director-greta-gerwig': {
    professionalism: 90, ego: 45,
    ambition: 82, loyalty: 80, temperament: 80, pressureHandling: 76, controversy: 8, adaptability: 66,
  },
  // The grand gambler - swings for the fences, a genuine risk-taker.
  'real-director-francis-ford-coppola': {
    professionalism: 95, ego: 80,
    ambition: 94, loyalty: 68, temperament: 55, pressureHandling: 64, controversy: 28, adaptability: 62,
  },

  // --- Actors --------------------------------------------------------------

  // Relentless, does-his-own-stunts machine; a controlling perfectionist with a controversial faith.
  'real-lead-actor-tom-cruise': {
    professionalism: 98, ego: 82,
    ambition: 98, loyalty: 66, temperament: 62, pressureHandling: 96, controversy: 42, adaptability: 40,
  },
  // Everyone's beloved everyman - a generous, unflappable mentor.
  'real-lead-actor-tom-hanks': {
    professionalism: 98, ego: 12,
    ambition: 55, loyalty: 88, temperament: 88, pressureHandling: 86, controversy: 4, adaptability: 68,
  },
  // Committed, selective, an activist streak that occasionally draws heat.
  'real-lead-actor-leonardo-dicaprio': {
    professionalism: 90, ego: 72,
    ambition: 85, loyalty: 74, temperament: 64, pressureHandling: 80, controversy: 30, adaptability: 44,
  },
  // The comeback king: quick-witted improviser, a scandal firmly in the past.
  'real-lead-actor-robert-downey-jr': {
    professionalism: 83, ego: 74,
    ambition: 80, loyalty: 72, temperament: 58, pressureHandling: 78, controversy: 40, adaptability: 80,
  },
  // The consummate chameleon - deep-diving craft, universally respected.
  'real-lead-actor-meryl-streep': {
    professionalism: 98, ego: 15,
    ambition: 62, loyalty: 82, temperament: 86, pressureHandling: 85, controversy: 6, adaptability: 52,
  },
  // Commanding, principled professional; steady as a rock.
  'real-lead-actor-denzel-washington': {
    professionalism: 95, ego: 58,
    ambition: 72, loyalty: 80, temperament: 74, pressureHandling: 86, controversy: 10, adaptability: 44,
  },
  // Easygoing megastar with a tabloid shadow.
  'real-lead-actor-brad-pitt': {
    professionalism: 89, ego: 60,
    ambition: 70, loyalty: 70, temperament: 70, pressureHandling: 76, controversy: 44, adaptability: 62,
  },
  // The internet's nicest man - humble, generous, private about it.
  'real-lead-actor-keanu-reeves': {
    professionalism: 94, ego: 18,
    ambition: 52, loyalty: 86, temperament: 88, pressureHandling: 82, controversy: 4, adaptability: 64,
  },
  // The immersive master - intense, principled, a total transformer of a role.
  'real-lead-actor-robert-de-niro': {
    professionalism: 85, ego: 50,
    ambition: 64, loyalty: 84, temperament: 60, pressureHandling: 74, controversy: 46, adaptability: 36,
  },
  // The volcanic genius - transcendent and notoriously impossible.
  'real-lead-actor-marlon-brando': {
    professionalism: 92, ego: 88,
    ambition: 52, loyalty: 38, temperament: 24, pressureHandling: 58, controversy: 56, adaptability: 28,
  },
  // The charismatic wild card - larger than life, gleefully unpredictable.
  'real-lead-actor-jack-nicholson': {
    professionalism: 94, ego: 80,
    ambition: 64, loyalty: 68, temperament: 46, pressureHandling: 78, controversy: 46, adaptability: 60,
  },
  // The definitive method perfectionist - lives the role, exacting to the last frame.
  'real-lead-actor-daniel-day-lewis': {
    professionalism: 97, ego: 72,
    ambition: 70, loyalty: 64, temperament: 60, pressureHandling: 80, controversy: 8, adaptability: 10,
  },
  // The hardest-working brand in the business - relentless crowd-pleaser.
  'real-lead-actor-dwayne-johnson': {
    professionalism: 92, ego: 38,
    ambition: 92, loyalty: 70, temperament: 80, pressureHandling: 86, controversy: 14, adaptability: 60,
  },
  // Candid, relatable, occasionally foot-in-mouth - but no real trouble.
  'real-lead-actor-jennifer-lawrence': {
    professionalism: 86, ego: 34,
    ambition: 68, loyalty: 68, temperament: 62, pressureHandling: 66, controversy: 34, adaptability: 74,
  },
  // Magnetic star turned volatile - a public temper and a real scandal.
  'real-lead-actor-will-smith': {
    professionalism: 82, ego: 40,
    ambition: 80, loyalty: 66, temperament: 34, pressureHandling: 54, controversy: 74, adaptability: 62,
  },
  // The dignified elder statesman - calm, gracious, a natural mentor.
  'real-lead-actor-morgan-freeman': {
    professionalism: 93, ego: 24,
    ambition: 50, loyalty: 80, temperament: 84, pressureHandling: 86, controversy: 12, adaptability: 58,
  },
  // The unstoppable workhorse - prolific, cool, unmistakably himself.
  'real-lead-actor-samuel-l-jackson': {
    professionalism: 94, ego: 28,
    ambition: 82, loyalty: 82, temperament: 72, pressureHandling: 86, controversy: 24, adaptability: 70,
  },
  // The precise, serene master - unhurried, exact, deeply respected.
  'real-lead-actor-anthony-hopkins': {
    professionalism: 96, ego: 20,
    ambition: 54, loyalty: 72, temperament: 84, pressureHandling: 86, controversy: 8, adaptability: 42,
  },
  // Gruff, dependable, no-nonsense - a pro who suffers no fuss.
  'real-lead-actor-harrison-ford': {
    professionalism: 92, ego: 24,
    ambition: 54, loyalty: 78, temperament: 60, pressureHandling: 82, controversy: 14, adaptability: 48,
  },
  // Efficient stoic - one or two takes, calm command, a divisive public voice.
  'real-lead-actor-clint-eastwood': {
    professionalism: 95, ego: 55,
    ambition: 68, loyalty: 80, temperament: 74, pressureHandling: 90, controversy: 40, adaptability: 54,
  },
  // Warm, steady professional - a set everyone wants to be on.
  'real-lead-actor-sandra-bullock': {
    professionalism: 95, ego: 20,
    ambition: 60, loyalty: 82, temperament: 84, pressureHandling: 84, controversy: 6, adaptability: 64,
  },
  // The quick-witted improviser - relentless self-promoter, charming with it.
  'real-lead-actor-ryan-reynolds': {
    professionalism: 91, ego: 56,
    ambition: 84, loyalty: 70, temperament: 74, pressureHandling: 80, controversy: 16, adaptability: 86,
  },
  // Grounded, dependable, drama-free - a producer's dream lead.
  'real-lead-actor-matt-damon': {
    professionalism: 95, ego: 28,
    ambition: 68, loyalty: 84, temperament: 80, pressureHandling: 84, controversy: 14, adaptability: 58,
  },
  // The hungry young prodigy - versatile, ravenous, still climbing.
  'real-lead-actor-timothee-chalamet': {
    professionalism: 93, ego: 32,
    ambition: 84, loyalty: 60, temperament: 68, pressureHandling: 70, controversy: 14, adaptability: 78,
  },
};
