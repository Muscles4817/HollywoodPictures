import './GenrePoster.css';

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

/** Up to two initials from the title, skipping the articles a title starts with. */
function titleMonogram(title: string): string {
  const words = title.split(/\s+/).filter((w) => w && !/^(the|a|an|of|and)$/i.test(w));
  return words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

export function GenrePoster({ title, genre, size = 'regular' }: { title: string; genre: string; size?: 'regular' | 'large' }) {
  return (
    <div
      className={size === 'large' ? 'genre-poster genre-poster--large' : 'genre-poster'}
      data-genre={genrePosterSlug(genre)}
      aria-hidden="true"
    >
      <span className="genre-poster__mono">{titleMonogram(title)}</span>
      <span className="genre-poster__genre">{genre}</span>
    </div>
  );
}
