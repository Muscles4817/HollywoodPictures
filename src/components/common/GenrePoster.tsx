import './GenrePoster.css';
import { titleMonogram } from '../../utils/monogram';

/**
 * The game's one piece of key art: a generated one-sheet for a film, built
 * from its title's monogram and its genre.
 *
 * Extracted from PremiereReveal because the campaign screen wants the same
 * object - "the campaign is the poster" (docs/ART_DIRECTION.md §6) - and a
 * second hand-rolled copy would drift from the first. It is deliberately the
 * SPECTACLE register: saturated, outside the desk palette, and the one place
 * raw colour is sanctioned outside the token block.
 */
function genrePosterSlug(genre: string): string {
  return genre.toLowerCase().replace(/[^a-z]+/g, '-');
}


export function GenrePoster({ title, genre, studio, size = 'regular' }: { title: string; genre: string; studio?: string; size?: 'regular' | 'large' }) {
  return (
    <div
      className={size === 'large' ? 'genre-poster genre-poster--large' : 'genre-poster'}
      data-genre={genrePosterSlug(genre)}
      aria-hidden="true"
    >
      {/* The studio credit that sits above the title art on a one-sheet of this
          era. Without it the poster was a picture that belonged to nobody -
          the player's studio was the one thing the key art never said.

          Deliberately NOT the `.typed` register, even though the name is
          player-chosen and typed is the desk's rule for exactly that. This is
          key art: the whole object is outside the desk palette, and a courier
          studio credit on a one-sheet would be the only thing on it pretending
          to be a form. */}
      {studio && <span className="genre-poster__studio">{studio}</span>}
      <span className="genre-poster__mono">{titleMonogram(title)}</span>
      <span className="genre-poster__genre">{genre}</span>
    </div>
  );
}
