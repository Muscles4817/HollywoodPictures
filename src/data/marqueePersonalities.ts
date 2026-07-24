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

  // --- Directors (second wave) --------------------------------------------

  // The prolific, decisive workhorse - fast, efficient, never idle.
  'real-director-ridley-scott': {
    professionalism: 96, ego: 70,
    ambition: 88, loyalty: 68, temperament: 68, pressureHandling: 90, controversy: 18, adaptability: 58,
  },
  // Meticulous storyboarder - every frame planned, warm on set, exacting on the cut.
  'real-director-bong-joon-ho': {
    professionalism: 93, ego: 48,
    ambition: 78, loyalty: 78, temperament: 74, pressureHandling: 80, controversy: 8, adaptability: 30,
  },
  // "The Emperor" - a towering, uncompromising perfectionist.
  'real-director-akira-kurosawa': {
    professionalism: 96, ego: 75,
    ambition: 80, loyalty: 70, temperament: 56, pressureHandling: 80, controversy: 12, adaptability: 12,
  },
  // The fifty-takes control freak - obsessive, exact, immovable.
  'real-director-david-fincher': {
    professionalism: 94, ego: 82,
    ambition: 82, loyalty: 66, temperament: 56, pressureHandling: 86, controversy: 15, adaptability: 8,
  },
  // The combative visionary - grand ambition, forever at war with the studio.
  'real-director-orson-welles': {
    professionalism: 88, ego: 92,
    ambition: 94, loyalty: 44, temperament: 34, pressureHandling: 62, controversy: 46, adaptability: 30,
  },
  // The intense American auteur - sprawling ambition, an exacting hand.
  'real-director-paul-thomas-anderson': {
    professionalism: 93, ego: 65,
    ambition: 84, loyalty: 74, temperament: 60, pressureHandling: 78, controversy: 12, adaptability: 34,
  },
  // The technical perfectionist - long takes, immaculate craft, calm command.
  'real-director-alfonso-cuar-n': {
    professionalism: 93, ego: 52,
    ambition: 80, loyalty: 72, temperament: 74, pressureHandling: 82, controversy: 8, adaptability: 28,
  },
  // The warm monster-maker - generous, loyal, a beloved mentor to young filmmakers.
  'real-director-guillermo-del-toro': {
    professionalism: 92, ego: 50,
    ambition: 78, loyalty: 86, temperament: 76, pressureHandling: 76, controversy: 8, adaptability: 55,
  },
  // Thoughtful, sharp, collaborative - a precise builder of dread.
  'real-director-jordan-peele': {
    professionalism: 90, ego: 50,
    ambition: 82, loyalty: 78, temperament: 74, pressureHandling: 76, controversy: 14, adaptability: 58,
  },
  // The outspoken firebrand - passionate, political, unmistakably himself.
  'real-director-spike-lee': {
    professionalism: 90, ego: 72,
    ambition: 84, loyalty: 80, temperament: 52, pressureHandling: 72, controversy: 56, adaptability: 46,
  },
  // The fastidious miniaturist - obsessive symmetry, a singular, unbending style.
  'real-director-wes-anderson': {
    professionalism: 92, ego: 60,
    ambition: 72, loyalty: 84, temperament: 76, pressureHandling: 76, controversy: 6, adaptability: 12,
  },
  // Fearless and composed - tackles the hardest subjects, steady under fire.
  'real-director-kathryn-bigelow': {
    professionalism: 90, ego: 58,
    ambition: 84, loyalty: 68, temperament: 74, pressureHandling: 90, controversy: 24, adaptability: 50,
  },
  // The sharp-witted master - versatile, cynical, effortlessly professional.
  'real-director-billy-wilder': {
    professionalism: 95, ego: 65,
    ambition: 78, loyalty: 74, temperament: 66, pressureHandling: 84, controversy: 18, adaptability: 55,
  },
  // The grueling ordeal-seeker - punishing shoots in pursuit of the sublime.
  'real-director-alejandro-gonz-lez-i-rritu': {
    professionalism: 92, ego: 68,
    ambition: 90, loyalty: 58, temperament: 48, pressureHandling: 76, controversy: 22, adaptability: 26,
  },

  // --- Lead actors (second wave) ------------------------------------------

  // The tireless showman - disciplined, gracious, beloved on every set.
  'real-lead-actor-hugh-jackman': {
    professionalism: 97, ego: 16,
    ambition: 78, loyalty: 86, temperament: 84, pressureHandling: 86, controversy: 4, adaptability: 66,
  },
  // The megawatt professional - warm, steady, drama-free.
  'real-lead-actor-julia-roberts': {
    professionalism: 93, ego: 28,
    ambition: 62, loyalty: 78, temperament: 76, pressureHandling: 80, controversy: 8, adaptability: 55,
  },
  // Savvy and composed - a shrewd operator who'll stand her ground.
  'real-lead-actor-scarlett-johansson': {
    professionalism: 92, ego: 32,
    ambition: 80, loyalty: 62, temperament: 70, pressureHandling: 82, controversy: 22, adaptability: 55,
  },
  // The theatrical firebrand - operatic, intense, given to the big swing.
  'real-lead-actor-al-pacino': {
    professionalism: 82, ego: 55,
    ambition: 60, loyalty: 74, temperament: 54, pressureHandling: 70, controversy: 18, adaptability: 42,
  },
  // The extreme transformer - punishing method, ferocious commitment, a short fuse.
  'real-lead-actor-christian-bale': {
    professionalism: 86, ego: 48,
    ambition: 76, loyalty: 60, temperament: 40, pressureHandling: 72, controversy: 34, adaptability: 22,
  },
  // The elegant chameleon - immense range, universally respected.
  'real-lead-actor-cate-blanchett': {
    professionalism: 96, ego: 22,
    ambition: 70, loyalty: 78, temperament: 82, pressureHandling: 86, controversy: 8, adaptability: 54,
  },
  // Prolific and daring - unafraid of the risky role, composed throughout.
  'real-lead-actor-nicole-kidman': {
    professionalism: 94, ego: 30,
    ambition: 82, loyalty: 64, temperament: 76, pressureHandling: 82, controversy: 14, adaptability: 62,
  },
  // The revered elder - a knighted stage-and-screen statesman, an activist voice.
  'real-lead-actor-ian-mckellen': {
    professionalism: 97, ego: 20,
    ambition: 55, loyalty: 82, temperament: 85, pressureHandling: 86, controversy: 15, adaptability: 55,
  },
  // Larger than life - relentless drive that outgrew the screen entirely.
  'real-lead-actor-arnold-schwarzenegger': {
    professionalism: 88, ego: 42,
    ambition: 92, loyalty: 62, temperament: 74, pressureHandling: 84, controversy: 28, adaptability: 55,
  },
  // The eccentric fallen idol - magnetic, erratic, and mired in very public scandal.
  'real-lead-actor-johnny-depp': {
    professionalism: 84, ego: 70,
    ambition: 58, loyalty: 55, temperament: 42, pressureHandling: 55, controversy: 78, adaptability: 60,
  },
  // The meticulous method man - brilliant, exacting, and famously tricky.
  'real-lead-actor-dustin-hoffman': {
    professionalism: 94, ego: 65,
    ambition: 68, loyalty: 66, temperament: 48, pressureHandling: 72, controversy: 28, adaptability: 28,
  },
  // The eternal professional - prolific, gracious, quietly wry.
  'real-lead-actor-michael-caine': {
    professionalism: 96, ego: 18,
    ambition: 60, loyalty: 84, temperament: 85, pressureHandling: 86, controversy: 6, adaptability: 60,
  },
  // The elusive prankster - unpredictable, off-script, impossible to pin down.
  'real-lead-actor-bill-murray': {
    professionalism: 68, ego: 45,
    ambition: 45, loyalty: 55, temperament: 44, pressureHandling: 62, controversy: 46, adaptability: 78,
  },
  // Fiercely independent - principled, unfussy, allergic to nonsense.
  'real-lead-actor-frances-mcdormand': {
    professionalism: 96, ego: 30,
    ambition: 60, loyalty: 80, temperament: 70, pressureHandling: 84, controversy: 16, adaptability: 45,
  },
  // Gruff and intense - a formidable pro with a notoriously short temper.
  'real-lead-actor-gene-hackman': {
    professionalism: 94, ego: 55,
    ambition: 60, loyalty: 62, temperament: 40, pressureHandling: 78, controversy: 22, adaptability: 40,
  },
  // The beloved dame - razor-sharp, warm, endlessly game.
  'real-lead-actor-judi-dench': {
    professionalism: 96, ego: 35,
    ambition: 55, loyalty: 82, temperament: 84, pressureHandling: 86, controversy: 6, adaptability: 55,
  },
  // The immersive talent gone too soon - intense, private, all-in.
  'real-lead-actor-heath-ledger': {
    professionalism: 92, ego: 48,
    ambition: 74, loyalty: 62, temperament: 54, pressureHandling: 60, controversy: 20, adaptability: 38,
  },
  // The vanishing chameleon - a wild youth channelled into total transformation.
  'real-lead-actor-gary-oldman': {
    professionalism: 93, ego: 32,
    ambition: 68, loyalty: 70, temperament: 60, pressureHandling: 78, controversy: 26, adaptability: 40,
  },
  // The charming statesman - easygoing, loyal, a natural leader of the ensemble.
  'real-lead-actor-george-clooney': {
    professionalism: 92, ego: 40,
    ambition: 72, loyalty: 84, temperament: 82, pressureHandling: 86, controversy: 20, adaptability: 68,
  },
  // The fearless producer-star - tough, transformative, relentlessly driven.
  'real-lead-actor-charlize-theron': {
    professionalism: 91, ego: 40,
    ambition: 84, loyalty: 66, temperament: 66, pressureHandling: 84, controversy: 14, adaptability: 56,
  },

  // --- Supporting actors --------------------------------------------------

  // The consummate craftsman - dedicated, warm, endlessly reliable.
  'real-supporting-actor-bryan-cranston': {
    professionalism: 95, ego: 19,
    ambition: 70, loyalty: 82, temperament: 82, pressureHandling: 84, controversy: 6, adaptability: 60,
  },
  // The intense genius - brilliant, immersive, quietly troubled.
  'real-supporting-actor-philip-seymour-hoffman': {
    professionalism: 96, ego: 45,
    ambition: 68, loyalty: 68, temperament: 55, pressureHandling: 64, controversy: 30, adaptability: 32,
  },
  // The dignified classicist - warm, commanding, beloved.
  'real-supporting-actor-patrick-stewart': {
    professionalism: 97, ego: 18,
    ambition: 58, loyalty: 84, temperament: 85, pressureHandling: 86, controversy: 6, adaptability: 55,
  },
  // The singular oddball - idiosyncratic, unpredictable, one of a kind.
  'real-supporting-actor-christopher-walken': {
    professionalism: 88, ego: 55,
    ambition: 54, loyalty: 60, temperament: 58, pressureHandling: 70, controversy: 22, adaptability: 74,
  },
  // The fearless workhorse - prolific, game for anything, art-house to blockbuster.
  'real-supporting-actor-willem-dafoe': {
    professionalism: 95, ego: 22,
    ambition: 78, loyalty: 72, temperament: 72, pressureHandling: 82, controversy: 14, adaptability: 64,
  },
  // The mo-cap pioneer - technically obsessive, generous, a true collaborator.
  'real-supporting-actor-andy-serkis': {
    professionalism: 95, ego: 20,
    ambition: 78, loyalty: 82, temperament: 80, pressureHandling: 82, controversy: 6, adaptability: 60,
  },
  // The eternally affable - the easiest hang in the business, quick off the cuff.
  'real-supporting-actor-paul-rudd': {
    professionalism: 95, ego: 12,
    ambition: 58, loyalty: 84, temperament: 88, pressureHandling: 82, controversy: 4, adaptability: 80,
  },
  // The graceful thinker - measured, thoughtful, deeply respected.
  'real-supporting-actor-mahershala-ali': {
    professionalism: 97, ego: 15,
    ambition: 66, loyalty: 82, temperament: 84, pressureHandling: 84, controversy: 6, adaptability: 55,
  },

  // --- Writers -------------------------------------------------------------

  // The rapid-fire perfectionist - dazzling dialogue, strong opinions, exact to the word.
  'real-writer-aaron-sorkin': {
    professionalism: 89, ego: 64,
    ambition: 82, loyalty: 62, temperament: 58, pressureHandling: 72, controversy: 26, adaptability: 20,
  },
  // The sharp fresh voice - witty, fearless, gleefully subversive.
  'real-writer-phoebe-waller-bridge': {
    professionalism: 91, ego: 32,
    ambition: 82, loyalty: 68, temperament: 72, pressureHandling: 72, controversy: 16, adaptability: 72,
  },
  // The empire-builder - astonishingly prolific, macho, forever launching the next thing.
  'real-writer-taylor-sheridan': {
    professionalism: 90, ego: 58,
    ambition: 92, loyalty: 60, temperament: 62, pressureHandling: 78, controversy: 24, adaptability: 44,
  },
  // The legendary craftsman - sharp, wise, "nobody knows anything."
  'real-writer-william-goldman': {
    professionalism: 77, ego: 53,
    ambition: 64, loyalty: 62, temperament: 64, pressureHandling: 72, controversy: 18, adaptability: 50,
  },

  // --- Cinematographers ----------------------------------------------------

  // The humble master - naturalistic, meticulous, the most respected eye in the room.
  'real-cinematographer-roger-deakins': {
    professionalism: 98, ego: 24,
    ambition: 62, loyalty: 86, temperament: 84, pressureHandling: 86, controversy: 4, adaptability: 40,
  },
  // The natural-light purist - a long-take innovator who refuses to compromise the frame.
  'real-cinematographer-emmanuel-lubezki': {
    professionalism: 95, ego: 28,
    ambition: 80, loyalty: 74, temperament: 74, pressureHandling: 82, controversy: 6, adaptability: 24,
  },

  // --- Composers -----------------------------------------------------------

  // The restless innovator - big personality, collaborative, forever reinventing the score.
  'real-composer-hans-zimmer': {
    professionalism: 95, ego: 38,
    ambition: 86, loyalty: 82, temperament: 74, pressureHandling: 80, controversy: 8, adaptability: 62,
  },
  // The beloved maestro - disciplined, gracious, the sound of a century of cinema.
  'real-composer-john-williams': {
    professionalism: 98, ego: 22,
    ambition: 62, loyalty: 88, temperament: 86, pressureHandling: 88, controversy: 4, adaptability: 45,
  },
};
