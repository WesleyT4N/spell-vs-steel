import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
export default defineConfig({ root: 'harness', plugins: [viteSingleFile()], define: { __DEV_TOOLS__: 'false' }, build: { outDir: 'out', emptyOutDir: true, assetsInlineLimit: 100_000_000, rollupOptions: { input: 'harness/mage-lab.html' } } });
