import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';

// The screen-test build: the real game (dev tools on) plus tests/screens/harness.ts, as one file in dist-test/.
const root = fileURLToPath(new URL('../..', import.meta.url));
export default defineConfig({
  root,
  plugins: [viteSingleFile()],
  define: { __DEV_TOOLS__: 'true' },
  build: {
    outDir: 'dist-test',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    rollupOptions: { input: fileURLToPath(new URL('harness.html', import.meta.url)) },
  },
});
