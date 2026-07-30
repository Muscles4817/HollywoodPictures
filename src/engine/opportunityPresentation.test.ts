import { describe, it, expect } from 'vitest';
import { describeOpportunityProvenance } from './opportunityPresentation';

describe('describeOpportunityProvenance', () => {
  it('tells each source\'s story, crediting the writer when known', () => {
    expect(describeOpportunityProvenance('Spec Screenplay', { writerName: 'Jane Doe' })).toContain('Written on spec by Jane Doe');
    expect(describeOpportunityProvenance('Agent Package', { writerName: 'Jane Doe' })).toContain("Jane Doe's representation");
    expect(describeOpportunityProvenance('Publisher Rights', { writerName: 'Jane Doe' })).toContain('established property');
  });

  it('reads the source\'s generation profile back to the player (raw spec vs developed package)', () => {
    expect(describeOpportunityProvenance('Spec Screenplay', {})).toContain('raw draft');
    expect(describeOpportunityProvenance('Agent Package', {})).toContain('polished');
  });

  it('falls back to a writer-free line when the author is unknown, never exposing a number', () => {
    for (const source of ['Spec Screenplay', 'Agent Package', 'Publisher Rights'] as const) {
      const line = describeOpportunityProvenance(source, {});
      expect(line.length).toBeGreaterThan(0);
      expect(line).not.toMatch(/\d/);
    }
  });
});
