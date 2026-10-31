// Loads the mods shipped in the repo's mods/ folder at boot (browser builds only: Vite bundles the files as
// text). Each file goes through the same checks a downloaded mod would (format.ts), and a bad one is skipped
// with a console warning instead of stopping the game.
import { addSkin } from '../art/sprites';
import { parseMod, type Mod } from './format';

/** Mods that loaded, in file-name order. */
export const MODS: Mod[] = [];

/** Register one mod's content. Returns what was refused (a skin id the class already has). */
export function registerMod(mod: Mod): string[] {
  const refused: string[] = [];
  for (const s of mod.skins) {
    if (!addSkin(s.cls, { id: s.id, name: s.name, set: {}, art: s.art })) refused.push(`${s.cls}:${s.id}`);
  }
  MODS.push(mod);
  return refused;
}

const files = import.meta.glob<string>('../../mods/*.json', { eager: true, query: '?raw', import: 'default' });
for (const path of Object.keys(files).sort()) {
  const res = parseMod(files[path]);
  if (!res.ok) { console.warn(`mod ${path} skipped: ${res.error}`); continue; }
  const refused = registerMod(res.mod);
  if (refused.length) console.warn(`mod ${path}: skins already taken: ${refused.join(', ')}`);
}
