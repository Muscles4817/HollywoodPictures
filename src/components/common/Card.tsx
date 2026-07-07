import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  selectable?: boolean;
  selected?: boolean;
  /** Visually greyed out and inert - e.g. a candidate that can't be picked because the role is already full. */
  disabled?: boolean;
  onClick?: () => void;
}

/** Generic bordered container. Pass `selectable` + `onClick` to use it as a pick-one card. */
export function Card({ children, selectable, selected, disabled, onClick }: CardProps) {
  const classes = ['card'];
  if (selectable) classes.push('card-selectable');
  if (selected) classes.push('card-selected');
  if (disabled) classes.push('card-disabled');

  const active = selectable && !disabled;

  return (
    <div
      className={classes.join(' ')}
      onClick={active ? onClick : undefined}
      role={active ? 'button' : undefined}
      tabIndex={active ? 0 : undefined}
      onKeyDown={
        active
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onClick?.();
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}
