import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'node:fs';

/**
 * Dev-only plugin (apply:'serve'). Watches directories rather than individual
 * files so that git's rename-based writes (common on macOS) are reliably
 * detected. Monitors the .git directory for HEAD and ORIG_HEAD changes, and
 * the repo root for pnpm-lock.yaml. Debounces 400ms then restarts the server.
 * Skips a directory if it does not exist. Never included in production builds.
 */
function restartOnGitChange(): Plugin {
  return {
    name: 'restart-on-git-change',
    apply: 'serve',
    configureServer(server) {
      const repoRoot = path.resolve(__dirname, '../..');
      const gitDir = path.join(repoRoot, '.git');

      // One watcher per directory; filter on expected filenames in the callback.
      const dirSpecs: Array<[dir: string, filenames: Set<string>]> = [
        [gitDir, new Set(['HEAD', 'ORIG_HEAD'])],
        [repoRoot, new Set(['pnpm-lock.yaml'])],
      ];

      let timer: ReturnType<typeof setTimeout> | null = null;

      const watchers = dirSpecs
        .filter(([dir]) => fs.existsSync(dir))
        .map(([dir, filenames]) =>
          fs.watch(dir, (_, changedFile) => {
            if (!changedFile || !filenames.has(changedFile)) return;
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
              timer = null;
              console.log('[restart-on-git-change] git state changed, restarting dev server');
              server.restart();
            }, 400);
          }),
        );

      server.httpServer?.once('close', () => {
        if (timer) clearTimeout(timer);
        watchers.forEach((w) => w.close());
      });
    },
  };
}

/**
 * No endpoint plumbing on purpose. The leasing site does not submit to the Apps Script
 * backend (see src/lib/contact.ts), so it has no `__FORM_ENDPOINT__` define and cannot be
 * pointed at one by a stray environment variable.
 */
export default defineConfig({
  plugins: [react(), restartOnGitChange()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@brand': path.resolve(__dirname, '../../packages/brand/src'),
    },
  },
  build: { outDir: 'dist', sourcemap: true },
  server: { port: 3002 },
});
