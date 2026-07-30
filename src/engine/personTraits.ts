// PersonTrait is documented (types/index.ts) as "a visible, narratively
// legible shorthand" for personality/reputation combinations - e.g.
// "ego: 89 + temperament: 31 reads as DifficultToWorkWith", its own worked
// example. Nothing ever actually computed that shorthand: every Person's
// stored `traits` field is always an empty array, both handcrafted and
// generated (PERSON_MODEL_REDESIGN.md Phase 5 left it "waiting for a
// consumer" that never structurally arrived). This is that consumer, but as
// a derived read rather than a written-back value - Person.traits itself is
// left untouched (still always []), matching this codebase's own "only
// introduce state when reality genuinely requires it" rule (docs/DESIGN.md
// 5.34): nothing here can ever go stale, because nothing is stored.
//
// Scored, not boolean: each trait gets a continuous 0-100 match strength
// (via `ramp` below) rather than a single hard cutoff, so two people who
// both clear a threshold don't read as identically "difficult" when one is
// barely over the line and the other is off the scale - and so the trait
// list can be genuinely ranked (deriveTraits returns strongest-first, not
// "whichever happened to be checked first in code"). Conflict resolution
// (CONFLICT_GROUPS) then drops the weaker member of any pair/group of
// traits that can't both be someone's defining characteristic at once (a
// person reads as either the Difficult one or the Mentor, not both, even if
// their raw stats technically clear both floors). First-draft thresholds,
// tunable like every other cutoff in this simulation.
import type { Person, PersonTrait } from '../types';
import { clamp } from './random';

/** Linear 0-100 ramp from `from` to `to` - `to` can be lower than `from` for a "low value = full support" signal (e.g. ramp(temperament, 55, 15) reads low temperament as strong support). */
function ramp(value: number, from: number, to: number): number {
  if (from === to) return value >= from ? 100 : 0;
  return clamp(((value - from) / (to - from)) * 100, 0, 100);
}

const ELIGIBLE_FLOOR = 50;

/** Traits that can't both be a person's defining characteristic at once - whichever scores higher survives, the rest are dropped from the ranked list entirely (not just deprioritized). */
const CONFLICT_GROUPS: PersonTrait[][] = [
  // How they are to have on set: the short-fused diva, the generous veteran, and
  // the unflappable pro are three different reputations - a person reads as one.
  ['DifficultToWorkWith', 'Mentor', 'ConsummateProfessional'],
  ['MediaDarling', 'ScandalProne', 'HighlyPrivate'],
  // What drives their deals: chasing the money vs. valuing the relationship.
  ['PrestigeFocused', 'PaychequeDriven'],
  ['PaychequeDriven', 'LoyalCollaborator'],
  // How they approach a role: total immersion in one vs. range across many.
  ['MethodPerformer', 'Versatile'],
];

function scoreTraits(person: Person): Array<[PersonTrait, number]> {
  const p = person.personality;
  const r = person.reputation;
  const scores: Array<[PersonTrait, number]> = [
    // The type's own worked example, made continuous.
    ['DifficultToWorkWith', Math.min(ramp(p.ego, 45, 95), ramp(p.temperament, 55, 15))],
    ['ScandalProne', ramp(p.controversy, 45, 95)],
    // Famous and well-liked by the press, as opposed to famous-and-controversial.
    ['MediaDarling', Math.min(ramp(r.fame, 45, 95), ramp(p.controversy, 55, 15))],
    // A real career with none of the tabloid churn ("current heat," low despite decent fame) - deliberately keeps a low profile.
    ['HighlyPrivate', Math.min(ramp(r.fame, 35, 75), ramp(r.currentHeat, 45, 5))],
    // Critical respect meaningfully outpacing stardom, not just present.
    ['PrestigeFocused', Math.min(ramp(r.prestige - r.fame, 5, 35), ramp(r.prestige, 40, 80))],
    // High ambition without the loyalty to match - chases the next deal, not the studio relationship.
    ['PaychequeDriven', Math.min(ramp(p.ambition, 45, 95), ramp(p.loyalty, 55, 15))],
    ['Perfectionist', Math.min(ramp(p.professionalism, 55, 95), ramp(p.adaptability, 60, 20))],
    ['Workaholic', Math.min(ramp(p.ambition, 45, 95), ramp(p.professionalism, 40, 80))],
    ['RiskTaker', Math.min(ramp(p.adaptability, 45, 95), ramp(p.pressureHandling, 45, 95))],
    // Respected, loyal, and not so ego-driven that generosity toward a younger cast reads as implausible.
    ['Mentor', Math.min(ramp(r.industryRespect, 45, 95), ramp(p.loyalty, 40, 80), ramp(p.ego, 75, 25))],
    // Reliably excellent to have on set: high professionalism, a dependable
    // track record, and an even temper. The calm opposite of DifficultToWorkWith.
    ['ConsummateProfessional', Math.min(ramp(p.professionalism, 55, 95), ramp(r.reliability, 50, 90), ramp(p.temperament, 45, 85))],
    // Keeps their nerve when the schedule bites - the person you want on set when
    // a day is going sideways. Reads off pressureHandling, steadied by temperament.
    ['SteadyUnderPressure', Math.min(ramp(p.pressureHandling, 55, 95), ramp(p.temperament, 40, 80))],
    // Here for the work and the relationship, not the billing: genuine loyalty,
    // and enough standing that it reads as a choice rather than a lack of options.
    ['LoyalCollaborator', Math.min(ramp(p.loyalty, 55, 95), ramp(r.industryRespect, 35, 75))],
  ];

  // Structural, not a personality gradient - either they genuinely hold more than one active career or they don't.
  const activeCareerCount = Object.values(person.careers).filter((career) => career?.active).length;
  scores.push(['MultiHyphenate', activeCareerCount > 1 ? 100 : 0]);

  // The two acting-specific traits read the actor career's own ActingStyle
  // axes directly, not generic personality - there's no equivalent signal
  // for a director/crew person, so these simply never fire outside an
  // actor career.
  const actingStyle = person.careers.actor?.actingStyle;
  if (actingStyle) {
    scores.push(['MethodPerformer', Math.min(ramp(actingStyle.characterTransformation, 55, 95), ramp(p.professionalism, 40, 80))]);
    scores.push(['NaturalImproviser', Math.min(ramp(p.adaptability, 45, 95), Math.max(ramp(actingStyle.comedy, 45, 85), ramp(actingStyle.charisma, 45, 85)))]);
    // A true chameleon: adaptable, AND genuinely well-rounded across the craft
    // axes (their WEAKEST axis is still respectable) rather than a one-note
    // specialist. The weakest-axis floor is what separates range from a spiky
    // profile that just happens to be high on average.
    const roundedness = Math.min(actingStyle.characterTransformation, actingStyle.emotionalPerformance, actingStyle.charisma, actingStyle.comedy, actingStyle.physicalPerformance);
    scores.push(['Versatile', Math.min(ramp(p.adaptability, 50, 90), ramp(roundedness, 45, 80))]);
  }

  return scores;
}

/** Every trait clearing ELIGIBLE_FLOOR, strongest-first, with the weaker member of any CONFLICT_GROUPS pair dropped entirely - a caller wanting only the top few (e.g. a card with limited room) can just slice the front of this array, since it's already ranked by how defining each trait actually is. */
export function deriveTraits(person: Person): PersonTrait[] {
  const eligible = scoreTraits(person)
    .filter(([, score]) => score >= ELIGIBLE_FLOOR)
    .sort((a, b) => b[1] - a[1]);

  const kept: PersonTrait[] = [];
  for (const [trait] of eligible) {
    const group = CONFLICT_GROUPS.find((g) => g.includes(trait));
    const suppressed = group?.some((other) => other !== trait && kept.includes(other));
    if (!suppressed) kept.push(trait);
  }
  return kept;
}

export const TRAIT_LABELS: Record<PersonTrait, string> = {
  Perfectionist: 'Perfectionist',
  Workaholic: 'Workaholic',
  MethodPerformer: 'Method Performer',
  NaturalImproviser: 'Natural Improviser',
  DifficultToWorkWith: 'Difficult to Work With',
  MediaDarling: 'Media Darling',
  HighlyPrivate: 'Highly Private',
  PrestigeFocused: 'Prestige-Focused',
  PaychequeDriven: 'Paycheque-Driven',
  RiskTaker: 'Risk-Taker',
  Mentor: 'Mentor',
  ScandalProne: 'Scandal-Prone',
  MultiHyphenate: 'Multi-Hyphenate',
  ConsummateProfessional: 'Consummate Professional',
  SteadyUnderPressure: 'Steady Under Pressure',
  Versatile: 'Versatile',
  LoyalCollaborator: 'Loyal Collaborator',
};

export const TRAIT_DESCRIPTIONS: Record<PersonTrait, string> = {
  Perfectionist: 'Meticulous and exacting - raises quality, at the cost of flexibility.',
  Workaholic: 'Driven and diligent, more often than not the first one on set.',
  MethodPerformer: 'Immerses deeply in a role - often exceptional, sometimes exhausting for everyone else.',
  NaturalImproviser: 'Thrives off-script - comfortable making a scene up as they go.',
  DifficultToWorkWith: 'A big ego and a short fuse - talent worth managing carefully.',
  MediaDarling: 'The press loves them, and it shows - fame with none of the baggage.',
  HighlyPrivate: 'Keeps a deliberately low profile, despite a real career.',
  PrestigeFocused: 'Chases critical respect over box office.',
  PaychequeDriven: 'Goes where the money is, not where their loyalty lies.',
  RiskTaker: 'Comfortable improvising under pressure - willing to take a real creative swing.',
  Mentor: 'A generous, respected veteran - good for morale on a young cast.',
  ScandalProne: 'Trouble seems to follow - handle with a plan for the fallout.',
  MultiHyphenate: 'Works more than one side of the camera.',
  ConsummateProfessional: 'Unfailingly prepared and even-tempered - the calm centre of a set.',
  SteadyUnderPressure: 'Keeps their nerve when the schedule bites - a cool head in a crunch.',
  Versatile: 'A genuine chameleon - reshapes their performance to whatever the scene needs.',
  LoyalCollaborator: 'Values the working relationship over the billing - the sort who comes back.',
};

// The player-facing GAMEPLAY effect of a trait - what it actually does to a
// shoot or a deal, distinct from TRAIT_DESCRIPTIONS' "who they are" flavor. Kept
// qualitative (house style, no raw numbers) and honest: only traits with a real
// mechanical consequence make a promise; the rest describe a reputational read.
// Surfaced in the "Working with them" section (components/common/TalentStats.tsx).
export const TRAIT_EFFECTS: Record<PersonTrait, string> = {
  Perfectionist: 'On set: may push for another take — real quality upside, if you can spare the time.',
  Workaholic: 'On set: relentless pace can claw back a slipping schedule.',
  MethodPerformer: 'On set: total immersion can land a career-best turn — and wear out the ensemble.',
  NaturalImproviser: 'On set: off-script moments that can lift an ordinary scene.',
  DifficultToWorkWith: 'On set: ego clashes to manage — and a higher chance of a blow-up.',
  MediaDarling: 'The press is on-side — warmer coverage around them.',
  HighlyPrivate: 'Stays out of the spotlight — little press, good or bad.',
  PrestigeFocused: 'At the table: takes a bigger discount for a prestige project.',
  PaychequeDriven: 'At the table: won’t discount — expect to pay their full quote.',
  RiskTaker: 'On set: swings for bold choices under pressure.',
  Mentor: 'On set: lifts morale — steadies a younger cast.',
  ScandalProne: 'On set: a mid-shoot tabloid flare-up can dent buzz and the mood.',
  MultiHyphenate: 'Works more than one craft — hireable in several roles.',
  ConsummateProfessional: 'On set: a steadying presence who can pull a rough day back together.',
  SteadyUnderPressure: 'On set: holds the set calm when the schedule tightens.',
  Versatile: 'On set: adapts on the fly — can rescue a scene that isn’t working.',
  LoyalCollaborator: 'At the table: values the relationship — likelier to come back, and to go the extra mile.',
};
