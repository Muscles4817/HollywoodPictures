// @vitest-environment jsdom
//
// QoL pass (docs/DESIGN.md): events that involve talent or crew should
// always show the people in question's full profiles, not a single line of
// text - and, for a recast decision, let the player compare full profiles
// side by side rather than a name and a salary. First test coverage for
// this component.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OnSetDecisionCard } from './OnSetDecisionCard';
import { generateTalentCandidates } from '../../engine/talentGenerator';
import { createRng } from '../../engine/random';
import type { PendingEventChoice, Talent, TalentProfession } from '../../types';

function emptyPool(): Record<TalentProfession, Talent[]> {
  return {
    Director: [], Actor: [], Writer: [], Cinematographer: [], Composer: [], Editor: [], 'VFX Supervisor': [],
  };
}

describe('OnSetDecisionCard - a simple (non-replacement) decision involving one hired talent', () => {
  it("shows the involved talent's full profile card (name, salary, headline stats, compatibility) rather than a one-line summary", () => {
    const director = generateTalentCandidates('Director', createRng(1), 1)[0];
    const pendingChoice: PendingEventChoice = {
      templateId: 't1', situation: 'The director wants a reshoot.', polarity: 'negative', severity: 'medium',
      choices: [{ id: 'c1', label: 'Approve', description: 'Pay for it.', costRange: [1000, 1000], qualityRange: [1, 1], buzzRange: [0, 0], delayDaysRange: [1, 1] }],
      involvedTalentId: director.id, involvedTalentName: director.name, involvedRole: 'Director',
    };
    render(
      <OnSetDecisionCard pendingChoice={pendingChoice} talent={[director]} talentPool={emptyPool()} script={null} onChoose={() => {}} />,
    );
    expect(screen.getByText(director.name)).toBeInTheDocument();
    expect(screen.getByText('Currently Director')).toBeInTheDocument();
    // TalentStats always renders a Reliability stat regardless of role category - proof the full stat block rendered, not just a name/role line.
    expect(screen.getByText(`Reliability ${director.reliability}`)).toBeInTheDocument();
  });
});

describe('OnSetDecisionCard - a replacement (recast) decision', () => {
  it('shows a full comparison row - the currently-involved talent plus every recast candidate, each as a full profile card', () => {
    const director = generateTalentCandidates('Director', createRng(2), 1)[0];
    const candidates = generateTalentCandidates('Director', createRng(3), 2);
    const pendingChoice: PendingEventChoice = {
      templateId: 't2', situation: 'The director has walked off the production.', polarity: 'negative', severity: 'high',
      choices: candidates.map((c) => ({
        id: `replace-with:${c.id}`, label: `Recast with ${c.name}`, description: `Bring in ${c.name} instead.`,
        costRange: [5000, 5000], qualityRange: [0, 0], buzzRange: [0, 0], delayDaysRange: [2, 2],
        replacementCandidateId: c.id, replacementCandidateName: c.name, replacementCandidateSalary: c.salary,
      })),
      involvedTalentId: director.id, involvedTalentName: director.name, involvedRole: 'Director', replacementRole: 'Director',
    };
    const talentPool = { ...emptyPool(), Director: candidates };
    render(
      <OnSetDecisionCard pendingChoice={pendingChoice} talent={[director]} talentPool={talentPool} script={null} onChoose={() => {}} />,
    );
    // The currently-involved director and both candidates each get their own full card.
    expect(screen.getByText(director.name)).toBeInTheDocument();
    for (const candidate of candidates) {
      expect(screen.getByText(candidate.name)).toBeInTheDocument();
      // Proof the full TalentStats card rendered for the candidate (resolved from talentPool), not just name + salary text.
      expect(screen.getByText(`Reliability ${candidate.reliability}`)).toBeInTheDocument();
    }
    expect(screen.getByText('People Involved - compare before you choose')).toBeInTheDocument();
  });

  it('still shows a candidate card even if the candidate cannot be resolved from talentPool (falls back to name + salary)', () => {
    const director = generateTalentCandidates('Director', createRng(4), 1)[0];
    const pendingChoice: PendingEventChoice = {
      templateId: 't3', situation: 'Recast needed.', polarity: 'negative', severity: 'high',
      choices: [{
        id: 'replace-with:ghost', label: 'Recast with Ghost Candidate', description: 'Bring in someone new.',
        costRange: [5000, 5000], qualityRange: [0, 0], buzzRange: [0, 0], delayDaysRange: [2, 2],
        replacementCandidateId: 'ghost-id', replacementCandidateName: 'Ghost Candidate', replacementCandidateSalary: 250_000,
      }],
      involvedTalentId: director.id, involvedTalentName: director.name, involvedRole: 'Director', replacementRole: 'Director',
    };
    render(
      <OnSetDecisionCard pendingChoice={pendingChoice} talent={[director]} talentPool={emptyPool()} script={null} onChoose={() => {}} />,
    );
    expect(screen.getByText('Ghost Candidate')).toBeInTheDocument();
  });
});
