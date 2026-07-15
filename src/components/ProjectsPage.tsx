import { useState } from 'react';
import { useStudio } from '../state/StudioContext';
import { collectProjectCards, currentWizardStepFor, type ProjectCardData, type ProjectStage } from '../state/selectors';
import { asPlayerDraft, findProject, asFilm } from '../engine/project';
import { formatGameDate } from '../engine/calendar';
import { Card } from './common/Card';
import { Button } from './common/Button';
import { Money } from './common/Money';
import { ScoreBar } from './common/ScoreBar';
import { FilmDetailModal } from './common/FilmDetailModal';
import type { Film } from '../types';

const STAGE_ORDER: ProjectStage[] = ['pre-production', 'filming', 'post-production', 'scheduled', 'in-cinemas', 'archived', 'shelved'];

const STAGE_LABELS: Record<ProjectStage, string> = {
  'pre-production': 'Pre-Production',
  filming: 'Filming',
  'post-production': 'Post-Production',
  scheduled: 'Scheduled',
  'in-cinemas': 'In Cinemas',
  archived: 'Archived',
  shelved: 'Shelved',
};

// Matches the CSS classes in index.css (.badge-stage-<X>/.project-card-<X>) -
// hyphen-free so they compose directly into a className string.
const STAGE_CLASS: Record<ProjectStage, string> = {
  'pre-production': 'PreProduction',
  filming: 'Filming',
  'post-production': 'PostProduction',
  scheduled: 'Scheduled',
  'in-cinemas': 'InCinemas',
  archived: 'Archived',
  shelved: 'Shelved',
};

const STAGE_BLURBS: Record<ProjectStage, string> = {
  'pre-production': 'Still being planned - develop, cast, and plan the production before Greenlight.',
  filming: 'Principal photography is under way.',
  'post-production': 'Photography wrapped - editing, scoring, and marketing choices are being locked in.',
  scheduled: 'Every choice is locked in - waiting on its committed release day.',
  'in-cinemas': 'Currently playing - box office settles week by week.',
  archived: 'Its theatrical run has finished.',
  shelved: 'Backgrounded before photography started - nothing moves here until you come back to it.',
};

// Stages RESUME_PROJECT/GO_TO_STEP can actually send you into - the other
// three (scheduled, in-cinemas, archived) open a read-only view instead
// (nothing left to decide for a scheduled project; a released film's own
// dossier for the other two), so they're never gated by focus.
const RESUMABLE_STAGES = new Set<ProjectStage>(['pre-production', 'filming', 'post-production', 'shelved']);

/**
 * Every one of the player's own current projects, one card each, grouped by
 * stage - the "what am I working on right now, across the whole studio"
 * view nothing else in the game provides today (Dashboard only surfaces the
 * focused project plus a raw in-progress count; the Inbox only surfaces
 * backgrounded ones that need a decision). Rival productions never appear
 * here - see state/selectors.ts:collectProjectCards. Clicking a card either
 * opens a read-only dossier (released, scheduled) or resumes it into the
 * wizard at its current step (everything else) - resuming follows the exact
 * same "only while nothing else is focused" rule the Inbox and Asset
 * Library already use, not a new capability.
 */
export function ProjectsPage() {
  const { state, dispatch } = useStudio();
  const [selectedFilm, setSelectedFilm] = useState<Film | null>(null);
  const [selectedScheduledId, setSelectedScheduledId] = useState<string | null>(null);

  const cards = collectProjectCards(state);
  const somethingElseFocused = state.focusedProjectId !== null;

  const grouped = STAGE_ORDER.map((stage) => ({ stage, cards: cards.filter((c) => c.stage === stage) })).filter(
    (group) => group.cards.length > 0,
  );

  const scheduledCard = selectedScheduledId ? cards.find((c) => c.projectId === selectedScheduledId) ?? null : null;

  function handleCardClick(card: ProjectCardData) {
    if (card.stage === 'in-cinemas' || card.stage === 'archived') {
      const film = asFilm(findProject(state.projects, card.projectId));
      if (film) setSelectedFilm(film);
      return;
    }
    if (card.stage === 'scheduled') {
      setSelectedScheduledId(card.projectId);
      return;
    }
    if (card.isFocused) {
      const draft = asPlayerDraft(findProject(state.projects, card.projectId));
      if (draft) dispatch({ type: 'GO_TO_STEP', step: currentWizardStepFor(draft) });
      return;
    }
    if (!somethingElseFocused) {
      dispatch({ type: 'RESUME_PROJECT', projectId: card.projectId });
    }
  }

  return (
    <div className="stack">
      {selectedFilm && <FilmDetailModal film={selectedFilm} onClose={() => setSelectedFilm(null)} />}
      {scheduledCard && <ScheduledProjectModal card={scheduledCard} onClose={() => setSelectedScheduledId(null)} />}

      <h1 style={{ margin: 0 }}>Projects</h1>

      {cards.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0 }}>Nothing in development yet - start from the Asset Library or Opportunity Market.</p>
        </div>
      ) : (
        grouped.map(({ stage, cards: stageCards }) => (
          <div className="stack" key={stage} style={{ gap: 8 }}>
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>{STAGE_LABELS[stage]}</h2>
              <span className={`badge badge-stage-${STAGE_CLASS[stage]}`}>{stageCards.length}</span>
            </div>
            <div className="grid grid-wide">
              {stageCards.map((card) => {
                const disabled = RESUMABLE_STAGES.has(card.stage) && somethingElseFocused && !card.isFocused;
                return (
                  <Card
                    key={card.projectId}
                    selectable
                    disabled={disabled}
                    className={`project-card-${STAGE_CLASS[card.stage]}`}
                    onClick={() => handleCardClick(card)}
                  >
                    <ProjectCardBody card={card} />
                    {disabled && (
                      <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: '0.85em' }}>
                        Finish or leave what you're currently working on before opening this one.
                      </p>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function ProjectCardBody({ card }: { card: ProjectCardData }) {
  return (
    <>
      <div className="row-between" style={{ marginBottom: 4 }}>
        <span className={`badge badge-stage-${STAGE_CLASS[card.stage]}`}>{STAGE_LABELS[card.stage]}</span>
        <span className="badge">{card.genre}</span>
      </div>
      <div className="card-title">{card.title}</div>
      <p className="card-synopsis">{card.synopsis}</p>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', margin: '4px 0' }}>
        {card.tags.map((tag) => (
          <span className="badge" key={tag}>{tag}</span>
        ))}
      </div>
      <p style={{ margin: '0 0 6px', fontSize: '0.85em', color: 'var(--text-muted)' }}>{card.genreDescription}</p>
      <div style={{ fontSize: '0.9em' }}>
        <div>Director: {card.director ?? 'Not yet hired'}</div>
        <div>Lead{card.leads.length === 1 ? '' : 's'}: {card.leads.length > 0 ? card.leads.join(', ') : 'Not yet hired'}</div>
      </div>
      <div className="card-subtitle" style={{ marginTop: 8, marginBottom: 0 }}>
        Spent so far: <Money amount={card.spendSoFar} />
      </div>

      {card.shootProgress && (
        <div style={{ marginTop: 8 }}>
          <ScoreBar
            label={`Day ${card.shootProgress.daysElapsed} of ${card.shootProgress.recommendedDays}`}
            value={(card.shootProgress.daysElapsed / Math.max(1, card.shootProgress.recommendedDays)) * 100}
          />
        </div>
      )}

      {card.scheduledReleaseDay !== null && (
        <p style={{ margin: '8px 0 0' }}>Releasing {formatGameDate(card.scheduledReleaseDay)}</p>
      )}

      {card.boxOffice && (
        <div style={{ marginTop: 8 }}>
          {card.boxOffice.running ? (
            <>
              <div>This week: <Money amount={card.boxOffice.thisWeekGross ?? 0} />{card.boxOffice.weekNumber !== null ? ` (Week ${card.boxOffice.weekNumber})` : ''}</div>
              <div>Total so far: <Money amount={card.boxOffice.cumulativeGross} /></div>
            </>
          ) : (
            <div>Total Box Office: <Money amount={card.boxOffice.finalTotal ?? card.boxOffice.cumulativeGross} /></div>
          )}
        </div>
      )}

      <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: '0.8em' }}>{STAGE_BLURBS[card.stage]}</p>
    </>
  );
}

/** Read-only summary for a locked, scheduled project - there's no editable wizard screen left to send it to (every creative decision is already made), so this is its own "relevant page" instead of a resume target. */
function ScheduledProjectModal({ card, onClose }: { card: ProjectCardData; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content stack" onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <h2 style={{ margin: 0 }}>{card.title}</h2>
          <span className={`badge badge-stage-${STAGE_CLASS[card.stage]}`}>{STAGE_LABELS[card.stage]}</span>
        </div>
        <ProjectCardBody card={card} />
        <div className="row-between">
          <span />
          <Button variant="primary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
