// What the studio knows about a person, and how it came to know it
// (docs/DESIGN_talent_model.md §4.5, stage 4).
//
// Ability is never shown. The player holds a READ of each attribute the person's
// job involves, and each read has its own confidence. The read is built from
// evidence, and the evidence is the films the person actually made:
//
//   - A film only tests what it asked of them. A lead in an action film tests
//     physical performance and charisma, and says nothing about comedy. So
//     repetition has diminishing returns and range has to be tried to be known.
//   - Your own films are strong evidence: you were there, you know who directed
//     and how the part fit, so you can separate the person from the help.
//   - Other studios' films are weak evidence, capped well short of certainty,
//     and for actors they lean optimistic when a strong director was drawing the
//     performance out.
//   - A pre-game career (priorCredits) is second-hand evidence of what people
//     cast them for: their strong suits, seen more the more famous they are.
//   - A casting director's eye and a screen test are studio-side sharpeners.
//
// Nothing here is stored. Every input is already on a released Film (who worked
// on it, in what part, under whom, how it went), so knowledge is derived, the
// way relationships are. Pure: plain data in, plain data out.

import type { ActingStyle, Film, Person, PersonId, ProductionRole, Project, ScriptCharacter } from '../types';
import { ACTING_STYLE_AXES } from '../data/actingStyle';
import { ACTING_STYLE_TO_CHARACTER_TRAIT } from './compatibility';
import { characterForRoleSlot } from './castRequirements';
import { deriveDirectorAptitudes, APTITUDE_DOMAINS, type AptitudeDomain } from './creativeAptitudes';
import { crewSpecialtyCapability, specialtyDepartmentForRole, specialtyLoads, DEPT_SPECIALTIES, SPECIALTY_LABEL, type CrewSpecialty } from './crewSpecialty';
import { deriveDepartmentWorkloadsForScript } from './departmentWorkload';
import { readCastPerformances } from './castPerformance';
import { getCareerForRole, getPriorCredits } from './person';
import { hashUnit } from './random';
import { asFilm } from './project';
import { gameDateFromTotalDays } from './calendar';

// --- Tunables ----------------------------------------------------------------

/** Evidence weight of one film, by whose film it was. Your own set is the measurement; someone else's is a clue. */
export const OWN_FILM_WEIGHT = 1;
export const ELSEWHERE_FILM_WEIGHT = 0.3;
/** Second-hand evidence per pre-game credit, scaled by how strong the attribute is (people are cast to their strengths) and by fame (famous people are seen). */
export const PRIOR_CREDIT_WEIGHT = 0.1;
const PRIOR_CREDIT_CAP = 25;
/** Own evidence needed for a read to firm up: one demanding lead gets you about half way, three make it certain. */
const OWN_EVIDENCE_SCALE = 1;
/** Second-hand evidence firms up more slowly and never past this. A lot of other people's films still leaves the circumstances unknown. */
const ELSEWHERE_EVIDENCE_SCALE = 1.2;
export const ELSEWHERE_CONFIDENCE_CAP = 0.6;
/** A casting director's eye on actors, at full skill. Unbiased but not a measurement. */
const CASTING_DIRECTOR_CONFIDENCE = 0.5;
/** A screen test for this part, on the attributes the part asks for. */
const AUDITION_CONFIDENCE = 0.85;
/** Band half-width, in ability points, around the read's centre: from a certain read to an untested guess. */
const MIN_HALF_WIDTH = 4;
const MAX_HALF_WIDTH = 30;
/** How far an unconfirmed read can sit off the truth, from noise, before evidence pulls it in. */
const READ_NOISE = 16;
/** How much a strong director's help flatters an actor's second-hand read. */
const ASSISTED_OPTIMISM = 12;
/** A director whose work with actors is at least this good gets the best out of everyone. */
const STRONG_ACTORS_DIRECTOR = 75;
/** Below this test strength a film barely counts as having tested the attribute. */
const MEANINGFUL_TEST = 0.25;

/** Below this, a pre-game career has barely shown the attribute at all. */
const FAINT_CAREER = 0.15;

/** Confidence tiers the card speaks in. */
export const CERTAIN_CONFIDENCE = 0.8;
export const FAIR_CONFIDENCE = 0.35;

// --- Attributes ----------------------------------------------------------------

export type KnowledgeProfession = 'actor' | 'director' | 'writer' | 'crew';

export function knowledgeProfession(role: ProductionRole): KnowledgeProfession {
  if (role === 'Lead Actor' || role === 'Supporting Actor') return 'actor';
  if (role === 'Director') return 'director';
  if (role === 'Writer') return 'writer';
  return 'crew';
}

export interface KnowledgeAttribute {
  key: string;
  label: string;
  /** The true value, 0-100. Internal: never shown, only read through evidence. */
  value: number;
}

const ACTOR_LABEL: Record<keyof ActingStyle, string> = {
  characterTransformation: 'Character transformation',
  emotionalPerformance: 'Emotional performance',
  charisma: 'Charisma',
  comedy: 'Comedy',
  physicalPerformance: 'Physical performance',
};

const DIRECTOR_LABEL: Record<AptitudeDomain, string> = {
  story: 'Storytelling',
  visual: 'Visual command',
  performance: 'Working with actors',
  craft: 'Shaping the cut',
};

/** What a part never asked of them, phrased for "Nobody has seen them ...". */
const UNTESTED_PHRASE: Record<string, string> = {
  characterTransformation: 'disappear into a character',
  emotionalPerformance: 'carry a dramatic part',
  charisma: 'carry a film on presence',
  comedy: 'be funny',
  physicalPerformance: 'do physical work',
  story: 'shape a story',
  visual: 'command a big canvas',
  performance: 'work closely with actors',
  craft: 'shape a cut',
};

/** What the person was used for, phrased for "You have only ever used them for ...". */
const USED_FOR_PHRASE: Record<string, string> = {
  characterTransformation: 'transformation roles',
  emotionalPerformance: 'dramatic parts',
  charisma: 'parts that run on presence',
  comedy: 'comedy',
  physicalPerformance: 'physical parts',
};

/** The attributes a person's job involves, with their true values. */
export function knowledgeAttributes(person: Person, role: ProductionRole): KnowledgeAttribute[] {
  const profession = knowledgeProfession(role);
  if (profession === 'actor') {
    const style = person.careers.actor?.actingStyle;
    if (!style) return [];
    return ACTING_STYLE_AXES.map((axis) => ({ key: axis, label: ACTOR_LABEL[axis], value: style[axis] }));
  }
  if (profession === 'director') {
    if (!person.careers.director) return [];
    const aptitudes = deriveDirectorAptitudes(person);
    return APTITUDE_DOMAINS.map((d) => ({ key: d, label: DIRECTOR_LABEL[d], value: aptitudes[d] }));
  }
  const career = getCareerForRole(person, role);
  const skill = career && 'skill' in career ? career.skill : null;
  if (skill === null) return [];
  const department = specialtyDepartmentForRole(role);
  if (department) {
    const caps = crewSpecialtyCapability(person, role, department, skill);
    return DEPT_SPECIALTIES[department].map((s) => ({ key: s, label: SPECIALTY_LABEL[s], value: caps[s] }));
  }
  return [{ key: 'craft', label: profession === 'writer' ? 'Writing' : 'Their craft', value: skill }];
}

// --- Credits -------------------------------------------------------------------

/** One released film a person worked on, as the studio can see it. */
export interface Credit {
  film: Film;
  role: ProductionRole;
  /** Index of this role among the film's hires in the same role - picks the character for an actor without an explicit binding. */
  slotIndex: number;
  /** The player's own film. */
  own: boolean;
}

export type CreditIndex = Map<PersonId, Credit[]>;

const indexCache = new WeakMap<Project[], CreditIndex>();

/** Every released film's credits, by person, newest first. Cached per projects array. */
export function buildCreditIndex(projects: Project[]): CreditIndex {
  const cached = indexCache.get(projects);
  if (cached) return cached;
  const index: CreditIndex = new Map();
  for (const project of projects) {
    const film = asFilm(project);
    if (!film) continue;
    const slots = new Map<ProductionRole, number>();
    for (const assignment of film.talent) {
      const slotIndex = slots.get(assignment.role) ?? 0;
      slots.set(assignment.role, slotIndex + 1);
      const credit: Credit = { film, role: assignment.role, slotIndex, own: film.releasedBy === undefined };
      const list = index.get(assignment.person.id);
      if (list) list.push(credit);
      else index.set(assignment.person.id, [credit]);
    }
  }
  for (const list of index.values()) list.sort((a, b) => b.film.releasedOnDay - a.film.releasedOnDay);
  indexCache.set(projects, index);
  return index;
}

/** The credits that speak to this role's attributes: the same profession, any studio. */
export function creditsFor(index: CreditIndex, personId: PersonId, role: ProductionRole): Credit[] {
  const profession = knowledgeProfession(role);
  return (index.get(personId) ?? []).filter((c) => knowledgeProfession(c.role) === profession);
}

function creditCharacter(credit: Credit, personId: PersonId): ScriptCharacter | null {
  const assignment = credit.film.talent.find((a) => a.person.id === personId && a.role === credit.role);
  const bound = assignment?.characterId ? credit.film.script.cast.find((c) => c.id === assignment.characterId) : undefined;
  return bound ?? characterForRoleSlot(credit.film.script, credit.role, credit.slotIndex);
}

const SCALE_TEST: Record<string, number> = { Intimate: 0.6, Medium: 0.8, Epic: 1 };

/** How hard one credit tested each attribute, 0..1. A film tells you nothing about what it never asked for. */
export function creditTests(credit: Credit, personId: PersonId, attributes: KnowledgeAttribute[]): Record<string, number> {
  const out: Record<string, number> = {};
  const profession = knowledgeProfession(credit.role);
  const scale = SCALE_TEST[credit.film.script.scale] ?? 0.8;
  if (profession === 'actor') {
    const character = creditCharacter(credit, personId);
    const prominence = credit.role === 'Lead Actor' ? 1 : 0.6;
    for (const a of attributes) {
      const trait = ACTING_STYLE_TO_CHARACTER_TRAIT[a.key as keyof ActingStyle];
      const demand = character && trait ? character.traits[trait] / 100 : 0.3;
      out[a.key] = Math.min(1, demand * prominence);
    }
    return out;
  }
  if (profession === 'director') {
    const tone = credit.film.script.toneProfile;
    const spectacle = (tone?.spectacle ?? 40) / 100;
    const castDemand = credit.film.script.cast.length > 0 ? 0.8 : 0.4;
    const base: Record<AptitudeDomain, number> = { story: 0.8, performance: castDemand, visual: 0.35 + 0.65 * spectacle, craft: 0.6 };
    for (const a of attributes) out[a.key] = Math.min(1, (base[a.key as AptitudeDomain] ?? 0.5) * scale);
    return out;
  }
  const department = specialtyDepartmentForRole(credit.role);
  if (department) {
    const workload = deriveDepartmentWorkloadsForScript(credit.film.script).find((w) => w.department === department);
    const loads = workload ? specialtyLoads(workload.contributions) : {};
    const peak = Math.max(0, ...Object.values(loads).map((v) => v ?? 0));
    for (const a of attributes) {
      const load = loads[a.key as CrewSpecialty] ?? 0;
      out[a.key] = peak > 0 ? Math.min(1, (load / peak) * (0.4 + 0.6 * (workload?.magnitude ?? 0.5))) : 0;
    }
    return out;
  }
  for (const a of attributes) out[a.key] = 0.5 + 0.5 * (scale - 0.6) / 0.4;
  return out;
}

// --- Reads ---------------------------------------------------------------------

export type ReadTier = 'certain' | 'fair' | 'slight' | 'untested';

export type EvidenceSource = 'own' | 'elsewhere' | 'career' | 'casting-director' | 'audition' | 'none';

export interface AttributeRead {
  key: string;
  label: string;
  /** Player-facing centre of the read, 0-100. Not the true value: noise and flattery fade only as evidence comes in. */
  centre: number;
  low: number;
  high: number;
  /** 0..1 */
  confidence: number;
  tier: ReadTier;
  /** "Strong", "Very likely good", "Good to strong", "Hard to say", "Untested". */
  verdict: string;
  /** Where the read comes from, in words: "You saw it on two of your films". */
  basis: string;
  /** The strongest kind of evidence behind it. */
  source: EvidenceSource;
  /** Own films that meaningfully tested this attribute. */
  ownFilms: number;
  /** Other studios' films that meaningfully tested it. */
  elsewhereFilms: number;
}

export interface TrackRecordRow {
  filmId: string;
  title: string;
  year: number;
  /** "Lead · action", "Director · drama". */
  part: string;
  own: boolean;
  /** "Hit", "Flop", "Did fine"... */
  outcome: string;
  outcomeTone: 'good' | 'neutral' | 'bad';
  /** An actor's own notices, when they stood out either way: "singled out", "the weak link". */
  personal: string | null;
}

export interface TalentKnowledge {
  personId: PersonId;
  profession: KnowledgeProfession;
  reads: AttributeRead[];
  /** All films worked, counting the career before the game began. */
  totalFilms: number;
  ownFilms: number;
  /** Released films in the game, newest first. */
  trackRecord: TrackRecordRow[];
  /** The single most useful thing to know before offering, or null. */
  caveat: string | null;
}

export interface KnowledgeOptions {
  /** A hired casting director's skill, 0-100. Reads actors only. */
  castingDirectorSkill?: number | null;
  /** The part being cast, for a completed screen test and for the caveat. */
  character?: ScriptCharacter | null;
  /** A screen test for `character` has been completed. */
  audited?: boolean;
}

function ownConfidence(evidence: number): number {
  return 1 - Math.exp(-evidence / OWN_EVIDENCE_SCALE);
}

function elsewhereConfidence(evidence: number): number {
  return ELSEWHERE_CONFIDENCE_CAP * (1 - Math.exp(-evidence / ELSEWHERE_EVIDENCE_SCALE));
}

const combine = (a: number, b: number) => 1 - (1 - a) * (1 - b);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function abilityWord(value: number): string {
  if (value >= 85) return 'outstanding';
  if (value >= 70) return 'strong';
  if (value >= 55) return 'good';
  if (value >= 40) return 'ordinary';
  return 'weak';
}

const WORD_ORDER = ['weak', 'ordinary', 'good', 'strong', 'outstanding'];
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function tierFor(confidence: number, tested: boolean): ReadTier {
  if (!tested) return 'untested';
  if (confidence >= CERTAIN_CONFIDENCE) return 'certain';
  if (confidence >= FAIR_CONFIDENCE) return 'fair';
  return 'slight';
}

function verdictFor(tier: ReadTier, centre: number, low: number, high: number): string {
  if (tier === 'untested') return 'Untested';
  if (tier === 'certain') return capitalize(abilityWord(centre));
  const lo = WORD_ORDER.indexOf(abilityWord(low));
  const hi = WORD_ORDER.indexOf(abilityWord(high));
  if (lo === hi) return `${tier === 'fair' ? 'Very likely' : 'Probably'} ${WORD_ORDER[lo]}`;
  if (hi - lo === 1) return `${capitalize(WORD_ORDER[lo])} to ${WORD_ORDER[hi]}`;
  // Wide, but there is a fair read behind it: lean on its centre.
  if (tier === 'fair') return `Probably ${abilityWord(centre)}`;
  return 'Hard to say';
}

const COUNT_WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const countWord = (n: number) => COUNT_WORD[n] ?? `${n}`;

function basisFor(source: EvidenceSource | 'career-faint', ownFilms: number, elsewhereFilms: number): string {
  switch (source) {
    case 'own':
      if (ownFilms === 0) return 'Glimpsed in a small part for you';
      return ownFilms === 1 ? 'You saw it on one of your films' : `You saw it on ${countWord(ownFilms)} of your films`;
    case 'audition':
      return 'Their screen test for this part';
    case 'casting-director':
      return 'Your casting director\'s read';
    case 'elsewhere':
      return elsewhereFilms === 1 ? 'One film for another studio' : `${capitalize(countWord(elsewhereFilms))} films for other studios`;
    case 'career':
      return 'What they are known for';
    case 'career-faint':
      return 'Barely seen in their work';
    case 'none':
      return 'Nothing to go on';
  }
}

/** Does a director bring out the best in actors? Used to discount what an actor did for them. */
function isStrongActorsDirector(director: Person | undefined): boolean {
  if (!director?.careers.director) return false;
  return deriveDirectorAptitudes(director).performance >= STRONG_ACTORS_DIRECTOR;
}

function directorOf(film: Film): Person | undefined {
  return film.talent.find((a) => a.role === 'Director')?.person;
}

/**
 * The studio's read of a person for a role: one read per attribute, the track
 * record behind them, and the most useful caveat. Deterministic.
 */
export function deriveTalentKnowledge(
  person: Person,
  role: ProductionRole,
  index: CreditIndex,
  options: KnowledgeOptions = {},
): TalentKnowledge {
  const profession = knowledgeProfession(role);
  const attributes = knowledgeAttributes(person, role);
  const credits = creditsFor(index, person.id, role);

  const own: Record<string, number> = {};
  const elsewhere: Record<string, number> = {};
  const assisted: Record<string, number> = {};
  const ownCount: Record<string, number> = {};
  const elsewhereCount: Record<string, number> = {};
  for (const credit of credits) {
    const tests = creditTests(credit, person.id, attributes);
    const helped = profession === 'actor' && !credit.own && isStrongActorsDirector(directorOf(credit.film));
    for (const a of attributes) {
      const t = tests[a.key] ?? 0;
      if (credit.own) {
        own[a.key] = (own[a.key] ?? 0) + t * OWN_FILM_WEIGHT;
        if (t >= MEANINGFUL_TEST) ownCount[a.key] = (ownCount[a.key] ?? 0) + 1;
      } else {
        elsewhere[a.key] = (elsewhere[a.key] ?? 0) + t * ELSEWHERE_FILM_WEIGHT;
        if (helped) assisted[a.key] = (assisted[a.key] ?? 0) + t * ELSEWHERE_FILM_WEIGHT;
        if (t >= MEANINGFUL_TEST) elsewhereCount[a.key] = (elsewhereCount[a.key] ?? 0) + 1;
      }
    }
  }

  // The career before the game began: seen in what they were cast for.
  const prior = Math.min(getPriorCredits(person), PRIOR_CREDIT_CAP);
  const seen = 0.5 + person.reputation.fame / 100;
  const castingSkill = profession === 'actor' ? clamp((options.castingDirectorSkill ?? 0) / 100, 0, 1) : 0;
  const character = profession === 'actor' ? (options.character ?? null) : null;

  const reads: AttributeRead[] = attributes.map((a) => {
    const careerEvidence = prior * PRIOR_CREDIT_WEIGHT * seen * (a.value / 100) ** 2;
    const ownEv = own[a.key] ?? 0;
    const elseEv = (elsewhere[a.key] ?? 0) + careerEvidence;
    const fromOwn = ownConfidence(ownEv);
    const fromElsewhere = elsewhereConfidence(elseEv);
    const fromCasting = castingSkill * CASTING_DIRECTOR_CONFIDENCE;
    const trait = ACTING_STYLE_TO_CHARACTER_TRAIT[a.key as keyof ActingStyle];
    const fromAudition = options.audited && character && trait ? AUDITION_CONFIDENCE * Math.min(1, character.traits[trait] / 60) : 0;
    const confidence = combine(combine(fromOwn, fromElsewhere), combine(fromCasting, fromAudition));

    const strongest = Math.max(fromOwn, fromElsewhere, fromCasting, fromAudition);
    const source: EvidenceSource =
      strongest <= 0.01
        ? 'none'
        : strongest === fromOwn
          ? 'own'
          : strongest === fromAudition
            ? 'audition'
            : strongest === fromCasting
              ? 'casting-director'
              : (elsewhere[a.key] ?? 0) >= careerEvidence
                ? 'elsewhere'
                : 'career';
    const tested = source !== 'none';

    // Off the truth by noise, and flattered by a strong director's help, until
    // evidence the studio trusts pulls the read in.
    const doubt = 1 - confidence;
    const noise = (hashUnit(`${person.id}|read|${a.key}`) - 0.5) * 2 * READ_NOISE;
    const flattery = elseEv > 0 ? ((assisted[a.key] ?? 0) / elseEv) * ASSISTED_OPTIMISM * (1 - fromOwn) : 0;
    const centre = clamp(a.value + noise * doubt + flattery, 0, 100);
    const half = tested ? MIN_HALF_WIDTH + (MAX_HALF_WIDTH - MIN_HALF_WIDTH) * doubt : 50;
    const low = tested ? clamp(centre - half, 0, 100) : 0;
    const high = tested ? clamp(centre + half, 0, 100) : 100;
    const tier = tierFor(confidence, tested);
    const ownFilms = ownCount[a.key] ?? 0;
    const elsewhereFilms = elsewhereCount[a.key] ?? 0;
    return {
      key: a.key,
      label: a.label,
      centre,
      low,
      high,
      confidence: tested ? confidence : 0,
      tier,
      verdict: verdictFor(tier, centre, low, high),
      basis: basisFor(source === 'career' && confidence < FAINT_CAREER ? 'career-faint' : source, ownFilms, elsewhereFilms),
      source,
      ownFilms,
      elsewhereFilms,
    };
  });

  const ownFilms = credits.filter((c) => c.own).length;
  return {
    personId: person.id,
    profession,
    reads,
    totalFilms: getPriorCredits(person) + credits.length,
    ownFilms,
    trackRecord: credits.map((c) => trackRecordRow(c, person.id)),
    caveat: deriveCaveat(person, profession, reads, credits, character),
  };
}

// --- Track record -------------------------------------------------------------

const OUTCOME_WORD: Record<string, { text: string; tone: TrackRecordRow['outcomeTone'] }> = {
  Flop: { text: 'Flop', tone: 'bad' },
  Weak: { text: 'Disappointed', tone: 'bad' },
  'Modest Success': { text: 'Did fine', tone: 'neutral' },
  Hit: { text: 'Hit', tone: 'good' },
  Blockbuster: { text: 'Blockbuster', tone: 'good' },
  Phenomenon: { text: 'Phenomenon', tone: 'good' },
  'Cult Hit': { text: 'Cult hit', tone: 'good' },
  Masterpiece: { text: 'Acclaimed', tone: 'good' },
};

const PART_WORD: Record<ProductionRole, string> = {
  'Lead Actor': 'Lead',
  'Supporting Actor': 'Supporting',
  Director: 'Director',
  Writer: 'Writer',
  Cinematographer: 'Cinematographer',
  Composer: 'Composer',
  Editor: 'Editor',
  'VFX Supervisor': 'VFX',
  'Casting Director': 'Casting',
  'Production Designer': 'Design',
};

const NOTICE_WORD: Record<string, string | null> = {
  inspired: 'singled out',
  strong: 'stood out',
  solid: null,
  weak: 'the weak link',
  poor: 'panned',
};

function trackRecordRow(credit: Credit, personId: PersonId): TrackRecordRow {
  const { film } = credit;
  const outcome = film.results.outcome ? OUTCOME_WORD[film.results.outcome] : undefined;
  let personal: string | null = null;
  if (knowledgeProfession(credit.role) === 'actor') {
    const read = readCastPerformances(film.talent, film.script).find((r) => r.personId === personId);
    personal = read ? (NOTICE_WORD[read.band] ?? null) : null;
  }
  return {
    filmId: film.id,
    title: film.title,
    year: gameDateFromTotalDays(film.releasedOnDay).year,
    part: `${PART_WORD[credit.role]} · ${film.genre.toLowerCase()}`,
    own: credit.own,
    outcome: outcome?.text ?? (film.boxOfficeRun.status === 'running' ? 'Still playing' : 'Released'),
    outcomeTone: outcome?.tone ?? 'neutral',
    personal,
  };
}

// --- The caveat ----------------------------------------------------------------

/** The attribute this part leans on most, for an actor up for a specific character. */
function topDemand(character: ScriptCharacter | null): keyof ActingStyle | null {
  if (!character) return null;
  let best: keyof ActingStyle | null = null;
  let bestValue = -1;
  for (const axis of ACTING_STYLE_AXES) {
    const v = character.traits[ACTING_STYLE_TO_CHARACTER_TRAIT[axis]];
    if (v > bestValue) {
      bestValue = v;
      best = axis;
    }
  }
  return best;
}

function deriveCaveat(
  person: Person,
  profession: KnowledgeProfession,
  reads: AttributeRead[],
  credits: Credit[],
  character: ScriptCharacter | null,
): string | null {
  const anything = reads.some((r) => r.tier !== 'untested');
  const demand = topDemand(character);
  if (!anything && !demand) return 'A gamble at a gamble\'s price. The only way to find out is to put them in something and watch.';

  const demandRead = demand ? reads.find((r) => r.key === demand) : undefined;
  if (demand && demandRead) {
    if (demandRead.tier === 'untested') return `Nobody has seen them ${UNTESTED_PHRASE[demand]}, and this part asks for it.`;
    // Used often, but never for what this part needs.
    const ownTested = reads.filter((r) => r.ownFilms > 0);
    if (ownTested.length > 0 && demandRead.ownFilms === 0) {
      const usedFor = ownTested.reduce((a, b) => (b.confidence > a.confidence ? b : a));
      return `You have only ever used them for ${USED_FOR_PHRASE[usedFor.key] ?? usedFor.label.toLowerCase()}. What this part asks is a guess.`;
    }
  }

  // Their best work elsewhere was drawn out by someone who gets it from everyone.
  if (profession === 'actor') {
    for (const credit of credits) {
      if (credit.own) continue;
      const director = directorOf(credit.film);
      if (!isStrongActorsDirector(director)) continue;
      const good = credit.film.results.outcome === 'Masterpiece' || credit.film.results.criticScore >= 70;
      if (good && reads.every((r) => r.ownFilms === 0)) {
        return `Their best work was under ${director!.identity.name}, who gets the best out of everyone. How much of it was them is anybody's guess.`;
      }
    }
  }

  if (credits.every((c) => !c.own)) {
    // A stranger: say what the second-hand record does and does not show about
    // what this part asks for, since that is the decision in front of you.
    if (demand && demandRead) {
      const can = UNTESTED_PHRASE[demand];
      if (demandRead.confidence < FAIR_CONFIDENCE) return `Little of what they have done shows whether they can ${can}, and this part leans on it.`;
      if (demandRead.centre < 55) return `What you have seen suggests they struggle to ${can}, and this part leans on it. All of it second-hand.`;
      return `Other people's films say they can ${can}. You won't know how much of that was them until they work for you.`;
    }
    const untested = reads.filter((r) => r.tier === 'untested');
    if (untested.length > 0 && untested.length < reads.length) {
      return `Everything here is second-hand, and ${untested.length === 1 ? untested[0].label.toLowerCase() : 'some of what they do'} has never been tested.`;
    }
    const known = credits.length + getPriorCredits(person);
    if (known <= 3) return 'Barely tested anywhere. Cheap to find out, if the film can carry the risk.';
    return 'Everything here is second-hand. You will only really know them once they work for you.';
  }

  // What you still cannot see, the part's own needs first.
  const need = (r: AttributeRead) => {
    const trait = character ? ACTING_STYLE_TO_CHARACTER_TRAIT[r.key as keyof ActingStyle] : undefined;
    return character && trait ? character.traits[trait] : 0;
  };
  const unknown = reads.filter((r) => r.confidence < FAIR_CONFIDENCE).sort((a, b) => need(b) - need(a));
  if (unknown.length > 0) {
    const first = unknown[0];
    if (character && need(first) >= 50) return `You still have little idea about their ${first.label.toLowerCase()}, and this part needs it.`;
    const names = unknown.slice(0, 2).map((r) => r.label.toLowerCase());
    return `You still have little idea about their ${names.join(' or ')}.`;
  }
  return null;
}

// --- What the fit read takes from this -----------------------------------------

/**
 * How well the studio can read this person on what a part asks of them: the
 * confidence of each attribute, weighted by how much the part leans on it.
 * `weights` keyed by attribute; absent = every attribute counts the same.
 */
export function weightedConfidence(knowledge: TalentKnowledge, weights?: Record<string, number>): number {
  let num = 0;
  let den = 0;
  for (const r of knowledge.reads) {
    const w = weights ? (weights[r.key] ?? 0) : 1;
    num += w * r.confidence;
    den += w;
  }
  return den > 0 ? num / den : 0;
}

/** The read of one attribute, by key. */
export function readFor(knowledge: TalentKnowledge, key: string): AttributeRead | undefined {
  return knowledge.reads.find((r) => r.key === key);
}
