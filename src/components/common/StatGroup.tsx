import { StarRating } from './StarRating';

/**
 * One labeled group of quality attributes, each read as a star rating
 * rather than a bare number - "don't remove the underlying values, just
 * present them in a way that feels less like a spreadsheet" (docs/DESIGN.md
 * - screenplay redesign, presentation polish pass). Originally local to
 * components/wizard/DevelopFilm.tsx; extracted once
 * components/common/FilmDetailModal.tsx needed the identical Writing/
 * Creative grouping for a released film's script.
 */
import { useMemo, useState } from 'react';

type Stat = {
  label: string;
  value: number;
};

type StatGroupProps = {
  title: string;
  stats: Stat[];
  defaultOpen?: boolean;
};

export function StatGroup({
  title,
  stats,
  defaultOpen = false,
}: StatGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const average = useMemo(() => {
    if (stats.length === 0) {
      return 0;
    }

    return stats.reduce((sum, stat) => sum + stat.value, 0) / stats.length;
  }, [stats]);

  return (
    <div className="stat-group">
      <button
        type="button"
        className="stat-group-toggle"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="stat-group-title">{title}</span>

        <span className="stat-group-summary">
          {!isOpen && <StarRating value={average} />}
          <span aria-hidden="true">{isOpen ? '▴' : '▾'}</span>
        </span>
      </button>

      {isOpen && (
        <div className="stat-group-details">
          {stats.map(({ label, value }) => (
            <div
              className="row-between"
              key={label}
              style={{ fontSize: '0.85em' }}
            >
              <span>{label}</span>
              <StarRating value={value} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
