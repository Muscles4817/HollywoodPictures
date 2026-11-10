// Craft-facet routing must survive the bank defaults (data/eventImpactRouting.ts).
import { describe, it, expect } from 'vitest';
import { craftFacetForEventId } from './eventImpactRouting';
import { GENRE_EVENT_TEMPLATES, RISK_DIMENSION_EVENT_TEMPLATES } from './productionEvents';
import { classifyEventImpact } from '../engine/productionExecution';

const allBankTemplates = [
  ...Object.values(GENRE_EVENT_TEMPLATES).flat(),
  ...Object.values(RISK_DIMENSION_EVENT_TEMPLATES).flatMap((b) => [...b.positive, ...b.negative]),
];

describe('craft-facet event routing', () => {
  it('names the facet an event is about, and nothing for an unrelated id', () => {
    expect(craftFacetForEventId('genre-scifi-neg-vfx-redo')).toBe('vfx');
    expect(craftFacetForEventId('genre-action-neg-squib-misfire')).toBe('practical');
    expect(craftFacetForEventId('neg-onset-tension')).toBeUndefined();
  });

  it('a bank default never pre-empts it: every facet-keyword template in the genre and risk banks reaches its facet', () => {
    const facetTemplates = allBankTemplates.filter((t) => craftFacetForEventId(t.id) !== undefined);
    // The banks really do contain effects events - this test would be vacuous otherwise.
    expect(facetTemplates.filter((t) => classifyEventImpact(t) === 'vfx').length).toBeGreaterThan(0);
    expect(facetTemplates.filter((t) => classifyEventImpact(t) === 'practical').length).toBeGreaterThan(0);
    for (const t of facetTemplates) {
      expect(classifyEventImpact(t), t.id).toBe(craftFacetForEventId(t.id));
    }
  });
});
