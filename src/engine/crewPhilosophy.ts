// Workstream II, Addition #1 — a creative head's creative-philosophy vector.
// Distinct from `skill` (how WELL they execute): this is HOW they like to
// execute. Two axes (practical↔digital, naturalistic↔stylised) in the same space
// the Director and Execution Strategy already speak, so heads and directors are
// directly comparable for the compatibility edges.
//
// Like director hands-on-ness (engine/actingModel.ts) and actor craft, an
// unauthored philosophy is a STABLE per-person derivation from the person id —
// not rng (so it never shifts a generated pool) and not a live dial. An authored
// `CrewCareer.philosophy` (future marquee crew) overrides it. It feeds the
// relationship reads only — never cost or scoring.
import type { CrewPhilosophy, CrewRole, DirectorCareer, Person, ProductionRole, Tone, ToneProfile } from '../types';
import { clamp } from './random';
import { stableUnit } from './actingModel';
import { getCrewCareer } from './person';

/** The creative heads that carry a philosophy today (the floor + photography heads). Composer/Editor join with their own edges later. */
export const CREW_PHILOSOPHY_ROLES: ProductionRole[] = ['Production Designer', 'VFX Supervisor', 'Cinematographer'];

// A stable axis value centred with real spread, from an id-hash unit. Mirrors
// deriveHandsOnFromUnit's shape: never fully polarised by default, but varied.
const axisFromUnit = (unit: number) => clamp(0.15 + unit * 0.7, 0, 1);

/**
 * A crew head's creative philosophy: the authored value when present, otherwise
 * a stable per-person default keyed on (id, role) so the two axes vary
 * independently and the same head always reads the same. `role` disambiguates
 * the rare multi-career person.
 */
export function crewPhilosophy(person: Person, role: CrewRole): CrewPhilosophy {
  const authored = getCrewCareer(person, role)?.philosophy;
  if (authored) return { digitalAffinity: clamp(authored.digitalAffinity, 0, 1), stylisation: clamp(authored.stylisation, 0, 1) };
  const id = person.id ?? person.identity.name;
  return {
    digitalAffinity: axisFromUnit(stableUnit(`${id}|${role}|digital`)),
    stylisation: axisFromUnit(stableUnit(`${id}|${role}|style`)),
  };
}

// The tones that read as "heightened/stylised" vs "grounded", for mapping a
// director's tone profile onto the stylisation axis.
const STYLISED_TONES: Tone[] = ['spectacle', 'action'];
const GROUNDED_TONES: Tone[] = ['drama'];
const toneMean = (tp: ToneProfile, tones: Tone[]) => tones.reduce((s, t) => s + tp[t], 0) / tones.length / 100;

/**
 * Map a Director onto the SAME philosophy space as crew, so Director↔crew edges
 * compare like with like:
 * - digitalAffinity from their production-style digital lean (effects+environment).
 * - stylisation from their tone profile (spectacle/action heightened ↔ drama grounded).
 */
export function directorPhilosophy(director: DirectorCareer): CrewPhilosophy {
  const digitalAffinity = clamp(
    (clamp(director.productionStyle.effectsStrategy.digital, 0, 1) + clamp(director.productionStyle.environmentStrategy.digital, 0, 1)) / 2,
    0, 1,
  );
  const stylised = toneMean(director.toneProfile, STYLISED_TONES);
  const grounded = toneMean(director.toneProfile, GROUNDED_TONES);
  // Centre on the balance between heightened and grounded tone.
  const stylisation = clamp(0.5 + (stylised - grounded) * 0.9, 0, 1);
  return { digitalAffinity, stylisation };
}
