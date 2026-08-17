import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
  resolve: {
    alias: {
      '@rolvium/shared-types': path.resolve(__dirname, '../../packages/shared-types/src/index.ts'),
      '@rolvium/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
      '@rolvium/system-plenilunio': path.resolve(__dirname, '../../packages/system-plenilunio/src/index.ts'),
    },
  },
});
