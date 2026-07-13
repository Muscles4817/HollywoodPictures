import type { Range, ScaleAnchor } from '../engine/interpolate';

// Every production dial is continuous from 0 to 1.
//
// The four spend dials use logarithmic currency scaling. This preserves
// useful slider resolution at the indie end while still allowing major
// productions and tentpoles to spend at genuinely large scales.
//
// Anchors define the shape of each dial's quality or cost curve.
// engine/productionDials.ts interpolates between them, so these are
// reference points rather than discrete budget tiers.
//
// The quality curves deliberately use diminishing returns: moving from a
// shoestring budget to a professional one should transform what can be put
// on screen, while moving from an already enormous budget to the absolute
// maximum should buy refinement, capacity and reliability rather than an
// equally dramatic leap in visible quality.
//
// See docs/DESIGN.md for the wider production-planning model.

export const SHOOTING_BUDGET_RANGE: Range = {
  min: 100_000,
  max: 75_000_000,
};

/**
 * The Shooting Budget represents the operating cost of principal
 * photography rather than a pure contingency reserve.
 *
 * It abstracts the many recurring costs that would be tedious to expose
 * individually:
 *
 * - below-the-line crew
 * - camera, lighting and grip equipment
 * - sound recording
 * - production management
 * - transport, catering and unit logistics
 * - ordinary insurance and operational support
 *
 * It also acts as the production's capacity to absorb disruption. A larger,
 * better-resourced shoot can handle demanding material and unexpected
 * problems without immediately losing quality or control.
 *
 * The existing engine may still refer to this value internally as
 * `contingencyT`; that naming should eventually be updated separately.
 */
export const SHOOTING_BUDGET_ANCHORS: ScaleAnchor<'quality'>[] = [
  {
    t: 0,
    values: {
      quality: 20,
    },
    description:
      'A skeleton shoot relying on a tiny crew, basic equipment and improvised logistics. Viable for a deliberately minimal film, but anything demanding will expose its limitations quickly.',
  },
  {
    t: 0.25,
    values: {
      quality: 39,
    },
    description:
      'A small independent shoot with a functioning professional crew and essential equipment, but little specialist support or room for disruption.',
  },
  {
    t: 0.5,
    values: {
      quality: 61,
    },
    description:
      'A solid professional production with experienced departments, dependable equipment and enough operational support to execute ordinary material well.',
  },
  {
    t: 0.75,
    values: {
      quality: 78,
    },
    description:
      'A large, well-resourced shoot with substantial crews, specialist equipment and the capacity to handle complex staging, difficult conditions and schedule pressure.',
  },
  {
    t: 0.9,
    values: {
      quality: 87,
    },
    description:
      'A major-studio production with deep departmental staffing, premium equipment and extensive logistical support across a demanding shoot.',
  },
  {
    t: 1,
    values: {
      quality: 91,
    },
    description:
      'An exceptional money-no-object shoot with enormous crews, multiple units, premium equipment and the operational capacity to execute almost anything. Further spending mainly buys scale, flexibility and reliability rather than proportionally better images.',
  },
];

export const ENVIRONMENT_BUDGET_RANGE: Range = {
  min: 20_000,
  max: 50_000_000,
};

/**
 * Environment Budget currently abstracts the physical world surrounding
 * the production:
 *
 * - sets and construction
 * - location fees and permits
 * - location dressing
 * - props
 * - costumes
 * - art direction
 * - backlot and stage use
 * - environment-related transport and logistics
 *
 * These areas may later become a deeper Production Design system, but this
 * combined budget provides a credible cost category until those choices are
 * modelled separately.
 */
export const ENVIRONMENT_BUDGET_ANCHORS: ScaleAnchor<'quality'>[] = [
  {
    t: 0,
    values: {
      quality: 24,
    },
    description:
      'Borrowed rooms, existing locations, minimal dressing and almost no custom construction. Suitable for a contained story, but visibly restrictive when the script demands a distinctive world.',
  },
  {
    t: 0.25,
    values: {
      quality: 38,
    },
    description:
      'A small production-design effort using affordable locations, selective dressing, rented props and only the most necessary custom work.',
  },
  {
    t: 0.5,
    values: {
      quality: 58,
    },
    description:
      'Professional locations, convincing sets and a properly staffed art department capable of giving the film a coherent visual identity.',
  },
  {
    t: 0.75,
    values: {
      quality: 76,
    },
    description:
      'Extensive location work, substantial builds, detailed dressing, bespoke props and costumes, and enough resources to create several convincing large-scale environments.',
  },
  {
    t: 0.9,
    values: {
      quality: 87,
    },
    description:
      'Major production-design work involving large builds, premium locations, extensive backlot or stage use and richly detailed environments throughout the film.',
  },
  {
    t: 1,
    values: {
      quality: 93,
    },
    description:
      'World-class production design with enormous custom builds, elaborate locations, extensive physical environments and exceptional detail. Further spending mainly expands the volume and scale of work rather than transforming its craftsmanship.',
  },
];

export const PRACTICAL_EFFECTS_RANGE: Range = {
  min: 10_000,
  max: 25_000_000,
};

/**
 * Practical Effects covers physical spectacle and specialist work performed
 * during photography:
 *
 * - stunt teams and stunt rigs
 * - pyrotechnics and controlled destruction
 * - vehicles and mechanical rigs
 * - prosthetics and creature effects
 * - animatronics
 * - miniatures
 * - weather, fire, water and atmospheric effects
 *
 * A low value is perfectly appropriate for films that barely need practical
 * effects. The quality score becomes important when the script and chosen
 * production strategy depend on them.
 */
export const PRACTICAL_EFFECTS_ANCHORS: ScaleAnchor<'quality'>[] = [
  {
    t: 0,
    values: {
      quality: 14,
    },
    description:
      'Almost no dedicated practical-effects capacity beyond simple makeup, basic breakaways and whatever the ordinary crew can safely achieve.',
  },
  {
    t: 0.3,
    values: {
      quality: 31,
    },
    description:
      'A limited practical package supporting small stunts, modest prosthetics and a handful of straightforward physical effects.',
  },
  {
    t: 0.55,
    values: {
      quality: 57,
    },
    description:
      'A capable professional effects team delivering convincing stunt work, makeup, pyrotechnics and physical set-pieces at a moderate scale.',
  },
  {
    t: 0.75,
    values: {
      quality: 74,
    },
    description:
      'A substantial practical-effects production with specialist stunt units, complex rigs, vehicles, creature work or large physical set-pieces.',
  },
  {
    t: 0.9,
    values: {
      quality: 87,
    },
    description:
      'Top-tier practical work involving major stunt coordination, advanced prosthetics or animatronics, extensive pyrotechnics and demanding physical spectacle.',
  },
  {
    t: 1,
    values: {
      quality: 93,
    },
    description:
      'An extraordinary practical-effects operation capable of executing the most ambitious physical spectacle at enormous scale. Further spending primarily buys more sequences, repetitions and safety capacity.',
  },
];

export const VFX_RANGE: Range = {
  min: 5_000,
  max: 150_000_000,
};

/**
 * VFX Budget covers both visible spectacle and the large amount of digital
 * work that audiences may never consciously notice:
 *
 * - cleanup and compositing
 * - screen replacements
 * - environment extensions
 * - digital doubles
 * - creatures and characters
 * - simulations
 * - fully digital environments
 * - large effects-driven sequences
 *
 * Because the range is extremely wide and logarithmic, the uppermost part
 * represents uncommon effects-led tentpoles rather than the normal cost of
 * a studio feature.
 */
export const VFX_ANCHORS: ScaleAnchor<'quality'>[] = [
  {
    t: 0,
    values: {
      quality: 5,
    },
    description:
      'No meaningful dedicated VFX budget beyond emergency cleanup and the simplest invisible corrections. Appropriate only when the film genuinely requires almost none.',
  },
  {
    t: 0.25,
    values: {
      quality: 18,
    },
    description:
      'A tiny VFX package covering basic cleanup, simple compositing and a very limited number of visible effects.',
  },
  {
    t: 0.5,
    values: {
      quality: 42,
    },
    description:
      'A modest professional VFX effort capable of polished invisible work, environment extensions and several contained effects sequences.',
  },
  {
    t: 0.7,
    values: {
      quality: 64,
    },
    description:
      'A substantial VFX production supporting complex compositing, digital environments, simulations and multiple convincing set-pieces.',
  },
  {
    t: 0.85,
    values: {
      quality: 81,
    },
    description:
      'A major effects-led production with extensive digital environments, creatures, simulations and spectacle across much of the film.',
  },
  {
    t: 0.95,
    values: {
      quality: 91,
    },
    description:
      'Elite blockbuster VFX involving many vendors, enormous shot counts and highly complex digital sequences delivered at a consistently high standard.',
  },
  {
    t: 1,
    values: {
      quality: 96,
    },
    description:
      'One of the largest VFX productions imaginable, capable of building much of the film digitally. Additional spending mainly buys volume, iteration and schedule capacity because craftsmanship is already near its practical ceiling.',
  },
];

/**
 * Runtime affects the volume of material that must be photographed and
 * supported by the production budgets above.
 *
 * This multiplier should remain moderate because runtime also contributes
 * to recommended shoot length elsewhere. Making this curve too aggressive
 * would charge for the same additional scope twice.
 *
 * Marketability peaks around a conventional feature length. Very short
 * films can appear slight or difficult to position, while extremely long
 * films reduce screening capacity even when audiences accept the runtime.
 */
export const RUNTIME_ANCHORS: ScaleAnchor<
  'costMultiplier' | 'marketabilityDelta'
>[] = [
  {
    t: 0,
    values: {
      costMultiplier: 0.75,
      marketabilityDelta: -6,
    },
    description:
      'A very short, tightly contained feature. It needs less material and can be produced economically, but may feel slight and be harder to position as a major theatrical release.',
  },
  {
    t: 0.2,
    values: {
      costMultiplier: 0.85,
      marketabilityDelta: -1,
    },
    description:
      'A lean feature with little excess. Relatively economical while still feeling substantial enough for most audiences.',
  },
  {
    t: 0.5,
    values: {
      costMultiplier: 1,
      marketabilityDelta: 5,
    },
    description:
      'A conventional feature length offering the strongest balance between production cost, audience expectations and theatrical marketability.',
  },
  {
    t: 0.75,
    values: {
      costMultiplier: 1.16,
      marketabilityDelta: 3,
    },
    description:
      'A long feature requiring more material, production time and finishing work, but still commercially comfortable when the story justifies it.',
  },
  {
    t: 0.9,
    values: {
      costMultiplier: 1.28,
      marketabilityDelta: 1,
    },
    description:
      'A very long film with substantially greater production demands and fewer possible theatrical screenings per day.',
  },
  {
    t: 1,
    values: {
      costMultiplier: 1.35,
      marketabilityDelta: -2,
    },
    description:
      'A true epic runtime. It requires significantly more material and restricts theatrical scheduling, so the film must earn its length through scale, spectacle or exceptional audience interest.',
  },
];