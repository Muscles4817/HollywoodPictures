import { summariseSheet, type SheetGroup } from '../../engine/productionSheet';
import { deriveProjectReadiness } from '../../engine/projectReadiness';
import type { FilmDraft } from '../../types';

/**
 * Distance-to-done, at a glance - the sheet's headline.
 *
 * Status, not category: "set" is neutral because done needs no colour, the one
 * attention hue is reserved for what is open, and "not required" is hatched so
 * identity never rests on hue alone. The reading underneath says the same thing
 * in words, because a bar alone cannot say *what* is missing.
 */
export function PackageReadinessMeter({ draft, groups, cash }: { draft: FilmDraft; groups: SheetGroup[]; cash: number }) {
  const { set, open, optional, total } = summariseSheet(groups);
  const readiness = deriveProjectReadiness(draft, cash);

  const reading = open === 0
    ? readiness.ready
      ? 'Everything this package needs is in place.'
      : 'Every slot is filled — the remaining blockers are money, not people.'
    : `${open} slot${open === 1 ? '' : 's'} still open.`;

  return (
    <section className="sheet-meter" aria-label="Package readiness">
      <div className="sheet-meter__top">
        <h2 className="sheet-meter__title">Package readiness</h2>
        <p className="sheet-meter__read">
          <b>{set}</b> of {total} set · {reading}
        </p>
      </div>

      <div className="sheet-meter__bar" role="img" aria-label={`${set} set, ${open} open, ${optional} not required`}>
        {Array.from({ length: set }, (_, i) => <span key={`s${i}`} className="seg seg--set" />)}
        {Array.from({ length: open }, (_, i) => <span key={`o${i}`} className="seg seg--open" />)}
        {Array.from({ length: optional }, (_, i) => <span key={`p${i}`} className="seg seg--opt" />)}
      </div>

      <ul className="sheet-meter__key">
        <li><span className="seg seg--set" aria-hidden="true" /> Set</li>
        <li><span className="seg seg--open" aria-hidden="true" /> Open</li>
        <li><span className="seg seg--opt" aria-hidden="true" /> Not required</li>
      </ul>

      {readiness.blockers.length > 0 && (
        <p className="sheet-meter__blockers">
          {readiness.blockers.map((b) => b.message).join(' · ')}
        </p>
      )}
    </section>
  );
}
