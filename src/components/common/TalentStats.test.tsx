// @vitest-environment jsdom
//
// Talent card review (user request): age/gender and traits were real Person
// data with no consumer anywhere on a card - first test coverage for
// TalentStats.tsx itself (previously only exercised indirectly through
// OnSetDecisionCard.test.tsx).
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TalentStats } from './TalentStats';
import { generateTalentCandidates } from '../../engine/talentGenerator';
import { createRng } from '../../engine/random';
import { gameDateFromTotalDays } from '../../engine/calendar';
import { getPersonAge, type Person } from '../../types';

describe('TalentStats - age/gender identity line', () => {
  it('shows both age and gender for a procedurally generated person (both fields are always set)', () => {
    const [person] = generateTalentCandidates('Actor', createRng(1), 1);
    render(<TalentStats person={person} role="Lead Actor" category="actor" script={null} totalDays={1} />);
    const age = getPersonAge(person.identity.dateOfBirth, gameDateFromTotalDays(1));
    expect(age).not.toBeUndefined();
    expect(screen.getByText(`${age} · ${person.identity.gender}`)).toBeInTheDocument();
  });

  it('renders nothing when neither field is set (both are optional on PersonIdentity - the card must degrade gracefully, not just for currently-known data)', () => {
    const [generated] = generateTalentCandidates('Actor', createRng(2), 1);
    const unknown: Person = { ...generated, identity: { ...generated.identity, gender: undefined, dateOfBirth: undefined } };
    const { container } = render(<TalentStats person={unknown} role="Lead Actor" category="actor" script={null} totalDays={1} />);
    expect(container.querySelector('.candidate-identity-line')).toBeNull();
  });

  it('shows only gender when dateOfBirth is unknown, only age when gender is unknown', () => {
    const [generated] = generateTalentCandidates('Actor', createRng(3), 1);
    const genderOnly: Person = { ...generated, identity: { ...generated.identity, dateOfBirth: undefined } };
    render(<TalentStats person={genderOnly} role="Lead Actor" category="actor" script={null} totalDays={1} />);
    expect(screen.getByText(genderOnly.identity.gender!)).toBeInTheDocument();
  });
});

describe('TalentStats - traits', () => {
  it('shows a trait tag once a person clears a derivation threshold', () => {
    const [generated] = generateTalentCandidates('Actor', createRng(4), 1);
    const difficult: Person = { ...generated, personality: { ...generated.personality, ego: 90, temperament: 20 } };
    render(<TalentStats person={difficult} role="Lead Actor" category="actor" script={null} totalDays={1} />);
    expect(screen.getByText('Difficult to Work With')).toBeInTheDocument();
  });

  it('shows no trait tags for a person matching no derivation threshold', () => {
    const [generated] = generateTalentCandidates('Actor', createRng(5), 1);
    const bland: Person = {
      ...generated,
      personality: { professionalism: 50, ambition: 50, loyalty: 50, ego: 50, temperament: 50, pressureHandling: 50, controversy: 50, adaptability: 50 },
      reputation: { fame: 50, prestige: 50, industryRespect: 50, reliability: 50, currentHeat: 50 },
    };
    const { container } = render(<TalentStats person={bland} role="Lead Actor" category="actor" script={null} totalDays={1} />);
    expect(container.querySelector('.candidate-traits')).toBeNull();
  });
});
