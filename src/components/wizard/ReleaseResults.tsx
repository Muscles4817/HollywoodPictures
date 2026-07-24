import { useStudio } from '../../state/StudioContext';
import { deriveFocusedFilm, collectFilmStats, computeReportedLegs } from '../../state/selectors';
import {
  deriveReceptionRead,
  deriveFilmInsights,
  deriveStudioImpact,
  deriveAchievements,
  brandChangeReason,
  prestigeChangeReason,
  type Achievement,
  type AchievementFacts,
  type FilmInsights,
} from '../../engine/premiereReport';
import type { Film, FilmResults, Genre } from '../../types';
import { Money } from '../common/Money';
import { ScoreBar } from '../common/ScoreBar';
import { FilmPerformance, FilmFinancials } from '../common/FilmMoneyBreakdown';
import { ProductionExecutionSummary } from '../common/ProductionExecutionSummary';
import { PremiereReveal } from './PremiereReveal';
import './ReleaseResults.css';

/** Section header with a small uppercase eyebrow above the title - gives the page its story-beat rhythm. */
function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="premiere-eyebrow">{eyebrow}</p>
      <h2 style={{ margin: 0 }}>{title}</h2>
    </div>
  );
}

function achievementFacts(film: Film): AchievementFacts {
  const r = film.results;
  return {
    openingWeekend: r.openingWeekend,
    audienceScore: r.audienceScore,
    criticScore: r.criticScore,
    profit: r.profit,
    totalBoxOffice: r.totalBoxOffice,
    legs: computeReportedLegs(film),
    prestigeChange: r.prestigeChange,
  };
}

function AchievementsBanner({ achievements }: { achievements: Achievement[] }) {
  if (achievements.length === 0) return null;
  return (
    <div className="stack" style={{ gap: 10 }}>
      <SectionHead eyebrow="This film made history" title="Milestones" />
      <div className="achievements">
        {achievements.map((a) => (
          <div key={a.id} className="achievement-chip">
            <span className="achievement-chip__medal" aria-hidden="true">🏆</span>
            <div>
              <div className="achievement-chip__label">{a.label}</div>
              {a.detail && <p className="achievement-chip__detail">{a.detail}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightGroup({ kind, insights }: { kind: 'strength' | 'weakness'; insights: FilmInsights['strengths'] }) {
  return (
    <div className={`insight-group insight-group--${kind}`}>
      <h3>{kind === 'strength' ? 'Strengths' : 'Weaknesses'}</h3>
      {insights.length > 0 ? (
        <ul className="insight-list">
          {insights.map((insight) => (
            <li key={insight.department} className="insight-item">
              <span className="insight-item__icon" aria-hidden="true">{kind === 'strength' ? '▲' : '▼'}</span>
              <span>
                <span className="insight-item__dept">{insight.department}. </span>
                <span className="insight-item__note">{insight.note}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="insight-empty">
          {kind === 'strength' ? 'Nothing stood out as a clear high point.' : 'No department clearly let the film down.'}
        </p>
      )}
    </div>
  );
}

/** The qualitative "why it landed" card - interpreted reception plus department strengths and weaknesses, in place of raw score bars. */
function WhyItLanded({ results, genre }: { results: FilmResults; genre: Genre }) {
  const reception = deriveReceptionRead(results.criticScore, results.audienceScore);
  const { strengths, weaknesses } = deriveFilmInsights(results, genre);
  const balanced = strengths.length === 0 && weaknesses.length === 0;

  return (
    <div className="card stack">
      <SectionHead eyebrow="Why it landed the way it did" title="The Reaction" />

      <div className="reception-read">
        <div className="reception-read__col">
          <h3>Critics</h3>
          <p>{reception.critics}</p>
        </div>
        <div className="reception-read__col">
          <h3>Audiences</h3>
          <p>{reception.audiences}</p>
        </div>
      </div>
      {reception.divergence && <p className="reception-divergence">{reception.divergence}</p>}

      {balanced ? (
        <p className="insight-empty" style={{ marginTop: 4 }}>
          A well-balanced production — no single department dominated the film, for better or worse.
        </p>
      ) : (
        <div className="insight-columns">
          <InsightGroup kind="strength" insights={strengths} />
          <InsightGroup kind="weakness" insights={weaknesses} />
        </div>
      )}
    </div>
  );
}

function StudioImpact({ film, finished }: { film: Film; finished: boolean }) {
  const { state } = useStudio();
  const results = film.results;
  const studioName = state.studio.name;
  const narrative = finished ? deriveStudioImpact(results, studioName) : [];

  return (
    <div className="card stack">
      <SectionHead eyebrow="What this means for your studio" title="Studio Impact" />
      <p className="studio-impact__narrative">{results.storyReport}</p>

      {finished ? (
        narrative.map((line, i) => (
          <p key={i} className="studio-impact__narrative" style={{ color: 'var(--text-muted)' }}>
            {line}
          </p>
        ))
      ) : (
        <p className="choice-description" style={{ margin: 0 }}>
          The film is still playing — how it reshapes your studio's reputation will firm up as the run finishes.
        </p>
      )}

      <div className="studio-standing">
        <div>
          <div className="stat-label">Studio Brand</div>
          <div className="stat-value">{state.studio.brand} / 100</div>
        </div>
        <div>
          <div className="stat-label">Studio Prestige</div>
          <div className="stat-value">{Math.round(state.studio.prestige)} / 100</div>
        </div>
        <div>
          <div className="stat-label">Studio Cash</div>
          <div className="stat-value"><Money amount={state.studio.cash} signColor /></div>
        </div>
      </div>
    </div>
  );
}

/**
 * The temporary developer/balancing panel (see the Film Premiere UX brief):
 * every raw simulation number the redesign pulled out of the player-facing
 * page, collapsed by default and kept in one place. Explicitly a balancing
 * tool for building the sim, not a player feature - the player learns the
 * simulation through the qualitative story above, not by reading these.
 */
function DevMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="dev-metric">
      <span className="dev-metric__label">{label}</span>
      <span className="dev-metric__value">{value}</span>
    </div>
  );
}

function DevPanel({ film, finished }: { film: Film; finished: boolean }) {
  const r = film.results;
  const mods = r.productionExecution?.modifiers;
  const fmtDelta = (v: number | null) => (v === null ? '—' : `${v >= 0 ? '+' : ''}${v}`);

  return (
    <details className="dev-panel">
      <summary>Developer · Balancing Values</summary>
      <div className="dev-panel__body">
        <p className="dev-panel__note choice-description">
          Raw simulation values, kept here for balancing while the sim is built. Not part of the player-facing page —
          the story above is what teaches the player.
        </p>

        <div className="dev-panel__group">
          <h4>Reception</h4>
          <div className="dev-grid">
            <DevMetric label="Quality" value={Math.round(r.qualityScore)} />
            <DevMetric label="Buzz" value={Math.round(r.buzzScore)} />
            <DevMetric label="Critic Score" value={Math.round(r.criticScore)} />
            <DevMetric label="Audience Score" value={Math.round(r.audienceScore)} />
          </div>
        </div>

        <div className="dev-panel__group">
          <h4>Department Baselines</h4>
          <ScoreBar label="Screenplay" value={r.scriptScore} />
          <ScoreBar label="Direction" value={r.directionScore} />
          <ScoreBar label="Acting" value={r.actingScore} />
          <ScoreBar label="Production" value={r.productionScore} />
          <ScoreBar label="Post-Production" value={r.postProductionScore} />
          <ScoreBar label="Events" value={r.eventsScore} />
        </div>

        {mods && (
          <div className="dev-panel__group">
            <h4>Production Execution Modifiers</h4>
            <div className="dev-grid">
              <DevMetric label="Performance Capture" value={mods.performanceCapture.toFixed(3)} />
              <DevMetric label="Post Execution" value={mods.postExecution.toFixed(3)} />
              <DevMetric label="Script Execution" value={mods.scriptExecution.toFixed(3)} />
              <DevMetric label="Coverage Ratio" value={mods.coverageRatio.toFixed(3)} />
              <DevMetric label="Overall" value={mods.overall.toFixed(3)} />
            </div>
          </div>
        )}

        <div className="dev-panel__group">
          <h4>Reputation Change {finished ? '' : '(pending run’s end)'}</h4>
          <div className="dev-grid">
            <DevMetric label="Brand Change" value={fmtDelta(r.brandChange)} />
            <DevMetric label="Prestige Change" value={fmtDelta(r.prestigeChange)} />
          </div>
          {finished && (r.brandChange || r.prestigeChange) ? (
            <p className="dev-panel__note choice-description" style={{ marginTop: 8 }}>
              {r.brandChange ? `Brand: ${brandChangeReason(r)}. ` : ''}
              {r.prestigeChange ? `Prestige: ${prestigeChangeReason(r)}.` : ''}
            </p>
          ) : null}
        </div>
      </div>
    </details>
  );
}

export function ReleaseResults() {
  const { state } = useStudio();
  // The focused project's id survives the transition RELEASE_FILM makes
  // from 'player-in-progress' to 'released' (see engine/project.ts,
  // state/studioReducer.ts) - so this is always the live, currently-settling
  // record of this exact film, not a frozen snapshot. The background
  // day-tick keeps running on this very screen (docs/DESIGN.md 5.20),
  // settling its box office run week by week, so a short-legged run
  // finishing while the player is still looking at this page shows the
  // real final numbers immediately rather than "still playing" forever.
  const film = deriveFocusedFilm(state)!;
  const results = film.results;
  // The film has already finished its whole run if the very first
  // settlement pass at release crossed straight to 'finished' (a weak
  // enough reception that legs bottom out after a single week) - rare, but
  // when it happens the final numbers below are already real, not pending.
  const finished = results.outcome !== null;

  // Every prior player film, for record/milestone comparisons - excludes this
  // very film (it is already in projects, now 'released').
  const priorFilms = collectFilmStats(state.projects, state.studio.name)
    .filter((row) => row.isPlayer && row.film.id !== film.id)
    .map((row) => achievementFacts(row.film));
  const achievements = deriveAchievements(achievementFacts(film), priorFilms, finished);

  return (
    <div className="stack">
      {/* 1. Did my movie succeed? - the cinematic hero */}
      <PremiereReveal
        title={film.title}
        genre={film.genre}
        outcome={results.outcome}
        criticScore={results.criticScore}
        audienceScore={results.audienceScore}
        criticReviews={results.criticReviews ?? []}
        audienceReviews={results.audienceReviews ?? []}
        openingWeekend={results.openingWeekend}
      />

      {!finished && (
        <p className="choice-description" style={{ margin: 0 }}>
          This is just the opening — the film is still playing. Its total gross, profit, outcome, and studio effect
          will all firm up week by week as it plays out; keep an eye on the Dashboard to watch it happen.
        </p>
      )}

      {/* Celebrate straight away */}
      <AchievementsBanner achievements={achievements} />

      {/* 2. How much money did it make? - split into reach vs. what we kept */}
      <div className="card stack">
        <SectionHead eyebrow="How it drew" title="Box Office — Performance" />
        <FilmPerformance film={film} />
      </div>
      <div className="card stack">
        <SectionHead eyebrow="What you kept" title="Box Office — Financials" />
        <FilmFinancials film={film} />
      </div>

      {/* 3. Why did it succeed or fail? */}
      <WhyItLanded results={results} genre={film.genre} />

      {/* 4. What happened during production? */}
      {results.productionExecution && <ProductionExecutionSummary outcome={results.productionExecution} />}

      {/* 5. What does this mean for my studio? */}
      <StudioImpact film={film} finished={finished} />

      {/* Temporary balancing panel - all the raw numbers, out of the way */}
      <DevPanel film={film} finished={finished} />
    </div>
  );
}
