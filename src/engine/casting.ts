import type { CastingGender, Gender, Person, ScriptCharacter } from '../types';

/**
 * The single source of truth for "may this actor be cast as this Character,
 * on gender grounds." Every consumer - the candidate drawer, the reducer's
 * defensive assignment guard, and open-casting applicant generation - routes
 * through here so the rule can never drift between where it's shown and where
 * it's enforced.
 *
 * Rules:
 * - An 'Any' role (or a Character with no castingGender at all - older
 *   scripts) accepts anyone.
 * - A 'Male' or 'Female' role accepts only an actor whose own gender matches
 *   exactly.
 * - A NonBinary actor therefore matches only 'Any' roles - deliberately, for
 *   a v1: rather than silently fold them into Male/Female, they're eligible
 *   for the (many) open roles and left out of the explicitly gendered ones.
 * - An actor with no recorded gender is treated as unconstrained (matches
 *   everything) rather than blocked, so missing identity data never makes a
 *   role uncastable.
 */
export function actorMeetsCharacterGender(
  actorGender: Gender | undefined,
  characterGender: CastingGender | undefined,
): boolean {
  if (!characterGender || characterGender === 'Any') return true;
  if (!actorGender) return true;
  return actorGender === characterGender;
}

/** Person/Character convenience wrapper over actorMeetsCharacterGender. */
export function personMeetsCharacterGender(person: Person, character: ScriptCharacter | null): boolean {
  if (!character) return true;
  return actorMeetsCharacterGender(person.identity.gender, character.castingGender);
}

/** Short human-readable label for a Character's casting-gender requirement, for badges/tooltips. Absent/'Any' → 'Any gender'. */
export function castingGenderLabel(characterGender: CastingGender | undefined): string {
  if (!characterGender || characterGender === 'Any') return 'Any gender';
  return `${characterGender} role`;
}
