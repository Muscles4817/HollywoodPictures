/**
 * A small "ⓘ" info sign with a hover/focus tooltip - used to explain what a
 * stat is and what it affects in-game (components/TalentDatabase.tsx's dev
 * section). Keyboard-focusable and screen-reader labelled; the visible bubble
 * is CSS-driven (see TalentDatabase.css) so it can hold more than a native
 * `title` tooltip comfortably.
 */
export function InfoTip({ label }: { label: string }) {
  return (
    <span className="info-tip" tabIndex={0} role="note" aria-label={label}>
      <span className="info-tip__icon" aria-hidden="true">i</span>
      <span className="info-tip__bubble" role="tooltip">{label}</span>
    </span>
  );
}
