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
export function StatGroup({ title, stats }: { title: string; stats: Array<{ label: string; value: number }> }) {
  return (
    <div>
      <div className="stat-group-title">{title}</div>
      {stats.map(({ label, value }) => (
        <div className="row-between" key={label} style={{ fontSize: '0.85em' }}>
          <span>{label}</span>
          <StarRating value={value} />
        </div>
      ))}
    </div>
  );
}
