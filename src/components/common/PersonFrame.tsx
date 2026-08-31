import './PersonFrame.css';
import { personMonogram } from '../../utils/monogram';
import type { Person } from '../../types';

/**
 * The frame a portrait would sit in, with no portrait in it.
 *
 * The roster runs to ~2,500 generated people, so per-person art is not a budget
 * question, it is arithmetic: there is no version of this game that draws them.
 * docs/ART_DIRECTION.md §9.1 ranks the ways out and puts framing devices first;
 * this is the argument for that ranking on this game's own terms, since §9.1 is
 * still PROPOSED and a ranked list is not a decision.
 *
 * The game is a desk in the American blockbuster era, and the object a casting
 * desk actually holds is an agency 8x10 - hard border, ground, a name strip
 * along the bottom. Borrowing that shape costs a border and a letter, and it
 * makes the missing face read as a filing convention rather than as an image
 * that failed to load. A silhouette would not: a silhouette is a claim about a
 * face, and the game does not have one to make.
 *
 * So this is honestly a card and not a person. The monogram carries no
 * information the name beside it does not already carry, and it is not trying
 * to - its job is to give a page about someone an object to open with, instead
 * of a heading and then bars. That is worth being plain about rather than
 * dressing up as a data encoding.
 *
 * Deliberately NOT on the Talent Database's list rows. That screen is a
 * scanning table of 60 rows; a 44px plate on each one buys an anchor nobody
 * needs when the name is already the leftmost column, and costs the row height
 * that makes the table scannable at all.
 */

export function PersonFrame({ person, size = 'regular' }: { person: Person; size?: 'regular' | 'large' }) {
  return (
    <div className={size === 'large' ? 'person-frame person-frame--large' : 'person-frame'}>
      <span className="person-frame__mono" aria-hidden="true">{personMonogram(person.identity.name)}</span>
      {/* The agency 8x10's name strip. It carries the trade rather than the
          name, because the name is always already beside it and the strip is
          the one place on the card with room for the other half of "who is
          this". */}
      <span className="person-frame__slug">{person.primaryRole}</span>
    </div>
  );
}
