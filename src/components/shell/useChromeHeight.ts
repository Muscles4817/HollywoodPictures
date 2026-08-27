import { useEffect, useRef } from 'react';

/**
 * Publishes the real height of the fixed chrome (spine + held-clock bar +
 * slate) to `--header-clearance`, which `#root` and `.wizard-header-sticky`
 * both use to sit below it.
 *
 * That variable used to be a hand-measured constant - 96px, and 148px on a
 * phone - with a comment admitting it was "measured to fit one row at desktop
 * widths". It was wrong whenever the bar wrapped, and the chassis makes it
 * wrong far more often: the slate appears only when something is in flight,
 * and the held-clock bar only when a bid is live, so the chrome has at least
 * four possible heights at any width. Measuring is the only honest answer;
 * the value in index.css remains as the first-paint fallback.
 */
export function useChromeHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // jsdom has no ResizeObserver; component tests that mount the shell should
    // keep the stylesheet's fallback rather than crash.
    if (typeof ResizeObserver === 'undefined') return;

    const apply = () => document.documentElement.style.setProperty('--header-clearance', `${Math.ceil(el.getBoundingClientRect().height)}px`);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--header-clearance');
    };
  }, []);

  return ref;
}
