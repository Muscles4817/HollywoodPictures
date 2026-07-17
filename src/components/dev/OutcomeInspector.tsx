import { useState } from 'react';
import { useStudio } from '../../state/StudioContext';
import { GENRES } from '../../data/genres';
import { TARGET_AUDIENCES } from '../../data/audiences';
import { TONES, TONE_LABELS } from '../../data/tones';
import { EDIT_STYLE_PROFILES, MUSIC_FOCUS_PROFILES, TEST_SCREENING_PROFILES, FINAL_CUT_FOCUS_PROFILES } from '../../data/postProduction';
import { RELEASE_TYPE_PROFILES, RELEASE_WINDOW_GENRE_BONUS, MARKETING_SPEND_RANGE } from '../../data/release';
import { SHOOTING_BUDGET_RANGE, ENVIRONMENT_BUDGET_RANGE, PRACTICAL_EFFECTS_RANGE, VFX_RANGE } from '../../data/production';
import { computeReleaseResults } from '../../engine/releaseFilm';
import { computeTalentCost, computeProductionBudgetCost, computeEventsCostDelta } from '../../engine/cost';
import { deriveCommercialProfile } from '../../engine/commercialProfile';
import { computeTalentCompatibility, computeTalentCompatibilityBreakdown } from '../../engine/compatibility';
import { advanceToWeek, MAX_SIMULATION_WEEKS } from '../../engine/audienceSimulationStep';
import { inferStudioBrandFromMarketingEfficiency } from '../../engine/audienceSimulationInputs';
import { AVERAGE_TICKET_PRICE, STUDIO_BOX_OFFICE_SHARE } from '../../engine/boxOfficeRun';
import { determineOutcome } from '../../engine/outcome';
import { computeBrandChange, computePrestigeChange } from '../../engine/reputation';
import { createRng } from '../../engine/random';
import { playerReleasedFilms, rivalReleasedFilms } from '../../engine/project';
import { Button } from '../common/Button';
import { Money } from '../common/Money';
import { SeverityBadge } from '../common/SeverityBadge';
import { AudienceSimulationDiagnostics } from './AudienceSimulationDiagnostics';
import type {
  EditStyle,
  Film,
  FinalCutFocus,
  Genre,
  MarketingChoices,
  MusicFocus,
  PostProductionChoices,
  ProductionChoices,
  ProductionEvent,
  ReleaseType,
  ReleaseWindow,
  Script,
  TalentAssignment,
  TargetAudience,
  TestScreeningResponse,
  Tone,
} from '../../types';
import { findAssignedPerson, filterAssignedPeople } from '../../data/helpers';
import { getDirectorCareer } from '../../engine/person';

// Developer-only tool: loads a real film from Studio History, lets the
// player tweak any single input (a script stat, a talent's fame, a
// production dial, ...) and see how it moves the ratings/box office outcome
// - built on the exact same pure scoring/box-office functions the real game
// uses (engine/scoring.ts, engine/releaseFilm.ts, engine/audienceSimulation*.ts,
// engine/outcome.ts, engine/reputation.ts), just on a locally-editable copy
// of one film's inputs, so it can never drift from real game behavior. See
// docs/DESIGN.md.
//
// Crew roles (Writer/Cinematographer/Composer/Editor/VFX Supervisor) and
// per-talent toneProfile/actingStyle aren't exposed - verified against
// scoring.ts that no score/box-office formula reads them today. Script's
// own toneProfile is exposed instead, and covers compatibility for every
// hired talent at once (computeTalentCompatibility derives it fresh from
// script.toneProfile vs. each talent's own tone/acting style, so this still
// exercises that path).

const EDIT_STYLES = Object.keys(EDIT_STYLE_PROFILES) as EditStyle[];
const MUSIC_FOCI = Object.keys(MUSIC_FOCUS_PROFILES) as MusicFocus[];
const TEST_SCREENING_RESPONSES = Object.keys(TEST_SCREENING_PROFILES) as TestScreeningResponse[];
const FINAL_CUT_FOCI = Object.keys(FINAL_CUT_FOCUS_PROFILES) as FinalCutFocus[];
const RELEASE_TYPES = Object.keys(RELEASE_TYPE_PROFILES) as ReleaseType[];
const RELEASE_WINDOWS = Object.keys(RELEASE_WINDOW_GENRE_BONUS) as ReleaseWindow[];

// A synthetic single-line placeholder for the three aggregate event-impact
// sliders below - qualityDelta/buzzDelta/costDelta all actually reach a
// formula (computeEventsScore/computeBuzzScore/computeEventsCostDelta
// respectively); delayDaysDelta doesn't (it only ever affected live
// scheduling during principal photography, which has already happened by
// release time) and severity is purely cosmetic, so neither is exposed here.
function syntheticEvent(qualityDelta: number, buzzDelta: number, costDelta: number): ProductionEvent {
  return { id: 'synthetic', description: 'Aggregate event impact (Outcome Inspector)', severity: 'medium', costDelta, qualityDelta, buzzDelta, delayDaysDelta: 0 };
}

/** Average fame across every hired member of one role - mirrors engine/releaseFilm.ts's own averageFame, used here to feed AudienceSimulationDiagnostics the same directorFame/leadFame inputs a real release computes. */
function averageFame(talent: TalentAssignment[], role: TalentAssignment['role']): number {
  const matching = filterAssignedPeople(talent, role);
  return matching.length > 0 ? matching.reduce((sum, t) => sum + t.reputation.fame, 0) / matching.length : 0;
}

function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  formatValue,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
}) {
  return (
    <div className="row-between" style={{ gap: 12 }}>
      <span className="score-bar-label" style={{ flexShrink: 0 }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1 }}
        aria-label={label}
      />
      <span style={{ width: 90, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {formatValue ? formatValue(value) : Math.round(value)}
      </span>
    </div>
  );
}

function SelectRow<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: T[]; onChange: (value: T) => void }) {
  return (
    <div className="row-between">
      <span className="score-bar-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

/** One score's original-vs-current comparison, with the delta called out. */
function CompareScoreRow({ label, original, current }: { label: string; original: number; current: number }) {
  const delta = current - original;
  return (
    <div className="row-between">
      <span className="score-bar-label">{label}</span>
      <span className="row" style={{ gap: 10 }}>
        <span style={{ color: 'var(--text-muted)' }}>{Math.round(original)}</span>
        <span>→</span>
        <span style={{ fontWeight: 700 }}>{Math.round(current)}</span>
        {Math.round(delta) !== 0 && (
          <span style={{ color: delta > 0 ? 'var(--green)' : 'var(--red)' }}>
            ({delta > 0 ? '+' : ''}{Math.round(delta)})
          </span>
        )}
      </span>
    </div>
  );
}

function CompareMoneyRow({ label, original, current }: { label: string; original: number; current: number }) {
  const delta = current - original;
  return (
    <div className="row-between">
      <span className="score-bar-label">{label}</span>
      <span className="row" style={{ gap: 10 }}>
        <span style={{ color: 'var(--text-muted)' }}><Money amount={original} /></span>
        <span>→</span>
        <span style={{ fontWeight: 700 }}><Money amount={current} /></span>
        {Math.round(delta) !== 0 && (
          <span style={{ color: delta > 0 ? 'var(--green)' : 'var(--red)' }}>
            (<Money amount={delta} showSign />)
          </span>
        )}
      </span>
    </div>
  );
}

export function OutcomeInspector() {
  const { state } = useStudio();
  // Every released film, player's and every rival's, so a real rival
  // release can be loaded and experimented with directly instead of
  // needing a player-made film to exist first - see studioFilter below for
  // narrowing this back down to one studio at a time.
  const playerFilms = playerReleasedFilms(state.projects);
  const rivalFilms = rivalReleasedFilms(state.projects);
  const allFilms = [...playerFilms, ...rivalFilms];
  const studioNameFor = (film: Film) => film.releasedBy ?? state.studio.name;
  const studioNames = [...new Set(allFilms.map(studioNameFor))].sort((a, b) =>
    a === state.studio.name ? -1 : b === state.studio.name ? 1 : a.localeCompare(b),
  );

  const [studioFilter, setStudioFilter] = useState<string>('all');
  const filmsReleased = studioFilter === 'all' ? allFilms : allFilms.filter((f) => studioNameFor(f) === studioFilter);

  const [filmId, setFilmId] = useState<string | null>(filmsReleased[0]?.id ?? null);
  const selectedFilm = filmsReleased.find((f) => f.id === filmId) ?? null;

  // The full editable working copy - seeded from the selected film below,
  // independent of it afterward so tweaking never touches real save data.
  // Lazily initialized straight from `selectedFilm` (the same fields
  // loadFilm sets) rather than a bare null/default, so the very first
  // render already has a loaded film - previously these all defaulted to
  // null/50/0 regardless of selectedFilm, so the "nothing loaded yet" guard
  // below was *always* true on mount even though a film was already
  // selected. With only one released film, the <select> below then had no
  // way to ever fire onChange (browsers don't fire change events for
  // re-picking the option that's already selected) - the screen was
  // permanently stuck showing nothing.
  const [genre, setGenre] = useState<Genre>(selectedFilm?.genre ?? 'Action');
  const [targetAudience, setTargetAudience] = useState<TargetAudience>(selectedFilm?.targetAudience ?? 'Mass Market');
  const [script, setScript] = useState<Script | null>(selectedFilm?.script ?? null);
  const [talent, setTalent] = useState<TalentAssignment[]>(selectedFilm?.talent ?? []);
  const [productionChoices, setProductionChoices] = useState<ProductionChoices | null>(selectedFilm?.productionChoices ?? null);
  const [postProductionChoices, setPostProductionChoices] = useState<PostProductionChoices | null>(selectedFilm?.postProductionChoices ?? null);
  const [marketingChoices, setMarketingChoices] = useState<MarketingChoices | null>(selectedFilm?.marketingChoices ?? null);
  const [studioBrand, setStudioBrand] = useState(() =>
    selectedFilm ? inferStudioBrandFromMarketingEfficiency(selectedFilm.boxOfficeRun.fixed.marketingEfficiency) : state.studio.brand,
  );
  const [shootingRatio, setShootingRatio] = useState(1);
  // Not preserved from the original release (not stored on Film, same as
  // shootingRatio above) - defaults to 0 (no competing crowding assumed) so
  // a freshly-loaded film's Current matches Original, freely editable to
  // experiment with what a crowded release window would have done to it.
  const [competitiveCrowding, setCompetitiveCrowding] = useState(0);
  const [eventQualityDelta, setEventQualityDelta] = useState(() => selectedFilm?.events.reduce((sum, e) => sum + e.qualityDelta, 0) ?? 0);
  const [eventBuzzDelta, setEventBuzzDelta] = useState(() => selectedFilm?.events.reduce((sum, e) => sum + e.buzzDelta, 0) ?? 0);
  const [eventCostDelta, setEventCostDelta] = useState(() => selectedFilm?.events.reduce((sum, e) => sum + e.costDelta, 0) ?? 0);
  const [photographyCost, setPhotographyCost] = useState(() => (selectedFilm ? photographyCostForFilm(selectedFilm) : 0));
  // Seeds computeReleaseResults' rng - only ever consumed for review-blurb/
  // story-report flavor text now (the audience simulation itself has no
  // randomness at all, docs/DESIGN.md 5.34 Milestone 5), recreated fresh
  // from this seed every render (not advanced) so dragging an unrelated
  // slider never jitters the picked blurb; only loading a film or hitting
  // "Reroll Flavor Text" changes it.
  const [varianceSeed, setVarianceSeed] = useState(() => Date.now());

  // The releasing studio's Brand as it actually was on this film's release
  // day - not its current Brand, which almost certainly has moved since
  // (Brand changes after every release, engine/reputation.ts). Buzz Score
  // and the whole audience simulation are driven by studioBrand
  // (engine/scoring.ts:computeBuzzScore, engine/audienceSimulationInputs.ts),
  // so seeding from current Brand made "Current" permanently diverge from
  // the stored "Original" even with zero edits, and made "Reset to
  // Original" unable to ever close that gap. Recovered exactly from this
  // film's own frozen boxOfficeRun.fixed.marketingEfficiency instead -
  // computed once at release and never recomputed, same as every other
  // field loadFilm seeds from the selected Film itself.
  function brandForFilm(film: Film): number {
    return inferStudioBrandFromMarketingEfficiency(film.boxOfficeRun.fixed.marketingEfficiency);
  }

  // Contingency's actual daily-burn total from the real shoot
  // (PhotographyState.runningCost) - not stored on Film, but exactly
  // recoverable by subtraction: every other component of
  // FilmResults.productionCost (talent, production budget, real events'
  // cost deltas, test screening) is already reproduced verbatim from the
  // Film's own stored fields, so whatever's left over after subtracting
  // those from the stored productionCost must be the photography cost that
  // was originally charged. Was previously hardcoded to 0, silently making
  // every loaded film's Total Cost/Profit read lower than its real release
  // - clamped at 0 for the (essentially unreachable) edge case where the
  // original sum itself clamped there first (engine/releaseFilm.ts).
  function photographyCostForFilm(film: Film): number {
    const talentCost = computeTalentCost(film.talent);
    const productionBudgetCost = computeProductionBudgetCost(film.productionChoices);
    const eventsCostDelta = computeEventsCostDelta(film.events);
    const testScreeningCost = TEST_SCREENING_PROFILES[film.postProductionChoices.testScreeningResponse].cost;
    return Math.max(0, film.results.productionCost - talentCost - productionBudgetCost - eventsCostDelta - testScreeningCost);
  }

  function loadFilm(film: Film) {
    setFilmId(film.id);
    setGenre(film.genre);
    setTargetAudience(film.targetAudience);
    setScript(film.script);
    setTalent(film.talent);
    setProductionChoices(film.productionChoices);
    setPostProductionChoices(film.postProductionChoices);
    setMarketingChoices(film.marketingChoices);
    setStudioBrand(brandForFilm(film));
    setShootingRatio(1);
    setCompetitiveCrowding(0);
    setPhotographyCost(photographyCostForFilm(film));
    const evQuality = film.events.reduce((sum, e) => sum + e.qualityDelta, 0);
    const evBuzz = film.events.reduce((sum, e) => sum + e.buzzDelta, 0);
    const evCost = film.events.reduce((sum, e) => sum + e.costDelta, 0);
    setEventQualityDelta(evQuality);
    setEventBuzzDelta(evBuzz);
    setEventCostDelta(evCost);
    setVarianceSeed(Date.now());
  }

  // Narrowing the studio filter can leave the currently-loaded film outside
  // the newly-visible list (its <option> no longer renders) - load the new
  // list's first film automatically rather than leaving the picker showing
  // a stale, no-longer-listed selection.
  function handleStudioFilterChange(name: string) {
    setStudioFilter(name);
    const nextList = name === 'all' ? allFilms : allFilms.filter((f) => studioNameFor(f) === name);
    if (nextList.length > 0 && !nextList.some((f) => f.id === filmId)) {
      loadFilm(nextList[0]);
    }
  }

  function updateScript<K extends keyof Script>(key: K, value: Script[K]) {
    setScript((s) => (s ? { ...s, [key]: value } : s));
  }
  function updateTone(tone: Tone, value: number) {
    setScript((s) => (s ? { ...s, toneProfile: { ...s.toneProfile, [tone]: value } } : s));
  }
  function updateDirectorSkill(value: number) {
    setTalent((t) =>
      t.map((a) => {
        const career = a.role === 'Director' ? getDirectorCareer(a.person) : null;
        if (!career) return a;
        return { ...a, person: { ...a.person, careers: { ...a.person.careers, director: { ...career, skill: value } } } };
      }),
    );
  }
  function updateDirectorFame(value: number) {
    setTalent((t) => t.map((a) => (a.role === 'Director' ? { ...a, person: { ...a.person, reputation: { ...a.person.reputation, fame: value } } } : a)));
  }
  function updateGroupFame(role: 'Lead Actor' | 'Supporting Actor', value: number) {
    setTalent((t) => t.map((a) => (a.role === role ? { ...a, person: { ...a.person, reputation: { ...a.person.reputation, fame: value } } } : a)));
  }

  if (allFilms.length === 0) {
    return (
      <div className="stack">
        <h1 style={{ margin: 0 }}>Box Office &amp; Ratings Inspector</h1>
        <p style={{ color: 'var(--text-muted)' }}>
          No released films yet - release one first (yours or a rival's), then come back here to experiment with what moves its outcome.
        </p>
      </div>
    );
  }

  if (!selectedFilm || !script || !productionChoices || !postProductionChoices || !marketingChoices) {
    // First mount, or a film hasn't been explicitly loaded yet.
    return (
      <div className="stack">
        <h1 style={{ margin: 0 }}>Box Office &amp; Ratings Inspector</h1>
        <div className="row">
          <select value={studioFilter} onChange={(e) => handleStudioFilterChange(e.target.value)}>
            <option value="all">All Studios</option>
            {studioNames.map((name) => (
              <option key={name} value={name}>{name === state.studio.name ? `${name} (Mine)` : name}</option>
            ))}
          </select>
          <select value={filmId ?? ''} onChange={(e) => {
            const f = filmsReleased.find((x) => x.id === e.target.value);
            if (f) loadFilm(f);
          }}>
            <option value="" disabled>Load a film from Studio History...</option>
            {filmsReleased.map((f) => (
              <option key={f.id} value={f.id}>{studioFilter === 'all' ? `${f.title} — ${studioNameFor(f)}` : f.title}</option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  const director = findAssignedPerson(talent, 'Director');
  const directorCareer = director && getDirectorCareer(director);
  const leadCount = filterAssignedPeople(talent, 'Lead Actor').length;
  const supportCount = filterAssignedPeople(talent, 'Supporting Actor').length;
  const leadFame = findAssignedPerson(talent, 'Lead Actor')?.reputation.fame ?? 0;
  const supportFame = findAssignedPerson(talent, 'Supporting Actor')?.reputation.fame ?? 0;

  const events = [syntheticEvent(eventQualityDelta, eventBuzzDelta, eventCostDelta)];

  // Runs the exact same orchestration RELEASE_FILM does (state/studioReducer.ts)
  // against the editable working copy - quality/critic/audience/buzz,
  // opening weekend, total cost, and the audience simulation's release-day
  // fixed state all come back from this one call, so there's no separate
  // formula-by-formula reimplementation to drift out of sync. photographyCost
  // is seeded from photographyCostForFilm above (reconstructed by
  // subtraction, exact on load), not hardcoded - shootingRatio remains a
  // genuine unknown (defaults to 1.0, see its own slider caption below) since
  // it isn't recoverable the same way: it feeds a nonlinear/clamped formula
  // (engine/productionDials.ts:shootingQualityFromRatio), not a simple
  // additive cost term, so there's no exact inverse.
  const rng = createRng(varianceSeed);
  const { results, fixed } = computeReleaseResults(
    {
      title: selectedFilm.title,
      genre,
      targetAudience,
      script,
      talent,
      productionChoices,
      postProductionChoices,
      marketingChoices,
      events,
      photographyCost,
      shootingRatio,
      studioBrand,
      competitiveCrowding,
    },
    rng,
  );

  // Projects this working copy's whole run the same way
  // engine/boxOfficeRun.ts does for real (advanceToWeek against the exact
  // same `fixed` it would seed Film.boxOfficeRun.fixed with), just without
  // waiting for GameState.totalDays to actually advance - a stable number that
  // only moves when an input changes, the same reasoning
  // components/dev/OutcomeInspector.tsx's Milestone 4 predecessor had for
  // projecting the old model.
  const totalBoxOffice = results.totalBoxOffice ?? 0;
  const projectedWeeks = advanceToWeek(fixed, [], MAX_SIMULATION_WEEKS);
  const projectedTotalGross =
    projectedWeeks.length > 0 ? Math.round(projectedWeeks[projectedWeeks.length - 1].cumulativeTicketsSold * AVERAGE_TICKET_PRICE) : 0;
  const legs = results.openingWeekend > 0 ? projectedTotalGross / results.openingWeekend : 0;
  const studioRevenue = Math.round(projectedTotalGross * STUDIO_BOX_OFFICE_SHARE);
  const profit = studioRevenue - results.totalCost;
  const outcome = determineOutcome({profit, totalCost: results.totalCost, totalBoxOffice, qualityScore: results.qualityScore, criticScore: results.criticScore, audienceScore: results.audienceScore});

  const brandChange = computeBrandChange({profit, totalCost: results.totalCost, totalBoxOffice, audienceScore: results.audienceScore});
  const prestigeChange = computePrestigeChange({criticScore: results.criticScore, qualityScore: results.qualityScore });

  const original = selectedFilm.results;
  // A finished run's totalBoxOffice is already known exactly; a still-running
  // one gets the same projection as the working copy, but run against the
  // film's *actual* release-day fixed state (selectedFilm.boxOfficeRun.fixed)
  // rather than re-derived from its stored inputs - more accurate than
  // reconstructing it, since it's the exact state that run was really seeded
  // with.
  const originalProjectedWeeks =
    original.totalBoxOffice === null ? advanceToWeek(selectedFilm.boxOfficeRun.fixed, [], MAX_SIMULATION_WEEKS) : [];
  const originalProjectedTotalGross =
    original.totalBoxOffice ??
    (originalProjectedWeeks.length > 0
      ? Math.round(originalProjectedWeeks[originalProjectedWeeks.length - 1].cumulativeTicketsSold * AVERAGE_TICKET_PRICE)
      : 0);

  return (
    <div className="stack">
      <div>
        <h1 style={{ margin: 0 }}>Box Office &amp; Ratings Inspector</h1>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>
          Developer tool - runs the real scoring/box-office functions against an editable copy of a real film's
          inputs. Doesn't touch save data.
        </p>
      </div>

      <div className="row" style={{ alignItems: 'center' }}>
        <select value={studioFilter} onChange={(e) => handleStudioFilterChange(e.target.value)}>
          <option value="all">All Studios</option>
          {studioNames.map((name) => (
            <option key={name} value={name}>{name === state.studio.name ? `${name} (Mine)` : name}</option>
          ))}
        </select>
        <select value={filmId ?? ''} onChange={(e) => {
          const f = filmsReleased.find((x) => x.id === e.target.value);
          if (f) loadFilm(f);
        }}>
          {filmsReleased.map((f) => (
            <option key={f.id} value={f.id}>{studioFilter === 'all' ? `${f.title} — ${studioNameFor(f)}` : f.title}</option>
          ))}
        </select>
        <Button onClick={() => loadFilm(selectedFilm)}>Reset to Original</Button>
        <Button onClick={() => setVarianceSeed(Date.now())}>Reroll Flavor Text</Button>
      </div>

      <div className="row">
        <div className="card stack" style={{ flex: 1 }}>
          <h2 style={{ margin: 0 }}>Ratings - Original → Current</h2>
          <CompareScoreRow label="Quality Score" original={original.qualityScore} current={results.qualityScore} />
          <CompareScoreRow label="Critic Score" original={original.criticScore} current={results.criticScore} />
          <CompareScoreRow label="Audience Score" original={original.audienceScore} current={results.audienceScore} />
          <CompareScoreRow label="Buzz Score" original={original.buzzScore} current={results.buzzScore} />
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            <p className="choice-description" style={{ margin: '0 0 8px' }}>Department breakdown</p>
            <CompareScoreRow label="Screenplay" original={original.scriptScore} current={results.scriptScore} />
            <CompareScoreRow label="Direction" original={original.directionScore} current={results.directionScore} />
            <CompareScoreRow label="Acting" original={original.actingScore} current={results.actingScore} />
            <CompareScoreRow label="Production" original={original.productionScore} current={results.productionScore} />
            <CompareScoreRow label="Post-Production" original={original.postProductionScore} current={results.postProductionScore} />
            <CompareScoreRow label="On-Set Events" original={original.eventsScore} current={results.eventsScore} />
          </div>
        </div>

        <div className="card stack" style={{ flex: 1 }}>
          <h2 style={{ margin: 0 }}>Box Office - Original → Current</h2>
          <CompareMoneyRow label="Opening Weekend" original={original.openingWeekend} current={results.openingWeekend} />
          <div className="row-between">
            <span className="score-bar-label">Legs</span>
            <span>{legs.toFixed(2)}x</span>
          </div>
          <CompareMoneyRow label="Projected Total Gross" original={originalProjectedTotalGross} current={projectedTotalGross} />
          <CompareMoneyRow label="Total Cost" original={original.totalCost} current={results.totalCost} />
          <CompareMoneyRow label="Profit / Loss" original={original.profit ?? 0} current={profit} />
          <div className="row-between">
            <span className="score-bar-label">Outcome</span>
            <span className="row" style={{ gap: 8 }}>
              {original.outcome && <span className={`badge badge-outcome-${original.outcome.replace(/\s+/g, '-')}`}>{original.outcome}</span>}
              <span>→</span>
              <span className={`badge badge-outcome-${outcome.replace(/\s+/g, '-')}`}>{outcome}</span>
            </span>
          </div>
          <div className="row-between">
            <span className="score-bar-label">Brand Change</span>
            <span>{original.brandChange ?? 0} → {brandChange}</span>
          </div>
          <div className="row-between">
            <span className="score-bar-label">Prestige Change</span>
            <span>{original.prestigeChange ?? 0} → {prestigeChange}</span>
          </div>
        </div>
      </div>

      <AudienceSimulationDiagnostics
        releaseType={marketingChoices.releaseType}
        buzzScore={results.buzzScore}
        marketingSpend={marketingChoices.marketingSpend}
        directorFame={averageFame(talent, 'Director')}
        leadFame={averageFame(talent, 'Lead Actor')}
        studioBrand={studioBrand}
        scriptAccessibility={deriveCommercialProfile(script).accessibility}
        scriptHookStrength={deriveCommercialProfile(script).hookStrength}
        scriptCrossoverPotential={deriveCommercialProfile(script).crossoverPotential}
        scriptSpectacle={script.toneProfile.spectacle}
        scriptIntendedAudience={script.intendedAudience}
        targetAudience={targetAudience}
        genre={genre}
        releaseWindow={marketingChoices.releaseWindow}
        competitiveCrowding={competitiveCrowding}
        criticScore={results.criticScore}
        audienceScore={results.audienceScore}
      />

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Script</h2>
        <SliderRow label="Originality" value={script.originality} min={0} max={100} onChange={(v) => updateScript('originality', v)} />
        <SliderRow label="Structure" value={script.structure} min={0} max={100} onChange={(v) => updateScript('structure', v)} />
        <SliderRow label="Characters" value={script.characters} min={0} max={100} onChange={(v) => updateScript('characters', v)} />
        <SliderRow label="Dialogue" value={script.dialogue} min={0} max={100} onChange={(v) => updateScript('dialogue', v)} />
        <SliderRow label="Complexity" value={script.complexity} min={0} max={100} onChange={(v) => updateScript('complexity', v)} />
        <p className="choice-description" style={{ margin: '4px 0 0' }}>
          {script.archetype} &middot; {script.storyType} &middot; {script.primarySetting} &middot; {script.scale}
        </p>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          <p className="choice-description" style={{ margin: '0 0 8px' }}>
            Tone Profile - drives every hired talent's compatibility with this script
          </p>
          {TONES.map((tone) => (
            <SliderRow key={tone} label={TONE_LABELS[tone]} value={script.toneProfile[tone]} min={0} max={100} onChange={(v) => updateTone(tone, v)} />
          ))}
        </div>
        <SelectRow label="Genre" value={genre} options={GENRES} onChange={setGenre} />
        <SelectRow label="Target Audience" value={targetAudience} options={TARGET_AUDIENCES} onChange={setTargetAudience} />
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Cast</h2>
        {director && directorCareer ? (
          <>
            <SliderRow label="Director Skill" value={directorCareer.skill} min={0} max={100} onChange={updateDirectorSkill} />
            <SliderRow label="Director Fame" value={director.reputation.fame} min={0} max={100} onChange={updateDirectorFame} />
          </>
        ) : (
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>No director on this film.</p>
        )}
        {leadCount > 0 ? (
          <SliderRow label={`Lead Fame (all ${leadCount})`} value={leadFame} min={0} max={100} onChange={(v) => updateGroupFame('Lead Actor', v)} />
        ) : (
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>No lead actors on this film.</p>
        )}
        {supportCount > 0 ? (
          <SliderRow label={`Supporting Fame (all ${supportCount})`} value={supportFame} min={0} max={100} onChange={(v) => updateGroupFame('Supporting Actor', v)} />
        ) : (
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>No supporting actors on this film.</p>
        )}
        <p className="choice-description" style={{ margin: 0 }}>
          Crew roles (Writer/Cinematographer/Composer/Editor/VFX Supervisor) don't feed any rating or box-office
          formula today, so they're not shown here.
        </p>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Compatibility Breakdown</h2>
        <p className="choice-description" style={{ margin: 0 }}>
          Per-tone contribution behind each hired talent's Compatibility score (engine/compatibility.ts) - normal
          gameplay only ever shows the aggregate 0-100 number; this is where each axis's own weighted mismatch,
          discarded by computeCompatibility once it sums them, is actually visible.
        </p>
        {script ? (
          talent.filter((a) => a.role === 'Director' || a.role === 'Lead Actor' || a.role === 'Supporting Actor').length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>No director or actors hired on this film.</p>
          ) : (
            talent
              .filter((a) => a.role === 'Director' || a.role === 'Lead Actor' || a.role === 'Supporting Actor')
              .map((a) => {
                const t = a.person;
                const breakdown = computeTalentCompatibilityBreakdown(t, a.role, script);
                const score = computeTalentCompatibility(t, a.role, script);
                if (!breakdown) return null;
                return (
                  <div key={t.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                    <div className="row-between">
                      <strong>{t.identity.name} &middot; {a.role}</strong>
                      <span>Compatibility {score !== null ? Math.round(score) : '-'}</span>
                    </div>
                    <table>
                      <thead>
                        <tr>
                          <th>Tone</th>
                          <th>Script</th>
                          <th>Talent</th>
                          <th>Gap</th>
                          <th>Contribution</th>
                          <th>Share</th>
                        </tr>
                      </thead>
                      <tbody>
                        {breakdown.map((row) => (
                          <tr key={row.tone}>
                            <td>{TONE_LABELS[row.tone]}</td>
                            <td>{Math.round(row.scriptValue)}</td>
                            <td>{Math.round(row.talentValue)}</td>
                            <td>{row.gap.toFixed(1)}</td>
                            <td>{row.contribution.toFixed(1)}</td>
                            <td>{(row.contributionShare * 100).toFixed(0)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })
          )
        ) : (
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>No script loaded.</p>
        )}
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Production Budget</h2>
        <SliderRow
          label="Contingency Reserve"
          value={productionChoices.contingencyAmount}
          min={SHOOTING_BUDGET_RANGE.min}
          max={SHOOTING_BUDGET_RANGE.max}
          step={1000}
          formatValue={(v) => `$${Math.round(v).toLocaleString()}`}
          onChange={(v) => setProductionChoices({ ...productionChoices, contingencyAmount: v })}
        />
        <SliderRow
          label="Set Quality"
          value={productionChoices.setQualityAmount}
          min={ENVIRONMENT_BUDGET_RANGE.min}
          max={ENVIRONMENT_BUDGET_RANGE.max}
          step={1000}
          formatValue={(v) => `$${Math.round(v).toLocaleString()}`}
          onChange={(v) => setProductionChoices({ ...productionChoices, setQualityAmount: v })}
        />
        <SliderRow
          label="Practical Effects"
          value={productionChoices.practicalEffectsAmount}
          min={PRACTICAL_EFFECTS_RANGE.min}
          max={PRACTICAL_EFFECTS_RANGE.max}
          step={1000}
          formatValue={(v) => `$${Math.round(v).toLocaleString()}`}
          onChange={(v) => setProductionChoices({ ...productionChoices, practicalEffectsAmount: v })}
        />
        <SliderRow
          label="VFX Spend"
          value={productionChoices.vfxAmount}
          min={VFX_RANGE.min}
          max={VFX_RANGE.max}
          step={1000}
          formatValue={(v) => `$${Math.round(v).toLocaleString()}`}
          onChange={(v) => setProductionChoices({ ...productionChoices, vfxAmount: v })}
        />
        <SliderRow
          label="Runtime Intensity"
          value={productionChoices.runtimeIntensity}
          min={0}
          max={1}
          step={0.01}
          formatValue={(v) => v.toFixed(2)}
          onChange={(v) => setProductionChoices({ ...productionChoices, runtimeIntensity: v })}
        />
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Post-Production</h2>
        <SelectRow label="Edit Style" value={postProductionChoices.editStyle} options={EDIT_STYLES} onChange={(v) => setPostProductionChoices({ ...postProductionChoices, editStyle: v })} />
        <SelectRow label="Music Focus" value={postProductionChoices.musicFocus} options={MUSIC_FOCI} onChange={(v) => setPostProductionChoices({ ...postProductionChoices, musicFocus: v })} />
        <SelectRow label="Test Screening" value={postProductionChoices.testScreeningResponse} options={TEST_SCREENING_RESPONSES} onChange={(v) => setPostProductionChoices({ ...postProductionChoices, testScreeningResponse: v })} />
        <SelectRow label="Final Cut Focus" value={postProductionChoices.finalCutFocus} options={FINAL_CUT_FOCI} onChange={(v) => setPostProductionChoices({ ...postProductionChoices, finalCutFocus: v })} />
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Marketing</h2>
        <SliderRow
          label="Marketing Spend"
          value={marketingChoices.marketingSpend}
          min={MARKETING_SPEND_RANGE.min}
          max={MARKETING_SPEND_RANGE.max}
          step={10_000}
          formatValue={(v) => `$${Math.round(v).toLocaleString()}`}
          onChange={(v) => setMarketingChoices({ ...marketingChoices, marketingSpend: v })}
        />
        <SelectRow label="Release Type" value={marketingChoices.releaseType} options={RELEASE_TYPES} onChange={(v) => setMarketingChoices({ ...marketingChoices, releaseType: v })} />
        <SelectRow label="Release Window" value={marketingChoices.releaseWindow} options={RELEASE_WINDOWS} onChange={(v) => setMarketingChoices({ ...marketingChoices, releaseWindow: v })} />
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Context &amp; Events</h2>
        <SliderRow label="Studio Brand" value={studioBrand} min={0} max={100} onChange={setStudioBrand} />
        <SliderRow
          label="Shooting Ratio (days elapsed / recommended)"
          value={shootingRatio}
          min={0.3}
          max={2.5}
          step={0.05}
          formatValue={(v) => v.toFixed(2)}
          onChange={setShootingRatio}
        />
        <p className="choice-description" style={{ margin: 0 }}>
          Not preserved from the original release (not stored on Film) - defaults to 1.0 (on schedule). Unlike
          Photography Cost below, this can't be reconstructed exactly: it feeds a nonlinear formula, not a plain
          additive cost, so any real deviation from an on-schedule shoot is a genuine, small, unrecoverable gap
          between Original and Current here.
        </p>
        <SliderRow
          label="Photography Cost (Contingency burn from the real shoot)"
          value={photographyCost}
          min={0}
          max={SHOOTING_BUDGET_RANGE.max}
          step={1000}
          formatValue={(v) => `$${Math.round(v).toLocaleString()}`}
          onChange={setPhotographyCost}
        />
        <SliderRow
          label="Competitive Crowding (0 = clear window, 1 = maximally crowded)"
          value={competitiveCrowding}
          min={0}
          max={1}
          step={0.05}
          formatValue={(v) => v.toFixed(2)}
          onChange={setCompetitiveCrowding}
        />
        <p className="choice-description" style={{ margin: 0 }}>
          Not preserved from the original release (not stored on Film) - defaults to 0 (no competing crowding
          assumed). engine/releaseCrowding.ts:computeCompetitiveCrowding is what derives this for real
          scheduling/settlement; here it's a free variable so you can see directly how much a crowded release
          window would have dented this film's initial screen access.
        </p>
        <SliderRow label="Net Event Quality Impact" value={eventQualityDelta} min={-50} max={50} onChange={setEventQualityDelta} />
        <SliderRow label="Net Event Buzz Impact" value={eventBuzzDelta} min={-50} max={50} onChange={setEventBuzzDelta} />
        <SliderRow
          label="Net Event Cost Impact"
          value={eventCostDelta}
          min={-500_000}
          max={500_000}
          step={1000}
          formatValue={(v) => `$${Math.round(v).toLocaleString()}`}
          onChange={setEventCostDelta}
        />
        {selectedFilm.events.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            <p className="choice-description" style={{ margin: '0 0 8px' }}>This film's real on-set events (read-only reference)</p>
            {selectedFilm.events.map((event, i) => (
              <div key={`${event.id}-${i}`} className="row-between" style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>
                <span className="row" style={{ gap: 8 }}>
                  <SeverityBadge severity={event.severity} />
                  <span>{event.description}</span>
                </span>
                <span>
                  Quality {event.qualityDelta >= 0 ? '+' : ''}{event.qualityDelta.toFixed(1)} &middot; Buzz{' '}
                  {event.buzzDelta >= 0 ? '+' : ''}{event.buzzDelta.toFixed(1)} &middot; Cost{' '}
                  <Money amount={event.costDelta} showSign />
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
