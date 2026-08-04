import {
  computeTalentCompatibility,
  computeActorCharacterCompatibility,
  computeTalentCompatibilityBreakdown,
  computeCharacterCompatibilityBreakdown,
} from '../../engine/compatibility';
import { dominantLean } from '../../engine/recommendation';
import { describeActorCraft, describeSignatureGift, describeFameCraftContrast, describeDirectorTouch, describeDirectorActorPairing, describeCastAffinity, castAffinityTone, actorArchetypeTag } from '../../engine/castingPresentation';
import { projectCastingPerformance } from '../../engine/castPerformance';
import { describeCastingProjection } from '../../engine/castPerformancePresentation';
import { describeCrewPhilosophy } from '../../engine/crewPhilosophy';
import { describeStandoutSpecialty } from '../../engine/crewSpecialty';
import type { CastAffinity } from '../../engine/pairHistory';
import { deriveFitReason, deriveFitRead, deriveFitReadAssist, deriveFitConfidence, deriveRiskRead, qualitativeMagnitude, isStarDraw, gateKnownAxes, knownAxisCoverage } from '../../engine/talentCardPresentation';
import { describeRelationshipStanding, type RelationshipStanding } from '../../engine/relationships';
import { AFFORDABILITY_LABEL, type AffordabilityTier } from '../../engine/affordability';
import { getCareerForRole, deriveBookedUntil } from '../../engine/person';
import { describeAgeFit } from '../../engine/casting';
import { deriveTraits, TRAIT_LABELS, TRAIT_DESCRIPTIONS, TRAIT_EFFECTS } from '../../engine/personTraits';
import { gameDateFromTotalDays, formatGameDateWithMonth } from '../../engine/calendar';
import { TONE_LABELS } from '../../data/tones';
import { ENV_LEAN_SHORT, EFFECTS_LEAN_SHORT } from '../../data/productionStyleLabels';
import { ACTING_STYLE_LABELS } from '../../data/actingStyle';
import { CHARACTER_ARCHETYPE_LABELS } from '../../data/scriptTagLabels';
import type { RoleCategory } from '../../data/talentPresentation';
import { Money } from './Money';
import { MatchBreakdown } from './MatchBreakdown';
import { getPersonAge } from '../../types';
import type { DirectorCareer, Person, ProductionRole, Script, ScriptCharacter } from '../../types';

// A card only has room for a couple of traits before it starts reading as a
// stat dump rather than a quick read - same "top few, not everything"
// judgment call engine/castingPresentation.ts:describeApplicantInterest
// already makes for appeal factors (APPEAL_MAX_NOTES). Order in
// deriveTraits isn't meaningful, so this is just "first N", not "top N."
const MAX_DISPLAYED_TRAITS = 3;

/** Budget-tier -> the traffic-light dot's colour class (green/amber/red). */
const AFFORD_CLASS: Record<AffordabilityTier, 'ok' | 'warn' | 'bad'> = {
  comfortable: 'ok',
  tight: 'warn',
  unaffordable: 'bad',
};

/** A director's own production leanings, compact enough for a candidate card - "Leans location, practical effects." See engine/recommendation.ts:dominantLean, the same math Plan Production's cards use. */
export function describeProductionStyle(director: DirectorCareer): string {
  const env = dominantLean(director.productionStyle.environmentStrategy);
  const fx = dominantLean(director.productionStyle.effectsStrategy);
  return `Leans ${ENV_LEAN_SHORT[env.key]}, ${EFFECTS_LEAN_SHORT[fx.key]}`;
}

/** A 0-100 hiring/fit score as the qualitative tier the fit hero is coloured by - green Strong+, blue Good, amber Risky, red Poor. Mirrors deriveHiringVerdict's own five-tier cutoffs. */
export type FitTier = 'strong' | 'good' | 'risky' | 'poor';
export function fitTier(score: number): FitTier {
  if (score >= 75) return 'strong';
  if (score >= 60) return 'good';
  if (score >= 40) return 'risky';
  return 'poor';
}

/**
 * The single "should I hire this person" reading the card leads with
 * (Talent Card UX Redesign) - reuses whichever existing compatibility
 * calculation is most specific to what's actually being decided, never a
 * new scoring formula:
 *  - an actor being sized up against a specific Character uses that
 *    character-fit score (the most specific reading there is);
 *  - an actor with no Character context, or a director, falls back to
 *    whole-script tone compatibility;
 *  - crew has no compatibility concept at all today (see
 *    engine/compatibility.ts) - skill is the only "how good a hire is this"
 *    number that exists for them, so it doubles as the fit score here.
 * null when nothing above is computable (no script and no character to
 * compare against) - the fit hero simply doesn't render rather than showing
 * a meaningless number.
 */
export function deriveOverallScore(person: Person, role: ProductionRole, category: RoleCategory, script: Script | null, character: ScriptCharacter | null): number | null {
  if (category === 'actor' && character) {
    return computeActorCharacterCompatibility(person, character);
  }
  if (category === 'crew') {
    const career = getCareerForRole(person, role);
    return career && 'skill' in career ? career.skill : null;
  }
  return script ? computeTalentCompatibility(person, role, script) : null;
}

/**
 * The per-dimension match breakdown backing the fit hero above - one row per
 * dimension, already scored as "how well does this match" (Talent Card UX
 * Redesign). Character-fit (the more specific reading) wins when a Character
 * is known; otherwise falls back to the same whole-script tone breakdown
 * deriveOverallScore does. null for crew (no per-axis dimensions exist for
 * them) and for an actor/director with nothing to compare against.
 */
export function deriveRoleFitBreakdown(
  person: Person,
  role: ProductionRole,
  category: RoleCategory,
  script: Script | null,
  character: ScriptCharacter | null,
): { title: string; noun: 'fit' | 'tone'; rows: Array<{ label: string; matchScore: number; strength: number }> } | null {
  if (category === 'actor' && character) {
    const actorCareer = person.careers.actor;
    if (!actorCareer) return null;
    const breakdown = computeCharacterCompatibilityBreakdown(actorCareer.actingStyle, character.traits);
    // strength = the actor's OWN value on the axis (what they're known for), which
    // drives whether the read on this dimension is a known quantity - see gateKnownAxes.
    return { title: 'Role fit', noun: 'fit', rows: breakdown.map((a) => ({ label: ACTING_STYLE_LABELS[a.axis], matchScore: a.matchScore, strength: a.actorValue })) };
  }
  if (script && (category === 'actor' || category === 'director')) {
    const breakdown = computeTalentCompatibilityBreakdown(person, role, script);
    if (!breakdown) return null;
    return { title: 'Tone fit', noun: 'tone', rows: breakdown.map((t) => ({ label: TONE_LABELS[t.tone], matchScore: 100 - t.gap, strength: t.talentValue })) };
  }
  return null;
}

/** A labelled Industry bar - Fame/Prestige/Reliability as a magnitude word, not a star row (Talent Card UX Redesign: a language per job). */
function BarRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="talent-bar-row">
      <span className="talent-bar-label">{label}</span>
      <span className="talent-bar-track">
        <span className="talent-bar-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </span>
      <span className="talent-bar-value">{qualitativeMagnitude(value)}</span>
    </div>
  );
}

/**
 * The full stat display for one person under a specific role - shared by
 * every screen that needs to show "should I hire this person": Hire
 * Talent's candidate grid/comparison slots, and on-set decisions that
 * involve a specific hired or replacement person
 * (components/common/OnSetDecisionCard.tsx). The caller renders the name
 * itself (its own .card-title) directly above this.
 *
 * Talent Card UX Redesign (user request) - rebuilt around a three-second
 * read: a prominent salary paired with age/gender, a one-line identity read,
 * a Role-Fit hero (verdict + fill meter + a plain-English "why"), and a row
 * of traffic-light status badges (availability, risk, star draw). Everything
 * deeper - the per-axis fit breakdown, Industry standing, and the risk detail
 * - lives behind a single disclosure, so the default card stays short and
 * doesn't grow taller every time a system is added. Different facts now speak
 * different visual languages (meter, bars, badges, bold numerals, prose)
 * rather than everything being a star row. The simulation is unchanged; this
 * is purely a presentation reorganization.
 *
 * `character` - which specific Lead/Supporting Character (script.cast) this
 * candidate is being evaluated to play, when the slot resolves to one - drives
 * the character-specific "Role fit" reading above the whole-script "Tone fit"
 * one. null for every non-actor role and for a script with no matching
 * character at that slot. `budget` drives the salary block's traffic-light
 * dot when the caller knows the studio's means - a reserve-aware read
 * (engine/affordability.ts), so a hire the balance can technically cover but
 * that would drain the studio's cushion reads amber ("Stretches your cash"),
 * not a clean green. The hiring drawers pass it; the on-set decision card
 * doesn't know the budget, and passes nothing.
 */
export function TalentStats({ person, role, category, script, character = null, totalDays, availabilityMode = 'delay', pairedDirector = null, budget = null, castingDirectorSkill = null, relationship = null, castAffinity = null, audited = false }: { person: Person; role: ProductionRole; category: RoleCategory; script: Script | null; character?: ScriptCharacter | null; totalDays: number; availabilityMode?: 'delay' | 'blocked'; pairedDirector?: Person | null; budget?: AffordabilityTier | null; castingDirectorSkill?: number | null; relationship?: RelationshipStanding | null; castAffinity?: CastAffinity | null; audited?: boolean }) {
  const career = getCareerForRole(person, role);
  const overallScore = deriveOverallScore(person, role, category, script, character);
  const roleFit = deriveRoleFitBreakdown(person, role, category, script, character);
  // Every hire is a judgment made under uncertainty, so it reads as a hedged band,
  // not an exact number - for crew as much as actors. A crew head's "fit" is their
  // skill, but how confidently you can read that skill still depends on how known
  // a quantity they are: an established, respected name is a safe read; an obscure
  // or unproven one is a genuine punt until you've worked with them. What sharpens
  // the read differs by role - a completed audition and the production's casting
  // director sharpen ACTORS (deriveFitReadAssist gates those on isActor); working
  // history sharpens anyone, crew included.
  const fitAssist = deriveFitReadAssist(castingDirectorSkill, relationship ?? undefined, category === 'actor', audited);
  // Which axes you can read depends on how readable the *person* is (their
  // establishment, plus any casting-director/audition/history assist) - compute
  // that tier first and gate on it. Only the axes you'd actually know are shown
  // in full; the rest are veiled as "Unknown". The "why" line reasons over the
  // known axes only, so it never cites a dimension the breakdown hides.
  const readTier = roleFit ? deriveFitConfidence(person, fitAssist).tier : 'high';
  const gatedRows = roleFit ? gateKnownAxes(roleFit.rows, readTier) : null;
  // How much of the role you can vouch for then caps the OVERALL verdict's
  // confidence and pulls its centre toward neutral - so two dazzling axes out of
  // five no longer read as "an excellent fit" until a screen test reveals the
  // rest (deriveFitRead's coverage regression).
  const coverage = gatedRows ? knownAxisCoverage(gatedRows) : 1;
  // Crew have no per-axis role-fit to veil (coverage stays 1), but they still get
  // the person-readability band and history sharpening - read for how good a
  // "hire" they are, not how well they "fit" a part. Actors/directors read "fit".
  const fitRead = overallScore !== null ? deriveFitRead(overallScore, person, fitAssist, coverage, roleFit ? 'fit' : 'hire') : null;
  const fitReason = gatedRows ? deriveFitReason(gatedRows.filter((r) => r.known), roleFit!.noun) : null;

  // Both optional (see PersonIdentity's own comment, types/index.ts) - real,
  // handcrafted people deliberately carry neither rather than a fabricated
  // guess, so this line renders only what's actually known, or not at all.
  const age = getPersonAge(person.identity.dateOfBirth, gameDateFromTotalDays(totalDays));
  const identityLine = [age !== undefined ? `${age}` : null, person.identity.gender ?? null].filter((v) => v !== null).join(' · ');

  const bookedUntil = deriveBookedUntil(person.availability.commitments);
  const isBusy = !!bookedUntil && bookedUntil > totalDays;
  const delayDays = isBusy ? bookedUntil! - totalDays : 0;

  const risk = deriveRiskRead(person);
  const starDraw = isStarDraw(person);
  const traits = deriveTraits(person).slice(0, MAX_DISPLAYED_TRAITS);
  // The studio's standing with this person (engine/relationships.ts) - surfaced
  // in "Working with them" so a history (and the friendlier/costlier deal it
  // implies) is legible, not just silently priced into the numbers.
  const relationshipStanding = relationship ? describeRelationshipStanding(relationship) : null;

  // Actor identity, led BEFORE the fit hero (user request): who this performer
  // *is* - their signature gift or craft archetype and, when there's a real
  // trade to point out, the fame-vs-craft contrast - so the card reads as a
  // person to choose between, not just a match score to sort by.
  const isActor = category === 'actor';
  const isDirector = category === 'director';
  const isCrew = category === 'crew';
  const signatureLine = isActor ? (describeSignatureGift(person) ?? describeActorCraft(person)) : null;
  // The craft archetype as an always-shown chip - the card leads with an actor's
  // signature GIFT when they have one (most do), which left the archetype (the
  // biggest thing that makes two performers unequal - how much a director
  // matters to them) invisible. This surfaces it alongside the gift, with the
  // full "what it means" sentence on hover.
  const archetypeTag = isActor ? actorArchetypeTag(person) : null;
  const contrastLine = isActor ? describeFameCraftContrast(person) : null;
  // The on-screen performance projection - a co-equal peer to the role-fit hero,
  // so craft (what they actually deliver) and headroom (how much the director
  // choice swings them) read as prominently as fit, not as a buried afterthought.
  // Uses overallScore as the actor<->role fit the performance model gates on, and
  // sharpens to the attached director when there is one (headroom made concrete).
  const projection = isActor && overallScore !== null
    ? describeCastingProjection(projectCastingPerformance(person, overallScore, pairedDirector ?? undefined))
    : null;
  // Crew identity, mirroring the director's style line: their creative leanings
  // (PD/VFX/Cinematographer) and, for the two specialty departments, what they're
  // known for - so a crew head reads as a distinct craftsperson, not just a skill
  // bar. Both null for roles that carry no such data (Composer/Editor/Writer/...).
  const crewPhilosophyLine = isCrew ? describeCrewPhilosophy(person, role) : null;
  const crewSpecialtyLine = isCrew ? describeStandoutSpecialty(person, role) : null;

  const verb = isActor ? 'cast' : 'hire';
  const disclosureLabel = roleFit ? `${roleFit.title}, industry & working style` : 'Industry & working style';

  return (
    <>
      {/* Meta: age/gender paired with a prominent salary - the two facts a
          player scans a list for, given real weight (user request). */}
      <div className="talent-meta">
        <div className="talent-meta-id">
          {identityLine && <span className="candidate-identity-line">{identityLine}</span>}
          {isActor && character && <span className="talent-upfor">Up for {character.name} · {character.prominence} {CHARACTER_ARCHETYPE_LABELS[character.archetype]}</span>}
          {isActor && character && describeAgeFit(age, character.castingAgeBand) && (
            <span className="talent-upfor" style={{ color: 'var(--text-muted)' }}>{describeAgeFit(age, character.castingAgeBand)}</span>
          )}
        </div>
        <div className="talent-salary">
          <span className="talent-salary-amount"><Money amount={career?.typicalSalary ?? 0} /></span>
          {budget !== null && (
            <span className={`talent-afford talent-afford--${AFFORD_CLASS[budget]}`}>
              <span className="talent-dot" />
              {AFFORDABILITY_LABEL[budget]}
            </span>
          )}
        </div>
      </div>

      {/* Craft archetype - the always-visible categorical read of how much a
          director matters to this performer, so it's never hidden behind the
          gift line. Full meaning on hover. */}
      {archetypeTag && <span className="talent-archetype" title={describeActorCraft(person)}>{archetypeTag}</span>}

      {/* One-line identity read - who they are, not a stat. */}
      {signatureLine && <p className="talent-identity-line">{signatureLine}</p>}
      {contrastLine && <p className="talent-identity-line talent-identity-line--muted">{contrastLine}</p>}
      {isActor && pairedDirector && <p className="talent-identity-line talent-identity-line--muted">{describeDirectorActorPairing(pairedDirector, person)}</p>}
      {castAffinity && <p className={`talent-identity-line talent-affinity talent-affinity--${castAffinityTone(castAffinity)}`}>{describeCastAffinity(castAffinity)}</p>}
      {isDirector && career && 'productionStyle' in career && (
        <>
          <p className="talent-identity-line">{describeProductionStyle(career)}</p>
          <p className="talent-identity-line talent-identity-line--muted">{describeDirectorTouch(person)}</p>
        </>
      )}
      {crewPhilosophyLine && <p className="talent-identity-line">{crewPhilosophyLine}</p>}
      {crewSpecialtyLine && <p className="talent-identity-line talent-identity-line--muted">{crewSpecialtyLine}</p>}

      {/* THE FIT HERO - the card's anchor. A hedged read over a band (how sure
          the read is), never an exact number - for crew (a competence "hire"
          read) as much as actors/directors (a role "fit" read). A plain "why"
          names the strongest/weakest axis and, when the read is shaky, why. */}
      {fitRead && (
        <div className={`talent-fit talent-fit--${fitTier(fitRead.perceived)}`}>
          {/* An eyebrow pairs this read with the "On screen" projection below -
              two questions (right for the part? / how will they play it?) given
              parallel billing, so craft reads as co-equal with fit. */}
          {isActor && <span className="talent-read-eyebrow">Right for the part?</span>}
          <div className="talent-fit-top">
            <span className="talent-fit-verdict">{fitRead.verdict}</span>
            <span className={`talent-fit-caption talent-fit-caption--${fitRead.confidence}`}>{fitRead.confidenceLabel}</span>
          </div>
          {/* A band, not a point: the fill spans [low, high], wider the harder
              they are to read - so precision is never implied where there is none. */}
          <div className="talent-fit-meter talent-fit-meter--band">
            <span style={{ marginLeft: `${fitRead.low}%`, width: `${Math.max(2, fitRead.high - fitRead.low)}%` }} />
          </div>
          {(fitReason || fitRead.uncertaintyCause || fitRead.assistNote) && (
            <p className="talent-fit-why">
              {fitReason?.strengths}
              {fitReason?.caveat && <span className="talent-fit-caveat"> {fitReason.caveat}</span>}
              {fitRead.uncertaintyCause && <span className="talent-fit-caveat"> Hard to be sure — {fitRead.uncertaintyCause}.</span>}
              {fitRead.assistNote && <span className="talent-fit-assist"> {fitRead.assistNote.charAt(0).toUpperCase()}{fitRead.assistNote.slice(1)}.</span>}
            </p>
          )}
        </div>
      )}

      {/* THE PERFORMANCE PROJECTION - a co-equal peer to the fit hero. Fit says
          "right for the part?"; this says "how will they actually play it?" -
          the self-directed baseline, the ceiling the right director could
          unlock, and how much that director choice swings them. Makes craft and
          headroom read as prominently as fit, the thing that most distinguishes
          two performers. */}
      {projection && (
        <div className={`talent-projection talent-projection--${projection.tone}`}>
          <span className="talent-read-eyebrow">On screen</span>
          <span className="talent-projection-headline">{projection.headline}</span>
          <p className="talent-projection-detail">{projection.detail}</p>
        </div>
      )}

      {/* Status, as traffic-lights rather than prose or stars. */}
      <div className="talent-badges">
        {isBusy ? (
          <span className={`talent-badge talent-badge--${availabilityMode === 'blocked' ? 'bad' : 'warn'}`}>
            Booked until {formatGameDateWithMonth(bookedUntil!)}
          </span>
        ) : (
          <span className="talent-badge talent-badge--ok">✓ Available now</span>
        )}
        <span className={`talent-badge talent-badge--risk-${risk.tier}`}>{risk.label}</span>
        {starDraw && <span className="talent-badge talent-badge--neutral">★ Star draw</span>}
      </div>
      {isBusy && (
        <p className="talent-avail-detail">
          {availabilityMode === 'blocked'
            ? `You can't ${verb} them until then - their existing commitments won't clear in time.`
            : `Hiring them would delay production by ${delayDays} day${delayDays === 1 ? '' : 's'}.`}
        </p>
      )}

      {/* Everything deeper is one click away, so the default card stays short
          and bounded as more systems are added (user request). */}
      <details className="talent-more">
        {/* Stop the toggle click from bubbling: some callers (RoleHiringDrawer's
            crew/director cards) wrap this whole card in a selectable Card whose
            onClick registers a hire, so without this, expanding the disclosure
            would also cast/hire the person as the click propagates up. */}
        <summary className="talent-more-toggle" onClick={(e) => e.stopPropagation()}>
          <span className="talent-more-chevron" aria-hidden="true">›</span>
          {disclosureLabel}
        </summary>
        <div className="talent-more-body">
          {roleFit && gatedRows && <MatchBreakdown title={roleFit.title} rows={gatedRows} />}

          <div className="talent-more-group">
            <div className="talent-more-heading">Industry standing</div>
            <BarRow label="Fame" value={person.reputation.fame} />
            <BarRow label="Prestige" value={person.reputation.prestige} />
            <BarRow label="Reliability" value={person.reputation.reliability} />
          </div>

          <div className="talent-more-group">
            <div className="talent-more-heading">Working with them</div>
            <p className={`talent-risk-line talent-risk-line--${risk.tier}`}>{risk.label} to work with.</p>
            {relationshipStanding && <p className="talent-relationship-line">{relationshipStanding}</p>}
            {traits.length > 0 && (
              // Each trait now reads with its actual gameplay consequence
              // (TRAIT_EFFECTS - what it does to the shoot or the deal), not just a
              // bare tag you'd have to hover to understand.
              <ul className="candidate-trait-list">
                {traits.map((trait) => (
                  <li key={trait} className="candidate-trait-row">
                    <span className="candidate-trait-tag" title={TRAIT_DESCRIPTIONS[trait]}>{TRAIT_LABELS[trait]}</span>
                    <span className="candidate-trait-effect">{TRAIT_EFFECTS[trait]}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </details>
    </>
  );
}
