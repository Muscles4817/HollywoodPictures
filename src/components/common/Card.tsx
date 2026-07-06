import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  selectable?: boolean;
  selected?: boolean;
  onClick?: () => void;
}

/** Generic bordered container. Pass `selectable` + `onClick` to use it as a pick-one card. */
export function Card({ children, selectable, selected, onClick }: CardProps) {
  const classes = ['card'];
  if (selectable) classes.push('card-selectable');
  if (selected) classes.push('card-selected');

  return (
    <div
      className={classes.join(' ')}
      onClick={onClick}
      role={selectable ? 'button' : undefined}
      tabIndex={selectable ? 0 : undefined}
      onKeyDown={
        selectable
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
