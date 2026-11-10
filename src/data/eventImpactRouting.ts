// Which on-set events are unambiguously ABOUT a craft facet (sets, VFX,
// practical effects), by id token (docs/DESIGN_REVIEW_production_redesign.md §10).
//
// Shared by the two places that decide an event's finished-film department, so
// they can't drift apart again:
//   - data/productionEvents.ts:tagImpact, which stamps each genre / risk bank's
//     default department onto its templates, and
//   - engine/productionExecution.ts:classifyEventImpact, which infers a
//     department for an untagged event from its id.
//
// The bug this exists to prevent (docs/DESIGN_REVIEW_ambition_and_delivery.md
// §2.2): the craft-facet re-route was added as id keywords in the classifier,
// but every genre template had already been stamped with its bank's default
// ('visual' for Action / Sci-Fi / Fantasy / Horror), and a stamped impact wins.
// So no VFX or practical event ever reached its facet - a misfired squib or a
// VFX redo moved generic "visual" execution, never the effects department -
// and the facets' execution swing had nothing to swing on.
//
// Tight, collision-free tokens only - deliberately NOT bare 'set' / 'design' /
// 'stunt' / 'safety', which would catch 'setpiece' / 'sound-design' or sweep in
// the generic risk-safety / risk-technical incidents.

import type { CraftFacet } from '../types';

export const CRAFT_FACET_KEYWORDS: Record<CraftFacet, readonly string[]> = {
  sets: ['set-collapse', 'ambitious-set', 'design-breakthrough', 'worldbuilding', 'scenic', 'set-design', 'set-dressing', 'backdrop', 'production-design'],
  vfx: ['vfx', 'greenscreen', 'green-screen', 'scope-creep', 'design-ambition', 'cgi'],
  practical: ['practical', 'stunt-gag', 'stunt-reshoot', 'stunt-double', 'squib', 'rig-slow', 'signature-oner', 'double-injury', 'creature', 'prop-malfunction', 'setpiece', 'set-piece', 'animatronic', 'pyro'],
};

const FACET_ORDER: CraftFacet[] = ['sets', 'vfx', 'practical'];

/** The craft facet an event id is unambiguously about, or undefined. Checked in sets -> vfx -> practical order, matching the classifier. */
export function craftFacetForEventId(id: string): CraftFacet | undefined {
  const lower = id.toLowerCase();
  return FACET_ORDER.find((facet) => CRAFT_FACET_KEYWORDS[facet].some((k) => lower.includes(k)));
}
