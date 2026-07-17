// @vitest-environment jsdom
//
// Tablet responsiveness pass - CheckboxFilterDropdown's menu used to be a
// plain inline-style object (`position: absolute; left: 0`), which meant it
// could never carry a media query and had no viewport-width awareness at
// all - a real overflow risk on a ~768px tablet-portrait viewport across its
// three call sites (Release Calendar, Opportunity Market, Asset Library),
// each of which places several of these dropdowns in a wrapping row.
// Rewritten to CSS classes (CheckboxFilterDropdown.css) mirroring
// ScriptRatingsFilterDropdown.css's own already-proven fix (width capped to
// the viewport, full-screen sheet under 620px) - first test coverage for
// this component, since none existed before the rewrite.
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CheckboxFilterDropdown, type CheckboxFilterOption } from './CheckboxFilterDropdown';

const OPTIONS: CheckboxFilterOption[] = [
  { id: 'a', label: 'Option A' },
  { id: 'b', label: 'Option B' },
];

function renderDropdown(overrides: Partial<React.ComponentProps<typeof CheckboxFilterDropdown>> = {}) {
  const props = {
    id: 'test-filter',
    label: 'Test Filter',
    options: OPTIONS,
    selectedIds: new Set(['a', 'b']),
    allSelectedLabel: 'All',
    noneSelectedLabel: 'None',
    selectedCountLabel: (count: number) => `${count} selected`,
    isOpen: false,
    onToggle: () => {},
    onClose: () => {},
    onChange: () => {},
    ...overrides,
  };
  return render(<CheckboxFilterDropdown {...props} />);
}

describe('CheckboxFilterDropdown', () => {
  it('renders the trigger with a summary label, and no menu while closed', () => {
    renderDropdown({ isOpen: false });
    expect(screen.getByText('Test Filter')).toBeInTheDocument();
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('calls onToggle with its own id when the trigger is clicked', () => {
    let toggledId: string | null = null;
    renderDropdown({ isOpen: false, onToggle: (id) => { toggledId = id; } });
    fireEvent.click(screen.getByText('All'));
    expect(toggledId).toBe('test-filter');
  });

  it('renders one checkbox per option when open, reflecting selectedIds', () => {
    renderDropdown({ isOpen: true, selectedIds: new Set(['a']) });
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
  });

  it('toggling a checkbox calls onChange with the updated selection', () => {
    let result: Set<string> | null = null;
    renderDropdown({ isOpen: true, selectedIds: new Set(['a']), onChange: (ids) => { result = ids; } });
    fireEvent.click(screen.getByText('Option B'));
    expect(result).toEqual(new Set(['a', 'b']));
  });

  it('"Select all" calls onChange with the full set', () => {
    let result: Set<string> | null = null;
    renderDropdown({ isOpen: true, selectedIds: new Set(), onChange: (ids) => { result = ids; } });
    fireEvent.click(screen.getByText('Select all'));
    expect(result).toEqual(new Set(['a', 'b']));
  });

  it('"Clear" calls onChange with an empty set', () => {
    let result: Set<string> | null = null;
    renderDropdown({ isOpen: true, selectedIds: new Set(['a', 'b']), onChange: (ids) => { result = ids; } });
    fireEvent.click(screen.getByText('Clear'));
    expect(result).toEqual(new Set());
  });

  it('the open menu renders via the CSS-class-based markup (tablet overflow fix), not an inline-style object', () => {
    const { container } = renderDropdown({ isOpen: true });
    const menu = container.querySelector('#test-filter-filter-menu')!;
    expect(menu).toHaveClass('checkbox-filter__menu');
    // No inline `style` attribute left on the menu - the whole point of the
    // rewrite was to move sizing/positioning into CheckboxFilterDropdown.css
    // so the sub-620px full-screen-sheet media query can actually apply.
    expect(menu.getAttribute('style')).toBeNull();
  });
});
