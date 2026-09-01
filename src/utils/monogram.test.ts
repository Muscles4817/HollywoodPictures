import { describe, it, expect } from 'vitest';
import { personMonogram, titleMonogram } from './monogram';

describe('personMonogram', () => {
  it('takes the first two names', () => {
    expect(personMonogram('Thea Penhale')).toBe('TP');
    expect(personMonogram('Zebulon Applegate Quennell')).toBe('ZA');
  });

  it('skips a middle initial, which is punctuation rather than a name', () => {
    // "Hershel B. Lattimore" should read HL, not HB - the generated roster is
    // full of these, so getting it wrong would be the common case.
    expect(personMonogram('Hershel B. Lattimore')).toBe('HL');
    expect(personMonogram('Sudie A. Waddell-Thackery')).toBe('SW');
  });

  it('handles a single name', () => {
    expect(personMonogram('Cher')).toBe('C');
  });

  it('never comes back blank, because an empty plate reads as a broken image', () => {
    expect(personMonogram('')).toBe('·');
    expect(personMonogram('   ')).toBe('·');
    // A name with no Latin letters still has to put something in the frame.
    expect(personMonogram('小津')).toBe('小');
  });
});

describe('titleMonogram', () => {
  it('skips the articles a title starts with', () => {
    expect(titleMonogram('The Ambush of the Fallen')).toBe('AF');
    expect(titleMonogram('Ash and Dust')).toBe('AD');
  });

  it('falls back to a star rather than a blank poster', () => {
    expect(titleMonogram('The')).toBe('★');
    expect(titleMonogram('')).toBe('★');
  });
});
