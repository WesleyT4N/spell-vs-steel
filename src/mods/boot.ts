// Loads the installed mods when the game starts (browser builds: Vite bundles the repo's mods/ folder as text).
import { loadMods } from './index';

loadMods(import.meta.glob<string>('../../mods/*.json', { eager: true, query: '?raw', import: 'default' }));
