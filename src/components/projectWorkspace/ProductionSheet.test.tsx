// @vitest-environment jsdom
//
// Phase 3 of the visual redesign: what an empty slot says. The engine tests
// (engine/productionSheet.test.ts) prove the readings are correct; these prove
// they actually reach the player, which is the entire point of the phase - the
// relationship engines have always computed this and always hidden it inside
// the two hiring drawers.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StudioProvider } from '../../state/StudioContext';
import { ProductionSheet } from './ProductionSheet';
import { buildStateWithReadyDraft } from '../../state/testFixtures';
import { saveState } from '../../state/persistence';
import { deriveFocusedDraft } from '../../state/selectors';

beforeEach(() => {
  localStorage.clear();
});

/** The fixture draft, focused in the workspace with the sheet showing. */
function sheetState(seed = 1) {
  const base = buildStateWithReadyDraft(seed);
  return { ...base, screen: 'workspace' as const, projectWorkspaceSection: 'sheet' as const };
}

describe('the production sheet', () => {
  it('shows every slot at once, filled and unfilled together', () => {
    const state = sheetState();
    saveState(state);
    render(<StudioProvider><ProductionSheet /></StudioProvider>);

    // A filled one and an unfilled one, on the same screen - which is the
    // whole argument against the five tabs this replaced.
    const director = deriveFocusedDraft(state)!.talent.find((a) => a.role === 'Director')!;
    expect(screen.getByText(director.person.identity.name)).toBeInTheDocument();
    expect(screen.getByText('Composer')).toBeInTheDocument();
  });

  it('prints the form headings and the readiness reading', () => {
    saveState(sheetState());
    render(<StudioProvider><ProductionSheet /></StudioProvider>);
    expect(screen.getByText('Above the line')).toBeInTheDocument();
    expect(screen.getByText('Below the line')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /package readiness/i })).toBeInTheDocument();
  });

  it("carries one line of the desk's read", () => {
    saveState(sheetState());
    const { container } = render(<StudioProvider><ProductionSheet /></StudioProvider>);
    const voice = container.querySelector('.sheet-voice__line');
    expect(voice?.textContent?.length ?? 0).toBeGreaterThan(10);
  });

  it('says what an open slot costs once the lens is on, not just that it is empty', () => {
    saveState(sheetState());
    const { container } = render(<StudioProvider><ProductionSheet /></StudioProvider>);

    // Off by default: the form reads as a form first.
    expect(container.querySelectorAll('.sheet-row__note--lens')).toHaveLength(0);

    fireEvent.click(screen.getByLabelText(/read the relationships/i));
    const notes = [...container.querySelectorAll('.sheet-row__note--lens')].map((n) => n.textContent ?? '');
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.some((n) => /holds the shoot/i.test(n))).toBe(true);
  });

  it('reports the relationships an empty cast slot makes unreadable', () => {
    // The fixture has a director and one principal attached, so a second
    // principal's slot has real partners to be read against - this is the
    // reading that was previously visible only inside the casting drawer.
    saveState(sheetState());
    const { container } = render(<StudioProvider><ProductionSheet /></StudioProvider>);
    fireEvent.click(screen.getByLabelText(/read the relationships/i));
    const notes = [...container.querySelectorAll('.sheet-row__note--lens')].map((n) => n.textContent ?? '');
    expect(notes.some((n) => /relationships? unreadable/i.test(n))).toBe(true);
  });

  it('does not stamp a package that is not ready', () => {
    saveState(sheetState());
    render(<StudioProvider><ProductionSheet /></StudioProvider>);
    expect(screen.queryByText(/ready for greenlight/i)).not.toBeInTheDocument();
  });
});
