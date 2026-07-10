// Cross-cutting constants with no natural home in data/ or engine/ - kept
// here instead of App.tsx so UI components (components/common/TimeTickIndicator.tsx)
// can read them without importing the app's entry point.

/** How often the background day-tick fires outside the wizard - see App.tsx. */
export const DAY_TICK_MS = 3000;
