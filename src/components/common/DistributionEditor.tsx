import { useEffect, useRef, useState } from 'react';
import type { Distribution } from '../../types';

// Segment colors by position, not by key - reused across both the 3-key
// Environment editor and the 2-key Effects one. Only three used anywhere
// today; add a fourth if a future recommendation ever needs one.
const SEGMENT_COLORS = ['var(--primary)', 'var(--star)', 'var(--green)'];

const KEYBOARD_STEP = 0.02;

interface DistributionEditorProps<K extends string> {
  order: readonly K[];
  value: Distribution<K>;
  /** Omit (with disabled) for a read-only reference display - e.g. the "Recommended" row shown above the editable one. */
  onChange?: (next: Distribution<K>) => void;
  labels: Record<K, string>;
  /** Shown as a thin reference row above the editable one - not interactive. */
  recommended?: Distribution<K>;
  disabled?: boolean;
}

/**
 * One continuous bar divided into N segments (N-1 draggable dividers)
 * rather than N independent sliders - "always sums to 100%" is then
 * structurally true instead of a rule the player has to trust is being
 * enforced elsewhere. Dragging a divider trades share only between the two
 * segments it sits between (adjacent-only redistribution) - the natural
 * behavior for this shape of control, same as resizing table columns or
 * panes. See docs/DESIGN.md for why this shape was chosen over three
 * independently-linked sliders.
 */
function Bar<K extends string>({ order, value, labels, className }: { order: readonly K[]; value: Distribution<K>; labels: Record<K, string>; className?: string }) {
  return (
    <div className={`distribution-bar ${className ?? ''}`}>
      {order.map((key, i) => (
        <div
          key={key}
          className="distribution-segment"
          style={{ width: `${Math.max(0, value[key]) * 100}%`, background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
          title={`${labels[key]}: ${Math.round(value[key] * 100)}%`}
        />
      ))}
    </div>
  );
}

export function DistributionEditor<K extends string>({
  order,
  value,
  onChange,
  labels,
  recommended,
  disabled,
}: DistributionEditorProps<K>) {
  const barRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ dividerIndex: number; startX: number; startValue: Distribution<K> } | null>(null);

  useEffect(() => {
    if (!drag || !barRef.current || !onChange) return;
    const activeDrag = drag;
    const rect = barRef.current.getBoundingClientRect();

    function applyDelta(deltaFraction: number) {
      const leftKey = order[activeDrag.dividerIndex];
      const rightKey = order[activeDrag.dividerIndex + 1];
      const pairTotal = activeDrag.startValue[leftKey] + activeDrag.startValue[rightKey];
      const newLeft = Math.max(0, Math.min(pairTotal, activeDrag.startValue[leftKey] + deltaFraction));
      const newRight = pairTotal - newLeft;
      onChange!({ ...activeDrag.startValue, [leftKey]: newLeft, [rightKey]: newRight } as Distribution<K>);
    }

    function handleMove(e: PointerEvent) {
      applyDelta((e.clientX - activeDrag.startX) / rect.width);
    }
    function handleUp() {
      setDrag(null);
    }
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [drag, order, onChange]);

  function nudgeDivider(dividerIndex: number, direction: 1 | -1) {
    if (!onChange) return;
    const leftKey = order[dividerIndex];
    const rightKey = order[dividerIndex + 1];
    const pairTotal = value[leftKey] + value[rightKey];
    const newLeft = Math.max(0, Math.min(pairTotal, value[leftKey] + direction * KEYBOARD_STEP));
    const newRight = pairTotal - newLeft;
    onChange({ ...value, [leftKey]: newLeft, [rightKey]: newRight } as Distribution<K>);
  }

  // Cumulative left edge of each divider, for positioning its handle.
  const dividerPositions: number[] = [];
  let cumulative = 0;
  for (let i = 0; i < order.length - 1; i++) {
    cumulative += value[order[i]];
    dividerPositions.push(cumulative);
  }

  return (
    <div className="distribution-editor">
      {recommended && <Bar order={order} value={recommended} labels={labels} className="distribution-bar-recommended" />}
      <div className="distribution-bar-wrapper" ref={barRef}>
        <Bar order={order} value={value} labels={labels} />
        {!disabled &&
          dividerPositions.map((pos, i) => (
            <div
              key={i}
              className="distribution-divider"
              style={{ left: `${pos * 100}%` }}
              role="slider"
              tabIndex={0}
              aria-label={`Boundary between ${labels[order[i]]} and ${labels[order[i + 1]]}`}
              aria-valuenow={Math.round(value[order[i]] * 100)}
              onPointerDown={(e) => {
                e.preventDefault();
                setDrag({ dividerIndex: i, startX: e.clientX, startValue: value });
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') nudgeDivider(i, -1);
                else if (e.key === 'ArrowRight') nudgeDivider(i, 1);
              }}
            />
          ))}
      </div>
      <div className="distribution-legend">
        {order.map((key, i) => (
          <span key={key} className="distribution-legend-item">
            <span className="distribution-legend-swatch" style={{ background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }} />
            {labels[key]} {Math.round(value[key] * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}
