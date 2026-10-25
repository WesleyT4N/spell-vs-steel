import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// One self-contained index.html, so every build can be published as a playable artifact.
export default defineConfig({
  plugins: [viteSingleFile()],
  build: { outDir: 'dist', assetsInlineLimit: 100_000_000 },
});
