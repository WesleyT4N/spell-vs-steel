// Loads the installed mods when the game starts. The repo's mods/ folder holds one folder per shipped mod (mod.json
// and its PNGs, plus MP3s for a skin with its own voice); Vite hands over each file's URL (a data URL in the one-file web build) and the bytes are read back.
import { loadMods, type BuiltInMod } from './index';
import { urlBytes } from '../engine/assets';

const urls = import.meta.glob<string>('../../mods/*/*.{json,png,mp3}', { eager: true, query: '?url', import: 'default' });

async function shipped(): Promise<BuiltInMod[]> {
  const mods = new Map<string, BuiltInMod>();
  await Promise.all(Object.entries(urls).map(async ([path, url]) => {
    const [folder, name] = path.split('/').slice(-2);
    let m = mods.get(folder);
    if (!m) mods.set(folder, m = { folder, files: new Map() });
    const files = m.files;
    try { files.set(name, await urlBytes(url)); } catch { /* left out: the mod reports what is missing */ }
  }));
  return [...mods.values()];
}

/** Resolves once every mod is read and its skins registered (the game waits on it before the first screen). */
export const modsReady: Promise<void> = shipped().then(loadMods).catch(e => console.warn('mods did not load', e));
