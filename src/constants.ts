// Cross-cutting constants with no natural home in data/ or engine/ - kept
// here instead of App.tsx so UI components (components/common/TimeTickIndicator.tsx)
// can read them without importing the app's entry point.

/** How often the background day-tick fires outside the wizard - see App.tsx. */
export const DAY_TICK_MS = 3000;

/** Selectable speed-ups for the Dashboard's background day-tick - see App.tsx. Off the Dashboard the tick always falls back to 1x, regardless of which of these is selected. */
export const TICK_SPEED_MULTIPLIERS = [1, 2, 4] as const;
export type TickSpeedMultiplier = (typeof TICK_SPEED_MULTIPLIERS)[number];
