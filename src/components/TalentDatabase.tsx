import { useMemo, useState } from 'react';
import { useStudio } from '../state/StudioContext';
import { StarRating } from './common/StarRating';
import { Money } from './common/Money';
import { InfoTip } from './common/InfoTip';
import { describeProductionStyle } from './common/TalentStats';
import { ACTING_STYLE_LABELS } from '../data/actingStyle';
import { TONE_LABELS } from '../data/tones';
import { STAT_INFO, type StatKey } from '../data/talentStatInfo';
import { getPersonAge, computeActorAbility } from '../types';
import { gameDateFromTotalDays, formatGameDateWithMonth } from '../engine/calendar';
import { deriveBookedUntil, getCareerForProfession, getWriterCareer, CREW_ROLES } from '../engine/person';
import { deriveTraits, TRAIT_LABELS, TRAIT_DESCRIPTIONS } from '../engine/personTraits';
import { qualitativeMagnitude } from '../engine/talentCardPresentation';
import { describeActorCraft, describeSignatureGift, describeDirectorTouch, describeRelationship } from '../engine/castingPresentation';
import { playerRelationshipWith } from '../engine/relationships';
import { playerReleasedFilms, rivalReleasedFilms } from '../engine/project';
import { collectPersonAwards, collectPersonStats, collectFilmStats, formatWinnerMarquee, type AwardTally, type PersonAwardSummary, type PersonStatRow } from '../state/selectors';
import { awardShow } from '../data/awardsShows';
import type { AwardShowId, Film, Person, ProductionRole, TalentProfession } from '../types';
import './TalentDatabase.css';

type GenderFilter = 'all' | 'Male' | 'Female' | 'NonBinary';
type AvailabilityFilter = 'all' | 'available' | 'busy';
type ProfessionFilter = 'all' | TalentProfession;
type Sort = 'fame' | 'name' | 'prestige' | 'fee' | 'ability';

// The eight browsable professions, in a sensible reading order (Producers are
// deliberately not a TalentProfession and never enter talentPool, so they're
// out of scope for this database).
const PROFESSIONS: TalentProfession[] = ['Actor', 'Director', 'Writer', 'Cinematographer', 'Composer', 'Editor', 'VFX Supervisor', 'Casting Director'];
// Every ProductionRole a released credit can carry - what the filmography and
// performance aggregate read across, so a director's or composer's credits
// count the same way an actor's do.
const ALL_PRODUCTION_ROLES: ProductionRole[] = ['Director', 'Lead Actor', 'Supporting Actor', ...CREW_ROLES];

interface Credit {
  film: Film;
  roleLabel: string;
}

/** The career a person is filed under (their primaryRole bucket) - the one the database leads with. Producers never reach here (excluded from talentPool). */
function personCareer(person: Person) {
  return person.primaryRole === 'Producer' ? null : getCareerForProfession(person, person.primaryRole);
}

/** The headline fee shown for any profession - reads whichever career they're filed under, not just actors. */
function personTypicalFee(person: Person): number {
  return personCareer(person)?.typicalSalary ?? 0;
}

/** A single "how good are they" number across professions - an actor's averaged acting axes, or a director/writer/crew member's raw skill. */
function personAbility(person: Person): number {
  const career = personCareer(person);
  if (!career) return 0;
  if ('actingStyle' in career) return computeActorAbility(career.actingStyle);
  if ('skill' in career) return career.skill;
  return 0;
}

function articleFor(word: string): 'a' | 'an' {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

function creditRoleLabel(role: ProductionRole): string {
  if (role === 'Lead Actor') return 'Lead';
  if (role === 'Supporting Actor') return 'Supporting';
  return role;
}

/** A 0-100 value as its bar-fill tier - green for a real strength, blue for solid, amber for a soft spot - so a profile's shape (what they're strong and weak at) reads at a glance. */
function magnitudeTier(value: number): 'hi' | 'mid' | 'lo' {
  if (value >= 75) return 'hi';
  if (value >= 50) return 'mid';
  return 'lo';
}

/**
 * A labelled stat as a tiered bar with a qualitative band AND its raw value
 * (Talent Database - the hybrid read: a headline you can scan plus the precise
 * number for a reference page). Bar colour and length carry the strength, the
 * label names it, the number pins it. `info` is optional so profession-specific
 * axes without a STAT_INFO entry (a director's tones, a writer's craft) can
 * still render.
 */
function BarRow({ label, value, info }: { label: string; value: number; info?: string }) {
  const tier = magnitudeTier(value);
  return (
    <div className="td-bar-row">
      <span className="td-bar-label">
        {label}
        {info && <InfoTip label={info} />}
      </span>
      <span className="td-bar-track">
        <span className={`td-bar-fill td-bar-fill--${tier}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </span>
      <span className="td-bar-readout">
        <span className={`td-bar-qual td-bar-qual--${tier}`}>{qualitativeMagnitude(value)}</span>
        <span className="td-bar-raw">{Math.round(value)}</span>
      </span>
    </div>
  );
}

/** BarRow keyed off a STAT_INFO entry (label + hover explanation). */
function StatBar({ statKey, value }: { statKey: StatKey; value: number }) {
  const info = STAT_INFO[statKey];
  return <BarRow label={info.label} value={value} info={`${info.what} ${info.effect}`} />;
}

const SKILL_INFO = `${STAT_INFO.skill.what} ${STAT_INFO.skill.effect}`;

/**
 * The career-level panel - "who they are at their job" - rendered for whichever
 * career the person is filed under. Actors get their five acting axes; a
 * director gets skill, tone leanings, and a prose read of how they shape a
 * production; a writer gets skill and the four craft axes; every other crew
 * member gets skill, experience, and role reputation. This is the switch that
 * makes the page a person page across all professions rather than actors-only.
 */
function CareerPanel({ person }: { person: Person }) {
  const career = personCareer(person);
  if (!career) return null;

  if ('actingStyle' in career) {
    const craft = describeSignatureGift(person) ?? describeActorCraft(person);
    return (
      <section className="td-panel td-panel--career">
        <h2>As an Actor <span className="td-panel__note">Their range as a performer</span></h2>
        {craft && <p className="td-craft-line">{craft}</p>}
        <div className="td-bar-grid">
          {(Object.keys(ACTING_STYLE_LABELS) as Array<keyof typeof ACTING_STYLE_LABELS>).map((axis) => (
            <StatBar key={axis} statKey={axis} value={career.actingStyle[axis]} />
          ))}
        </div>
      </section>
    );
  }

  if ('productionStyle' in career) {
    return (
      <section className="td-panel td-panel--career">
        <h2>As a Director <span className="td-panel__note">How they shape a production</span></h2>
        <p className="td-craft-line">{describeDirectorTouch(person)} {describeProductionStyle(career)}</p>
        <div className="td-bar-grid">
          <BarRow label="Directing skill" value={career.skill} info={SKILL_INFO} />
        </div>
        <div className="td-bar-subhead">Tones they lean into</div>
        <div className="td-bar-grid">
          {(Object.keys(TONE_LABELS) as Array<keyof typeof TONE_LABELS>).map((tone) => (
            <BarRow key={tone} label={TONE_LABELS[tone]} value={career.toneProfile[tone]} />
          ))}
        </div>
      </section>
    );
  }

  if (person.primaryRole === 'Writer') {
    const writer = getWriterCareer(person);
    if (writer) {
      return (
        <section className="td-panel td-panel--career">
          <h2>As a Writer <span className="td-panel__note">Their craft on the page</span></h2>
          <div className="td-bar-grid">
            <BarRow label="Writing skill" value={writer.skill} info={SKILL_INFO} />
            <BarRow label="Originality" value={writer.craft.originality} />
            <BarRow label="Structure" value={writer.craft.structure} />
            <BarRow label="Characters" value={writer.craft.characters} />
            <BarRow label="Dialogue" value={writer.craft.dialogue} />
          </div>
        </section>
      );
    }
  }

  // Every remaining crew profession is skill-first; round it out with the
  // shared career track record so the panel isn't a lone number.
  const profession = person.primaryRole;
  return (
    <section className="td-panel td-panel--career">
      <h2>As {articleFor(profession)} {profession} <span className="td-panel__note">Their craft</span></h2>
      <div className="td-bar-grid">
        <BarRow label={`${profession} skill`} value={career.skill} info={SKILL_INFO} />
        <StatBar statKey="experience" value={career.experience} />
        <StatBar statKey="roleReputation" value={career.roleReputation} />
      </div>
    </section>
  );
}

function TalentRow({ person, totalDays, credits, onOpen }: { person: Person; totalDays: number; credits: number; onOpen: () => void }) {
  const age = getPersonAge(person.identity.dateOfBirth, gameDateFromTotalDays(totalDays));
  const bookedUntil = deriveBookedUntil(person.availability.commitments);
  const busy = !!bookedUntil && bookedUntil > totalDays;
  return (
    <button type="button" className="td-actor-row" onClick={onOpen}>
      <span className="td-actor-row__name">{person.identity.name}</span>
      <span className="td-actor-row__role">{person.primaryRole}</span>
      <span className="td-actor-row__meta">
        {[age !== undefined ? `${age}` : null, person.identity.gender].filter(Boolean).join(' · ')}
      </span>
      <span className="td-actor-row__fame"><StarRating value={person.reputation.fame} /></span>
      <span className="td-actor-row__fee"><Money amount={personTypicalFee(person)} /></span>
      <span className="td-actor-row__credits">{credits} credit{credits === 1 ? '' : 's'}</span>
      <span className={`td-actor-row__status ${busy ? 'is-busy' : 'is-free'}`}>{busy ? 'Busy' : 'Available'}</span>
    </button>
  );
}

/** One raw dev-stat row - kept number-forward (this section is the honest "every value the sim stores" inspector). */
function DevRow({ label, value, info }: { label: string; value: number; info?: string }) {
  return (
    <div className="td-stat-row">
      <span className="td-stat-label">
        {label}
        {info && <InfoTip label={info} />}
      </span>
      <span className="td-stat-value"><span className="td-stat-raw td-stat-raw--solo">{Math.round(value)}</span></span>
    </div>
  );
}

function siRow(key: StatKey, value: number): { label: string; value: number; info: string } {
  return { label: STAT_INFO[key].label, value, info: `${STAT_INFO[key].what} ${STAT_INFO[key].effect}` };
}

/** The career-specific craft rows for the Dev section, per profession (actors' axes, a director's tones, a writer's craft, or a crew skill). */
function devCraftGroup(person: Person): { title: string; rows: Array<{ label: string; value: number; info?: string }> } | null {
  const career = personCareer(person);
  if (!career) return null;
  if ('actingStyle' in career) {
    return {
      title: 'Acting Style (the five performance axes)',
      rows: [
        siRow('characterTransformation', career.actingStyle.characterTransformation),
        siRow('emotionalPerformance', career.actingStyle.emotionalPerformance),
        siRow('charisma', career.actingStyle.charisma),
        siRow('comedy', career.actingStyle.comedy),
        siRow('physicalPerformance', career.actingStyle.physicalPerformance),
      ],
    };
  }
  if ('productionStyle' in career) {
    return {
      title: 'Directing (skill + tone leanings)',
      rows: [
        siRow('skill', career.skill),
        ...(Object.keys(TONE_LABELS) as Array<keyof typeof TONE_LABELS>).map((tone) => ({ label: `Tone: ${TONE_LABELS[tone]}`, value: career.toneProfile[tone] })),
      ],
    };
  }
  if (person.primaryRole === 'Writer') {
    const writer = getWriterCareer(person);
    if (writer) {
      return {
        title: 'Writing (skill + craft axes)',
        rows: [
          siRow('skill', writer.skill),
          { label: 'Originality', value: writer.craft.originality },
          { label: 'Structure', value: writer.craft.structure },
          { label: 'Characters', value: writer.craft.characters },
          { label: 'Dialogue', value: writer.craft.dialogue },
        ],
      };
    }
  }
  return { title: 'Craft', rows: [siRow('skill', career.skill)] };
}

function DevSection({ person }: { person: Person }) {
  const [open, setOpen] = useState(false);
  const career = personCareer(person);
  const craftGroup = devCraftGroup(person);

  const groups: Array<{ title: string; rows: Array<{ label: string; value: number; info?: string }> }> = [
    {
      title: 'Reputation (public-facing)',
      rows: [
        siRow('fame', person.reputation.fame),
        siRow('prestige', person.reputation.prestige),
        siRow('industryRespect', person.reputation.industryRespect),
        siRow('reliability', person.reputation.reliability),
        siRow('currentHeat', person.reputation.currentHeat),
      ],
    },
    ...(craftGroup ? [craftGroup] : []),
    {
      title: 'Personality (hidden temperament)',
      rows: [
        siRow('professionalism', person.personality.professionalism),
        siRow('ambition', person.personality.ambition),
        siRow('loyalty', person.personality.loyalty),
        siRow('ego', person.personality.ego),
        siRow('temperament', person.personality.temperament),
        siRow('pressureHandling', person.personality.pressureHandling),
        siRow('controversy', person.personality.controversy),
        siRow('adaptability', person.personality.adaptability),
      ],
    },
    ...(career ? [{ title: 'Career', rows: [siRow('experience', career.experience), siRow('roleReputation', career.roleReputation)] }] : []),
  ];

  return (
    <section className="td-dev">
      <button type="button" className="td-dev__toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? '▾' : '▸'} Dev — hidden stats {open ? '' : '(what every number really does)'}
      </button>
      {open && (
        <div className="td-dev__body">
          <p className="td-dev__note">
            Every raw value the simulation stores for this person. Hover an{' '}
            <span className="info-tip info-tip--inline"><span className="info-tip__icon" aria-hidden="true">i</span></span>{' '}
            to see what it is and what it actually affects in-game. Values are on a 1–100 scale unless noted.
          </p>
          {groups.map((group) => (
            <div className="td-dev__group" key={group.title}>
              <h4>{group.title}</h4>
              {group.rows.map((row) => (
                <DevRow key={row.label} label={row.label} value={row.value} info={row.info} />
              ))}
            </div>
          ))}
          {career && (
            <div className="td-dev__group">
              <h4>Fee</h4>
              <div className="td-stat-row">
                <span className="td-stat-label">Minimum salary<InfoTip label={`${STAT_INFO.minimumSalary.what} ${STAT_INFO.minimumSalary.effect}`} /></span>
                <span className="td-stat-value"><Money amount={career.minimumSalary} /></span>
              </div>
              <div className="td-stat-row">
                <span className="td-stat-label">Typical salary<InfoTip label={`${STAT_INFO.typicalSalary.what} ${STAT_INFO.typicalSalary.effect}`} /></span>
                <span className="td-stat-value"><Money amount={career.typicalSalary} /></span>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function PersonDetail({ person, totalDays, credits, award, performance, relationship, onBack }: { person: Person; totalDays: number; credits: Credit[]; award?: PersonAwardSummary; performance?: PersonStatRow; relationship: string | null; onBack: () => void }) {
  // Person page: the page is the person, not their role. Person-level facts
  // (identity, standing, filmography, awards, reputation) frame one career-level
  // panel per career they hold - CareerPanel renders whichever profession they
  // are filed under, so this is now the whole database, not just actors.
  const age = getPersonAge(person.identity.dateOfBirth, gameDateFromTotalDays(totalDays));
  const bookedUntil = deriveBookedUntil(person.availability.commitments);
  const busy = !!bookedUntil && bookedUntil > totalDays;
  const traits = deriveTraits(person);
  const identityLine = [person.primaryRole, age !== undefined ? `${age} years old` : null, person.identity.gender, person.identity.nationality]
    .filter(Boolean)
    .join(' · ');
  const marquee = award ? formatWinnerMarquee(award) : null;
  const noCreditsCopy = `No released credits yet — this ${person.primaryRole.toLowerCase()} hasn't worked on a finished film in your world.`;

  return (
    <div className="stack td-detail">
      <button type="button" className="td-back" onClick={onBack}>← All talent</button>

      <header className="td-detail__header">
        <div className="td-detail__ident">
          <h1 style={{ margin: 0 }}>{person.identity.name}</h1>
          <p className="td-detail__subtitle">{identityLine}</p>
          {relationship && <p className="td-detail__relationship">{relationship}</p>}
          {marquee && <p className="td-detail__marquee">🏆 {marquee}</p>}
        </div>
        <div className="td-detail__fee">
          <div className="stat-label">Typical fee</div>
          <div className="stat-value"><Money amount={personTypicalFee(person)} /></div>
          <div className={`td-detail__avail ${busy ? 'is-busy' : 'is-free'}`}>
            {busy ? `Busy until ${formatGameDateWithMonth(bookedUntil!)}` : '✓ Available now'}
          </div>
        </div>
      </header>

      <section className="td-panel">
        <h2>Standing <span className="td-panel__note">How the industry sees them</span></h2>
        <div className="td-bar-grid">
          <StatBar statKey="fame" value={person.reputation.fame} />
          <StatBar statKey="prestige" value={person.reputation.prestige} />
          <StatBar statKey="industryRespect" value={person.reputation.industryRespect} />
          <StatBar statKey="reliability" value={person.reputation.reliability} />
          <StatBar statKey="currentHeat" value={person.reputation.currentHeat} />
        </div>
      </section>

      <CareerPanel person={person} />

      <section className="td-panel">
        <h2>Filmography {credits.length > 0 && <span className="td-count">({credits.length})</span>}</h2>
        {credits.length === 0 ? (
          <p className="choice-description" style={{ margin: 0 }}>{noCreditsCopy}</p>
        ) : (
          <div className="td-filmography">
            {credits.map(({ film, roleLabel }) => (
              <div className="td-credit" key={`${film.id}:${roleLabel}`}>
                <div className="td-credit__title">{film.title}</div>
                <div className="td-credit__meta">
                  {film.genre} · {roleLabel} · {formatGameDateWithMonth(film.releasedOnDay)}
                  {film.results.totalBoxOffice !== null && <> · <Money amount={film.results.totalBoxOffice} /></>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {performance && performance.filmCount > 0 && (
        <section className="td-panel">
          <h2>Performance</h2>
          <p className="choice-description" style={{ marginTop: 0 }}>
            Averaged across {performance.filmCount} released film{performance.filmCount === 1 ? '' : 's'} in your world.
          </p>
          <div className="td-stat-grid">
            <DevRow label="Critics" value={performance.avgCriticScore} />
            <DevRow label="Audience" value={performance.avgAudienceScore} />
            <DevRow label="Quality" value={performance.avgQualityScore} />
            <DevRow label="Hits" value={performance.hitCount} />
            <DevRow label="Flops" value={performance.flopCount} />
            <div className="td-stat-row">
              <span className="td-stat-label">Total box office</span>
              <span className="td-stat-value"><Money amount={performance.totalBoxOffice} /></span>
            </div>
          </div>
        </section>
      )}

      {award && award.nominations > 0 && (
        <section className="td-panel">
          <h2>Awards</h2>
          <p className="choice-description" style={{ marginTop: 0 }}>
            {award.wins > 0 ? `${award.wins} win${award.wins === 1 ? '' : 's'} · ` : ''}
            {award.nominations} nomination{award.nominations === 1 ? '' : 's'} across every awards show to date.
          </p>
          <div className="td-awards">
            {(Object.entries(award.byShow) as Array<[AwardShowId, AwardTally]>)
              .sort((a, b) => b[1].wins - a[1].wins || b[1].nominations - a[1].nominations)
              .map(([show, cell]) => (
                <div className="td-credit" key={show}>
                  <div className="td-credit__title">{awardShow(show).name}</div>
                  <div className="td-credit__meta">
                    {cell.wins > 0 ? `${cell.wins} win${cell.wins === 1 ? '' : 's'} · ` : ''}
                    {cell.nominations} nomination{cell.nominations === 1 ? '' : 's'}
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      {traits.length > 0 && (
        <section className="td-panel">
          <h2>Reputation for</h2>
          <div className="candidate-traits">
            {traits.map((trait) => (
              <span key={trait} className="candidate-trait-tag" title={TRAIT_DESCRIPTIONS[trait]}>{TRAIT_LABELS[trait]}</span>
            ))}
          </div>
        </section>
      )}

      <DevSection person={person} />
    </div>
  );
}

export function TalentDatabase() {
  const { state } = useStudio();
  const totalDays = state.totalDays;
  const [search, setSearch] = useState('');
  const [profession, setProfession] = useState<ProfessionFilter>('all');
  const [gender, setGender] = useState<GenderFilter>('all');
  const [availability, setAvailability] = useState<AvailabilityFilter>('all');
  const [sort, setSort] = useState<Sort>('fame');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Every person across every profession pool, deduped by id (a person is filed
  // under one primaryRole bucket, but dedupe is cheap insurance and matches how
  // every selector here keys by id).
  const talent = useMemo(() => {
    const byId = new Map<string, Person>();
    for (const person of Object.values(state.talentPool).flat()) byId.set(person.id, person);
    return [...byId.values()];
  }, [state.talentPool]);

  // Every released credit for anyone, keyed by person id - across all roles now
  // (a director's or composer's credits count the same as an actor's), read by
  // both the list (credit counts) and the detail (full filmography).
  const creditsByPerson = useMemo(() => {
    const films = [...playerReleasedFilms(state.projects), ...rivalReleasedFilms(state.projects)];
    const map = new Map<string, Credit[]>();
    for (const film of films) {
      for (const assignment of film.talent) {
        const list = map.get(assignment.person.id) ?? [];
        list.push({ film, roleLabel: creditRoleLabel(assignment.role) });
        map.set(assignment.person.id, list);
      }
    }
    for (const list of map.values()) list.sort((a, b) => b.film.releasedOnDay - a.film.releasedOnDay);
    return map;
  }, [state.projects]);

  // Per-person Academy Award tally across every resolved ceremony (all
  // professions - a Best Director win is tallied the same as Best Actor).
  const awardsByPerson = useMemo(() => collectPersonAwards(state.awards?.history ?? []), [state.awards?.history]);

  // Per-person released-film performance across every production role.
  const performanceByPerson = useMemo(() => {
    const rows = collectPersonStats(collectFilmStats(state.projects, state.studio.name), ALL_PRODUCTION_ROLES);
    return new Map(rows.map((row) => [row.id, row]));
  }, [state.projects, state.studio.name]);

  const selected = selectedId ? talent.find((p) => p.id === selectedId) ?? null : null;

  const visible = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    const filtered = talent.filter((p) => {
      if (profession !== 'all' && p.primaryRole !== profession) return false;
      if (gender !== 'all' && p.identity.gender !== gender) return false;
      if (availability !== 'all') {
        const bookedUntil = deriveBookedUntil(p.availability.commitments);
        const busy = !!bookedUntil && bookedUntil > totalDays;
        if (availability === 'available' && busy) return false;
        if (availability === 'busy' && !busy) return false;
      }
      if (normalizedSearch && !p.identity.name.toLocaleLowerCase().includes(normalizedSearch)) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      switch (sort) {
        case 'name':
          return a.identity.name.localeCompare(b.identity.name);
        case 'prestige':
          return b.reputation.prestige - a.reputation.prestige;
        case 'fee':
          return personTypicalFee(b) - personTypicalFee(a);
        case 'ability':
          return personAbility(b) - personAbility(a);
        case 'fame':
        default:
          return b.reputation.fame - a.reputation.fame;
      }
    });
  }, [talent, profession, gender, availability, search, sort, totalDays]);

  if (selected) {
    return (
      <PersonDetail
        person={selected}
        totalDays={totalDays}
        credits={creditsByPerson.get(selected.id) ?? []}
        award={awardsByPerson.get(selected.id)}
        performance={performanceByPerson.get(selected.id)}
        relationship={describeRelationship(playerRelationshipWith(state.collaborations ?? [], selected))}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div className="stack td-database">
      <div>
        <h1 style={{ margin: 0 }}>Talent Database</h1>
        <p className="td-database__summary">{talent.length} people on record · showing {visible.length}</p>
      </div>

      <section className="td-controls" aria-label="Talent filters">
        <label className="td-search">
          <span className="sr-only">Search talent</span>
          <input type="search" value={search} placeholder="Search by name…" onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label className="td-select"><span>Profession</span>
          <select value={profession} onChange={(e) => setProfession(e.target.value as ProfessionFilter)}>
            <option value="all">All talent</option>
            {PROFESSIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="td-select"><span>Gender</span>
          <select value={gender} onChange={(e) => setGender(e.target.value as GenderFilter)}>
            <option value="all">Any</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="NonBinary">Non-binary</option>
          </select>
        </label>
        <label className="td-select"><span>Availability</span>
          <select value={availability} onChange={(e) => setAvailability(e.target.value as AvailabilityFilter)}>
            <option value="all">Any</option>
            <option value="available">Available now</option>
            <option value="busy">Currently booked</option>
          </select>
        </label>
        <label className="td-select"><span>Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="fame">Fame</option>
            <option value="prestige">Prestige</option>
            <option value="ability">Skill / ability</option>
            <option value="fee">Typical fee</option>
            <option value="name">Name</option>
          </select>
        </label>
      </section>

      {visible.length === 0 ? (
        <div className="card"><p style={{ margin: 0 }}>No talent match those filters.</p></div>
      ) : (
        <div className="td-list">
          <div className="td-list__head">
            <span>Name</span><span>Role</span><span>Age · Gender</span><span>Fame</span><span>Typical fee</span><span>Credits</span><span>Status</span>
          </div>
          {visible.map((person) => (
            <TalentRow
              key={person.id}
              person={person}
              totalDays={totalDays}
              credits={(creditsByPerson.get(person.id) ?? []).length}
              onOpen={() => setSelectedId(person.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
