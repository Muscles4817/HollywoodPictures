const formatter = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
});

export function formatMoney(amount: number): string {
  return formatter.format(amount);
}

interface MoneyProps {
  amount: number;
  /** Colors green/red based on sign. Off by default for neutral figures like cost. */
  signColor?: boolean;
  /** Flips the color rule - use for cost deltas, where negative (a saving) is the good outcome. */
  invertColor?: boolean;
  showSign?: boolean;
}

export function Money({ amount, signColor, invertColor, showSign }: MoneyProps) {
  const isGood = invertColor ? amount <= 0 : amount >= 0;
  const className = signColor ? (isGood ? 'money-positive' : 'money-negative') : undefined;
  const prefix = showSign && amount > 0 ? '+' : '';
  return <span className={className}>{prefix}{formatMoney(amount)}</span>;
}
