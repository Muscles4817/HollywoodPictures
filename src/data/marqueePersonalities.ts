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

  // --- Directors (third wave) ---------------------------------------------

  // The gentle humanist - versatile, emotionally attuned, quietly meticulous.
  'real-director-ang-lee': {
    professionalism: 94, ego: 45,
    ambition: 78, loyalty: 78, temperament: 80, pressureHandling: 80, controversy: 6, adaptability: 45,
  },
  // The flamboyant ringmaster - a self-mythologising maestro of spectacle.
  'real-director-federico-fellini': {
    professionalism: 92, ego: 78,
    ambition: 85, loyalty: 66, temperament: 55, pressureHandling: 70, controversy: 30, adaptability: 58,
  },
  // The stylish provocateur - precise, elegant, unflinchingly violent.
  'real-director-park-chan-wook': {
    professionalism: 90, ego: 65,
    ambition: 80, loyalty: 70, temperament: 66, pressureHandling: 78, controversy: 40, adaptability: 30,
  },
  // The epic marathoner - vast ambition, technical devotion, endless shoots.
  'real-director-peter-jackson': {
    professionalism: 90, ego: 62,
    ambition: 90, loyalty: 78, temperament: 70, pressureHandling: 80, controversy: 10, adaptability: 44,
  },
  // The relentless intensity - a driven perfectionist who demands the impossible.
  'real-director-damien-chazelle': {
    professionalism: 90, ego: 60,
    ambition: 90, loyalty: 66, temperament: 60, pressureHandling: 78, controversy: 12, adaptability: 26,
  },
  // The visionary madman - meticulous practical mayhem, a singular obsession.
  'real-director-george-miller': {
    professionalism: 90, ego: 50,
    ambition: 86, loyalty: 74, temperament: 72, pressureHandling: 82, controversy: 10, adaptability: 30,
  },
  // The serene surrealist - warm, uncompromising, guided by a private mysticism.
  'real-director-david-lynch': {
    professionalism: 88, ego: 68,
    ambition: 72, loyalty: 80, temperament: 76, pressureHandling: 72, controversy: 24, adaptability: 22,
  },
  // The reclusive poet - elusive, instinctive on set, obsessive in the cut.
  'real-director-terrence-malick': {
    professionalism: 88, ego: 62,
    ambition: 78, loyalty: 58, temperament: 72, pressureHandling: 68, controversy: 12, adaptability: 78,
  },
  // The grounded force - collaborative, principled, a natural leader of his crew.
  'real-director-ryan-coogler': {
    professionalism: 88, ego: 45,
    ambition: 84, loyalty: 84, temperament: 78, pressureHandling: 78, controversy: 8, adaptability: 56,
  },
  // The theatrical precisionist - controlled, exacting, stage-bred.
  'real-director-sam-mendes': {
    professionalism: 92, ego: 55,
    ambition: 78, loyalty: 70, temperament: 70, pressureHandling: 82, controversy: 8, adaptability: 36,
  },
  // The quiet naturalist - patient, unshowy, drawn to real faces and open skies.
  'real-director-chlo-zhao': {
    professionalism: 88, ego: 42,
    ambition: 76, loyalty: 72, temperament: 82, pressureHandling: 74, controversy: 12, adaptability: 62,
  },
  // The vibrant melodramatist - passionate, loyal to his troupe, gloriously bold.
  'real-director-pedro-almod-var': {
    professionalism: 90, ego: 60,
    ambition: 80, loyalty: 84, temperament: 62, pressureHandling: 74, controversy: 28, adaptability: 44,
  },
  // Efficient, stoic, few takes - the same calm command behind the camera.
  'real-director-clint-eastwood': {
    professionalism: 96, ego: 55,
    ambition: 68, loyalty: 82, temperament: 76, pressureHandling: 92, controversy: 36, adaptability: 55,
  },
  // The genre craftsman - efficient, inventive, a reliable builder of scares.
  'real-director-james-wan': {
    professionalism: 86, ego: 48,
    ambition: 82, loyalty: 74, temperament: 74, pressureHandling: 80, controversy: 8, adaptability: 62,
  },

  // --- Lead actors (third wave) -------------------------------------------

  // The affable strongman - hardworking, grounded, a genuine family man.
  'real-lead-actor-chris-hemsworth': {
    professionalism: 93, ego: 28,
    ambition: 72, loyalty: 80, temperament: 82, pressureHandling: 80, controversy: 6, adaptability: 66,
  },
  // The earnest gentleman - principled, humble, quietly dependable.
  'real-lead-actor-chris-evans': {
    professionalism: 93, ego: 22,
    ambition: 66, loyalty: 84, temperament: 80, pressureHandling: 78, controversy: 12, adaptability: 56,
  },
  // The brooding perfectionist - committed, private, all-business.
  'real-lead-actor-daniel-craig': {
    professionalism: 92, ego: 42,
    ambition: 70, loyalty: 72, temperament: 64, pressureHandling: 80, controversy: 14, adaptability: 44,
  },
  // The poised young multi-hyphenate - savvy, disciplined, already a veteran.
  'real-lead-actor-zendaya': {
    professionalism: 90, ego: 44,
    ambition: 82, loyalty: 74, temperament: 78, pressureHandling: 80, controversy: 10, adaptability: 66,
  },
  // The laid-back philosopher - instinctive, reinvented himself, alright alright.
  'real-lead-actor-matthew-mcconaughey': {
    professionalism: 91, ego: 34,
    ambition: 74, loyalty: 68, temperament: 74, pressureHandling: 76, controversy: 16, adaptability: 72,
  },
  // The wry, committed everyactor - low-key, versatile, quietly exacting.
  'real-lead-actor-ryan-gosling': {
    professionalism: 92, ego: 36,
    ambition: 68, loyalty: 74, temperament: 78, pressureHandling: 78, controversy: 10, adaptability: 62,
  },
  // The warm live wire - game for anything, comedic and dramatic in one breath.
  'real-lead-actor-emma-stone': {
    professionalism: 92, ego: 34,
    ambition: 72, loyalty: 74, temperament: 78, pressureHandling: 76, controversy: 8, adaptability: 82,
  },
  // The mercurial intensity - immersive, unpredictable, uninterested in the game.
  'real-lead-actor-joaquin-phoenix': {
    professionalism: 72, ego: 55,
    ambition: 70, loyalty: 54, temperament: 42, pressureHandling: 55, controversy: 40, adaptability: 46,
  },
  // The cerebral perfectionist - disciplined, private, exacting in every choice.
  'real-lead-actor-natalie-portman': {
    professionalism: 95, ego: 24,
    ambition: 74, loyalty: 74, temperament: 80, pressureHandling: 82, controversy: 8, adaptability: 48,
  },
  // The quiet intensity - precise, understated, a director's loyal instrument.
  'real-lead-actor-cillian-murphy': {
    professionalism: 95, ego: 24,
    ambition: 68, loyalty: 86, temperament: 74, pressureHandling: 80, controversy: 6, adaptability: 42,
  },
  // The fearless grounded pro - versatile, warm, unafraid of the ugly truth.
  'real-lead-actor-kate-winslet': {
    professionalism: 95, ego: 24,
    ambition: 74, loyalty: 78, temperament: 78, pressureHandling: 84, controversy: 10, adaptability: 55,
  },
  // The offbeat shapeshifter - eccentric, self-effacing, allergic to the obvious.
  'real-lead-actor-robert-pattinson': {
    professionalism: 90, ego: 28,
    ambition: 72, loyalty: 66, temperament: 68, pressureHandling: 70, controversy: 20, adaptability: 84,
  },
  // The rubber-faced improviser - manic, inventive, later restlessly philosophical.
  'real-lead-actor-jim-carrey': {
    professionalism: 78, ego: 40,
    ambition: 70, loyalty: 55, temperament: 52, pressureHandling: 62, controversy: 40, adaptability: 86,
  },
  // The graceful master - disciplined martial-arts pro, a late-career triumph.
  'real-lead-actor-michelle-yeoh': {
    professionalism: 97, ego: 15,
    ambition: 78, loyalty: 84, temperament: 84, pressureHandling: 90, controversy: 4, adaptability: 55,
  },
  // The self-made grinder - wrote his own break, endures, out-works everyone.
  'real-lead-actor-sylvester-stallone': {
    professionalism: 85, ego: 38,
    ambition: 92, loyalty: 66, temperament: 62, pressureHandling: 78, controversy: 20, adaptability: 50,
  },
  // The comedic dynamo - charismatic, riffing, magnetic when he's all in.
  'real-lead-actor-eddie-murphy': {
    professionalism: 85, ego: 35,
    ambition: 74, loyalty: 60, temperament: 64, pressureHandling: 72, controversy: 26, adaptability: 82,
  },
  // The sunny mogul - relentlessly driven, savvy, building an empire off-camera.
  'real-lead-actor-reese-witherspoon': {
    professionalism: 93, ego: 30,
    ambition: 88, loyalty: 74, temperament: 76, pressureHandling: 80, controversy: 10, adaptability: 58,
  },
  // The cool humanitarian - principled, humble, a beloved icon who gave it away.
  'real-lead-actor-paul-newman': {
    professionalism: 95, ego: 35,
    ambition: 60, loyalty: 84, temperament: 82, pressureHandling: 86, controversy: 8, adaptability: 55,
  },

  // --- Supporting actors (second wave) ------------------------------------

  // The earnest activist - warm, principled, endlessly likable.
  'real-supporting-actor-mark-ruffalo': {
    professionalism: 91, ego: 22,
    ambition: 68, loyalty: 82, temperament: 74, pressureHandling: 74, controversy: 20, adaptability: 60,
  },
  // The reliable powerhouse - versatile, intense on cue, a total pro off it.
  'real-supporting-actor-jk-simmons': {
    professionalism: 97, ego: 16,
    ambition: 66, loyalty: 84, temperament: 78, pressureHandling: 84, controversy: 6, adaptability: 58,
  },
  // The beloved dynamo - energetic, prolific, a comedic institution.
  'real-supporting-actor-danny-devito': {
    professionalism: 90, ego: 40,
    ambition: 72, loyalty: 84, temperament: 76, pressureHandling: 78, controversy: 15, adaptability: 74,
  },
  // The avant-garde chameleon - fearless, singular, transformable at will.
  'real-supporting-actor-tilda-swinton': {
    professionalism: 96, ego: 20,
    ambition: 78, loyalty: 70, temperament: 76, pressureHandling: 80, controversy: 15, adaptability: 62,
  },
  // The coiled intensity - precise, committed, a controlled burn.
  'real-supporting-actor-michael-fassbender': {
    professionalism: 88, ego: 30,
    ambition: 76, loyalty: 64, temperament: 62, pressureHandling: 76, controversy: 15, adaptability: 44,
  },
  // The urbane charmer - warm, cultured, effortlessly professional.
  'real-supporting-actor-stanley-tucci': {
    professionalism: 97, ego: 15,
    ambition: 62, loyalty: 84, temperament: 84, pressureHandling: 84, controversy: 4, adaptability: 62,
  },
  // The grounded intellect - sharp, principled, quietly commanding.
  'real-supporting-actor-don-cheadle': {
    professionalism: 95, ego: 18,
    ambition: 68, loyalty: 82, temperament: 78, pressureHandling: 82, controversy: 12, adaptability: 54,
  },
  // The affable riffer - loose, generous, a producer who never stops working.
  'real-supporting-actor-seth-rogen': {
    professionalism: 90, ego: 20,
    ambition: 78, loyalty: 80, temperament: 78, pressureHandling: 76, controversy: 22, adaptability: 84,
  },
  // The loose natural - offbeat, easy, a little wild around the edges.
  'real-supporting-actor-woody-harrelson': {
    professionalism: 88, ego: 28,
    ambition: 64, loyalty: 68, temperament: 66, pressureHandling: 72, controversy: 36, adaptability: 80,
  },
  // The rugged steady hand - intense, weathered, dependable.
  'real-supporting-actor-josh-brolin': {
    professionalism: 91, ego: 26,
    ambition: 72, loyalty: 74, temperament: 66, pressureHandling: 80, controversy: 18, adaptability: 50,
  },

  // --- Writers (second wave) ----------------------------------------------

  // The cerebral architect - structured, puzzle-minded, loyal to his collaborators.
  'real-writer-jonathan-nolan': {
    professionalism: 93, ego: 42,
    ambition: 82, loyalty: 84, temperament: 72, pressureHandling: 78, controversy: 8, adaptability: 40,
  },
  // The irreverent voice - witty, distinctive, gleefully unpolished.
  'real-writer-diablo-cody': {
    professionalism: 68, ego: 46,
    ambition: 74, loyalty: 60, temperament: 66, pressureHandling: 66, controversy: 26, adaptability: 70,
  },
  // The dependable master - prolific, unshowy, a reliable hand on any adaptation.
  'real-writer-eric-roth': {
    professionalism: 96, ego: 18,
    ambition: 66, loyalty: 84, temperament: 80, pressureHandling: 84, controversy: 6, adaptability: 50,
  },

  // --- Cinematographers (second wave) -------------------------------------

  // The painterly theorist - bold, opinionated about light and colour, exacting.
  'real-cinematographer-vittorio-storaro': {
    professionalism: 96, ego: 45,
    ambition: 80, loyalty: 70, temperament: 66, pressureHandling: 82, controversy: 15, adaptability: 30,
  },
  // Spielberg's expressive eye - devoted, precise, a lifelong collaborator.
  'real-cinematographer-janusz-kami-ski': {
    professionalism: 96, ego: 45,
    ambition: 74, loyalty: 90, temperament: 70, pressureHandling: 82, controversy: 8, adaptability: 38,
  },

  // --- Composers (second wave) --------------------------------------------

  // The quirky signature - Burton's other half, distinctive, endlessly loyal.
  'real-composer-danny-elfman': {
    professionalism: 91, ego: 34,
    ambition: 76, loyalty: 88, temperament: 66, pressureHandling: 76, controversy: 12, adaptability: 55,
  },
  // The singular melodist - prolific legend, unmistakable, quietly devoted.
  'real-composer-ennio-morricone': {
    professionalism: 69, ego: 35,
    ambition: 70, loyalty: 82, temperament: 74, pressureHandling: 78, controversy: 8, adaptability: 42,
  },

  // --- Editors ------------------------------------------------------------

  // Scorsese's lifelong editor - a devoted master of the cut, endlessly loyal.
  'real-editor-thelma-schoonmaker': {
    professionalism: 64, ego: 37,
    ambition: 58, loyalty: 92, temperament: 80, pressureHandling: 80, controversy: 4, adaptability: 46,
  },

  // --- Lead actors (fourth wave) ------------------------------------------

  // The ambitious producer-star - savvy, driven, building beyond the screen.
  'real-lead-actor-margot-robbie': {
    professionalism: 90, ego: 58,
    ambition: 88, loyalty: 70, temperament: 74, pressureHandling: 78, controversy: 12, adaptability: 66,
  },
  // The commanding old-school icon - stubborn, imposing, uncompromising.
  'real-lead-actor-sean-connery': {
    professionalism: 93, ego: 60,
    ambition: 62, loyalty: 60, temperament: 55, pressureHandling: 82, controversy: 35, adaptability: 34,
  },
  // The dignified trailblazer - principled, gracious, a quiet giant.
  'real-lead-actor-sidney-poitier': {
    professionalism: 96, ego: 30,
    ambition: 68, loyalty: 80, temperament: 82, pressureHandling: 86, controversy: 10, adaptability: 50,
  },
  // The charismatic force - versatile, driven, at ease in any register.
  'real-lead-actor-idris-elba': {
    professionalism: 92, ego: 26,
    ambition: 82, loyalty: 74, temperament: 76, pressureHandling: 80, controversy: 10, adaptability: 62,
  },
  // The fierce powerhouse - commanding, deeply committed, unafraid.
  'real-lead-actor-viola-davis': {
    professionalism: 97, ego: 20,
    ambition: 78, loyalty: 80, temperament: 74, pressureHandling: 84, controversy: 8, adaptability: 52,
  },
  // The chameleon in plain sight - versatile, dedicated, disarmingly humble.
  'real-lead-actor-amy-adams': {
    professionalism: 93, ego: 20,
    ambition: 72, loyalty: 78, temperament: 80, pressureHandling: 80, controversy: 6, adaptability: 55,
  },
  // The intense transformer - physical, ferocious, and famously hard to pin down.
  'real-lead-actor-tom-hardy': {
    professionalism: 85, ego: 38,
    ambition: 74, loyalty: 62, temperament: 44, pressureHandling: 70, controversy: 30, adaptability: 44,
  },
  // The steady gravitas - dependable, warm, a surprise late-career action star.
  'real-lead-actor-liam-neeson': {
    professionalism: 93, ego: 20,
    ambition: 66, loyalty: 78, temperament: 78, pressureHandling: 84, controversy: 16, adaptability: 55,
  },
  // The driven multi-hyphenate - ambitious, meticulous, always chasing the next mode.
  'real-lead-actor-bradley-cooper': {
    professionalism: 88, ego: 30,
    ambition: 88, loyalty: 70, temperament: 68, pressureHandling: 78, controversy: 10, adaptability: 55,
  },
  // The tireless daredevil - does his own stunts, endlessly game, beloved worldwide.
  'real-lead-actor-jackie-chan': {
    professionalism: 92, ego: 20,
    ambition: 82, loyalty: 78, temperament: 78, pressureHandling: 86, controversy: 16, adaptability: 68,
  },
  // The gifted rollercoaster - talented and uneven, lived very publicly.
  'real-lead-actor-ben-affleck': {
    professionalism: 88, ego: 45,
    ambition: 78, loyalty: 66, temperament: 52, pressureHandling: 62, controversy: 36, adaptability: 55,
  },
  // The soulful naturalist - laid-back, dependable, quietly masterful.
  'real-lead-actor-jeff-bridges': {
    professionalism: 92, ego: 30,
    ambition: 58, loyalty: 82, temperament: 84, pressureHandling: 82, controversy: 8, adaptability: 66,
  },
  // The dignified leading man - dedicated, gracious, quietly heroic.
  'real-lead-actor-chadwick-boseman': {
    professionalism: 92, ego: 40,
    ambition: 78, loyalty: 82, temperament: 78, pressureHandling: 80, controversy: 6, adaptability: 52,
  },
  // The witty polymath - sharp, principled, a writer's actor.
  'real-lead-actor-emma-thompson': {
    professionalism: 94, ego: 35,
    ambition: 68, loyalty: 74, temperament: 74, pressureHandling: 80, controversy: 20, adaptability: 58,
  },
  // The formidable intensity - fearless, committed, a force on any stage.
  'real-lead-actor-glenn-close': {
    professionalism: 94, ego: 40,
    ambition: 74, loyalty: 72, temperament: 66, pressureHandling: 82, controversy: 12, adaptability: 48,
  },
  // The nuanced fearless one - subtle, composed, drawn to the difficult role.
  'real-lead-actor-julianne-moore': {
    professionalism: 93, ego: 35,
    ambition: 70, loyalty: 74, temperament: 78, pressureHandling: 80, controversy: 12, adaptability: 55,
  },
  // The brilliant comic mind - inventive, wry, effortlessly multi-talented.
  'real-lead-actor-steve-martin': {
    professionalism: 90, ego: 40,
    ambition: 72, loyalty: 74, temperament: 76, pressureHandling: 78, controversy: 12, adaptability: 78,
  },
  // The hungry producer-star - relentlessly ambitious, building his own lane.
  'real-lead-actor-michael-b-jordan': {
    professionalism: 89, ego: 42,
    ambition: 88, loyalty: 72, temperament: 72, pressureHandling: 76, controversy: 10, adaptability: 58,
  },
  // The brilliant control freak - rewrites the script, exacting, hard to direct.
  'real-lead-actor-edward-norton': {
    professionalism: 90, ego: 72,
    ambition: 80, loyalty: 55, temperament: 34, pressureHandling: 72, controversy: 25, adaptability: 22,
  },
  // The precise classicist - intense, disciplined, quietly commanding.
  'real-lead-actor-ralph-fiennes': {
    professionalism: 95, ego: 24,
    ambition: 66, loyalty: 76, temperament: 72, pressureHandling: 82, controversy: 8, adaptability: 44,
  },
  // The erudite workhorse - dedicated, gracious, meticulously prepared.
  'real-lead-actor-benedict-cumberbatch': {
    professionalism: 94, ego: 22,
    ambition: 76, loyalty: 76, temperament: 76, pressureHandling: 80, controversy: 8, adaptability: 55,
  },
  // The sharp, grounded pro - versatile, unfussy, quietly excellent.
  'real-lead-actor-emily-blunt': {
    professionalism: 94, ego: 24,
    ambition: 74, loyalty: 78, temperament: 80, pressureHandling: 80, controversy: 6, adaptability: 60,
  },
  // The all-in immersion - intense, physical, drawn to the extreme role.
  'real-lead-actor-jake-gyllenhaal': {
    professionalism: 89, ego: 42,
    ambition: 78, loyalty: 66, temperament: 60, pressureHandling: 72, controversy: 15, adaptability: 48,
  },
  // The warm-hearted favourite - generous, doting, an easy hang and a real pro.
  'real-lead-actor-pedro-pascal': {
    professionalism: 91, ego: 30,
    ambition: 74, loyalty: 82, temperament: 80, pressureHandling: 78, controversy: 10, adaptability: 72,
  },
  // The loyal ringleader - sticks with his crew, laid-back, prolifically funny.
  'real-lead-actor-adam-sandler': {
    professionalism: 90, ego: 22,
    ambition: 66, loyalty: 92, temperament: 80, pressureHandling: 76, controversy: 15, adaptability: 74,
  },

  // --- Supporting actors (third wave) -------------------------------------

  // The warm giant - versatile, dependable, beloved on every set.
  'real-supporting-actor-john-goodman': {
    professionalism: 93, ego: 24,
    ambition: 66, loyalty: 84, temperament: 82, pressureHandling: 80, controversy: 6, adaptability: 66,
  },
  // The precise gourmand of villainy - erudite, exact, deliciously controlled.
  'real-supporting-actor-christoph-waltz': {
    professionalism: 94, ego: 20,
    ambition: 68, loyalty: 72, temperament: 72, pressureHandling: 82, controversy: 8, adaptability: 48,
  },
  // The loose-limbed natural - effortless, dancing, endlessly inventive.
  'real-supporting-actor-sam-rockwell': {
    professionalism: 93, ego: 16,
    ambition: 66, loyalty: 76, temperament: 74, pressureHandling: 76, controversy: 10, adaptability: 82,
  },
  // The rumpled everyman genius - self-deprecating, deeply prepared, beloved.
  'real-supporting-actor-paul-giamatti': {
    professionalism: 96, ego: 18,
    ambition: 62, loyalty: 80, temperament: 74, pressureHandling: 78, controversy: 8, adaptability: 55,
  },
  // The cerebral eccentric - idiosyncratic, unhurried, one of a kind.
  'real-supporting-actor-john-malkovich': {
    professionalism: 90, ego: 30,
    ambition: 66, loyalty: 62, temperament: 62, pressureHandling: 76, controversy: 20, adaptability: 60,
  },
  // The unnerving intensity - blunt, uncompromising, quietly menacing.
  'real-supporting-actor-michael-shannon': {
    professionalism: 92, ego: 22,
    ambition: 66, loyalty: 66, temperament: 52, pressureHandling: 74, controversy: 25, adaptability: 50,
  },
  // The fearless shapeshifter - versatile, warm, unafraid of the dark.
  'real-supporting-actor-toni-collette': {
    professionalism: 94, ego: 18,
    ambition: 70, loyalty: 78, temperament: 76, pressureHandling: 80, controversy: 8, adaptability: 60,
  },
  // The soulful master - restrained, elegant, revered across a continent.
  'real-supporting-actor-tony-leung': {
    professionalism: 96, ego: 15,
    ambition: 62, loyalty: 82, temperament: 82, pressureHandling: 84, controversy: 4, adaptability: 50,
  },
  // The everyman genius - a director's muse, warm, grounded, quietly great.
  'real-supporting-actor-song-kang-ho': {
    professionalism: 96, ego: 14,
    ambition: 64, loyalty: 86, temperament: 82, pressureHandling: 82, controversy: 4, adaptability: 58,
  },
  // The gritty old-schooler - intense, streetwise, uncompromisingly himself.
  'real-supporting-actor-harvey-keitel': {
    professionalism: 88, ego: 55,
    ambition: 62, loyalty: 66, temperament: 52, pressureHandling: 74, controversy: 22, adaptability: 44,
  },
  // The meticulous transformer - physical, exacting, wholly committed.
  'real-supporting-actor-eddie-redmayne': {
    professionalism: 93, ego: 22,
    ambition: 72, loyalty: 70, temperament: 74, pressureHandling: 76, controversy: 8, adaptability: 45,
  },
  // The kinetic livewire - versatile, generous, endlessly energetic.
  'real-supporting-actor-james-mcavoy': {
    professionalism: 92, ego: 20,
    ambition: 74, loyalty: 76, temperament: 74, pressureHandling: 78, controversy: 8, adaptability: 66,
  },
  // The understated precisionist - subtle, respected, quietly indispensable.
  'real-supporting-actor-jeffrey-wright': {
    professionalism: 95, ego: 18,
    ambition: 66, loyalty: 80, temperament: 80, pressureHandling: 82, controversy: 8, adaptability: 52,
  },
  // The warm articulate pro - dependable, grounded, effortlessly commanding.
  'real-supporting-actor-sterling-k-brown': {
    professionalism: 96, ego: 16,
    ambition: 72, loyalty: 82, temperament: 80, pressureHandling: 82, controversy: 6, adaptability: 56,
  },
  // The committed breakout - warm, dedicated, a long-overdue star.
  'real-supporting-actor-sandra-oh': {
    professionalism: 95, ego: 14,
    ambition: 72, loyalty: 80, temperament: 78, pressureHandling: 80, controversy: 8, adaptability: 58,
  },
  // The earthy character man - warm, versatile, endlessly watchable.
  'real-supporting-actor-brendan-gleeson': {
    professionalism: 94, ego: 21,
    ambition: 62, loyalty: 80, temperament: 80, pressureHandling: 80, controversy: 8, adaptability: 56,
  },
  // The daring young unnerver - hungry, fearless, drawn to the unsettling.
  'real-supporting-actor-barry-keoghan': {
    professionalism: 86, ego: 32,
    ambition: 82, loyalty: 60, temperament: 56, pressureHandling: 66, controversy: 30, adaptability: 68,
  },
  // The magnetic mumbler - idiosyncratic, immersive, gloriously offbeat.
  'real-supporting-actor-benicio-del-toro': {
    professionalism: 89, ego: 45,
    ambition: 60, loyalty: 66, temperament: 60, pressureHandling: 72, controversy: 18, adaptability: 62,
  },
  // The commanding calm - precise, measured, quietly terrifying.
  'real-supporting-actor-giancarlo-esposito': {
    professionalism: 94, ego: 20,
    ambition: 70, loyalty: 80, temperament: 82, pressureHandling: 84, controversy: 6, adaptability: 52,
  },
  // The warm chameleon - funny, humble, game for anything.
  'real-supporting-actor-john-c-reilly': {
    professionalism: 93, ego: 18,
    ambition: 64, loyalty: 82, temperament: 82, pressureHandling: 78, controversy: 6, adaptability: 76,
  },
  // The principled anchor - warm, dependable, quietly commanding.
  'real-supporting-actor-octavia-spencer': {
    professionalism: 90, ego: 30,
    ambition: 70, loyalty: 80, temperament: 80, pressureHandling: 80, controversy: 8, adaptability: 56,
  },
  // The oily precisionist - the villain you love, exact and unhurried.
  'real-supporting-actor-ben-mendelsohn': {
    professionalism: 93, ego: 24,
    ambition: 66, loyalty: 68, temperament: 60, pressureHandling: 76, controversy: 15, adaptability: 55,
  },
  // The intense multi-hyphenate - thoughtful, driven, an activist's conscience.
  'real-supporting-actor-riz-ahmed': {
    professionalism: 94, ego: 16,
    ambition: 78, loyalty: 72, temperament: 72, pressureHandling: 76, controversy: 15, adaptability: 60,
  },
  // The raw committed force - intense, working-class, deeply prepared.
  'real-supporting-actor-stephen-graham': {
    professionalism: 96, ego: 14,
    ambition: 68, loyalty: 82, temperament: 66, pressureHandling: 78, controversy: 10, adaptability: 55,
  },
  // The redemption-story icon - a tough-guy face, warm and generous off-screen.
  'real-supporting-actor-danny-trejo': {
    professionalism: 88, ego: 18,
    ambition: 62, loyalty: 82, temperament: 80, pressureHandling: 82, controversy: 15, adaptability: 62,
  },
};
