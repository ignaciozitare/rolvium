import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@rolvium/shared-types': path.resolve(__dirname, '../../packages/shared-types/src/index.ts'),
      '@rolvium/i18n': path.resolve(__dirname, '../../packages/i18n/src/index.tsx'),
      '@rolvium/ui/tokens': path.resolve(__dirname, '../../packages/ui/src/tokens/index.css'),
      '@rolvium/ui': path.resolve(__dirname, '../../packages/ui/src/index.ts'),
      '@rolvium/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
      '@rolvium/system-plenilunio': path.resolve(__dirname, '../../packages/system-plenilunio/src/index.ts'),
    },
  },
});
