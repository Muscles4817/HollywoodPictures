// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GenrePoster } from './GenrePoster';

describe('GenrePoster', () => {
  it('credits the releasing studio on the sheet', () => {
    // The one thing the key art never said was whose picture it is - see
    // ART_DIRECTION §12's logo question, which this is the evidence for.
    render(<GenrePoster title="Wolcott's Warzone" genre="Action" studio="Silver Reel Pictures" />);
    expect(screen.getByText('Silver Reel Pictures')).toBeInTheDocument();
  });

  it('prints no credit line at all when there is no studio to credit', () => {
    const { container } = render(<GenrePoster title="Wolcott's Warzone" genre="Action" />);
    expect(container.querySelector('.genre-poster__studio')).toBeNull();
    // An empty credit box would still reserve its two lines and push the
    // monogram down for nothing.
    expect(container.querySelector('.genre-poster__mono')?.textContent).toBe('WW');
  });
});
