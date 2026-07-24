// Player-facing explanations for every stored actor stat, shown behind the
// info signs in components/TalentDatabase.tsx (both the public detail panels
// and the Dev "hidden stats" section). `what` says what the stat IS; `effect`
// says what it actually DOES in-game.
//
// Honesty is the whole point of the Dev section, so `effect` is grounded in
// where each field is actually read: many Person fields are tracked-but-inert
// today (they feed at most the display-only trait badges), and this file says
// so plainly rather than implying an effect that no formula produces. If a
// consumer is later added for one of these, update the text here.

export interface StatInfo {
  label: string;
  what: string;
  effect: string;
}

const INERT_SUFFIX = 'Tracked, but no gameplay formula reads it yet — today it only helps colour the reputation badges.';

export const STAT_INFO = {
  // --- Reputation ---------------------------------------------------------
  fame: {
    label: 'Fame',
    what: 'How widely the public recognises this actor.',
    effect: "Drives a film's marketability and opening-weekend buzz/awareness, boosts casting appeal, and raises the offer they expect before they'll sign.",
  },
  prestige: {
    label: 'Prestige',
    what: 'Their critical, awards-circuit standing.',
    effect: 'Tilts their prestige-vs-commercial lean and feeds the "momentum" behind attaching them — prestige-hungry actors weigh a prestigious studio more heavily.',
  },
  industryRespect: {
    label: 'Industry Respect',
    what: 'Esteem from peers and insiders.',
    effect: `For an actor this is currently cosmetic (it only bites when the same person is hired as a Director). ${INERT_SUFFIX}`,
  },
  reliability: {
    label: 'Reliability',
    what: 'How dependable they are to actually deliver on set.',
    effect: 'Higher reliability lowers a production\'s morale/friction risk, making costly on-set incidents less likely.',
  },
  currentHeat: {
    label: 'Current Heat',
    what: 'How much press/tabloid attention is on them right now.',
    effect: INERT_SUFFIX,
  },

  // --- Acting style (the five performance axes) ---------------------------
  characterTransformation: {
    label: 'Character Transformation',
    what: 'Range — how convincingly they disappear into a very different role.',
    effect: "Part of the acting-quality score in a film's craft rating, and of casting fit — weighted toward dramatic, transformative roles.",
  },
  emotionalPerformance: {
    label: 'Emotional Performance',
    what: 'Emotional depth and vulnerability on screen.',
    effect: 'Feeds the acting-quality score and casting fit, weighted toward drama and serious material.',
  },
  charisma: {
    label: 'Charisma',
    what: 'Screen presence and magnetism — the all-round star quality axis.',
    effect: 'Feeds the acting-quality score and casting fit, contributing a little to fit on every kind of material.',
  },
  comedy: {
    label: 'Comedy',
    what: 'Comic timing and delivery.',
    effect: 'Feeds the acting-quality score and casting fit, weighted toward comedic scripts and roles.',
  },
  physicalPerformance: {
    label: 'Physical Performance',
    what: 'Action, movement and stunt-driven performance.',
    effect: 'Feeds the acting-quality score and casting fit, weighted toward action and spectacle scripts and roles.',
  },

  // --- Personality --------------------------------------------------------
  professionalism: {
    label: 'Professionalism',
    what: 'How disciplined and diligent they are on set.',
    effect: INERT_SUFFIX,
  },
  ambition: {
    label: 'Ambition',
    what: 'Hunger for bigger, more visible roles.',
    effect: 'Pushes their prestige-vs-commercial lean toward the commercial end, changing how much your studio\'s Brand vs. Prestige sways whether they take the job.',
  },
  loyalty: {
    label: 'Loyalty',
    what: 'Attachment to a working relationship over the next payday.',
    effect: INERT_SUFFIX,
  },
  ego: {
    label: 'Ego',
    what: 'Self-importance — the diva factor.',
    effect: 'Raises the appeal bar you must clear to sign them, and raises a production\'s morale/friction risk.',
  },
  temperament: {
    label: 'Temperament',
    what: 'Even-keeled vs. volatile under stress.',
    effect: INERT_SUFFIX,
  },
  pressureHandling: {
    label: 'Pressure Handling',
    what: 'How well they cope when a shoot gets difficult.',
    effect: INERT_SUFFIX,
  },
  controversy: {
    label: 'Controversy',
    what: 'How prone they are to scandal and bad press.',
    effect: INERT_SUFFIX,
  },
  adaptability: {
    label: 'Adaptability',
    what: 'How readily they adjust to changes on set.',
    effect: INERT_SUFFIX,
  },

  // --- Career -------------------------------------------------------------
  skill: {
    label: 'Skill',
    what: 'Raw craft skill in their profession (directors, writers, and crew - actors are read through their five acting axes instead).',
    effect: 'Feeds the quality their department contributes to a production, and how good a hire they read as.',
  },
  experience: {
    label: 'Experience',
    what: 'Accumulated career experience.',
    effect: INERT_SUFFIX,
  },
  roleReputation: {
    label: 'Role Reputation',
    what: 'Track record specifically as an actor (vs. any other career they hold).',
    effect: INERT_SUFFIX,
  },
  minimumSalary: {
    label: 'Minimum Salary',
    what: "The lowest fee they'll even consider.",
    effect: "Offer at or below this and they'll almost certainly turn the role down, however good the fit.",
  },
  typicalSalary: {
    label: 'Typical Salary',
    what: 'Their standard asking fee.',
    effect: 'The real cash cost to hire them (it sums into the production budget), and the offer level that fully satisfies them on money.',
  },
} as const;

export type StatKey = keyof typeof STAT_INFO;
