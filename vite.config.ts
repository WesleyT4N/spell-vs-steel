import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// One self-contained index.html, so every build can be published as a playable artifact.
// `--mode prod` is the player-facing build: dev tools off (see src/flags.ts), output in dist-prod/.
export default defineConfig(({ mode }) => {
  const prod = mode === 'prod';
  return {
    plugins: [viteSingleFile()],
    define: { __DEV_TOOLS__: JSON.stringify(!prod) },
    build: { outDir: prod ? 'dist-prod' : 'dist', assetsInlineLimit: 100_000_000 },
  };
});
