import { useState } from 'react';
import { useStudio } from '../../state/StudioContext';
import { deriveFocusedDraft } from '../../state/selectors';
import { deriveProjectReadiness } from '../../engine/projectReadiness';
import {
  deriveProductionSheet,
  deskRead,
  readFilledSlot,
  readOpenSlot,
  type SheetSlot,
} from '../../engine/productionSheet';
import { formatGameDateWithMonth } from '../../engine/calendar';
import { Money } from '../common/Money';
import { PackageReadinessMeter } from './PackageReadinessMeter';
import type { ProductionRole } from '../../types';

/**
 * The production sheet: every slot on this package, visible at once.
 *
 * The form is the map and the drawers are the depth. Clicking a slot goes to
 * wherever that decision is actually made, and for a person it opens that
 * role's drawer directly rather than dropping the player on a section to hunt
 * for the row they just clicked.
 *
 * The relationship lens is take 06's idea in the form's own language. That
 * take drew the package as index cards joined by coloured thread; on a
 * document, threads are ornament on a data surface, which the art direction
 * rules out. What survives is the half that was actually load-bearing - "a
 * tension report reads the web in words" - as a toggle that turns every row
 * from *who is in it* to *how they sit with everybody else attached*.
 *
 * What it deliberately is NOT: the film's whole life. Production,
 * post-production and marketing are a chronology - a film cannot be marketed
 * before it is shot - and no layout flattens causality. This sheet is the
 * *package*, and it stops at greenlight.
 */
export function ProductionSheet() {
  const { state, dispatch } = useStudio();
  const [lens, setLens] = useState(false);
  const draft = deriveFocusedDraft(state);
  if (!draft) return null;

  const groups = deriveProductionSheet(draft);
  const readiness = deriveProjectReadiness(draft, state.studio.cash);
  const pairings = state.talentPairings ?? [];

  function open(slot: SheetSlot) {
    dispatch({
      type: 'OPEN_PROJECT_WORKSPACE_SECTION',
      section: slot.section,
      roleFocus: slot.role ? { role: slot.role as ProductionRole, characterId: slot.characterId } : undefined,
    });
  }

  /** The three readings of an absence, or the one reading of a presence. */
  function readingFor(slot: SheetSlot): string | null {
    const filled = readFilledSlot(slot, draft!, pairings);
    if (filled) {
      const parts = [filled.chemistry];
      if (filled.provenPairings > 0) {
        parts.push(`${filled.provenPairings} proven pairing${filled.provenPairings === 1 ? '' : 's'} on this picture`);
      }
      return parts.filter(Boolean).join(' · ') || null;
    }

    const reading = readOpenSlot(slot, draft!, state.totalDays);
    if (!reading) return null;
    const parts: string[] = [];
    if (reading.blocks) parts.push(reading.blocks);
    if (reading.unreadablePairs > 0) {
      parts.push(`${reading.unreadablePairs} relationship${reading.unreadablePairs === 1 ? '' : 's'} unreadable`);
    }
    if (reading.offerNeededBy !== null) parts.push(`offer needed by ${formatGameDateWithMonth(reading.offerNeededBy)}`);
    return parts.join(' · ') || null;
  }

  return (
    <div className="sheet">
      <PackageReadinessMeter draft={draft} groups={groups} cash={state.studio.cash} />

      <div className="sheet-voice">
        <p className="sheet-voice__line">{deskRead(draft, groups)}</p>
        <label className="sheet-lens">
          <input type="checkbox" checked={lens} onChange={(e) => setLens(e.target.checked)} />
          Read the relationships
        </label>
      </div>

      <div className="sheet-cols">
        {([1, 2] as const).map((column) => (
          <div key={column} className="sheet-col">
            {groups.filter((g) => g.column === column).map((group) => (
              <section key={group.title} className="sheet-group">
                <h2 className="sheet-group__title">{group.title}</h2>
                <ul className="sheet-rows">
                  {group.slots.map((slot) => {
                    // The lens replaces the printed note rather than adding to
                    // it: two lines under every row is how a dense form stops
                    // being readable.
                    const reading = lens ? readingFor(slot) : null;
                    const note = lens ? reading : slot.note;
                    return (
                      <li key={slot.id}>
                        <button type="button" className={`sheet-row sheet-row--${slot.state}`} onClick={() => open(slot)}>
                          <span className="sheet-row__label">{slot.label}</span>
                          <span className={slot.occupant ? 'sheet-row__occupant typed' : 'sheet-row__occupant sheet-row__occupant--blank'}>
                            {slot.occupant ?? ''}
                          </span>
                          <span className="sheet-row__cost">{slot.cost != null && <Money amount={slot.cost} />}</span>
                          {note && <span className={lens ? 'sheet-row__note sheet-row__note--lens' : 'sheet-row__note'}>{note}</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        ))}
      </div>

      {/* The stamp. A form that is complete says so on its face - take 01's
          rubber stamp, which is the one piece of ornament the sheet allows
          itself, because it sits on the paper rather than on any figure. */}
      {readiness.ready && (
        <p className="sheet-stamp" role="status">
          Ready for greenlight
        </p>
      )}
    </div>
  );
}
