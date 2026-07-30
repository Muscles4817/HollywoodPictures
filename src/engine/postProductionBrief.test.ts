// Post-production creative brief (docs/DESIGN_production_requirements_model.md —
// Revision 2). This slice is behaviour-preserving: the accessors return exactly
// the deltas scoring.ts computed inline before, so the tests below pin each to
// the raw profile arithmetic. When the cutover replaces the flat deltas with
// person-driven realisation, these byte-identity tests are the ones that change.
import { describe, it, expect } from 'vitest';
import {
  briefFromChoices,
  briefQualityContribution,
  briefCriticEditScore,
  briefAudienceEditScore,
  briefBuzzContribution,
  describeBriefIntent,
} from './postProductionBrief';
import { EDIT_STYLE_PROFILES, MUSIC_FOCUS_PROFILES, FINAL_CUT_FOCUS_PROFILES } from '../data/postProduction';
import type { EditStyle, MusicFocus, FinalCutFocus, PostProductionChoices } from '../types';

// The old inline reads clamped the critic/audience terms to [0,100]; the
// accessors preserve that, so the expected values must clamp too.
const clamp100 = (n: number) => Math.max(0, Math.min(100, n));

const EDITS: EditStyle[] = ['Commercial', 'Artistic', 'Balanced'];
const SCORES: MusicFocus[] = ['Minimal', 'Standard', 'Heavy'];
const FINALS: FinalCutFocus[] = ['Trailer-focused', 'Critic-focused', 'Star-focused', 'Mystery-focused'];

const choices = (over: Partial<PostProductionChoices> = {}): PostProductionChoices => ({
  editStyle: 'Balanced', musicFocus: 'Standard', finalCutFocus: 'Trailer-focused', ...over,
});

describe('briefFromChoices', () => {
  it('reads the intent out of the persisted menu fields', () => {
    const brief = briefFromChoices(choices({ musicFocus: 'Heavy', editStyle: 'Artistic', finalCutFocus: 'Mystery-focused' }));
    expect(brief).toEqual({ score: 'Heavy', edit: 'Artistic', finalCut: 'Mystery-focused' });
  });
});

describe('the brief accessors are byte-identical to the old inline reads', () => {
  it('quality contribution == music qualityDelta + balanced bonus, for every combination', () => {
    for (const score of SCORES) {
      for (const edit of EDITS) {
        const brief = briefFromChoices(choices({ musicFocus: score, editStyle: edit }));
        const expected = MUSIC_FOCUS_PROFILES[score].qualityDelta + (edit === 'Balanced' ? 5 : 0);
        expect(briefQualityContribution(brief)).toBe(expected);
      }
    }
  });

  it('critic-edit score == 50 + editStyle criticDelta * 5', () => {
    for (const edit of EDITS) {
      const brief = briefFromChoices(choices({ editStyle: edit }));
      expect(briefCriticEditScore(brief)).toBe(clamp100(50 + EDIT_STYLE_PROFILES[edit].criticDelta * 5));
    }
  });

  it('audience-edit score == 50 + editStyle audienceDelta*5 + finalCut audienceDelta*5', () => {
    for (const edit of EDITS) {
      for (const finalCut of FINALS) {
        const brief = briefFromChoices(choices({ editStyle: edit, finalCutFocus: finalCut }));
        const expected = clamp100(50 + EDIT_STYLE_PROFILES[edit].audienceDelta * 5 + FINAL_CUT_FOCUS_PROFILES[finalCut].audienceDelta * 5);
        expect(briefAudienceEditScore(brief)).toBe(expected);
      }
    }
  });

  it('buzz contribution == music buzzDelta + finalCut buzzDelta', () => {
    for (const score of SCORES) {
      for (const finalCut of FINALS) {
        const brief = briefFromChoices(choices({ musicFocus: score, finalCutFocus: finalCut }));
        expect(briefBuzzContribution(brief)).toBe(MUSIC_FOCUS_PROFILES[score].buzzDelta + FINAL_CUT_FOCUS_PROFILES[finalCut].buzzDelta);
      }
    }
  });
});

describe('describeBriefIntent', () => {
  it('renders qualitative intent prose with no digits', () => {
    const intent = describeBriefIntent(briefFromChoices(choices({ musicFocus: 'Heavy', editStyle: 'Commercial', finalCutFocus: 'Mystery-focused' })));
    expect(intent.score).toMatch(/bold/i);
    expect(intent.edit).toMatch(/crowd-pleasing/i);
    expect(intent.finalCut).toMatch(/give nothing away/i);
    for (const line of Object.values(intent)) expect(line).not.toMatch(/[0-9]/);
  });
});
