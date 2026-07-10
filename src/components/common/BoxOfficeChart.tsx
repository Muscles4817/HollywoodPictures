import { formatMoney } from './Money';
import type { BoxOfficeWeek } from '../../types';

const CHART_HEIGHT_PX = 120;

/** Simple bar chart of a film's weekly box office gross - no charting library, just divs sized by their own max. */
export function BoxOfficeChart({ weeks }: { weeks: BoxOfficeWeek[] }) {
  if (weeks.length === 0) return null;
  const maxGross = Math.max(...weeks.map((w) => w.gross), 1);

  return (
    <div className="box-office-chart">
      {weeks.map((w) => (
        <div className="box-office-chart-bar-col" key={w.week} title={`Week ${w.week}: ${formatMoney(w.gross)}`}>
          <div
            className="box-office-chart-bar"
            style={{ height: `${Math.max(2, (w.gross / maxGross) * CHART_HEIGHT_PX)}px` }}
          />
          <span className="box-office-chart-label">W{w.week}</span>
        </div>
      ))}
    </div>
  );
}
