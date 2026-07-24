import { useMemo, useState } from 'react';
import { useStudio } from '../state/StudioContext';
import { StarRating } from './common/StarRating';
import { Money } from './common/Money';
import { InfoTip } from './common/InfoTip';
import { ACTING_STYLE_LABELS } from '../data/actingStyle';
import { STAT_INFO, type StatKey } from '../data/talentStatInfo';
import { getPersonAge, computeActorAbility } from '../types';
import { gameDateFromTotalDays, formatGameDateWithMonth } from '../engine/calendar';
import { deriveBookedUntil } from '../engine/person';
import { deriveTraits, TRAIT_LABELS, TRAIT_DESCRIPTIONS } from '../engine/personTraits';
import { qualitativeMagnitude } from '../engine/talentCardPresentation';
import { describeActorCraft, describeSignatureGift, describeRelationship } from '../engine/castingPresentation';
import { playerRelationshipWith } from '../engine/relationships';
import { playerReleasedFilms, rivalReleasedFilms } from '../engine/project';
import { collectPersonAwards, collectPersonStats, collectFilmStats, formatWinnerMarquee, type AwardTally, type PersonAwardSummary, type PersonStatRow } from '../state/selectors';
import { awardShow } from '../data/awardsShows';
import type { AwardShowId, Film, Person } from '../types';
import './TalentDatabase.css';

type GenderFilter = 'all' | 'Male' | 'Female' | 'NonBinary';
type AvailabilityFilter = 'all' | 'available' | 'busy';
type Sort = 'fame' | 'name' | 'prestige' | 'fee' | 'ability';

interface Credit {
  film: Film;
  roleLabel: string;
}

function abilityStars(person: Person): number {
  return person.careers.actor ? computeActorAbility(person.careers.actor.actingStyle) : 0;
}

/** A 0-100 value as its bar-fill tier - green for a real strength, blue for solid, amber for a soft spot - so a profile's shape (what they're strong and weak at) reads at a glance. */
function magnitudeTier(value: number): 'hi' | 'mid' | 'lo' {
  if (value >= 75) return 'hi';
  if (value >= 50) return 'mid';
  return 'lo';
}

/**
 * A labelled stat as a tiered bar with a qualitative band AND its raw value
 * (Talent Database redesign - the hybrid read the player asked for: a headline
 * you can scan plus the precise number for a reference page), with an
 * explanatory info sign. Replaces the old identical star rows - the bar's
 * colour and length carry the strength, the label names it, the number pins it.
 */
function StatBar({ statKey, value }: { statKey: StatKey; value: number }) {
  const info = STAT_INFO[statKey];
  const tier = magnitudeTier(value);
  return (
    <div className="td-bar-row">
      <span className="td-bar-label">
        {info.label}
        <InfoTip label={`${info.what} ${info.effect}`} />
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

function ActorRow({ person, totalDays, credits, onOpen }: { person: Person; totalDays: number; credits: number; onOpen: () => void }) {
  const actor = person.careers.actor!;
  const age = getPersonAge(person.identity.dateOfBirth, gameDateFromTotalDays(totalDays));
  const bookedUntil = deriveBookedUntil(person.availability.commitments);
  const busy = !!bookedUntil && bookedUntil > totalDays;
  return (
    <button type="button" className="td-actor-row" onClick={onOpen}>
      <span className="td-actor-row__name">{person.identity.name}</span>
      <span className="td-actor-row__meta">
        {[age !== undefined ? `${age}` : null, person.identity.gender].filter(Boolean).join(' · ')}
      </span>
      <span className="td-actor-row__fame"><StarRating value={person.reputation.fame} /></span>
      <span className="td-actor-row__fee"><Money amount={actor.typicalSalary} /></span>
      <span className="td-actor-row__credits">{credits} credit{credits === 1 ? '' : 's'}</span>
      <span className={`td-actor-row__status ${busy ? 'is-busy' : 'is-free'}`}>{busy ? 'Busy' : 'Available'}</span>
    </button>
  );
}

function DevSection({ person }: { person: Person }) {
  const [open, setOpen] = useState(false);
  const actor = person.careers.actor!;
  const groups: Array<{ title: string; rows: Array<{ key: StatKey; value: number }> }> = [
    {
      title: 'Reputation (public-facing)',
      rows: [
        { key: 'fame', value: person.reputation.fame },
        { key: 'prestige', value: person.reputation.prestige },
        { key: 'industryRespect', value: person.reputation.industryRespect },
        { key: 'reliability', value: person.reputation.reliability },
        { key: 'currentHeat', value: person.reputation.currentHeat },
      ],
    },
    {
      title: 'Acting Style (the five performance axes)',
      rows: [
        { key: 'characterTransformation', value: actor.actingStyle.characterTransformation },
        { key: 'emotionalPerformance', value: actor.actingStyle.emotionalPerformance },
        { key: 'charisma', value: actor.actingStyle.charisma },
        { key: 'comedy', value: actor.actingStyle.comedy },
        { key: 'physicalPerformance', value: actor.actingStyle.physicalPerformance },
      ],
    },
    {
      title: 'Personality (hidden temperament)',
      rows: [
        { key: 'professionalism', value: person.personality.professionalism },
        { key: 'ambition', value: person.personality.ambition },
        { key: 'loyalty', value: person.personality.loyalty },
        { key: 'ego', value: person.personality.ego },
        { key: 'temperament', value: person.personality.temperament },
        { key: 'pressureHandling', value: person.personality.pressureHandling },
        { key: 'controversy', value: person.personality.controversy },
        { key: 'adaptability', value: person.personality.adaptability },
      ],
    },
    {
      title: 'Career',
      rows: [
        { key: 'experience', value: actor.experience },
        { key: 'roleReputation', value: actor.roleReputation },
      ],
    },
  ];

  return (
    <section className="td-dev">
      <button type="button" className="td-dev__toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? '▾' : '▸'} Dev — hidden stats {open ? '' : '(what every number really does)'}
      </button>
      {open && (
        <div className="td-dev__body">
          <p className="td-dev__note">
            Every raw value the simulation stores for this actor. Hover an{' '}
            <span className="info-tip info-tip--inline"><span className="info-tip__icon" aria-hidden="true">i</span></span>{' '}
            to see what it is and what it actually affects in-game. Values are on a 1–100 scale unless noted.
          </p>
          {groups.map((group) => (
            <div className="td-dev__group" key={group.title}>
              <h4>{group.title}</h4>
              {group.rows.map((row) => (
                <div className="td-stat-row" key={row.key}>
                  <span className="td-stat-label">
                    {STAT_INFO[row.key].label}
                    <InfoTip label={`${STAT_INFO[row.key].what} ${STAT_INFO[row.key].effect}`} />
                  </span>
                  <span className="td-stat-value"><span className="td-stat-raw td-stat-raw--solo">{Math.round(row.value)}</span></span>
                </div>
              ))}
            </div>
          ))}
          <div className="td-dev__group">
            <h4>Fee</h4>
            <div className="td-stat-row">
              <span className="td-stat-label">Minimum salary<InfoTip label={`${STAT_INFO.minimumSalary.what} ${STAT_INFO.minimumSalary.effect}`} /></span>
              <span className="td-stat-value"><Money amount={actor.minimumSalary} /></span>
            </div>
            <div className="td-stat-row">
              <span className="td-stat-label">Typical salary<InfoTip label={`${STAT_INFO.typicalSalary.what} ${STAT_INFO.typicalSalary.effect}`} /></span>
              <span className="td-stat-value"><Money amount={actor.typicalSalary} /></span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function PersonDetail({ person, totalDays, credits, award, performance, relationship, onBack }: { person: Person; totalDays: number; credits: Credit[]; award?: PersonAwardSummary; performance?: PersonStatRow; relationship: string | null; onBack: () => void }) {
  // Person page (user request): the page is now the person, not their role.
  // Person-level facts (identity, standing, filmography, awards, reputation)
  // frame one career-level panel per career they hold - today only the acting
  // one, since the browsable list is actors-only, but the split is what lets a
  // future multi-hyphenate grow a second panel here rather than a new page.
  const actor = person.careers.actor!;
  const age = getPersonAge(person.identity.dateOfBirth, gameDateFromTotalDays(totalDays));
  const bookedUntil = deriveBookedUntil(person.availability.commitments);
  const busy = !!bookedUntil && bookedUntil > totalDays;
  const traits = deriveTraits(person);
  const identityLine = [person.primaryRole, age !== undefined ? `${age} years old` : null, person.identity.gender, person.identity.nationality]
    .filter(Boolean)
    .join(' · ');
  const marquee = award ? formatWinnerMarquee(award) : null;
  const craftHeadline = describeSignatureGift(person) ?? describeActorCraft(person);

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
          <div className="stat-value"><Money amount={actor.typicalSalary} /></div>
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

      <section className="td-panel td-panel--career">
        <h2>As an Actor <span className="td-panel__note">Their range as a performer</span></h2>
        {craftHeadline && <p className="td-craft-line">{craftHeadline}</p>}
        <div className="td-bar-grid">
          {(Object.keys(ACTING_STYLE_LABELS) as Array<keyof typeof ACTING_STYLE_LABELS>).map((axis) => (
            <StatBar key={axis} statKey={axis} value={actor.actingStyle[axis]} />
          ))}
        </div>
      </section>

      <section className="td-panel">
        <h2>Filmography {credits.length > 0 && <span className="td-count">({credits.length})</span>}</h2>
        {credits.length === 0 ? (
          <p className="choice-description" style={{ margin: 0 }}>No released credits yet — this actor hasn't appeared in a finished film in your world.</p>
        ) : (
          <div className="td-filmography">
            {credits.map(({ film, roleLabel }) => (
              <div className="td-credit" key={film.id}>
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
            <div className="td-stat-row">
              <span className="td-stat-label">Critics</span>
              <span className="td-stat-value"><span className="td-stat-raw td-stat-raw--solo">{Math.round(performance.avgCriticScore)}</span></span>
            </div>
            <div className="td-stat-row">
              <span className="td-stat-label">Audience</span>
              <span className="td-stat-value"><span className="td-stat-raw td-stat-raw--solo">{Math.round(performance.avgAudienceScore)}</span></span>
            </div>
            <div className="td-stat-row">
              <span className="td-stat-label">Quality</span>
              <span className="td-stat-value"><span className="td-stat-raw td-stat-raw--solo">{Math.round(performance.avgQualityScore)}</span></span>
            </div>
            <div className="td-stat-row">
              <span className="td-stat-label">Hits</span>
              <span className="td-stat-value"><span className="td-stat-raw td-stat-raw--solo">{performance.hitCount}</span></span>
            </div>
            <div className="td-stat-row">
              <span className="td-stat-label">Flops</span>
              <span className="td-stat-value"><span className="td-stat-raw td-stat-raw--solo">{performance.flopCount}</span></span>
            </div>
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
  const [gender, setGender] = useState<GenderFilter>('all');
  const [availability, setAvailability] = useState<AvailabilityFilter>('all');
  const [sort, setSort] = useState<Sort>('fame');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const actors = useMemo(() => state.talentPool.Actor.filter((p) => p.careers.actor), [state.talentPool.Actor]);

  // Every released credit for anyone, keyed by person id - built once, read by
  // both the list (credit counts) and the detail (full filmography).
  const creditsByPerson = useMemo(() => {
    const films = [...playerReleasedFilms(state.projects), ...rivalReleasedFilms(state.projects)];
    const map = new Map<string, Credit[]>();
    for (const film of films) {
      for (const assignment of film.talent) {
        if (assignment.role !== 'Lead Actor' && assignment.role !== 'Supporting Actor') continue;
        const list = map.get(assignment.person.id) ?? [];
        list.push({ film, roleLabel: assignment.role === 'Lead Actor' ? 'Lead' : 'Supporting' });
        map.set(assignment.person.id, list);
      }
    }
    for (const list of map.values()) list.sort((a, b) => b.film.releasedOnDay - a.film.releasedOnDay);
    return map;
  }, [state.projects]);

  // Per-person Academy Award tally across every resolved ceremony in history.
  const awardsByPerson = useMemo(() => collectPersonAwards(state.awards?.history ?? []), [state.awards?.history]);

  // Per-person released-film performance (same aggregate the Stats leaderboard
  // uses), keyed by person id so the detail view can look its subject up.
  const performanceByPerson = useMemo(() => {
    const rows = collectPersonStats(collectFilmStats(state.projects, state.studio.name), ['Lead Actor', 'Supporting Actor']);
    return new Map(rows.map((row) => [row.id, row]));
  }, [state.projects, state.studio.name]);

  const selected = selectedId ? actors.find((p) => p.id === selectedId) ?? null : null;

  const visible = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    const filtered = actors.filter((p) => {
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
          return (b.careers.actor?.typicalSalary ?? 0) - (a.careers.actor?.typicalSalary ?? 0);
        case 'ability':
          return abilityStars(b) - abilityStars(a);
        case 'fame':
        default:
          return b.reputation.fame - a.reputation.fame;
      }
    });
  }, [actors, gender, availability, search, sort, totalDays]);

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
        <p className="td-database__summary">{actors.length} actors on record · showing {visible.length}</p>
      </div>

      <section className="td-controls" aria-label="Talent filters">
        <label className="td-search">
          <span className="sr-only">Search actors</span>
          <input type="search" value={search} placeholder="Search by name…" onChange={(e) => setSearch(e.target.value)} />
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
            <option value="ability">Acting ability</option>
            <option value="fee">Typical fee</option>
            <option value="name">Name</option>
          </select>
        </label>
      </section>

      {visible.length === 0 ? (
        <div className="card"><p style={{ margin: 0 }}>No actors match those filters.</p></div>
      ) : (
        <div className="td-list">
          <div className="td-list__head">
            <span>Name</span><span>Age · Gender</span><span>Fame</span><span>Typical fee</span><span>Credits</span><span>Status</span>
          </div>
          {visible.map((person) => (
            <ActorRow
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
