import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // `ui/` is included so the renderer's own checks run with the suite; it
    // holds source-level assertions (no raw HTML injection), not DOM tests,
    // so the node environment is still the right one.
    include: ['src/**/*.test.ts', 'ui/**/*.test.ts'],
    environment: 'node',
    globals: false,
    testTimeout: 10000,
  },
});
