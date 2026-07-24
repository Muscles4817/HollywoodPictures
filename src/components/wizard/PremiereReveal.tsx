import { useEffect, useRef, useState } from 'react';
import { StarRating } from '../common/StarRating';
import { Money } from '../common/Money';
import { deriveVerdict } from '../../engine/premiereReport';
import type { OutcomeLabel, ReviewQuote } from '../../types';
import './PremiereReveal.css';

interface PremiereRevealProps {
  title: string;
  genre: string;
  outcome: string | null;
  criticScore: number;
  audienceScore: number;
  criticReviews: ReviewQuote[];
  audienceReviews: ReviewQuote[];
  openingWeekend: number;
}

const STEP_DELAY_MS = 350;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/** Slug for the genre-tinted poster gradient (see PremiereReveal.css [data-genre]). */
function genreSlug(genre: string): string {
  return genre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z-]/g, '');
}

/** Initials for the poster's decorative monogram - the first letter of the first two words. */
function monogram(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '★';
  const letters = (words.length === 1 ? [words[0]] : [words[0], words[1]]).map((w) => w[0]?.toUpperCase() ?? '');
  return letters.join('');
}

/**
 * The "premiere" moment a film debuts - the cinematic climax of making it.
 * A genre-tinted poster and the film's overall verdict anchor the top; the
 * critic and audience reception then arrive as two distinct voices (3 quotes
 * each, engine/reviews.ts:pickScoredReviews), settling into the real aggregate
 * scores, and finally the opening weekend gross lands as the single largest
 * figure on the page - the payoff beat. Everything is staggered one beat at a
 * time rather than dumped on screen at once.
 *
 * Sits at the top of ReleaseResults.tsx; everything below it (box office,
 * reception, studio impact, dev panel) is unaffected and already visible
 * regardless of how far this has revealed. Plays once per film - this screen
 * is only ever reached once, immediately after SCHEDULE_RELEASE (see
 * WizardSteps.tsx/deriveReachableWizardSteps). Skip jumps straight to the
 * fully-revealed state for anyone who doesn't want to sit through it every
 * release; prefers-reduced-motion gets the same treatment automatically.
 */
export function PremiereReveal({
  title,
  genre,
  outcome,
  criticScore,
  audienceScore,
  criticReviews,
  audienceReviews,
  openingWeekend,
}: PremiereRevealProps) {
  const verdict = deriveVerdict((outcome as OutcomeLabel | null) ?? null);

  // Interleaved (critic[0], audience[0], critic[1], audience[1], ...) so the
  // two columns visibly build down together rather than one column finishing
  // before the other starts. Steps: 1 title/poster beat, then one beat per
  // quote, then the aggregate tally, then the opening weekend figure.
  const quoteRounds = Math.max(criticReviews.length, audienceReviews.length);
  const totalSteps = 1 + quoteRounds * 2 + 1 + 1;
  const tallyStep = totalSteps - 1;
  const boxOfficeStep = totalSteps;

  const [step, setStep] = useState(() => (prefersReducedMotion() ? totalSteps : 0));

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (step >= totalSteps) return;
    timerRef.current = setTimeout(() => setStep((s) => s + 1), STEP_DELAY_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [step, totalSteps]);

  const revealing = step < totalSteps;
  const shown = (atStep: number) => step >= atStep;
  const itemClass = (atStep: number) => `premiere-reveal__item ${shown(atStep) ? 'premiere-reveal__item--in' : ''}`;

  return (
    <div className={`premiere-reveal card premiere-reveal--${verdict.tone}`}>
      {revealing && (
        <button type="button" className="premiere-reveal__skip" onClick={() => setStep(totalSteps)}>
          Skip
        </button>
      )}

      <div className={`premiere-hero ${itemClass(1)}`}>
        <div className="premiere-poster" data-genre={genreSlug(genre)} aria-hidden="true">
          <span className="premiere-poster__mono">{monogram(title)}</span>
          <span className="premiere-poster__genre">{genre}</span>
        </div>
        <div className="premiere-hero__headline">
          <p className="premiere-hero__eyebrow">Now Playing &middot; {genre}</p>
          <h1 className="premiere-hero__title">{title}</h1>
          <div className="premiere-hero__verdict">
            {outcome && (
              <span className={`badge badge-outcome-${outcome.replace(/\s+/g, '-')}`}>{outcome}</span>
            )}
            <span className="premiere-hero__verdict-line">{verdict.headline}</span>
          </div>
        </div>
      </div>

      <div className="premiere-reveal__columns">
        <div className="premiere-reveal__column">
          <h3>What the Critics Said</h3>
          {criticReviews.map((quote, i) => (
            <div key={i} className={`premiere-reveal__quote ${itemClass(2 + i * 2)}`}>
              <StarRating value={quote.score} />
              <p>&ldquo;{quote.text}&rdquo;</p>
            </div>
          ))}
        </div>
        <div className="premiere-reveal__column">
          <h3>What Audiences Said</h3>
          {audienceReviews.map((quote, i) => (
            <div key={i} className={`premiere-reveal__quote ${itemClass(3 + i * 2)}`}>
              <StarRating value={quote.score} />
              <p>&ldquo;{quote.text}&rdquo;</p>
            </div>
          ))}
        </div>
      </div>

      <div className={`premiere-reveal__tally ${itemClass(tallyStep)}`}>
        <div>
          <div className="stat-label">Critic Score</div>
          <StarRating value={criticScore} />
        </div>
        <div>
          <div className="stat-label">Audience Score</div>
          <StarRating value={audienceScore} />
        </div>
      </div>

      <div className={`premiere-hero__boxoffice ${itemClass(boxOfficeStep)}`}>
        <div className="stat-label">Opening Weekend</div>
        <div className="premiere-hero__boxoffice-value"><Money amount={openingWeekend} /></div>
      </div>
    </div>
  );
}
