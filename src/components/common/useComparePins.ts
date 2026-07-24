import { useCallback, useState } from 'react';

/**
 * Talent Card UX Redesign (user request) - Pin to Compare, as one shared hook
 * so every screen that browses talent behaves identically (previously only the
 * crew/director drawer had pinning, and it was local state that never reached
 * actor casting). Capped at two: the comparison view is a head-to-head "which
 * of these two do I hire," so a third pin would have nothing to render into.
 *
 * State is by person id (the shared talent pool keys people by id) rather than
 * by Person object, so the same person pinned from two different list positions
 * is still one pin, and a re-rendered candidate object doesn't lose its pin.
 */
export const MAX_PINNED = 2;

export interface ComparePins {
  pinnedIds: string[];
  isPinned: (id: string) => boolean;
  /** True once MAX_PINNED are pinned - an unpinned candidate's Pin button disables here. */
  isFull: boolean;
  toggle: (id: string) => void;
  clear: () => void;
}

export function useComparePins(): ComparePins {
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  const toggle = useCallback((id: string) => {
    setPinnedIds((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= MAX_PINNED) return prev;
      return [...prev, id];
    });
  }, []);

  const clear = useCallback(() => setPinnedIds([]), []);

  return {
    pinnedIds,
    isPinned: (id) => pinnedIds.includes(id),
    isFull: pinnedIds.length >= MAX_PINNED,
    toggle,
    clear,
  };
}
