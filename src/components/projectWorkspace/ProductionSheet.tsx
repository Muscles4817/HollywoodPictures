import { useStudio } from '../../state/StudioContext';
import { deriveFocusedDraft } from '../../state/selectors';
import { deriveProductionSheet, type SheetSlot } from '../../engine/productionSheet';
import { Money } from '../common/Money';
import { PackageReadinessMeter } from './PackageReadinessMeter';
import type { ProductionRole } from '../../types';

/**
 * The production sheet: every slot on this package, visible at once.
 *
 * The workspace was five tabs, and the cost was that the player could see one
 * fifth of their own film at a time - so they could not read the shape of the
 * decision, and could not see where the holes were. You had to open Cast &
 * Crew to discover you had no composer.
 *
 * The form is the map and the drawers are the depth. Clicking a slot goes to
 * wherever that decision is actually made, and for a person it opens that
 * role's drawer directly rather than dropping the player on a section to hunt
 * for the row they just clicked.
 *
 * What it deliberately is NOT: the film's whole life. Production,
 * post-production and marketing are a chronology - a film cannot be marketed
 * before it is shot - and no layout flattens causality. This sheet is the
 * *package*, and it stops at greenlight.
 */
export function ProductionSheet() {
  const { state, dispatch } = useStudio();
  const draft = deriveFocusedDraft(state);
  if (!draft) return null;

  const groups = deriveProductionSheet(draft);

  function open(slot: SheetSlot) {
    dispatch({
      type: 'OPEN_PROJECT_WORKSPACE_SECTION',
      section: slot.section,
      // Carried so Cast & Crew can open the drawer for the exact slot that was
      // clicked. Without it the sheet routes to a section and the player has
      // to find the row again, which is most of what tabs already cost them.
      roleFocus: slot.role ? { role: slot.role as ProductionRole, characterId: slot.characterId } : undefined,
    });
  }

  return (
    <div className="sheet">
      <PackageReadinessMeter draft={draft} groups={groups} cash={state.studio.cash} />

      <div className="sheet-cols">
        {([1, 2] as const).map((column) => (
          <div key={column} className="sheet-col">
            {groups.filter((g) => g.column === column).map((group) => (
          <section key={group.title} className="sheet-group">
            <h2 className="sheet-group__title">{group.title}</h2>
            <ul className="sheet-rows">
              {group.slots.map((slot) => (
                <li key={slot.id}>
                  <button type="button" className={`sheet-row sheet-row--${slot.state}`} onClick={() => open(slot)}>
                    <span className="sheet-row__label">{slot.label}</span>
                    <span className={slot.occupant ? 'sheet-row__occupant typed' : 'sheet-row__occupant sheet-row__occupant--blank'}>
                      {slot.occupant ?? ''}
                    </span>
                    <span className="sheet-row__cost">{slot.cost != null && <Money amount={slot.cost} />}</span>
                    {slot.note && <span className="sheet-row__note">{slot.note}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </section>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
