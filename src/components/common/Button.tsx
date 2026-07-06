import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'text';
}

export function Button({ variant = 'secondary', className, ...rest }: ButtonProps) {
  const classes = ['btn'];
  if (variant === 'primary') classes.push('btn-primary');
  if (variant === 'text') classes.push('btn-text');
  if (className) classes.push(className);

  return <button className={classes.join(' ')} {...rest} />;
}
