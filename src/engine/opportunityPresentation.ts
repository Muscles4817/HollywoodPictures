// The market generates stories, not numbers (docs/DESIGN_REVIEW_acquisition_
// provenance_and_pipeline.md). Every opportunity carries a one-line provenance -
// WHY this screenplay exists and why it's on the market - so the player can read
// the reason behind its price, its rough-or-polished draft, and its upside
// without a single raw stat. Derived on demand from the source + participants,
// never stored, the same "derive, don't store" principle as commercialProfile.
import type { MarketSource } from '../types';

/**
 * A number-free provenance line for an Opportunity, keyed on its market source.
 * The wording mirrors what the source's generation profile actually produced
 * (engine/opportunities.ts): a Spec is a raw draft shopped on concept; an Agent
 * Package is a developed, ready-to-shoot unit; Publisher Rights is a proven
 * property. `writerName` is the credited author when known.
 */
export function describeOpportunityProvenance(source: MarketSource, opts: { writerName?: string }): string {
  const { writerName } = opts;
  switch (source) {
    case 'Spec Screenplay':
      return writerName
        ? `Written on spec by ${writerName}, no talent attached — a raw draft shopped on the strength of its concept.`
        : `An unrepresented spec — a raw draft shopped on the strength of its concept.`;
    case 'Agent Package':
      return writerName
        ? `Packaged by ${writerName}'s representation and shopped as a developed, ready-to-shoot unit.`
        : `An agency package — a developed, professionally polished unit.`;
    case 'Publisher Rights':
      return writerName
        ? `Adaptation of an established property, drafted by ${writerName} — a proven concept looking for a studio.`
        : `Adaptation rights to an established property — a proven concept looking for a studio.`;
  }
}
