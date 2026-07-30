// Trait-driven on-set events (data/productionEvents.ts:TRAIT_EVENT_TEMPLATES):
// an event is only eligible when the cast actually carries the derived trait,
// and an interactive one names a person the trait genuinely fits.
import { describe, it, expect } from 'vitest';
import { eligibleTraitTemplates, pickShootEvent, type FullProductionRisk } from './production';
import { deriveTraits } from './personTraits';
import { createRng } from './random';
import type { Person, PersonPersonality, PersonReputation, ProductionRole, TalentAssignment } from '../types';

function person(id: string, over: { personality?: Partial<PersonPersonality>; reputation?: Partial<PersonReputation> } = {}): Person {
  return {
    id,
    identity: { name: id, appearanceTags: [] },
    personality: { professionalism: 50, ambition: 50, loyalty: 50, ego: 50, temperament: 50, pressureHandling: 50, controversy: 50, adaptability: 50, ...over.personality },
    reputation: { fame: 50, prestige: 50, industryRespect: 50, reliability: 50, currentHeat: 50, ...over.reputation },
    availability: { commitments: [] },
    traits: [],
    primaryRole: 'Actor',
    careers: {},
  };
}

// A big ego + short fuse reads as DifficultToWorkWith (engine/personTraits.ts).
const DIFFICULT = { personality: { ego: 92, temperament: 18 } };
// Respected, loyal, low ego reads as Mentor.
const MENTOR = { personality: { ego: 18, loyalty: 82 }, reputation: { industryRespect: 90 } };

function assign(role: ProductionRole, p: Person): TalentAssignment {
  return { role, person: p };
}

describe('trait-event eligibility gating', () => {
  it('a Difficult lead makes the trailer-standoff eligible; an agreeable one does not', () => {
    const withDifficult = [assign('Director', person('dir')), assign('Lead Actor', person('star', DIFFICULT))];
    const withoutDifficult = [assign('Director', person('dir')), assign('Lead Actor', person('star'))];
    expect(deriveTraits(person('star', DIFFICULT))).toContain('DifficultToWorkWith');
    expect(eligibleTraitTemplates(withDifficult).map((t) => t.id)).toContain('trait-difficult-trailer-standoff');
    expect(eligibleTraitTemplates(withoutDifficult).map((t) => t.id)).not.toContain('trait-difficult-trailer-standoff');
  });

  it('a simple (cast-wide) trait event is gated on anyone carrying the trait', () => {
    const withMentor = [assign('Director', person('dir')), assign('Supporting Actor', person('vet', MENTOR))];
    const withoutMentor = [assign('Director', person('dir')), assign('Supporting Actor', person('vet'))];
    expect(eligibleTraitTemplates(withMentor).map((t) => t.id)).toContain('trait-mentor-steadies-the-cast');
    expect(eligibleTraitTemplates(withoutMentor).map((t) => t.id)).not.toContain('trait-mentor-steadies-the-cast');
  });

  it('one of the new traits (ConsummateProfessional) gates its own on-set event', () => {
    // professionalism + reliability + even temper reads as ConsummateProfessional.
    const PRO = { personality: { professionalism: 92, temperament: 82, ego: 40 }, reputation: { reliability: 90 } };
    const withPro = [assign('Director', person('dir')), assign('Lead Actor', person('pro', PRO))];
    const withoutPro = [assign('Director', person('dir')), assign('Lead Actor', person('star'))];
    expect(deriveTraits(person('pro', PRO))).toContain('ConsummateProfessional');
    expect(eligibleTraitTemplates(withPro).map((t) => t.id)).toContain('trait-professional-steadies-the-day');
    expect(eligibleTraitTemplates(withoutPro).map((t) => t.id)).not.toContain('trait-professional-steadies-the-day');
  });

  it('the difficult-lead event resolves onto the actor who actually has the trait, never the agreeable one', () => {
    // Two leads: only one is Difficult. Whenever the standoff fires, it must name the Difficult one.
    const difficult = person('difficult-star', DIFFICULT);
    const easygoing = person('easygoing-star');
    const talent = [assign('Director', person('dir')), assign('Lead Actor', difficult), assign('Lead Actor', easygoing)];
    // Max negative risk so the negative pool (which holds the standoff) is favoured.
    const fullRisk: FullProductionRisk = { schedulePressure: 100, moraleRisk: 100, safetyRisk: 100, technicalComplexity: 100, budgetRisk: 100 };
    const pool = { Director: [], Actor: [], Writer: [], Cinematographer: [], Composer: [], Editor: [], 'VFX Supervisor': [], 'Casting Director': [] } as never;

    let sawStandoff = false;
    for (let s = 0; s < 200; s++) {
      const rolled = pickShootEvent(fullRisk, 100, 'Drama', new Set(), talent, null, pool, createRng(s));
      if (rolled && 'pendingChoice' in rolled && rolled.pendingChoice.templateId === 'trait-difficult-trailer-standoff') {
        sawStandoff = true;
        expect(rolled.pendingChoice.involvedTalentId).toBe(difficult.id);
      }
    }
    expect(sawStandoff).toBe(true);
  });
});
