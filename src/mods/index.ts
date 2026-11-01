// The installed mods: the ones shipped in the repo's mods/ folder (Vite bundles them as text) and the ones the
// player imported from the MODS screen (kept as text in the save). Every file goes through the same checks
// (format.ts) each time the game starts. A mod can be switched off; an imported one can be deleted. A bad
// file is listed with its error instead of stopping the game.
import { addSkin, removeSkin } from '../art/sprites';
import { getSave, setSave, type SavedMods } from '../engine/save';
import { parseMod, type Mod } from './format';

export type ModSource = 'built-in' | 'imported';
export interface ModEntry {
  /** The mod's id, or for a file that failed the checks, its file name. */
  id: string;
  source: ModSource;
  /** The parsed mod, or undefined when the file failed the checks (see error). */
  mod?: Mod;
  error?: string;
  on: boolean;
  /** Skins another mod (or a built-in color) already had, so this one's copy was left out. */
  refused: string[];
}

/** Every installed mod: built-ins in file-name order, then imported ones in the order they came in. */
export const MODS: ModEntry[] = [];
/** Most mods that can be imported, and the most text they may hold in all (the save shares about 5 MB with replays). */
export const MAX_IMPORTED = 12;
export const IMPORT_BUDGET = 1_000_000;

const saved = (): SavedMods => getSave('mods') ?? { off: [], imported: [] };
const store = (f: (m: SavedMods) => SavedMods): void => { const m = saved(); setSave('mods', f({ off: [...m.off], imported: [...m.imported] })); };

function register(e: ModEntry): void {
  e.refused = [];
  for (const s of e.mod?.skins ?? []) if (!addSkin(s.cls, { id: s.id, name: s.name, set: {}, art: s.art })) e.refused.push(`${s.cls}:${s.id}`);
}
function unregister(e: ModEntry): void {
  for (const s of e.mod?.skins ?? []) if (!e.refused.includes(`${s.cls}:${s.id}`)) removeSkin(s.cls, s.id);
  e.refused = [];
}

function add(text: string, source: ModSource, file: string, off: string[]): ModEntry {
  const res = parseMod(text);
  const e: ModEntry = res.ok
    ? { id: res.mod.id, source, mod: res.mod, on: !off.includes(res.mod.id), refused: [] }
    : { id: file, source, error: res.error, on: false, refused: [] };
  if (!res.ok) console.warn(`mod ${file} skipped: ${res.error}`);
  MODS.push(e);
  if (e.on) {
    register(e);
    if (e.refused.length) console.warn(`mod ${file}: skins already taken: ${e.refused.join(', ')}`);
  }
  return e;
}

/** Switch a mod on or off; the choice is kept. */
export function setModOn(id: string, on: boolean): void {
  const e = MODS.find(m => m.id === id && m.mod);
  if (!e || e.on === on) return;
  e.on = on;
  if (on) register(e); else unregister(e);
  store(m => ({ ...m, off: on ? m.off.filter(x => x !== id) : [...m.off.filter(x => x !== id), id] }));
}

export type ImportResult = { ok: true; entry: ModEntry } | { ok: false; error: string };
/** Install a mod file the player picked or pasted. It is checked like any other and switched on. */
export function importMod(text: string): ImportResult {
  const res = parseMod(text);
  if (!res.ok) return { ok: false, error: res.error };
  const have = MODS.find(m => m.id === res.mod.id);
  if (have?.source === 'built-in') return { ok: false, error: `"${res.mod.id}" is already installed with the game` };
  if (!have && MODS.filter(m => m.source === 'imported').length >= MAX_IMPORTED) return { ok: false, error: `at most ${MAX_IMPORTED} imported mods; delete one first` };
  const used = saved().imported.filter(m => m.id !== res.mod.id).reduce((n, m) => n + m.text.length, 0);
  if (used + text.length > IMPORT_BUDGET) return { ok: false, error: 'not enough room for this mod; delete another first' };
  // the same id again replaces the older copy
  if (have) removeMod(have.id);
  store(m => ({ off: m.off.filter(x => x !== res.mod.id), imported: [...m.imported, { id: res.mod.id, text }] }));
  return { ok: true, entry: add(text, 'imported', res.mod.id, []) };
}

/** Delete an imported mod. Built-in mods can only be switched off. */
export function removeMod(id: string): boolean {
  const i = MODS.findIndex(m => m.id === id && m.source === 'imported');
  if (i < 0) return false;
  unregister(MODS[i]);
  MODS.splice(i, 1);
  store(m => ({ off: m.off.filter(x => x !== id), imported: m.imported.filter(x => x.id !== id) }));
  return true;
}

/** Load every installed mod. Runs once when the game starts (and again in tests). */
export function loadMods(builtIn: Record<string, string>): void {
  for (const e of MODS.splice(0)) unregister(e);
  const { off, imported } = saved();
  for (const path of Object.keys(builtIn).sort()) add(builtIn[path], 'built-in', path.split('/').pop() ?? path, off);
  for (const m of imported) {
    if (MODS.some(e => e.id === m.id)) continue;
    add(m.text, 'imported', m.id, off);
  }
}
