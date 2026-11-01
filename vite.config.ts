import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The game reads its art and audio from assets/ (see src/engine/assets.ts). How they ship depends on the build:
// - default (dist/) and `--mode prod` (dist-prod/): one self-contained index.html with every asset packed in as a
//   data URL, so the build can be published as a playable artifact page. `prod` turns dev tools off (src/flags.ts).
// - `--mode native` (dist-native/): the player build for the desktop (Electron) and Android (Capacitor) apps:
//   index.html plus the game's script and every asset as real files beside it, loaded by relative path.
export default defineConfig(({ mode }) => {
  const native = mode === 'native';
  const prod = mode === 'prod' || native;
  return {
    base: native ? './' : '/',
    plugins: native ? [] : [viteSingleFile()],
    define: { __DEV_TOOLS__: JSON.stringify(!prod) },
    build: native
      ? { outDir: 'dist-native', assetsInlineLimit: 0, chunkSizeWarningLimit: 4096 }
      : { outDir: prod ? 'dist-prod' : 'dist', assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 100_000 },
  };
});
