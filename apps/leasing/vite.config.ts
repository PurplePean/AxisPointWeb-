import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'node:fs';

/**
 * Dev-only plugin (apply:'serve'). Watches .git/HEAD, .git/ORIG_HEAD and
 * pnpm-lock.yaml at the repo root and restarts the Vite dev server 400ms
 * after any of them changes — covering branch switches and pulls. Skips
 * files that do not exist (ORIG_HEAD is absent until a merge or rebase).
 * Never included in production builds.
 */
function restartOnGitChange(): Plugin {
  return {
    name: 'restart-on-git-change',
    apply: 'serve',
    configureServer(server) {
      const repoRoot = path.resolve(__dirname, '../..');
      const candidates = [
        path.join(repoRoot, '.git/HEAD'),
        path.join(repoRoot, '.git/ORIG_HEAD'),
        path.join(repoRoot, 'pnpm-lock.yaml'),
      ];
      const targets = candidates.filter((f) => fs.existsSync(f));

      let timer: ReturnType<typeof setTimeout> | null = null;
      const watchers = targets.map((f) =>
        fs.watch(f, () => {
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
