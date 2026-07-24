import { useStudio } from '../state/StudioContext';
import { derivePlayerMilestones } from '../state/selectors';
import { formatGameDateWithMonth } from '../engine/calendar';
import type { MilestoneCategory, StudioMilestone } from '../engine/premiereReport';
import { Money } from './common/Money';
import './MilestonesPage.css';

const CATEGORY_ORDER: MilestoneCategory[] = ['commercial', 'critical', 'audience', 'scale', 'studio'];

const CATEGORY_LABEL: Record<MilestoneCategory, string> = {
  commercial: 'Commercial',
  critical: 'Critical',
  audience: 'Audience',
  scale: 'Scale & Reach',
  studio: 'Studio',
};

/** The value a held record shows on its card - money as currency, scores as a plain figure, legs as a multiplier. */
function RecordValue({ milestone }: { milestone: StudioMilestone }) {
  if (milestone.value === null || milestone.valueKind === null) return null;
  if (milestone.valueKind === 'money') return <Money amount={milestone.value} />;
  if (milestone.valueKind === 'multiplier') return <>{milestone.value.toFixed(2)}x</>;
  return <>{Math.round(milestone.value)}</>;
}

function MilestoneCard({ milestone }: { milestone: StudioMilestone }) {
  return (
    <div className={`milestone-card ${milestone.earned ? 'milestone-card--earned' : 'milestone-card--locked'}`}>
      <span className="milestone-card__icon" aria-hidden="true">{milestone.earned ? milestone.icon : '🔒'}</span>
      <div className="milestone-card__body">
        <div className="milestone-card__label">{milestone.label}</div>
        {milestone.earned ? (
          <>
            <p className="milestone-card__meta">
              {milestone.filmTitle}
              {milestone.value !== null && (
                <> · <span className="milestone-card__value"><RecordValue milestone={milestone} /></span></>
              )}
            </p>
            {milestone.day !== null && (
              <p className="milestone-card__date">{formatGameDateWithMonth(milestone.day)}</p>
            )}
          </>
        ) : (
          <p className="milestone-card__meta">{milestone.description}</p>
        )}
      </div>
    </div>
  );
}

/**
 * The studio's milestones and records over its whole career - the standing
 * record behind the celebratory banner on the Premiere screen. Every milestone
 * in the catalog (engine/premiereReport.ts:MILESTONES) is shown, earned or
 * locked; an earned one names the film that holds it. Purely derived from the
 * studio's released films (state/selectors.ts:derivePlayerMilestones), never
 * stored - a Dashboard detour, the same shape as the IP Library / Talent
 * Database screens; the global Header handles getting back.
 */
export function MilestonesPage() {
  const { state } = useStudio();
  const milestones = derivePlayerMilestones(state);
  const earnedCount = milestones.filter((m) => m.earned).length;

  const byCategory = CATEGORY_ORDER.map((category) => ({
    category,
    items: milestones.filter((m) => m.category === category),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="stack milestones-page">
      <div>
        <h1 style={{ margin: 0 }}>Milestones</h1>
        <p className="milestones-summary">
          {earnedCount} of {milestones.length} earned
          {earnedCount === 0 && ' — release films to start setting records'}
        </p>
      </div>

      {byCategory.map((group) => (
        <section className="card stack" key={group.category}>
          <h2 style={{ margin: 0 }}>{CATEGORY_LABEL[group.category]}</h2>
          <div className="milestones-grid">
            {group.items.map((milestone) => (
              <MilestoneCard key={milestone.id} milestone={milestone} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
