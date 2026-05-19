import { defineConfig } from 'vite';
import react            from '@vitejs/plugin-react';
import path             from 'path';

// =============================================================================
// Vite — Renderer Process
// =============================================================================

export default defineConfig({
  plugins: [react()],
  base:    './',

  resolve: {
    alias: {
      // Apunta al dist compilado — igual que tsconfig.json del renderer
      '@pos/shared': path.resolve(__dirname, '../../packages/shared/dist/index'),
      '@':           path.resolve(__dirname, './src'),
    },
  },

  build: {
    outDir:      path.resolve(__dirname, '../electron/dist/renderer'),
    emptyOutDir: true,
  },

  server: {
    port:       5173,
    strictPort: true,
  },
});