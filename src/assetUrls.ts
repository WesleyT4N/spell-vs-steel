// Every image and sound file under assets/, handed to the asset registry (src/engine/assets.ts). Vite resolves the
// URLs at build time: real files in the desktop and Android builds, data URLs inside the one-file web page.
import { registerAssets } from './engine/assets';

registerAssets(import.meta.glob<string>('../assets/**/*.{png,mp3}', { query: '?url', import: 'default', eager: true }));
