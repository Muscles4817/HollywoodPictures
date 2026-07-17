// @vitest-environment jsdom
//
// Talent card review (user request): age/gender and traits were real Person
// data with no consumer anywhere on a card - first test coverage for
// TalentStats.tsx itself (previously only exercised indirectly through
// OnSetDecisionCard.test.tsx).
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { TalentStats } from './TalentStats';
import { generateTalentCandidates } from '../../engine/talentGenerator';
import { generateScriptOptions } from '../../engine/scriptGenerator';
import { createRng } from '../../engine/random';
import { gameDateFromTotalDays, formatGameDate } from '../../engine/calendar';
import { getPersonAge, type Person, type Script } from '../../types';

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

// Talent Card UX Redesign (user request) - the card leads with a single
// "should I hire this person" verdict rather than a flat stat dump.
describe('TalentStats - Overall Hiring Summary', () => {
  it('shows a star rating and a hiring verdict for an actor evaluated against a specific Character', () => {
    const [actor] = generateTalentCandidates('Actor', createRng(10), 1);
    const script = generateScriptOptions('Action', createRng(11), 1)[0];
    const character = script.cast.find((c) => c.prominence === 'Lead')!;
    const { container } = render(
      <TalentStats person={actor} role="Lead Actor" category="actor" script={script} character={character} totalDays={1} />,
    );
    expect(container.querySelector('.hiring-verdict')).not.toBeNull();
    expect(container.querySelector('.hiring-verdict-label')).not.toBeNull();
  });

  it('renders no verdict at all when there is nothing to compare against (no script, no character)', () => {
    const [actor] = generateTalentCandidates('Actor', createRng(12), 1);
    const { container } = render(<TalentStats person={actor} role="Lead Actor" category="actor" script={null} totalDays={1} />);
    expect(container.querySelector('.hiring-verdict')).toBeNull();
  });

  it("uses the crew member's own skill as the fit score, since crew has no compatibility concept", () => {
    const [editor] = generateTalentCandidates('Editor', createRng(13), 1);
    const skilled: Person = { ...editor, careers: { ...editor.careers, editor: { ...editor.careers.editor!, skill: 96 } } };
    render(<TalentStats person={skilled} role="Editor" category="crew" script={null} totalDays={1} />);
    expect(screen.getByText('Excellent Match')).toBeInTheDocument();
  });
});

describe('TalentStats - Availability', () => {
  it('reads as immediately available when there are no commitments at all', () => {
    const [person] = generateTalentCandidates('Actor', createRng(14), 1);
    const free: Person = { ...person, availability: { commitments: [] } };
    render(<TalentStats person={free} role="Lead Actor" category="actor" script={null} totalDays={100} />);
    expect(screen.getByText('✓ Available immediately')).toBeInTheDocument();
    expect(screen.getByText('Ready to begin as soon as you are.')).toBeInTheDocument();
  });

  it('reads as busy, with the delay spelled out, for a commitment ending in the future', () => {
    const [person] = generateTalentCandidates('Actor', createRng(15), 1);
    const busy: Person = { ...person, availability: { commitments: [{ projectId: 'p1', role: 'Lead Actor', startDay: 90, endDay: 150 }] } };
    render(<TalentStats person={busy} role="Lead Actor" category="actor" script={null} totalDays={100} />);
    expect(screen.getByText(`Busy until ${formatGameDate(150)}.`)).toBeInTheDocument();
    expect(screen.getByText('Hiring them would delay production by 50 days.')).toBeInTheDocument();
  });

  it('a commitment that already ended in the past reads as available, not busy', () => {
    const [person] = generateTalentCandidates('Actor', createRng(16), 1);
    const pastCommitment: Person = { ...person, availability: { commitments: [{ projectId: 'p1', role: 'Lead Actor', startDay: 10, endDay: 50 }] } };
    render(<TalentStats person={pastCommitment} role="Lead Actor" category="actor" script={null} totalDays={100} />);
    expect(screen.getByText('✓ Available immediately')).toBeInTheDocument();
  });

  it('singular "day" for exactly a one-day delay', () => {
    const [person] = generateTalentCandidates('Actor', createRng(17), 1);
    const busy: Person = { ...person, availability: { commitments: [{ projectId: 'p1', role: 'Lead Actor', startDay: 90, endDay: 101 }] } };
    render(<TalentStats person={busy} role="Lead Actor" category="actor" script={null} totalDays={100} />);
    expect(screen.getByText('Hiring them would delay production by 1 day.')).toBeInTheDocument();
  });
});

describe('TalentStats - Role Fit / Tone Fit breakdown', () => {
  it('shows a "Role Fit" breakdown with all five ActingStyle dimensions when a specific Character is given', () => {
    const [actor] = generateTalentCandidates('Actor', createRng(18), 1);
    const script = generateScriptOptions('Action', createRng(19), 1)[0];
    const character = script.cast.find((c) => c.prominence === 'Lead')!;
    render(<TalentStats person={actor} role="Lead Actor" category="actor" script={script} character={character} totalDays={1} />);
    const heading = screen.getByText('Role Fit');
    const section = heading.closest('.talent-section')! as HTMLElement;
    for (const label of ['Character Transformation', 'Emotional Performance', 'Charisma', 'Comedy', 'Physical Performance']) {
      expect(within(section).getByText(label)).toBeInTheDocument();
    }
  });

  it('falls back to a "Tone Fit" breakdown (whole-script, not character-specific) when no Character is given', () => {
    const [actor] = generateTalentCandidates('Actor', createRng(20), 1);
    const script: Script = generateScriptOptions('Action', createRng(21), 1)[0];
    render(<TalentStats person={actor} role="Lead Actor" category="actor" script={script} totalDays={1} />);
    expect(screen.getByText('Tone Fit')).toBeInTheDocument();
    expect(screen.queryByText('Role Fit')).not.toBeInTheDocument();
  });

  it('shows a "Tone Fit" breakdown for a director against the script', () => {
    const [director] = generateTalentCandidates('Director', createRng(22), 1);
    const script = generateScriptOptions('Action', createRng(23), 1)[0];
    render(<TalentStats person={director} role="Director" category="director" script={script} totalDays={1} />);
    expect(screen.getByText('Tone Fit')).toBeInTheDocument();
  });

  it('shows no fit breakdown at all for crew - there is no per-axis dimension to break down', () => {
    const [editor] = generateTalentCandidates('Editor', createRng(24), 1);
    const script = generateScriptOptions('Action', createRng(25), 1)[0];
    render(<TalentStats person={editor} role="Editor" category="crew" script={script} totalDays={1} />);
    expect(screen.queryByText('Role Fit')).not.toBeInTheDocument();
    expect(screen.queryByText('Tone Fit')).not.toBeInTheDocument();
  });
});

describe('TalentStats - Industry and Risk Profile sections', () => {
  it('groups Fame, Prestige, and Reliability under an "Industry" heading', () => {
    const [person] = generateTalentCandidates('Actor', createRng(26), 1);
    render(<TalentStats person={person} role="Lead Actor" category="actor" script={null} totalDays={1} />);
    const heading = screen.getByText('Industry');
    const section = heading.closest('.talent-section')! as HTMLElement;
    expect(within(section).getByText('Fame')).toBeInTheDocument();
    expect(within(section).getByText('Prestige')).toBeInTheDocument();
    expect(within(section).getByText('Reliability')).toBeInTheDocument();
  });

  it('groups Professionalism, Temperament, Ego, and Controversy under a "Risk Profile" heading, without repeating Reliability', () => {
    const [person] = generateTalentCandidates('Actor', createRng(27), 1);
    render(<TalentStats person={person} role="Lead Actor" category="actor" script={null} totalDays={1} />);
    const heading = screen.getByText('Risk Profile');
    const section = heading.closest('.talent-section')! as HTMLElement;
    expect(within(section).getByText('Professionalism')).toBeInTheDocument();
    expect(within(section).getByText('Temperament')).toBeInTheDocument();
    expect(within(section).getByText('Ego')).toBeInTheDocument();
    expect(within(section).getByText('Controversy')).toBeInTheDocument();
    expect(within(section).queryByText('Reliability')).not.toBeInTheDocument();
  });

  it('renders both sections for every role category, including crew (no compatibility concept, but still a person with reputation/personality)', () => {
    const [editor] = generateTalentCandidates('Editor', createRng(28), 1);
    render(<TalentStats person={editor} role="Editor" category="crew" script={null} totalDays={1} />);
    expect(screen.getByText('Industry')).toBeInTheDocument();
    expect(screen.getByText('Risk Profile')).toBeInTheDocument();
  });
});
