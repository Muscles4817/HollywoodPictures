import { useStudio } from '../state/StudioContext';
import { unacknowledgedAwardHighlights } from '../state/selectors';
import { Money } from './common/Money';

/**
 * Awards night - the SPECTACLE band on the Awards page
 * (docs/ART_DIRECTION.md §2.2).
 *
 * The register is a moment, not a screen: everything else on this page is
 * campaign management and a permanent record, both of which are surfaces the
 * player reads figures off. What is genuinely an *event* is a ceremony that
 * has just happened and that they have not seen yet - so the band appears
 * only then, and dismissing it returns the page to the desk.
 *
 * Its one neon is red, for the carpet; the gold bulb run along the frame is
 * the register's shared furniture rather than a second accent.
 *
 * Acknowledging is what stops the spine's attention badge counting it, so
 * this doubles as the "act on it in one click and have the message stop" half
 * of the notification contract (docs/DESIGN_notification_contract.md).
 */
export function AwardsNight() {
  const { state, dispatch } = useStudio();
  const highlights = unacknowledgedAwardHighlights(state);
  if (highlights.length === 0) return null;

  // The most recent ceremony is the event; any older unacknowledged one is
  // dismissed alongside it rather than queueing a second red carpet.
  const latest = [...highlights].sort((a, b) => b.day - a.day)[0];
  const { showName, year, wins, nominations, payout, prestigeDelta, brandDelta } = latest;

  return (
    <section className="spectacle awards-night" aria-label={`${showName} results`}>
      <div className="spectacle-wrap">
        <p className="spectacle-eyebrow">Awards Night · Year {year}</p>
        <h2 className="spectacle-title">{showName}</h2>
        <p className="spectacle-sub">
          {wins > 0
            ? `${wins} win${wins === 1 ? '' : 's'} from ${nominations} nomination${nominations === 1 ? '' : 's'}`
            : nominations > 0
              ? `${nominations} nomination${nominations === 1 ? '' : 's'}, no wins`
              : 'Nothing this year'}
        </p>

        <div className="spectacle-figures">
          <div className="spectacle-figure">
            <span className="spectacle-figure__value">{wins}</span>
            <span className="spectacle-figure__label">Wins</span>
          </div>
          <div className="spectacle-figure">
            <span className="spectacle-figure__value">{nominations}</span>
            <span className="spectacle-figure__label">Nominations</span>
          </div>
          <div className="spectacle-figure">
            <span className="spectacle-figure__value"><Money amount={payout} /></span>
            <span className="spectacle-figure__label">Prize money</span>
          </div>
          <div className="spectacle-figure">
            <span className="spectacle-figure__value">
              {prestigeDelta >= 0 ? '+' : ''}{Math.round(prestigeDelta)}
            </span>
            <span className="spectacle-figure__label">Prestige</span>
          </div>
          <div className="spectacle-figure">
            <span className="spectacle-figure__value">
              {brandDelta >= 0 ? '+' : ''}{Math.round(brandDelta)}
            </span>
            <span className="spectacle-figure__label">Brand</span>
          </div>
        </div>

        <button
          type="button"
          className="spectacle-exit"
          onClick={() => highlights.forEach((h) => dispatch({ type: 'ACKNOWLEDGE_AWARD_CEREMONY', ceremonyId: h.id }))}
        >
          Back to the desk
        </button>
      </div>
    </section>
  );
}
