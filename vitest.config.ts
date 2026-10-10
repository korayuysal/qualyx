import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./test-guard.mjs'],
    include: [
      'packages/*/src/__tests__/**/*.test.ts',
    ],
  },
});
