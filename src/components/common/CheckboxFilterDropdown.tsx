import { useEffect, useRef, type ReactNode } from 'react';
import './CheckboxFilterDropdown.css';

export interface CheckboxFilterOption {
  id: string;
  label: ReactNode;
}

interface CheckboxFilterDropdownProps {
  id: string;
  label: string;
  options: CheckboxFilterOption[];
  selectedIds: ReadonlySet<string>;
  allSelectedLabel: string;
  noneSelectedLabel: string;
  selectedCountLabel: (count: number) => string;
  isOpen: boolean;
  onToggle: (id: string) => void;
  onClose: () => void;
  onChange: (selectedIds: Set<string>) => void;
}

export function CheckboxFilterDropdown({
  id,
  label,
  options,
  selectedIds,
  allSelectedLabel,
  noneSelectedLabel,
  selectedCountLabel,
  isOpen,
  onToggle,
  onClose,
  onChange,
}: CheckboxFilterDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedCount = options.filter((option) =>
    selectedIds.has(option.id),
  ).length;

  const summary =
    selectedCount === options.length
      ? allSelectedLabel
      : selectedCount === 0
        ? noneSelectedLabel
        : selectedCountLabel(selectedCount);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (
        target instanceof Node &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const toggleOption = (optionId: string) => {
    const updated = new Set(selectedIds);

    if (updated.has(optionId)) {
      updated.delete(optionId);
    } else {
      updated.add(optionId);
    }

    onChange(updated);
  };

  const selectAll = () => {
    onChange(new Set(options.map((option) => option.id)));
  };

  const clearAll = () => {
    onChange(new Set());
  };

  return (
    <div ref={dropdownRef} className="checkbox-filter">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={`${id}-filter-menu`}
        onClick={() => onToggle(id)}
        className={`checkbox-filter__trigger${isOpen ? ' checkbox-filter__trigger--open' : ''}`}
      >
        <span>
          <span className="checkbox-filter__trigger-label">{label}</span>
          <span className="checkbox-filter__trigger-value">{summary}</span>
        </span>

        <span
          aria-hidden="true"
          className={`checkbox-filter__chevron${isOpen ? ' checkbox-filter__chevron--open' : ''}`}
        >
          ▼
        </span>
      </button>

      {isOpen && (
        <div id={`${id}-filter-menu`} className="checkbox-filter__menu">
          <div className="checkbox-filter__header">
            <strong style={{ fontSize: '0.9rem' }}>{label}</strong>

            <div className="checkbox-filter__actions">
              <button type="button" onClick={selectAll} className="checkbox-filter__action">
                Select all
              </button>

              <button type="button" onClick={clearAll} className="checkbox-filter__action">
                Clear
              </button>
            </div>
          </div>

          <div className="checkbox-filter__options">
            {options.map((option) => {
              const isSelected = selectedIds.has(option.id);

              return (
                <label
                  key={option.id}
                  className={`checkbox-filter__option${isSelected ? ' checkbox-filter__option--selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleOption(option.id)}
                    className="checkbox-filter__checkbox"
                  />

                  <span className="checkbox-filter__option-label">{option.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
