import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';

// The README clip build: the real game as players get it (no dev tools) plus tools/readme/clips.ts, as one file in dist-readme/.
const root = fileURLToPath(new URL('../..', import.meta.url));
export default defineConfig({
  root,
  plugins: [viteSingleFile()],
  define: { __DEV_TOOLS__: 'false' },
  build: {
    outDir: 'dist-readme',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    rollupOptions: { input: fileURLToPath(new URL('clips.html', import.meta.url)) },
  },
});
