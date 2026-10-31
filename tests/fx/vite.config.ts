import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';

// The effect contact-sheet build: tests/fx/sheet.ts on the real battle renderer, as one file in dist-fx/.
const root = fileURLToPath(new URL('../..', import.meta.url));
export default defineConfig({
  root,
  plugins: [viteSingleFile()],
  define: { __DEV_TOOLS__: 'false' },
  build: {
    outDir: 'dist-fx',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    rollupOptions: { input: fileURLToPath(new URL('sheet.html', import.meta.url)) },
  },
});
