import type { CastingGender, CharacterAgeBand, Gender, Person, ScriptCharacter } from '../types';
import { getPersonAge } from '../types';
import { gameDateFromTotalDays } from './calendar';

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

// --- Age as a casting qualifier (soft, unlike gender) -----------------------
//
// Gender is an exact-match hard gate; age deliberately is not. Real casting
// stretches an actor a few years off the written age all the time (makeup,
// craft), and the sim's philosophy wants that to be a *trade* the player can
// make - pay in role-fit for the actor you want - not a filter that silently
// shrinks the candidate list. So age has two rules that gender doesn't:
//
//  - a SOFT penalty (ageFitMultiplier) that decays role-fit with each year an
//    actor sits outside the written band, down to a floor at the edge of what
//    is castable; and
//  - a HARD gate (actorMeetsCharacterAge) that refuses only an *absurd* gap
//    (an adult written as a young child, say) - the point past which no makeup
//    chair could sell it.
//
// The band → year-range table and both thresholds are the tuning surface;
// rebalance here, not by threading numbers through the callers.

/** Inclusive [min, max] year range each named band reads as. `Senior` is open-ended at the top (Infinity). Rebalance the sim's age feel here. */
export const AGE_BAND_RANGES: Record<Exclude<CharacterAgeBand, 'Any'>, { min: number; max: number }> = {
  Child: { min: 5, max: 12 },
  Teen: { min: 13, max: 19 },
  YoungAdult: { min: 20, max: 29 },
  Adult: { min: 30, max: 44 },
  MiddleAged: { min: 45, max: 59 },
  Senior: { min: 60, max: Infinity },
};

// How many years outside the band an actor may still be cast as a (heavily
// penalised) stretch. At exactly this gap ageFitMultiplier hits its floor; one
// year past it, actorMeetsCharacterAge refuses the hire.
const ABSURD_AGE_GAP = 18;
// Worst role-fit multiplier a still-castable age stretch can incur (at the
// ABSURD_AGE_GAP edge). 1 = no penalty; below this the role is refused instead.
const AGE_FIT_FLOOR = 0.65;

/** Whole-year distance an age sits outside a band's [min, max] - 0 when inside the band. */
function yearsOutsideBand(age: number, band: Exclude<CharacterAgeBand, 'Any'>): number {
  const { min, max } = AGE_BAND_RANGES[band];
  if (age < min) return min - age;
  if (age > max) return age - max;
  return 0;
}

/**
 * The HARD age gate, mirroring actorMeetsCharacterGender's role as the single
 * eligibility chokepoint - but it refuses only an absurd mismatch. Absent/'Any'
 * band accepts anyone; an actor with no known age is unconstrained (never
 * blocked, so missing birth data can't make a role uncastable); otherwise the
 * hire is allowed as long as the age is within ABSURD_AGE_GAP years of the band.
 */
export function actorMeetsCharacterAge(actorAge: number | undefined, band: CharacterAgeBand | undefined): boolean {
  if (!band || band === 'Any') return true;
  if (actorAge === undefined) return true;
  return yearsOutsideBand(actorAge, band) <= ABSURD_AGE_GAP;
}

/**
 * The SOFT age penalty: a 0..1 multiplier applied to an actor's role-fit for
 * how well their age suits the written band. 1 inside the band; decays linearly
 * to AGE_FIT_FLOOR at the edge of castability (ABSURD_AGE_GAP years out). Absent/
 * 'Any' band or unknown age → 1 (no penalty). Ages past the gate would fall
 * below the floor, but they're refused before scoring, so this clamps at the
 * floor rather than pretending to score them.
 */
export function ageFitMultiplier(actorAge: number | undefined, band: CharacterAgeBand | undefined): number {
  if (!band || band === 'Any' || actorAge === undefined) return 1;
  const gap = yearsOutsideBand(actorAge, band);
  if (gap <= 0) return 1;
  const t = Math.min(gap / ABSURD_AGE_GAP, 1);
  return 1 - t * (1 - AGE_FIT_FLOOR);
}

/** Person/Character convenience wrapper over actorMeetsCharacterAge - computes the actor's age as of `totalDays`. */
export function personMeetsCharacterAge(person: Person, character: ScriptCharacter | null, totalDays: number): boolean {
  if (!character) return true;
  return actorMeetsCharacterAge(personCastingAge(person, totalDays), character.castingAgeBand);
}

/** An actor's whole-year age as of the given running day (`GameState.totalDays`), or undefined if they carry no birth date. The value snapshotted onto a TalentAssignment at hire time. */
export function personCastingAge(person: Person, totalDays: number): number | undefined {
  return getPersonAge(person.identity.dateOfBirth, gameDateFromTotalDays(totalDays));
}

/**
 * A short, qualitative read of how an actor's age suits a written band - the
 * "named cause" behind a stretch-cast actor's dented role-fit (docs/
 * SIMULATION_PHILOSOPHY.md: outcomes should be understandable). null when the
 * actor is in-band, the band is absent/'Any', or the age is unknown - i.e.
 * whenever age isn't costing anything, so the card stays quiet.
 */
export function describeAgeFit(actorAge: number | undefined, band: CharacterAgeBand | undefined): string | null {
  if (!band || band === 'Any' || actorAge === undefined) return null;
  const { min, max } = AGE_BAND_RANGES[band];
  if (actorAge >= min && actorAge <= max) return null;
  const older = actorAge > max;
  const gap = older ? actorAge - max : min - actorAge;
  const magnitude = gap <= 4 ? 'A slight stretch' : gap <= 10 ? 'A stretch' : 'A big stretch';
  return `${magnitude} — reads ${older ? 'older' : 'younger'} than the part`;
}

/** Short human-readable label for a Character's age-band requirement, for badges/tooltips. Absent/'Any' → 'Any age'. */
export function castingAgeBandLabel(band: CharacterAgeBand | undefined): string {
  if (!band || band === 'Any') return 'Any age';
  const labels: Record<Exclude<CharacterAgeBand, 'Any'>, string> = {
    Child: 'Child role',
    Teen: 'Teen role',
    YoungAdult: 'Young-adult role',
    Adult: 'Adult role',
    MiddleAged: 'Middle-aged role',
    Senior: 'Senior role',
  };
  return labels[band];
}
