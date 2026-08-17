import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
  resolve: {
    alias: {
      '@rolvium/core': path.resolve(__dirname, '../core/src/index.ts'),
    },
  },
});
