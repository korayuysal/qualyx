import { defineConfig } from 'vitest/config';

// Acceptance tests: human-owned, black-box checks of user-visible behaviour (the software factory protects them).
export default defineConfig({
  test: {
    include: ['tests/acceptance/**/*.test.ts'],
    testTimeout: 60_000,
  },
});
