import type { ReactNode } from 'react';

interface StatTileProps {
  label: string;
  value: ReactNode;
}

export function StatTile({ label, value }: StatTileProps) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
