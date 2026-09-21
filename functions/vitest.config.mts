import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // Emulator-backed tests run separately: `npm run test:integration` from the repo root.
    exclude: ['test/integration/**', 'node_modules/**'],
  },
});
