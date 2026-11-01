import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';

// One self-contained index.html, so every build can be published as a playable artifact.
// `--mode prod` is the player-facing build: dev tools off (see src/flags.ts), output in dist-prod/.
// `--mode lowpoly` is the separate low-poly 3D build (dev tools on), output in dist-lowpoly/.
export default defineConfig(({ mode }) => {
  const prod = mode === 'prod', lowpoly = mode === 'lowpoly';
  return {
    plugins: [viteSingleFile()],
    define: { __DEV_TOOLS__: JSON.stringify(!prod), __LOWPOLY__: JSON.stringify(lowpoly) },
    // only the low-poly build bundles three.js: everywhere else the 3D renderer is swapped for a stub
    resolve: { alias: lowpoly ? [] : [{ find: /^\.\.\/lowpoly\/battle3d$/, replacement: fileURLToPath(new URL('./src/lowpoly/stub.ts', import.meta.url)) }] },
    build: { outDir: prod ? 'dist-prod' : lowpoly ? 'dist-lowpoly' : 'dist', assetsInlineLimit: 100_000_000 },
  };
});
