import { Button } from './Button';

interface ChoiceGroupProps<T extends string> {
  label: string;
  options: readonly T[];
  value: T | null;
  onChange: (value: T) => void;
  /** General context shown under the heading, regardless of what's selected. */
  hint?: string;
  /** Per-option explanation, shown once that option is selected. */
  descriptions?: Partial<Record<T, string>>;
}

/**
 * One self-contained "pick one of N" section: its own card, its own
 * subheading, and - once an option is picked - a plain-English explanation
 * of what that specific choice actually does. Used across the production,
 * post-production and marketing wizard screens so every choice is its own
 * clearly separated block rather than one undifferentiated wall of buttons.
 */
export function ChoiceGroup<T extends string>({ label, options, value, onChange, hint, descriptions }: ChoiceGroupProps<T>) {
  const selectedDescription = value ? descriptions?.[value] : undefined;
  return (
    <div className="card stack">
      <h3 style={{ margin: 0 }}>{label}</h3>
      {hint && <p style={{ margin: 0 }}>{hint}</p>}
      <div className="row">
        {options.map((option) => (
          <Button key={option} variant={value === option ? 'primary' : 'secondary'} onClick={() => onChange(option)}>
            {option}
          </Button>
        ))}
      </div>
      {selectedDescription && <p className="choice-description">{selectedDescription}</p>}
    </div>
  );
}
