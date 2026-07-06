import { Button } from './Button';

interface ChoiceGroupProps<T extends string> {
  label: string;
  options: readonly T[];
  value: T | null;
  onChange: (value: T) => void;
  hint?: string;
}

/** Label + row of pick-one buttons, used across the production/post/marketing wizard screens. */
export function ChoiceGroup<T extends string>({ label, options, value, onChange, hint }: ChoiceGroupProps<T>) {
  return (
    <div className="stack">
      <h3 style={{ margin: 0 }}>{label}</h3>
      {hint && <p style={{ margin: 0 }}>{hint}</p>}
      <div className="row">
        {options.map((option) => (
          <Button key={option} variant={value === option ? 'primary' : 'secondary'} onClick={() => onChange(option)}>
            {option}
          </Button>
        ))}
      </div>
    </div>
  );
}
