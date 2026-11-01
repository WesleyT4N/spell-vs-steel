// The installed mods: the ones shipped in the repo's mods/ folder (one folder per mod: mod.json and its PNGs) and
// the ones the player imported from the MODS screen (kept in the save: a zip as base64, or an old JSON mod's text).
// Every mod goes through the same checks (format.ts) each time the game starts. A mod can be switched off; an
// imported one can be deleted. A bad mod is listed with its error instead of stopping the game.
import { addSkin, removeSkin } from '../art/sprites';
import { getSave, setSave, type SavedMods } from '../engine/save';
import { parseMod, readMod, readModFiles, type Mod, type ParseResult } from './format';

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
/** Most mods that can be imported, and the most save text they may take in all (the save shares about 5 MB with replays). */
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

function add(res: ParseResult, source: ModSource, file: string, off: string[]): ModEntry {
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

const toB64 = (b: Uint8Array): string => { let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = (s: string): Uint8Array => Uint8Array.from(atob(s), ch => ch.charCodeAt(0));

/** Install a mod file the player picked (a zip, or an old JSON mod). It is checked like any other and switched on. */
export async function importMod(bytes: Uint8Array): Promise<ImportResult> {
  const res = await readMod(bytes);
  if (!res.ok) return { ok: false, error: res.error };
  const have = MODS.find(m => m.id === res.mod.id);
  if (have?.source === 'built-in') return { ok: false, error: `"${res.mod.id}" is already installed with the game` };
  if (!have && MODS.filter(m => m.source === 'imported').length >= MAX_IMPORTED) return { ok: false, error: `at most ${MAX_IMPORTED} imported mods; delete one first` };
  // a zip is kept as base64; an old JSON mod as its text
  const zip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const kept = zip ? { id: res.mod.id, zip: toB64(bytes) } : { id: res.mod.id, text: new TextDecoder().decode(bytes) };
  const size = (m: { text?: string; zip?: string }): number => (m.text ?? m.zip ?? '').length;
  const used = saved().imported.filter(m => m.id !== res.mod.id).reduce((n, m) => n + size(m), 0);
  if (used + size(kept) > IMPORT_BUDGET) return { ok: false, error: 'not enough room for this mod; delete another first' };
  // the same id again replaces the older copy
  if (have) removeMod(have.id);
  store(m => ({ off: m.off.filter(x => x !== res.mod.id), imported: [...m.imported, kept] }));
  return { ok: true, entry: add(res, 'imported', res.mod.id, []) };
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

/** A shipped mod: its folder name and its files by name (mod.json and the PNGs). */
export interface BuiltInMod { folder: string; files: Map<string, Uint8Array> }

/** Load every installed mod. Runs once when the game starts (and again in tests). */
export async function loadMods(builtIn: BuiltInMod[]): Promise<void> {
  for (const e of MODS.splice(0)) unregister(e);
  const { off, imported } = saved();
  const shipped = await Promise.all([...builtIn].sort((a, b) => (a.folder < b.folder ? -1 : 1)).map(async m => [m.folder, await readModFiles(m.files)] as const));
  const mine = await Promise.all(imported.map(async m => [m.id, m.zip !== undefined ? await readMod(fromB64(m.zip)) : parseMod(m.text ?? '')] as const));
  // registered in one go after the reading, so the order never depends on which file finished first
  for (const [folder, res] of shipped) add(res, 'built-in', folder, off);
  for (const [id, res] of mine) {
    if (MODS.some(e => e.id === id)) continue;
    add(res, 'imported', id, off);
  }
}
