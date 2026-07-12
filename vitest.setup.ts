// Loaded for every test file (see vitest.config.ts) - a harmless no-op for
// the plain `*.test.ts` engine suite, which never renders anything or
// calls a DOM matcher; only matters for `*.test.tsx` component tests
// (opted into jsdom individually via a `// @vitest-environment jsdom`
// docblock - see OutcomeInspector.test.tsx for the first one).
//
// Extends `expect` with jest-dom's DOM matchers (toBeInTheDocument,
// toHaveTextContent, ...).
import '@testing-library/jest-dom/vitest';

// React Testing Library's own auto-cleanup-after-each-test only registers
// itself when it detects Vitest's `globals: true` mode - this project
// deliberately doesn't enable that (every test file imports
// describe/it/expect/etc. explicitly, same as the rest of the codebase's
// style), so without this, render() output from one test silently leaks
// into the next test's DOM instead of being unmounted, and a later test's
// query can match leftover elements a previous test rendered.
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
