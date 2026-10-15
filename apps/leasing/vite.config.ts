import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * No endpoint plumbing on purpose. The leasing site does not submit to the Apps Script
 * backend (see src/lib/contact.ts), so it has no `__FORM_ENDPOINT__` define and cannot be
 * pointed at one by a stray environment variable.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@brand': path.resolve(__dirname, '../../packages/brand/src'),
    },
  },
  build: { outDir: 'dist', sourcemap: true },
  server: { port: 3002 },
});
