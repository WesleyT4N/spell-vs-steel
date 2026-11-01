import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';

// The screen-test build: the real game (dev tools on) plus tests/screens/harness.ts, as one file in dist-test/.
// LOWPOLY=1 builds the low-poly 3D version instead, into dist-test-lowpoly/.
const root = fileURLToPath(new URL('../..', import.meta.url));
const lowpoly = !!process.env.LOWPOLY;
export default defineConfig({
  root,
  plugins: [viteSingleFile()],
  define: { __DEV_TOOLS__: 'true', __LOWPOLY__: JSON.stringify(lowpoly) },
  // as in the game build, three.js is only bundled into the low-poly version (importing it rolls Math.random)
  resolve: { alias: lowpoly ? [] : [{ find: /^\.\.\/lowpoly\/battle3d$/, replacement: fileURLToPath(new URL('../../src/lowpoly/stub.ts', import.meta.url)) }] },
  build: {
    outDir: lowpoly ? 'dist-test-lowpoly' : 'dist-test',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    rollupOptions: { input: fileURLToPath(new URL('harness.html', import.meta.url)) },
  },
});
