// @vitest-environment jsdom
// The Test Scripts section used to render every built-in script raw, ignoring
// the search box and every filter dropdown (which only touched the acquired
// library). The controls were also hidden entirely when the studio owned no
// acquired assets - so a brand-new studio couldn't filter the 88 test scripts
// at all. These tests pin the fixed behaviour: both grids run the same
// controls, and the controls always render when there's anything to filter.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TEST_SCRIPT_ASSETS } from '../data/testScripts';
import { createInitialStudio, type GameState } from '../state/gameState';
import type { Asset } from '../types';

const dispatch = vi.fn();
let mockState: GameState;
vi.mock('../state/StudioContext', () => ({ useStudio: () => ({ state: mockState, dispatch }) }));

// Imported after the mock is declared.
import { AssetLibrary } from './AssetLibrary';

const byId = (id: string): Asset => TEST_SCRIPT_ASSETS.find((asset) => asset.id === id)!;
const dieHard = byId('test-script-die-hard'); // Action
const superbad = byId('test-script-superbad'); // Comedy
// An acquired-library asset: the same shape as a test script but with a
// non-`test-script-` id, so AssetLibrary files it under the acquired grid.
const acquiredHeat: Asset = { ...byId('test-script-heat'), id: 'acquired-heat' }; // Action

/** A minimal state exposing the given owned assets - AssetLibrary only reads assets/projects/focus. */
function stateWithAssets(assets: Asset[]): GameState {
  return {
    studio: { ...createInitialStudio(10_000_000), assets },
    projects: [],
    focusedProjectId: null,
  } as unknown as GameState;
}

describe('AssetLibrary - Test Scripts respond to the filters', () => {
  it('narrows the Test Scripts grid by the search box, not just the acquired grid', () => {
    mockState = stateWithAssets([acquiredHeat, dieHard, superbad]);
    render(<AssetLibrary />);
    // All three visible before searching.
    expect(screen.getByRole('heading', { name: 'Die Hard' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Superbad' })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Search title/i), {
      target: { value: 'superbad' },
    });

    // The matching test script survives; the non-matching test script and the
    // non-matching acquired asset are both filtered out.
    expect(screen.getByRole('heading', { name: 'Superbad' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Die Hard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Heat' })).not.toBeInTheDocument();
  });

  it('applies a genre facet to the Test Scripts grid (and offers genres only test scripts carry)', () => {
    mockState = stateWithAssets([acquiredHeat, dieHard, superbad]);
    render(<AssetLibrary />);

    // Open the Genre dropdown and drop Action - the option exists because the
    // facet list is drawn from test scripts too, not only acquired assets.
    fireEvent.click(screen.getByRole('button', { name: /Genre/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Action' }));

    // Every Action title (the acquired Heat and the Die Hard test script) is
    // gone; the Comedy test script remains.
    expect(screen.getByRole('heading', { name: 'Superbad' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Die Hard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Heat' })).not.toBeInTheDocument();
  });
});

describe('AssetLibrary - filter controls with no acquired assets', () => {
  it('still renders the search/filter controls (and the test scripts) when nothing has been acquired yet', () => {
    mockState = stateWithAssets([dieHard, superbad]); // only test scripts owned
    render(<AssetLibrary />);

    // The controls used to be hidden entirely in this case.
    expect(screen.getByPlaceholderText(/Search title/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Genre/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Test Scripts' })).toBeInTheDocument();

    // And they actually filter the test scripts.
    fireEvent.change(screen.getByPlaceholderText(/Search title/i), {
      target: { value: 'die hard' },
    });
    expect(screen.getByRole('heading', { name: 'Die Hard' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Superbad' })).not.toBeInTheDocument();
  });
});

describe('AssetLibrary - hide test scripts toggle', () => {
  it('collapses the whole Test Scripts section, leaves acquired assets alone, and restores on toggle back', () => {
    mockState = stateWithAssets([acquiredHeat, dieHard, superbad]);
    render(<AssetLibrary />);

    // Test scripts visible by default; toggle offers to hide them.
    expect(screen.getByRole('heading', { name: 'Die Hard' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Superbad' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hide test scripts' }));

    // Every test script is gone; the acquired asset (Heat) is untouched.
    expect(screen.queryByRole('heading', { name: 'Die Hard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Superbad' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Heat' })).toBeInTheDocument();
    expect(screen.getByText(/Test scripts are hidden/i)).toBeInTheDocument();

    const showBtn = screen.getByRole('button', { name: 'Show test scripts' });
    expect(showBtn).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(showBtn);

    // Restored.
    expect(screen.getByRole('heading', { name: 'Die Hard' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Superbad' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide test scripts' })).toBeInTheDocument();
  });
});
