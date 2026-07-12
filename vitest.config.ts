import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Kept separate from vite.config.ts rather than merged into it, same as
// before - but no longer DOM-free. The engine/reducer suite (`*.test.ts`,
// 250+ tests) stays on the fast, default `node` environment with no DOM
// and no React plugin overhead; component-render tests (`*.test.tsx`,
// added after a bug - OutcomeInspector - that a reducer-only test suite
// structurally couldn't catch, since it lived entirely in React `useState`
// initialization order, not in any engine/reducer logic) opt into jsdom
// individually via a `// @vitest-environment jsdom` docblock at the top of
// each file (Vitest 4 dropped `environmentMatchGlobs`, the glob-based
// alternative an earlier version of this config tried first) rather than a
// blanket `environment: 'jsdom'` for every test in the repo.
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
