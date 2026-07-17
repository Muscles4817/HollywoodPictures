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
// First-draft thresholds, tunable like every other cutoff in this
// simulation - a person can and often will match more than one.
import type { Person, PersonTrait } from '../types';

const HIGH = 70;

export function deriveTraits(person: Person): PersonTrait[] {
  const { personality: p, reputation: r } = person;
  const traits: PersonTrait[] = [];

  // The type's own worked example, verbatim.
  if (p.ego >= HIGH && p.temperament <= 35) traits.push('DifficultToWorkWith');
  if (p.controversy >= HIGH) traits.push('ScandalProne');
  // Famous and well-liked by the press, as opposed to famous-and-controversial.
  if (r.fame >= HIGH && p.controversy <= 35) traits.push('MediaDarling');
  // A real career (fame >= 50) with none of the tabloid churn (currentHeat,
  // "how much buzz right now," notably lower than the fame that would
  // normally generate) - deliberately keeps a low profile.
  if (r.fame >= 50 && r.currentHeat <= 25) traits.push('HighlyPrivate');
  // Critical respect meaningfully outpacing stardom, not just present.
  if (r.prestige - r.fame >= 20 && r.prestige >= 55) traits.push('PrestigeFocused');
  // High ambition without the loyalty to match - chases the next deal, not the studio relationship.
  if (p.ambition >= HIGH && p.loyalty <= 35) traits.push('PaychequeDriven');
  if (p.professionalism >= 75 && p.adaptability <= 40) traits.push('Perfectionist');
  if (p.ambition >= HIGH && p.professionalism >= 60) traits.push('Workaholic');
  if (p.adaptability >= HIGH && p.pressureHandling >= 65) traits.push('RiskTaker');
  // Respected, loyal, and not so ego-driven that generosity toward a younger cast reads as implausible.
  if (r.industryRespect >= HIGH && p.loyalty >= 60 && p.ego <= 55) traits.push('Mentor');

  const activeCareerCount = Object.values(person.careers).filter((career) => career?.active).length;
  if (activeCareerCount > 1) traits.push('MultiHyphenate');

  // The two acting-specific traits read the actor career's own ActingStyle
  // axes directly, not generic personality - there's no equivalent signal
  // for a director/crew person, so these simply never fire outside an
  // actor career.
  const actingStyle = person.careers.actor?.actingStyle;
  if (actingStyle) {
    if (actingStyle.characterTransformation >= 75 && p.professionalism >= 60) traits.push('MethodPerformer');
    if (p.adaptability >= HIGH && (actingStyle.comedy >= 65 || actingStyle.charisma >= 65)) traits.push('NaturalImproviser');
  }

  return traits;
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
};
