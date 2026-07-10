import type { EventSeverity } from '../../types';

const SEVERITY_LABELS: Record<EventSeverity, string> = {
  low: 'Minor',
  medium: 'Moderate',
  high: 'Major',
};

/** Small color-coded tag showing how big a deal an on-set event actually is - see docs/DESIGN.md 5.21. */
export function SeverityBadge({ severity }: { severity: EventSeverity }) {
  return <span className={`severity-badge severity-badge-${severity}`}>{SEVERITY_LABELS[severity]}</span>;
}
