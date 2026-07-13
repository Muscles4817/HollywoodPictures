import {
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react';

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

const containerStyle: CSSProperties = {
  position: 'relative',
};

const triggerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem',
  minWidth: '190px',
  minHeight: '42px',
  padding: '0.65rem 0.85rem',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  background: 'var(--panel)',
  color: 'inherit',
  font: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
};

const menuStyle: CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 0.5rem)',
  left: 0,
  zIndex: 20,
  minWidth: '280px',
  maxWidth: '340px',
  padding: '0.75rem',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  background: 'var(--panel)',
  boxShadow: '0 14px 36px rgba(0, 0, 0, 0.35)',
};

const menuHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem',
  paddingBottom: '0.65rem',
  marginBottom: '0.5rem',
  borderBottom: '1px solid var(--border)',
};

const actionButtonStyle: CSSProperties = {
  padding: '0.35rem 0.55rem',
  border: 0,
  borderRadius: '6px',
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  fontSize: '0.875rem',
  cursor: 'pointer',
  opacity: 0.85,
};

const optionsStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.3rem',
  maxHeight: '280px',
  overflowY: 'auto',
  paddingRight: '0.2rem',
};

const optionStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.7rem',
  minHeight: '38px',
  padding: '0.45rem 0.55rem',
  borderRadius: '7px',
  cursor: 'pointer',
  userSelect: 'none',
};

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
    <div ref={dropdownRef} style={containerStyle}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={`${id}-filter-menu`}
        onClick={() => onToggle(id)}
        style={{
          ...triggerStyle,
          borderColor: isOpen ? 'var(--primary)' : triggerStyle.borderColor,
        }}
      >
        <span>
          <span
            style={{
              display: 'block',
              marginBottom: '0.1rem',
              fontSize: '0.75rem',
              opacity: 0.65,
            }}
          >
            {label}
          </span>

          <span
            style={{
              display: 'block',
              fontWeight: 600,
            }}
          >
            {summary}
          </span>
        </span>

        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            fontSize: '0.8rem',
            transform: isOpen ? 'rotate(180deg)' : undefined,
            transition: 'transform 150ms ease',
          }}
        >
          ▼
        </span>
      </button>

      {isOpen && (
        <div
          id={`${id}-filter-menu`}
          style={menuStyle}
        >
          <div style={menuHeaderStyle}>
            <strong style={{ fontSize: '0.9rem' }}>{label}</strong>

            <div
              style={{
                display: 'flex',
                gap: '0.25rem',
              }}
            >
              <button
                type="button"
                onClick={selectAll}
                style={actionButtonStyle}
              >
                Select all
              </button>

              <button
                type="button"
                onClick={clearAll}
                style={actionButtonStyle}
              >
                Clear
              </button>
            </div>
          </div>

          <div style={optionsStyle}>
            {options.map((option) => {
              const isSelected = selectedIds.has(option.id);

              return (
                <label
                  key={option.id}
                  style={{
                    ...optionStyle,
                    background: isSelected ? 'var(--info-bg)' : 'transparent',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleOption(option.id)}
                    style={{
                      width: '17px',
                      height: '17px',
                      margin: 0,
                      cursor: 'pointer',
                      accentColor: 'currentColor',
                    }}
                  />

                  <span
                    style={{
                      flex: 1,
                      lineHeight: 1.3,
                    }}
                  >
                    {option.label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}