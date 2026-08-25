import type { ReactNode } from 'react';
import { useChromeHeight } from './useChromeHeight';

/**
 * The fixed chrome, as one stacking element: the spine, the held-clock bar
 * when the clock is guarded, and the slate when anything is in flight.
 *
 * They are wrapped rather than individually fixed so they stack in normal
 * flow and none of them has to know how tall the others are - the bug the
 * first cut of this had, where the slate positioned itself at a hardcoded
 * `top: 42px` that a wrapped spine immediately invalidated.
 */
export function Chrome({ children }: { children: ReactNode }) {
  const ref = useChromeHeight<HTMLDivElement>();
  return (
    <div className="chrome" ref={ref}>
      {children}
    </div>
  );
}
