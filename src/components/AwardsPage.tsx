import { useStudio } from '../state/StudioContext';
import { collectFilmStats } from '../state/selectors';
import { Button } from './common/Button';
import { Money } from './common/Money';
import { AWARD_CATEGORIES, AWARD_CATEGORY_LABEL } from '../data/awards';
import type { AwardNomination, AwardsCeremony, AwardsSeasonInProgress, Film } from '../types';
import './AwardsPage.css';

const CAMPAIGN_PRESETS: Array<{ label: string; amount: number }> = [
  { label: 'None', amount: 0 },
  { label: 'Modest', amount: 1_000_000 },
  { label: 'Strong', amount: 3_000_000 },
  { label: 'All-out', amount: 6_000_000 },
];

interface FilmRef {
  film: Film;
  studioName: string;
  isPlayer: boolean;
}

/**
 * The Academy Awards screen (docs/DESIGN_REVIEW_awards_season.md, increment 3):
 * campaign your contenders while a season is open, and browse the permanent
 * ceremony history. Reachable from the Dashboard (VIEW_AWARDS).
 */
export function AwardsPage() {
  const { state, dispatch } = useStudio();
  const awards = state.awards;
  const filmById = new Map<string, FilmRef>(
    collectFilmStats(state.projects, state.studio.name).map((row) => [row.film.id, row]),
  );

  return (
    <div className="stack awards-page">
      <div className="row-between">
        <h1 style={{ margin: 0 }}>The Academy Awards</h1>
        <Button onClick={() => dispatch({ type: 'RETURN_TO_DASHBOARD' })}>Back to Dashboard</Button>
      </div>

      {awards?.season && (
        <CampaignSection
          season={awards.season}
          filmById={filmById}
          totalDays={state.totalDays}
          cash={state.studio.cash}
          onSet={(filmId, amount) => dispatch({ type: 'SET_AWARDS_CAMPAIGN', filmId, amount })}
        />
      )}

      <section className="card stack">
        <h2 style={{ margin: 0 }}>Ceremony history</h2>
        {(!awards || awards.history.length === 0) ? (
          <p className="awards-muted">No ceremonies yet. The first Academy Awards are held at the start of your studio's second year.</p>
        ) : (
          [...awards.history].reverse().map((ceremony) => (
            <CeremonyDetail key={ceremony.year} ceremony={ceremony} filmById={filmById} />
          ))
        )}
      </section>
    </div>
  );
}

function CampaignSection({
  season,
  filmById,
  totalDays,
  cash,
  onSet,
}: {
  season: AwardsSeasonInProgress;
  filmById: Map<string, FilmRef>;
  totalDays: number;
  cash: number;
  onSet: (filmId: string, amount: number) => void;
}) {
  const eligiblePlayerFilms = season.eligibleFilmIds
    .map((id) => filmById.get(id))
    .filter((r): r is FilmRef => r != null && r.isPlayer);
  const daysToCeremony = Math.max(0, season.ceremonyDay - totalDays);
  const totalCampaign = Object.values(season.campaignByFilm).reduce((sum, n) => sum + n, 0);

  return (
    <section className="card stack awards-campaign">
      <div className="row-between">
        <h2 style={{ margin: 0 }}>Campaign · Year {season.year} films</h2>
        <span className="awards-countdown">Ceremony in {daysToCeremony} day{daysToCeremony === 1 ? '' : 's'}</span>
      </div>
      <p className="awards-muted">
        Spend to raise a contender's odds - diminishing returns, and it can't buy a weak film a statuette. Charged now;
        lower a budget to refund it.
      </p>

      {eligiblePlayerFilms.length === 0 ? (
        <p className="awards-muted">You released no films this year - nothing to campaign.</p>
      ) : (
        eligiblePlayerFilms.map(({ film }) => {
          const current = season.campaignByFilm[film.id] ?? 0;
          return (
            <div className="awards-campaign-row" key={film.id}>
              <div className="awards-campaign-film">
                <strong>{film.title}</strong>
                <small>{film.genre} · Critics {film.results.criticScore}</small>
              </div>
              <div className="awards-campaign-buttons">
                {CAMPAIGN_PRESETS.map((preset) => {
                  // Disable an increase the studio can't afford (relative to what's already committed to this film).
                  const unaffordable = preset.amount > current && preset.amount - current > cash;
                  return (
                    <Button
                      key={preset.label}
                      className="btn-sm"
                      variant={current === preset.amount ? 'primary' : 'secondary'}
                      disabled={unaffordable}
                      onClick={() => onSet(film.id, preset.amount)}
                    >
                      {preset.label}
                      {preset.amount > 0 && <><br /><small><Money amount={preset.amount} /></small></>}
                    </Button>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      <div className="row-between awards-campaign-total">
        <span>Total committed</span>
        <Money amount={totalCampaign} />
      </div>
    </section>
  );
}

function CeremonyDetail({
  ceremony,
  filmById,
}: {
  ceremony: AwardsCeremony;
  filmById: Map<string, FilmRef>;
}) {
  const playerWins = AWARD_CATEGORIES.reduce((count, cat) => {
    const winner = ceremony.categories[cat].find((n) => n.won);
    return count + (winner && filmById.get(winner.filmId)?.isPlayer ? 1 : 0);
  }, 0);

  const nomineeLabel = (nom: AwardNomination): string => {
    const ref = filmById.get(nom.filmId);
    const title = ref ? ref.film.title : 'A film';
    const person = nom.personId && ref ? ref.film.talent.find((a) => a.person.id === nom.personId)?.person.identity.name : undefined;
    const studioTag = ref && !ref.isPlayer ? ` (${ref.studioName})` : '';
    return person ? `${person} — ${title}${studioTag}` : `${title}${studioTag}`;
  };

  return (
    <details className="awards-ceremony">
      <summary>
        <strong>Year {ceremony.year}</strong>
        <span className="awards-ceremony-haul">{playerWins > 0 ? `${playerWins} win${playerWins === 1 ? '' : 's'} for you` : 'No wins for you'}</span>
      </summary>
      <div className="awards-categories">
        {AWARD_CATEGORIES.map((cat) => {
          const noms = ceremony.categories[cat];
          if (noms.length === 0) return null;
          return (
            <div className="awards-category" key={cat}>
              <h4>{AWARD_CATEGORY_LABEL[cat]}</h4>
              <ul>
                {noms.map((nom, i) => {
                  const isPlayer = filmById.get(nom.filmId)?.isPlayer;
                  return (
                    <li key={i} className={nom.won ? 'awards-winner' : undefined}>
                      {nom.won && <span className="awards-trophy" aria-label="Winner">🏆 </span>}
                      <span className={isPlayer ? 'awards-player-film' : undefined}>{nomineeLabel(nom)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </details>
  );
}
