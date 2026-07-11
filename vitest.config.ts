import { defineConfig } from 'vitest/config';

// Deliberately separate from vite.config.ts rather than merged into it -
// everything under test so far is pure engine/domain logic (no DOM, no
// React), so this stays minimal instead of inheriting the app's React
// plugin/build config for no reason.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
