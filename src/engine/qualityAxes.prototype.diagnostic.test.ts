/**
 * PROTOTYPE (not wired into the game): a perceptual three-axis quality model.
 *
 * A film is scored on three axes - LOOK (how it looks), SOUND (how it sounds),
 * FEEL (how it makes you feel) - each 0-100, each with clear role owners:
 *
 *   LOOK  <- Cinematographer (dominant) + Set design + realised VFX + practical
 *   SOUND <- Composer + Sound Designer (a NEW role)
 *   FEEL  <- Script + Acting + Editor (pacing) + Composer (emotion)
 *
 * The DIRECTOR is not an axis owner - they are the unlocker: director skill gates
 * how much of each raw axis is realised (most on Feel, least on Sound), the same
 * way engine/actingModel.ts already has a director unlock a performance. This
 * keeps the Director the single most impactful hire while every craft role owns
 * its department.
 *
 * The three axes fuse into three DIFFERENT reader scores via one mechanism - a
 * weighted power mean, whose exponent `p` sets the temperament:
 *
 *   p = 0   geometric mean, mild weakest-link ......... QUALITY  (objective craft)
 *   p = -2  flaw-punishing, the weakest axis pulls hard  AUDIENCE (wants no flaws)
 *   p = +2  peak-rewarding, an exceptional axis lifts .. CRITIC   (admires ambition)
 *
 * QUALITY weights all three axes EQUALLY and is genre-neutral. Genre only tilts
 * how CRITIC and AUDIENCE weight the axes, and each carries a personality:
 *   - Audience: feel-led, enjoys spectacle, blind to craft subtlety / originality.
 *   - Critic: craft+story-led, rewards originality, discounts spectacle.
 * So the SAME film can read very differently across the three - and the more
 * lopsided the film, the more they diverge. A perfectly balanced film scores the
 * same everywhere.
 *
 * This file is a self-contained sandbox to FEEL the model before committing to
 * it - it changes no real scoring. Opt-in:
 *   QUALITY_AXES_PROTOTYPE=1 npx vitest run src/engine/qualityAxes.prototype.diagnostic.test.ts --disable-console-intercept
 */
import { describe, it } from 'vitest';
import { buildReadyDraft } from '../state/testFixtures';
import { computeScriptScore, computeDirectionScore, computeActingScore, computeQualityBreakdown } from './scoring';
import { setQualityScore, practicalEffectsScore, realizedVfxScore } from './productionDials';
import { neutralExecutionProfile } from './productionExecution';
import { generateTalentCandidates } from './talentGenerator';
import { getCrewCareer } from './person';
import { findAssignedPerson, professionForProductionRole } from '../data/helpers';
import { GENRE_PROFILES } from '../data/genres';
import { withRng, clamp, type RandomFn } from './random';
import type { CrewRole, FilmDraft, Genre, Person, ProductionRole, TalentAssignment } from '../types';

// ---------------------------------------------------------------------------
// The model (all tunables live here, at the top, so the whole thing is one dial
// board). Numbers are STARTING POINTS chosen to feel right - the point of the
// harness is to see them move and argue about them.
// ---------------------------------------------------------------------------

const P_QUALITY = 0; // geometric - mild weakest-link
const P_CRITIC = 2; // peak-rewarding
const P_AUDIENCE = -2; // flaw-punishing

// How much of each reader's personality is expressed as a flat modifier on top
// of the axis blend (the rest is the exponent + the genre-tilted weights).
const CRITIC_ORIGINALITY_PULL = 0.12; // critics reward script originality
const CRITIC_SPECTACLE_DISCOUNT = 0.06; // ...and are a little cold on pure spectacle
const AUDIENCE_SPECTACLE_PULL = 0.12; // audiences enjoy spectacle for its own sake

// Director-as-unlocker. The Director is NOT a co-owner contributing raw craft to
// an axis - they are the force that determines how much of each department's
// craft is realised (generalising engine/actingModel.ts, where a director
// unlocks a performance's headroom). Each axis's realised value =
//   raw * (floor + (ceil - floor) * directorRatio)
// where directorRatio is the direction score / 100. A terrible director suppresses
// each axis toward its `floor` multiplier; a great one lifts it to `ceil` (which
// can exceed 1 - a great director genuinely elevates, not merely preserves). Feel
// is the most director-dependent (performances, pacing, tone); a cinematographer
// and composer are more self-sufficient, so Look/Sound are gated more gently.
const DIRECTOR_UNLOCK: Record<keyof FilmAxes, { floor: number; ceil: number }> = {
  feel: { floor: 0.48, ceil: 1.22 },
  look: { floor: 0.66, ceil: 1.12 },
  sound: { floor: 0.7, ceil: 1.12 },
};

interface FilmAxes {
  look: number;
  sound: number;
  feel: number;
}

/** Weighted power mean - the single fusion mechanism. p=1 additive, p->0 geometric, p<0 weakest-link, p>0 peak-leaning. */
function powerMean(items: { v: number; w: number }[], p: number): number {
  const W = items.reduce((s, i) => s + i.w, 0);
  const safe = (v: number) => Math.max(v, 0.001);
  if (Math.abs(p) < 1e-9) {
    const lnSum = items.reduce((s, i) => s + i.w * Math.log(safe(i.v)), 0);
    return Math.exp(lnSum / W);
  }
  const pSum = items.reduce((s, i) => s + i.w * Math.pow(safe(i.v), p), 0);
  return Math.pow(pSum / W, 1 / p);
}

function crewSkill(talent: TalentAssignment[], role: CrewRole): number {
  const person = findAssignedPerson(talent, role);
  if (!person) return 50;
  return getCrewCareer(person, role)?.skill ?? 50;
}

/**
 * Raw department craft on each axis - what each department delivers BEFORE the
 * director determines how much of it is realised. No director term here; the
 * director enters as a separate unlocker (applyDirection). Derived from the same
 * signals the real engine already produces (Principle 7: reuse, don't reinvent).
 * Sound Designer isn't a real role yet, so its skill is passed in explicitly.
 * (Note: computeActingScore already folds in the director's per-performance
 * unlock, so Feel carries a little director dependence even before applyDirection
 * - an accepted overlap in this prototype.)
 */
function computeRawAxes(draft: FilmDraft, soundDesignerSkill = 50): FilmAxes {
  const script = draft.script!;
  const talent = draft.talent;
  const choices = draft.productionChoices!;

  const story = computeScriptScore(script);
  const acting = computeActingScore(talent, script);
  const editor = crewSkill(talent, 'Editor');
  const composer = crewSkill(talent, 'Composer');
  const cinematography = crewSkill(talent, 'Cinematographer');
  const set = setQualityScore(choices.setQualityAmount);
  const practical = practicalEffectsScore(choices.practicalEffectsAmount);
  const realizedVfx = realizedVfxScore(choices.vfxAmount, crewSkill(talent, 'VFX Supervisor'));

  // FEEL - story + performance heavy; the editor shapes pacing/clarity, the composer lends emotion.
  const feel = clamp(story * 0.35 + acting * 0.35 + editor * 0.22 + composer * 0.08, 0, 100);
  // LOOK - the cinematographer is the dominant voice; sets and VFX fill it in.
  const look = clamp(cinematography * 0.44 + set * 0.24 + realizedVfx * 0.2 + practical * 0.12, 0, 100);
  // SOUND - composer leads, the new sound designer a strong second.
  const sound = clamp(composer * 0.55 + soundDesignerSkill * 0.45, 0, 100);
  return { look, sound, feel };
}

/** The Director determines how much of each raw axis is realised - the unlocker. `directionScore` is computeDirectionScore (0-100). */
function applyDirection(raw: FilmAxes, directionScore: number): FilmAxes {
  const r = clamp(directionScore, 0, 100) / 100;
  const gate = (v: number, u: { floor: number; ceil: number }) => clamp(v * (u.floor + (u.ceil - u.floor) * r), 0, 100);
  return { look: gate(raw.look, DIRECTOR_UNLOCK.look), sound: gate(raw.sound, DIRECTOR_UNLOCK.sound), feel: gate(raw.feel, DIRECTOR_UNLOCK.feel) };
}

function qualityScore(a: FilmAxes): number {
  // Equal weights, genre-neutral - the objective craft reading.
  return powerMean([{ v: a.look, w: 1 }, { v: a.sound, w: 1 }, { v: a.feel, w: 1 }], P_QUALITY);
}

function audienceWeights(genre: Genre): FilmAxes {
  const spectacle = GENRE_PROFILES[genre].vfxImportance; // 0-1
  // Feel-led; the more spectacle the genre trades in, the more Look counts.
  return { look: 0.25 + 0.2 * spectacle, sound: 0.25, feel: 0.5 - 0.1 * spectacle };
}

function criticWeights(genre: Genre): FilmAxes {
  const storyImportance = GENRE_PROFILES[genre].scriptImportance; // 0-1
  return { look: 0.32, sound: 0.2, feel: 0.38 + 0.1 * storyImportance };
}

function audienceScore(a: FilmAxes, genre: Genre, spectacleLevel: number): number {
  const w = audienceWeights(genre);
  const base = powerMean([{ v: a.look, w: w.look }, { v: a.sound, w: w.sound }, { v: a.feel, w: w.feel }], P_AUDIENCE);
  const spectacleJoy = (spectacleLevel - 50) * GENRE_PROFILES[genre].vfxImportance * AUDIENCE_SPECTACLE_PULL;
  return clamp(base + spectacleJoy, 0, 100);
}

function criticScore(a: FilmAxes, genre: Genre, originality: number, spectacleLevel: number): number {
  const w = criticWeights(genre);
  const base = powerMean([{ v: a.look, w: w.look }, { v: a.sound, w: w.sound }, { v: a.feel, w: w.feel }], P_CRITIC);
  const originalityLift = (originality - 50) * CRITIC_ORIGINALITY_PULL;
  const spectacleChill = (spectacleLevel - 50) * GENRE_PROFILES[genre].vfxImportance * CRITIC_SPECTACLE_DISCOUNT;
  return clamp(base + originalityLift - spectacleChill, 0, 100);
}

// ---------------------------------------------------------------------------
// Baseline builder + role-level overrides (mirrors roleSensitivity.diagnostic).
// ---------------------------------------------------------------------------

type Level = 'floor' | 'strong' | 'ceil';
const LEVELS: Record<Level, { skill: number; craftFloor: number; craftHeadroom: number }> = {
  floor: { skill: 8, craftFloor: 40, craftHeadroom: 3 },
  strong: { skill: 78, craftFloor: 74, craftHeadroom: 22 },
  ceil: { skill: 98, craftFloor: 80, craftHeadroom: 45 },
};

const CREW_ROLES: ProductionRole[] = ['Writer', 'Cinematographer', 'Composer', 'Editor', 'VFX Supervisor', 'Casting Director'];
// Sound Designer is prototype-only (not a real role), varied via an explicit skill.
const AXIS_ROLES: (ProductionRole | 'Sound Designer')[] = [
  'Director', 'Lead Actor', 'Supporting Actor', 'Cinematographer', 'VFX Supervisor', 'Composer', 'Sound Designer', 'Editor', 'Writer', 'Casting Director',
];

function setRoleLevel(person: Person, role: ProductionRole, level: Level): Person {
  const L = LEVELS[level];
  const careers = person.careers;
  if (role === 'Director') {
    return careers.director ? { ...person, careers: { ...careers, director: { ...careers.director, skill: L.skill } } } : person;
  }
  if (role === 'Lead Actor' || role === 'Supporting Actor') {
    return careers.actor ? { ...person, careers: { ...careers, actor: { ...careers.actor, craftFloor: L.craftFloor, craftHeadroom: L.craftHeadroom } } } : person;
  }
  const key = { Writer: 'writer', Cinematographer: 'cinematographer', Composer: 'composer', Editor: 'editor', 'VFX Supervisor': 'vfxSupervisor', 'Casting Director': 'castingDirector' }[role] as keyof typeof careers;
  const crew = careers[key];
  return crew ? { ...person, careers: { ...careers, [key]: { ...crew, skill: L.skill } } } : person;
}

function buildBaseline(rng: RandomFn): FilmDraft {
  const base = buildReadyDraft(rng);
  const script = base.script!;
  const excellentScript = { ...script, originality: 90, structure: 90, characters: 90, dialogue: 90 };
  const crew: TalentAssignment[] = CREW_ROLES.map((role) => ({ role, person: generateTalentCandidates(professionForProductionRole(role), rng, 1)[0] }));
  const talent = [...base.talent, ...crew].map((a) => ({ ...a, person: setRoleLevel(a.person, a.role, 'strong') }));
  return { ...base, script: excellentScript, talent };
}

/** Score a draft through the prototype (neutral shoot - the model's structural sensitivity). */
function scoreDraft(draft: FilmDraft, genre: Genre, soundDesignerSkill: number) {
  const axes = applyDirection(computeRawAxes(draft, soundDesignerSkill), computeDirectionScore(draft.talent, draft.script!));
  const spectacle = realizedVfxScore(draft.productionChoices!.vfxAmount, crewSkill(draft.talent, 'VFX Supervisor'));
  return {
    axes,
    quality: qualityScore(axes),
    critic: criticScore(axes, genre, draft.script!.originality, spectacle),
    audience: audienceScore(axes, genre, spectacle),
  };
}

function oldQuality(draft: FilmDraft): number {
  return computeQualityBreakdown(
    draft.script!, draft.talent, draft.genre!, draft.productionChoices!, draft.postProductionChoices!, [], 1, 0, neutralExecutionProfile(1),
  ).qualityScore;
}

const f1 = (n: number) => n.toFixed(1).padStart(6);
const enabled = Boolean((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.QUALITY_AXES_PROTOTYPE);

describe.skipIf(!enabled)('Quality-axes prototype (Look/Sound/Feel)', () => {
  it('shows combination behaviour, critic/audience divergence, role sensitivity, and genre effect', () => {
    const lines: string[] = [];

    // --- 1. COMBINATION SHOWCASE: hand-picked axis triples, one default genre ---
    lines.push('\n=== 1. COMBINATION SHOWCASE (equal-weight axes; Action reception) ===');
    lines.push('The same three numbers read as three scores. Balanced films agree; lopsided films diverge.');
    lines.push(`  ${'archetype'.padEnd(24)} ${'Look'.padStart(5)} ${'Sound'.padStart(6)} ${'Feel'.padStart(5)}  ${'QUALITY'.padStart(7)} ${'CRITIC'.padStart(7)} ${'AUD'.padStart(6)}  ${'C-A gap'.padStart(7)}`);
    const showcase: { name: string; a: FilmAxes; orig: number; spec: number }[] = [
      { name: 'Polished crowd-pleaser', a: { look: 72, sound: 72, feel: 72 }, orig: 45, spec: 70 },
      { name: 'Gorgeous but hollow', a: { look: 92, sound: 80, feel: 45 }, orig: 40, spec: 85 },
      { name: 'Ambitious swing', a: { look: 55, sound: 60, feel: 92 }, orig: 88, spec: 40 },
      { name: 'Dumb fun blockbuster', a: { look: 82, sound: 80, feel: 66 }, orig: 25, spec: 90 },
      { name: 'Cheap prestige drama', a: { look: 48, sound: 58, feel: 88 }, orig: 82, spec: 20 },
      { name: 'Technically flawless, cold', a: { look: 90, sound: 90, feel: 55 }, orig: 55, spec: 75 },
    ];
    const G: Genre = 'Action';
    for (const s of showcase) {
      const q = qualityScore(s.a);
      const c = criticScore(s.a, G, s.orig, s.spec);
      const au = audienceScore(s.a, G, s.spec);
      lines.push(`  ${s.name.padEnd(24)} ${f1(s.a.look)} ${f1(s.a.sound)} ${f1(s.a.feel)}  ${f1(q)} ${f1(c)} ${f1(au)}  ${(c - au).toFixed(1).padStart(7)}`);
    }

    // --- 2. THE EXPONENT DIAL: one lopsided film across p ---
    lines.push('\n=== 2. THE EXPONENT DIAL (film 92/80/45, equal weights) ===');
    lines.push('Same film, same weights; only the fusion exponent p changes. This is the "how strict is weakest-link" knob.');
    const lop: FilmAxes = { look: 92, sound: 80, feel: 45 };
    lines.push(`  ${'p'.padStart(5)}  ${'score'.padStart(6)}   meaning`);
    for (const [p, label] of [[-4, 'near-min: one bad axis sinks it'], [-2, 'AUDIENCE: flaw-punishing'], [0, 'QUALITY: geometric'], [1, 'plain average (additive)'], [2, 'CRITIC: peak-rewarding'], [4, 'near-max: only the best axis']] as const) {
      lines.push(`  ${String(p).padStart(5)}  ${f1(powerMean([{ v: lop.look, w: 1 }, { v: lop.sound, w: 1 }, { v: lop.feel, w: 1 }], p))}   ${label}`);
    }

    // --- 3. ROLE SENSITIVITY under the axis model (neutral shoot) ---
    const baseline = withRng(4817, (rng) => buildBaseline(rng)).result;
    lines.push('\n=== 3. ROLE SENSITIVITY - axis model vs current model (floor skill~8 -> ceiling skill~98) ===');
    lines.push('dLook/dSound/dFeel = axis movement; then how that lands on each reader. oldDQ = current computeQualityBreakdown.');
    lines.push(`  ${'role'.padEnd(18)} ${'dLook'.padStart(6)} ${'dSound'.padStart(6)} ${'dFeel'.padStart(6)}  ${'dQUAL'.padStart(6)} ${'dCRIT'.padStart(6)} ${'dAUD'.padStart(6)}   ${'oldDQ'.padStart(6)}`);
    const genre = baseline.genre!;
    for (const role of AXIS_ROLES) {
      let floorDraft = baseline, ceilDraft = baseline, sdFloor = 78, sdCeil = 78;
      if (role === 'Sound Designer') {
        sdFloor = LEVELS.floor.skill; sdCeil = LEVELS.ceil.skill;
      } else {
        floorDraft = { ...baseline, talent: baseline.talent.map((a) => (a.role === role ? { ...a, person: setRoleLevel(a.person, role, 'floor') } : a)) };
        ceilDraft = { ...baseline, talent: baseline.talent.map((a) => (a.role === role ? { ...a, person: setRoleLevel(a.person, role, 'ceil') } : a)) };
      }
      const lo = scoreDraft(floorDraft, genre, sdFloor);
      const hi = scoreDraft(ceilDraft, genre, sdCeil);
      const oldDq = oldQuality(ceilDraft) - oldQuality(floorDraft);
      lines.push(
        `  ${String(role).padEnd(18)} ${f1(hi.axes.look - lo.axes.look)} ${f1(hi.axes.sound - lo.axes.sound)} ${f1(hi.axes.feel - lo.axes.feel)}  ${f1(hi.quality - lo.quality)} ${f1(hi.critic - lo.critic)} ${f1(hi.audience - lo.audience)}   ${f1(oldDq)}`,
      );
    }

    // --- 4. GENRE EFFECT: one film, scored as different genres ---
    lines.push('\n=== 4. GENRE EFFECT ON RECEPTION (same film & axes; Quality is genre-neutral) ===');
    lines.push('Genre changes only how critics/audiences weight the axes - Quality never moves.');
    const filmA: FilmAxes = { look: 85, sound: 78, feel: 62 }; // a spectacle-forward film
    lines.push(`  film Look/Sound/Feel = 85/78/62, originality 40, spectacle 85`);
    lines.push(`  ${'genre'.padEnd(12)} ${'vfxImp'.padStart(6)} ${'QUALITY'.padStart(7)} ${'CRITIC'.padStart(7)} ${'AUD'.padStart(6)}`);
    for (const gg of ['Action', 'Drama', 'Horror', 'Sci-Fi'] as Genre[]) {
      lines.push(`  ${gg.padEnd(12)} ${GENRE_PROFILES[gg].vfxImportance.toFixed(2).padStart(6)} ${f1(qualityScore(filmA))} ${f1(criticScore(filmA, gg, 40, 85))} ${f1(audienceScore(filmA, gg, 85))}`);
    }

    // --- 5. FEEL BREAKDOWN: what's actually in the axis, and acting's real range ---
    lines.push('\n=== 5. FEEL BREAKDOWN (baseline excellent film) ===');
    const script = baseline.script!;
    const FEEL_W = { story: 0.35, acting: 0.35, editor: 0.22, composer: 0.08 };
    const story = computeScriptScore(script);
    const actingStrong = computeActingScore(baseline.talent, script);
    const editorStrong = crewSkill(baseline.talent, 'Editor');
    const composerStrong = crewSkill(baseline.talent, 'Composer');
    lines.push('  Raw Feel = story*.35 + acting*.35 + editor*.22 + composer*.08  (before the director unlock).');
    lines.push(`  ${'input'.padEnd(10)} ${'value'.padStart(6)} ${'weight'.padStart(7)} ${'contribution'.padStart(13)}`);
    const parts: [string, number, number][] = [['story', story, FEEL_W.story], ['acting', actingStrong, FEEL_W.acting], ['editor', editorStrong, FEEL_W.editor], ['composer', composerStrong, FEEL_W.composer]];
    for (const [n, v, w] of parts) lines.push(`  ${n.padEnd(10)} ${f1(v)} ${w.toFixed(2).padStart(7)} ${f1(v * w)}`);
    lines.push(`  ${'RAW FEEL'.padEnd(10)} ${' '.repeat(6)} ${' '.repeat(7)} ${f1(parts.reduce((s, [, v, w]) => s + v * w, 0))}`);

    lines.push('\n  Acting\'s real range - move BOTH actors floor->strong->ceil (everything else fixed):');
    lines.push(`  ${'actors'.padEnd(8)} ${'actingScore'.padStart(11)} ${'rawFeel'.padStart(8)} ${'QUALITY'.padStart(7)}`);
    const actorsAt = (level: Level): FilmDraft => ({
      ...baseline,
      talent: baseline.talent.map((a) => (a.role === 'Lead Actor' || a.role === 'Supporting Actor' ? { ...a, person: setRoleLevel(a.person, a.role, level) } : a)),
    });
    const actingQ: Record<Level, number> = { floor: 0, strong: 0, ceil: 0 };
    for (const level of ['floor', 'strong', 'ceil'] as Level[]) {
      const d = actorsAt(level);
      const act = computeActingScore(d.talent, script);
      const rawFeel = story * FEEL_W.story + act * FEEL_W.acting + editorStrong * FEEL_W.editor + composerStrong * FEEL_W.composer;
      const q = scoreDraft(d, genre, 78).quality;
      actingQ[level] = q;
      lines.push(`  ${level.padEnd(8)} ${f1(act)} ${f1(rawFeel)} ${f1(q)}`);
    }
    lines.push(`  -> BOTH actors floor->ceil moves Quality by ${(actingQ.ceil - actingQ.floor).toFixed(1)} pt (per-role table splits this across Lead/Supporting).`);
    lines.push('\n  Why acting reads low: it shares Feel with a FIXED 90-pt story, Feel is only 1/3 of an equal-weighted');
    lines.push('  Quality, and actors swing over a compressed craft range (~40-90) vs crew skill (8-98). Effective');
    lines.push(`  weight of acting on Quality ~= .35 (in Feel) x 1/3 (Feel's share) ~= 0.12, vs ~0.25 in the current model.`);

    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
  }, 120_000);
});
