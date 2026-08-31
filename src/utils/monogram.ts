/**
 * The two monogram rules - initials standing in for art the game does not have.
 *
 * Both exist because per-item artwork is arithmetic rather than budget: ~2,500
 * generated people and an unbounded number of generated film titles. They live
 * together because they are one idea with two different definitions of "the
 * words that count", and keeping them apart is how the second one quietly
 * stops matching the first.
 */

/** Up to two initials from a film title, skipping the articles titles start with. */
export function titleMonogram(title: string): string {
  const words = title.split(/\s+/).filter((w) => w && !/^(the|a|an|of|and)$/i.test(w));
  // A star rather than nothing: an untitled draft, or one called only "The",
  // leaves no initials, and a blank poster reads as a rendering fault.
  return words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '★';
}

/** Up to two initials from a person's name, skipping a middle initial. */
export function personMonogram(name: string): string {
  const words = name.split(/\s+/).filter((w) => /[A-Za-z]/.test(w));
  const initials = words
    // "Hershel B. Lattimore" reads HL, not HB - the generated roster is full of
    // these, so treating the middle initial as a name would be the common case.
    .filter((w) => !/^[A-Za-z]\.$/.test(w))
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  // A blank plate reads as a rendering fault, so fall back to whatever the name
  // does start with, and to a neutral mark if it starts with nothing.
  return initials || name.trim()[0]?.toUpperCase() || '·';
}
