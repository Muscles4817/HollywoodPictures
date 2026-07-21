import { useEffect, useRef, useState } from 'react';
import { StarRating } from '../common/StarRating';
import { Money } from '../common/Money';
import type { ReviewQuote } from '../../types';
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

/**
 * The "premiere" moment a film debuts - critic and audience reception
 * arriving as two distinct voices (3 quotes each, engine/reviews.ts:
 * pickScoredReviews), settling into the real aggregate scores, then the
 * opening weekend gross, staggered one beat at a time rather than dumped on
 * screen at once. Sits at the top of ReleaseResults.tsx; everything below it
 * (Box Office/Department Breakdown/Studio Report/Brand-Prestige) is
 * unaffected and already visible regardless of how far this has revealed.
 * Plays once per film - this screen is only ever reached once, immediately
 * after SCHEDULE_RELEASE (see WizardSteps.tsx/deriveReachableWizardSteps).
 * Skip jumps straight to the fully-revealed state for anyone who doesn't
 * want to sit through it every release; prefers-reduced-motion gets the
 * same treatment automatically, no staggering at all.
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
  // Interleaved (critic[0], audience[0], critic[1], audience[1], ...) so the
  // two columns visibly build down together rather than one column finishing
  // before the other starts. Steps: 1 title beat, then one beat per quote,
  // then the aggregate tally, then the opening weekend figure.
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
    <div className="premiere-reveal card">
      {revealing && (
        <button type="button" className="premiere-reveal__skip" onClick={() => setStep(totalSteps)}>
          Skip
        </button>
      )}

      <div className={itemClass(1)}>
        <h1 style={{ margin: 0 }}>{title}</h1>
        <p className="premiere-reveal__subtitle">
          {genre} &middot; Opening Weekend
          {outcome && (
            <span className={`badge badge-outcome-${outcome.replace(/\s+/g, '-')}`} style={{ marginLeft: 8 }}>
              {outcome}
            </span>
          )}
        </p>
      </div>

      <div className="premiere-reveal__columns">
        <div className="premiere-reveal__column">
          <h3>Critics</h3>
          {criticReviews.map((quote, i) => (
            <div key={i} className={`premiere-reveal__quote ${itemClass(2 + i * 2)}`}>
              <StarRating value={quote.score} />
              <p>&ldquo;{quote.text}&rdquo;</p>
            </div>
          ))}
        </div>
        <div className="premiere-reveal__column">
          <h3>Audiences</h3>
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

      <div className={`premiere-reveal__boxoffice ${itemClass(boxOfficeStep)}`}>
        <div className="stat-label">Opening Weekend</div>
        <div className="stat-value"><Money amount={openingWeekend} /></div>
      </div>
    </div>
  );
}
