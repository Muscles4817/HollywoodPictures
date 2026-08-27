/**
 * The developer-only detours (components/dev/*). Kept in its own module rather
 * than on the shell component that renders their switch, so App.tsx and the
 * rail can both name the type without importing each other.
 */
export type DevTool = 'none' | 'recommendation' | 'outcome' | 'rival-finances' | 'requirement-profile';
