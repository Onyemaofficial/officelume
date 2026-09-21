import { defineConfig } from 'vitest/config';

// Firestore security-rules tests. Run through the emulator: `npm run test:rules`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/rules/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
