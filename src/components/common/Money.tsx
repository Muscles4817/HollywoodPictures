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
  // Every currency figure is a value, not a label, so it always wears the
  // typed register (the `money` class - see the `.typed` rule in index.css).
  // docs/ART_DIRECTION.md: the game's structure is printed, the player's
  // numbers are typed.
  const tone = signColor ? (isGood ? ' money-positive' : ' money-negative') : '';
  const className = `money${tone}`;
  const prefix = showSign && amount > 0 ? '+' : '';
  return <span className={className}>{prefix}{formatMoney(amount)}</span>;
}
