import type { ReactNode } from 'react';
import './CheckboxToggle.css';

/**
 * A small inline checkbox + label, for lightweight list filters like the
 * casting drawers' "available now only" toggle. Deliberately simpler than
 * CheckboxFilterDropdown (a multi-option dropdown) - this is a single boolean
 * the whole label toggles, with an optional muted hint (e.g. a hidden count)
 * trailing it.
 */
export function CheckboxToggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <label className="checkbox-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="checkbox-toggle__label">{label}</span>
      {hint != null && hint !== '' && <span className="checkbox-toggle__hint">{hint}</span>}
    </label>
  );
}
